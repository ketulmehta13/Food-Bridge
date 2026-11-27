import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

// 404 for any route that did not match.
export const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

// Normalise known error types into an ApiError.
const normalizeError = (err) => {
  if (err instanceof ApiError) return err;

  // Invalid ObjectId or other cast failure
  if (err.name === 'CastError') {
    return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // Duplicate key (unique index)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ') || 'field';
    return ApiError.conflict(`Duplicate value for ${fields}`);
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError' && err.errors) {
    const errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return ApiError.badRequest('Validation failed', errors);
  }

  // JWT errors
  if (err.name === 'TokenExpiredError') return ApiError.unauthorized('Token expired');
  if (err.name === 'JsonWebTokenError') return ApiError.unauthorized('Invalid token');

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body');

  return new ApiError(err.statusCode || err.status || 500, err.message || 'Internal server error');
};

// Final error handler: always responds with { success: false, statusCode, message, errors }.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const error = normalizeError(err);
  const statusCode = error.statusCode >= 400 ? error.statusCode : 500;

  if (statusCode >= 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    statusCode,
    // Hide internal details of unexpected errors in production.
    message: statusCode >= 500 && env.IS_PROD ? 'Internal server error' : error.message,
    errors: error.errors || [],
    ...(env.IS_PROD ? {} : { stack: err.stack }),
  });
};

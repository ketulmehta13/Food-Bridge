import { ApiError } from '../utils/ApiError.js';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF guard for cookie-authenticated APIs.
 * A plain HTML form on another site cannot set custom headers, so every
 * state-changing request must carry "X-Requested-With: XMLHttpRequest" (403 otherwise).
 */
export const csrfGuard = (req, res, next) => {
  if (!UNSAFE_METHODS.has(req.method)) return next();
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    return next(ApiError.forbidden('Missing or invalid X-Requested-With header'));
  }
  next();
};

/**
 * Reject a request body that is not JSON (415). Requests without a body pass.
 * Apply per route on JSON endpoints (not on multipart upload routes).
 */
export const requireJson = (req, res, next) => {
  // Content-Length: 0 counts as "no body" (req.is() alone would treat it as a body).
  const hasBody =
    req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length']) > 0;
  if (hasBody && !req.is('application/json')) {
    return next(new ApiError(415, 'Content-Type must be application/json'));
  }
  next();
};

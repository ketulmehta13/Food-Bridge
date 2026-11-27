import rateLimit from 'express-rate-limit';

// General limiter for all /api routes.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many requests, please try again later' },
});

// Stricter limiter for sensitive routes (login, OTP, password reset). Apply per route.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, statusCode: 429, message: 'Too many attempts, please try again later' },
});

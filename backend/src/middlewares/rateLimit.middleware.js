import rateLimit from 'express-rate-limit';

// Automated tests send many requests quickly, so limits are off when NODE_ENV=test.
const skipInTests = () => process.env.NODE_ENV === 'test';

// General limiter for all /api routes.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  message: { success: false, statusCode: 429, message: 'Too many requests, please try again later' },
});

// Stricter limiter for sensitive routes (login, register, OTP, password reset). Apply per route.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: skipInTests,
  message: { success: false, statusCode: 429, message: 'Too many attempts, please try again later' },
});

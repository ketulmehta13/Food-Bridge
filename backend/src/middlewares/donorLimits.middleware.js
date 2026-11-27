import rateLimit from 'express-rate-limit';

/**
 * Per-donor rate limits. Keyed by the logged-in user's id (not the IP), so one donor
 * cannot flood the API from many IPs and donors behind one IP don't block each other.
 * Use after protect/loadCurrentUser. Unlike the global limiters these stay ON in tests,
 * so tests can prove the 429; reset between tests with limiter.resetKey(userId).
 */
export const DONOR_RATE_LIMITS = Object.freeze({
  CREATE_DONATION: Object.freeze({ windowMs: 60 * 60 * 1000, limit: 20 }), // 20 posts / hour
});

const perUserLimiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator: (req) => `user:${req.user.id}`,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      statusCode: 429,
      message: 'Too many requests, please try again later',
    },
  });

/** Limits how many donations one donor can post per window. */
export const createDonationLimiter = perUserLimiter(DONOR_RATE_LIMITS.CREATE_DONATION);

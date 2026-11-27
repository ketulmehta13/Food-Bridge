// Import this FIRST in every test file. It sets safe test values before
// src/config/env.js is loaded (dotenv never overrides variables that are already set).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-not-for-production';
process.env.JWT_ACCESS_EXPIRY ||= '15m';
process.env.JWT_REFRESH_EXPIRY ||= '7d';

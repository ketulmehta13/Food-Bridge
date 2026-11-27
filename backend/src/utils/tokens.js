import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Sign a short-lived access token. Payload: { id, role, userType, verificationStatus }.
export const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });

// Sign a long-lived refresh token. Only the user id goes inside; the random
// jwtid makes every refresh token unique, even if two are issued in the same second.
export const signRefreshToken = (userId) =>
  jwt.sign({ id: String(userId) }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
    jwtid: crypto.randomUUID(),
  });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

// SHA-256 hash of a token, so the database never stores a usable refresh token.
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Cookie names used across the app.
export const COOKIE_NAMES = Object.freeze({
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken',
});

// The refresh cookie is only sent to /api/auth (refresh + logout), not to every request.
const REFRESH_COOKIE_PATH = '/api/auth';

// In production the frontend and API are on different domains,
// so cookies must be SameSite=None + Secure.
const baseCookieOptions = () => ({
  httpOnly: true, // JavaScript in the browser cannot read these cookies
  secure: env.IS_PROD,
  sameSite: env.IS_PROD ? 'none' : 'lax',
  path: '/',
});

export const accessCookieOptions = () => ({
  ...baseCookieOptions(),
  maxAge: 15 * 60 * 1000, // 15 minutes (match JWT_ACCESS_EXPIRY)
});

export const refreshCookieOptions = () => ({
  ...baseCookieOptions(),
  path: REFRESH_COOKIE_PATH,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (match JWT_REFRESH_EXPIRY)
});

// Options for res.clearCookie (must match the options used to set each cookie, minus maxAge).
export const clearAccessCookieOptions = () => baseCookieOptions();
export const clearRefreshCookieOptions = () => ({ ...baseCookieOptions(), path: REFRESH_COOKIE_PATH });

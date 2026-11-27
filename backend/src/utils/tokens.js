import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Sign a short-lived access token.
export const signAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });

// Sign a long-lived refresh token.
export const signRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRY });

export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

// Cookie names used across the app.
export const COOKIE_NAMES = Object.freeze({
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken',
});

// In production the frontend and API are on different domains,
// so cookies must be SameSite=None + Secure.
const baseCookieOptions = () => ({
  httpOnly: true,
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
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (match JWT_REFRESH_EXPIRY)
});

// Options for res.clearCookie (must match the options used to set it, minus maxAge).
export const clearCookieOptions = () => baseCookieOptions();

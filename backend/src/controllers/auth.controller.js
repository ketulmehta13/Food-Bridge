import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  COOKIE_NAMES,
  accessCookieOptions,
  refreshCookieOptions,
  clearAccessCookieOptions,
  clearRefreshCookieOptions,
} from '../utils/tokens.js';

// Put both tokens in httpOnly cookies (the browser stores and sends them automatically).
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, accessCookieOptions());
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, refreshCookieOptions());
};

const clearAuthCookies = (res) => {
  res.clearCookie(COOKIE_NAMES.ACCESS, clearAccessCookieOptions());
  res.clearCookie(COOKIE_NAMES.REFRESH, clearRefreshCookieOptions());
};

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { user, ...tokens } = await authService.register(req.body);
  setAuthCookies(res, tokens);
  ApiResponse.send(res, 201, { user }, 'Account created');
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { user, ...tokens } = await authService.login(req.body);
  setAuthCookies(res, tokens);
  ApiResponse.send(res, 200, { user }, 'Logged in');
});

// POST /api/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
  try {
    const { user, ...tokens } = await authService.refresh(req.cookies[COOKIE_NAMES.REFRESH]);
    setAuthCookies(res, tokens);
    ApiResponse.send(res, 200, { user }, 'Token refreshed');
  } catch (err) {
    clearAuthCookies(res); // a failed refresh means the session is over
    throw err;
  }
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[COOKIE_NAMES.REFRESH]);
  clearAuthCookies(res);
  ApiResponse.send(res, 200, null, 'Logged out');
});

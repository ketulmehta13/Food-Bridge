import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { toPoint } from '../utils/geo.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/tokens.js';

/**
 * Create a new access + refresh token pair for a user and remember the
 * refresh token (as a hash) on the user. Only ONE refresh token is valid
 * at a time: issuing a new one replaces the old one.
 */
const issueTokens = async (user, { isLogin = false } = {}) => {
  const accessToken = signAccessToken(user.toTokenPayload());
  const refreshToken = signRefreshToken(user._id);

  const update = { refreshTokenHash: hashToken(refreshToken) };
  if (isLogin) update.lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, update);

  return { accessToken, refreshToken };
};

// Register a donor or NGO (data is already validated by registerSchema).
export const register = async (data) => {
  const { location, ...rest } = data;

  const user = await User.create({
    ...rest,
    ...(location && { location: toPoint(location.lat, location.lng) }),
  });

  const tokens = await issueTokens(user, { isLogin: true });
  return { user, ...tokens };
};

// Check email + password and log the user in.
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  // Same message for "no such email" and "wrong password", so attackers
  // can't use the login form to find out which emails are registered.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('Your account has been deactivated. Contact support.');
  }

  const tokens = await issueTokens(user, { isLogin: true });
  return { user, ...tokens };
};

/**
 * Swap a valid refresh token for a NEW access + refresh token pair (rotation).
 * The access token is rebuilt from the database, so changes such as an admin
 * verifying the account show up here.
 */
export const refresh = async (refreshToken) => {
  if (!refreshToken) throw ApiError.unauthorized('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  const user = await User.findById(payload.id).select('+refreshTokenHash');
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid refresh token');

  // The token is genuine but is not the latest one we issued: it was already
  // used or the user logged out. Possible theft, so end the session completely.
  if (user.refreshTokenHash !== hashToken(refreshToken)) {
    await User.updateOne({ _id: user._id }, { $unset: { refreshTokenHash: 1 } });
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const tokens = await issueTokens(user);
  return { user, ...tokens };
};

// Invalidate the refresh token so it can't be used again. Never fails.
export const logout = async (refreshToken) => {
  if (!refreshToken) return;
  try {
    const { id } = verifyRefreshToken(refreshToken);
    await User.updateOne(
      { _id: id, refreshTokenHash: hashToken(refreshToken) },
      { $unset: { refreshTokenHash: 1 } }
    );
  } catch {
    // Invalid/expired token: nothing to invalidate.
  }
};

// Load the logged-in user (fresh from the database).
export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw ApiError.unauthorized('User no longer exists');
  return user;
};

import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Reload the logged-in user from the database on every request. Use after protect().
 * - unknown user (deleted, or a token with a bad id) -> 401
 * - isActive: false -> 403
 * - refreshes req.user.role/userType/verificationStatus from the DB, so a stale
 *   token cannot bypass requireVerified after an admin changes the account.
 */
export const loadCurrentUser = asyncHandler(async (req, res, next) => {
  if (!req.user) throw ApiError.unauthorized('Not authenticated');
  if (!mongoose.isValidObjectId(req.user.id)) throw ApiError.unauthorized('Invalid token');

  const user = await User.findById(req.user.id)
    .select('role userType verificationStatus isActive')
    .lean();

  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated');

  req.user = {
    ...req.user,
    role: user.role,
    userType: user.userType,
    verificationStatus: user.verificationStatus,
  };
  next();
});

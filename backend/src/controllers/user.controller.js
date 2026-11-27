import { getCurrentUser } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';

// GET /api/users/me - the logged-in user's own account.
export const getMe = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user.id);
  ApiResponse.send(res, 200, { user }, 'Current user');
});

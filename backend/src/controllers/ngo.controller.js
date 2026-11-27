import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as ngoService from '../services/ngo.service.js';

// Thin handlers for /api/ngo/*: read validated input, call one service, send the response.

export const getProfile = asyncHandler(async (req, res) => {
  const user = await ngoService.getProfile(req.user.id);
  ApiResponse.send(res, 200, { user }, 'Profile fetched');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { user, verificationReset } = await ngoService.updateProfile(req.user.id, req.body);
  ApiResponse.send(
    res,
    200,
    { user, verificationReset },
    verificationReset
      ? 'Profile updated. Your NGO will be re-verified because the organisation details changed.'
      : 'Profile updated'
  );
});

import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as donorService from '../services/donor.service.js';
import * as donorEditService from '../services/donor.edit.service.js';

// Thin handlers for /api/donor/*: read validated input, call one service, send the response.

export const createDonation = asyncHandler(async (req, res) => {
  const donation = await donorService.createDonation(req.user.id, req.body);
  ApiResponse.send(res, 201, donation, 'Donation posted');
});

export const listMyDonations = asyncHandler(async (req, res) => {
  const result = await donorService.listMyDonations(req.user.id, req.query);
  ApiResponse.send(res, 200, result, 'Donations fetched');
});

export const getMyDonation = asyncHandler(async (req, res) => {
  const result = await donorService.getMyDonation(req.user.id, req.params.id);
  ApiResponse.send(res, 200, result, 'Donation fetched');
});

export const updateDonation = asyncHandler(async (req, res) => {
  const result = await donorEditService.updateMyDonation(req.user.id, req.params.id, req.body);
  ApiResponse.send(res, 200, result, 'Donation updated');
});

export const cancelDonation = asyncHandler(async (req, res) => {
  const result = await donorEditService.cancelMyDonation(req.user.id, req.params.id, req.body.reason);
  ApiResponse.send(res, 200, result, 'Donation cancelled');
});

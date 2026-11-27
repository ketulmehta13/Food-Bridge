import mongoose from 'mongoose';
import { CLAIM_ACTIONS } from '../constants/index.js';

// Append-only log of claim events on a donation. Owner: Jay.
// Written by both donor and NGO flows through logClaimAction() in donationStatus.service.js.
const claimHistorySchema = new mongoose.Schema({
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true },
  ngo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // null for system jobs
  action: { type: String, enum: Object.values(CLAIM_ACTIONS), required: true },
  reason: { type: String, trim: true, maxlength: 500 },
  at: { type: Date, default: Date.now },
});

claimHistorySchema.index({ donation: 1, at: -1 });
claimHistorySchema.index({ ngo: 1, action: 1 }); // strikes / NGO history

claimHistorySchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const ClaimHistory = mongoose.model('ClaimHistory', claimHistorySchema);

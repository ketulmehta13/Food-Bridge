import mongoose from 'mongoose';
import { Donation } from '../models/Donation.js';
import { ApiError } from '../utils/ApiError.js';
import { toPoint } from '../utils/geo.js';
import { DONATION_STATUS, CLAIM_ACTIONS } from '../constants/index.js';
import { transitionDonation, logClaimAction } from './donationStatus.service.js';
import {
  validateDonationTimeline,
  getMyDonation,
  toItems,
  toPickupWindow,
  toAddress,
} from './donor.service.js';

// Donor edit + cancel logic. Owner: Jay. Split from donor.service.js (file size).

/** Plain editable fields copied as-is when present in an edit. */
const EDITABLE_SCALARS = Object.freeze([
  'totalServings',
  'estimatedWeightKg',
  'foodType',
  'category',
  'preparedAt',
  'bestBefore',
  'contactPhone',
]);
/** Optional text fields: an empty value in an edit clears them. */
const CLEARABLE_TEXT = Object.freeze(['allergenInfo', 'notes']);

/** Build the $set / $unset of an edit from whitelisted fields only. */
const buildEditUpdate = (changes) => {
  const $set = {};
  const $unset = {};

  for (const field of EDITABLE_SCALARS) {
    if (changes[field] !== undefined) $set[field] = changes[field];
  }
  if (changes.items) $set.items = toItems(changes.items);
  if (changes.pickupWindow) $set.pickupWindow = toPickupWindow(changes.pickupWindow);
  if (changes.address) $set.address = toAddress(changes.address);
  if (changes.location) $set.location = toPoint(changes.location.lat, changes.location.lng);
  for (const field of CLEARABLE_TEXT) {
    if (!(field in changes)) continue;
    if (changes[field] === undefined) $unset[field] = 1;
    else $set[field] = changes[field];
  }

  const update = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  return update;
};

/**
 * Edit one of the donor's own donations. Only while AVAILABLE and before best-before.
 * Time rules are re-checked on the merged (stored + changed) times. The write is one
 * atomic update guarded by status AND the loaded updatedAt, so a claim or another edit
 * between the read and the write makes it fail (409) instead of overwriting.
 *
 * @param {string} donorId
 * @param {string} donationId
 * @param {object} changes validated body (updateDonationBody)
 * @returns {Promise<{ donation: object, history: object[] }>} same shape as getMyDonation
 * @throws {ApiError} 404 missing or not yours; 409 not AVAILABLE, expired, or changed meanwhile;
 *                    400 invalid merged timeline
 */
export const updateMyDonation = async (donorId, donationId, changes) => {
  if (!mongoose.isValidObjectId(donationId)) throw ApiError.notFound('Donation not found');

  const current = await Donation.findOne({ _id: donationId, donor: donorId })
    .select('status preparedAt bestBefore pickupWindow updatedAt')
    .lean();
  if (!current) throw ApiError.notFound('Donation not found');
  if (current.status !== DONATION_STATUS.AVAILABLE) {
    throw ApiError.conflict(`Donation is ${current.status}; only AVAILABLE donations can be edited`);
  }

  const now = new Date();
  if (current.bestBefore <= now) throw ApiError.conflict('Donation has expired');

  validateDonationTimeline(
    {
      preparedAt: changes.preparedAt ?? current.preparedAt,
      bestBefore: changes.bestBefore ?? current.bestBefore,
      pickupWindow: changes.pickupWindow ?? current.pickupWindow,
    },
    now
  );

  const updated = await Donation.findOneAndUpdate(
    {
      _id: donationId,
      donor: donorId,
      status: DONATION_STATUS.AVAILABLE,
      updatedAt: current.updatedAt,
    },
    buildEditUpdate(changes),
    { returnDocument: 'after', runValidators: true }
  );
  if (!updated) {
    const stillThere = await Donation.exists({ _id: donationId, donor: donorId });
    if (!stillThere) throw ApiError.notFound('Donation not found');
    throw ApiError.conflict('Donation changed, reload and retry');
  }

  return getMyDonation(donorId, donationId);
};

/**
 * Cancel one of the donor's own donations, in a transaction.
 * Without a reason only AVAILABLE food can be cancelled; with a reason AVAILABLE or CLAIMED
 * (so an NGO claim that lands just before the cancel is never silently dropped).
 * Clears the pickup OTP. If the food was CLAIMED, records CANCELLED_BY_DONOR against
 * that NGO in the same transaction and keeps claimedBy on the donation.
 *
 * @param {string} donorId
 * @param {string} donationId
 * @param {string} [reason] required when the donation is CLAIMED
 * @returns {Promise<{ donation: object, history: object[] }>} same shape as getMyDonation
 * @throws {ApiError} 400 CLAIMED without a reason; 404 missing or not yours;
 *                    409 PICKED_UP / DISTRIBUTED / EXPIRED / already CANCELLED
 */
export const cancelMyDonation = async (donorId, donationId, reason) => {
  const from = reason
    ? [DONATION_STATUS.AVAILABLE, DONATION_STATUS.CLAIMED]
    : [DONATION_STATUS.AVAILABLE];

  await mongoose.connection.transaction(async (session) => {
    let before;
    try {
      before = await transitionDonation({
        donationId,
        from,
        to: DONATION_STATUS.CANCELLED,
        extraFilter: { donor: donorId },
        set: { cancelledAt: new Date(), otpAttempts: 0, ...(reason && { cancelReason: reason }) },
        unset: ['pickupOtpHash', 'otpGeneratedAt'],
        returnDocument: 'before',
        session,
      });
    } catch (err) {
      if (!reason && err instanceof ApiError && err.statusCode === 409) {
        const current = await Donation.findOne({ _id: donationId, donor: donorId })
          .select('status')
          .session(session)
          .lean();
        if (current?.status === DONATION_STATUS.CLAIMED) {
          const message = 'Reason is required to cancel a claimed donation';
          throw ApiError.badRequest(message, [{ location: 'body', field: 'reason', message }]);
        }
      }
      throw err;
    }

    if (before.status === DONATION_STATUS.CLAIMED) {
      await logClaimAction({
        donation: before._id,
        ngo: before.claimedBy,
        actor: donorId,
        action: CLAIM_ACTIONS.CANCELLED_BY_DONOR,
        reason,
        session,
      });
    }
  });

  // FEATURE 6 HOOK: notify the claiming NGO (if any) that the donor cancelled (not built yet).

  return getMyDonation(donorId, donationId);
};

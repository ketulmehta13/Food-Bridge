import mongoose from 'mongoose';
import { Donation } from '../models/Donation.js';
import { ClaimHistory } from '../models/ClaimHistory.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { toPoint } from '../utils/geo.js';
import { paginate } from '../utils/queryBuilder.js';
import { DONATION_STATUS, DONATION_LIMITS } from '../constants/index.js';

// Donor business logic. Owner: Jay. Functions take plain arguments (never req/res),
// so routes, socket handlers and jobs can all call them.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const CLOCK_SKEW_MS = 2 * MINUTE_MS;

/** Statuses in which the donor may see who claimed the food. */
const CLAIMER_VISIBLE = new Set([
  DONATION_STATUS.CLAIMED,
  DONATION_STATUS.PICKED_UP,
  DONATION_STATUS.DISTRIBUTED,
]);

/** Fields returned by the "my donations" list (summary only). */
const LIST_FIELDS = {
  items: 1,
  totalServings: 1,
  estimatedWeightKg: 1,
  foodType: 1,
  category: 1,
  bestBefore: 1,
  pickupWindow: 1,
  status: 1,
  'address.city': 1,
  photos: { $slice: 1 },
  createdAt: 1,
};

const timelineError = (field, message) => ({ location: 'body', field, message });

/**
 * Check every donation time rule against the server clock (CLAUDE.md section 6).
 * Pure: no DB access. Collects all violations and throws them together.
 *
 * @param {{ preparedAt: Date, bestBefore: Date, pickupWindow: { start: Date, end: Date } }} t
 * @param {Date} [now=new Date()] injected for tests; production always uses the server clock
 * @throws {ApiError} 400 with errors[] = [{ location, field, message }]
 */
export const validateDonationTimeline = ({ preparedAt, bestBefore, pickupWindow }, now = new Date()) => {
  const errors = [];
  const nowMs = now.getTime();
  const prepared = preparedAt.getTime();
  const best = bestBefore.getTime();
  const start = pickupWindow.start.getTime();
  const end = pickupWindow.end.getTime();

  if (prepared > nowMs + CLOCK_SKEW_MS) {
    errors.push(timelineError('preparedAt', 'Prepared time cannot be in the future'));
  }
  if (best <= nowMs + DONATION_LIMITS.MIN_MINUTES_BEFORE_EXPIRY * MINUTE_MS) {
    errors.push(
      timelineError(
        'bestBefore',
        `Best-before must be more than ${DONATION_LIMITS.MIN_MINUTES_BEFORE_EXPIRY} minutes from now`
      )
    );
  }
  if (best <= prepared) {
    errors.push(timelineError('bestBefore', 'Best-before must be after the prepared time'));
  } else if (best - prepared > DONATION_LIMITS.MAX_SHELF_LIFE_HOURS * HOUR_MS) {
    errors.push(
      timelineError(
        'bestBefore',
        `Best-before must be within ${DONATION_LIMITS.MAX_SHELF_LIFE_HOURS} hours of the prepared time`
      )
    );
  }
  if (start >= end) {
    errors.push(timelineError('pickupWindow.start', 'Pickup start must be before pickup end'));
  }
  if (end > best) {
    errors.push(timelineError('pickupWindow.end', 'Pickup must end by the best-before time'));
  }
  if (end <= nowMs) {
    errors.push(timelineError('pickupWindow.end', 'Pickup end must be in the future'));
  }

  if (errors.length) throw ApiError.badRequest('Invalid donation timeline', errors);
};

/**
 * Create a donation for a donor. Only whitelisted fields are copied from input;
 * donor, status and all lifecycle fields are set by the server.
 *
 * @param {string} donorId logged-in donor's id
 * @param {object} input   validated body (createDonationBody)
 * @returns {Promise<object>} the saved donation (toJSON, no OTP fields)
 */
export const createDonation = async (donorId, input) => {
  const donor = await User.findById(donorId).select('name phone').lean();
  if (!donor) throw ApiError.unauthorized('User no longer exists');

  validateDonationTimeline(input);

  const donation = await Donation.create({
    donor: donorId,
    items: input.items.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    totalServings: input.totalServings,
    estimatedWeightKg: input.estimatedWeightKg,
    foodType: input.foodType,
    category: input.category,
    preparedAt: input.preparedAt,
    bestBefore: input.bestBefore,
    pickupWindow: { start: input.pickupWindow.start, end: input.pickupWindow.end },
    location: toPoint(input.location.lat, input.location.lng),
    address: {
      line1: input.address.line1,
      city: input.address.city,
      state: input.address.state,
      pincode: input.address.pincode,
    },
    contactPhone: input.contactPhone ?? donor.phone,
    safetyChecklist: {
      preparedHygienically: input.safetyChecklist.preparedHygienically,
      storedAtSafeTemperature: input.safetyChecklist.storedAtSafeTemperature,
      packedAndCovered: input.safetyChecklist.packedAndCovered,
      notSpoiled: input.safetyChecklist.notSpoiled,
    },
    allergenInfo: input.allergenInfo,
    notes: input.notes,
    status: DONATION_STATUS.AVAILABLE,
  });

  // FEATURE 6 HOOK: notify nearby NGOs about this new donation (not built yet).

  return donation.toJSON();
};

/**
 * List the donor's own donations (summary fields only), newest first by default.
 *
 * @param {string} donorId
 * @param {{ page: number, limit: number, status?: string, sort: string }} query validated query
 * @returns {Promise<{ items: object[], pagination: object }>}
 */
export const listMyDonations = async (donorId, { page, limit, status, sort }) => {
  const filter = { donor: donorId };
  if (status) filter.status = status;

  const result = await paginate(Donation, filter, {
    page,
    limit,
    sort,
    allowedSort: ['createdAt', 'bestBefore'],
    select: LIST_FIELDS,
  });

  const items = result.items.map(({ photos, ...rest }) => ({
    ...rest,
    coverPhoto: photos?.[0] ?? null,
  }));
  return { items, pagination: result.pagination };
};

/**
 * One of the donor's own donations with the claimer's contact (only once claimed)
 * and the claim history timeline. Missing and not-yours both return 404.
 *
 * @param {string} donorId
 * @param {string} donationId
 * @returns {Promise<{ donation: object, history: Array<{ action, reason, at }> }>}
 */
export const getMyDonation = async (donorId, donationId) => {
  if (!mongoose.isValidObjectId(donationId)) throw ApiError.notFound('Donation not found');

  const donation = await Donation.findOne({ _id: donationId, donor: donorId });
  if (!donation) throw ApiError.notFound('Donation not found');

  const showClaimer = CLAIMER_VISIBLE.has(donation.status) && donation.claimedBy;
  const [, history] = await Promise.all([
    showClaimer
      ? donation.populate({ path: 'claimedBy', select: 'name phone ngoProfile.orgName' })
      : null,
    ClaimHistory.find({ donation: donation._id })
      .select('action reason at -_id')
      .sort({ at: 1, _id: 1 })
      .lean(),
  ]);

  const claimer = showClaimer ? donation.claimedBy : null;
  const json = donation.toJSON();
  json.claimedBy = claimer?.name
    ? { name: claimer.name, phone: claimer.phone ?? null, orgName: claimer.ngoProfile?.orgName ?? null }
    : null;

  return { donation: json, history };
};

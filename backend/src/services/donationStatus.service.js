import mongoose from 'mongoose';
import { Donation } from '../models/Donation.js';
import { ClaimHistory } from '../models/ClaimHistory.js';
import { ApiError } from '../utils/ApiError.js';
import { DONATION_STATUS } from '../constants/index.js';

// The single source of truth for donation status changes. Shared by donor and NGO code.

const S = DONATION_STATUS;

/** Legal status transitions. EXPIRED, CANCELLED and DISTRIBUTED are final. */
export const TRANSITIONS = Object.freeze({
  [S.AVAILABLE]: Object.freeze([S.CLAIMED, S.EXPIRED, S.CANCELLED]),
  [S.CLAIMED]: Object.freeze([S.AVAILABLE, S.CANCELLED, S.PICKED_UP]),
  [S.PICKED_UP]: Object.freeze([S.DISTRIBUTED]),
  [S.DISTRIBUTED]: Object.freeze([]),
  [S.EXPIRED]: Object.freeze([]),
  [S.CANCELLED]: Object.freeze([]),
});

/**
 * @param {string} from current status
 * @param {string} to   target status
 * @returns {boolean} true if the transition is legal
 */
export const canTransition = (from, to) => Boolean(TRANSITIONS[from]?.includes(to));

/**
 * Throw 409 unless from -> to is a legal transition.
 * @param {string} from
 * @param {string} to
 * @throws {ApiError} 409
 */
export const assertTransition = (from, to) => {
  if (!canTransition(from, to)) {
    throw ApiError.conflict(`Cannot change a donation from ${from} to ${to}`);
  }
};

/**
 * Atomically move a donation to a new status. Exactly one of several concurrent
 * callers can win, because the current status is part of the update filter.
 *
 * @param {object} args
 * @param {string} args.donationId
 * @param {string[]} args.from         statuses the donation may currently be in
 * @param {string} args.to             target status
 * @param {object} [args.extraFilter]  ownership/visibility conditions, e.g. { donor: id } or
 *                                     { claimedBy: id }. Cannot override _id or status.
 *                                     A document that fails these conditions is reported
 *                                     as 404, so only put "is this yours / can you see it"
 *                                     rules here.
 * @param {object} [args.set]          extra fields to $set with the status (e.g. claimedBy)
 * @param {import('mongoose').ClientSession} [args.session] optional transaction session
 * @returns {Promise<import('mongoose').Document>} the updated donation
 * @throws {ApiError} 409 illegal transition or wrong current status;
 *                    404 not found or does not match extraFilter (e.g. not yours)
 *
 * @example
 * // Donor cancels their own donation:
 * await transitionDonation({
 *   donationId, from: [DONATION_STATUS.AVAILABLE, DONATION_STATUS.CLAIMED],
 *   to: DONATION_STATUS.CANCELLED, extraFilter: { donor: donorId },
 *   set: { cancelReason: reason, cancelledAt: new Date() },
 * });
 *
 * @example
 * // NGO claims an available donation (first one wins):
 * await transitionDonation({
 *   donationId, from: [DONATION_STATUS.AVAILABLE], to: DONATION_STATUS.CLAIMED,
 *   set: { claimedBy: ngoId, claimedAt: new Date() },
 * });
 */
export const transitionDonation = async ({
  donationId,
  from,
  to,
  extraFilter = {},
  set = {},
  session,
}) => {
  if (!Array.isArray(from) || from.length === 0) {
    throw new Error('transitionDonation: "from" must be a non-empty array');
  }
  for (const status of from) assertTransition(status, to);

  if (!mongoose.isValidObjectId(donationId)) throw ApiError.notFound('Donation not found');

  // _id and status come last so extraFilter can never override them.
  const filter = { ...extraFilter, _id: donationId, status: { $in: from } };
  const updated = await Donation.findOneAndUpdate(
    filter,
    { $set: { ...set, status: to } },
    { returnDocument: 'after', runValidators: true, session }
  );
  if (updated) return updated;

  // Work out why: missing / not yours (404) vs. wrong current state (409).
  const current = await Donation.findOne({ ...extraFilter, _id: donationId })
    .select('status')
    .session(session ?? null)
    .lean();
  if (!current) throw ApiError.notFound('Donation not found');
  throw ApiError.conflict(`Donation is ${current.status}; cannot change it to ${to}`);
};

/**
 * Record a claim event in ClaimHistory.
 * @param {object} args
 * @param {string} args.donation donation id
 * @param {string} [args.ngo]    NGO user id involved
 * @param {string} [args.actor]  user who acted (omit for system jobs)
 * @param {string} args.action   one of CLAIM_ACTIONS
 * @param {string} [args.reason]
 * @param {import('mongoose').ClientSession} [args.session]
 * @returns {Promise<import('mongoose').Document>} the created entry
 */
export const logClaimAction = async ({ donation, ngo, actor, action, reason, session }) => {
  const [entry] = await ClaimHistory.create([{ donation, ngo, actor, action, reason }], {
    session,
  });
  return entry;
};

import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';

import { startDb, stopDb } from '../helpers/db.js';
import { createUser, createDonation } from '../helpers/factories.js';
import { authHeaders } from '../helpers/auth.js';
import app from '../../src/app.js';
import { Donation } from '../../src/models/Donation.js';
import { ClaimHistory } from '../../src/models/ClaimHistory.js';
import { transitionDonation, logClaimAction } from '../../src/services/donationStatus.service.js';
import {
  ROLES,
  USER_TYPES,
  VERIFICATION_STATUS,
  DONATION_STATUS as S,
  CLAIM_ACTIONS,
} from '../../src/constants/index.js';

const url = (id) => `/api/donor/donations/${id}/cancel`;
const REASON = 'Event got cancelled last minute';

/** Assert a response never leaks OTP data. */
const noOtp = (res) => {
  assert.ok(!res.text.includes('pickupOtpHash'), 'pickupOtpHash leaked');
  assert.ok(!res.text.includes('otpAttempts'), 'otpAttempts leaked');
  assert.ok(!res.text.includes('deadbeef'), 'OTP hash value leaked');
};

describe('PATCH /api/donor/donations/:id/cancel', () => {
  let donorA, donorB, pending, inactive, ngo, admin, donation;

  const cancel = (user, body = {}, id = donation._id) =>
    request(app).patch(url(id)).set(authHeaders(user)).send(body);

  /** Claim the donation as the NGO the way the NGO side will, and give it an OTP. */
  const claim = async () => {
    await transitionDonation({
      donationId: donation._id,
      from: [S.AVAILABLE],
      to: S.CLAIMED,
      set: { claimedBy: ngo._id, claimedAt: new Date(), pickupOtpHash: 'deadbeef', otpGeneratedAt: new Date(), otpAttempts: 2 },
    });
    await logClaimAction({ donation: donation._id, ngo: ngo._id, actor: ngo._id, action: CLAIM_ACTIONS.CLAIMED });
  };

  const statusOf = async () => (await Donation.findById(donation._id).lean()).status;

  before(async () => {
    await startDb();
    [donorA, donorB, pending, inactive, ngo, admin] = await Promise.all([
      createUser(USER_TYPES.DONOR),
      createUser(USER_TYPES.DONOR),
      createUser(USER_TYPES.DONOR, { verificationStatus: VERIFICATION_STATUS.PENDING }),
      createUser(USER_TYPES.DONOR, { isActive: false }),
      createUser(USER_TYPES.NGO, { phone: '9111111111' }),
      createUser(ROLES.ADMIN),
    ]);
  });
  after(stopDb);
  beforeEach(async () => {
    await Donation.deleteMany({});
    await ClaimHistory.deleteMany({});
    donation = await createDonation(donorA);
  });

  // ---- AVAILABLE ----

  it('200: AVAILABLE without a reason -> CANCELLED, no history entry', async () => {
    const res = await cancel(donorA);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noOtp(res);
    assert.equal(res.body.data.donation.status, S.CANCELLED);
    assert.ok(res.body.data.donation.cancelledAt);
    assert.equal(await statusOf(), S.CANCELLED);
    assert.equal(await ClaimHistory.countDocuments(), 0);
  });

  it('200: AVAILABLE with a reason stores the reason', async () => {
    const res = await cancel(donorA, { reason: REASON });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.donation.cancelReason, REASON);
  });

  it('200 with no body at all (reason is optional for AVAILABLE)', async () => {
    const res = await request(app).patch(url(donation._id)).set(authHeaders(donorA));
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  // ---- CLAIMED ----

  it('400: CLAIMED without a reason, and it stays CLAIMED', async () => {
    await claim();
    const res = await cancel(donorA);
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Reason is required to cancel a claimed donation');
    assert.ok(res.body.errors.some((e) => e.field === 'reason'));
    noOtp(res);
    assert.equal(await statusOf(), S.CLAIMED);
    assert.equal(await ClaimHistory.countDocuments({ action: CLAIM_ACTIONS.CANCELLED_BY_DONOR }), 0);
  });

  it('200: CLAIMED with a reason -> CANCELLED_BY_DONOR logged for that NGO, OTP cleared, claimedBy kept', async () => {
    await claim();
    const res = await cancel(donorA, { reason: REASON });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    noOtp(res);

    const saved = await Donation.findById(donation._id).select('+pickupOtpHash').lean();
    assert.equal(saved.status, S.CANCELLED);
    assert.equal(saved.cancelReason, REASON);
    assert.equal(String(saved.claimedBy), String(ngo._id));
    assert.ok(!('pickupOtpHash' in saved));
    assert.ok(!('otpGeneratedAt' in saved));
    assert.equal(saved.otpAttempts, 0);

    const entry = await ClaimHistory.findOne({ action: CLAIM_ACTIONS.CANCELLED_BY_DONOR }).lean();
    assert.equal(String(entry.ngo), String(ngo._id));
    assert.equal(String(entry.actor), String(donorA._id));
    assert.equal(entry.reason, REASON);

    // Response: claimer hidden once cancelled, history shows the cancel without NGO ids.
    assert.equal(res.body.data.donation.claimedBy, null);
    assert.deepEqual(res.body.data.history.map((h) => h.action), [CLAIM_ACTIONS.CLAIMED, CLAIM_ACTIONS.CANCELLED_BY_DONOR]);
    assert.ok(!res.text.includes(String(ngo._id)));
  });

  // ---- other states ----

  for (const status of [S.PICKED_UP, S.DISTRIBUTED, S.EXPIRED, S.CANCELLED]) {
    it(`409 when the donation is ${status} (with or without a reason)`, async () => {
      await Donation.updateOne({ _id: donation._id }, { status });
      for (const body of [{}, { reason: REASON }]) {
        const res = await cancel(donorA, body);
        assert.equal(res.status, 409, `${status} ${JSON.stringify(body)}`);
        noOtp(res);
      }
      assert.equal(await statusOf(), status);
    });
  }

  it('cancel then edit -> 409', async () => {
    assert.equal((await cancel(donorA)).status, 200);
    const res = await request(app)
      .patch(`/api/donor/donations/${donation._id}`)
      .set(authHeaders(donorA))
      .send({ totalServings: 3 });
    assert.equal(res.status, 409);
  });

  // ---- races ----

  it('two cancels in parallel -> exactly one 200', async () => {
    const results = await Promise.all([cancel(donorA, { reason: REASON }), cancel(donorA, { reason: REASON })]);
    const codes = results.map((r) => r.status).sort();
    assert.deepEqual(codes, [200, 409]);
    assert.equal(await statusOf(), S.CANCELLED);
  });

  it('cancel (no reason) racing an NGO claim -> exactly one wins, state consistent', async () => {
    const [cancelRes, claimRes] = await Promise.allSettled([
      cancel(donorA),
      transitionDonation({ donationId: donation._id, from: [S.AVAILABLE], to: S.CLAIMED, set: { claimedBy: ngo._id } }),
    ]);
    const cancelled = cancelRes.value.status === 200;
    const claimed = claimRes.status === 'fulfilled';
    assert.ok(cancelled !== claimed, `cancel=${cancelRes.value.status} claim=${claimRes.status}`);
    assert.equal(await statusOf(), cancelled ? S.CANCELLED : S.CLAIMED);
    if (!cancelled) assert.equal(cancelRes.value.status, 400); // claimed first, no reason given
  });

  // ---- not yours / auth matrix ----

  it("404 when donorB cancels donorA's donation, unchanged", async () => {
    const theirs = await cancel(donorB, { reason: REASON });
    const missing = await cancel(donorB, {}, new mongoose.Types.ObjectId());
    assert.equal(theirs.status, 404);
    assert.equal(missing.status, 404);
    assert.equal(theirs.body.message, missing.body.message);
    assert.equal(await statusOf(), S.AVAILABLE);
  });

  it('400 for a malformed id', async () => {
    assert.equal((await cancel(donorA, {}, 'xyz')).status, 400);
  });

  it('401 without a token', async () => {
    const res = await request(app).patch(url(donation._id)).set('X-Requested-With', 'XMLHttpRequest').send({});
    assert.equal(res.status, 401);
  });

  for (const [label, who] of [['NGO', () => ngo], ['admin', () => admin], ['pending donor', () => pending], ['inactive donor', () => inactive]]) {
    it(`403 for ${label}`, async () => {
      assert.equal((await cancel(who(), { reason: REASON })).status, 403);
      assert.equal(await statusOf(), S.AVAILABLE);
    });
  }

  it('403 without the CSRF header', async () => {
    const { Authorization } = authHeaders(donorA);
    const res = await request(app).patch(url(donation._id)).set('Authorization', Authorization).send({});
    assert.equal(res.status, 403);
    assert.equal(await statusOf(), S.AVAILABLE);
  });

  it('415 for a non-JSON body', async () => {
    const res = await request(app).patch(url(donation._id)).set(authHeaders(donorA)).set('Content-Type', 'text/plain').send('reason=abcdef');
    assert.equal(res.status, 415);
  });

  for (const [label, body] of [
    ['reason under 5 chars', { reason: 'no' }],
    ['reason over 300 chars', { reason: 'x'.repeat(301) }],
    ['reason of spaces only', { reason: '        ' }],
    ['unknown key', { reason: REASON, status: S.AVAILABLE }],
    ['reason as an object', { reason: { $ne: '' } }],
  ]) {
    it(`400 for ${label}`, async () => {
      const res = await cancel(donorA, body);
      assert.equal(res.status, 400);
      assert.equal(await statusOf(), S.AVAILABLE);
    });
  }
});

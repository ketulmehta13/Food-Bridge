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

const url = (id) => `/api/donor/donations/${id}`;

describe('GET /api/donor/donations/:id', () => {
  let donorA, donorB, pending, inactive, ngo, otherNgo, admin, donation;

  const get = (user, id = donation._id) => request(app).get(url(id)).set(authHeaders(user));

  const claim = async (by = ngo) => {
    await transitionDonation({
      donationId: donation._id,
      from: [S.AVAILABLE],
      to: S.CLAIMED,
      set: { claimedBy: by._id, claimedAt: new Date() },
    });
    await logClaimAction({ donation: donation._id, ngo: by._id, actor: by._id, action: CLAIM_ACTIONS.CLAIMED });
  };

  const unclaim = async (by = ngo, reason = 'Vehicle broke down') => {
    await transitionDonation({
      donationId: donation._id,
      from: [S.CLAIMED],
      to: S.AVAILABLE,
      extraFilter: { claimedBy: by._id },
      set: { claimedBy: null, claimedAt: null },
    });
    await logClaimAction({
      donation: donation._id,
      ngo: by._id,
      actor: by._id,
      action: CLAIM_ACTIONS.UNCLAIMED,
      reason,
    });
  };

  before(async () => {
    await startDb();
    [donorA, donorB, pending, inactive, ngo, otherNgo, admin] = await Promise.all([
      createUser(USER_TYPES.DONOR),
      createUser(USER_TYPES.DONOR),
      createUser(USER_TYPES.DONOR, { verificationStatus: VERIFICATION_STATUS.PENDING }),
      createUser(USER_TYPES.DONOR, { isActive: false }),
      createUser(USER_TYPES.NGO, { phone: '9111111111', ngoProfile: { orgName: 'Asha Foundation', registrationNumber: 'R-1', contactPerson: 'Asha' } }),
      createUser(USER_TYPES.NGO, { phone: '9222222222', ngoProfile: { orgName: 'Other NGO', registrationNumber: 'R-2' } }),
      createUser(ROLES.ADMIN),
    ]);
  });
  after(stopDb);

  beforeEach(async () => {
    await Donation.deleteMany({});
    await ClaimHistory.deleteMany({});
    donation = await createDonation(donorA, { pickupOtpHash: 'deadbeefcafe', otpAttempts: 3 });
  });

  // ---- success ----

  it('200: my AVAILABLE donation, no claimer, empty history', async () => {
    const res = await get(donorA);
    assert.equal(res.status, 200);
    const { donation: d, history } = res.body.data;
    assert.equal(d._id, String(donation._id));
    assert.equal(d.status, S.AVAILABLE);
    assert.equal(d.claimedBy, null);
    assert.deepEqual(history, []);
    assert.equal(d.notes, undefined); // factory sets none
    assert.ok(d.safetyChecklist);
  });

  it('never returns OTP data', async () => {
    const res = await get(donorA);
    assert.ok(!res.text.includes('deadbeefcafe'));
    assert.ok(!res.text.includes('pickupOtpHash'));
    assert.ok(!res.text.includes('otpAttempts'));
  });

  it('shows ONLY name, phone and orgName of the claimer once CLAIMED', async () => {
    await claim();
    const res = await get(donorA);
    assert.equal(res.body.data.donation.status, S.CLAIMED);
    assert.deepEqual(res.body.data.donation.claimedBy, {
      name: ngo.name,
      phone: '9111111111',
      orgName: 'Asha Foundation',
    });
    assert.ok(!res.text.includes(ngo.email));
    assert.ok(!res.text.includes('R-1')); // registration number
    assert.ok(!res.text.includes(String(ngo._id))); // no NGO id anywhere
  });

  it('keeps showing the claimer after PICKED_UP and DISTRIBUTED', async () => {
    await claim();
    for (const to of [S.PICKED_UP, S.DISTRIBUTED]) {
      const from = to === S.PICKED_UP ? S.CLAIMED : S.PICKED_UP;
      await transitionDonation({ donationId: donation._id, from: [from], to });
      const res = await get(donorA);
      assert.equal(res.body.data.donation.status, to);
      assert.equal(res.body.data.donation.claimedBy.orgName, 'Asha Foundation');
    }
  });

  it('hides the claimer again after an unclaim; history has no NGO identities', async () => {
    await claim(otherNgo);
    await unclaim(otherNgo);
    const res = await get(donorA);
    assert.equal(res.body.data.donation.status, S.AVAILABLE);
    assert.equal(res.body.data.donation.claimedBy, null);

    const { history } = res.body.data;
    assert.deepEqual(history.map((h) => h.action), [CLAIM_ACTIONS.CLAIMED, CLAIM_ACTIONS.UNCLAIMED]);
    assert.equal(history[1].reason, 'Vehicle broke down');
    for (const h of history) {
      assert.deepEqual(Object.keys(h).sort(), h.reason ? ['action', 'at', 'reason'] : ['action', 'at']);
    }
    assert.ok(!res.text.includes(String(otherNgo._id)));
    assert.ok(!res.text.includes('Other NGO'));
  });

  it('shows only the current claimer after a re-claim by another NGO', async () => {
    await claim(otherNgo);
    await unclaim(otherNgo);
    await claim(ngo);
    const res = await get(donorA);
    assert.equal(res.body.data.donation.claimedBy.orgName, 'Asha Foundation');
    assert.equal(res.body.data.history.length, 3);
    assert.ok(!res.text.includes('Other NGO'));
    assert.ok(!res.text.includes('9222222222'));
  });

  it('hides a leftover claimedBy while the donation is not claimed', async () => {
    await Donation.updateOne({ _id: donation._id }, { claimedBy: ngo._id }); // inconsistent data
    const res = await get(donorA);
    assert.equal(res.body.data.donation.claimedBy, null);
  });

  it('pending donor can view their own donation', async () => {
    const mine = await createDonation(pending);
    assert.equal((await get(pending, mine._id)).status, 200);
  });

  // ---- not yours / not found ----

  it("404 when donorB asks for donorA's donation (same as missing)", async () => {
    const theirs = await get(donorB);
    const missing = await get(donorB, new mongoose.Types.ObjectId());
    assert.equal(theirs.status, 404);
    assert.equal(missing.status, 404);
    assert.equal(theirs.body.message, missing.body.message);
  });

  it('400 for a malformed id', async () => {
    for (const bad of ['123', 'not-an-id', `${'z'.repeat(24)}`]) {
      assert.equal((await get(donorA, bad)).status, 400, bad);
    }
  });

  // ---- auth / account matrix ----

  it('401 without a token', async () => {
    assert.equal((await request(app).get(url(donation._id))).status, 401);
  });

  it('403 with an NGO token (even the claimer)', async () => {
    await claim();
    assert.equal((await get(ngo)).status, 403);
  });

  it('403 with an admin token', async () => {
    assert.equal((await get(admin)).status, 403);
  });

  it('403 for an inactive donor', async () => {
    const theirs = await createDonation(inactive);
    assert.equal((await get(inactive, theirs._id)).status, 403);
  });
});

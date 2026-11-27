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
import { ROLES, USER_TYPES, VERIFICATION_STATUS, DONATION_STATUS as S } from '../../src/constants/index.js';

const url = (id) => `/api/donor/donations/${id}`;
const MIN = 60 * 1000;
const iso = (min) => new Date(Date.now() + min * MIN).toISOString();

/** Stored donation without timestamps, for "nothing else changed" comparisons. */
const snapshot = async (id) => {
  const { updatedAt, __v, ...rest } = await Donation.findById(id).select('+pickupOtpHash').lean();
  return JSON.parse(JSON.stringify(rest));
};

describe('PATCH /api/donor/donations/:id', () => {
  let donorA, donorB, pending, inactive, ngo, admin, donation;

  const patch = (user, body, id = donation._id) =>
    request(app).patch(url(id)).set(authHeaders(user)).send(body);

  /** Expect a 400 and that the stored donation did not change. */
  const expect400Unchanged = async (body, user = donorA) => {
    const before = await snapshot(donation._id);
    const res = await patch(user, body);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.deepEqual(await snapshot(donation._id), before);
    return res;
  };

  before(async () => {
    await startDb();
    [donorA, donorB, pending, inactive, ngo, admin] = await Promise.all([
      createUser(USER_TYPES.DONOR),
      createUser(USER_TYPES.DONOR),
      createUser(USER_TYPES.DONOR, { verificationStatus: VERIFICATION_STATUS.PENDING }),
      createUser(USER_TYPES.DONOR, { isActive: false }),
      createUser(USER_TYPES.NGO),
      createUser(ROLES.ADMIN),
    ]);
  });
  after(stopDb);
  beforeEach(async () => {
    await Donation.deleteMany({});
    donation = await createDonation(donorA, { notes: 'Bring boxes', pickupOtpHash: 'deadbeef' });
  });

  // ---- success ----

  it('200: changes only the sent field', async () => {
    const before = await snapshot(donation._id);
    const res = await patch(donorA, { totalServings: 12 });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.donation.totalServings, 12);
    assert.ok(Array.isArray(res.body.data.history));

    const afterSnap = await snapshot(donation._id);
    assert.deepEqual(afterSnap, { ...before, totalServings: 12 });
  });

  it('updates updatedAt', async () => {
    const old = (await Donation.findById(donation._id).lean()).updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await patch(donorA, { totalServings: 13 });
    const now = (await Donation.findById(donation._id).lean()).updatedAt;
    assert.ok(now > old);
  });

  it('replaces items, address and pickupWindow whole; location stored as [lng, lat]', async () => {
    const body = {
      items: [{ name: 'Dal', quantity: 3, unit: 'LITRE' }],
      address: { line1: '5 Ashram Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380014' },
      pickupWindow: { start: iso(45), end: iso(120) },
      location: { lat: 23.05, lng: 72.6 },
    };
    const res = await patch(donorA, body);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = await Donation.findById(donation._id).lean();
    assert.deepEqual(saved.items, body.items);
    assert.deepEqual(saved.address, body.address);
    assert.deepEqual(saved.location.coordinates, [72.6, 23.05]);
    assert.equal(saved.pickupWindow.end.toISOString(), body.pickupWindow.end);
  });

  it('valid change of times only -> 200', async () => {
    const res = await patch(donorA, { bestBefore: iso(8 * 60), pickupWindow: { start: iso(60), end: iso(7 * 60) } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
  });

  it('"notes": "" clears notes; other text is kept', async () => {
    const res = await patch(donorA, { notes: '', allergenInfo: 'Peanuts' });
    assert.equal(res.status, 200);
    const saved = await Donation.findById(donation._id).lean();
    assert.ok(!('notes' in saved));
    assert.equal(saved.allergenInfo, 'Peanuts');
  });

  it('never changes status, donor or OTP data, and never returns OTP data', async () => {
    const res = await patch(donorA, { totalServings: 7 });
    assert.ok(!res.text.includes('pickupOtpHash'));
    assert.ok(!res.text.includes('otpAttempts'));
    assert.ok(!res.text.includes('deadbeef'));
    const saved = await Donation.findById(donation._id).select('+pickupOtpHash').lean();
    assert.equal(saved.status, S.AVAILABLE);
    assert.equal(String(saved.donor), String(donorA._id));
    assert.equal(saved.pickupOtpHash, 'deadbeef');
  });

  // ---- auth / account matrix ----

  it('401 without a token', async () => {
    const res = await request(app).patch(url(donation._id)).set('X-Requested-With', 'XMLHttpRequest').send({ totalServings: 2 });
    assert.equal(res.status, 401);
  });

  for (const [label, who] of [['NGO', () => ngo], ['admin', () => admin], ['pending donor', () => pending], ['inactive donor', () => inactive]]) {
    it(`403 for ${label}`, async () => {
      const before = await snapshot(donation._id);
      assert.equal((await patch(who(), { totalServings: 2 })).status, 403);
      assert.deepEqual(await snapshot(donation._id), before);
    });
  }

  it("404 when donorB edits donorA's donation (unchanged)", async () => {
    const before = await snapshot(donation._id);
    const theirs = await patch(donorB, { totalServings: 2 });
    const missing = await patch(donorB, { totalServings: 2 }, new mongoose.Types.ObjectId());
    assert.equal(theirs.status, 404);
    assert.equal(missing.status, 404);
    assert.equal(theirs.body.message, missing.body.message);
    assert.deepEqual(await snapshot(donation._id), before);
  });

  it('400 for a malformed id', async () => {
    assert.equal((await patch(donorA, { totalServings: 2 }, 'abc')).status, 400);
  });

  it('403 without the CSRF header', async () => {
    const { Authorization } = authHeaders(donorA);
    const res = await request(app).patch(url(donation._id)).set('Authorization', Authorization).send({ totalServings: 2 });
    assert.equal(res.status, 403);
  });

  it('415 for a non-JSON body', async () => {
    const res = await request(app)
      .patch(url(donation._id))
      .set(authHeaders(donorA))
      .set('Content-Type', 'text/plain')
      .send('totalServings=2');
    assert.equal(res.status, 415);
  });

  // ---- body validation ----

  it('400 for an empty body', async () => {
    await expect400Unchanged({});
  });

  const forbidden = {
    status: S.DISTRIBUTED,
    safetyChecklist: { preparedHygienically: true, storedAtSafeTemperature: true, packedAndCovered: true, notSpoiled: true },
    photos: [{ url: 'https://evil/x.jpg', publicId: 'x' }],
    donor: null, // donorB's id
    claimedBy: '64b7f0c2a1b2c3d4e5f60718',
    pickupOtpHash: 'x',
    otpAttempts: 0,
    otpGeneratedAt: new Date().toISOString(),
    _id: '64b7f0c2a1b2c3d4e5f60718',
    createdAt: new Date().toISOString(),
    cancelledAt: new Date().toISOString(),
  };
  for (const key of Object.keys(forbidden)) {
    it(`400 and nothing changed when sending "${key}" (even with a valid field)`, async () => {
      const value = key === 'donor' ? String(donorB._id) : forbidden[key];
      const res = await expect400Unchanged({ totalServings: 5, [key]: value });
      assert.ok(res.body.errors.some((e) => e.message.includes(`"${key}"`)));
    });
  }

  const badBodies = [
    ['pickupWindow with only start', { pickupWindow: { start: iso(60) } }],
    ['address without pincode', { address: { line1: '5 Ashram Road', city: 'Ahmedabad', state: 'Gujarat' } }],
    ['location with only lat', { location: { lat: 23 } }],
    ['items: []', { items: [] }],
    ['totalServings 0', { totalServings: 0 }],
    ['bad unit', { items: [{ name: 'Dal', quantity: 1, unit: 'TONS' }] }],
    ['time without timezone', { bestBefore: '2030-01-01T10:00:00' }],
    ['operator as a value', { category: { $ne: 'COOKED' } }],
  ];
  for (const [label, body] of badBodies) {
    it(`400 for ${label}`, async () => {
      await expect400Unchanged(body);
    });
  }

  // ---- merged time rules ----

  it('400: only pickupWindow sent, ending after the STORED bestBefore', async () => {
    // stored bestBefore is now + 6h (factory)
    const res = await expect400Unchanged({ pickupWindow: { start: iso(60), end: iso(7 * 60) } });
    assert.ok(res.body.errors.some((e) => e.field === 'pickupWindow.end'));
  });

  it('400: only bestBefore moved earlier than the STORED pickupWindow.end', async () => {
    // stored pickupWindow.end is now + 4h (factory)
    const res = await expect400Unchanged({ bestBefore: iso(3 * 60) });
    assert.ok(res.body.errors.some((e) => e.field === 'pickupWindow.end'));
  });

  it('400: only preparedAt moved so shelf life exceeds 48h', async () => {
    const res = await expect400Unchanged({ preparedAt: iso(-44 * 60) });
    assert.ok(res.body.errors.some((e) => e.field === 'bestBefore'));
  });

  // ---- state ----

  for (const status of [S.CLAIMED, S.PICKED_UP, S.CANCELLED, S.EXPIRED, S.DISTRIBUTED]) {
    it(`409 when the donation is ${status}`, async () => {
      await Donation.updateOne({ _id: donation._id }, { status });
      const before = await snapshot(donation._id);
      const res = await patch(donorA, { totalServings: 2 });
      assert.equal(res.status, 409);
      assert.deepEqual(await snapshot(donation._id), before);
    });
  }

  it('409 "Donation has expired" when best-before passed while still AVAILABLE', async () => {
    const past = new Date(Date.now() - MIN);
    await Donation.collection.updateOne(
      { _id: donation._id },
      { $set: { bestBefore: past, pickupWindow: { start: new Date(Date.now() - 3 * 60 * MIN), end: new Date(Date.now() - 2 * MIN) } } }
    );
    const res = await patch(donorA, { totalServings: 2 });
    assert.equal(res.status, 409);
    assert.equal(res.body.message, 'Donation has expired');
  });

  // ---- concurrency (change lands between the service's read and write) ----

  describe('concurrency', () => {
    const original = Donation.findOneAndUpdate;

    /** Run `sneak` right before the edit's atomic write, once. */
    const interceptNextWrite = (sneak) => {
      Donation.findOneAndUpdate = async function (...args) {
        Donation.findOneAndUpdate = original;
        await sneak();
        return original.apply(this, args);
      };
    };

    it('409 when an NGO claims between read and write; donation stays CLAIMED, unchanged', async () => {
      interceptNextWrite(() =>
        Donation.collection.updateOne(
          { _id: donation._id },
          { $set: { status: S.CLAIMED, claimedBy: ngo._id, updatedAt: new Date() } }
        )
      );
      const res = await patch(donorA, { totalServings: 2, notes: 'changed' });
      Donation.findOneAndUpdate = original;

      assert.equal(res.status, 409);
      assert.equal(res.body.message, 'Donation changed, reload and retry');
      const saved = await Donation.findById(donation._id).lean();
      assert.equal(saved.status, S.CLAIMED);
      assert.equal(saved.totalServings, donation.totalServings);
      assert.equal(saved.notes, 'Bring boxes');
    });

    it('409 when another edit lands between read and write (optimistic lock)', async () => {
      interceptNextWrite(() =>
        Donation.collection.updateOne(
          { _id: donation._id },
          { $set: { totalServings: 99, updatedAt: new Date(Date.now() + 1000) } }
        )
      );
      const res = await patch(donorA, { totalServings: 2 });
      Donation.findOneAndUpdate = original;

      assert.equal(res.status, 409);
      assert.equal((await Donation.findById(donation._id).lean()).totalServings, 99);
    });
  });
});

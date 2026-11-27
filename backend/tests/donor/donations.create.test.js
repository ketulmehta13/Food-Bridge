import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startDb, stopDb } from '../helpers/db.js';
import { createUser, donationBody } from '../helpers/factories.js';
import { authHeaders } from '../helpers/auth.js';
import app from '../../src/app.js';
import { Donation } from '../../src/models/Donation.js';
import { validateDonationTimeline } from '../../src/services/donor.service.js';
import {
  createDonationLimiter,
  DONOR_RATE_LIMITS,
} from '../../src/middlewares/donorLimits.middleware.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { ROLES, USER_TYPES, VERIFICATION_STATUS, DONATION_STATUS } from '../../src/constants/index.js';

const URL = '/api/donor/donations';
const MIN = 60 * 1000;

describe('POST /api/donor/donations', () => {
  let donorA, donorB, pending, inactive, ngo, admin;

  const post = (user, body = donationBody()) =>
    request(app).post(URL).set(authHeaders(user)).send(body);

  /** Expect a 400 that mentions `field`, and that nothing was saved. */
  const expect400 = async (body, field, user = donorA) => {
    const res = await post(user, body);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    if (field) {
      const fields = res.body.errors.map((e) => e.field);
      assert.ok(
        fields.some((f) => f === field || f.startsWith(`${field}.`)),
        `expected an error on "${field}", got [${fields.join(', ')}]`
      );
    }
    assert.equal(await Donation.countDocuments(), 0);
    return res;
  };

  before(async () => {
    await startDb();
    [donorA, donorB, pending, inactive, ngo, admin] = await Promise.all([
      createUser(USER_TYPES.DONOR, { phone: '9000000001' }),
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
    for (const u of [donorA, donorB]) await createDonationLimiter.resetKey(`user:${u._id}`);
  });

  // ---- success ----

  it('201: creates an AVAILABLE donation owned by the caller', async () => {
    const body = donationBody();
    const res = await post(donorA, body);
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const d = res.body.data;
    assert.equal(d.donor, String(donorA._id));
    assert.equal(d.status, DONATION_STATUS.AVAILABLE);
    assert.deepEqual(d.location, { type: 'Point', coordinates: [72.5714, 23.0225] });
    assert.equal(d.items.length, 2);
    assert.equal(d.notes, body.notes);
    assert.equal(new Date(d.bestBefore).toISOString(), body.bestBefore);

    const saved = await Donation.findById(d._id).select('+pickupOtpHash').lean();
    assert.equal(String(saved.donor), String(donorA._id));
    assert.deepEqual(saved.location.coordinates, [72.5714, 23.0225]);
    assert.equal(saved.pickupOtpHash, undefined);
    assert.equal(saved.otpAttempts, 0);
  });

  it('response never contains OTP fields', async () => {
    const res = await post(donorA);
    assert.equal(res.status, 201);
    assert.ok(!res.text.includes('pickupOtpHash'));
    assert.ok(!res.text.includes('otpAttempts'));
  });

  it('contactPhone defaults to the donor phone and can be overridden', async () => {
    const a = await post(donorA);
    assert.equal(a.body.data.contactPhone, '9000000001');
    const b = await post(donorA, donationBody({ contactPhone: '+919812345678' }));
    assert.equal(b.body.data.contactPhone, '+919812345678');
  });

  it('accepts a timezone offset such as +05:30', async () => {
    const t = (min) => new Date(Date.now() + min * MIN);
    const ist = (d) => {
      const local = new Date(d.getTime() + 330 * MIN).toISOString().slice(0, 19);
      return `${local}+05:30`;
    };
    const res = await post(
      donorA,
      donationBody({
        preparedAt: ist(t(-30)),
        bestBefore: ist(t(300)),
        pickupWindow: { start: ist(t(60)), end: ist(t(180)) },
      })
    );
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('empty notes/allergenInfo are stored as not given', async () => {
    const res = await post(donorA, donationBody({ notes: '   ', allergenInfo: '' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.notes, undefined);
    assert.equal(res.body.data.allergenInfo, undefined);
  });

  // ---- auth / account matrix ----

  it('401 without a token', async () => {
    const res = await request(app)
      .post(URL)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send(donationBody());
    assert.equal(res.status, 401);
  });

  it('403 with an NGO token', async () => {
    assert.equal((await post(ngo)).status, 403);
  });

  it('403 with an admin token', async () => {
    assert.equal((await post(admin)).status, 403);
  });

  it('403 for an unverified (pending) donor, nothing saved', async () => {
    const res = await post(pending);
    assert.equal(res.status, 403);
    assert.equal(await Donation.countDocuments(), 0);
  });

  it('403 for an inactive donor', async () => {
    assert.equal((await post(inactive)).status, 403);
  });

  it('403 without the CSRF header', async () => {
    const { Authorization } = authHeaders(donorA);
    const res = await request(app).post(URL).set('Authorization', Authorization).send(donationBody());
    assert.equal(res.status, 403);
    assert.equal(await Donation.countDocuments(), 0);
  });

  it('415 for a non-JSON body', async () => {
    const res = await request(app)
      .post(URL)
      .set(authHeaders(donorA))
      .set('Content-Type', 'text/plain')
      .send('items=1');
    assert.equal(res.status, 415);
  });

  it('400 for malformed JSON', async () => {
    const res = await request(app)
      .post(URL)
      .set(authHeaders(donorA))
      .set('Content-Type', 'application/json')
      .send('{"items": [');
    assert.equal(res.status, 400);
  });

  it('400 for an empty body', async () => {
    await expect400({}, 'items');
  });

  // ---- body validation ----

  const badBodies = [
    ['a safety check set to false', () => donationBody({
      safetyChecklist: { ...donationBody().safetyChecklist, notSpoiled: false },
    }), 'safetyChecklist.notSpoiled'],
    ['a missing safety check', () => donationBody({
      safetyChecklist: { preparedHygienically: true, storedAtSafeTemperature: true, packedAndCovered: true },
    }), 'safetyChecklist.notSpoiled'],
    ['safety check as the string "true"', () => donationBody({
      safetyChecklist: { ...donationBody().safetyChecklist, notSpoiled: 'true' },
    }), 'safetyChecklist.notSpoiled'],
    ['lat 200', () => donationBody({ location: { lat: 200, lng: 72.5 } }), 'location.lat'],
    ['lng -181', () => donationBody({ location: { lat: 23, lng: -181 } }), 'location.lng'],
    ['21 items', () => donationBody({
      items: Array.from({ length: 21 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, unit: 'KG' })),
    }), 'items'],
    ['no items', () => donationBody({ items: [] }), 'items'],
    ['item name of 1 char', () => donationBody({ items: [{ name: 'A', quantity: 1, unit: 'KG' }] }), 'items.0.name'],
    ['item quantity 0', () => donationBody({ items: [{ name: 'Rice', quantity: 0, unit: 'KG' }] }), 'items.0.quantity'],
    ['unknown unit', () => donationBody({ items: [{ name: 'Rice', quantity: 1, unit: 'TONS' }] }), 'items.0.unit'],
    ['unknown key inside an item', () => donationBody({
      items: [{ name: 'Rice', quantity: 1, unit: 'KG', price: 10 }],
    }), 'items.0'],
    ['pincode "12345"', () => donationBody({
      address: { ...donationBody().address, pincode: '12345' },
    }), 'address.pincode'],
    ['address line1 too short', () => donationBody({
      address: { ...donationBody().address, line1: 'abc' },
    }), 'address.line1'],
    ['unknown key inside address', () => donationBody({
      address: { ...donationBody().address, landmark: 'x' },
    }), 'address'],
    ['totalServings 5001', () => donationBody({ totalServings: 5001 }), 'totalServings'],
    ['totalServings 2.5', () => donationBody({ totalServings: 2.5 }), 'totalServings'],
    ['estimatedWeightKg 0', () => donationBody({ estimatedWeightKg: 0 }), 'estimatedWeightKg'],
    ['estimatedWeightKg 2001', () => donationBody({ estimatedWeightKg: 2001 }), 'estimatedWeightKg'],
    ['numbers sent as strings', () => donationBody({ totalServings: '30' }), 'totalServings'],
    ['bad foodType', () => donationBody({ foodType: 'MEAT' }), 'foodType'],
    ['bad category', () => donationBody({ category: 'JUNK' }), 'category'],
    ['time without a timezone', () => donationBody({ bestBefore: '2030-01-01T10:00:00' }), 'bestBefore'],
    ['date only', () => donationBody({ preparedAt: '2026-11-27' }), 'preparedAt'],
    ['bad contactPhone', () => donationBody({ contactPhone: 'call me' }), 'contactPhone'],
    ['notes over 500 chars', () => donationBody({ notes: 'x'.repeat(501) }), 'notes'],
    ['allergenInfo over 300 chars', () => donationBody({ allergenInfo: 'x'.repeat(301) }), 'allergenInfo'],
    ['NoSQL operator as a value', () => donationBody({ foodType: { $ne: 'VEG' } }), 'foodType'],
  ];

  for (const [label, makeBody, field] of badBodies) {
    it(`400 for ${label}`, async () => {
      await expect400(makeBody(), field);
    });
  }

  it('safety error uses the agreed message', async () => {
    const res = await expect400(
      donationBody({ safetyChecklist: { ...donationBody().safetyChecklist, notSpoiled: false } }),
      'safetyChecklist.notSpoiled'
    );
    assert.ok(res.body.errors.some((e) => e.message === 'All safety checks must be confirmed'));
  });

  // ---- forbidden fields (mass assignment) ----

  const forbidden = {
    status: DONATION_STATUS.DISTRIBUTED,
    donor: null, // replaced with donorB's id below
    claimedBy: '64b7f0c2a1b2c3d4e5f60718',
    claimedAt: new Date().toISOString(),
    photos: [{ url: 'https://evil.example/x.jpg', publicId: 'x' }],
    pickupOtpHash: 'abc',
    otpAttempts: 0,
    _id: '64b7f0c2a1b2c3d4e5f60718',
    createdAt: new Date().toISOString(),
    distributedAt: new Date().toISOString(),
  };

  for (const key of Object.keys(forbidden)) {
    it(`400 and nothing saved when sending "${key}"`, async () => {
      const value = key === 'donor' ? String(donorB._id) : forbidden[key];
      const res = await expect400(donationBody({ [key]: value }));
      assert.ok(
        res.body.errors.some((e) => e.message.includes(`"${key}"`)),
        `expected an unrecognized-key error for "${key}": ${JSON.stringify(res.body.errors)}`
      );
    });
  }

  // ---- time rules (server clock) ----

  const t = (min) => new Date(Date.now() + min * MIN).toISOString();
  const timeline = [
    ['preparedAt in the future', { preparedAt: t(10) }, 'preparedAt'],
    ['bestBefore within 30 minutes', {
      bestBefore: t(20), pickupWindow: { start: t(5), end: t(15) },
    }, 'bestBefore'],
    ['bestBefore more than 48h after preparedAt', {
      preparedAt: t(-60), bestBefore: t(48 * 60), pickupWindow: { start: t(60), end: t(120) },
    }, 'bestBefore'],
    ['pickup start after end', { pickupWindow: { start: t(150), end: t(90) } }, 'pickupWindow.start'],
    ['pickup end after bestBefore', { pickupWindow: { start: t(60), end: t(6 * 60) } }, 'pickupWindow.end'],
    ['pickup end in the past', {
      preparedAt: t(-180), pickupWindow: { start: t(-120), end: t(-60) },
    }, 'pickupWindow.end'],
  ];

  for (const [label, overrides, field] of timeline) {
    it(`400 when ${label}`, async () => {
      await expect400(donationBody(overrides), field);
    });
  }

  // ---- rate limit ----

  it(`429 after ${DONOR_RATE_LIMITS.CREATE_DONATION.limit} posts, counted per donor`, async () => {
    const { limit } = DONOR_RATE_LIMITS.CREATE_DONATION;
    for (let i = 0; i < limit; i += 1) {
      const res = await post(donorB);
      assert.equal(res.status, 201, `post #${i + 1}: ${JSON.stringify(res.body)}`);
    }
    const blocked = await post(donorB);
    assert.equal(blocked.status, 429);
    assert.equal(await Donation.countDocuments({ donor: donorB._id }), limit);

    // A different donor is not affected.
    assert.equal((await post(donorA)).status, 201);
  });
});

describe('validateDonationTimeline (fixed now)', () => {
  const now = new Date('2026-11-27T12:00:00.000Z');
  const at = (min) => new Date(now.getTime() + min * MIN);
  const valid = () => ({
    preparedAt: at(-30),
    bestBefore: at(300),
    pickupWindow: { start: at(60), end: at(180) },
  });

  /** Run the check and return the list of failing fields. */
  const failures = (overrides) => {
    try {
      validateDonationTimeline({ ...valid(), ...overrides }, now);
      return [];
    } catch (err) {
      assert.ok(err instanceof ApiError);
      assert.equal(err.statusCode, 400);
      for (const e of err.errors) assert.equal(e.location, 'body');
      return err.errors.map((e) => e.field);
    }
  };

  it('accepts a valid timeline', () => {
    assert.deepEqual(failures({}), []);
  });

  it('allows up to 2 minutes of clock skew on preparedAt', () => {
    assert.deepEqual(failures({ preparedAt: at(2) }), []);
    assert.deepEqual(failures({ preparedAt: new Date(at(2).getTime() + 1) }), ['preparedAt']);
  });

  it('bestBefore must be MORE than 30 minutes from now', () => {
    const p = { pickupWindow: { start: at(5), end: at(20) } };
    assert.deepEqual(failures({ ...p, bestBefore: at(30) }), ['bestBefore']);
    assert.deepEqual(failures({ ...p, bestBefore: new Date(at(30).getTime() + 1) }), []);
  });

  it('bestBefore must be within 48 hours of preparedAt', () => {
    assert.deepEqual(failures({ preparedAt: at(-60), bestBefore: at(47 * 60) }), []);
    assert.deepEqual(failures({ preparedAt: at(-60), bestBefore: new Date(at(47 * 60).getTime() + 1) }), [
      'bestBefore',
    ]);
  });

  it('bestBefore must be after preparedAt', () => {
    assert.ok(failures({ preparedAt: at(0), bestBefore: at(0) }).includes('bestBefore'));
  });

  it('pickup start must be before end', () => {
    assert.deepEqual(failures({ pickupWindow: { start: at(120), end: at(120) } }), ['pickupWindow.start']);
  });

  it('pickup must end by bestBefore (equal is allowed)', () => {
    assert.deepEqual(failures({ pickupWindow: { start: at(60), end: at(300) } }), []);
    assert.deepEqual(failures({ pickupWindow: { start: at(60), end: at(301) } }), ['pickupWindow.end']);
  });

  it('pickup end must be in the future', () => {
    assert.deepEqual(failures({ pickupWindow: { start: at(-20), end: at(0) } }), ['pickupWindow.end']);
  });

  it('reports several broken rules at once', () => {
    const fields = failures({
      preparedAt: at(60),
      bestBefore: at(10),
      pickupWindow: { start: at(20), end: at(15) },
    });
    for (const f of ['preparedAt', 'bestBefore', 'pickupWindow.start', 'pickupWindow.end']) {
      assert.ok(fields.includes(f), `missing ${f} in [${fields}]`);
    }
  });
});

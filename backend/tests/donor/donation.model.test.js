import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, clearDb, stopDb } from '../helpers/db.js';
import { createUser, createDonation, donationData } from '../helpers/factories.js';
import { Donation } from '../../src/models/Donation.js';
import { DONATION_STATUS, USER_TYPES } from '../../src/constants/index.js';

const HOUR = 60 * 60 * 1000;
const donorId = new mongoose.Types.ObjectId();

/** Validate in memory and return the failing paths (empty array if valid). */
const errorPaths = async (overrides) => {
  try {
    await new Donation(donationData(donorId, overrides)).validate();
    return [];
  } catch (err) {
    return Object.keys(err.errors ?? {});
  }
};

describe('Donation model validation', () => {
  it('accepts valid data and defaults to AVAILABLE', async () => {
    assert.deepEqual(await errorPaths({}), []);
    const d = new Donation(donationData(donorId));
    assert.equal(d.status, DONATION_STATUS.AVAILABLE);
    assert.equal(d.otpAttempts, 0);
    assert.deepEqual(d.photos.toObject(), []);
  });

  const now = Date.now();
  const badCases = [
    ['missing donor', { donor: undefined }, 'donor'],
    ['no items', { items: [] }, 'items'],
    [
      '21 items',
      { items: Array.from({ length: 21 }, (_, i) => ({ name: `i${i}`, quantity: 1, unit: 'kg' })) },
      'items',
    ],
    ['item without name', { items: [{ quantity: 1, unit: 'kg' }] }, 'items.0.name'],
    ['item name too long', { items: [{ name: 'x'.repeat(101), quantity: 1, unit: 'kg' }] }, 'items.0.name'],
    ['zero quantity', { items: [{ name: 'Rice', quantity: 0, unit: 'kg' }] }, 'items.0.quantity'],
    ['0 servings', { totalServings: 0 }, 'totalServings'],
    ['fractional servings', { totalServings: 2.5 }, 'totalServings'],
    ['0 kg', { estimatedWeightKg: 0 }, 'estimatedWeightKg'],
    ['weight too high', { estimatedWeightKg: 5000 }, 'estimatedWeightKg'],
    ['bad foodType', { foodType: 'MEAT' }, 'foodType'],
    ['bad category', { category: 'JUNK' }, 'category'],
    ['bad status', { status: 'STOLEN' }, 'status'],
    ['missing location', { location: undefined }, 'location'],
    ['bad coordinates', { location: { type: 'Point', coordinates: [200, 100] } }, 'location.coordinates'],
    ['bad pincode', { address: { pincode: '12ab' } }, 'address.pincode'],
    ['bad phone', { contactPhone: 'call me' }, 'contactPhone'],
    ['notes too long', { notes: 'x'.repeat(501) }, 'notes'],
    [
      '4 photos',
      { photos: Array.from({ length: 4 }, (_, i) => ({ url: `https://x/${i}`, publicId: `p${i}` })) },
      'photos',
    ],
    [
      'unchecked safety item',
      {
        safetyChecklist: {
          preparedHygienically: true,
          storedAtSafeTemperature: false,
          packedAndCovered: true,
          notSpoiled: true,
        },
      },
      'safetyChecklist.storedAtSafeTemperature',
    ],
    [
      'pickup start not before end',
      { pickupWindow: { start: new Date(now + 2 * HOUR), end: new Date(now + 2 * HOUR) } },
      'pickupWindow.start',
    ],
    [
      'pickup ends after bestBefore',
      { pickupWindow: { start: new Date(now + HOUR), end: new Date(now + 7 * HOUR) } },
      'pickupWindow.end',
    ],
    [
      'shelf life over 48 hours',
      {
        preparedAt: new Date(now - HOUR),
        bestBefore: new Date(now + 48 * HOUR),
        pickupWindow: { start: new Date(now + HOUR), end: new Date(now + 2 * HOUR) },
      },
      'bestBefore',
    ],
    ['bestBefore before preparedAt', { preparedAt: new Date(now + 7 * HOUR) }, 'bestBefore'],
  ];

  for (const [label, overrides, path] of badCases) {
    it(`rejects ${label}`, async () => {
      const paths = await errorPaths(overrides);
      assert.ok(paths.includes(path), `expected error on "${path}", got [${paths.join(', ')}]`);
    });
  }
});

describe('Donation model persistence', () => {
  let donor;
  before(startDb);
  after(stopDb);
  beforeEach(async () => {
    await clearDb();
    donor = await createUser(USER_TYPES.DONOR);
  });

  it('toJSON hides pickupOtpHash, otpAttempts and __v', async () => {
    const d = await createDonation(donor, { pickupOtpHash: 'abc123', otpAttempts: 2 });
    const json = d.toJSON();
    assert.equal(json.pickupOtpHash, undefined);
    assert.equal(json.otpAttempts, undefined);
    assert.equal(json.__v, undefined);
    assert.equal(JSON.stringify(d).includes('abc123'), false);
  });

  it('pickupOtpHash is not loaded unless explicitly selected', async () => {
    const d = await createDonation(donor, { pickupOtpHash: 'abc123' });
    assert.equal((await Donation.findById(d._id)).pickupOtpHash, undefined);
    assert.equal((await Donation.findById(d._id).lean()).pickupOtpHash, undefined);
    assert.equal((await Donation.findById(d._id).select('+pickupOtpHash')).pickupOtpHash, 'abc123');
  });

  it('has the required indexes', async () => {
    const keys = (await Donation.collection.indexes()).map((i) => JSON.stringify(i.key));
    for (const expected of [
      { location: '2dsphere', status: 1 },
      { status: 1, bestBefore: 1 },
      { donor: 1, createdAt: -1 },
      { claimedBy: 1, status: 1 },
    ]) {
      assert.ok(keys.includes(JSON.stringify(expected)), `missing index ${JSON.stringify(expected)}`);
    }
  });
});

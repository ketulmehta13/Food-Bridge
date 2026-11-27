import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, clearDb, stopDb } from '../helpers/db.js';
import { createUser, createDonation } from '../helpers/factories.js';
import { paginate } from '../../src/utils/queryBuilder.js';
import {
  objectId,
  idParam,
  paginationQuery,
  latitude,
  longitude,
  trimmedString,
} from '../../src/validators/common.validators.js';
import { Donation } from '../../src/models/Donation.js';
import { ApiError } from '../../src/utils/ApiError.js';
import { DONATION_LIMITS, USER_TYPES } from '../../src/constants/index.js';

describe('common validators', () => {
  it('objectId / idParam', () => {
    assert.ok(objectId.safeParse('64b7f0c2a1b2c3d4e5f60718').success);
    assert.equal(objectId.safeParse('123').success, false);
    assert.equal(objectId.safeParse({ $gt: '' }).success, false);
    assert.equal(idParam.safeParse({ id: '64b7f0c2a1b2c3d4e5f60718', x: 1 }).success, false);
  });

  it('paginationQuery coerces, defaults, caps and is strict', () => {
    assert.deepEqual(paginationQuery.parse({}), { page: 1, limit: DONATION_LIMITS.PAGE_SIZE_DEFAULT });
    assert.deepEqual(paginationQuery.parse({ page: '2', limit: '5' }), { page: 2, limit: 5 });
    assert.equal(paginationQuery.safeParse({ limit: '51' }).success, false);
    assert.equal(paginationQuery.safeParse({ page: '0' }).success, false);
    assert.equal(paginationQuery.safeParse({ page: ['1', '2'] }).success, false);
    assert.equal(paginationQuery.safeParse({ status: 'X' }).success, false);
    assert.equal(paginationQuery.extend({ q: trimmedString(10) }).safeParse({ x: 1 }).success, false);
  });

  it('latitude / longitude ranges', () => {
    assert.equal(latitude.parse('23.02'), 23.02);
    assert.equal(latitude.safeParse('91').success, false);
    assert.equal(longitude.safeParse('-181').success, false);
    assert.equal(longitude.safeParse('abc').success, false);
  });

  it('trimmedString trims and limits', () => {
    const s = trimmedString(5);
    assert.equal(s.parse('  abc  '), 'abc');
    assert.equal(s.safeParse('   ').success, false);
    assert.equal(s.safeParse('abcdef').success, false);
    assert.equal(trimmedString(5, { min: 0 }).parse(''), '');
  });
});

describe('paginate', () => {
  let donor;
  before(startDb);
  after(stopDb);
  beforeEach(async () => {
    await clearDb();
    donor = await createUser(USER_TYPES.DONOR);
    for (let i = 0; i < 12; i += 1) await createDonation(donor, { totalServings: i + 1 });
  });

  it('returns items and pagination info', async () => {
    const res = await paginate(Donation, { donor: donor._id }, { page: 2, limit: 5 });
    assert.equal(res.items.length, 5);
    assert.deepEqual(res.pagination, { page: 2, limit: 5, total: 12, totalPages: 3 });
  });

  it('caps the limit at PAGE_SIZE_MAX and fixes bad page values', async () => {
    const res = await paginate(Donation, {}, { page: -3, limit: 1000 });
    assert.equal(res.pagination.limit, DONATION_LIMITS.PAGE_SIZE_MAX);
    assert.equal(res.pagination.page, 1);
  });

  it('sorts by an allowed field', async () => {
    const res = await paginate(Donation, {}, {
      sort: '-totalServings',
      allowedSort: ['totalServings'],
      limit: 3,
    });
    assert.deepEqual(res.items.map((d) => d.totalServings), [12, 11, 10]);
  });

  it('rejects a sort field that is not allowed (400)', async () => {
    await assert.rejects(
      paginate(Donation, {}, { sort: 'pickupOtpHash', allowedSort: ['createdAt'] }),
      (err) => err instanceof ApiError && err.statusCode === 400
    );
  });

  it('applies select', async () => {
    const res = await paginate(Donation, {}, { select: 'status', limit: 1 });
    assert.deepEqual(Object.keys(res.items[0]).sort(), ['_id', 'status']);
  });
});

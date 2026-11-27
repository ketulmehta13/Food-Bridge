import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startDb, stopDb } from '../helpers/db.js';
import { createUser, createDonation } from '../helpers/factories.js';
import { authHeaders } from '../helpers/auth.js';
import app from '../../src/app.js';
import { Donation } from '../../src/models/Donation.js';
import { ROLES, USER_TYPES, VERIFICATION_STATUS, DONATION_STATUS } from '../../src/constants/index.js';

const URL = '/api/donor/donations';
const HOUR = 60 * 60 * 1000;

describe('GET /api/donor/donations', () => {
  let donorA, donorB, pending, inactive, ngo, admin;

  const list = (user, query = '') => request(app).get(`${URL}${query}`).set(authHeaders(user));

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
    const now = Date.now();
    // donorA: 3 donations with different best-before times, created in order.
    for (const [i, hours] of [6, 2, 4].entries()) {
      await createDonation(donorA, {
        totalServings: i + 1,
        bestBefore: new Date(now + hours * HOUR),
        pickupWindow: { start: new Date(now + 0.5 * HOUR), end: new Date(now + 1.5 * HOUR) },
        notes: 'secret note',
        allergenInfo: 'nuts',
        pickupOtpHash: 'deadbeef',
        photos: [
          { url: 'https://img/1.jpg', publicId: 'p1' },
          { url: 'https://img/2.jpg', publicId: 'p2' },
        ],
      });
    }
    await createDonation(donorB, { totalServings: 99 });
    await createDonation(donorB, { totalServings: 98 });
  });

  // ---- success ----

  it('200: returns only my donations, newest first, with pagination', async () => {
    const res = await list(donorA);
    assert.equal(res.status, 200);
    const { items, pagination } = res.body.data;
    assert.equal(items.length, 3);
    assert.deepEqual(pagination, { page: 1, limit: 10, total: 3, totalPages: 1 });
    assert.deepEqual(items.map((d) => d.totalServings), [3, 2, 1]); // -createdAt
    for (const d of items) assert.notEqual(d.totalServings, 99);
  });

  it("donorB's donations never appear for donorA (and vice versa)", async () => {
    const a = await list(donorA);
    const b = await list(donorB);
    const aIds = new Set(a.body.data.items.map((d) => d._id));
    assert.equal(b.body.data.items.length, 2);
    for (const d of b.body.data.items) assert.ok(!aIds.has(d._id));
  });

  it('returns summary fields only, with the first photo as coverPhoto', async () => {
    const res = await list(donorA);
    const item = res.body.data.items[0];
    assert.deepEqual(item.coverPhoto, { url: 'https://img/1.jpg', publicId: 'p1' });
    for (const hidden of ['photos', 'notes', 'allergenInfo', 'contactPhone', 'safetyChecklist', 'pickupOtpHash', 'otpAttempts', 'donor']) {
      assert.ok(!(hidden in item), `"${hidden}" should not be in list items`);
    }
    assert.equal(item.address.city, 'Ahmedabad');
    assert.equal(item.address.line1, undefined);
    assert.ok(!res.text.includes('deadbeef'));
    assert.ok(!res.text.includes('otpAttempts'));
  });

  it('filters by status', async () => {
    const mine = await Donation.findOne({ donor: donorA._id });
    await Donation.updateOne({ _id: mine._id }, { status: DONATION_STATUS.CLAIMED });

    const res = await list(donorA, '?status=CLAIMED');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.items.map((d) => d._id), [String(mine._id)]);
    assert.equal((await list(donorA, '?status=EXPIRED')).body.data.items.length, 0);
  });

  it('sorts by bestBefore ascending and descending', async () => {
    const asc = await list(donorA, '?sort=bestBefore');
    assert.deepEqual(asc.body.data.items.map((d) => d.totalServings), [2, 3, 1]);
    const desc = await list(donorA, '?sort=-bestBefore');
    assert.deepEqual(desc.body.data.items.map((d) => d.totalServings), [1, 3, 2]);
  });

  it('paginates', async () => {
    const res = await list(donorA, '?limit=2&page=2');
    assert.equal(res.body.data.items.length, 1);
    assert.deepEqual(res.body.data.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('pending donor can list (empty) without being verified', async () => {
    const res = await list(pending);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.items, []);
  });

  it('GET does not need the CSRF header', async () => {
    const { Authorization } = authHeaders(donorA);
    const res = await request(app).get(URL).set('Authorization', Authorization);
    assert.equal(res.status, 200);
  });

  // ---- auth / account matrix ----

  it('401 without a token', async () => {
    assert.equal((await request(app).get(URL)).status, 401);
  });

  it('403 with an NGO token', async () => {
    assert.equal((await list(ngo)).status, 403);
  });

  it('403 with an admin token', async () => {
    assert.equal((await list(admin)).status, 403);
  });

  it('403 for an inactive donor', async () => {
    assert.equal((await list(inactive)).status, 403);
  });

  // ---- query validation ----

  const badQueries = [
    ['limit=51', '?limit=51'],
    ['limit=0', '?limit=0'],
    ['page=0', '?page=0'],
    ['page=abc', '?page=abc'],
    ['unknown sort', '?sort=pickupOtpHash'],
    ['sort by a non-whitelisted field', '?sort=-totalServings'],
    ['unknown status', '?status=FOO'],
    ['status[$ne] operator', '?status[$ne]=X'],
    ['donor override attempt', `?donor=${'a'.repeat(24)}`],
    ['status given twice', '?status=AVAILABLE&status=CLAIMED'],
    ['unknown key', '?foo=1'],
  ];

  for (const [label, query] of badQueries) {
    it(`400 for ${label}`, async () => {
      const res = await list(donorA, query);
      assert.equal(res.status, 400, JSON.stringify(res.body));
    });
  }
});

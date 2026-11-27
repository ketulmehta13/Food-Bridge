import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startDb, clearDb, stopDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { authHeaders } from '../helpers/auth.js';
import app from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { ROLES, USER_TYPES, VERIFICATION_STATUS } from '../../src/constants/index.js';

const URL = '/api/ngo/profile';

// PATCH helper: authenticated + CSRF header, JSON body.
const patch = (user, body) => request(app).patch(URL).set(authHeaders(user)).send(body);

describe('NGO profile - access', () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it('no token -> 401', async () => {
    assert.equal((await request(app).get(URL)).status, 401);
  });

  it('donor -> 403', async () => {
    const donor = await createUser(USER_TYPES.DONOR);
    assert.equal((await request(app).get(URL).set(authHeaders(donor))).status, 403);
  });

  it('admin -> 403', async () => {
    const admin = await createUser(ROLES.ADMIN);
    assert.equal((await request(app).get(URL).set(authHeaders(admin))).status, 403);
  });

  it('deactivated NGO -> 403', async () => {
    const ngo = await createUser(USER_TYPES.NGO, { isActive: false });
    assert.equal((await request(app).get(URL).set(authHeaders(ngo))).status, 403);
  });

  it('PATCH without the CSRF header -> 403', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const { Authorization } = authHeaders(ngo);
    const res = await request(app).patch(URL).set({ Authorization }).send({ name: 'New Name' });
    assert.equal(res.status, 403);
  });

  it('PATCH with a non-JSON body -> 415', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await request(app)
      .patch(URL)
      .set(authHeaders(ngo))
      .set('Content-Type', 'text/plain')
      .send('name=hack');
    assert.equal(res.status, 415);
  });
});

describe('NGO profile - GET', () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it('returns the NGO profile without secrets', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await request(app).get(URL).set(authHeaders(ngo));

    assert.equal(res.status, 200);
    const { user } = res.body.data;
    assert.equal(user.email, ngo.email);
    assert.equal(user.ngoProfile.orgName, ngo.ngoProfile.orgName);
    assert.ok(!('password' in user));
    assert.ok(!('refreshTokenHash' in user));
  });
});

describe('NGO profile - PATCH', () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it('updates only the fields that were sent', async () => {
    const ngo = await createUser(USER_TYPES.NGO, {
      phone: '9999999999',
      address: { line1: 'Old Street', city: 'Ahmedabad' },
      ngoProfile: { orgName: 'Asha', registrationNumber: 'REG-1', contactPerson: 'Old Contact' },
    });

    const res = await patch(ngo, {
      address: { city: 'Surat' },
      ngoProfile: { contactPerson: 'New Contact', serviceRadiusKm: 25, capacityMealsPerDay: 200 },
    });
    assert.equal(res.status, 200);

    const saved = await User.findById(ngo._id).lean();
    assert.equal(saved.address.city, 'Surat');
    assert.equal(saved.address.line1, 'Old Street'); // untouched
    assert.equal(saved.phone, '9999999999'); // untouched
    assert.equal(saved.ngoProfile.orgName, 'Asha'); // untouched
    assert.equal(saved.ngoProfile.contactPerson, 'New Contact');
    assert.equal(saved.ngoProfile.serviceRadiusKm, 25);
    assert.equal(saved.ngoProfile.capacityMealsPerDay, 200);
  });

  it('converts { lat, lng } to a GeoJSON point', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await patch(ngo, { location: { lat: 21.17, lng: 72.83 } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.user.location, { type: 'Point', coordinates: [72.83, 21.17] });
  });

  it('null clears an optional field', async () => {
    const ngo = await createUser(USER_TYPES.NGO, {
      ngoProfile: { orgName: 'Asha', registrationNumber: 'REG-1', contactPerson: 'Someone' },
    });
    const res = await patch(ngo, { ngoProfile: { contactPerson: null } });
    assert.equal(res.status, 200);

    const saved = await User.findById(ngo._id).lean();
    assert.equal(saved.ngoProfile.contactPerson, undefined);
    assert.equal(saved.ngoProfile.orgName, 'Asha');
  });

  it('non-identity changes keep a VERIFIED NGO verified', async () => {
    const ngo = await createUser(USER_TYPES.NGO); // factory default: VERIFIED
    const res = await patch(ngo, { phone: '9123456780', ngoProfile: { serviceRadiusKm: 5 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.verificationReset, false);
    assert.equal(res.body.data.user.verificationStatus, VERIFICATION_STATUS.VERIFIED);
  });

  it('changing orgName sends a VERIFIED NGO back to PENDING', async () => {
    const ngo = await createUser(USER_TYPES.NGO, { verifiedAt: new Date() });
    const res = await patch(ngo, { ngoProfile: { orgName: 'Brand New Name' } });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.verificationReset, true);
    assert.match(res.body.message, /re-verified/);
    const saved = await User.findById(ngo._id).lean();
    assert.equal(saved.verificationStatus, VERIFICATION_STATUS.PENDING);
    assert.equal(saved.verifiedAt, undefined);
  });

  it('a REJECTED NGO that fixes its registration number goes back to PENDING', async () => {
    const ngo = await createUser(USER_TYPES.NGO, {
      verificationStatus: VERIFICATION_STATUS.REJECTED,
      rejectionReason: 'Registration number not found',
    });
    const res = await patch(ngo, { ngoProfile: { registrationNumber: 'REG-FIXED' } });

    assert.equal(res.status, 200);
    const saved = await User.findById(ngo._id).lean();
    assert.equal(saved.verificationStatus, VERIFICATION_STATUS.PENDING);
    assert.equal(saved.rejectionReason, undefined);
  });

  it('sending the SAME orgName does not reset verification', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await patch(ngo, { ngoProfile: { orgName: ngo.ngoProfile.orgName } });
    assert.equal(res.body.data.verificationReset, false);
    assert.equal(res.body.data.user.verificationStatus, VERIFICATION_STATUS.VERIFIED);
  });

  it('cannot change protected fields (email, role, verificationStatus)', async () => {
    const ngo = await createUser(USER_TYPES.NGO, { verificationStatus: VERIFICATION_STATUS.PENDING });
    for (const body of [
      { email: 'new@x.com' },
      { role: 'ADMIN' },
      { verificationStatus: 'VERIFIED' },
      { userType: 'DONOR' },
      { ngoProfile: { documents: [] } },
    ]) {
      const res = await patch(ngo, body);
      assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    }
    const saved = await User.findById(ngo._id).lean();
    assert.equal(saved.verificationStatus, VERIFICATION_STATUS.PENDING);
    assert.equal(saved.role, 'USER');
  });

  it('rejects invalid values with field errors', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await patch(ngo, {
      phone: '12',
      location: { lat: 200, lng: 72 },
      address: { pincode: 'abc' },
      ngoProfile: { serviceRadiusKm: 500, orgName: 'A' },
    });
    assert.equal(res.status, 400);
    const fields = res.body.errors.map((e) => e.field);
    for (const f of ['phone', 'location.lat', 'address.pincode', 'ngoProfile.serviceRadiusKm', 'ngoProfile.orgName']) {
      assert.ok(fields.includes(f), `expected an error on ${f}, got ${fields}`);
    }
  });

  it('rejects location sent as strings (an empty "" must not become 0)', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await patch(ngo, { location: { lat: '', lng: '72.5' } });
    assert.equal(res.status, 400);
    const saved = await User.findById(ngo._id).lean();
    assert.deepEqual(saved.location.coordinates, [72.5714, 23.0225]); // unchanged
  });

  it('rejects an empty body', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await patch(ngo, {});
    assert.equal(res.status, 400);
  });

  it('phone cannot be cleared (NGOs must stay reachable)', async () => {
    const ngo = await createUser(USER_TYPES.NGO, { phone: '9876543210' });
    const res = await patch(ngo, { phone: null });
    assert.equal(res.status, 400);
  });
});

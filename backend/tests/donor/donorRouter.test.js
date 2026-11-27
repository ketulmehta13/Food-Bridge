import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { startDb, clearDb, stopDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { authHeaders } from '../helpers/auth.js';
import app from '../../src/app.js';
import donorRouter from '../../src/routes/donor.routes.js';
import { ApiResponse } from '../../src/utils/ApiResponse.js';
import { ROLES, USER_TYPES } from '../../src/constants/index.js';

// Test-only routes, added to the real donor router inside this test process only,
// so the full router-level chain (protect -> requireUserType -> loadCurrentUser -> csrfGuard) runs.
const echo = (req, res) => ApiResponse.send(res, 200, { user: req.user });
donorRouter.get('/__test', echo);
donorRouter.post('/__test', echo);

const URL = '/api/donor/__test';

describe('donor router chain', () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it('no token -> 401', async () => {
    const res = await request(app).get(URL);
    assert.equal(res.status, 401);
  });

  it('invalid token -> 401', async () => {
    const res = await request(app).get(URL).set('Authorization', 'Bearer not.a.token');
    assert.equal(res.status, 401);
  });

  it('NGO token -> 403', async () => {
    const ngo = await createUser(USER_TYPES.NGO);
    const res = await request(app).get(URL).set(authHeaders(ngo));
    assert.equal(res.status, 403);
  });

  it('admin token -> 403', async () => {
    const admin = await createUser(ROLES.ADMIN);
    const res = await request(app).get(URL).set(authHeaders(admin));
    assert.equal(res.status, 403);
  });

  it('inactive donor -> 403', async () => {
    const donor = await createUser(USER_TYPES.DONOR, { isActive: false });
    const res = await request(app).get(URL).set(authHeaders(donor));
    assert.equal(res.status, 403);
  });

  it('donor GET -> 200', async () => {
    const donor = await createUser(USER_TYPES.DONOR);
    const res = await request(app).get(URL).set(authHeaders(donor));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, String(donor._id));
  });

  it('donor POST without CSRF header -> 403', async () => {
    const donor = await createUser(USER_TYPES.DONOR);
    const { Authorization } = authHeaders(donor);
    const res = await request(app).post(URL).set('Authorization', Authorization).send({});
    assert.equal(res.status, 403);
  });

  it('donor POST with CSRF header -> 200', async () => {
    const donor = await createUser(USER_TYPES.DONOR);
    const res = await request(app).post(URL).set(authHeaders(donor)).send({});
    assert.equal(res.status, 200);
  });

  it('token in the accessToken cookie also works', async () => {
    const donor = await createUser(USER_TYPES.DONOR);
    const token = authHeaders(donor).Authorization.slice(7);
    const res = await request(app).get(URL).set('Cookie', `accessToken=${token}`);
    assert.equal(res.status, 200);
  });
});

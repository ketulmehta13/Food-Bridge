import '../helpers/env.js';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';

import { startDb, clearDb, stopDb } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';
import { authHeaders } from '../helpers/auth.js';
import { makeApp } from '../helpers/app.js';
import { protect, requireVerified } from '../../src/middlewares/auth.middleware.js';
import { loadCurrentUser } from '../../src/middlewares/currentUser.middleware.js';
import { User } from '../../src/models/User.js';
import { USER_TYPES, VERIFICATION_STATUS } from '../../src/constants/index.js';

const app = makeApp(protect, loadCurrentUser);
const verifiedApp = makeApp(protect, loadCurrentUser, requireVerified);

describe('loadCurrentUser', () => {
  before(startDb);
  after(stopDb);
  beforeEach(clearDb);

  it('passes an active user and exposes fresh fields', async () => {
    const user = await createUser(USER_TYPES.DONOR);
    const res = await request(app).get('/test').set(authHeaders(user));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, String(user._id));
    assert.equal(res.body.data.user.verificationStatus, VERIFICATION_STATUS.VERIFIED);
  });

  it('401 when the user was deleted', async () => {
    const user = await createUser(USER_TYPES.DONOR);
    const headers = authHeaders(user);
    await User.deleteOne({ _id: user._id });
    const res = await request(app).get('/test').set(headers);
    assert.equal(res.status, 401);
  });

  it('401 when the token carries a malformed id', async () => {
    const token = jwt.sign({ id: 'nope', userType: USER_TYPES.DONOR }, process.env.JWT_ACCESS_SECRET);
    const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    assert.equal(res.status, 401);
  });

  it('403 when the user is inactive', async () => {
    const user = await createUser(USER_TYPES.DONOR, { isActive: false });
    const res = await request(app).get('/test').set(authHeaders(user));
    assert.equal(res.status, 403);
  });

  it('stale VERIFIED token is blocked when the DB says PENDING', async () => {
    const user = await createUser(USER_TYPES.DONOR, {
      verificationStatus: VERIFICATION_STATUS.PENDING,
    });
    const headers = authHeaders(user, { verificationStatus: VERIFICATION_STATUS.VERIFIED });
    const res = await request(verifiedApp).get('/test').set(headers);
    assert.equal(res.status, 403);
  });

  it('stale PENDING token passes once the DB says VERIFIED', async () => {
    const user = await createUser(USER_TYPES.DONOR);
    const headers = authHeaders(user, { verificationStatus: VERIFICATION_STATUS.PENDING });
    const res = await request(verifiedApp).get('/test').set(headers);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.verificationStatus, VERIFICATION_STATUS.VERIFIED);
  });
});

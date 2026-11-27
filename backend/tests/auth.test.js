// Auth API tests: register, login, /users/me, refresh, logout. Run with: npm test
// Starts the real Express app on a random port, using an in-memory MongoDB
// (no local MongoDB needed).
import './helpers/env.js'; // must be first: sets NODE_ENV=test + JWT secrets
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb } from './helpers/db.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';

let server;
let baseUrl;

// Tiny cookie jar, like a browser/Postman: remembers cookies between requests.
const createClient = () => {
  const jar = new Map();
  const request = async (method, path, body) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(baseUrl + path, {
      method,
      headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const [name, value] = pair.split('=');
      if (value) jar.set(name, value);
      else jar.delete(name); // cleared cookie
    }
    return { status: res.status, body: await res.json(), setCookies: res.headers.getSetCookie() };
  };
  return { request, jar };
};

const ngoBody = (overrides = {}) => ({
  name: 'Asha',
  email: 'asha@ngo.org',
  password: 'secret123',
  phone: '9876543210',
  userType: 'NGO',
  location: { lat: 23.0225, lng: 72.5714 },
  ngoProfile: { orgName: 'Asha Foundation', registrationNumber: 'REG-1' },
  ...overrides,
});

const donorBody = (overrides = {}) => ({
  name: 'Ravi',
  email: 'ravi@cafe.com',
  password: 'secret123',
  userType: 'DONOR',
  donorProfile: { donorCategory: 'RESTAURANT', businessName: 'Ravi Cafe' },
  ...overrides,
});

before(async () => {
  await startDb();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await stopDb();
});

describe('POST /auth/register', () => {
  it('registers an NGO, sets both cookies and hides secrets', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/register', ngoBody());

    assert.equal(res.status, 201);
    const { user } = res.body.data;
    assert.equal(user.userType, 'NGO');
    assert.equal(user.verificationStatus, 'PENDING');
    assert.deepEqual(user.location, { type: 'Point', coordinates: [72.5714, 23.0225] });
    assert.ok(!('password' in user));
    assert.ok(!('refreshTokenHash' in user));

    const cookies = res.setCookies.join(' | ');
    assert.match(cookies, /accessToken=.+HttpOnly/i);
    assert.match(cookies, /refreshToken=.+Path=\/api\/auth/i);
  });

  it('registers a donor without location', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/register', donorBody());
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.donorProfile.donorCategory, 'RESTAURANT');
  });

  it('rejects a duplicate email with 409', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/register', donorBody({ email: 'RAVI@cafe.com' }));
    assert.equal(res.status, 409);
  });

  it('rejects an NGO with missing NGO fields (400 + field errors)', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/register', ngoBody({ email: 'x@ngo.org', ngoProfile: {}, location: undefined }));
    assert.equal(res.status, 400);
    const fields = res.body.errors.map((e) => e.field);
    assert.ok(fields.includes('ngoProfile.orgName'));
    assert.ok(fields.includes('location'));
  });

  it('rejects an unknown userType', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/register', donorBody({ email: 'y@x.com', userType: 'HACKER' }));
    assert.equal(res.status, 400);
  });

  it('ignores role=ADMIN in the body (cannot self-register as admin)', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/register', donorBody({ email: 'sneaky@x.com', role: 'ADMIN' }));
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.role, 'USER');
  });
});

describe('POST /auth/login + GET /users/me', () => {
  it('rejects a wrong password with a generic message', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/login', { email: 'asha@ngo.org', password: 'wrong-pass' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  it('rejects an unknown email with the same message', async () => {
    const { request } = createClient();
    const res = await request('POST', '/auth/login', { email: 'nobody@x.com', password: 'secret123' });
    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  it('/users/me without logging in returns 401', async () => {
    const { request } = createClient();
    assert.equal((await request('GET', '/users/me')).status, 401);
  });

  it('logs in (email is case-insensitive) and /users/me returns the user', async () => {
    const { request } = createClient();
    const login = await request('POST', '/auth/login', { email: 'ASHA@ngo.org', password: 'secret123' });
    assert.equal(login.status, 200);

    const me = await request('GET', '/users/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, 'asha@ngo.org');
    assert.ok(!('password' in me.body.data.user));

    const stored = await User.findOne({ email: 'asha@ngo.org' }).select('+refreshTokenHash');
    assert.ok(stored.lastLoginAt);
    assert.match(stored.refreshTokenHash, /^[a-f0-9]{64}$/); // only a hash is stored
  });

  it('a logged-in NGO can pass the /ngo route guard, a donor cannot', async () => {
    const ngo = createClient();
    await ngo.request('POST', '/auth/login', { email: 'asha@ngo.org', password: 'secret123' });
    assert.equal((await ngo.request('GET', '/ngo/anything')).status, 404); // passed guard, no route yet

    const donor = createClient();
    await donor.request('POST', '/auth/login', { email: 'ravi@cafe.com', password: 'secret123' });
    assert.equal((await donor.request('GET', '/ngo/anything')).status, 403);
  });

  it('a deactivated user cannot log in', async () => {
    await User.updateOne({ email: 'sneaky@x.com' }, { isActive: false });
    const { request } = createClient();
    const res = await request('POST', '/auth/login', { email: 'sneaky@x.com', password: 'secret123' });
    assert.equal(res.status, 403);
  });
});

describe('POST /auth/refresh + /auth/logout', () => {
  it('refresh rotates tokens and picks up admin verification', async () => {
    const client = createClient();
    await client.request('POST', '/auth/login', { email: 'asha@ngo.org', password: 'secret123' });
    const oldRefresh = client.jar.get('refreshToken');

    // Admin verifies the NGO while they are logged in.
    await User.updateOne({ email: 'asha@ngo.org' }, { verificationStatus: 'VERIFIED' });

    const res = await client.request('POST', '/auth/refresh');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.verificationStatus, 'VERIFIED');
    assert.notEqual(client.jar.get('refreshToken'), oldRefresh); // new refresh token
  });

  it('reusing an old refresh token is rejected and ends the session', async () => {
    const client = createClient();
    await client.request('POST', '/auth/login', { email: 'asha@ngo.org', password: 'secret123' });
    const stolen = client.jar.get('refreshToken');

    await client.request('POST', '/auth/refresh'); // legit refresh: "stolen" is now outdated

    const attacker = createClient();
    attacker.jar.set('refreshToken', stolen);
    assert.equal((await attacker.request('POST', '/auth/refresh')).status, 401);

    // The legit user's session was also ended, as a safety measure.
    assert.equal((await client.request('POST', '/auth/refresh')).status, 401);
  });

  it('refresh without a cookie returns 401', async () => {
    const { request } = createClient();
    assert.equal((await request('POST', '/auth/refresh')).status, 401);
  });

  it('logout clears cookies and the refresh token stops working', async () => {
    const client = createClient();
    await client.request('POST', '/auth/login', { email: 'ravi@cafe.com', password: 'secret123' });
    const refreshToken = client.jar.get('refreshToken');

    const res = await client.request('POST', '/auth/logout');
    assert.equal(res.status, 200);
    assert.equal(client.jar.size, 0); // both cookies cleared
    assert.equal((await client.request('GET', '/users/me')).status, 401);

    const replay = createClient();
    replay.jar.set('refreshToken', refreshToken);
    assert.equal((await replay.request('POST', '/auth/refresh')).status, 401);
  });
});

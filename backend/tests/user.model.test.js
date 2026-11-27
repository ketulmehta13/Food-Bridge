// User model tests. Run with: npm test
// Uses an in-memory MongoDB (no local MongoDB needed).
import './helpers/env.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDb, stopDb } from './helpers/db.js';
import { User } from '../src/models/User.js';

const ngoData = (overrides = {}) => ({
  name: 'Asha',
  email: 'ngo@example.com',
  password: 'secret123',
  userType: 'NGO',
  location: { type: 'Point', coordinates: [72.57, 23.02] }, // [lng, lat] Ahmedabad
  ngoProfile: { orgName: 'Asha Foundation', registrationNumber: 'REG-1' },
  ...overrides,
});

const donorData = (overrides = {}) => ({
  name: 'Dev',
  email: 'donor@example.com',
  password: 'secret123',
  userType: 'DONOR',
  donorProfile: { donorCategory: 'RESTAURANT', businessName: 'Cafe' },
  ...overrides,
});

// Expect User.create to fail with a validation error on `field`.
const expectValidationError = async (data, field) => {
  await assert.rejects(User.create(data), (err) => {
    assert.ok(err.errors?.[field], `expected error on "${field}", got: ${err.message}`);
    return true;
  });
};

// Read the document exactly as stored in MongoDB (bypassing Mongoose).
const raw = (id) => User.collection.findOne({ _id: id });

before(startDb);
after(stopDb);

describe('User model - NGO', () => {
  let ngo;
  before(async () => {
    ngo = await User.create(ngoData({ email: '  NGO@Example.com ', donorProfile: { donorCategory: 'HOTEL' } }));
  });

  it('lowercases and trims email', () => {
    assert.equal(ngo.email, 'ngo@example.com');
  });

  it('hashes the password with bcrypt', () => {
    assert.notEqual(ngo.password, 'secret123');
    assert.match(ngo.password, /^\$2[aby]\$12\$/);
  });

  it('defaults verificationStatus to PENDING and serviceRadiusKm to 10', () => {
    assert.equal(ngo.verificationStatus, 'PENDING');
    assert.equal(ngo.ngoProfile.serviceRadiusKm, 10);
  });

  it('does not store donorProfile for an NGO', async () => {
    assert.ok(!('donorProfile' in (await raw(ngo._id))));
  });

  it('hides the password from normal queries', async () => {
    const found = await User.findById(ngo._id);
    assert.equal(found.password, undefined);
  });

  it('comparePassword accepts the right password and rejects a wrong one', async () => {
    const found = await User.findById(ngo._id).select('+password');
    assert.equal(await found.comparePassword('secret123'), true);
    assert.equal(await found.comparePassword('wrong-password'), false);
  });

  it('does not re-hash the password when other fields change', async () => {
    const found = await User.findById(ngo._id).select('+password');
    const hashBefore = found.password;
    found.name = 'Asha Updated';
    await found.save();
    assert.equal(found.password, hashBefore);
  });

  it('removes secrets when converted to JSON', async () => {
    const found = await User.findById(ngo._id).select('+password');
    const json = JSON.parse(JSON.stringify(found));
    assert.ok(!('password' in json));
    assert.ok(!('__v' in json));
  });

  it('builds the JWT payload', () => {
    assert.deepEqual(ngo.toTokenPayload(), {
      id: ngo.id,
      role: 'USER',
      userType: 'NGO',
      verificationStatus: 'PENDING',
    });
  });

  it('can be found with a $near (nearby) query', async () => {
    const nearby = await User.find({
      location: {
        $near: { $geometry: { type: 'Point', coordinates: [72.58, 23.03] }, $maxDistance: 5000 },
      },
    });
    assert.equal(nearby.length, 1);
  });
});

describe('User model - validation', () => {
  it('rejects a duplicate email (case-insensitive)', async () => {
    await User.create(donorData({ email: 'dup@example.com' }));
    await assert.rejects(User.create(donorData({ email: 'DUP@example.com' })), { code: 11000 });
  });

  it('requires userType for normal users', () =>
    expectValidationError({ name: 'x', email: 'a@x.co', password: 'secret123' }, 'userType'));

  it('requires a password of at least 8 characters', () =>
    expectValidationError(donorData({ email: 'b@x.co', password: 'short' }), 'password'));

  it('rejects an invalid email', () => expectValidationError(donorData({ email: 'not-an-email' }), 'email'));

  it('requires donorCategory for donors', () =>
    expectValidationError(donorData({ email: 'c@x.co', donorProfile: {} }), 'donorProfile.donorCategory'));

  it('requires registrationNumber for NGOs', () =>
    expectValidationError(ngoData({ email: 'd@x.co', ngoProfile: { orgName: 'X' } }), 'ngoProfile.registrationNumber'));

  it('requires location for NGOs', () =>
    expectValidationError(ngoData({ email: 'e@x.co', location: undefined }), 'location'));

  it('rejects coordinates out of range', () =>
    expectValidationError(
      ngoData({ email: 'f@x.co', location: { type: 'Point', coordinates: [23, 200] } }),
      'location.coordinates'
    ));
});

describe('User model - donor and admin', () => {
  it('a donor needs no location or ngoProfile', async () => {
    const donor = await User.create(donorData({ email: 'donor2@example.com' }));
    const stored = await raw(donor._id);
    assert.ok(!('location' in stored));
    assert.ok(!('ngoProfile' in stored));
  });

  it('an admin has no userType and is always VERIFIED', async () => {
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@example.com',
      password: 'secret123',
      role: 'ADMIN',
      userType: 'NGO',
    });
    const stored = await raw(admin._id);
    assert.ok(!('userType' in stored));
    assert.equal(admin.verificationStatus, 'VERIFIED');
  });
});

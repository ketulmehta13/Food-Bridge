import { User } from '../../src/models/User.js';
import { Donation } from '../../src/models/Donation.js';
import { toPoint } from '../../src/utils/geo.js';
import {
  ROLES,
  USER_TYPES,
  VERIFICATION_STATUS,
  DONOR_CATEGORIES,
  FOOD_TYPES,
  FOOD_CATEGORIES,
} from '../../src/constants/index.js';

const MIN = 60 * 1000;
let counter = 0;

/**
 * Create a user in the test DB. Verified and active by default.
 * @param {'DONOR'|'NGO'|'ADMIN'} [type='DONOR']
 * @param {object} [overrides]
 */
export const createUser = async (type = USER_TYPES.DONOR, overrides = {}) => {
  counter += 1;
  const base = {
    name: `Test ${type} ${counter}`,
    email: `user${counter}.${Date.now()}@test.dev`,
    password: 'Password@123',
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
  };

  if (type === ROLES.ADMIN) {
    base.role = ROLES.ADMIN;
  } else if (type === USER_TYPES.NGO) {
    Object.assign(base, {
      userType: USER_TYPES.NGO,
      location: toPoint(23.0225, 72.5714),
      ngoProfile: { orgName: `NGO ${counter}`, registrationNumber: `REG-${counter}` },
    });
  } else {
    Object.assign(base, {
      userType: USER_TYPES.DONOR,
      donorProfile: { donorCategory: DONOR_CATEGORIES.RESTAURANT },
    });
  }

  return User.create({ ...base, ...overrides });
};

/** Valid donation data with times relative to now. */
export const donationData = (donorId, overrides = {}) => {
  const now = Date.now();
  return {
    donor: donorId,
    items: [{ name: 'Veg biryani', quantity: 5, unit: 'KG' }],
    totalServings: 25,
    estimatedWeightKg: 5,
    foodType: FOOD_TYPES.VEG,
    category: FOOD_CATEGORIES.COOKED,
    preparedAt: new Date(now - 60 * MIN),
    bestBefore: new Date(now + 6 * 60 * MIN),
    pickupWindow: { start: new Date(now + 30 * MIN), end: new Date(now + 4 * 60 * MIN) },
    location: toPoint(23.03, 72.58),
    address: { line1: '12 Test Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
    contactPhone: '9876543210',
    safetyChecklist: {
      preparedHygienically: true,
      storedAtSafeTemperature: true,
      packedAndCovered: true,
      notSpoiled: true,
    },
    ...overrides,
  };
};

/**
 * A valid POST /api/donor/donations body (JSON-ready, ISO times relative to now).
 * Times: prepared 30 min ago, pickup now+1h..now+3h, best-before now+5h.
 */
export const donationBody = (overrides = {}) => {
  const now = Date.now();
  const iso = (offsetMin) => new Date(now + offsetMin * MIN).toISOString();
  return {
    items: [
      { name: 'Veg biryani', quantity: 5, unit: 'KG' },
      { name: 'Rotis', quantity: 40, unit: 'PIECES' },
    ],
    totalServings: 30,
    estimatedWeightKg: 7.5,
    foodType: FOOD_TYPES.VEG,
    category: FOOD_CATEGORIES.COOKED,
    preparedAt: iso(-30),
    bestBefore: iso(5 * 60),
    pickupWindow: { start: iso(60), end: iso(3 * 60) },
    location: { lat: 23.0225, lng: 72.5714 },
    address: { line1: '12 CG Road, Navrangpura', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009' },
    safetyChecklist: {
      preparedHygienically: true,
      storedAtSafeTemperature: true,
      packedAndCovered: true,
      notSpoiled: true,
    },
    allergenInfo: 'Contains nuts',
    notes: 'Please bring containers',
    ...overrides,
  };
};

/** Create a donation in the test DB. */
export const createDonation = (donor, overrides = {}) =>
  Donation.create(donationData(donor._id ?? donor, overrides));

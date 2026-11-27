// Shared enums. Keep in sync with frontend/src/constants/index.js.

export const ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
});

export const USER_TYPES = Object.freeze({
  DONOR: 'DONOR',
  NGO: 'NGO',
});

// Kind of donor (stored on the user's donorProfile).
export const DONOR_CATEGORIES = Object.freeze({
  RESTAURANT: 'RESTAURANT',
  HOTEL: 'HOTEL',
  CATERER: 'CATERER',
  EVENT: 'EVENT',
  HOUSEHOLD: 'HOUSEHOLD',
  OTHER: 'OTHER',
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const DONATION_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  CLAIMED: 'CLAIMED',
  PICKED_UP: 'PICKED_UP',
  DISTRIBUTED: 'DISTRIBUTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

export const FOOD_TYPES = Object.freeze({
  VEG: 'VEG',
  NON_VEG: 'NON_VEG',
  VEGAN: 'VEGAN',
});

export const FOOD_CATEGORIES = Object.freeze({
  COOKED: 'COOKED',
  RAW: 'RAW',
  PACKAGED: 'PACKAGED',
  BAKERY: 'BAKERY',
  FRUITS_VEGETABLES: 'FRUITS_VEGETABLES',
  DAIRY: 'DAIRY',
  BEVERAGES: 'BEVERAGES',
  OTHER: 'OTHER',
});

// Actions recorded in the claim history of a donation (written by donor and NGO flows).
export const CLAIM_ACTIONS = Object.freeze({
  CLAIMED: 'CLAIMED',
  UNCLAIMED: 'UNCLAIMED',
  NO_SHOW: 'NO_SHOW',
  PICKED_UP: 'PICKED_UP',
  DISTRIBUTED: 'DISTRIBUTED',
  CANCELLED_BY_DONOR: 'CANCELLED_BY_DONOR',
});

// Business limits for donations. The server enforces all of these.
export const DONATION_LIMITS = Object.freeze({
  MAX_PHOTOS: 3,
  MAX_OTP_ATTEMPTS: 5,
  MAX_SHELF_LIFE_HOURS: 48,
  MIN_MINUTES_BEFORE_EXPIRY: 30,
  MAX_ITEMS: 20,
  PAGE_SIZE_DEFAULT: 10,
  PAGE_SIZE_MAX: 50,
});

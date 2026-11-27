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

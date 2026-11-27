// Mirrors backend/src/constants/index.js. Keep in sync.

export const ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
});

export const USER_TYPES = Object.freeze({
  DONOR: 'DONOR',
  NGO: 'NGO',
});

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

// Tailwind classes per donation status (used by StatusBadge).
// Full class strings so Tailwind can detect them at build time.
export const DONATION_STATUS_STYLES = Object.freeze({
  [DONATION_STATUS.AVAILABLE]: 'bg-green-100 text-green-800 ring-green-600/20',
  [DONATION_STATUS.CLAIMED]: 'bg-blue-100 text-blue-800 ring-blue-600/20',
  [DONATION_STATUS.PICKED_UP]: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  [DONATION_STATUS.DISTRIBUTED]: 'bg-purple-100 text-purple-800 ring-purple-600/20',
  [DONATION_STATUS.EXPIRED]: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  [DONATION_STATUS.CANCELLED]: 'bg-red-100 text-red-800 ring-red-600/20',
});

export const CLAIM_ACTIONS = Object.freeze({
  CLAIMED: 'CLAIMED',
  UNCLAIMED: 'UNCLAIMED',
  NO_SHOW: 'NO_SHOW',
  PICKED_UP: 'PICKED_UP',
  DISTRIBUTED: 'DISTRIBUTED',
  CANCELLED_BY_DONOR: 'CANCELLED_BY_DONOR',
});

export const DONATION_LIMITS = Object.freeze({
  MAX_PHOTOS: 3,
  MAX_OTP_ATTEMPTS: 5,
  MAX_SHELF_LIFE_HOURS: 48,
  MIN_MINUTES_BEFORE_EXPIRY: 30,
  MAX_ITEMS: 20,
  PAGE_SIZE_DEFAULT: 10,
  PAGE_SIZE_MAX: 50,
});

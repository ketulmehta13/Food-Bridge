// Donor-only copies of backend enums that are not in the shared frontend constants yet.
// TODO(Ketul): move FOOD_TYPES, FOOD_CATEGORIES and FOOD_UNITS to src/constants/index.js
// (and FOOD_UNITS to backend/src/constants/index.js) once agreed. Keep in sync with the backend.

export const FOOD_TYPES = Object.freeze({ VEG: 'VEG', NON_VEG: 'NON_VEG', VEGAN: 'VEGAN' });

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

export const FOOD_UNITS = Object.freeze({
  KG: 'KG',
  G: 'G',
  LITRE: 'LITRE',
  ML: 'ML',
  PIECES: 'PIECES',
  PACKETS: 'PACKETS',
  PLATES: 'PLATES',
  BOXES: 'BOXES',
});

export const SAFETY_CHECKS = Object.freeze([
  ['preparedHygienically', 'Prepared hygienically'],
  ['storedAtSafeTemperature', 'Stored at a safe temperature'],
  ['packedAndCovered', 'Packed and covered'],
  ['notSpoiled', 'Not spoiled'],
]);

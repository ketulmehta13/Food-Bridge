import { z } from 'zod';
import {
  DONATION_STATUS,
  DONATION_LIMITS,
  FOOD_TYPES,
  FOOD_CATEGORIES,
} from '../constants/index.js';
import { latitude, longitude, paginationQuery, trimmedString } from './common.validators.js';

// Request schemas for /api/donor/*. Owner: Jay.

// TODO(Ketul): move to constants/index.js once agreed, so the NGO side can reuse it.
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

const SAFETY_MESSAGE = 'All safety checks must be confirmed';
const mustBeTrue = z.literal(true, { error: SAFETY_MESSAGE });

// ISO 8601 with an explicit timezone ("Z" or "+05:30"), converted to a Date.
const isoDateTime = z.iso
  .datetime({ offset: true, error: 'Must be an ISO 8601 date-time with a timezone' })
  .transform((value) => new Date(value));

// Optional free text: trimmed, capped; an empty string counts as "not given".
const optionalText = (max) =>
  trimmedString(max, { min: 0 })
    .optional()
    .transform((value) => value || undefined);

const itemSchema = z.strictObject({
  name: trimmedString(80, { min: 2 }),
  quantity: z.number().positive().max(10000),
  unit: z.enum(Object.values(FOOD_UNITS)),
});

/** Body of POST /api/donor/donations. Unknown keys at any level -> 400. */
export const createDonationBody = z.strictObject({
  items: z.array(itemSchema).min(1).max(DONATION_LIMITS.MAX_ITEMS),
  totalServings: z.number().int().min(1).max(5000),
  estimatedWeightKg: z.number().positive().max(2000),
  foodType: z.enum(Object.values(FOOD_TYPES)),
  category: z.enum(Object.values(FOOD_CATEGORIES)),

  preparedAt: isoDateTime,
  bestBefore: isoDateTime,
  pickupWindow: z.strictObject({ start: isoDateTime, end: isoDateTime }),

  location: z.strictObject({ lat: latitude, lng: longitude }),
  address: z.strictObject({
    line1: trimmedString(200, { min: 5 }),
    city: trimmedString(60, { min: 2 }),
    state: trimmedString(60, { min: 2 }),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  }),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
    .optional(),

  safetyChecklist: z.strictObject({
    preparedHygienically: mustBeTrue,
    storedAtSafeTemperature: mustBeTrue,
    packedAndCovered: mustBeTrue,
    notSpoiled: mustBeTrue,
  }),
  allergenInfo: optionalText(300),
  notes: optionalText(500),
});

/** Sort options for "my donations". The leading "-" means newest/latest first. */
export const MY_DONATIONS_SORTS = Object.freeze([
  'createdAt',
  '-createdAt',
  'bestBefore',
  '-bestBefore',
]);

/** Query of GET /api/donor/donations. Unknown keys (e.g. "status[$ne]") -> 400. */
export const listMyDonationsQuery = paginationQuery.extend({
  status: z.enum(Object.values(DONATION_STATUS)).optional(),
  sort: z.enum(MY_DONATIONS_SORTS).default('-createdAt'),
});

import { z } from 'zod';
import { DONATION_LIMITS } from '../constants/index.js';

// Reusable Zod building blocks shared by donor and NGO validators.

/** A MongoDB ObjectId as a 24-character hex string. */
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** Route params for "/:id" routes. Unknown params are rejected. */
export const idParam = z.strictObject({ id: objectId });

/** page/limit fields, coerced from query strings. Spread into a query schema with .extend(). */
export const paginationFields = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(DONATION_LIMITS.PAGE_SIZE_MAX)
    .default(DONATION_LIMITS.PAGE_SIZE_DEFAULT),
};

/** Strict query schema with only page/limit. Extend it: paginationQuery.extend({ status: ... }). */
export const paginationQuery = z.strictObject(paginationFields);

/** Latitude in degrees, coerced from strings. */
export const latitude = z.coerce.number().min(-90).max(90);

/** Longitude in degrees, coerced from strings. */
export const longitude = z.coerce.number().min(-180).max(180);

/**
 * A trimmed string with a required max length.
 * @param {number} max maximum length after trimming
 * @param {{ min?: number }} [opts] minimum length after trimming (default 1)
 */
export const trimmedString = (max, { min = 1 } = {}) => z.string().trim().min(min).max(max);

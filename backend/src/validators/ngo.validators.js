import { z } from 'zod';
import { trimmedString } from './common.validators.js';

// Zod schemas for /api/ngo/*. Owner: Ketul.
//
// PATCH rules: a field that is left out is not changed. For optional fields,
// sending null clears the stored value. Unknown fields are rejected (strict).

// Optional text field: a string to set it, null to clear it.
const clearable = (max) => trimmedString(max).nullable().optional();

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number');

export const updateNgoProfileBody = z
  .strictObject({
    name: trimmedString(100, { min: 2 }).optional(),
    phone: phone.optional(), // NGOs must keep a phone number, so it can't be cleared
    address: z
      .strictObject({
        line1: clearable(200),
        city: clearable(100),
        state: clearable(100),
        pincode: z
          .string()
          .trim()
          .regex(/^[0-9]{6}$/, 'Pincode must be 6 digits')
          .nullable()
          .optional(),
      })
      .optional(),
    // Real JSON numbers only (no string coercion): an empty "" must not silently become 0.
    location: z
      .strictObject({
        lat: z.number('Latitude must be a number').min(-90).max(90),
        lng: z.number('Longitude must be a number').min(-180).max(180),
      })
      .optional(),
    ngoProfile: z
      .strictObject({
        orgName: trimmedString(150, { min: 2 }).optional(),
        registrationNumber: trimmedString(50, { min: 2 }).optional(),
        contactPerson: clearable(100),
        serviceRadiusKm: z.coerce.number().min(1).max(100).optional(),
        capacityMealsPerDay: z.coerce.number().int().min(0).max(100000).nullable().optional(),
      })
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });

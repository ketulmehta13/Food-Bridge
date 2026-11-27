import { z } from 'zod';
import { USER_TYPES, DONOR_CATEGORIES } from '../constants/index.js';

// ---- Reusable pieces ----

const email = z.string().trim().toLowerCase().email('Invalid email address');

// bcrypt only uses the first 72 bytes, so cap the length.
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number');

const address = z.object({
  line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(10).optional(),
});

// The client sends { lat, lng }; the service converts it to a GeoJSON Point.
const latLng = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// Fields every new account has. Note: "role" is NOT accepted, so nobody can sign up as ADMIN.
const baseRegister = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email,
  password,
  phone: phone.optional(),
  address: address.optional(),
};

// ---- Register: different required fields for donors and NGOs ----

const donorRegister = z.object({
  ...baseRegister,
  userType: z.literal(USER_TYPES.DONOR),
  location: latLng.optional(),
  donorProfile: z.object({
    businessName: z.string().trim().max(150).optional(),
    donorCategory: z.enum(Object.values(DONOR_CATEGORIES)),
  }),
});

const ngoRegister = z.object({
  ...baseRegister,
  userType: z.literal(USER_TYPES.NGO),
  phone, // required for NGOs so donors can reach them
  location: latLng,
  ngoProfile: z.object({
    orgName: z.string().trim().min(2).max(150),
    registrationNumber: z.string().trim().min(2).max(50),
    contactPerson: z.string().trim().max(100).optional(),
    serviceRadiusKm: z.coerce.number().min(1).max(100).optional(),
    capacityMealsPerDay: z.coerce.number().int().min(0).optional(),
  }),
});

// Picks the right schema based on "userType".
export const registerSchema = z.discriminatedUnion('userType', [donorRegister, ngoRegister]);

// ---- Login ----

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

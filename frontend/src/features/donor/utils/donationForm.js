import { FOOD_TYPES, FOOD_CATEGORIES, FOOD_UNITS, SAFETY_CHECKS } from '../donor.constants.js';
import { fromLocalInput, localInputFromNow, toLocalInput } from './datetime.js';

// Converters between the donation form state (strings, local times) and API bodies.

/** Sample values for the create form; times relative to now. */
export const sampleForm = () => ({
  items: [
    { name: 'Veg biryani', quantity: '5', unit: FOOD_UNITS.KG },
    { name: 'Rotis', quantity: '40', unit: FOOD_UNITS.PIECES },
  ],
  totalServings: '30',
  estimatedWeightKg: '7.5',
  foodType: FOOD_TYPES.VEG,
  category: FOOD_CATEGORIES.COOKED,
  preparedAt: localInputFromNow(-30),
  pickupStart: localInputFromNow(60),
  pickupEnd: localInputFromNow(180),
  bestBefore: localInputFromNow(300),
  lat: '23.0225',
  lng: '72.5714',
  line1: '12 CG Road, Navrangpura',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '380009',
  contactPhone: '',
  safetyChecklist: Object.fromEntries(SAFETY_CHECKS.map(([key]) => [key, true])),
  allergenInfo: '',
  notes: '',
});

/** Form state from a donation returned by the API (for editing). */
export const donationToForm = (d) => ({
  items: d.items.map((i) => ({ name: i.name, quantity: String(i.quantity), unit: i.unit })),
  totalServings: String(d.totalServings),
  estimatedWeightKg: String(d.estimatedWeightKg),
  foodType: d.foodType,
  category: d.category,
  preparedAt: toLocalInput(d.preparedAt),
  pickupStart: toLocalInput(d.pickupWindow.start),
  pickupEnd: toLocalInput(d.pickupWindow.end),
  bestBefore: toLocalInput(d.bestBefore),
  lat: String(d.location.coordinates[1]),
  lng: String(d.location.coordinates[0]),
  line1: d.address?.line1 ?? '',
  city: d.address?.city ?? '',
  state: d.address?.state ?? '',
  pincode: d.address?.pincode ?? '',
  contactPhone: d.contactPhone ?? '',
  safetyChecklist: d.safetyChecklist,
  allergenInfo: d.allergenInfo ?? '',
  notes: d.notes ?? '',
});

// Numbers are sent as numbers (the API rejects numeric strings).
const toNumber = (v) => (v === '' ? v : Number(v));

/**
 * API body from form state.
 * - create: empty optional fields are left out.
 * - edit (forEdit: true): no safetyChecklist; empty notes/allergenInfo are sent as "" (= clear).
 */
export const buildBody = (f, { forEdit = false } = {}) => ({
  items: f.items.map((i) => ({ name: i.name, quantity: toNumber(i.quantity), unit: i.unit })),
  totalServings: toNumber(f.totalServings),
  estimatedWeightKg: toNumber(f.estimatedWeightKg),
  foodType: f.foodType,
  category: f.category,
  preparedAt: fromLocalInput(f.preparedAt),
  bestBefore: fromLocalInput(f.bestBefore),
  pickupWindow: { start: fromLocalInput(f.pickupStart), end: fromLocalInput(f.pickupEnd) },
  location: { lat: toNumber(f.lat), lng: toNumber(f.lng) },
  address: { line1: f.line1, city: f.city, state: f.state, pincode: f.pincode },
  ...(f.contactPhone && { contactPhone: f.contactPhone }),
  ...(!forEdit && { safetyChecklist: f.safetyChecklist }),
  ...((forEdit || f.allergenInfo) && { allergenInfo: f.allergenInfo }),
  ...((forEdit || f.notes) && { notes: f.notes }),
});

/** Only the top-level fields of `next` that differ from `initial` (nested objects compared whole). */
export const changedFields = (initial, next) =>
  Object.fromEntries(
    Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initial[key]))
  );

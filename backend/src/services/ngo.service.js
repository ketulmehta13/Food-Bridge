import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { toPoint } from '../utils/geo.js';
import { VERIFICATION_STATUS } from '../constants/index.js';

// Business logic for the NGO feature. Owner: Ketul.

// Fields an admin checks when verifying an NGO. Changing any of them
// sends the NGO back to PENDING so an admin can verify the new details.
const IDENTITY_FIELDS = ['ngoProfile.orgName', 'ngoProfile.registrationNumber'];

/**
 * Turn a nested object into dotted paths, so only the sent fields change:
 *   { address: { city: 'X' } }  ->  { 'address.city': 'X' }
 */
const flatten = (obj, prefix = '') =>
  Object.entries(obj).reduce((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flatten(value, path));
    } else {
      acc[path] = value;
    }
    return acc;
  }, {});

const findNgo = async (userId) => {
  const ngo = await User.findById(userId);
  if (!ngo) throw ApiError.notFound('NGO not found');
  return ngo;
};

// GET /api/ngo/profile
export const getProfile = (userId) => findNgo(userId);

/**
 * PATCH /api/ngo/profile
 * Returns { user, verificationReset } — verificationReset is true when the edit
 * changed verified identity details and the NGO must be re-verified.
 */
export const updateProfile = async (userId, body) => {
  const ngo = await findNgo(userId);
  const { location, ...rest } = body;

  // Apply each sent field; null means "clear this optional field".
  for (const [path, value] of Object.entries(flatten(rest))) {
    ngo.set(path, value === null ? undefined : value);
  }
  if (location) ngo.location = toPoint(location.lat, location.lng);

  const identityChanged = IDENTITY_FIELDS.some((path) => ngo.isModified(path));
  const verificationReset =
    identityChanged && ngo.verificationStatus !== VERIFICATION_STATUS.PENDING;

  if (verificationReset) {
    ngo.verificationStatus = VERIFICATION_STATUS.PENDING;
    ngo.rejectionReason = undefined;
    ngo.verifiedAt = undefined;
  }

  await ngo.save(); // runs the User model's validators
  return { user: ngo, verificationReset };
};

import { signAccessToken } from '../../src/utils/tokens.js';

/**
 * Bearer token for a user. payloadOverrides lets a test forge a stale token
 * (e.g. one that still says VERIFIED after the DB changed).
 */
export const tokenFor = (user, payloadOverrides = {}) =>
  signAccessToken({ ...user.toTokenPayload(), ...payloadOverrides });

/** Headers for an authenticated request that passes the CSRF guard. */
export const authHeaders = (user, payloadOverrides = {}) => ({
  Authorization: `Bearer ${tokenFor(user, payloadOverrides)}`,
  'X-Requested-With': 'XMLHttpRequest',
});

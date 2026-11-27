import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken, COOKIE_NAMES } from '../utils/tokens.js';
import { ROLES, VERIFICATION_STATUS } from '../constants/index.js';

// Read the access token from the cookie, or fall back to "Authorization: Bearer <token>".
const getToken = (req) => {
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
};

/**
 * Require a valid access token. Sets req.user to the decoded JWT payload.
 * Expected payload shape: { id, role, userType, verificationStatus }.
 * (Once a User model exists, this can also load the fresh user from the DB.)
 */
export const protect = (req, res, next) => {
  const token = getToken(req);
  if (!token) return next(ApiError.unauthorized('Not authenticated'));
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err); // JWT errors are mapped to 401 by errorHandler
  }
};

// Allow only the given roles, e.g. authorize(ROLES.ADMIN).
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Not authenticated'));
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to perform this action'));
  }
  next();
};

// Allow only the given user types, e.g. requireUserType(USER_TYPES.NGO).
export const requireUserType = (...types) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Not authenticated'));
  if (!types.includes(req.user.userType)) {
    return next(ApiError.forbidden(`Only ${types.join(' or ')} accounts can do this`));
  }
  next();
};

// Block users whose account has not been verified by an admin. Admins pass through.
export const requireVerified = (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Not authenticated'));
  if (req.user.role === ROLES.ADMIN) return next();
  if (req.user.verificationStatus !== VERIFICATION_STATUS.VERIFIED) {
    return next(ApiError.forbidden('Your account is pending verification'));
  }
  next();
};

/**
 * Ensure the logged-in user owns the document identified by req.params.id.
 * Example: ownsResource(Donation, 'donor'). Admins pass through.
 * The loaded document is attached as req.resource to avoid a second query.
 */
export const ownsResource = (Model, field = 'owner', param = 'id') =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized('Not authenticated');

    const doc = await Model.findById(req.params[param]);
    if (!doc) throw ApiError.notFound(`${Model.modelName} not found`);

    const isOwner = String(doc[field]?._id ?? doc[field]) === String(req.user.id);
    if (!isOwner && req.user.role !== ROLES.ADMIN) {
      throw ApiError.forbidden('You do not own this resource');
    }

    req.resource = doc;
    next();
  });

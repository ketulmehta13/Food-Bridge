import { ApiError } from './ApiError.js';
import { DONATION_LIMITS } from '../constants/index.js';

/**
 * Parse a sort string like "-createdAt" or "bestBefore" into a Mongo sort object.
 * Only fields listed in allowedSort are accepted; _id is added as a stable tiebreak.
 */
const buildSort = (sort, allowedSort) => {
  if (!sort) return { _id: -1 };
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  if (!allowedSort.includes(field)) {
    throw ApiError.badRequest(`Cannot sort by "${field}"`, [
      { location: 'query', field: 'sort', message: `Allowed: ${allowedSort.join(', ')}` },
    ]);
  }
  return { [field]: desc ? -1 : 1, _id: desc ? -1 : 1 };
};

/**
 * Paginated, read-only list query for any model.
 * Results are lean objects, so toJSON transforms do NOT run: pass a select that
 * excludes private fields (select:false fields stay hidden either way).
 *
 * @param {import('mongoose').Model} Model
 * @param {object} filter      already-validated Mongo filter (never raw req.query)
 * @param {object} [opts]
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit]           capped at DONATION_LIMITS.PAGE_SIZE_MAX
 * @param {string} [opts.sort]            e.g. "-createdAt"
 * @param {string[]} [opts.allowedSort]   whitelist of sortable fields
 * @param {string|object} [opts.select]
 * @param {string|object|Array} [opts.populate]
 * @returns {Promise<{ items: object[], pagination: { page, limit, total, totalPages } }>}
 * @example
 * paginate(Donation, { donor: donorId }, { page: 1, limit: 10, sort: '-createdAt',
 *   allowedSort: ['createdAt', 'bestBefore'], select: '-otpAttempts' });
 */
export const paginate = async (Model, filter = {}, opts = {}) => {
  const {
    page: rawPage = 1,
    limit: rawLimit = DONATION_LIMITS.PAGE_SIZE_DEFAULT,
    sort,
    allowedSort = [],
    select,
    populate,
  } = opts;

  const page = Math.max(1, Math.floor(Number(rawPage)) || 1);
  const limit = Math.min(
    DONATION_LIMITS.PAGE_SIZE_MAX,
    Math.max(1, Math.floor(Number(rawLimit)) || DONATION_LIMITS.PAGE_SIZE_DEFAULT)
  );

  let query = Model.find(filter)
    .sort(buildSort(sort, allowedSort))
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  if (select) query = query.select(select);
  if (populate) query = query.populate(populate);

  const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);

  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

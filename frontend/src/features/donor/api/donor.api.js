import api from '../../../api/axiosInstance.js';

// All donor API calls go through here. Owner: Jay.
// - Always sends X-Requested-With (the server's CSRF guard requires it on writes).
// - In development only, adds "Authorization: Bearer <token>" from the Dev Token panel.

const DEV_TOKEN_KEY = 'foodbridge.devToken';
const IS_DEV = import.meta.env.DEV;

/** Read the dev token (always null in production builds). */
export const getDevToken = () => {
  if (!IS_DEV) return null;
  try {
    return sessionStorage.getItem(DEV_TOKEN_KEY);
  } catch {
    return null;
  }
};

/** Save or clear (empty value) the dev token. No-op in production builds. */
export const setDevToken = (token) => {
  if (!IS_DEV) return;
  try {
    if (token) sessionStorage.setItem(DEV_TOKEN_KEY, token.trim());
    else sessionStorage.removeItem(DEV_TOKEN_KEY);
  } catch {
    // storage unavailable (private mode): the token just won't be remembered
  }
};

const request = (config) => {
  const headers = { 'X-Requested-With': 'XMLHttpRequest', ...config.headers };
  const token = getDevToken();
  const extra = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    // A dev token cannot be refreshed: skip the shared /auth/refresh retry so the real
    // 401 message is shown instead of the refresh error.
    extra._retry = true;
  }
  return api({ ...config, ...extra, headers });
};

/** Thin wrappers. Paths are relative to /api, e.g. donorApi.get('/donor/donations'). */
export const donorApi = {
  get: (url, params) => request({ method: 'get', url, params }),
  post: (url, data) => request({ method: 'post', url, data }),
  patch: (url, data) => request({ method: 'patch', url, data }),
  delete: (url) => request({ method: 'delete', url }),
};

// ---- Donations ----

/** POST /api/donor/donations with a body object. */
export const createDonation = (body) => donorApi.post('/donor/donations', body);

/**
 * POST /api/donor/donations with raw text sent exactly as typed (for testing attack
 * payloads and malformed JSON). Content-Type is still application/json.
 */
export const createDonationRaw = (text) =>
  request({
    method: 'post',
    url: '/donor/donations',
    data: text,
    headers: { 'Content-Type': 'application/json' },
    transformRequest: [(data) => data],
  });

/** GET /api/donor/donations. params: { page, limit, status, sort } (empty values dropped). */
export const listMyDonations = (params = {}) =>
  donorApi.get(
    '/donor/donations',
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  );

/** GET /api/donor/donations/:id */
export const getMyDonation = (id) => donorApi.get(`/donor/donations/${encodeURIComponent(id)}`);

const NOT_LOGGED_IN = IS_DEV
  ? 'Not logged in: no dev token is saved and there is no login session. Paste a token in the Dev Token panel on the Donor Dashboard (/donor).'
  : 'Your session has expired. Please log in again.';

/** Turn an axios error into a readable message plus the server's JSON body (if any). */
export const describeError = (err) => {
  // A 401 makes the shared axios instance try /auth/refresh; if that fails too, its
  // "No refresh token" error replaces the original one. Explain the real cause instead.
  if (err.config?.url?.includes('/auth/refresh')) {
    return { message: NOT_LOGGED_IN, status: 401, body: err.response?.data ?? null };
  }
  return {
    message: err.response?.data?.message || err.message || 'Request failed',
    status: err.response?.status ?? null,
    body: err.response?.data ?? null,
  };
};

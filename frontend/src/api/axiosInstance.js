import axios from 'axios';

// Shared API client. Auth uses httpOnly cookies, so send credentials on every request.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  // The backend's CSRF guard rejects POST/PATCH/DELETE without this header
  // (another website's form can't add it), so send it on every request.
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

// A 401 from these means "wrong password" / "no session", not "access token expired",
// so they must never trigger a refresh + retry.
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

// Event the AuthContext listens to, so the UI logs out when the session can't be renewed.
export const AUTH_EXPIRED_EVENT = 'auth:expired';

// Single in-flight refresh shared by all requests that fail with 401 at the same time.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const skipRefresh = NO_REFRESH_URLS.some((url) => original?.url?.startsWith(url));

    // On 401: call /auth/refresh once, then retry the original request.
    if (status === 401 && original && !original._retry && !skipRefresh) {
      original._retry = true;
      try {
        refreshPromise ??= api.post('/auth/refresh').finally(() => {
          refreshPromise = null;
        });
        await refreshPromise;
        return api(original);
      } catch (refreshError) {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

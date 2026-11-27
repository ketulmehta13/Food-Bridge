import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { AUTH_EXPIRED_EVENT } from '../../api/axiosInstance.js';
import { ROLES, USER_TYPES } from '../../constants/index.js';

/**
 * Holds "who is logged in" for the whole app.
 * Wrap the app in <AuthProvider>, then call useAuth() in any component:
 *   const { user, loading, login, register, logout } = useAuth();
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true until the first /users/me finishes

  // Ask the backend who we are (the cookie is sent automatically).
  const loadUser = useCallback(async () => {
    try {
      const res = await api.get('/users/me');
      setUser(res.data.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // On first load (and page refresh), restore the session from the cookies.
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // If the refresh token stops working (expired / logged out elsewhere), clear the user.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    setUser(res.data.data.user);
    return res.data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), login, register, logout, reloadUser: loadUser }),
    [user, loading, login, register, logout, loadUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Where each kind of user lands after logging in.
export const homePathFor = (user) => {
  if (!user) return '/';
  if (user.role === ROLES.ADMIN) return '/'; // TODO: '/admin' once the admin feature exists
  if (user.userType === USER_TYPES.NGO) return '/ngo';
  if (user.userType === USER_TYPES.DONOR) return '/donor';
  return '/';
};

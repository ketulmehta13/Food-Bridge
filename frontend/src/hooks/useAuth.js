import { useEffect, useState } from 'react';
import api from '../api/axiosInstance.js';

/**
 * Placeholder auth hook: fetches the current user from GET /users/me.
 * Will be replaced by a proper AuthContext when the auth feature is built.
 */
export default function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/users/me')
      .then((res) => active && setUser(res.data?.data ?? null))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { user, loading, isAuthenticated: Boolean(user), setUser };
}

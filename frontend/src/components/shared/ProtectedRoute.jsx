import { Navigate, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth.js';

/**
 * Guards a route.
 * - roles:     allowed roles, e.g. [ROLES.ADMIN]      (optional)
 * - userTypes: allowed user types, e.g. [USER_TYPES.NGO] (optional)
 * Usage: <Route path="/x" element={<ProtectedRoute roles={[...]}><Page /></ProtectedRoute>} />
 */
export default function ProtectedRoute({ children, roles, userTypes }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const roleOk = !roles?.length || roles.includes(user.role);
  const typeOk = !userTypes?.length || userTypes.includes(user.userType);
  if (!roleOk || !typeOk) {
    return <Navigate to="/" replace />;
  }

  return children;
}

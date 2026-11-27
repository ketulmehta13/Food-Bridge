import { Routes, Route } from 'react-router-dom';
import NgoDashboard from './pages/NgoDashboard.jsx';
// import ProtectedRoute from '../../components/shared/ProtectedRoute.jsx';
// import { USER_TYPES } from '../../constants/index.js';

// All NGO pages live under /ngo/*. Owner: Ketul.
// Add NGO pages here only; App.jsx does not need to change.
export default function NgoRoutes() {
  const routes = (
    <Routes>
      <Route index element={<NgoDashboard />} />
      {/* <Route path="donations" element={<BrowseDonations />} /> */}
      {/* <Route path="claims" element={<MyClaims />} /> */}
    </Routes>
  );

  // TODO: enable once auth (/auth + /users/me) is merged into main:
  // return <ProtectedRoute userTypes={[USER_TYPES.NGO]}>{routes}</ProtectedRoute>;
  return routes;
}

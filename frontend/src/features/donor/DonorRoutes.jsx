import { Routes, Route } from 'react-router-dom';
import DonorDashboard from './pages/DonorDashboard.jsx';
// import ProtectedRoute from '../../components/shared/ProtectedRoute.jsx';
// import { USER_TYPES } from '../../constants/index.js';

// All donor pages live under /donor/*. Owner: Jay.
// Add donor pages here only; App.jsx does not need to change.
export default function DonorRoutes() {
  const routes = (
    <Routes>
      <Route index element={<DonorDashboard />} />
      {/* <Route path="donations/new" element={<CreateDonation />} /> */}
      {/* <Route path="donations" element={<MyDonations />} /> */}
    </Routes>
  );

  // TODO: enable once auth (/auth + /users/me) is merged into main:
  // return <ProtectedRoute userTypes={[USER_TYPES.DONOR]}>{routes}</ProtectedRoute>;
  return routes;
}

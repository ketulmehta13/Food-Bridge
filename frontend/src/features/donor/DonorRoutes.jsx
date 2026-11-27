import { Routes, Route } from 'react-router-dom';
import DonorDashboard from './pages/DonorDashboard.jsx';
import CreateDonationPage from './pages/CreateDonationPage.jsx';
import MyDonationsPage from './pages/MyDonationsPage.jsx';
import DonationDetailPage from './pages/DonationDetailPage.jsx';
import EditDonationPage from './pages/EditDonationPage.jsx';
// import ProtectedRoute from '../../components/shared/ProtectedRoute.jsx';
// import { USER_TYPES } from '../../constants/index.js';

// All donor pages live under /donor/*. Owner: Jay.
// Add donor pages here only; App.jsx does not need to change.
export default function DonorRoutes() {
  const routes = (
    <Routes>
      <Route index element={<DonorDashboard />} />
      <Route path="donations" element={<MyDonationsPage />} />
      <Route path="donations/new" element={<CreateDonationPage />} />
      <Route path="donations/:id" element={<DonationDetailPage />} />
      <Route path="donations/:id/edit" element={<EditDonationPage />} />
    </Routes>
  );

  // TODO: enable once auth (/auth + /users/me) is merged into main:
  // return <ProtectedRoute userTypes={[USER_TYPES.DONOR]}>{routes}</ProtectedRoute>;
  return routes;
}

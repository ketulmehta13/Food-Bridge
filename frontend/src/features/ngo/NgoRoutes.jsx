import { Routes, Route } from 'react-router-dom';
import NgoDashboard from './pages/NgoDashboard.jsx';
import ProtectedRoute from '../../components/shared/ProtectedRoute.jsx';
import { USER_TYPES } from '../../constants/index.js';

// All NGO pages live under /ngo/*. Owner: Ketul.
// Add NGO pages here only; App.jsx does not need to change.
export default function NgoRoutes() {
  return (
    // Only logged-in NGO accounts can open any /ngo page.
    <ProtectedRoute userTypes={[USER_TYPES.NGO]}>
      <Routes>
        <Route index element={<NgoDashboard />} />
        {/* <Route path="donations" element={<BrowseDonations />} /> */}
        {/* <Route path="claims" element={<MyClaims />} /> */}
      </Routes>
    </ProtectedRoute>
  );
}

import { Routes, Route } from 'react-router-dom';
import NgoLayout from './components/NgoLayout.jsx';
import NgoDashboard from './pages/NgoDashboard.jsx';
import NgoProfile from './pages/NgoProfile.jsx';
import ProtectedRoute from '../../components/shared/ProtectedRoute.jsx';
import { USER_TYPES } from '../../constants/index.js';

// All NGO pages live under /ngo/*. Owner: Ketul.
// Add NGO pages here only; App.jsx does not need to change.
export default function NgoRoutes() {
  return (
    // Only logged-in NGO accounts can open any /ngo page.
    <ProtectedRoute userTypes={[USER_TYPES.NGO]}>
      <Routes>
        {/* NgoLayout draws the top bar; the matching page renders inside it. */}
        <Route element={<NgoLayout />}>
          <Route index element={<NgoDashboard />} />
          <Route path="profile" element={<NgoProfile />} />
          {/* <Route path="donations" element={<BrowseDonations />} /> */}
          {/* <Route path="claims" element={<MyClaims />} /> */}
        </Route>
      </Routes>
    </ProtectedRoute>
  );
}

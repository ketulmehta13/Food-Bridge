import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './features/auth/pages/Login.jsx';
import Register from './features/auth/pages/Register.jsx';
import NgoRoutes from './features/ngo/NgoRoutes.jsx';
import DonorRoutes from './features/donor/DonorRoutes.jsx';

// Top-level routes only. Each feature adds its own pages in its own
// *Routes.jsx file, so this file rarely changes (avoids merge conflicts).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/ngo/*" element={<NgoRoutes />} />
      <Route path="/donor/*" element={<DonorRoutes />} />
      {/* Still to add when built: /admin/* */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

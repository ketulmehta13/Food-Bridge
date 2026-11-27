import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// Feature routes (auth, donor, ngo, admin) get added here, wrapped in
// <ProtectedRoute roles={[...]} userTypes={[...]}> where needed.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

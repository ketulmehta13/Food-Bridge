import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import VerificationBanner from '../components/VerificationBanner.jsx';

// NGO landing page (/ngo). Placeholder until browse/claim features are built.
export default function NgoDashboard() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-dark">{user.ngoProfile?.orgName}</h1>
      <p className="mt-1 text-gray-600">Welcome, {user.name}</p>

      <VerificationBanner user={user} className="mt-6" />

      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="font-semibold text-gray-900">Your organisation profile</h2>
        <p className="mt-1 text-sm text-gray-600">
          Keep your contact details, location and service radius up to date so donors can reach you.
        </p>
        <Link
          to="/ngo/profile"
          className="mt-3 inline-block text-sm font-semibold text-brand-dark hover:underline"
        >
          View / edit profile →
        </Link>
      </div>

      <p className="mt-8 text-gray-500">Browse donations and your claims will appear here.</p>
    </main>
  );
}

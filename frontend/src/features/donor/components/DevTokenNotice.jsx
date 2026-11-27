import { Link } from 'react-router-dom';
import { getDevToken } from '../api/donor.api.js';

/**
 * Development-only warning shown on donor pages when no dev token is saved,
 * so requests would go out without a login. Renders nothing in production builds.
 */
export default function DevTokenNotice() {
  if (!import.meta.env.DEV || getDevToken()) return null;

  return (
    <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      No dev token saved, so requests are not logged in.{' '}
      <Link to="/donor" className="font-medium underline">
        Paste a token in the Dev Token panel on the Donor Dashboard
      </Link>{' '}
      (run <code>npm run dev:users</code> in <code>backend/</code> to get one).
    </div>
  );
}

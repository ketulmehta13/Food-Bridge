import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosInstance.js';
import { useAuth, homePathFor } from '../features/auth/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';

// Landing page: login/register links (or dashboard link when logged in) + API health check.
export default function Home() {
  const { user, loading, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/health')
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.message || 'Could not reach the API'));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-bold text-brand-dark">FoodBridge</h1>
      <p className="text-gray-600">Connecting surplus food with the people who need it.</p>

      {!loading && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-gray-600">Logged in as {user.name}</span>
              <Link
                to={homePathFor(user)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Go to dashboard
              </Link>
              <Button variant="secondary" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-800 ring-1 ring-gray-300 hover:bg-gray-50"
              >
                Register
              </Link>
            </>
          )}
        </div>
      )}

      <section className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          API health
        </h2>
        {error && <p className="text-red-600">{error}</p>}
        {!error && !health && <p className="text-gray-500">Checking...</p>}
        {health && (
          <pre className="overflow-x-auto text-sm text-gray-800">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}

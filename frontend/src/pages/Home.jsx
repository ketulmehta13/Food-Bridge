import { useEffect, useState } from 'react';
import api from '../api/axiosInstance.js';

// Landing page. For now it just pings GET /api/health to confirm the API is reachable.
export default function Home() {
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

import { useState } from 'react';
import { donorApi, getDevToken, setDevToken, describeError } from '../api/donor.api.js';

// Decode the JWT payload for display only (no verification; the server does that).
const decodePayload = (token) => {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(part));
  } catch {
    return null;
  }
};

/**
 * Development-only panel: paste an access token from `npm run dev:users`.
 * The token is kept in sessionStorage and sent as a Bearer token by donor.api.js.
 * Renders nothing in production builds.
 */
export default function DevTokenPanel() {
  const [input, setInput] = useState(() => getDevToken() ?? '');
  const [saved, setSaved] = useState(() => getDevToken());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!import.meta.env.DEV) return null;

  const payload = saved ? decodePayload(saved) : null;

  const save = () => {
    setDevToken(input);
    setSaved(getDevToken());
    setResult(null);
    setError(null);
  };

  const clear = () => {
    setDevToken('');
    setInput('');
    setSaved(null);
    setResult(null);
    setError(null);
  };

  // GET /api/donor/ has no endpoint yet: a 404 means the token passed every donor check.
  const check = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await donorApi.get('/donor/');
      setResult({ status: res.status, body: res.data });
    } catch (err) {
      const e = describeError(err);
      if (e.status === 404) setResult({ status: 404, note: 'Token accepted by the donor router', body: e.body });
      else setError(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
        Dev token (development only)
      </h2>
      <p className="mt-1 text-sm text-amber-900">
        Run <code>npm run dev:users</code> in <code>backend/</code> and paste a token.
      </p>

      <textarea
        className="mt-3 w-full rounded border border-gray-300 bg-white p-2 font-mono text-xs"
        rows={3}
        placeholder="eyJhbGciOi..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!input.trim()}
          className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Save token
        </button>
        <button
          type="button"
          onClick={clear}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={check}
          disabled={loading}
          className="rounded border border-amber-600 bg-white px-3 py-1.5 text-sm text-amber-800 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check token'}
        </button>
      </div>

      {saved && (
        <div className="mt-3 text-sm">
          <p className="font-medium text-gray-700">Saved token payload:</p>
          {payload ? (
            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs">
              {JSON.stringify(
                { ...payload, expires: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : null },
                null,
                2
              )}
            </pre>
          ) : (
            <p className="text-red-600">This does not look like a JWT.</p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm">
          <p className="text-red-600">
            {error.status ? `${error.status}: ` : ''}
            {error.message}
          </p>
          {error.body && (
            <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs">
              {JSON.stringify(error.body, null, 2)}
            </pre>
          )}
        </div>
      )}

      {result && (
        <div className="mt-3 text-sm">
          <p className="text-green-700">
            {result.status}
            {result.note ? `: ${result.note}` : ''}
          </p>
          <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs">
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

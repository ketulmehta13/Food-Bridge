import { useState } from 'react';
import { sendRaw, describeError } from '../api/donor.api.js';
import ApiResult from './ApiResult.jsx';

/**
 * Send any request exactly as typed (for trying attack payloads and broken JSON).
 * presets: [{ label, method, path, body? }] — path is relative to /api, e.g. "/donor/donations".
 * getFormBody: optional () => object, adds a "Copy form into body" button.
 */
export default function RawRequestPanel({ presets = [], getFormBody }) {
  const first = presets[0] ?? { method: 'GET', path: '/donor/donations' };
  const [method, setMethod] = useState(first.method);
  const [path, setPath] = useState(first.path);
  const [body, setBody] = useState(first.body ? JSON.stringify(first.body, null, 2) : '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);

  const applyPreset = (p) => {
    setMethod(p.method);
    setPath(p.path);
    setBody(p.body ? JSON.stringify(p.body, null, 2) : '');
  };

  const send = async () => {
    setLoading(true);
    setData(undefined);
    setError(null);
    try {
      const res = await sendRaw({ method, url: path, text: method === 'GET' ? undefined : body });
      setData({ status: res.status, ...res.data });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-semibold text-red-800">Raw request (sent exactly as typed)</h2>
      <p className="text-xs text-red-800">
        Try forbidden fields (<code>"status"</code>, <code>"donor"</code>), operators, someone else's id, or broken JSON.
      </p>

      {presets.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.label} type="button" onClick={() => applyPreset(p)} className="rounded border border-red-300 bg-white px-2 py-1 text-xs">
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
          {['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
        </select>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="flex-1 rounded border border-gray-300 bg-white px-2 py-1 font-mono text-sm"
          placeholder="/donor/donations"
        />
      </div>

      {method !== 'GET' && (
        <textarea
          className="mt-2 w-full rounded border border-gray-300 bg-white p-2 font-mono text-xs"
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder='{ "reason": "..." }'
        />
      )}

      <div className="mt-2 flex gap-2">
        {getFormBody && (
          <button type="button" onClick={() => setBody(JSON.stringify(getFormBody(), null, 2))} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm">
            Copy form into body
          </button>
        )}
        <button type="button" disabled={loading || !path} onClick={send} className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {loading ? 'Sending...' : 'Send raw'}
        </button>
      </div>

      <ApiResult loading={loading} error={error} data={data} title="Raw response" />
    </section>
  );
}

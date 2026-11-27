import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyDonations, describeError } from '../api/donor.api.js';
import ApiResult from '../components/ApiResult.jsx';
import DevTokenNotice from '../components/DevTokenNotice.jsx';
import RawRequestPanel from '../components/RawRequestPanel.jsx';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import { DONATION_STATUS } from '../../../constants/index.js';
import { formatDateTime } from '../utils/datetime.js';

// Test page: list my donations (/donor/donations).

const SORTS = [
  ['-createdAt', 'Newest first'],
  ['createdAt', 'Oldest first'],
  ['bestBefore', 'Expiring soonest'],
  ['-bestBefore', 'Expiring latest'],
];
const PAGE_SIZE = 10;

const selectCls = 'rounded border border-gray-300 px-2 py-1 text-sm';

export default function MyDonationsPage() {
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listMyDonations({ page, limit: PAGE_SIZE, status, sort })
      .then((res) => active && setData(res.data))
      .catch((err) => active && (setError(describeError(err)), setData(undefined)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, status, sort]);

  const items = data?.data?.items ?? [];
  const pagination = data?.data?.pagination;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/donor" className="text-sm text-blue-700 hover:underline">← Donor dashboard</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">My donations</h1>
        <Link to="/donor/donations/new" className="rounded bg-green-700 px-3 py-1.5 text-sm text-white">
          + Post donation
        </Link>
      </div>
      <DevTokenNotice />

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <label>Status{' '}
          <select className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {Object.values(DONATION_STATUS).map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Sort{' '}
          <select className={selectCls} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2">Posted</th>
              <th className="px-3 py-2">Items</th>
              <th className="px-3 py-2">Servings</th>
              <th className="px-3 py-2">Best before</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No donations.</td></tr>
            )}
            {items.map((d) => (
              <tr key={d._id} className="border-t border-gray-100">
                <td className="px-3 py-2">{formatDateTime(d.createdAt)}</td>
                <td className="px-3 py-2">{d.items.map((i) => i.name).join(', ')}</td>
                <td className="px-3 py-2">{d.totalServings}</td>
                <td className="px-3 py-2">{formatDateTime(d.bestBefore)}</td>
                <td className="px-3 py-2"><StatusBadge status={d.status} /></td>
                <td className="px-3 py-2">
                  <Link to={`/donor/donations/${d._id}`} className="text-blue-700 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            Prev
          </button>
          <span>Page {pagination.page} of {Math.max(pagination.totalPages, 1)} ({pagination.total} total)</span>
          <button disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      <ApiResult loading={loading} error={error} data={data} />

      <RawRequestPanel
        presets={[
          { label: 'GET list', method: 'GET', path: '/donor/donations?limit=5&sort=-createdAt' },
          { label: 'GET status[$ne]', method: 'GET', path: '/donor/donations?status[$ne]=X' },
          { label: 'GET limit=51', method: 'GET', path: '/donor/donations?limit=51' },
        ]}
      />
    </main>
  );
}

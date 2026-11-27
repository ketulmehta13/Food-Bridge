import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getMyDonation, describeError } from '../api/donor.api.js';
import ApiResult from '../components/ApiResult.jsx';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import { SAFETY_CHECKS } from '../donor.constants.js';
import { formatDateTime } from '../utils/datetime.js';

// Test page: one of my donations (/donor/donations/:id).

const Row = ({ label, children }) => (
  <div className="grid grid-cols-3 gap-2 border-t border-gray-100 py-1.5 text-sm">
    <dt className="text-gray-500">{label}</dt>
    <dd className="col-span-2">{children ?? '—'}</dd>
  </div>
);

export default function DonationDetailPage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getMyDonation(id)
      .then((res) => active && setData(res.data))
      .catch((err) => active && (setError(describeError(err)), setData(undefined)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const d = data?.data?.donation;
  const history = data?.data?.history ?? [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/donor/donations" className="text-sm text-blue-700 hover:underline">← My donations</Link>

      {d && (
        <>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold">Donation</h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="font-mono text-xs text-gray-500">{d._id}</p>

          {d.claimedBy && (
            <section className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm">
              <h2 className="font-semibold text-blue-900">Claimed by</h2>
              <p>{d.claimedBy.orgName ?? '—'} ({d.claimedBy.name})</p>
              <p>Phone: {d.claimedBy.phone ?? '—'}</p>
              {d.claimedAt && <p>Claimed at: {formatDateTime(d.claimedAt)}</p>}
            </section>
          )}

          <dl className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <Row label="Items">
              <ul>
                {d.items.map((i, idx) => <li key={idx}>{i.name}: {i.quantity} {i.unit}</li>)}
              </ul>
            </Row>
            <Row label="Servings / weight">{d.totalServings} servings, {d.estimatedWeightKg} kg</Row>
            <Row label="Type / category">{d.foodType} / {d.category}</Row>
            <Row label="Prepared at">{formatDateTime(d.preparedAt)}</Row>
            <Row label="Pickup window">
              {formatDateTime(d.pickupWindow?.start)} → {formatDateTime(d.pickupWindow?.end)}
            </Row>
            <Row label="Best before">{formatDateTime(d.bestBefore)}</Row>
            <Row label="Address">
              {[d.address?.line1, d.address?.city, d.address?.state, d.address?.pincode].filter(Boolean).join(', ')}
            </Row>
            <Row label="Location (lat, lng)">
              {d.location?.coordinates ? `${d.location.coordinates[1]}, ${d.location.coordinates[0]}` : null}
            </Row>
            <Row label="Contact phone">{d.contactPhone}</Row>
            <Row label="Safety checklist">
              {SAFETY_CHECKS.map(([key, label]) => (
                <div key={key}>{d.safetyChecklist?.[key] ? '✔' : '✖'} {label}</div>
              ))}
            </Row>
            <Row label="Allergen info">{d.allergenInfo}</Row>
            <Row label="Notes">{d.notes}</Row>
            <Row label="Photos">{d.photos?.length ? `${d.photos.length} photo(s)` : null}</Row>
            {d.cancelReason && <Row label="Cancel reason">{d.cancelReason}</Row>}
            <Row label="Posted">{formatDateTime(d.createdAt)}</Row>
          </dl>

          <section className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <h2 className="font-semibold">History</h2>
            {history.length === 0 ? (
              <p className="text-gray-500">No claim activity yet.</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {history.map((h, i) => (
                  <li key={i}>
                    <span className="text-gray-500">{formatDateTime(h.at)}</span>{' '}
                    <b>{h.action.replace(/_/g, ' ')}</b>
                    {h.reason && <span>: {h.reason}</span>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      <ApiResult loading={loading} error={error} data={data} />
    </main>
  );
}

import { useState } from 'react';
import { cancelDonation, describeError } from '../api/donor.api.js';
import ApiResult from './ApiResult.jsx';
import { DONATION_STATUS } from '../../../constants/index.js';

/**
 * Cancel box for the detail page (shown while AVAILABLE or CLAIMED).
 * The reason is marked required when CLAIMED; the server enforces it either way.
 * onCancelled() is called after a successful cancel so the page can reload.
 */
export default function CancelDonationBox({ donationId, status, onCancelled }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const claimed = status === DONATION_STATUS.CLAIMED;

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm('Cancel this donation? This cannot be undone.')) return;
    setLoading(true);
    setError(null);
    try {
      await cancelDonation(donationId, reason.trim() ? { reason } : {});
      setReason('');
      onCancelled();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-4 rounded-lg border border-red-200 bg-white p-4 text-sm">
      <h2 className="font-semibold text-red-800">Cancel donation</h2>
      {claimed && (
        <p className="mt-1 text-red-700">An NGO has claimed this food. A reason is required and the NGO will see it.</p>
      )}
      <form onSubmit={submit} className="mt-2 flex flex-wrap gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={claimed ? 'Reason (required, 5–300 characters)' : 'Reason (optional)'}
          className="min-w-64 flex-1 rounded border border-gray-300 px-2 py-1"
        />
        <button type="submit" disabled={loading} className="rounded bg-red-700 px-3 py-1.5 text-white disabled:opacity-50">
          {loading ? 'Cancelling...' : 'Cancel donation'}
        </button>
      </form>
      <ApiResult loading={false} error={error} data={undefined} title="Cancel error" />
    </section>
  );
}

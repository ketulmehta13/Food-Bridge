import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMyDonation, updateDonation, describeError } from '../api/donor.api.js';
import ApiResult from '../components/ApiResult.jsx';
import DevTokenNotice from '../components/DevTokenNotice.jsx';
import DonationForm, { toFieldErrors } from '../components/DonationForm.jsx';
import RawRequestPanel from '../components/RawRequestPanel.jsx';
import StatusBadge from '../../../components/shared/StatusBadge.jsx';
import { DONATION_STATUS } from '../../../constants/index.js';
import { donationToForm, buildBody, changedFields } from '../utils/donationForm.js';

// Test page: edit one of my donations (/donor/donations/:id/edit). Sends only changed fields.
export default function EditDonationPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(null);
  const [initialBody, setInitialBody] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(undefined);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMyDonation(id)
      .then((res) => {
        if (!active) return;
        const d = res.data.data.donation;
        const loaded = donationToForm(d);
        setStatus(d.status);
        setForm(loaded);
        setInitialBody(buildBody(loaded, { forEdit: true }));
      })
      .catch((err) => active && setError(describeError(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const changes = form && initialBody ? changedFields(initialBody, buildBody(form, { forEdit: true })) : {};

  const submit = async () => {
    setNotice('');
    setError(null);
    setResult(undefined);
    if (Object.keys(changes).length === 0) {
      setNotice('Nothing changed.');
      return;
    }
    setSaving(true);
    try {
      const res = await updateDonation(id, changes);
      setResult(res.data);
      navigate(`/donor/donations/${id}`);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to={`/donor/donations/${id}`} className="text-sm text-blue-700 hover:underline">← Back to donation</Link>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Edit donation</h1>
        {status && <StatusBadge status={status} />}
      </div>
      <DevTokenNotice />

      {status && status !== DONATION_STATUS.AVAILABLE && (
        <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Only AVAILABLE donations can be edited; saving will return 409.
        </p>
      )}

      {form && (
        <>
          <p className="mt-2 text-sm text-gray-600">
            Fields that will be sent:{' '}
            <code>{Object.keys(changes).length ? Object.keys(changes).join(', ') : 'none yet'}</code>
          </p>
          <DonationForm
            form={form}
            setForm={setForm}
            fieldErrors={toFieldErrors(error)}
            showSafety={false}
            onSubmit={submit}
            submitLabel="Save changes"
            loading={saving}
          />
        </>
      )}

      {notice && <p className="mt-3 text-sm text-gray-700">{notice}</p>}
      <ApiResult loading={loading || saving} error={error} data={result} />

      <RawRequestPanel
        presets={[
          { label: 'PATCH changed fields', method: 'PATCH', path: `/donor/donations/${id}`, body: changes },
          { label: 'PATCH forbidden status', method: 'PATCH', path: `/donor/donations/${id}`, body: { status: 'DISTRIBUTED' } },
        ]}
        getFormBody={() => changes}
      />
    </main>
  );
}

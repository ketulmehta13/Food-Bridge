import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createDonation, describeError } from '../api/donor.api.js';
import ApiResult from '../components/ApiResult.jsx';
import DevTokenNotice from '../components/DevTokenNotice.jsx';
import DonationForm, { toFieldErrors } from '../components/DonationForm.jsx';
import RawRequestPanel from '../components/RawRequestPanel.jsx';
import { sampleForm, buildBody } from '../utils/donationForm.js';

// Test page: post a donation (/donor/donations/new). Pre-filled so one click submits.
export default function CreateDonationPage() {
  const [form, setForm] = useState(sampleForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(undefined);
  const [error, setError] = useState(null);

  const submit = async () => {
    setLoading(true);
    setResult(undefined);
    setError(null);
    try {
      const res = await createDonation(buildBody(form));
      setResult(res.data);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const createdId = result?.data?._id;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link to="/donor" className="text-sm text-blue-700 hover:underline">← Donor dashboard</Link>
      <h1 className="mt-2 text-2xl font-bold">Post a donation</h1>
      <p className="text-sm text-gray-600">
        Pre-filled with sample values; times are relative to now. Click <b>Post donation</b> to submit.
      </p>
      <DevTokenNotice />

      <DonationForm
        form={form}
        setForm={setForm}
        fieldErrors={toFieldErrors(error)}
        onSubmit={submit}
        submitLabel="Post donation"
        loading={loading}
        extraButtons={
          <button type="button" onClick={() => setForm(sampleForm())} className="rounded border border-gray-300 px-4 py-2 text-sm">
            Reset sample (fresh times)
          </button>
        }
      />

      {createdId && (
        <p className="mt-4 text-sm text-green-700">
          Posted. <Link className="underline" to={`/donor/donations/${createdId}`}>Open the donation</Link>
        </p>
      )}
      <ApiResult loading={loading} error={error} data={result} />

      <RawRequestPanel
        presets={[{ label: 'POST create', method: 'POST', path: '/donor/donations' }]}
        getFormBody={() => buildBody(form)}
      />
    </main>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createDonation, createDonationRaw, describeError } from '../api/donor.api.js';
import ApiResult from '../components/ApiResult.jsx';
import DevTokenNotice from '../components/DevTokenNotice.jsx';
import { FOOD_TYPES, FOOD_CATEGORIES, FOOD_UNITS, SAFETY_CHECKS } from '../donor.constants.js';
import { DONATION_LIMITS } from '../../../constants/index.js';
import { fromLocalInput, localInputFromNow } from '../utils/datetime.js';

// Test page: post a donation (/donor/donations/new). Pre-filled so one click submits.

const sampleForm = () => ({
  items: [
    { name: 'Veg biryani', quantity: '5', unit: FOOD_UNITS.KG },
    { name: 'Rotis', quantity: '40', unit: FOOD_UNITS.PIECES },
  ],
  totalServings: '30',
  estimatedWeightKg: '7.5',
  foodType: FOOD_TYPES.VEG,
  category: FOOD_CATEGORIES.COOKED,
  preparedAt: localInputFromNow(-30),
  pickupStart: localInputFromNow(60),
  pickupEnd: localInputFromNow(180),
  bestBefore: localInputFromNow(300),
  lat: '23.0225',
  lng: '72.5714',
  line1: '12 CG Road, Navrangpura',
  city: 'Ahmedabad',
  state: 'Gujarat',
  pincode: '380009',
  contactPhone: '',
  safetyChecklist: Object.fromEntries(SAFETY_CHECKS.map(([key]) => [key, true])),
  allergenInfo: '',
  notes: '',
});

// Numbers are sent as numbers (the API rejects numeric strings); empty optionals are omitted.
const toNumber = (v) => (v === '' ? v : Number(v));

const buildBody = (f) => ({
  items: f.items.map((i) => ({ name: i.name, quantity: toNumber(i.quantity), unit: i.unit })),
  totalServings: toNumber(f.totalServings),
  estimatedWeightKg: toNumber(f.estimatedWeightKg),
  foodType: f.foodType,
  category: f.category,
  preparedAt: fromLocalInput(f.preparedAt),
  bestBefore: fromLocalInput(f.bestBefore),
  pickupWindow: { start: fromLocalInput(f.pickupStart), end: fromLocalInput(f.pickupEnd) },
  location: { lat: toNumber(f.lat), lng: toNumber(f.lng) },
  address: { line1: f.line1, city: f.city, state: f.state, pincode: f.pincode },
  ...(f.contactPhone && { contactPhone: f.contactPhone }),
  safetyChecklist: f.safetyChecklist,
  ...(f.allergenInfo && { allergenInfo: f.allergenInfo }),
  ...(f.notes && { notes: f.notes }),
});

const inputCls = 'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm';

export default function CreateDonationPage() {
  const [form, setForm] = useState(sampleForm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(undefined);
  const [error, setError] = useState(null);
  const [raw, setRaw] = useState('');
  const [locating, setLocating] = useState(false);

  // field path (e.g. "items.0.name") -> message, from the API's errors[]
  const fieldErrors = Object.fromEntries(
    (error?.body?.errors ?? []).filter((e) => e.field).map((e) => [e.field, e.message])
  );
  const Err = ({ field }) =>
    fieldErrors[field] ? <p className="mt-0.5 text-xs text-red-600">{fieldErrors[field]}</p> : null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setItem = (index, key) => (e) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [key]: e.target.value } : it)),
    }));
  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { name: '', quantity: '1', unit: FOOD_UNITS.KG }] }));
  const removeItem = (index) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  const toggleCheck = (key) =>
    setForm((f) => ({ ...f, safetyChecklist: { ...f.safetyChecklist, [key]: !f.safetyChecklist[key] } }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((f) => ({ ...f, lat: coords.latitude.toFixed(6), lng: coords.longitude.toFixed(6) }));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const run = async (call) => {
    setLoading(true);
    setResult(undefined);
    setError(null);
    try {
      const res = await call();
      setResult(res.data);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    run(() => createDonation(buildBody(form)));
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

      <form onSubmit={submit} className="mt-6 space-y-6">
        {/* Items */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-1 text-sm font-semibold">
            Items (1–{DONATION_LIMITS.MAX_ITEMS})
          </legend>
          <Err field="items" />
          {form.items.map((item, i) => (
            <div key={i} className="mt-2 grid grid-cols-12 gap-2">
              <div className="col-span-6">
                <input className={inputCls} placeholder="Name" value={item.name} onChange={setItem(i, 'name')} />
                <Err field={`items.${i}.name`} />
              </div>
              <div className="col-span-2">
                <input className={inputCls} type="number" step="any" value={item.quantity} onChange={setItem(i, 'quantity')} />
                <Err field={`items.${i}.quantity`} />
              </div>
              <div className="col-span-3">
                <select className={inputCls} value={item.unit} onChange={setItem(i, 'unit')}>
                  {Object.values(FOOD_UNITS).map((u) => <option key={u}>{u}</option>)}
                </select>
                <Err field={`items.${i}.unit`} />
              </div>
              <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-sm text-red-600">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addItem} className="mt-2 text-sm text-blue-700">+ Add item</button>
        </fieldset>

        {/* Quantities and type */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <label className="text-sm">Total servings
            <input className={inputCls} type="number" value={form.totalServings} onChange={set('totalServings')} />
            <Err field="totalServings" />
          </label>
          <label className="text-sm">Weight (kg)
            <input className={inputCls} type="number" step="any" value={form.estimatedWeightKg} onChange={set('estimatedWeightKg')} />
            <Err field="estimatedWeightKg" />
          </label>
          <label className="text-sm">Food type
            <select className={inputCls} value={form.foodType} onChange={set('foodType')}>
              {Object.values(FOOD_TYPES).map((v) => <option key={v}>{v}</option>)}
            </select>
            <Err field="foodType" />
          </label>
          <label className="text-sm">Category
            <select className={inputCls} value={form.category} onChange={set('category')}>
              {Object.values(FOOD_CATEGORIES).map((v) => <option key={v}>{v}</option>)}
            </select>
            <Err field="category" />
          </label>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <label className="text-sm">Prepared at
            <input className={inputCls} type="datetime-local" value={form.preparedAt} onChange={set('preparedAt')} />
            <Err field="preparedAt" />
          </label>
          <label className="text-sm">Pickup from
            <input className={inputCls} type="datetime-local" value={form.pickupStart} onChange={set('pickupStart')} />
            <Err field="pickupWindow.start" />
          </label>
          <label className="text-sm">Pickup until
            <input className={inputCls} type="datetime-local" value={form.pickupEnd} onChange={set('pickupEnd')} />
            <Err field="pickupWindow.end" />
          </label>
          <label className="text-sm">Best before
            <input className={inputCls} type="datetime-local" value={form.bestBefore} onChange={set('bestBefore')} />
            <Err field="bestBefore" />
          </label>
        </div>

        {/* Location and address */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <label className="text-sm">Latitude
            <input className={inputCls} type="number" step="any" value={form.lat} onChange={set('lat')} />
            <Err field="location.lat" />
          </label>
          <label className="text-sm">Longitude
            <input className={inputCls} type="number" step="any" value={form.lng} onChange={set('lng')} />
            <Err field="location.lng" />
          </label>
          <div className="col-span-2 flex items-end">
            <button type="button" onClick={useMyLocation} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
              {locating ? 'Locating...' : 'Use my location'}
            </button>
          </div>
          <label className="col-span-2 text-sm">Address line
            <input className={inputCls} value={form.line1} onChange={set('line1')} />
            <Err field="address.line1" />
          </label>
          <label className="text-sm">City
            <input className={inputCls} value={form.city} onChange={set('city')} />
            <Err field="address.city" />
          </label>
          <label className="text-sm">State
            <input className={inputCls} value={form.state} onChange={set('state')} />
            <Err field="address.state" />
          </label>
          <label className="text-sm">Pincode
            <input className={inputCls} value={form.pincode} onChange={set('pincode')} />
            <Err field="address.pincode" />
          </label>
          <label className="text-sm">Contact phone (optional)
            <input className={inputCls} placeholder="defaults to your phone" value={form.contactPhone} onChange={set('contactPhone')} />
            <Err field="contactPhone" />
          </label>
        </div>

        {/* Safety */}
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-1 text-sm font-semibold">Safety checklist</legend>
          <div className="grid grid-cols-2 gap-2">
            {SAFETY_CHECKS.map(([key, label]) => (
              <label key={key} className="text-sm">
                <input type="checkbox" checked={form.safetyChecklist[key]} onChange={() => toggleCheck(key)} /> {label}
                <Err field={`safetyChecklist.${key}`} />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">Allergen info (optional)
            <input className={inputCls} value={form.allergenInfo} onChange={set('allergenInfo')} />
            <Err field="allergenInfo" />
          </label>
          <label className="text-sm">Notes (optional)
            <input className={inputCls} value={form.notes} onChange={set('notes')} />
            <Err field="notes" />
          </label>
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">
            {loading ? 'Posting...' : 'Post donation'}
          </button>
          <button type="button" onClick={() => setForm(sampleForm())} className="rounded border border-gray-300 px-4 py-2 text-sm">
            Reset sample (fresh times)
          </button>
        </div>
      </form>

      {createdId && (
        <p className="mt-4 text-sm text-green-700">
          Posted. <Link className="underline" to={`/donor/donations/${createdId}`}>Open the donation</Link>
        </p>
      )}
      <ApiResult loading={loading} error={error} data={result} />

      {/* Raw request for attack testing */}
      <section className="mt-10 rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-800">Raw JSON request (sent exactly as typed)</h2>
        <p className="text-xs text-red-800">
          Try forbidden fields (<code>"status"</code>, <code>"donor"</code>), operators, or broken JSON.
        </p>
        <textarea
          className="mt-2 w-full rounded border border-gray-300 bg-white p-2 font-mono text-xs"
          rows={12}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='{ "items": [...] }'
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setRaw(JSON.stringify(buildBody(form), null, 2))}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          >
            Copy form into raw
          </button>
          <button
            type="button"
            disabled={loading || !raw}
            onClick={() => run(() => createDonationRaw(raw))}
            className="rounded bg-red-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Send raw
          </button>
        </div>
      </section>
    </main>
  );
}

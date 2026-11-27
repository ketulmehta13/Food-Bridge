import { FOOD_TYPES, FOOD_CATEGORIES, FOOD_UNITS, SAFETY_CHECKS } from '../donor.constants.js';
import { DONATION_LIMITS } from '../../../constants/index.js';
import { useState } from 'react';

// Donation form shared by the create and edit pages. The parent owns the state.
// fieldErrors: { "items.0.name": "message", ... } from the API's errors[].

const inputCls = 'mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm';

export default function DonationForm({
  form,
  setForm,
  fieldErrors = {},
  showSafety = true,
  onSubmit,
  submitLabel,
  loading,
  extraButtons = null,
}) {
  const [locating, setLocating] = useState(false);

  const err = (field) =>
    fieldErrors[field] ? <p className="mt-0.5 text-xs text-red-600">{fieldErrors[field]}</p> : null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setItem = (index, key) => (e) =>
    setForm((f) => ({
      ...f,
      items: f.items.map((it, i) => (i === index ? { ...it, [key]: e.target.value } : it)),
    }));
  const addItem = () =>
    setForm((f) => ({ ...f, items: [...f.items, { name: '', quantity: '1', unit: FOOD_UNITS.KG }] }));
  const removeItem = (index) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
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

  const submit = (e) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-6">
      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-semibold">Items (1–{DONATION_LIMITS.MAX_ITEMS})</legend>
        {err('items')}
        {form.items.map((item, i) => (
          <div key={i} className="mt-2 grid grid-cols-12 gap-2">
            <div className="col-span-6">
              <input className={inputCls} placeholder="Name" value={item.name} onChange={setItem(i, 'name')} />
              {err(`items.${i}.name`)}
            </div>
            <div className="col-span-2">
              <input className={inputCls} type="number" step="any" value={item.quantity} onChange={setItem(i, 'quantity')} />
              {err(`items.${i}.quantity`)}
            </div>
            <div className="col-span-3">
              <select className={inputCls} value={item.unit} onChange={setItem(i, 'unit')}>
                {Object.values(FOOD_UNITS).map((u) => <option key={u}>{u}</option>)}
              </select>
              {err(`items.${i}.unit`)}
            </div>
            <button type="button" onClick={() => removeItem(i)} className="col-span-1 text-sm text-red-600">✕</button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="mt-2 text-sm text-blue-700">+ Add item</button>
      </fieldset>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <label className="text-sm">Total servings
          <input className={inputCls} type="number" value={form.totalServings} onChange={set('totalServings')} />
          {err('totalServings')}
        </label>
        <label className="text-sm">Weight (kg)
          <input className={inputCls} type="number" step="any" value={form.estimatedWeightKg} onChange={set('estimatedWeightKg')} />
          {err('estimatedWeightKg')}
        </label>
        <label className="text-sm">Food type
          <select className={inputCls} value={form.foodType} onChange={set('foodType')}>
            {Object.values(FOOD_TYPES).map((v) => <option key={v}>{v}</option>)}
          </select>
          {err('foodType')}
        </label>
        <label className="text-sm">Category
          <select className={inputCls} value={form.category} onChange={set('category')}>
            {Object.values(FOOD_CATEGORIES).map((v) => <option key={v}>{v}</option>)}
          </select>
          {err('category')}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <label className="text-sm">Prepared at
          <input className={inputCls} type="datetime-local" value={form.preparedAt} onChange={set('preparedAt')} />
          {err('preparedAt')}
        </label>
        <label className="text-sm">Pickup from
          <input className={inputCls} type="datetime-local" value={form.pickupStart} onChange={set('pickupStart')} />
          {err('pickupWindow.start')}
        </label>
        <label className="text-sm">Pickup until
          <input className={inputCls} type="datetime-local" value={form.pickupEnd} onChange={set('pickupEnd')} />
          {err('pickupWindow.end')}
        </label>
        <label className="text-sm">Best before
          <input className={inputCls} type="datetime-local" value={form.bestBefore} onChange={set('bestBefore')} />
          {err('bestBefore')}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <label className="text-sm">Latitude
          <input className={inputCls} type="number" step="any" value={form.lat} onChange={set('lat')} />
          {err('location.lat')}
        </label>
        <label className="text-sm">Longitude
          <input className={inputCls} type="number" step="any" value={form.lng} onChange={set('lng')} />
          {err('location.lng')}
        </label>
        <div className="col-span-2 flex items-end">
          <button type="button" onClick={useMyLocation} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
            {locating ? 'Locating...' : 'Use my location'}
          </button>
        </div>
        <label className="col-span-2 text-sm">Address line
          <input className={inputCls} value={form.line1} onChange={set('line1')} />
          {err('address.line1')}
        </label>
        <label className="text-sm">City
          <input className={inputCls} value={form.city} onChange={set('city')} />
          {err('address.city')}
        </label>
        <label className="text-sm">State
          <input className={inputCls} value={form.state} onChange={set('state')} />
          {err('address.state')}
        </label>
        <label className="text-sm">Pincode
          <input className={inputCls} value={form.pincode} onChange={set('pincode')} />
          {err('address.pincode')}
        </label>
        <label className="text-sm">Contact phone (optional)
          <input className={inputCls} placeholder="defaults to your phone" value={form.contactPhone} onChange={set('contactPhone')} />
          {err('contactPhone')}
        </label>
      </div>

      {showSafety && (
        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-1 text-sm font-semibold">Safety checklist</legend>
          <div className="grid grid-cols-2 gap-2">
            {SAFETY_CHECKS.map(([key, label]) => (
              <label key={key} className="text-sm">
                <input type="checkbox" checked={form.safetyChecklist[key]} onChange={() => toggleCheck(key)} /> {label}
                {err(`safetyChecklist.${key}`)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="text-sm">Allergen info (optional)
          <input className={inputCls} value={form.allergenInfo} onChange={set('allergenInfo')} />
          {err('allergenInfo')}
        </label>
        <label className="text-sm">Notes (optional)
          <input className={inputCls} value={form.notes} onChange={set('notes')} />
          {err('notes')}
        </label>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="rounded bg-green-700 px-4 py-2 text-sm text-white disabled:opacity-50">
          {loading ? 'Saving...' : submitLabel}
        </button>
        {extraButtons}
      </div>
    </form>
  );
}

/** field path -> message map from an API error (fields only; key errors have no field). */
export const toFieldErrors = (error) =>
  Object.fromEntries((error?.body?.errors ?? []).filter((e) => e.field).map((e) => [e.field, e.message]));

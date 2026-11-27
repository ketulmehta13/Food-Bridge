import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { getNgoProfile, updateNgoProfile } from '../api/ngo.api.js';
import VerificationBanner from '../components/VerificationBanner.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import LocationField from '../../../components/shared/LocationField.jsx';
import { VERIFICATION_STATUS } from '../../../constants/index.js';
import { getErrorMessage, getFieldErrors } from '../../../utils/apiError.js';

// Editing these sends a verified NGO back to admin verification.
const IDENTITY_FIELDS = ['orgName', 'registrationNumber'];
const ADDRESS_FIELDS = ['line1', 'city', 'state', 'pincode'];

// The user object from the API -> flat form values (all strings).
const toForm = (user) => ({
  name: user.name ?? '',
  phone: user.phone ?? '',
  line1: user.address?.line1 ?? '',
  city: user.address?.city ?? '',
  state: user.address?.state ?? '',
  pincode: user.address?.pincode ?? '',
  lat: user.location ? String(user.location.coordinates[1]) : '',
  lng: user.location ? String(user.location.coordinates[0]) : '',
  orgName: user.ngoProfile?.orgName ?? '',
  registrationNumber: user.ngoProfile?.registrationNumber ?? '',
  contactPerson: user.ngoProfile?.contactPerson ?? '',
  serviceRadiusKm: String(user.ngoProfile?.serviceRadiusKm ?? 10),
  capacityMealsPerDay:
    user.ngoProfile?.capacityMealsPerDay != null ? String(user.ngoProfile.capacityMealsPerDay) : '',
});

/**
 * Build the PATCH body with ONLY the fields that changed.
 * Empty optional fields are sent as null (= clear them on the server).
 */
const buildChanges = (form, initial) => {
  const changed = (key) => form[key].trim() !== initial[key].trim();
  const textOrNull = (key) => form[key].trim() || null;
  const body = {};

  if (changed('name')) body.name = form.name.trim();
  if (changed('phone')) body.phone = form.phone.trim();

  const address = {};
  for (const key of ADDRESS_FIELDS) if (changed(key)) address[key] = textOrNull(key);
  if (Object.keys(address).length) body.address = address;

  if (changed('lat') || changed('lng')) {
    body.location = { lat: Number(form.lat.trim()), lng: Number(form.lng.trim()) };
  }

  const ngoProfile = {};
  for (const key of IDENTITY_FIELDS) if (changed(key)) ngoProfile[key] = form[key].trim();
  if (changed('contactPerson')) ngoProfile.contactPerson = textOrNull('contactPerson');
  if (changed('serviceRadiusKm')) ngoProfile.serviceRadiusKm = form.serviceRadiusKm.trim();
  if (changed('capacityMealsPerDay')) ngoProfile.capacityMealsPerDay = textOrNull('capacityMealsPerDay');
  if (Object.keys(ngoProfile).length) body.ngoProfile = ngoProfile;

  return body;
};

export default function NgoProfile() {
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState(null); // latest user from the server
  const [form, setForm] = useState(null);
  const [initial, setInitial] = useState(null); // form values as last saved
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Load the profile fresh from the server when the page opens.
  useEffect(() => {
    getNgoProfile()
      .then(({ user }) => {
        setProfile(user);
        setForm(toForm(user));
        setInitial(toForm(user));
      })
      .catch((err) => setLoadError(getErrorMessage(err)));
  }, []);

  if (loadError) return <PageShell><p className="text-red-600">{loadError}</p></PageShell>;
  if (!form) return <PageShell><p className="text-gray-500">Loading profile...</p></PageShell>;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const fe = (path) => fieldErrors[path];
  const changes = buildChanges(form, initial);
  const hasChanges = Object.keys(changes).length > 0;
  const identityChanged = IDENTITY_FIELDS.some((k) => changes.ngoProfile?.[k] !== undefined);
  const needsReverify = identityChanged && profile.verificationStatus === VERIFICATION_STATUS.VERIFIED;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setFieldErrors({});
    if (!hasChanges) return;

    // NGOs must always have a location; empty boxes would otherwise be sent as 0.
    if (!form.lat.trim() || !form.lng.trim()) {
      setFieldErrors({ location: 'Latitude and longitude are both required' });
      return;
    }

    if (
      needsReverify &&
      !window.confirm(
        'Changing the organisation name or registration number will send your NGO back for admin verification. Until then you cannot claim food. Continue?'
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const { user, message } = await updateNgoProfile(changes);
      setProfile(user);
      setForm(toForm(user));
      setInitial(toForm(user));
      updateUser(user); // keep the header/dashboard in sync
      setSuccess(message);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      setError(Object.keys(fields).length ? 'Please fix the highlighted fields.' : getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const locationError = fe('location') || fe('location.lat') || fe('location.lng');

  return (
    <PageShell>
      <VerificationBanner user={profile} />

      <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <Card title="Account">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Email" value={profile.email} readOnly disabled hint="Email cannot be changed" />
            <Input label="Your name" name="name" required value={form.name} onChange={onChange} error={fe('name')} />
            <Input
              label="Phone"
              name="phone"
              type="tel"
              required
              hint="10-15 digits, shown to donors after you claim"
              value={form.phone}
              onChange={onChange}
              error={fe('phone')}
            />
          </div>
        </Card>

        <Card
          title="Organisation"
          subtitle="Verified by an admin. Changing the name or registration number requires re-verification."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Organisation name"
              name="orgName"
              required
              value={form.orgName}
              onChange={onChange}
              error={fe('ngoProfile.orgName')}
            />
            <Input
              label="Registration number"
              name="registrationNumber"
              required
              value={form.registrationNumber}
              onChange={onChange}
              error={fe('ngoProfile.registrationNumber')}
            />
            <Input
              label="Contact person"
              name="contactPerson"
              value={form.contactPerson}
              onChange={onChange}
              error={fe('ngoProfile.contactPerson')}
            />
            <Input
              label="Capacity (meals per day)"
              name="capacityMealsPerDay"
              type="number"
              min="0"
              value={form.capacityMealsPerDay}
              onChange={onChange}
              error={fe('ngoProfile.capacityMealsPerDay')}
            />
          </div>
          {needsReverify && (
            <p className="mt-3 text-sm text-amber-700">
              Saving this change will send your NGO back for admin verification.
            </p>
          )}
        </Card>

        <Card title="Location & service area" subtitle="Donations within your service radius will be shown to you.">
          <div className="space-y-4">
            <LocationField
              required
              hint="Your base / kitchen location."
              value={{ lat: form.lat, lng: form.lng }}
              onChange={({ lat, lng }) => setForm((f) => ({ ...f, lat, lng }))}
              error={locationError}
            />
            <Input
              label="Service radius (km)"
              name="serviceRadiusKm"
              type="number"
              min="1"
              max="100"
              required
              className="max-w-xs"
              hint="1 to 100 km"
              value={form.serviceRadiusKm}
              onChange={onChange}
              error={fe('ngoProfile.serviceRadiusKm')}
            />
          </div>
        </Card>

        <Card title="Address">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Street" name="line1" className="sm:col-span-3" value={form.line1} onChange={onChange} error={fe('address.line1')} />
            <Input label="City" name="city" value={form.city} onChange={onChange} error={fe('address.city')} />
            <Input label="State" name="state" value={form.state} onChange={onChange} error={fe('address.state')} />
            <Input
              label="Pincode"
              name="pincode"
              inputMode="numeric"
              value={form.pincode}
              onChange={onChange}
              error={fe('address.pincode')}
            />
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={saving} disabled={!hasChanges}>
            Save changes
          </Button>
          <Button
            variant="secondary"
            disabled={!hasChanges || saving}
            onClick={() => {
              setForm(initial);
              setFieldErrors({});
              setError('');
            }}
          >
            Discard changes
          </Button>
          {!hasChanges && <span className="text-sm text-gray-500">No unsaved changes</span>}
        </div>
      </form>
    </PageShell>
  );
}

// ---- Small layout helpers used only on this page ----

function PageShell({ children }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">NGO profile</h1>
      {children}
    </main>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Alert({ tone, children }) {
  const styles =
    tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-red-200 bg-red-50 text-red-700';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

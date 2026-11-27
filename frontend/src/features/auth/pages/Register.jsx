import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth, homePathFor } from '../AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import FormAlert from '../components/FormAlert.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import { USER_TYPES, DONOR_CATEGORIES } from '../../../constants/index.js';
import { getErrorMessage, getFieldErrors } from '../../../utils/apiError.js';

const DONOR_CATEGORY_OPTIONS = Object.values(DONOR_CATEGORIES).map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
}));

const EMPTY_FORM = {
  userType: USER_TYPES.NGO,
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  line1: '',
  city: '',
  pincode: '',
  // donor
  businessName: '',
  donorCategory: '',
  // ngo
  orgName: '',
  registrationNumber: '',
  contactPerson: '',
  lat: '',
  lng: '',
};

// Remove empty strings so optional fields aren't sent as "" (the backend would reject them).
const compact = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined));

// Turn the flat form into the nested shape the API expects.
const buildPayload = (f) => {
  const address = compact({ line1: f.line1, city: f.city, pincode: f.pincode });
  const base = compact({
    userType: f.userType,
    name: f.name,
    email: f.email,
    password: f.password,
    phone: f.phone,
  });
  if (Object.keys(address).length) base.address = address;

  if (f.userType === USER_TYPES.DONOR) {
    return {
      ...base,
      donorProfile: compact({ donorCategory: f.donorCategory, businessName: f.businessName }),
    };
  }
  return {
    ...base,
    ...(f.lat !== '' && f.lng !== '' && { location: { lat: Number(f.lat), lng: Number(f.lng) } }),
    ngoProfile: compact({
      orgName: f.orgName,
      registrationNumber: f.registrationNumber,
      contactPerson: f.contactPerson,
    }),
  };
};

export default function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  if (!loading && user) return <Navigate to={homePathFor(user)} replace />;

  const isNgo = form.userType === USER_TYPES.NGO;
  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const fe = (field) => fieldErrors[field];
  const locationError = fe('location') || fe('location.lat') || fe('location.lng');

  // Fill lat/lng from the browser (asks the user for permission).
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location. Please enter it manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((f) => ({
          ...f,
          lat: coords.latitude.toFixed(6),
          lng: coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setError('Could not get your location. Please allow access or enter it manually.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Quick checks the server can't do for us.
    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Passwords do not match' });
      return;
    }

    setSubmitting(true);
    try {
      const newUser = await register(buildPayload(form));
      navigate(homePathFor(newUser), { replace: true });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (err.response?.status === 409) fields.email = 'An account with this email already exists';
      setFieldErrors(fields);
      setError(
        Object.keys(fields).length ? 'Please fix the highlighted fields.' : getErrorMessage(err)
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Create an account" subtitle="Join FoodBridge as a food donor or an NGO." wide>
      <FormAlert message={error} />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Account type */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700">I am registering as</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { value: USER_TYPES.NGO, title: 'NGO', text: 'Collect surplus food and distribute it' },
              { value: USER_TYPES.DONOR, title: 'Donor', text: 'Restaurant, caterer, event or household' },
            ].map((opt) => (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-lg border p-4 transition ${
                  form.userType === opt.value
                    ? 'border-brand bg-brand-light/50 ring-1 ring-brand'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="userType"
                  value={opt.value}
                  checked={form.userType === opt.value}
                  onChange={onChange}
                  className="sr-only"
                />
                <span className="block font-semibold text-gray-900">{opt.title}</span>
                <span className="block text-sm text-gray-500">{opt.text}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Account details */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Your name" name="name" required value={form.name} onChange={onChange} error={fe('name')} />
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={onChange}
            error={fe('email')}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint="At least 8 characters"
            value={form.password}
            onChange={onChange}
            error={fe('password')}
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={form.confirmPassword}
            onChange={onChange}
            error={fe('confirmPassword')}
          />
          <Input
            label="Phone"
            name="phone"
            type="tel"
            required={isNgo}
            hint="10-15 digits, e.g. 9876543210"
            value={form.phone}
            onChange={onChange}
            error={fe('phone')}
          />
        </section>

        {/* Type-specific details */}
        {isNgo ? (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Organisation</h2>
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
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Location <span className="text-red-500">*</span>
                </span>
                <Button variant="secondary" onClick={useMyLocation} loading={locating} className="px-3 py-1 text-xs">
                  Use my current location
                </Button>
              </div>
              <p className="mb-2 text-xs text-gray-500">Used to show you food donations nearby.</p>
              <div className="grid grid-cols-2 gap-4">
                <Input placeholder="Latitude" name="lat" inputMode="decimal" value={form.lat} onChange={onChange} />
                <Input placeholder="Longitude" name="lng" inputMode="decimal" value={form.lng} onChange={onChange} />
              </div>
              {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Donor details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Donor type"
                name="donorCategory"
                required
                placeholder="Select..."
                options={DONOR_CATEGORY_OPTIONS}
                value={form.donorCategory}
                onChange={onChange}
                error={fe('donorProfile.donorCategory')}
              />
              <Input
                label="Business name"
                name="businessName"
                hint="Optional"
                value={form.businessName}
                onChange={onChange}
                error={fe('donorProfile.businessName')}
              />
            </div>
          </section>
        )}

        {/* Address (optional) */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Address (optional)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input label="Street" name="line1" className="sm:col-span-3" value={form.line1} onChange={onChange} />
            <Input label="City" name="city" className="sm:col-span-2" value={form.city} onChange={onChange} />
            <Input label="Pincode" name="pincode" inputMode="numeric" value={form.pincode} onChange={onChange} />
          </div>
        </section>

        <Button type="submit" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-dark hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}

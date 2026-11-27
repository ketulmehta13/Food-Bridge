import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, homePathFor } from '../AuthContext.jsx';
import AuthCard from '../components/AuthCard.jsx';
import FormAlert from '../components/FormAlert.jsx';
import Input from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import { getErrorMessage, getFieldErrors } from '../../../utils/apiError.js';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Where to go after login: back to the page that sent us here (ProtectedRoute), or the dashboard.
  const redirectTo = (u) => location.state?.from?.pathname || homePathFor(u);

  // Already logged in? Skip the form.
  if (!loading && user) return <Navigate to={redirectTo(user)} replace />;

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFieldErrors({});
    try {
      const loggedIn = await login(form.email, form.password);
      navigate(redirectTo(loggedIn), { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthCard title="Log in" subtitle="Welcome back to FoodBridge.">
      <FormAlert message={error} />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={onChange}
          error={fieldErrors.email}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={onChange}
          error={fieldErrors.password}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        New to FoodBridge?{' '}
        <Link to="/register" className="font-medium text-brand-dark hover:underline">
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

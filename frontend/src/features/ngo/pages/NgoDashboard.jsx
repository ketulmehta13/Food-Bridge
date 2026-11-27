import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import Button from '../../../components/ui/Button.jsx';
import { VERIFICATION_STATUS } from '../../../constants/index.js';

// Banner text per verification status.
const STATUS_BANNER = {
  [VERIFICATION_STATUS.PENDING]: {
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    text: 'Your NGO is awaiting admin verification. You can look around, but you can claim food only after you are verified.',
  },
  [VERIFICATION_STATUS.REJECTED]: {
    className: 'border-red-200 bg-red-50 text-red-800',
    text: 'Your verification was rejected.',
  },
  [VERIFICATION_STATUS.VERIFIED]: {
    className: 'border-green-200 bg-green-50 text-green-800',
    text: 'Your NGO is verified. You can claim food donations.',
  },
};

// NGO landing page (/ngo). Placeholder until the NGO features are built.
export default function NgoDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const banner = STATUS_BANNER[user.verificationStatus];

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-dark">{user.ngoProfile?.orgName}</h1>
          <p className="mt-1 text-gray-600">Welcome, {user.name}</p>
        </div>
        <Button variant="secondary" onClick={onLogout}>
          Log out
        </Button>
      </div>

      {banner && (
        <div className={`mt-6 rounded-md border px-4 py-3 text-sm ${banner.className}`}>
          {banner.text}
          {user.verificationStatus === VERIFICATION_STATUS.REJECTED && user.rejectionReason && (
            <> Reason: {user.rejectionReason}</>
          )}
        </div>
      )}

      <p className="mt-8 text-gray-500">NGO features (browse donations, claims) will appear here.</p>
    </main>
  );
}

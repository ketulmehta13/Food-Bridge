import { VERIFICATION_STATUS } from '../../../constants/index.js';

// Coloured banner explaining the NGO's verification status.
const STATUS_BANNER = {
  [VERIFICATION_STATUS.PENDING]: {
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    text: 'Your NGO is awaiting admin verification. You can look around, but you can claim food only after you are verified.',
  },
  [VERIFICATION_STATUS.REJECTED]: {
    className: 'border-red-200 bg-red-50 text-red-800',
    text: 'Your verification was rejected. Please correct your organisation details in your profile.',
  },
  [VERIFICATION_STATUS.VERIFIED]: {
    className: 'border-green-200 bg-green-50 text-green-800',
    text: 'Your NGO is verified. You can claim food donations.',
  },
};

export default function VerificationBanner({ user, className = '' }) {
  const banner = STATUS_BANNER[user.verificationStatus];
  if (!banner) return null;

  return (
    <div role="status" className={`rounded-md border px-4 py-3 text-sm ${banner.className} ${className}`}>
      {banner.text}
      {user.verificationStatus === VERIFICATION_STATUS.REJECTED && user.rejectionReason && (
        <span className="mt-1 block font-medium">Reason: {user.rejectionReason}</span>
      )}
    </div>
  );
}

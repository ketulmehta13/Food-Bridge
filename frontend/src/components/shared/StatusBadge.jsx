import { DONATION_STATUS_STYLES } from '../../constants/index.js';

// Coloured pill for a donation status, e.g. <StatusBadge status="PICKED_UP" />.
export default function StatusBadge({ status, className = '' }) {
  const styles = DONATION_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700 ring-gray-500/20';
  const label = status ? status.replace(/_/g, ' ') : 'UNKNOWN';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles} ${className}`}
    >
      {label}
    </span>
  );
}

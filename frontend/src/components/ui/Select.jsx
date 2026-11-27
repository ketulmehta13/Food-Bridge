import { useId } from 'react';

// Labelled dropdown. options: [{ value, label }].
export default function Select({ label, error, options, placeholder, className = '', id, ...props }) {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        className={`block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-brand focus:ring-brand-light'
        }`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

import { useId } from 'react';

// Labelled text input with an optional error message underneath.
export default function Input({ label, error, hint, className = '', id, ...props }) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        className={`block w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-gray-300 focus:border-brand focus:ring-brand-light'
        }`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}

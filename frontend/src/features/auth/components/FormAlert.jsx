// Red box for a form-level error message (e.g. "Invalid email or password").
export default function FormAlert({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

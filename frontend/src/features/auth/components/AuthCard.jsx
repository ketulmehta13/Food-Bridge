import { Link } from 'react-router-dom';

// Centered card layout shared by the Login and Register pages.
export default function AuthCard({ title, subtitle, children, wide = false }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <Link to="/" className="mb-6 block text-center text-2xl font-bold text-brand-dark">
          FoodBridge
        </Link>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}

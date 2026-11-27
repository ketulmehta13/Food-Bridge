import { Link } from 'react-router-dom';
import DevTokenPanel from '../components/DevTokenPanel.jsx';

// Donor landing page (/donor): links to the donor test pages + the dev token panel.
const LINKS = [
  ['/donor/donations/new', 'Post a donation', 'Pre-filled form plus a raw JSON request box.'],
  ['/donor/donations', 'My donations', 'Filter by status, sort and page through your posts.'],
];

export default function DonorDashboard() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand-dark">Donor Dashboard</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {LINKS.map(([to, title, text]) => (
          <Link key={to} to={to} className="rounded-lg border border-gray-200 bg-white p-4 hover:border-green-600">
            <h2 className="font-semibold">{title}</h2>
            <p className="text-sm text-gray-600">{text}</p>
          </Link>
        ))}
      </div>
      <DevTokenPanel />
    </main>
  );
}

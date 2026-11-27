import DevTokenPanel from '../components/DevTokenPanel.jsx';

// Donor landing page (/donor). For now: the dev token panel for testing the API.
export default function DonorDashboard() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold text-brand-dark">Donor Dashboard</h1>
      <p className="mt-2 text-gray-600">Donor features will appear here.</p>
      <DevTokenPanel />
    </main>
  );
}

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import Button from '../../../components/ui/Button.jsx';

// Navigation for NGO pages. Add a link here when a new NGO page is added.
const NAV_LINKS = [
  { to: '/ngo', label: 'Dashboard', end: true },
  { to: '/ngo/profile', label: 'Profile' },
];

// Shared frame for every /ngo page: top bar with navigation + logout, page below.
export default function NgoLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold text-brand-dark">
              FoodBridge
            </Link>
            <nav className="flex gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm font-medium ${
                      isActive ? 'bg-brand-light text-brand-dark' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">{user.ngoProfile?.orgName}</span>
            <Button variant="secondary" onClick={onLogout} className="px-3 py-1.5">
              Log out
            </Button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

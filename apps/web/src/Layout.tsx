import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';

export function Layout(): JSX.Element {
  const { user, isAuthenticated, isOfficer, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isPublicPage =
    location.pathname === '/' ||
    location.pathname === '/about' ||
    location.pathname === '/contact' ||
    location.pathname === '/business-map' ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/projects';

  const handleLogout = (): void => {
    logout();
    void navigate('/');
  };

  // Public marketing pages (home, about, contact) have their own dedicated sticky navbar and footer
  if (isPublicPage) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-bold text-blue-700">
            ApprovalIQ
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {isAuthenticated ? (
              <>
                <span className="text-gray-600">{user?.email}</span>
                {isOfficer ? (
                  <>
                    <Link to="/officer" className="text-blue-600 hover:underline">
                      Officer queue
                    </Link>
                    <Link to="/regulatory-changes" className="text-blue-600 hover:underline">
                      Regulatory Changes
                    </Link>
                    <Link to="/integrations" className="text-blue-600 hover:underline">
                      Single-Window Hub
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/projects" className="text-blue-600 hover:underline">
                      Projects
                    </Link>
                    <Link to="/regulatory-changes" className="text-blue-600 hover:underline">
                      Regulatory Changes
                    </Link>
                    <Link to="/integrations" className="text-blue-600 hover:underline">
                      Single-Window Hub
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded bg-gray-800 px-3 py-1 text-white hover:bg-gray-900"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-blue-600 hover:underline">
                  Login
                </Link>
                <Link to="/register" className="text-blue-600 hover:underline">
                  Register
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}


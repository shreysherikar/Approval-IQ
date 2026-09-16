import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Compass, LogOut, Layers } from 'lucide-react';
import { useAuth } from './auth';
import { useLanguage } from './i18n';

export function LanguageSwitcher(): JSX.Element {
  const { setLanguage, isMarathi } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200/90 shadow-2xs">
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          !isMarathi
            ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        title="Switch to English"
      >
        <span>EN</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('mr')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isMarathi
            ? 'bg-blue-600 text-white shadow-2xs font-extrabold'
            : 'text-slate-500 hover:text-slate-900'
        }`}
        title="मराठी मध्ये बदला"
      >
        <span>मराठी</span>
      </button>
    </div>
  );
}

export function Layout(): JSX.Element {
  const { user, isAuthenticated, isOfficer, logout } = useAuth();
  const { t } = useLanguage();
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

  const isOfficerRoute = location.pathname.startsWith('/officer');

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Enterprise Clean Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3.5">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
                ▲
              </div>
              <span className="text-lg font-black tracking-tight text-slate-900">
                Approval<span className="text-blue-600">IQ</span>
              </span>
            </Link>

            {isOfficerRoute && (
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>{t('nav.officer_desk')}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs sm:text-sm">
            {/* Language Switcher Button */}
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-xs text-slate-800">{user?.email}</span>
                  {user?.role && (
                    <span className="px-1.5 py-0.2 rounded bg-slate-200 text-[10px] font-bold uppercase text-slate-600 font-mono">
                      {user.role}
                    </span>
                  )}
                </div>

                <Link
                  to="/business-map"
                  className="hidden sm:inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors font-medium"
                  title="Industrial Geo Intelligence"
                >
                  <Compass className="w-4 h-4 text-slate-500" />
                  <span className="text-xs">{t('nav.map')}</span>
                </Link>

                {isOfficer ? (
                  <>
                    <Link
                      to="/officer"
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
                        location.pathname === '/officer'
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{t('nav.officer_desk')}</span>
                    </Link>
                    <Link
                      to="/regulatory-changes"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-all"
                    >
                      <span>{t('nav.regulatory_changes')}</span>
                    </Link>
                    <Link to="/integrations" className="text-blue-600 hover:underline">
                      {t('nav.integrations')}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/projects"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm transition-all"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('nav.projects')}</span>
                    </Link>
                    <Link
                      to="/regulatory-changes"
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-all"
                    >
                      <span>{t('nav.regulatory_changes')}</span>
                    </Link>
                    <Link to="/integrations" className="text-blue-600 hover:underline">
                      {t('nav.integrations')}
                    </Link>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer font-medium"
                  title="Sign out of current session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('nav.logout')}</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors font-medium"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}



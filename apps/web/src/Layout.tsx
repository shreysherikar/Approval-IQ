import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Compass, LogOut, Layers, Clock, MapPinned } from 'lucide-react';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { AssistantPanel } from './assistant-panel';
import { OnboardingTour } from './OnboardingTour';

export function LanguageSwitcher(): JSX.Element {
  const { setLanguage, isMarathi, t } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg bg-amber-50 p-0.5 border border-amber-200 shadow-sm">
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
          !isMarathi
            ? 'bg-white text-amber-900 shadow-sm'
            : 'text-slate-600 hover:text-amber-800'
        }`}
        title={t('lang.en_title', 'Switch to English')}
      >
        <span>{t('lang.en', 'EN')}</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage('mr')}
        className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
          isMarathi
            ? 'bg-amber-500 text-white shadow-sm'
            : 'text-slate-600 hover:text-amber-800'
        }`}
        title={t('lang.marathi_title', 'Switch to Marathi')}
      >
        <span>{t('lang.marathi', 'मराठी')}</span>
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
    void navigate('/login');
  };

  // Public marketing pages have their own dedicated sticky navbar and footer
  if (isPublicPage) {
    return (
      <>
        <Outlet />
        <AssistantPanel />
      </>
    );
  }

  const isOfficerRoute = location.pathname.startsWith('/officer');

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Floating project assistant */}
      <AssistantPanel />
      {/* Top Luminous Mustard & White Navigation */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-200/80 shadow-sm transition-all duration-300">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-all duration-200">
                ▲
              </div>
              <span className="font-editorial text-xl font-bold tracking-tight text-slate-900">
                Approval<span className="text-amber-600">IQ</span>
              </span>
            </Link>

            {isOfficerRoute && (
              <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-amber-200">
                <span className="mustard-badge">
                  <ShieldCheck className="w-3 h-3 text-amber-700 inline" />
                  <span>{t('nav.officer_desk')}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            {/* Onboarding Guide Trigger */}
            {!isOfficerRoute && <OnboardingTour />}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg border border-amber-200/90 bg-amber-50/80 text-amber-950 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-mono text-xs font-semibold truncate max-w-[150px]">{user?.email}</span>
                  {user?.role && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 text-[9px] font-bold font-mono uppercase">
                      {user.role}
                    </span>
                  )}
                </div>

                <Link
                  to="/business-map"
                  className="hidden sm:inline-flex items-center gap-1.5 text-slate-700 hover:text-amber-700 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 transition-all font-medium text-xs"
                  title="Industrial Geo Intelligence"
                >
                  <Compass className="w-3.5 h-3.5 text-amber-600" />
                  <span>{t('nav.map')}</span>
                </Link>

                {/* Business Intelligence section — dedicated, always visible. */}
                <span className="hidden lg:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-l border-slate-200 pl-3">
                  Business Intelligence
                </span>
                <NavLink
                  to="/time-cost-prediction"
                  className={({ isActive }) =>
                    `hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 hover:bg-blue-50'
                    }`
                  }
                >
                  <Clock className="h-4 w-4" />
                  <span className="hidden md:inline">Time &amp; Cost</span>
                </NavLink>
                <NavLink
                  to="/market-intelligence"
                  className={({ isActive }) =>
                    `hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-600 hover:bg-blue-50'
                    }`
                  }
                >
                  <MapPinned className="h-4 w-4" />
                  <span className="hidden md:inline">Market Intel</span>
                </NavLink>

                {isOfficer ? (
                  <>
                    <Link
                      to="/officer"
                      className={`tactile-btn text-xs px-3.5 py-1.5 ${
                        location.pathname === '/officer'
                          ? 'mustard-btn-primary'
                          : 'mustard-btn-secondary'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      <span>{t('nav.officer_desk')}</span>
                    </Link>
                    <Link
                      to="/regulatory-changes"
                      className="text-xs font-medium text-slate-700 hover:text-amber-700 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 transition-all"
                    >
                      <span>{t('nav.regulatory_changes')}</span>
                    </Link>
                    <Link to="/integrations" className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline">
                      {t('nav.integrations')}
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/projects"
                      className="tactile-btn mustard-btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-md shadow-amber-500/25"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{t('nav.projects')}</span>
                    </Link>
                    <Link
                      to="/regulatory-changes"
                      className="text-xs font-medium text-slate-700 hover:text-amber-700 px-2.5 py-1.5 rounded-lg hover:bg-amber-50 transition-all hidden sm:inline"
                    >
                      <span>{t('nav.regulatory_changes')}</span>
                    </Link>
                    <Link to="/integrations" className="text-xs font-semibold text-amber-700 hover:text-amber-900 hover:underline hidden sm:inline">
                      {t('nav.integrations')}
                    </Link>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="tactile-btn mustard-btn-secondary px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:border-rose-300 flex items-center gap-1.5"
                  title="Sign out of current session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('nav.logout')}</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="tactile-btn mustard-btn-secondary px-3.5 py-1.5 text-xs"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="tactile-btn mustard-btn-primary px-3.5 py-1.5 text-xs"
                >
                  {t('nav.register')}
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}

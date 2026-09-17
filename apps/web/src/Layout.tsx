import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Compass,
  LogOut,
  Layers,
  Clock,
  MapPinned,
  FileText,
  Network,
} from 'lucide-react';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { AssistantPanel } from './assistant-panel';
import { OnboardingTour } from './OnboardingTour';
import { VoiceProvider, useVoice, ApproveMicButton } from './voice';

export function LanguageSwitcher(): JSX.Element {
  const { setLanguage, isMarathi, t } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg bg-amber-50 p-0.5 border border-amber-200 shadow-sm shrink-0">
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

function VoiceHeaderButton(): JSX.Element {
  const { voiceState, startSession, stopSession, isSupported } = useVoice();
  return (
    <ApproveMicButton
      state={voiceState}
      onClick={voiceState !== 'idle' ? stopSession : startSession}
      isSupported={isSupported.stt}
    />
  );
}

function LayoutInner(): JSX.Element {
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

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
      isActive
        ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
        : 'text-slate-600 hover:text-amber-900 hover:bg-amber-100/60'
    }`;

  const intelItemClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
        : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/80'
    }`;

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900 overflow-x-hidden max-w-full">
      {/* Floating project assistant */}
      <AssistantPanel />

      {/* Top Header: Clean Brand & Executive Profile Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-amber-200/80 shadow-sm transition-all duration-300">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-2.5">
          {/* Brand Logo & Context */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-amber-500/20 group-hover:scale-105 transition-all duration-200">
                ▲
              </div>
              <div className="flex flex-col">
                <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-none">
                  Approval<span className="text-amber-600">IQ</span>
                </span>
                <span className="hidden sm:inline text-[9px] font-mono font-medium text-slate-400 uppercase tracking-wider mt-0.5">
                  AI Single-Window Operating System
                </span>
              </div>
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

          {/* Right Controls: Voice Assistant, Language, User Identity, Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Primary Voice Assistant Button */}
            {isAuthenticated && !isOfficerRoute && (
              <div className="shrink-0">
                <VoiceHeaderButton />
              </div>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                {/* User Profile Pill */}
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-amber-200/90 bg-amber-50/80 text-amber-950 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-mono text-xs font-semibold truncate max-w-[130px] sm:max-w-[180px]">
                    {user?.email}
                  </span>
                  {user?.role && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 text-[9px] font-bold font-mono uppercase shrink-0">
                      {user.role}
                    </span>
                  )}
                </div>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="tactile-btn mustard-btn-secondary px-2.5 py-1.5 text-xs text-slate-600 hover:text-rose-600 hover:border-rose-300 flex items-center gap-1.5 shrink-0"
                  title={t('nav.logout', 'Sign out')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t('nav.logout')}</span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
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
              </div>
            )}
          </div>
        </div>

        {/* Secondary Sub-Navbar / Utilities Bar (Below Top Header) */}
        {isAuthenticated && (
          <div className="bg-[#FAF9F5]/95 backdrop-blur-md border-t border-amber-100/90 border-b border-amber-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-1.5 gap-2 overflow-x-auto scrollbar-none">
              {/* Left Utilities & Intelligence Navigation */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Main Workspace Navigation */}
                {isOfficer ? (
                  <NavLink to="/officer" className={navItemClass}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{t('nav.officer_desk')}</span>
                  </NavLink>
                ) : (
                  <NavLink to="/projects" className={navItemClass}>
                    <Layers className="w-3.5 h-3.5" />
                    <span>{t('nav.projects')}</span>
                  </NavLink>
                )}

                <div className="h-4 w-px bg-slate-200/90 mx-1" />

                {/* Intelligence Suite */}
                <NavLink to="/business-map" className={intelItemClass} title="Industrial Geo Intelligence">
                  <Compass className="w-3.5 h-3.5 text-blue-500" />
                  <span>{t('nav.map', 'Geo Intelligence')}</span>
                </NavLink>

                <NavLink to="/time-cost-prediction" className={intelItemClass}>
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  <span>Time &amp; Cost</span>
                </NavLink>

                <NavLink to="/market-intelligence" className={intelItemClass}>
                  <MapPinned className="w-3.5 h-3.5 text-blue-500" />
                  <span>Market Intel</span>
                </NavLink>
              </div>

              {/* Right Utilities: Regulatory Changes, Single Window Hub, Guided Tour */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <NavLink to="/regulatory-changes" className={navItemClass}>
                  <FileText className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">{t('nav.regulatory_changes')}</span>
                  <span className="sm:hidden">Updates</span>
                </NavLink>

                <NavLink to="/integrations" className={navItemClass}>
                  <Network className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">{t('nav.integrations')}</span>
                  <span className="sm:hidden">Hub</span>
                </NavLink>

                {/* Onboarding Guide Trigger */}
                {!isOfficerRoute && (
                  <div className="pl-1 border-l border-amber-200/80">
                    <OnboardingTour />
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}

export function Layout(): JSX.Element {
  return (
    <VoiceProvider>
      <LayoutInner />
    </VoiceProvider>
  );
}


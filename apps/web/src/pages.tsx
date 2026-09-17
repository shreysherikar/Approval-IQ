import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Building2, 
  FlaskConical, 
  Flame, 
  Zap, 
  FileText, 
  ShieldCheck, 
  Globe2, 
  Lock, 
  Check
} from 'lucide-react';
import { ApiError, authApi } from './api-client';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { LanguageSwitcher } from './Layout';
import { ErrorBanner, GoogleSignInButton } from './components';
import { LandingPage } from './landing/LandingPage';

const isEmbedded =
  typeof window !== 'undefined' &&
  ('__TAURI_INTERNALS__' in window ||
    'Capacitor' in window ||
    import.meta.env.VITE_DESKTOP === 'true' ||
    import.meta.env.VITE_MOBILE === 'true');

export function HomePage(): JSX.Element {
  return <LandingPage />;
}

// ---------------------------------------------------------------------------
// Shared Oceanic Showcase Sidebar for Authentication
// ---------------------------------------------------------------------------

function AuthShowcaseSidebar(): JSX.Element {
  const { t } = useLanguage();
  const [activeTheme, setActiveTheme] = useState<'cyan' | 'mustard'>('cyan');

  return (
    <div
      className="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white relative overflow-hidden border-r transition-all duration-700 select-none"
      style={{
        background: activeTheme === 'cyan'
          ? 'linear-gradient(135deg, #06212B 0%, #0A3140 40%, #085375 75%, #0E8BB2 100%)'
          : 'linear-gradient(135deg, #0A2F3D 0%, #0E6B7A 35%, #B45309 75%, #D97706 100%)',
        borderColor: activeTheme === 'cyan' ? '#0B364C' : '#78350F',
      }}
    >
      {/* Animated Floating Ambient Spheres */}
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ease-out animate-float-slow"
        style={{
          top: '-10%',
          left: '-10%',
          background: activeTheme === 'cyan'
            ? 'radial-gradient(circle, rgba(56, 172, 204, 0.45) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 ease-out animate-float"
        style={{
          bottom: '-10%',
          right: '-10%',
          background: activeTheme === 'cyan'
            ? 'radial-gradient(circle, rgba(14, 139, 178, 0.40) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(217, 119, 6, 0.40) 0%, transparent 70%)',
        }}
      />
      
      {/* Top Brand Logo & Mode Switcher */}
      <div className="relative z-10 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-105 transition-all duration-300 ${
              activeTheme === 'cyan' ? 'bg-cyan-500 shadow-glow-cyan' : 'bg-amber-500 shadow-md shadow-amber-500/30'
            }`}
          >
            ▲
          </div>
          <span className="font-editorial text-2xl font-bold tracking-tight text-white">
            Approval<span className={activeTheme === 'cyan' ? 'text-cyan-300' : 'text-amber-300'}>IQ</span>
          </span>
        </Link>

        {/* Interactive Dual-Mode Color Switcher */}
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/20 px-3 py-1.5 rounded-full shadow-lg">
          <button
            type="button"
            className={`text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
              activeTheme === 'cyan' ? 'text-cyan-300 font-extrabold' : 'text-white/60 hover:text-white'
            }`}
            onClick={() => setActiveTheme('cyan')}
          >
            Cyan
          </button>
          <button
            type="button"
            onClick={() => setActiveTheme(activeTheme === 'cyan' ? 'mustard' : 'cyan')}
            className="w-9 h-4.5 rounded-full bg-white/20 relative p-0.5 transition-colors cursor-pointer border border-white/30 flex items-center"
            aria-label="Toggle Color Theme"
          >
            <div
              className={`w-3.5 h-3.5 rounded-full shadow-md transform transition-transform duration-300 ${
                activeTheme === 'mustard' ? 'translate-x-4 bg-amber-400' : 'translate-x-0 bg-cyan-300'
              }`}
            />
          </button>
          <button
            type="button"
            className={`text-[10px] uppercase font-bold tracking-wider cursor-pointer transition-colors ${
              activeTheme === 'mustard' ? 'text-amber-300 font-extrabold' : 'text-white/60 hover:text-white'
            }`}
            onClick={() => setActiveTheme('mustard')}
          >
            Mustard
          </button>
        </div>
      </div>

      {/* Middle Value Proposition & Clearance Critical Path */}
      <div className="relative z-10 space-y-6 my-auto py-6">
        
        <div className="space-y-2.5">
          <span className="stamp-seal stamp-approved text-[10px] shadow-sm">
            {t('auth.sidebar_badge', 'STATUTORY COMPLIANCE INTELLIGENCE')}
          </span>
          
          <h2 className="font-editorial text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight drop-shadow-sm">
            {activeTheme === 'cyan'
              ? 'Streamline industrial clearances across Indian states'
              : 'Deterministic clearance desk with Right to Services timers'}
          </h2>
          
          <p className="text-white/80 text-xs xl:text-sm leading-relaxed max-w-md font-sans">
            {t(
              'auth.sidebar_sub',
              'Deterministic dependency DAGs, prerequisite isolation, and OCR document cross-reuse across central and state regulatory authorities.'
            )}
          </p>
        </div>

        {/* Live Mini Clearance Lifecycle Card with Frosted Glass Pill */}
        <div
          className="p-4 rounded-2xl border space-y-3 max-w-md backdrop-blur-xl shadow-2xl transition-all duration-500"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            borderColor: activeTheme === 'cyan' ? 'rgba(56, 172, 204, 0.4)' : 'rgba(245, 158, 11, 0.4)',
          }}
        >
          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/15">
            <span className="font-mono font-bold text-white text-[11px] uppercase tracking-wider">
              {activeTheme === 'cyan' ? 'CRITICAL PATH ROADMAP' : 'CONSENSUS GATEWAY ACTIVE'}
            </span>
            <span className="stamp-seal stamp-approved text-[9px]">
              Gated Sequence
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/20 border border-white/10 hover:border-white/30 transition-colors">
              <div className="flex items-center gap-2 text-white">
                <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                <span className="font-medium text-xs">Factory Plan Sanction (DISH)</span>
              </div>
              <span className="stamp-seal stamp-approved text-[9px]">
                <Check className="w-2.5 h-2.5 inline mr-0.5" /> SANCTIONED
              </span>
            </div>

            <div
              className="flex items-center justify-between p-2.5 rounded-lg border text-white transition-colors"
              style={{
                background: activeTheme === 'cyan' ? 'rgba(14, 139, 178, 0.25)' : 'rgba(217, 119, 6, 0.25)',
                borderColor: activeTheme === 'cyan' ? 'rgba(56, 172, 204, 0.6)' : 'rgba(245, 158, 11, 0.6)',
              }}
            >
              <div className="flex items-center gap-2">
                <FlaskConical className={`w-3.5 h-3.5 ${activeTheme === 'cyan' ? 'text-cyan-300' : 'text-amber-300'}`} />
                <span className="font-medium text-xs">Consent to Establish (MPCB)</span>
              </div>
              <span className="stamp-seal stamp-pending text-[9px]">
                IN REVIEW
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-black/10 border border-white/10 text-white/60">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-xs">Provisional Fire NOC</span>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/70">
                <Lock className="w-2.5 h-2.5 inline mr-0.5" /> GATED
              </span>
            </div>
          </div>
        </div>

        {/* Pillar Badges */}
        <div className="grid grid-cols-2 gap-3 max-w-md pt-1 text-xs">
          <div className="flex items-start gap-2 text-white/80">
            <Zap className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeTheme === 'cyan' ? 'text-cyan-300' : 'text-amber-300'}`} />
            <div>
              <div className="font-semibold text-white text-xs">Prerequisite Tree</div>
              <div className="text-[11px] text-white/70">Zero premature forfeitures</div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-white/80">
            <FileText className="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-white text-xs">Single-Dossier Reuse</div>
              <div className="text-[11px] text-white/70">Cross-linked multi-desk files</div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Trust Sign-Off */}
      <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/70">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>Statutory Data Isolation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Globe2 className={`w-3.5 h-3.5 ${activeTheme === 'cyan' ? 'text-cyan-300' : 'text-amber-300'}`} />
          <span>All Indian States</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Redesigned LoginPage
// ---------------------------------------------------------------------------

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authErrorParam = searchParams.get('error');
  const displayError =
    error ??
    (authErrorParam === 'oauth_failed'
      ? 'Google Sign-In failed or was cancelled. Please try again.'
      : authErrorParam === 'no_token'
        ? 'Authentication service did not return an access token.'
        : null);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const resp = await authApi.login({ email, password });
      login(resp.accessToken, resp.refreshToken);
      const next = searchParams.get('next');
      void navigate(next || '/projects');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid credentials provided.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas font-sans antialiased text-ink">
      
      {/* Left Showcase Banner */}
      <AuthShowcaseSidebar />

      {/* Right Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 xl:p-14 relative">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between pb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ocean-700 hover:text-ocean-900 transition-colors font-mono"
          >
            <span>← Back to Platform</span>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-xs text-ink-soft">
              {t('auth.no_account', "Don't have an account?")}{' '}
              <Link to="/register" className="text-ocean-600 hover:text-ocean-800 font-bold hover:underline">
                {t('nav.register', 'Open Docket →')}
              </Link>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-md w-full mx-auto my-auto space-y-5 animate-fade-in-up">
          
          <div>
            <span className="stamp-seal stamp-neutral text-[10px] mb-2 inline-block">
              STATUTORY CLEARANCE PASSBOOK
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              {t('auth.login_title', 'Access Your Compliance Desk')}
            </h1>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">
              {t('auth.login_sub', 'Sign in to access your statutory dockets, verified evidence vault, and RTS countdown timers.')}
            </p>
          </div>

          {displayError && <ErrorBanner message={displayError} />}

          {!isEmbedded && (
            <>
              <div className="pt-1">
                <GoogleSignInButton label="Sign in with Google" disabled={isLoading} />
              </div>

              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-ocean-200" />
                <span className="bg-canvas px-2.5 text-[10px] uppercase tracking-wider text-ocean-600 font-bold font-mono absolute">
                  or work credentials
                </span>
              </div>
            </>
          )}

          {/* Email & Password Form */}
          <form onSubmit={(e) => void submit(e)} className="space-y-3.5">
            
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                {t('auth.email_label', 'Work Email Address')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@enterprise.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-ocean-200/80 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-300/40 transition-all shadow-tactile-sm"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                {t('auth.password_label', 'Password')}
              </label>
              
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white border border-ocean-200/80 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-300/40 transition-all shadow-tactile-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-mono text-ocean-600 hover:text-ocean-900"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="tactile-btn tactile-btn-primary w-full py-2.5 px-4 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Signing in…</span>
              ) : (
                <span>{t('auth.sign_in_btn', 'Enter Docket Desk →')}</span>
              )}
            </button>
          </form>

        </div>

        {/* Bottom Legal Notice */}
        <div className="pt-6 text-center text-[11px] font-mono text-ink-muted">
          Protected by AES-256 encryption. By logging in, you agree to our{' '}
          <Link to="/about" className="underline hover:text-ocean-700">Terms</Link> and{' '}
          <Link to="/about" className="underline hover:text-ocean-700">Privacy Policy</Link>.
        </div>

      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Redesigned RegisterPage
// ---------------------------------------------------------------------------

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPasswordValid = password.length >= 8;

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await authApi.register({ email, password, role: 'applicant' });
      void navigate('/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas font-sans antialiased text-ink">
      
      {/* Left Showcase Banner */}
      <AuthShowcaseSidebar />

      {/* Right Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 xl:p-14 relative">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between pb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-ocean-700 hover:text-ocean-900 transition-colors font-mono"
          >
            <span>← Back to Platform</span>
          </Link>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-xs text-ink-soft">
              {t('auth.has_account', 'Have an account?')}{' '}
              <Link to="/login" className="text-ocean-600 hover:text-ocean-800 font-bold hover:underline">
                {t('nav.login', 'Sign In →')}
              </Link>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="max-w-md w-full mx-auto my-auto space-y-5 animate-fade-in-up">
          
          <div>
            <span className="stamp-seal stamp-approved text-[10px] mb-2 inline-block">
              NEW APPLICANT REGISTRATION
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-ink tracking-tight">
              {t('auth.register_title', 'Open Your Regulatory Docket')}
            </h1>
            <p className="text-xs text-ink-soft mt-1 leading-relaxed">
              {t('auth.register_sub', 'Initialize your statutory profile to resolve exact prerequisite sequences and clearances.')}
            </p>
          </div>

          {error && <ErrorBanner message={error} />}

          {!isEmbedded && (
            <>
              <div className="pt-1">
                <GoogleSignInButton label="Register with Google" disabled={isLoading} />
              </div>

              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-ocean-200" />
                <span className="bg-canvas px-2.5 text-[10px] uppercase tracking-wider text-ocean-600 font-bold font-mono absolute">
                  or work email
                </span>
              </div>
            </>
          )}

          {/* Registration Form */}
          <form onSubmit={(e) => void submit(e)} className="space-y-3.5">
            
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                {t('auth.email_label', 'Work Email Address')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="founder@enterprise.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-ocean-200/80 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-300/40 transition-all shadow-tactile-sm"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-ocean-950 mb-1">
                {t('auth.password_label', 'Password')} (min 8 characters)
              </label>
              
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white border border-ocean-200/80 text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-300/40 transition-all shadow-tactile-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-mono text-ocean-600 hover:text-ocean-900"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-mono">
                  <span className={isPasswordValid ? 'text-forest-500 font-bold' : 'text-amber-600'}>
                    {isPasswordValid ? '✓ Meets character length' : '⚠ Minimum 8 characters required'}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="tactile-btn tactile-btn-primary w-full py-2.5 px-4 text-xs font-semibold shadow-tactile hover:shadow-glow-cyan flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Creating docket…</span>
              ) : (
                <span>{t('auth.create_account_btn', 'Create Case File Desk →')}</span>
              )}
            </button>
          </form>

        </div>

        {/* Bottom Legal Notice */}
        <div className="pt-6 text-center text-[11px] font-mono text-ink-muted">
          By registering, you agree to ApprovalIQ's{' '}
          <Link to="/about" className="underline hover:text-ocean-700">Terms of Service</Link> and{' '}
          <Link to="/about" className="underline hover:text-ocean-700">Privacy Policy</Link>.
        </div>

      </div>

    </div>
  );
}

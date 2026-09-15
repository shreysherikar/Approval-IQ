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
  Sparkles,
  CheckCircle2,
  Check
} from 'lucide-react';
import { ApiError, authApi } from './api-client';
import { useAuth } from './auth';
import { ErrorBanner, GoogleSignInButton } from './components';
import { LandingPage } from './landing/LandingPage';

export function HomePage(): JSX.Element {
  return <LandingPage />;
}

// ---------------------------------------------------------------------------
// Shared High-Fidelity Enterprise Showcase Sidebar
// ---------------------------------------------------------------------------

function AuthShowcaseSidebar(): JSX.Element {
  return (
    <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white relative overflow-hidden">
      
      {/* Ambient background glows */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none" />

      {/* Top Brand Logo */}
      <div className="relative z-10">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-cyan-300 font-black text-xl">
                A
              </span>
            </div>
          </div>
          <span className="text-2xl font-black tracking-tight text-white">
            Approval<span className="text-cyan-400">IQ</span>
          </span>
        </Link>
      </div>

      {/* Middle Value Proposition & Live Miniature Roadmap */}
      <div className="relative z-10 space-y-8 my-auto py-8">
        
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-cyan-300 text-xs font-bold uppercase tracking-wider font-mono">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Statutory Intelligence Platform
          </div>
          
          <h2 className="text-3xl xl:text-4xl font-black tracking-tight text-white leading-tight">
            Streamline industrial <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-indigo-300">
              clearances across India
            </span>
          </h2>
          
          <p className="text-slate-300 text-sm xl:text-base leading-relaxed max-w-md">
            Instant dependency roadmaps, auto-gated prerequisites, and document deduplication for over 10,450+ central & state regulatory norms.
          </p>
        </div>

        {/* Live Mini Clearance Lifecycle Card */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-2xl backdrop-blur-md space-y-3 max-w-md">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
            <span className="font-bold text-slate-300 font-mono">CRITICAL PATH ROADMAP</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-slate-300" />
              Automated Gating
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="flex items-center gap-2 text-slate-200">
                <Building2 className="w-4 h-4 text-slate-300" />
                <span className="font-semibold">Factory Plan Sanction</span>
              </div>
              <span className="text-slate-200 font-mono font-bold text-[11px] inline-flex items-center gap-1">
                <Check className="w-3 h-3 text-slate-300" /> SANCTIONED
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-blue-950/40 border border-blue-600/40 text-blue-200 shadow-sm">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-slate-300" />
                <span className="font-semibold">Consent to Establish (CTE)</span>
              </div>
              <span className="text-slate-200 font-mono font-bold text-[11px] inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-slate-300" /> READY TO START
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/20 border border-slate-800 text-slate-400 opacity-70">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-slate-400" />
                <span className="font-semibold">Provisional Fire Safety NOC</span>
              </div>
              <span className="text-slate-400 font-mono font-bold text-[11px] inline-flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" /> GATED
              </span>
            </div>
          </div>
        </div>

        {/* Feature Highlights with B&W Icons */}
        <div className="grid grid-cols-2 gap-4 max-w-md pt-2">
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white">Prerequisite Tree</div>
              <div className="text-slate-400 text-[11px]">Zero premature rejections</div>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-slate-300">
            <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-sm shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-white">Smart Document Reuse</div>
              <div className="text-slate-400 text-[11px]">Upload once, reuse across portals</div>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Security & Trust Footer */}
      <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-300" />
          <span>256-Bit Bank Grade Encryption</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <Globe2 className="w-3.5 h-3.5 text-slate-300" />
          <span>Built for Indian Enterprises</span>
        </div>
      </div>

    </div>
  );
}

// ---------------------------------------------------------------------------
// Redesigned LoginPage
// ---------------------------------------------------------------------------

export function LoginPage(): JSX.Element {
  const { login, isLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauthError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const error = formError ?? authError ?? (oauthError ? decodeURIComponent(oauthError) : null);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setFormError(null);
    try {
      await login(email, password);
      void navigate('/projects');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans antialiased">
      
      {/* Left Showcase Banner */}
      <AuthShowcaseSidebar />

      {/* Right Authentication Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 xl:p-16 relative">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between pb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to website</span>
          </Link>

          <div className="text-xs text-slate-500 font-medium">
            New to ApprovalIQ?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold ml-1 hover:underline">
              Create account →
            </Link>
          </div>
        </div>

        {/* Form Card Container */}
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          
          {/* Headline & Subtitle */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold font-mono mb-3 border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-slate-700" />
              <span>Welcome Back</span>
            </div>
            
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Access your regulatory roadmaps, projects, and statutory dossiers.
            </p>
          </div>

          {/* Error Banner */}
          {error && <ErrorBanner message={error} />}

          {/* Google SSO Button */}
          <div className="pt-1">
            <GoogleSignInButton label="Continue with Google" disabled={isLoading} />
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-slate-200" />
            <span className="bg-slate-50 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-bold font-mono absolute">
              or continue with email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all shadow-xs"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                  Password
                </label>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all shadow-xs"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3.5 px-4 shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign in to Dashboard →</span>
              )}
            </button>
          </form>

          {/* Quick Switch to Register */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Don't have an ApprovalIQ account yet?{' '}
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-bold hover:underline">
                Sign up free
              </Link>
            </p>
          </div>

        </div>

        {/* Bottom Legal & Privacy Notice */}
        <div className="pt-8 text-center text-xs text-slate-400">
          Protected by enterprise-grade 256-bit encryption. By logging in, you agree to our{' '}
          <Link to="/about" className="underline hover:text-slate-600">Terms</Link> and{' '}
          <Link to="/about" className="underline hover:text-slate-600">Privacy Policy</Link>.
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
    <div className="min-h-screen flex bg-slate-50 font-sans antialiased">
      
      {/* Left Showcase Banner */}
      <AuthShowcaseSidebar />

      {/* Right Registration Form Area */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 xl:p-16 relative">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between pb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to website</span>
          </Link>

          <div className="text-xs text-slate-500 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold ml-1 hover:underline">
              Sign in →
            </Link>
          </div>
        </div>

        {/* Form Card Container */}
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          
          {/* Headline & Subtitle */}
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold font-mono mb-3 border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-slate-700" />
              <span>30-Second Fast Onboarding</span>
            </div>
            
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Create your account
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Start building your regulatory clearance roadmap for your business.
            </p>
          </div>

          {/* Error Banner */}
          {error && <ErrorBanner message={error} />}

          {/* Google SSO Button */}
          <div className="pt-1">
            <GoogleSignInButton label="Sign up with Google" disabled={isLoading} />
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-slate-200" />
            <span className="bg-slate-50 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-bold font-mono absolute">
              or register with work email
            </span>
          </div>

          {/* Registration Form */}
          <form onSubmit={(e) => void submit(e)} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                  </svg>
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="founder@company.com"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all shadow-xs"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 font-mono">
                Password (min 8 characters)
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-600 transition-all shadow-xs"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Dynamic Password Strength Helper */}
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`inline-flex items-center gap-1.5 font-bold ${isPasswordValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isPasswordValid ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full border border-amber-500 flex-shrink-0" />
                    )}
                    <span>{isPasswordValid ? 'Password meets requirements' : 'At least 8 characters required'}</span>
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordValid}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold py-3.5 px-4 shadow-lg shadow-blue-500/25 active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Creating your account…</span>
                </>
              ) : (
                <span>Create Enterprise Account →</span>
              )}
            </button>
          </form>

          {/* Bottom Switch Link */}
          <div className="text-center pt-2">
            <p className="text-xs text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-bold hover:underline">
                Sign in
              </Link>
            </p>
          </div>

        </div>

        {/* Bottom Legal Notice */}
        <div className="pt-8 text-center text-xs text-slate-400">
          By registering, you agree to ApprovalIQ's{' '}
          <Link to="/about" className="underline hover:text-slate-600">Terms of Service</Link> and{' '}
          <Link to="/about" className="underline hover:text-slate-600">Privacy Policy</Link>.
        </div>

      </div>

    </div>
  );
}

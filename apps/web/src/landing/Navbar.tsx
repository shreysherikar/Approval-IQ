import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth';
import { useLanguage } from '../i18n';
import { LanguageSwitcher } from '../Layout';

export function Navbar({
  onOpenDemo,
  onOpenCommandPalette,
}: {
  onOpenDemo?: () => void;
  onOpenCommandPalette?: () => void;
}): JSX.Element {
  const { isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigate = useNavigate();
  const navLinks = [
    { label: t('nav.product', 'Platform'), href: '#how-it-works', route: '/#how-it-works' },
    { label: t('nav.business_map', 'Cluster Map'), href: '/business-map', route: '/business-map' },
    { label: t('nav.industries', 'Sectors'), href: '#industries', route: '/#industries' },
    { label: t('nav.about', 'About'), href: '/about', route: '/about' },
    { label: t('nav.contact', 'Contact'), href: '/contact', route: '/contact' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, link: { href: string; route: string }) => {
    if (link.href.startsWith('/')) {
      e.preventDefault();
      setIsMobileMenuOpen(false);
      void navigate(link.route);
      return;
    }
    e.preventDefault();
    const targetEl = document.querySelector(link.href);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    } else {
      setIsMobileMenuOpen(false);
      void navigate(link.route);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-ocean-200/90 shadow-tactile-sm py-2.5'
          : 'bg-white/80 backdrop-blur-sm border-b border-ocean-200/50 py-3.5'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-400 to-ocean-600 text-white font-bold text-sm shadow-tactile-sm group-hover:scale-105 group-hover:shadow-glow-cyan transition-all duration-200">
              ▲
            </div>
            <span className="font-editorial text-xl font-bold tracking-tight text-ink">
              Approval<span className="gradient-ocean-text">IQ</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className="text-xs font-semibold text-ink-soft hover:text-ocean-700 hover:bg-ocean-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {link.label}
              </a>
            ))}

            {/* Direct Demo Trigger */}
            <button
              type="button"
              onClick={onOpenDemo}
              className="text-xs font-mono font-medium text-ocean-600 hover:text-ocean-800 px-2 py-1 rounded hover:bg-ocean-50 transition-colors cursor-pointer"
              title="Interactive Clearance Simulation"
            >
              [Demo Access]
            </button>

            {/* Quick ⌘K Command Palette */}
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-ocean-200 bg-ocean-50 text-ocean-700 hover:bg-ocean-100 transition-colors text-xs font-mono shadow-tactile-sm cursor-pointer"
                title="Open Command Palette (⌘K)"
              >
                <span>⌘K</span>
              </button>
            )}
          </nav>

          {/* Right Action Center */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {isAuthenticated ? (
              <>
                <Link
                  to="/projects"
                  className="tactile-btn tactile-btn-primary px-3.5 py-1.5 text-xs shadow-tactile"
                >
                  <span>Dockets Desk →</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    void navigate('/login');
                  }}
                  className="tactile-btn tactile-btn-secondary px-3 py-1.5 text-xs text-ink-soft hover:text-vermilion-500 hover:border-vermilion-200 cursor-pointer flex items-center gap-1.5"
                  title="Sign out of ApprovalIQ"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('nav.logout', 'Sign Out')}</span>
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="tactile-btn tactile-btn-secondary px-3.5 py-1.5 text-xs"
                >
                  {t('nav.login', 'Sign In')}
                </Link>
                <Link
                  to="/register"
                  className="tactile-btn tactile-btn-primary px-3.5 py-1.5 text-xs"
                >
                  {t('nav.register', 'Register Business')}
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="tactile-btn tactile-btn-secondary p-2 text-xs border-ocean-200"
              aria-label="Toggle navigation menu"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {isMobileMenuOpen && (
          <div className="editorial-card mt-3 p-4 bg-white md:hidden border border-ocean-300 shadow-tactile-lg space-y-3 animate-fade-in-up">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link)}
                  className="text-xs font-semibold text-ink py-2 border-b border-ocean-100 uppercase hover:text-ocean-700"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="pt-2 border-t border-ocean-100 flex flex-col gap-2">
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/projects"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="tactile-btn tactile-btn-primary w-full py-2.5 text-xs text-center"
                  >
                    Go to Dockets Desk →
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      logout();
                      void navigate('/login');
                    }}
                    className="tactile-btn tactile-btn-secondary w-full py-2.5 text-xs text-center text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('nav.logout', 'Sign Out')}</span>
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="tactile-btn tactile-btn-secondary w-full py-2.5 text-xs text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="tactile-btn tactile-btn-primary w-full py-2.5 text-xs text-center font-semibold"
                  >
                    Open Docket
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

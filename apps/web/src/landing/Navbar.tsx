import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Navbar({
  onOpenDemo,
  onOpenCommandPalette,
}: {
  onOpenDemo?: () => void;
  onOpenCommandPalette?: () => void;
}): JSX.Element {
  const { isAuthenticated, user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navigate = useNavigate();
  const navLinks = [
    { label: 'Product', href: '#how-it-works', route: '/#how-it-works' },
    { label: 'Business Map', href: '/business-map', route: '/business-map' },
    { label: 'Industries', href: '#industries', route: '/#industries' },
    { label: 'About', href: '/about', route: '/about' },
    { label: 'Contact', href: '/contact', route: '/contact' },
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
          ? 'bg-white/85 backdrop-blur-md border-b border-gray-200/70 shadow-sm py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-violet-500 shadow-md shadow-blue-500/20 text-white font-bold text-xl transition-transform duration-300 group-hover:scale-105">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-1">
                Approval<span className="text-blue-600">IQ</span>
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
            {onOpenDemo && (
              <button
                type="button"
                onClick={onOpenDemo}
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors duration-200"
              >
                Live Demo
              </button>
            )}
          </nav>

          {/* Desktop Auth CTA */}
          <div className="hidden md:flex items-center gap-3">
            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 text-xs font-medium border border-slate-200/70 transition-colors"
                title="Search regulations & clearances (⌘K)"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Search</span>
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono shadow-2xs">
                  ⌘K
                </kbd>
              </button>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/projects"
                  className="rounded-full bg-blue-50 border border-blue-200/80 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition-all duration-200"
                >
                  My Projects
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-slate-100/80 transition-all duration-200"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  <span>Get Started</span>
                  <svg
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-b border-gray-200 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-3 shadow-xl">
          <nav className="flex flex-col space-y-2 pt-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleNavClick(e, link)}
                className="rounded-md px-3 py-2 text-base font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/projects"
                  className="w-full text-center rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow"
                >
                  My Projects ({user?.email})
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-center py-2 text-sm font-medium text-slate-600"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="w-full text-center rounded-lg border border-gray-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-gray-50"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="w-full text-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/25"
                >
                  Get Started →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

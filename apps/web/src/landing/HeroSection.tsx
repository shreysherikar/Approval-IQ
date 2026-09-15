import React from 'react';
import { Link } from 'react-router-dom';
import { HeroImageCarousel } from './HeroImageCarousel';
import { FloatingApprovalCards } from './FloatingApprovalCards';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { HeroGlowBackground } from './HeroGlowBackground';

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOpenCommandPalette?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDemo, onOpenCommandPalette }) => {
  return (
    <section className="relative pt-24 pb-12 lg:pt-28 lg:pb-16 overflow-hidden">
      {/* Interactive Mouse-Following Radial Glow and Grid Mesh */}
      <HeroGlowBackground />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
          
          {/* Left Hero Column: Typography & CTAs (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col items-start z-10">
            {/* Badges Row: Simplifying Compliance + Live System Status */}
            <div className="flex flex-wrap items-center gap-2.5 mb-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/80 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-semibold text-blue-900 tracking-wide">
                  Simplifying Compliance
                </span>
              </div>
              <SystemStatusIndicator />
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              From Regulations to Approvals —{' '}
              <span className="text-gradient-primary block sm:inline mt-1 sm:mt-0">
                Smarter, Faster, Together.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              AI-powered guidance for permits, licenses, and regulatory approvals — so you can focus on building what matters.
            </p>

            {/* CTA Group */}
            <div className="mt-8 flex flex-wrap items-center gap-4 w-full sm:w-auto">
              <Link
                to="/register"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-base shadow-lg shadow-blue-500/25 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>Get Started</span>
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>

              <button
                type="button"
                onClick={onOpenDemo}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-blue-600 font-semibold text-base border border-slate-200/90 shadow-sm transition-all duration-200 hover:border-blue-300"
              >
                <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <svg className="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span>Watch Demo</span>
              </button>

              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="hidden xl:inline-flex items-center gap-2 px-4 py-3.5 rounded-xl bg-slate-100/90 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium border border-slate-200/80 transition-all"
                  title="Search regulations & clearances"
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
            </div>

            {/* 3 Compact Feature Highlights */}
            <div className="mt-10 pt-8 border-t border-slate-200/70 w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 leading-tight">AI-Powered</div>
                  <div className="text-[11px] text-slate-500">Guidance</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 leading-tight">Real-Time</div>
                  <div className="text-[11px] text-slate-500">Norms Mapping</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800 leading-tight">End-to-End</div>
                  <div className="text-[11px] text-slate-500">Track Approvals</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Hero Column: Large Visual Showcase + Image Carousel + Floating UI Cards (7 cols on lg) */}
          <div className="lg:col-span-7 relative h-[460px] sm:h-[540px] md:h-[580px] w-full rounded-3xl overflow-hidden shadow-2xl border border-white/60 bg-slate-900">
            {/* The Dynamic 3s rotating Ken Burns Carousel */}
            <HeroImageCarousel />

            {/* The Floating UI Cards overlay (Business profile, Applicable norms, etc.) */}
            <FloatingApprovalCards />
          </div>

        </div>
      </div>
    </section>
  );
};

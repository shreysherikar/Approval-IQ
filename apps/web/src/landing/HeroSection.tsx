import React from 'react';
import { Link } from 'react-router-dom';
import { HeroImageCarousel } from './HeroImageCarousel';
import { FloatingApprovalCards } from './FloatingApprovalCards';
import { useLanguage } from '../i18n';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onOpenDemo: () => void;
  onOpenCommandPalette?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenDemo, onOpenCommandPalette }) => {
  const { t } = useLanguage();

  return (
    <section className="relative pt-24 pb-14 lg:pt-28 lg:pb-20 overflow-hidden border-b border-ocean-200/80 bg-transparent text-ink">
      {/* Luminous Ambient Background Glow */}
      <div className="absolute top-0 left-1/4 w-[32rem] h-[32rem] bg-ocean-300/20 rounded-full blur-[110px] pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute bottom-0 right-1/4 w-[28rem] h-[28rem] bg-cyan-200/30 rounded-full blur-[100px] pointer-events-none -z-10 animate-float" />
      <div className="absolute top-1/2 left-10 w-80 h-80 bg-amber-200/25 rounded-full blur-3xl pointer-events-none -z-10 animate-float-slow" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Column: Editorial Headline & Actions */}
          <div className="lg:col-span-6 flex flex-col items-start z-10 space-y-6 text-left">
            
            {/* Editorial Headline */}
            <h1 className="font-editorial text-3xl sm:text-4xl md:text-5xl lg:text-[48px] font-bold text-ink tracking-tight leading-[1.12]">
              {t('hero.headline_part1', 'From Statutory Filings to Commissioning — ')}
              <span className="gradient-ocean-text block sm:inline">
                {t('hero.headline_part2', 'Deterministic, Sequenced, Guaranteed.')}
              </span>
            </h1>

            {/* Plain-Language Subtitle */}
            <p className="text-sm sm:text-base text-ink-soft leading-relaxed max-w-xl font-sans">
              {t(
                'hero.subheading',
                'Personalized regulatory roadmap resolving exact prerequisite sequences, document de-duplication, multi-agency joint inspections, and statutory Right to Services SLAs.'
              )}
            </p>

            {/* Tactile Action Group */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto pt-2">
              <Link
                to="/register"
                className="tactile-btn tactile-btn-primary px-6 py-3.5 text-sm flex items-center gap-2 shadow-tactile group"
              >
                <span>{t('hero.get_started', 'Generate Regulatory Roadmap')}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <button
                type="button"
                onClick={onOpenDemo}
                className="tactile-btn tactile-btn-secondary px-5 py-3.5 text-sm flex items-center gap-2"
              >
                <span>{t('hero.watch_demo', 'Demo Credentials')}</span>
              </button>

              {onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  className="tactile-btn px-4 py-3.5 text-xs rounded-lg font-mono bg-white text-ocean-800 border border-ocean-300 hover:bg-ocean-50 shadow-tactile-sm"
                  title="Search regulations & clearances (⌘K)"
                >
                  <span>⌘K</span>
                </button>
              )}
            </div>

            {/* Trust Pillar Grid */}
            <div className="pt-6 border-t border-ocean-200/80 w-full grid grid-cols-3 gap-3">
              <div className="p-2.5 rounded-xl bg-white/80 border border-ocean-200/80 shadow-tactile-sm hover:border-ocean-300 transition-colors">
                <div className="font-mono font-bold text-xs text-ocean-700">{t('hero.feature_ai', 'DAG Critical Path')}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{t('hero.feature_ai_sub', 'Predecessor sequencing')}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-ocean-200/80 shadow-tactile-sm hover:border-ocean-300 transition-colors">
                <div className="font-mono font-bold text-xs text-amber-700">{t('hero.feature_rts', 'RTS Protected')}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{t('hero.feature_rts_sub', 'Enforceable SLA timers')}</div>
              </div>

              <div className="p-2.5 rounded-xl bg-white/80 border border-ocean-200/80 shadow-tactile-sm hover:border-ocean-300 transition-colors">
                <div className="font-mono font-bold text-xs text-emerald-700">{t('hero.feature_docs', 'Zero Redundancy')}</div>
                <div className="text-[11px] text-ink-muted mt-0.5">{t('hero.feature_docs_sub', 'Multi-desk OCR reuse')}</div>
              </div>
            </div>
          </div>

          {/* Right Column: High Quality Photography Gallery + Floating Status Card */}
          <div className="lg:col-span-6 relative h-[420px] sm:h-[480px] md:h-[520px] w-full rounded-2xl overflow-hidden shadow-2xl border border-ocean-200/90 bg-white/70 backdrop-blur-sm">
            <HeroImageCarousel />
            <FloatingApprovalCards />
          </div>

        </div>
      </div>
    </section>
  );
};

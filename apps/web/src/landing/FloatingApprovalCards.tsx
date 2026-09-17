import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n';
import { Check, Clock, FileText, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

export const FloatingApprovalCards: React.FC = () => {
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState(3);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-cycle through the 4 steps with smooth transition
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [isPaused]);

  const STAGES = [
    {
      id: 0,
      title: t('hero.card_profile', 'Business Profile'),
      subtitle: t('hero.card_profile_sub', 'Brewery & Distillery · Pune'),
      icon: <Check className="w-3.5 h-3.5" />,
      iconBg: 'bg-forest-50 text-forest-600',
      badgeText: 'DONE',
      badgeClass: 'stamp-approved',
      statusMsg: 'Statutory parameters recorded',
    },
    {
      id: 1,
      title: t('hero.card_norms', 'Statutory NOCs'),
      subtitle: t('hero.card_norms_sub', 'MPCB CTE, Fire CFO, DISH'),
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      iconBg: 'bg-ocean-50 text-ocean-600',
      badgeText: 'GATED',
      badgeClass: 'stamp-approved',
      statusMsg: 'Predecessor conditions locked',
    },
    {
      id: 2,
      title: t('hero.card_docs', 'Evidence Vault'),
      subtitle: t('hero.card_docs_sub', 'OCR Verified & De-duplicated'),
      icon: <FileText className="w-3.5 h-3.5" />,
      iconBg: 'bg-ocean-50 text-ocean-700',
      badgeText: 'VERIFIED',
      badgeClass: 'stamp-approved',
      statusMsg: 'Multi-desk cross-reuse active',
    },
    {
      id: 3,
      title: t('hero.card_review', 'RTS SLA Mandate'),
      subtitle: t('hero.card_review_sub', '14 Days Guaranteed'),
      icon: <Clock className="w-3.5 h-3.5" />,
      iconBg: 'bg-amber-100 text-amber-600',
      badgeText: 'TRACKING',
      badgeClass: 'stamp-pending',
      statusMsg: 'Statutory countdown running',
    },
  ];

  return (
    <div 
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-[92%] max-w-[370px] sm:max-w-[400px] animate-float"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="glass-surface rounded-2xl p-4 sm:p-5 shadow-tactile-lg border border-white/95 space-y-3.5 backdrop-blur-2xl transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-ocean-200/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-forest-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-ocean-950">
              {t('hero.card_engine', 'Clearance Engine')}
            </span>
          </div>
          <span className="stamp-seal stamp-approved text-[10px] shadow-sm">
            <Sparkles className="w-3 h-3 text-forest-600 inline mr-1 animate-pulse" />
            {t('hero.card_single_window', 'Single Window')}
          </span>
        </div>

        {/* Dynamic Progress Bar Tracer */}
        <div className="grid grid-cols-4 gap-1.5 py-0.5">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveStep(s.id)}
              className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
                s.id === activeStep
                  ? 'bg-gradient-to-r from-ocean-400 to-ocean-600 shadow-[0_0_10px_rgba(14,139,178,0.7)] scale-y-125'
                  : s.id < activeStep
                  ? 'bg-forest-500'
                  : 'bg-ocean-100 hover:bg-ocean-200'
              }`}
              title={`Stage ${s.id + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* Step Rows */}
        <div className="space-y-2">
          {STAGES.map((s) => {
            const isHighlighted = s.id === activeStep;
            return (
              <div
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                  isHighlighted
                    ? 'bg-white border-ocean-500 shadow-glow-cyan/25 scale-[1.02] translate-x-1'
                    : 'bg-white/70 border-ocean-200/60 hover:bg-white hover:border-ocean-300 shadow-tactile-sm'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-lg ${s.iconBg} flex items-center justify-center font-bold text-xs shrink-0 transition-transform ${isHighlighted ? 'scale-110 shadow-sm' : ''}`}>
                    {s.icon}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-ink truncate flex items-center gap-1.5">
                      <span>{s.title}</span>
                      {isHighlighted && (
                        <span className="w-1.5 h-1.5 rounded-full bg-ocean-500 animate-ping" />
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-ink-muted truncate">
                      {isHighlighted ? s.statusMsg : s.subtitle}
                    </div>
                  </div>
                </div>
                <span className={`stamp-seal text-[9px] shrink-0 transition-all ${s.badgeClass} ${isHighlighted ? 'shadow-sm' : 'opacity-80'}`}>
                  {s.badgeText}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer Info with Dynamic Active Milestone */}
        <div className="pt-2.5 border-t border-ocean-200/80 flex items-center justify-between text-[11px] font-mono text-ocean-900">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ocean-500" />
            <span className="font-semibold">{STAGES[activeStep]!.title}</span>
          </div>
          <span className="text-forest-600 font-bold flex items-center gap-1">
            <span>Deterministic</span>
            <ArrowRight className="w-3 h-3 text-forest-600" />
          </span>
        </div>

      </div>
    </div>
  );
};

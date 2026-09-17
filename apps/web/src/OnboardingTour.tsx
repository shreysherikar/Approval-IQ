import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';

export interface TourStep {
  id: string;
  stationNumber: number;
  title: string;
  badge: string;
  description: string;
  founderAction: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'profile',
    stationNumber: 1,
    title: 'Statutory Business Profile',
    badge: 'STAGE 1: DOSSIER',
    description: 'Configure your company parameters (land zoning, power load, water discharge, and investment scale) to trigger precise regulatory evaluations.',
    founderAction: 'Ensure built-up area and power capacity match your registered lease deed to avoid consistency rejections.',
  },
  {
    id: 'roadmap',
    stationNumber: 2,
    title: 'Deterministic DAG Route Map',
    badge: 'STAGE 2: DEPENDENCY DAG',
    description: 'The approval engine resolves the critical path of clearances — highlighting parallel approvals vs predecessor prerequisites.',
    founderAction: 'Always secure MPCB Consent to Establish prior to applying for State Excise or Fire CFO Provisional NOC.',
  },
  {
    id: 'documents',
    stationNumber: 3,
    title: 'Evidence Vault & Cross-Reuse',
    badge: 'STAGE 3: EVIDENCE VAULT',
    description: 'Upload statutory documents once. OCR metadata extraction validates consistency and reuses files across multiple authority desks.',
    founderAction: 'Duplicate files are automatically linked to prevent redundant fee penalties and repeated submissions.',
  },
  {
    id: 'deadlines',
    stationNumber: 4,
    title: 'RTS Statutory Legal Protection',
    badge: 'STAGE 4: RTS TIMERS',
    description: 'Enforce statutory turnaround times guaranteed under the Right to Public Services Act with live countdown timers and auto-appeals.',
    founderAction: 'If an authority exceeds statutory SLA limits, Form 1 Appellate review is prepared with one click.',
  },
  {
    id: 'dashboard',
    stationNumber: 5,
    title: 'Unified Founder Command Center',
    badge: 'STAGE 5: EXECUTIVE DESK',
    description: 'Track overall roadmap progress, upcoming renewals, cost estimates, and recommended next actions from one central desk.',
    founderAction: 'Check the "Recommended Next Action" card daily for instant clearance unblocking.',
  },
];

const ONBOARDING_STORAGE_KEY = 'approvaliq_founder_tour_v1';

export function OnboardingTour(): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    try {
      const isCompleted = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!isCompleted) {
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage exceptions in restricted modes
    }
  }, []);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // Ignore
    }
    setIsOpen(false);
  };

  const handleRestartTour = () => {
    setCurrentStepIndex(0);
    setIsOpen(true);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleRestartTour}
        className="tactile-btn tactile-btn-secondary px-2.5 py-1 text-xs text-ocean-700 hover:text-ocean-900 border-ocean-200/80 hover:border-ocean-400 font-mono flex items-center gap-1.5 shadow-tactile-sm"
        title="Start Guided Founder Tutorial"
      >
        <Sparkles className="w-3 h-3 text-ocean-500 animate-pulse" />
        <span>Guided Tour</span>
      </button>
    );
  }

  const step = TOUR_STEPS[currentStepIndex];
  if (!step) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ocean-950/60 backdrop-blur-md p-4 animate-fade-in-up" role="dialog" aria-modal="true">
      <div className="editorial-card w-full max-w-lg bg-white/95 p-6 relative shadow-tactile-lg border border-ocean-300/80">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-ocean-200/80 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="stamp-seal stamp-approved text-[10px]">
              {step.badge}
            </span>
            <span className="font-mono text-xs text-ink-muted">
              Step {step.stationNumber} of {TOUR_STEPS.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs font-mono text-ocean-600 hover:text-ocean-900 uppercase tracking-wider transition-colors"
            aria-label="Skip Tutorial"
          >
            [Skip]
          </button>
        </div>

        {/* Progress Dots with glowing active step */}
        <div className="flex items-center gap-1.5 mb-5">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                idx <= currentStepIndex
                  ? 'bg-gradient-to-r from-ocean-400 to-ocean-600 shadow-[0_0_8px_rgba(14,139,178,0.5)]'
                  : 'bg-ocean-100'
              }`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="space-y-3 mb-6">
          <h3 className="font-editorial text-xl font-bold text-ink tracking-tight">
            {step.title}
          </h3>
          <p className="text-xs text-ink-soft leading-relaxed">
            {step.description}
          </p>

          <div className="bg-ocean-50/80 p-3.5 rounded-lg border border-ocean-200/80 text-xs space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold text-ocean-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-ocean-500" />
              <span>Founder Recommendation:</span>
            </span>
            <p className="text-ink-soft text-[11px] leading-normal font-sans">
              {step.founderAction}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-ocean-200/80 pt-4">
          <button
            type="button"
            disabled={currentStepIndex === 0}
            onClick={handlePrev}
            className="tactile-btn tactile-btn-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleComplete}
              className="tactile-btn tactile-btn-secondary px-3.5 py-1.5 text-xs text-ink-soft hover:bg-ocean-50"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="tactile-btn tactile-btn-primary px-4 py-1.5 text-xs flex items-center gap-1.5 shadow-tactile hover:shadow-glow-cyan"
            >
              <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish Tutorial' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

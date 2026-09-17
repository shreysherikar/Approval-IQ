import React, { useState, useEffect } from 'react';
import { FileText, Check, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n';

export const DocumentToDecisionFlow: React.FC = () => {
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    {
      title: t('flow.step1_title', '1. Ingest Application & Files'),
      desc: t('flow.step1_desc', 'Raw PDF permits, site maps & statutory forms uploaded.'),
      tag: t('flow.step1_tag', 'Raw Input'),
      color: 'border-ocean-400/50 bg-ocean-500/15 text-ocean-300',
    },
    {
      title: t('flow.step2_title', '2. AI Extraction & Classification'),
      desc: t('flow.step2_desc', 'OCR & entity parsing extracts 24 key statutory data points.'),
      tag: t('flow.step2_tag', 'OCR Parsing'),
      color: 'border-cyan-400/50 bg-cyan-500/15 text-cyan-300',
    },
    {
      title: t('flow.step3_title', '3. Compliance Graph Validation'),
      desc: t('flow.step3_desc', 'Mapped against 10,000+ central & state regulatory frameworks.'),
      tag: t('flow.step3_tag', 'DAG Check'),
      color: 'border-ocean-300/50 bg-ocean-400/15 text-ocean-200',
    },
    {
      title: t('flow.step4_title', '4. Statutory Approval Ready'),
      desc: t('flow.step4_desc', 'Complete filing pack generated with 98% first-pass accuracy.'),
      tag: t('flow.step4_tag', 'Submission Ready'),
      color: 'border-forest-500/50 bg-forest-500/15 text-forest-400',
    },
  ];

  return (
    <div className="bg-[#072633]/95 backdrop-blur-xl border border-ocean-500/40 rounded-3xl p-6 sm:p-8 shadow-glow-cyan/20 text-left max-w-xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-ocean-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-ocean-400 to-ocean-600 text-white flex items-center justify-center font-mono text-xs font-bold shadow-glow-cyan/20">
            0→1
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>{t('flow.lifecycle_title', 'Document → Decision Lifecycle')}</span>
            </div>
            <div className="text-[11px] text-ocean-300/80 font-mono">{t('flow.lifecycle_sub', 'Automated Pipeline Simulation')}</div>
          </div>
        </div>
        <span className="text-[11px] font-mono text-ocean-300 bg-ocean-900/80 border border-ocean-600/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ocean-400 animate-pulse" />
          <span>{t('flow.live_cycle', 'Live Cycle')}</span>
        </span>
      </div>

      {/* Progress Line with Glowing Tracer */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {steps.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveStep(idx)}
            className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${
              idx === activeStep
                ? 'bg-gradient-to-r from-ocean-300 via-cyan-400 to-ocean-500 shadow-[0_0_12px_rgba(56,172,204,0.8)] scale-y-125'
                : idx < activeStep
                ? 'bg-forest-500'
                : 'bg-ocean-900/80'
            }`}
          />
        ))}
      </div>

      {/* Dynamic Content Display Card */}
      <div className="rounded-2xl bg-ocean-950/80 border border-ocean-800/80 p-4 sm:p-5 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${steps[activeStep]!.color}`}>
            {steps[activeStep]!.tag}
          </span>
          <span className="text-xs font-mono text-ocean-400">
            {t('flow.step_of', `Step ${activeStep + 1} of 4`).replace('{current}', String(activeStep + 1)).replace('{total}', '4')}
          </span>
        </div>

        <h4 className="text-base font-bold text-white mb-1">
          {steps[activeStep]!.title}
        </h4>
        <p className="text-xs text-ocean-200/80 leading-relaxed mb-4 font-sans">
          {steps[activeStep]!.desc}
        </p>

        {/* Mini simulated data preview based on step */}
        {activeStep === 0 && (
          <div className="p-3 rounded-xl bg-[#092b3a] border border-ocean-700/60 text-xs font-mono text-ocean-100 flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-ocean-400 shrink-0" />
              <span>Project_Master_Filing_2026.pdf</span>
            </div>
            <span className="text-ocean-400 text-[11px]">4.2 MB • Uploaded</span>
          </div>
        )}

        {activeStep === 1 && (
          <div className="p-3 rounded-xl bg-[#092b3a] border border-ocean-700/60 text-xs font-mono space-y-1.5 animate-fade-in-up">
            <div className="flex justify-between text-ocean-300 text-[11px]">
              <span>Extracting statutory entities...</span>
              <span className="text-cyan-400 font-bold">96% confidence</span>
            </div>
            <div className="w-full bg-ocean-950 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-ocean-500 h-full w-[96%] animate-pulse" />
            </div>
            <div className="text-[10px] text-ocean-200 pt-1 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Entity: APEX CHEMICALS LTD • Location: Bharuch, GJ • CTE Form-1B</span>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="p-3 rounded-xl bg-[#092b3a] border border-ocean-700/60 text-xs font-mono space-y-1.5 animate-fade-in-up">
            <div className="text-ocean-300 font-bold flex items-center gap-1.5">
              <Check className="w-3 h-3 text-ocean-400 shrink-0" />
              <span>Central Rules: MoEFCC 2006 EIA Notification</span>
            </div>
            <div className="text-ocean-300 font-bold flex items-center gap-1.5">
              <Check className="w-3 h-3 text-ocean-400 shrink-0" />
              <span>State Rules: GPCB Water & Air Consents</span>
            </div>
            <div className="text-forest-400 font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-forest-400 shrink-0" />
              <span>8 Required Clearances Identified</span>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="p-3 rounded-xl bg-forest-950/40 border border-forest-600/60 text-xs font-mono text-forest-300 flex items-center justify-between animate-fade-in-up">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-forest-400 shrink-0" />
              <span className="font-bold">Dossier Approved & Submission Ready</span>
            </div>
            <span className="text-[11px] bg-forest-900/60 text-forest-200 px-2.5 py-0.5 rounded-full font-bold">
              Ready
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

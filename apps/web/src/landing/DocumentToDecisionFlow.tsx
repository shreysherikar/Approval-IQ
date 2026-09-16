import React, { useState, useEffect } from 'react';
import { FileText, Check } from 'lucide-react';
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
      color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
    },
    {
      title: t('flow.step2_title', '2. AI Extraction & Classification'),
      desc: t('flow.step2_desc', 'OCR & entity parsing extracts 24 key statutory data points.'),
      tag: t('flow.step2_tag', 'AI Parsing'),
      color: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
    },
    {
      title: t('flow.step3_title', '3. Compliance Graph Validation'),
      desc: t('flow.step3_desc', 'Mapped against 10,000+ central & state regulatory frameworks.'),
      tag: t('flow.step3_tag', 'Graph Check'),
      color: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400',
    },
    {
      title: t('flow.step4_title', '4. Statutory Approval Ready'),
      desc: t('flow.step4_desc', 'Complete filing pack generated with 98% first-pass accuracy.'),
      tag: t('flow.step4_tag', 'Submission Ready'),
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
    },
  ];

  return (
    <div className="bg-[#0b1329]/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-left max-w-xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center font-mono text-xs font-bold">
            0→1
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">
              {t('flow.lifecycle_title', 'Document → Decision Lifecycle')}
            </div>
            <div className="text-[11px] text-slate-400">{t('flow.lifecycle_sub', 'Automated Pipeline Simulation')}</div>
          </div>
        </div>
        <span className="text-[11px] font-mono text-blue-400 bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 rounded-full">
          {t('flow.live_cycle', 'Live Cycle')}
        </span>
      </div>

      {/* Progress Line */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {steps.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveStep(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              idx === activeStep
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                : idx < activeStep
                ? 'bg-emerald-500'
                : 'bg-slate-800'
            }`}
          />
        ))}
      </div>

      {/* Dynamic Content Display Card */}
      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 sm:p-5 transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${steps[activeStep]!.color}`}>
            {steps[activeStep]!.tag}
          </span>
          <span className="text-xs font-mono text-slate-500">
            {t('flow.step_of', `Step ${activeStep + 1} of 4`).replace('{current}', String(activeStep + 1)).replace('{total}', '4')}
          </span>
        </div>

        <h4 className="text-base font-bold text-white mb-1">
          {steps[activeStep]!.title}
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed mb-4">
          {steps[activeStep]!.desc}
        </p>

        {/* Mini simulated data preview based on step */}
        {activeStep === 0 && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Project_Master_Filing_2026.pdf</span>
            </div>
            <span className="text-slate-500 text-[11px]">4.2 MB • Uploaded</span>
          </div>
        )}

        {activeStep === 1 && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-1.5">
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>Extracting statutory entities...</span>
              <span className="text-purple-400 font-bold">96% confidence</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-500 h-full w-[96%] animate-pulse" />
            </div>
            <div className="text-[10px] text-slate-400 pt-1 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-purple-400 shrink-0" />
              <span>Entity: APEX CHEMICALS LTD • Location: Bharuch, GJ • CTE Form-1B</span>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono space-y-1.5">
            <div className="text-indigo-400 font-bold flex items-center gap-1.5">
              <Check className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>Central Rules: MoEFCC 2006 EIA Notification</span>
            </div>
            <div className="text-indigo-400 font-bold flex items-center gap-1.5">
              <Check className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>State Rules: GPCB Water & Air Consents</span>
            </div>
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>8 Required Clearances Identified</span>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs font-mono text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold">Dossier Approved & Submission Ready</span>
            </div>
            <span className="text-[11px] bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded">
              Ready
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

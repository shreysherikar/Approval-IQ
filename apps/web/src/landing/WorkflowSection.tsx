import React from 'react';
import { useLanguage } from '../i18n';
import { CheckCircle2, Sparkles } from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const { t } = useLanguage();

  const WORKFLOW_STEPS = [
    {
      step: '01',
      title: t('workflow.step1_title', 'Statutory Intake Questionnaire'),
      desc: t('workflow.step1_desc', 'Input business activity, project scale, state jurisdiction, and power/effluent requirements to calibrate exact statutory triggers.'),
      badge: 'STAGE 1',
    },
    {
      step: '02',
      title: t('workflow.step2_title', 'Deterministic DAG Routing'),
      desc: t('workflow.step2_desc', 'ApprovalIQ computes the topological critical path, isolating predecessor clearances (e.g. Consent to Establish) from parallel applications.'),
      badge: 'STAGE 2',
    },
    {
      step: '03',
      title: t('workflow.step3_title', 'Single-Dossier Evidence Vault'),
      desc: t('workflow.step3_desc', 'Upload statutory files once. Multi-authority OCR validation de-duplicates documents and cross-links them across 7+ departments.'),
      badge: 'STAGE 3',
    },
    {
      step: '04',
      title: t('workflow.step4_title', 'Joint Inspections & RTS Enforcement'),
      desc: t('workflow.step4_desc', 'Coordinate multi-department site visits on a single date, download Form JIC-1 certificates, and enforce statutory SLA deadlines.'),
      badge: 'STAGE 4',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 lg:py-24 bg-ocean-50/50 border-b border-ocean-200/80 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-ocean-200/30 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-ocean-300/20 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5">
          <span className="stamp-seal stamp-approved text-[10px] shadow-sm">
            <Sparkles className="w-3 h-3 text-forest-600 inline mr-1" />
            {t('workflow.tag', 'THE STATUTORY COMPLIANCE ARCHITECTURE')}
          </span>
          <h2 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-ink tracking-tight">
            {t('workflow.title', 'How ApprovalIQ Solves the Regulatory Maze')}
          </h2>
          <p className="text-xs sm:text-sm text-ink-soft leading-relaxed">
            {t('workflow.subtitle', 'A 4-stage deterministic process eliminating redundant submissions and unblocking critical path approvals.')}
          </p>
        </div>

        {/* Steps Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.step}
              className="editorial-card p-5 bg-white flex flex-col justify-between space-y-4 hover:border-ocean-400 hover:shadow-glow-cyan/20 transition-all duration-300 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-ocean-100 pb-2.5">
                  <span className="font-mono text-xs font-bold text-ocean-600">
                    {step.badge}
                  </span>
                  <span className="font-mono text-lg font-bold text-ocean-300 group-hover:text-ocean-500 transition-colors">
                    {step.step}
                  </span>
                </div>
                <h3 className="font-editorial text-base font-bold text-ink leading-snug group-hover:text-ocean-950">
                  {step.title}
                </h3>
                <p className="text-xs text-ink-soft leading-relaxed font-sans">
                  {step.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-ocean-100 flex items-center justify-between text-[11px] font-mono text-ocean-700">
                <span>Statutory Rule Validated</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-forest-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { useLanguage } from '../i18n';

type Role = 'applicant' | 'officer' | 'admin';

export const RoleSwitcherSection: React.FC = () => {
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<Role>('applicant');

  const roles = [
    {
      id: 'applicant' as Role,
      name: t('roles.applicant_name', 'Applicant / Business'),
      badge: t('roles.applicant_badge', 'Entrepreneurs & MSMEs'),
      headline: t('roles.applicant_headline', 'Accelerate your statutory journey with AI guidance'),
      description: t('roles.applicant_desc', 'Never worry about missed clearances or rejected applications again. Create your business profile and let ApprovalIQ navigate state & central regulatory frameworks.'),
      points: [
        t('roles.applicant_p1', 'Automated industry classification & norms matrix'),
        t('roles.applicant_p2', 'Pre-submission document verification & OCR check'),
        t('roles.applicant_p3', 'Single-window status tracking across all departments'),
        t('roles.applicant_p4', 'Automated renewal & compliance calendar alerts'),
      ],
      mockup: {
        title: t('roles.applicant_mock_title', 'Applicant Project Workspace'),
        items: [
          { label: 'Project', value: 'Bangalore Biotech Hub Unit-1' },
          { label: 'Identified Clearances', value: '6 of 6 Mapped', badge: 'Ready' },
          { label: 'Documentation Score', value: '100% Complete', badge: 'Verified' },
          { label: 'Submission Status', value: 'Dispatched to SPCB & FSSAI', badge: 'In Review' },
        ],
        actionText: t('roles.applicant_mock_action', 'Submit New Application →'),
      },
    },
    {
      id: 'officer' as Role,
      name: t('roles.officer_name', 'Regulatory Reviewer'),
      badge: t('roles.officer_badge', 'Statutory Review & Desk Assessment'),
      headline: t('roles.officer_headline', 'Structured, pre-verified dossiers ready for faster review'),
      description: t('roles.officer_desc', 'Eliminate paperwork backlog with AI-indexed dossiers, standardized affidavits, and automated completeness checks.'),
      points: [
        'Instant validation of statutory prerequisites',
        'Unified view of state, municipal, and central permissions',
        'Automated discrepancy flagging and query generation',
        'Full timestamped audit trail of every review action',
      ],
      mockup: {
        title: 'Reviewer Assessment Console',
        items: [
          { label: 'Application Queue', value: '12 Applications Pending' },
          { label: 'AI Pre-Audit', value: 'Zero Missing Prerequisite Forms', badge: 'Pass' },
          { label: 'Site Inspection', value: 'Coordinates Verified', badge: 'GIS Matched' },
          { label: 'Clearance Action', value: 'Consent to Establish (CTE) Form 1B', badge: 'Approve' },
        ],
        actionText: 'Review Next Dossier →',
      },
    },
    {
      id: 'admin' as Role,
      name: t('roles.admin_name', 'Enterprise Compliance Lead'),
      badge: t('roles.admin_badge', 'Multi-State Governance & Risk'),
      headline: t('roles.admin_headline', 'Real-time visibility across multi-state operations'),
      description: t('roles.admin_desc', 'Track regulatory posture across factories, warehouses, and branches throughout India with unified reporting.'),
      points: [
        'Enterprise-wide compliance health score',
        'State-by-state regulatory risk breakdown',
        'Automated statutory deadline tracking & escalation',
        'SOC2 and ISO 27001 compliant audit export',
      ],
      mockup: {
        title: 'Enterprise Governance Dashboard',
        items: [
          { label: 'Active Facilities', value: '18 Plants in 7 States' },
          { label: 'Overall Compliance Index', value: '99.4% On Schedule', badge: 'Optimal' },
          { label: 'Upcoming Renewals', value: '3 Licenses in next 60 Days', badge: 'Tracked' },
          { label: 'Audit Readiness', value: 'Complete Digital Trail', badge: 'Ready' },
        ],
        actionText: 'Export Audit Dossier →',
      },
    },
  ];

  const role = roles.find((r) => r.id === selectedRole) ?? roles[0]!;

  return (
    <section className="py-20 lg:py-28 bg-[#070d1e] text-white relative overflow-hidden border-t border-slate-800">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/4 w-[35rem] h-[35rem] bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">
            {t('roles.tag', 'DESIGNED FOR EVERY STAKEHOLDER')}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {t('roles.title', 'One Intelligent Platform. Three Tailored Experiences.')}
          </h2>
          <p className="mt-4 text-slate-300 text-sm sm:text-base">
            {t('roles.subtitle', 'Whether you are launching a new industrial unit or overseeing nationwide compliance, ApprovalIQ empowers your workflow.')}
          </p>
        </div>

        {/* Role Switcher Tabs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {roles.map((r) => {
            const isSelected = r.id === selectedRole;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRole(r.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-500/30 scale-105'
                    : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>

        {/* Role Content Showcase */}
        <div className="mt-12 bg-[#0b1329]/95 border border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left description */}
            <div className="lg:col-span-6 space-y-5">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/80 border border-blue-800/80 text-blue-300">
                {role.badge}
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                {role.headline}
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                {role.description}
              </p>

              <div className="space-y-2.5 pt-2">
                {role.points.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-slate-200">
                    <span className="w-5 h-5 rounded-full bg-blue-900/60 border border-blue-600/50 flex items-center justify-center text-blue-400 shrink-0">
                      <Check className="w-3 h-3 text-blue-400" />
                    </span>
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-md transition-all hover:scale-105"
                >
                  <span>Explore {role.name} Flow</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right Mockup Screen */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl bg-slate-950 border border-slate-800 p-5 sm:p-6 shadow-2xl text-left font-mono">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs text-slate-400">{role.mockup.title}</span>
                </div>

                <div className="space-y-3 font-sans">
                  {role.mockup.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs"
                    >
                      <div>
                        <div className="text-slate-400 text-[11px]">{it.label}</div>
                        <div className="text-white font-semibold mt-0.5">{it.value}</div>
                      </div>
                      {it.badge && (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-950 border border-blue-800 text-blue-300">
                          {it.badge}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800 flex justify-end">
                  <Link
                    to="/register"
                    className="text-xs font-sans font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5"
                  >
                    <span>{role.mockup.actionText}</span>
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};

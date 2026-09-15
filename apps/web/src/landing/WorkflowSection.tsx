import React from 'react';
import { Link } from 'react-router-dom';

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Profile Your Business',
    desc: 'Enter your business activity, project scale, state, and location. Our system instantly categorizes your industry classification.',
    badge: 'Step 1',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'AI Regulatory Engine Maps Norms',
    desc: 'ApprovalIQ analyzes central, state, and local environmental, labor, fire, and industrial statutes to generate your bespoke compliance matrix.',
    badge: 'Step 2',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Pre-Audit & Document Prep',
    desc: 'Automated checklists, affidavit templates, and file validation ensure every application is error-free prior to formal submission.',
    badge: 'Step 3',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Track End-to-End Clearance',
    desc: 'Monitor department reviews, statutory timelines, queries, and license grants via a single unified dashboard.',
    badge: 'Step 4',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export const WorkflowSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-slate-50/60 border-y border-slate-200/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-xs font-bold uppercase tracking-widest text-brand-primary-600 mb-2">
            INTELLIGENT COMPLIANCE PIPELINE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How ApprovalIQ Streamlines Your Approvals
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-600">
            From initial business registration to final statutory clearance in 4 structured steps.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {WORKFLOW_STEPS.map((step) => (
            <div
              key={step.step}
              className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group hover:-translate-y-1"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-primary-50 text-brand-primary-600 flex items-center justify-center group-hover:bg-brand-primary-600 group-hover:text-white transition-colors duration-300">
                    {step.icon}
                  </div>
                  <span className="text-2xl font-black text-slate-200 group-hover:text-brand-primary-200 transition-colors">
                    {step.step}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center text-xs font-semibold text-brand-primary-600 group-hover:text-brand-primary-700">
                <span>Explore step</span>
                <svg className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Callout */}
        <div className="mt-16 bg-gradient-to-r from-[#0b1329] via-[#0f172a] to-[#1e1b4b] rounded-3xl p-8 sm:p-10 text-white shadow-2xl border border-indigo-900/50 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Ready to automate your regulatory roadmap?
            </h3>
            <p className="mt-2 text-slate-300 text-sm sm:text-base">
              Join Indian entrepreneurs and enterprises operating with complete compliance certainty.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
            >
              <span>Start Free Assessment</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
};

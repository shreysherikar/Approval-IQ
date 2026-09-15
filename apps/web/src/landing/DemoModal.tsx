import React from 'react';
import { Link } from 'react-router-dom';

interface DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoModal: React.FC<DemoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-white/40 overflow-hidden z-10">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-primary-600 text-white flex items-center justify-center font-bold text-xs">
              AI
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ApprovalIQ Interactive Product Preview
              </h3>
              <p className="text-xs text-slate-500">Live Simulation of the Regulatory Intelligence Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors"
            aria-label="Close demo"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body: Interactive Simulation Screen */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-slate-100 font-mono text-xs space-y-3 shadow-inner">
            <div className="flex items-center gap-2 text-slate-400 pb-2 border-b border-slate-800">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="ml-2 font-sans text-xs text-slate-400">ApprovalIQ Engine Simulation v2.4</span>
            </div>
            <div className="text-emerald-400">&gt; Initializing regulatory graph for: Craft Microbrewery (Bengaluru, Karnataka)</div>
            <div className="text-slate-300">&gt; Querying central statutes: FSSAI Act 2006, Water Act 1974, Air Act 1981...</div>
            <div className="text-slate-300">&gt; Querying state statutes: Karnataka Excise (Brewery) Rules 1967...</div>
            <div className="text-blue-400">&gt; [OK] Found 8 mandatory clearances, 4 pre-audit checklists, 2 fast-track exemptions.</div>
            <div className="text-amber-400">&gt; Generated single-window submission pipeline in 1.2s.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <div className="text-xl font-bold text-slate-900">8 Clearances</div>
              <div className="text-xs text-slate-500">Auto-Mapped</div>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-xl font-bold text-emerald-700">100% Verified</div>
              <div className="text-xs text-emerald-600">Doc Formats</div>
            </div>
            <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
              <div className="text-xl font-bold text-indigo-700">~35 Days</div>
              <div className="text-xs text-indigo-600">Avg. Timeline</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500 text-center sm:text-left">
            Ready to explore the live dashboard with your own company profile?
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              Close
            </button>
            <Link
              to="/register"
              onClick={onClose}
              className="w-1/2 sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-brand-primary-600 hover:bg-brand-primary-700 text-white text-xs font-bold shadow-md transition-colors"
            >
              <span>Get Started Free</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

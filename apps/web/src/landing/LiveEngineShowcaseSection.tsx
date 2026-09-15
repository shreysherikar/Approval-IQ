import React from 'react';
import { DocumentToDecisionFlow } from './DocumentToDecisionFlow';
import { LiveAuditStream } from './LiveAuditStream';

export const LiveEngineShowcaseSection: React.FC = () => {
  return (
    <section className="py-20 bg-slate-950 text-white relative overflow-hidden border-t border-slate-800">
      {/* Background glow accents */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-800 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            LIVE ENGINE CAPABILITIES
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            From Raw Application to Statutory Decision in Seconds
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300">
            Watch how ApprovalIQ ingests complex filings, parses statutory entities, verifies rule graphs, and logs every audit event.
          </p>
        </div>

        {/* Dual Live Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Column: Interactive Document to Decision Flow (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <DocumentToDecisionFlow />
          </div>

          {/* Right Column: Live Audit Stream + Security Trust Metrics (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <LiveAuditStream />

            {/* Security Pulse Card */}
            <div className="bg-[#0b1329]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Security & Integrity Controls
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">100% Active</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Role-Based RBAC</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>AES-256 Storage</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Audit Immutability</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Google OAuth 2.0</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

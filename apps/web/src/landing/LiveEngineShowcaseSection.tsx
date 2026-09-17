import React from 'react';
import { DocumentToDecisionFlow } from './DocumentToDecisionFlow';
import { LiveAuditStream } from './LiveAuditStream';
import { useLanguage } from '../i18n';
import { Sparkles, ShieldCheck, Lock, CheckCircle2, Key } from 'lucide-react';

export const LiveEngineShowcaseSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section className="py-20 bg-ocean-950 text-white relative overflow-hidden border-t border-ocean-800">
      {/* Background Luminous Aqua & Oceanic Cyan Glow Accents */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-ocean-400/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-ocean-500/20 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-ocean-900/80 border border-ocean-500/50 text-ocean-300 text-xs font-semibold uppercase tracking-wider mb-3 shadow-glow-cyan/20">
            <span className="w-2 h-2 rounded-full bg-ocean-400 animate-pulse" />
            <Sparkles className="w-3 h-3 text-ocean-300 inline mr-1" />
            {t('engine.tag', 'LIVE ENGINE CAPABILITIES')}
          </div>
          <h2 className="text-3xl sm:text-4xl font-editorial font-bold text-white tracking-tight">
            {t('engine.title', 'From Raw Application to Statutory Decision in Seconds')}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ocean-200/80 leading-relaxed font-sans">
            {t(
              'engine.subtitle',
              'Watch how ApprovalIQ ingests complex filings, parses statutory entities, verifies rule graphs, and logs every audit event.',
            )}
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
            <div className="bg-[#072633]/90 backdrop-blur-xl border border-ocean-500/40 rounded-2xl p-5 shadow-glow-cyan/15 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-ocean-800">
                <span className="text-xs font-bold uppercase tracking-wider text-ocean-100 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-ocean-400" />
                  <span>{t('engine.security_title', 'Security & Integrity Controls')}</span>
                </span>
                <span className="text-[10px] text-forest-400 font-mono font-bold bg-forest-950/80 border border-forest-800 px-2 py-0.5 rounded-full">
                  {t('engine.security_active', '100% Active')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-ocean-200">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-ocean-900/80 border border-ocean-800/80 hover:border-ocean-600 transition-colors">
                  <CheckCircle2 className="w-3 h-3 text-forest-400 shrink-0" />
                  <span>{t('engine.rbac', 'Role-Based RBAC')}</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-ocean-900/80 border border-ocean-800/80 hover:border-ocean-600 transition-colors">
                  <Lock className="w-3 h-3 text-ocean-400 shrink-0" />
                  <span>{t('engine.aes', 'AES-256 Storage')}</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-ocean-900/80 border border-ocean-800/80 hover:border-ocean-600 transition-colors">
                  <ShieldCheck className="w-3 h-3 text-ocean-400 shrink-0" />
                  <span>{t('engine.audit', 'Audit Immutability')}</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-ocean-900/80 border border-ocean-800/80 hover:border-ocean-600 transition-colors">
                  <Key className="w-3 h-3 text-forest-400 shrink-0" />
                  <span>{t('engine.oauth', 'Google OAuth 2.0')}</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

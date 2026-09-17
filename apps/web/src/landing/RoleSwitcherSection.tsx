import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Building2,
  ShieldCheck,
  Layers,
  ArrowRight,
  Clock,
  Activity,
  Award,
  Sparkles,
  Fingerprint,
} from 'lucide-react';
import { useLanguage } from '../i18n';

type Role = 'applicant' | 'officer' | 'admin';

export const RoleSwitcherSection: React.FC = () => {
  const { t } = useLanguage();
  const [selectedRole, setSelectedRole] = useState<Role>('applicant');
  const [simulatedActionCompleted, setSimulatedActionCompleted] = useState(false);

  const handleRoleChange = (role: Role) => {
    setSelectedRole(role);
    setSimulatedActionCompleted(false);
  };

  return (
    <section className="py-24 lg:py-32 bg-ocean-950 text-white relative overflow-hidden border-t border-b border-ocean-800/80">
      {/* Dynamic Background Ambient Glowing Nodes */}
      <div className="absolute top-1/4 -left-20 w-[32rem] h-[32rem] bg-ocean-600/20 rounded-full blur-3xl pointer-events-none -z-10 animate-float-slow" />
      <div className="absolute bottom-10 -right-20 w-[36rem] h-[36rem] bg-cyan-500/15 rounded-full blur-3xl pointer-events-none -z-10 animate-float" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[48rem] h-[48rem] bg-ocean-800/20 rounded-full blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest bg-ocean-900/90 border border-ocean-600/40 text-cyan-300 shadow-glow-cyan">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
            <span>{t('roles.tag', 'DESIGNED FOR EVERY STAKEHOLDER')}</span>
          </div>
          
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
            One Intelligent Platform. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-cyan-300 via-ocean-300 to-white bg-clip-text text-transparent">
              Three Tailored Experiences.
            </span>
          </h2>
          
          <p className="text-ocean-200/90 text-sm sm:text-base max-w-2xl mx-auto font-sans leading-relaxed">
            {t(
              'roles.subtitle',
              'Whether you are launching a new industrial unit, reviewing state dossiers, or overseeing multi-plant enterprise risk, ApprovalIQ transforms your statutory trajectory.'
            )}
          </p>
        </div>

        {/* Role Switcher Floating Interactive Tabs */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {[
            { id: 'applicant' as Role, label: 'Applicant / Founder', icon: Building2, tag: 'Zero Paperwork Rejections' },
            { id: 'officer' as Role, label: 'Regulatory Reviewer', icon: ShieldCheck, tag: 'Right to Services SLA' },
            { id: 'admin' as Role, label: 'Enterprise Compliance Lead', icon: Layers, tag: 'Multi-Plant Governance' },
          ].map((item) => {
            const isSelected = selectedRole === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleRoleChange(item.id)}
                className={`tactile-btn flex items-center gap-2.5 px-5 py-3 rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-300 border cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-ocean-700 to-ocean-800 text-white border-cyan-400/60 shadow-glow-cyan-card scale-105'
                    : 'bg-ocean-900/60 text-ocean-300 border-ocean-800/80 hover:bg-ocean-900 hover:text-white hover:border-ocean-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected ? 'bg-cyan-400 text-ocean-950 font-bold' : 'bg-ocean-800/80 text-ocean-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-bold">{item.label}</div>
                  <div className="text-[10px] text-cyan-300/70 font-normal hidden sm:block">{item.tag}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dynamic Holographic Role Showcase Console */}
        <div className="mt-12 bg-gradient-to-b from-ocean-900/90 to-ocean-950/95 border border-ocean-700/60 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          
          {/* Subtle Accent Glow */}
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

          {selectedRole === 'applicant' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-scale-in">
              {/* Left Column: Information & Value Propositions */}
              <div className="lg:col-span-6 space-y-5 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/90 border border-cyan-500/40 text-cyan-300">
                  <Building2 className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Entrepreneurs, MSMEs & Large Industries</span>
                </div>
                
                <h3 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  Accelerate your statutory journey with AI guidance.
                </h3>
                
                <p className="text-ocean-200 text-sm sm:text-base leading-relaxed">
                  Never worry about missed clearances, overlapping municipal rules, or rejected applications again. ApprovalIQ computes your exact topological approval chain and guides each filing.
                </p>

                <div className="space-y-3 pt-2">
                  {[
                    'Automated industry classification & NIC / CPCB pollution index mapping',
                    'Pre-submission document verification with OCR & bounding-box audit',
                    'Single-window status tracking across 7+ state & central departments',
                    'Deemed approval timers & automatic statutory appeal escalation drafts',
                  ].map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-ocean-100">
                      <div className="w-5 h-5 rounded-full bg-ocean-800 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5 shadow-sm">
                        <Check className="w-3 h-3 text-cyan-300" />
                      </div>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <Link
                    to="/register"
                    className="tactile-btn inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-ocean-500 to-cyan-400 hover:from-ocean-400 hover:to-cyan-300 text-ocean-950 text-sm font-bold shadow-glow-cyan transition-all transform hover:scale-105"
                  >
                    <span>Launch Applicant Workspace</span>
                    <ArrowRight className="w-4 h-4 text-ocean-950" />
                  </Link>

                  <span className="text-xs text-ocean-300 font-mono">
                    Avg. 74% reduction in turnaround time
                  </span>
                </div>
              </div>

              {/* Right Column: Live Interactive Holographic Mockup */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-ocean-950/90 border border-ocean-700/80 p-5 sm:p-6 shadow-2xl text-left font-sans backdrop-blur-2xl">
                  {/* Console Top Window Bar */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-ocean-800 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      <span className="text-ocean-300 font-mono text-[11px] ml-1">Applicant Project Workspace</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-ocean-900 text-cyan-300 border border-ocean-700 text-[10px]">
                      LIVE DOSSIER
                    </span>
                  </div>

                  {/* Project Overview Card */}
                  <div className="p-4 rounded-xl bg-ocean-900/80 border border-ocean-800 mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-mono text-ocean-400">Target Enterprise</div>
                      <div className="text-sm font-bold text-white mt-0.5">Bangalore Biotech Hub Unit-1</div>
                      <div className="text-[11px] text-cyan-300 flex items-center gap-1 mt-1">
                        <Activity className="w-3 h-3" />
                        <span>Karnataka SPCB / High Priority Red Category</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold font-editorial text-cyan-300">100%</div>
                      <div className="text-[10px] text-ocean-300 font-mono">Readiness Score</div>
                    </div>
                  </div>

                  {/* Dynamic Clearance Steps */}
                  <div className="space-y-2.5 text-xs font-mono">
                    {[
                      { name: 'Consent to Establish (CTE - SPCB)', status: 'Approved', badge: 'Certified', color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60' },
                      { name: 'Directorate of Factories Plan Approval', status: 'In Review (Day 3/14)', badge: 'SLA Active', color: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/60' },
                      { name: 'State Fire Service Provisional NOC', status: 'Prerequisites Verified', badge: 'Ready', color: 'text-amber-300 border-amber-500/40 bg-amber-950/60' },
                      { name: 'DISCOM 11kV Industrial Power Sanction', status: 'Queued (Parallel Layer)', badge: 'Automated', color: 'text-ocean-300 border-ocean-600/40 bg-ocean-900/60' },
                    ].map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-ocean-900/50 border border-ocean-800 hover:border-ocean-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="text-white font-sans text-[11px] sm:text-xs">{step.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${step.color}`}>
                          {step.badge}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Trigger Simulation */}
                  <div className="mt-5 pt-4 border-t border-ocean-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSimulatedActionCompleted(true)}
                      className="tactile-btn text-xs font-sans font-bold text-cyan-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{simulatedActionCompleted ? '✓ Dossier Verified & Dispatched' : 'Simulate Pre-Submission AI Audit →'}</span>
                    </button>

                    <Link
                      to="/register"
                      className="text-xs text-ocean-400 hover:text-cyan-300 transition-colors"
                    >
                      View Full Dossier
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'officer' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-scale-in">
              {/* Left Column */}
              <div className="lg:col-span-6 space-y-5 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/90 border border-emerald-500/40 text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Statutory Reviewers & Nodal Desk Officers</span>
                </div>
                
                <h3 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  Structured, pre-verified dossiers ready for zero-friction review.
                </h3>
                
                <p className="text-ocean-200 text-sm sm:text-base leading-relaxed">
                  Eliminate paperwork backlogs and missing form rejections. Receive standardized dossiers with auto-indexed affidavits, GIS boundary verification, and pre-computed Right to Services SLA timers.
                </p>

                <div className="space-y-3 pt-2">
                  {[
                    'Instant validation of statutory prerequisites across sister departments',
                    'Unified cross-agency consensus with automated inter-departmental notices',
                    'Automated discrepancy flagging and pre-drafted statutory query generator',
                    'Tamper-proof digital audit log with cryptographic signing of endorsements',
                  ].map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-ocean-100">
                      <div className="w-5 h-5 rounded-full bg-ocean-800 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0 mt-0.5 shadow-sm">
                        <Check className="w-3 h-3 text-emerald-300" />
                      </div>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <Link
                    to="/register"
                    className="tactile-btn inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 hover:from-emerald-400 hover:to-cyan-300 text-ocean-950 text-sm font-bold shadow-glow-cyan transition-all transform hover:scale-105"
                  >
                    <span>Launch Reviewer Desk</span>
                    <ArrowRight className="w-4 h-4 text-ocean-950" />
                  </Link>

                  <span className="text-xs text-ocean-300 font-mono">
                    Zero missing prerequisite errors
                  </span>
                </div>
              </div>

              {/* Right Column: Reviewer Assessment Console Mockup */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-ocean-950/90 border border-ocean-700/80 p-5 sm:p-6 shadow-2xl text-left font-sans backdrop-blur-2xl">
                  {/* Console Top Window Bar */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-ocean-800 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      <span className="text-ocean-300 font-mono text-[11px] ml-1">Statutory Review Desk Console</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] flex items-center gap-1 font-bold">
                      <Clock className="w-3 h-3 animate-spin" />
                      <span>SLA: 11 DAYS REMAINING</span>
                    </span>
                  </div>

                  {/* Officer Intake Queue */}
                  <div className="space-y-3 font-sans">
                    <div className="p-3.5 rounded-xl bg-ocean-900/90 border border-ocean-800 flex items-center justify-between">
                      <div>
                        <div className="text-ocean-400 text-[10px] font-mono uppercase">Assigned Application</div>
                        <div className="text-white font-bold text-xs sm:text-sm mt-0.5">Maharashtra Industrial Solar Park Ph-2</div>
                        <div className="text-[11px] text-ocean-300 mt-0.5">Applicant: SunForge Energy Infra Ltd</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-cyan-950 border border-cyan-700 text-cyan-300">
                        Pre-Audited
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-3 rounded-lg bg-ocean-900/60 border border-ocean-800">
                        <div className="text-[10px] text-ocean-400 font-mono">Land Title & GIS Survey</div>
                        <div className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>Coordinates Matched</span>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-ocean-900/60 border border-ocean-800">
                        <div className="text-[10px] text-ocean-400 font-mono">Sister NOC Cross-Check</div>
                        <div className="text-xs font-bold text-cyan-300 mt-1 flex items-center gap-1">
                          <Fingerprint className="w-3 h-3" />
                          <span>3 of 3 Pre-Linked</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-ocean-900/40 border border-ocean-800/80 flex items-center justify-between text-xs">
                      <span className="text-ocean-300">Deemed Clearance Safety Status</span>
                      <span className="text-emerald-400 font-bold font-mono">Compliant (No Drift)</span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-5 pt-4 border-t border-ocean-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSimulatedActionCompleted(true)}
                      className="tactile-btn text-xs font-bold text-emerald-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{simulatedActionCompleted ? '✓ Endorsement Cryptographically Sealed' : 'Simulate 1-Click Endorsement →'}</span>
                    </button>

                    <Link to="/register" className="text-xs text-ocean-400 hover:text-cyan-300">
                      View Queue (12 Pending)
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedRole === 'admin' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center animate-scale-in">
              {/* Left Column */}
              <div className="lg:col-span-6 space-y-5 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/90 border border-amber-500/40 text-amber-300">
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>State Secretariats, DG & Enterprise Compliance Leads</span>
                </div>
                
                <h3 className="font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  Real-time visibility across multi-state operations.
                </h3>
                
                <p className="text-ocean-200 text-sm sm:text-base leading-relaxed">
                  Track regulatory posture across factories, warehouses, and industrial estates nationwide. Detect regulatory drift before notices are issued and generate boardroom-ready audit dossiers.
                </p>

                <div className="space-y-3 pt-2">
                  {[
                    'Enterprise-wide compliance health index with multi-state drill-downs',
                    'Automated regulatory change radar detecting new Gazette notifications',
                    'Unified compliance calendar for license renewals & annual return filings',
                    'SOC2 and ISO 27001 compliant cryptographically verified audit exports',
                  ].map((pt, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-ocean-100">
                      <div className="w-5 h-5 rounded-full bg-ocean-800 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0 mt-0.5 shadow-sm">
                        <Check className="w-3 h-3 text-amber-300" />
                      </div>
                      <span>{pt}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex flex-wrap items-center gap-4">
                  <Link
                    to="/register"
                    className="tactile-btn inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-500 to-cyan-400 hover:from-amber-400 hover:to-cyan-300 text-ocean-950 text-sm font-bold shadow-glow-cyan transition-all transform hover:scale-105"
                  >
                    <span>Launch Governance Dashboard</span>
                    <ArrowRight className="w-4 h-4 text-ocean-950" />
                  </Link>

                  <span className="text-xs text-ocean-300 font-mono">
                    99.4% aggregate health index
                  </span>
                </div>
              </div>

              {/* Right Column: Enterprise Governance Dashboard Mockup */}
              <div className="lg:col-span-6">
                <div className="rounded-2xl bg-ocean-950/90 border border-ocean-700/80 p-5 sm:p-6 shadow-2xl text-left font-sans backdrop-blur-2xl">
                  {/* Console Top Bar */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-ocean-800 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                      <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                      <span className="text-ocean-300 font-mono text-[11px] ml-1">Enterprise Multi-Unit Radar</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-ocean-900 text-amber-300 border border-amber-700/50 text-[10px] font-bold">
                      18 FACILITIES ACTIVE
                    </span>
                  </div>

                  {/* Multi-State Units Breakdown */}
                  <div className="space-y-2.5 font-sans text-xs">
                    {[
                      { state: 'Maharashtra (Pune & Nagpur Hubs)', facilities: '6 Units', score: '99.8%', status: 'Optimal', color: 'text-emerald-400' },
                      { state: 'Karnataka (Bengaluru Tech Park)', facilities: '4 Units', score: '100.0%', status: 'Optimal', color: 'text-emerald-400' },
                      { state: 'Gujarat (Sanand Auto Ancillary)', facilities: '5 Units', score: '97.4%', status: 'Renewal in 45d', color: 'text-amber-300' },
                      { state: 'Tamil Nadu (Sriperumbudur Factory)', facilities: '3 Units', score: '100.0%', status: 'Optimal', color: 'text-emerald-400' },
                    ].map((row, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-ocean-900/60 border border-ocean-800"
                      >
                        <div>
                          <div className="font-bold text-white text-[11px] sm:text-xs">{row.state}</div>
                          <div className="text-[10px] text-ocean-400">{row.facilities}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold ${row.color}`}>{row.score}</div>
                          <div className="text-[10px] text-ocean-300">{row.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Bottom Action */}
                  <div className="mt-5 pt-4 border-t border-ocean-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSimulatedActionCompleted(true)}
                      className="tactile-btn text-xs font-bold text-amber-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{simulatedActionCompleted ? '✓ Executive PDF & JSON Bundle Exported' : 'Export Board-Ready Audit Dossier →'}</span>
                    </button>

                    <Link to="/register" className="text-xs text-ocean-400 hover:text-cyan-300">
                      View Risk Heatmap
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
};


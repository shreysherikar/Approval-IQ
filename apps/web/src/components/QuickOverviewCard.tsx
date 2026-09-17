import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  FileText,
  Gift,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import {
  roadmapApi,
  type QuickOverviewNextStep,
} from '../api-client';
import { useAuth } from '../auth';

const LOADING_STAGES = [
  'Analyzing your business profile...',
  'Checking applicable approvals & dependencies...',
  'Reviewing schemes & incentives...',
  'Preparing your personalized overview...',
];

interface QuickOverviewCardProps {
  projectId: string;
  projectName?: string | undefined;
  initialCollapsed?: boolean | undefined;
}

export const QuickOverviewCard: React.FC<QuickOverviewCardProps> = ({
  projectId,
  projectName,
  initialCollapsed = false,
}) => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  const [isGenerated, setIsGenerated] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'actions' | 'blocked' | 'schemes' | 'documents'>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(!initialCollapsed);
  const [loadingStageIndex, setLoadingStageIndex] = useState<number>(0);

  // Staged loading effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loadingStageIndex < LOADING_STAGES.length - 1) {
      interval = setInterval(() => {
        setLoadingStageIndex((prev) => Math.min(prev + 1, LOADING_STAGES.length - 1));
      }, 700);
    }
    return () => clearInterval(interval);
  }, [loadingStageIndex]);

  // Query overview
  const {
    data: overview,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['quick-overview', projectId],
    queryFn: () => roadmapApi.getQuickOverview(projectId, accessToken ?? undefined),
    enabled: Boolean(projectId && accessToken && isGenerated),
    staleTime: 60_000,
  });

  // Regenerate mutation
  const regenerateMutation = useMutation({
    mutationFn: () => {
      setLoadingStageIndex(0);
      return roadmapApi.regenerateQuickOverview(projectId, accessToken ?? undefined);
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(['quick-overview', projectId], newData);
    },
  });

  const isBusy = isLoading || isFetching || regenerateMutation.isPending;

  // Unconfigured or Incomplete Profile Empty State
  if (overview && !overview.isReady) {
    return (
      <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-300 shadow-sm space-y-4 animate-fade-in-up">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[10px] font-mono font-bold uppercase">
                <span>Setup Required</span>
              </div>
              <h3 className="font-editorial text-lg font-bold text-slate-900 mt-0.5">
                Your Overview Isn't Ready Yet
              </h3>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed max-w-2xl">
          {overview.summary || 'Complete a few more business details so ApprovalIQ can personalize your regulatory and incentive analysis.'}
        </p>

        {overview.missingInformation && overview.missingInformation.length > 0 && (
          <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-2">
            <span className="text-[11px] font-mono font-bold text-amber-950 uppercase block">
              Required Profile Parameters Missing:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {overview.missingInformation.map((m) => (
                <div key={m.field} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">{m.label}</span>
                    <span className="text-[11px] text-slate-500 block">{m.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-start">
          <Link
            to={`/projects/${projectId}/profile`}
            className="tactile-btn mustard-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-2 shadow-sm"
          >
            <span>Complete Business Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  // Initial Un-generated CTA Banner State
  if (!isGenerated) {
    return (
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 border border-amber-300 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-950 text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>AI QUICK OVERVIEW</span>
            </div>
            <h3 className="font-editorial text-xl font-bold text-slate-900">
              Here&apos;s what ApprovalIQ found for your business
            </h3>
            <p className="text-xs text-slate-600">
              Generate a personalized executive synthesis of applicable approvals, prerequisite bottlenecks, and government subsidies tailored to your current business profile.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsGenerated(true);
              setLoadingStageIndex(0);
            }}
            className="tactile-btn mustard-btn-primary px-5 py-2.5 text-xs font-bold shrink-0 shadow-md shadow-amber-500/20 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Generate AI Overview</span>
          </button>
        </div>
      </div>
    );
  }

  // Progressive Loading State
  if (isBusy) {
    return (
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-amber-200 shadow-sm space-y-5 animate-pulse">
        <div className="flex items-center justify-between border-b border-amber-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/30 flex items-center justify-center animate-spin">
              <Sparkles className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="h-3 w-28 bg-amber-200 rounded" />
              <div className="h-4 w-48 bg-slate-200 rounded mt-1.5" />
            </div>
          </div>
          <span className="text-[11px] font-mono text-amber-700 font-bold">
            {LOADING_STAGES[loadingStageIndex]}
          </span>
        </div>

        <div className="space-y-2.5">
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-5/6" />
          <div className="h-4 bg-slate-100 rounded w-3/4" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-amber-50/60 border border-amber-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Error State with fallback
  if (isError || !overview) {
    return (
      <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>AI overview is temporarily unavailable.</span>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            className="tactile-btn px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-800 font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry</span>
          </button>
        </div>
        <p className="text-slate-600 font-sans">
          {error instanceof Error ? error.message : 'You can continue exploring your approvals directly through the roadmap and profile desks.'}
        </p>
      </div>
    );
  }

  return (
    <section className="editorial-card p-6 sm:p-7 bg-white border border-amber-200/90 shadow-tactile rounded-2xl space-y-5 animate-fade-in-up">
      {/* Top Header Card Bar */}
      <div className="flex items-start sm:items-center justify-between gap-3 border-b border-amber-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mustard-badge text-[10px] font-bold tracking-wide">
                ✨ AI PROFILE &amp; REGULATORY REVIEW
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {overview.businessContext.industry} • {overview.businessContext.location} • {overview.businessContext.investmentFormatted} CapEx
                {overview.businessContext.workforceFormatted ? ` • ${overview.businessContext.workforceFormatted} Staff` : ''}
              </span>
            </div>
            <h2 className="font-editorial text-lg sm:text-xl font-bold text-slate-900 mt-1">
              {projectName || overview.projectName} AI Executive Review
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
            className="tactile-btn tactile-btn-secondary px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-amber-800 flex items-center gap-1.5 cursor-pointer"
            title="Fetch latest project data and regenerate overview"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
            aria-label="Toggle Expand Overview"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Dynamic Summary Quote Banner */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50/40 to-white border border-amber-200/80 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans shadow-sm">
        <p className="font-medium text-slate-900">
          {overview.summary}
        </p>
      </div>

      {/* High-Level Key Findings Highlight Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {overview.keyHighlights.map((h, i) => (
          <div
            key={i}
            className={`p-3.5 rounded-xl border transition-all ${
              h.tone === 'positive'
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                : h.tone === 'warning'
                ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                : h.tone === 'urgent'
                ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                : 'bg-slate-50/80 border-slate-200 text-slate-900'
            }`}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
              {h.label}
            </div>
            <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900">
              {h.value}
            </div>
            {h.badge && (
              <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/80 border border-current">
                {h.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Expandable In-Depth Sections & Tabs */}
      {isExpanded && (
        <div className="space-y-4 pt-2 border-t border-slate-100 animate-fade-in-up">
          {/* Sub-Tabs Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Findings' },
              { id: 'actions', label: '⚡ What to Do' },
              { id: 'blocked', label: '🔒 Blockers & DAG' },
              { id: 'schemes', label: '🎁 Incentives' },
              { id: 'documents', label: '📁 Document Vault' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Section Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Situation & What You Need To Do */}
            {(activeTab === 'all' || activeTab === 'actions') && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 font-mono">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Immediate Actions & Available Clearances</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  {overview.whatYouNeedToDo}
                </p>
                <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Ready Dossiers: </span>
                  {overview.whatIsReady}
                </div>
              </div>
            )}

            {/* Blockers & Gating Prerequisites */}
            {(activeTab === 'all' || activeTab === 'blocked') && (
              <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950 font-mono">
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Blocked Approvals & Prerequisite Dependencies</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  {overview.whatIsBlocking}
                </p>
                {overview.rtsSlaTimelineSummary && (
                  <div className="pt-2 border-t border-amber-200/60 text-[11px] text-amber-900 flex items-center gap-1.5 font-mono">
                    <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                    <span>{overview.rtsSlaTimelineSummary}</span>
                  </div>
                )}
              </div>
            )}

            {/* Schemes & Subsidies */}
            {(activeTab === 'all' || activeTab === 'schemes') && (
              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950 font-mono">
                  <Gift className="w-3.5 h-3.5 text-purple-600" />
                  <span>Schemes & Fiscal Policy Advisory</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-sans">
                  {overview.schemesAndIncentives}
                </p>
                <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-purple-900 font-medium">Explore collateral-free MSME & tax holidays</span>
                  <Link to={`/projects/${projectId}/schemes`} className="text-xs font-bold text-purple-700 hover:underline">
                    View Schemes →
                  </Link>
                </div>
              </div>
            )}

            {/* Document Vault Status */}
            {(activeTab === 'all' || activeTab === 'documents') && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 font-mono">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    <span>Document Vault Checklist</span>
                  </div>
                  <span className="text-[10px] text-slate-600">
                    {overview.documents.uploadedCount} of {overview.documents.totalRequired} Uploaded
                  </span>
                </div>
                {overview.documents.missingList && overview.documents.missingList.length > 0 ? (
                  <div className="space-y-1">
                    <span className="text-[10px] text-amber-900 font-semibold block">Missing Mandatory Documents:</span>
                    <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
                      {overview.documents.missingList.slice(0, 3).map((d, idx) => (
                        <li key={idx} className="truncate">{d}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All mandatory statutory documents uploaded</span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {overview.documents.verifiedCount} Verified by OCR
                  </span>
                  <Link to={`/projects/${projectId}/roadmap`} className="text-xs font-bold text-ocean-700 hover:underline">
                    Open Vault →
                  </Link>
                </div>
              </div>
            )}

          </div>

          {/* Missing Profile Information Alert (if any non-blocking fields are missing) */}
          {overview.missingInformation && overview.missingInformation.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Additional Information Needed to Unlock Full Regulatory Evaluation:</span>
              </span>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {overview.missingInformation.map((m) => (
                  <span key={m.field} className="px-2 py-0.5 bg-white border border-amber-300 rounded text-[11px] font-mono">
                    {m.label}
                  </span>
                ))}
                <Link to={`/projects/${projectId}/profile`} className="text-xs font-bold text-amber-900 hover:underline ml-auto">
                  Update Profile →
                </Link>
              </div>
            </div>
          )}

          {/* Prioritized Recommended Next Steps */}
          {overview.nextSteps && overview.nextSteps.length > 0 && (
            <div className="pt-3 border-t border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Prioritized Next Steps</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {overview.nextSteps.length} Action Items
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {overview.nextSteps.map((step: QuickOverviewNextStep, idx: number) => (
                  <div
                    key={step.id || idx}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 hover:shadow-sm transition-all flex flex-col justify-between space-y-2.5 group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-bold text-amber-700">
                          0{idx + 1}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            step.priority === 'high'
                              ? 'bg-rose-100 text-rose-800'
                              : step.priority === 'medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {step.priority}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                        {step.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 leading-snug mt-1 font-sans">
                        {step.description}
                      </p>
                    </div>

                    <Link
                      to={step.actionRoute || `/projects/${projectId}/roadmap`}
                      className="tactile-btn mustard-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between group-hover:scale-101"
                    >
                      <span className="truncate">{step.actionLabel || 'Proceed'}</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </section>
  );
};

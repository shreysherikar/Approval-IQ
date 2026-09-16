import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Search,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Download,
  Send,
  Check,
  X,
  Sparkles,
  RefreshCw,
  FolderOpen,
  Mail,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { ApiError, officerApi, type QueueItem, type ClarificationView } from './api-client';
import { useAuth } from './auth';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

// ---------------------------------------------------------------------------
// Clean Authority Badge Helper
// ---------------------------------------------------------------------------
function getAuthorityBadge(code: string = ''): { bg: string; text: string; border: string; name: string } {
  const c = code.toUpperCase();
  if (c.includes('MPCB') || c.includes('PCB')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', name: 'MPCB' };
  }
  if (c.includes('FIRE')) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', name: 'Fire Dept' };
  }
  if (c.includes('DISH') || c.includes('FACTORY')) {
    return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', name: 'DISH' };
  }
  if (c.includes('EXCISE')) {
    return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', name: 'Excise' };
  }
  if (c.includes('FSSAI')) {
    return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', name: 'FSSAI' };
  }
  return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', name: code || 'Authority' };
}

function RiskBadge({ level, score }: { level: string; score: number }): JSX.Element {
  const defaultStyle = { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' };
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    unknown: defaultStyle,
  };
  const s = styles[level] ?? defaultStyle;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}>
      Risk: {score} ({level})
    </span>
  );
}

// ---------------------------------------------------------------------------
// Clean Application List Row Card
// ---------------------------------------------------------------------------
function CleanApplicationCard({ item }: { item: QueueItem }): JSX.Element {
  const auth = getAuthorityBadge(item.authority?.code);
  const isAwaitingOfficer = item.clarificationsAwaitingOfficer > 0;
  const verifiedCount = item.requiredDocuments.verified;
  const totalDocs = item.requiredDocuments.total;
  const risk = (item as unknown as { risk?: Record<string, unknown> })?.risk;
  const submissionRisk = risk?.['submissionRisk'] as Record<string, unknown> | undefined;
  const complexity = risk?.['regulatoryComplexity'] as Record<string, unknown> | undefined;
  const recommendation = typeof risk?.['recommendation'] === 'string' ? risk['recommendation'] : null;

  return (
    <div className="bg-white border border-slate-200/80 hover:border-blue-400 rounded-2xl p-5 shadow-xs transition-all hover:shadow-md group">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Main Application Information */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border ${auth.bg} ${auth.text} ${auth.border}`}>
              {item.authority?.code ?? 'AUTH'}
            </span>

            <span className="text-xs text-slate-400 font-mono">
              {item.approval?.code}
            </span>

            {isAwaitingOfficer && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                <span>Applicant Responded · Action Needed</span>
              </span>
            )}

            {item.attentionRequired && !isAwaitingOfficer && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span>Needs Verification</span>
              </span>
            )}
          </div>

          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              <Link to={`/officer/applications/${item.instanceId}`}>
                {item.approval?.name ?? 'Statutory Application'}
              </Link>
            </h3>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {item.project?.name ?? 'Industrial Project'}
              </span>
              <span>•</span>
              <span>{item.project?.industry ?? 'Sector'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {(item.project?.applicantEmails ?? []).join(', ') || 'No email'}
              </span>
            </div>
          </div>
        </div>
        {/* Right: Metrics & Action */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
          {submissionRisk && (
            <RiskBadge level={String(submissionRisk.level ?? 'unknown')} score={Number(submissionRisk.score ?? 0)} />
          )}

          {/* Docs status pill */}
          <div className="text-left sm:text-right text-xs">
            <span className="text-slate-400 block text-[11px]">Documents</span>
            <span className="font-semibold text-slate-700 font-mono">
              {verifiedCount} of {totalDocs} Verified
            </span>
          </div>

          {/* SLA Pill */}
          <div className="text-left sm:text-right text-xs">
            <span className="text-slate-400 block text-[11px]">SLA Timeline</span>
            <span className="font-semibold text-slate-700 font-mono">
              {item.slaDays ? `${item.slaDays} Days` : 'N/A'}
            </span>
          </div>

          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider font-mono border ${
            item.instanceStatus === 'in_progress'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : item.instanceStatus === 'done'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {item.instanceStatus.replace('_', ' ')}
          </span>

          {/* Action CTA */}
          <Link
            to={`/officer/applications/${item.instanceId}`}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all shrink-0"
          >
            <span>Review</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {(complexity || recommendation || item.requiredDocuments.missing > 0) && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap gap-2 text-xs">
          {item.requiredDocuments.missing > 0 && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800 text-[11px] font-medium">
              {item.requiredDocuments.missing} required document{item.requiredDocuments.missing === 1 ? '' : 's'} missing
            </span>
          )}
          {complexity && (
            <span className="rounded-lg border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-800 text-[11px] font-medium">
              Complexity: {String(complexity.level ?? 'unknown')}
            </span>
          )}
          {recommendation && (
            <span className={`rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
              recommendation === 'Priority Review' ? 'border-red-300 bg-red-50 text-red-800' :
              recommendation === 'Needs Clarification' ? 'border-amber-300 bg-amber-50 text-amber-800' :
              'border-green-300 bg-green-50 text-green-800'
            }`}>
              Recommendation: {recommendation}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Clean Officer Queue Page
// ---------------------------------------------------------------------------
export function OfficerQueuePage(): JSX.Element {
  const { accessToken, isRestoring, user } = useAuth();
  const [statusFilter, setStatusFilter] = useState('in_progress');
  const [authorityId, setAuthorityId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const authoritiesQuery = useQuery({
    queryKey: ['officer-authorities', accessToken],
    queryFn: () => officerApi.authorities(accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  const queueFilter = authorityId ? `status=${statusFilter}&authorityId=${authorityId}` : `status=${statusFilter}`;
  const queueQuery = useQuery({
    queryKey: ['officer-queue', accessToken, statusFilter, authorityId],
    queryFn: () => officerApi.queue(accessToken ?? undefined, queueFilter),
    enabled: accessToken !== null,
  });

  const authorities = authoritiesQuery.data?.authorities ?? [];
  const queue = queueQuery.data;

  // Filter queue items by instant live search
  const filteredItems = useMemo(() => {
    if (!queue?.items) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return queue.items;

    return queue.items.filter((it) => {
      const name = it.approval?.name?.toLowerCase() ?? '';
      const code = it.approval?.code?.toLowerCase() ?? '';
      const proj = it.project?.name?.toLowerCase() ?? '';
      const ind = it.project?.industry?.toLowerCase() ?? '';
      const email = (it.project?.applicantEmails ?? []).join(' ').toLowerCase();
      const auth = it.authority?.name?.toLowerCase() ?? '';
      return name.includes(q) || code.includes(q) || proj.includes(q) || ind.includes(q) || email.includes(q) || auth.includes(q);
    });
  }, [queue?.items, searchQuery]);

  if (queueQuery.isLoading || authoritiesQuery.isLoading || isRestoring) {
    return <LoadingSpinner label="Loading regulatory applications…" />;
  }

  if (accessToken === null) {
    return <ErrorBanner message="Your session has ended — please log in again." />;
  }

  if (user !== null && user.role !== 'officer' && user.role !== 'admin') {
    return (
      <ErrorBanner message="This portal is reserved for statutory officers. Sign in with an officer account." />
    );
  }

  const [activeTab, setActiveTab] = useState<'applications' | 'grievances'>('applications');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Officer Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Officer Workstation
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Process clearance applications, answer inquiries, and adjudicate RTS statutory grievances.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('applications')}
              className={`rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
                activeTab === 'applications' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Applications ({queue?.total ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('grievances')}
              className={`rounded-lg px-3 py-1.5 transition-colors cursor-pointer ${
                activeTab === 'grievances' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚖️ RTS Grievances
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              void queueQuery.refetch();
              void authoritiesQuery.refetch();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {activeTab === 'grievances' ? (
        <OfficerGrievancesView />
      ) : (
        <>
          {/* KPI Cards Strip */}
          {queue && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-xs text-slate-500 block">Total in Queue</span>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{queue.total}</div>
                <span className="text-[11px] text-slate-400">Assigned across boards</span>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-2xs">
                <span className="text-xs text-amber-800 font-medium block">Awaiting Your Review</span>
                <div className="text-2xl font-bold text-amber-900 mt-1 font-mono">{queue.summary.awaitingOfficer}</div>
                <span className="text-[11px] text-amber-700">Applicant responses received</span>
              </div>

              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 shadow-2xs">
                <span className="text-xs text-sky-800 font-medium block">Awaiting Applicant</span>
                <div className="text-2xl font-bold text-sky-900 mt-1 font-mono">{queue.summary.awaitingApplicant}</div>
                <span className="text-[11px] text-sky-700">Open clarification queries</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
                <span className="text-xs text-slate-500 block">Missing Documents</span>
                <div className="text-2xl font-bold text-rose-600 mt-1 font-mono">{queue.summary.withMissingDocuments}</div>
                <span className="text-[11px] text-slate-400">Applications needing uploads</span>
              </div>
            </div>
          )}

          {/* Clean Search & Filter Bar */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by project name, approval code, industry, or applicant email…"
                  className="w-full pl-10 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Authority Dropdown */}
              <select
                value={authorityId}
                onChange={(e) => setAuthorityId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="">All Regulatory Boards ({authorities.length})</option>
                {authorities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code ? `${a.code} - ` : ''}{a.name} ({a.openApplications} open)
                  </option>
                ))}
              </select>
            </div>

            {/* Status Tab Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-slate-100 text-xs">
              {[
                { id: 'in_progress', label: 'In Progress' },
                { id: 'available', label: 'Available' },
                { id: 'blocked', label: 'Blocked' },
                { id: 'done', label: 'Approved' },
                { id: 'all', label: 'All Statuses' },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    statusFilter === st.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

      {/* Application Cards List */}
      {authorities.length === 0 ? (
        <EmptyState
          title="No Authority Assigned"
          description="Your officer account is not assigned to any regulatory boards. Please request an administrator to assign your department."
        />
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Queue is Clear</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            {searchQuery ? `No applications match "${searchQuery}".` : 'No applications found under this status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1 font-medium">
            <span>{filteredItems.length} application{filteredItems.length === 1 ? '' : 's'} found</span>
            {searchQuery && <span className="text-blue-600">Searching: "{searchQuery}"</span>}
          </div>

          <div className="space-y-3">
            {filteredItems.map((item) => (
              <CleanApplicationCard key={item.instanceId} item={item} />
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function OfficerGrievancesView(): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['officer-grievances', filterStatus, filterTier],
    queryFn: () =>
      import('./api-client').then((m) => {
        const params: {
          status?: string | undefined;
          tier?: string | undefined;
        } = {};
        if (filterStatus !== 'all') params.status = filterStatus;
        if (filterTier !== 'all') params.tier = filterTier;
        return m.grievancesApi.listForOfficer(params, accessToken ?? undefined);
      }),
    enabled: Boolean(accessToken),
  });

  const grievances = data?.grievances ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs"
          >
            <option value="all">All Grievance Statuses</option>
            <option value="submitted">Submitted (Action Required)</option>
            <option value="under_investigation">Under Investigation</option>
            <option value="escalated">Escalated to Higher Tier</option>
            <option value="redressed">Redressed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs"
          >
            <option value="all">All Appellate Tiers</option>
            <option value="tier_1_nodal_officer">Tier 1: Nodal Officer</option>
            <option value="tier_2_appellate_authority">Tier 2: First Appellate Authority</option>
            <option value="tier_3_rts_commission">Tier 3: RTS Commission</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['officer-grievances'] })}
          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-gray-50"
        >
          ↻ Refresh Queue
        </button>
      </div>

      {isLoading && <LoadingSpinner label="Loading RTS statutory grievances..." />}
      {error && <ErrorBanner message={error instanceof Error ? error.message : 'Could not load grievances'} />}

      {!isLoading && grievances.length === 0 ? (
        <EmptyState
          title="No Active Grievances in Queue"
          description="Your department has no outstanding statutory delay disputes or appellate hearings under review."
        />
      ) : (
        <div className="space-y-3">
          {grievances.map((g) => (
            <div key={g.id} className="rounded-md border border-gray-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-700">{g.grievanceNumber}</span>
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-800">
                      {g.type.replace(/_/g, ' ')}
                    </span>
                    <span className="rounded border px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                      {g.tier.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-gray-900">{g.subject}</h3>
                  <p className="mt-1 text-xs text-gray-600 line-clamp-2">{g.description}</p>
                </div>

                <div className="text-right text-xs">
                  <span
                    className={`font-semibold ${
                      g.isOverdue ? 'text-rose-600 animate-pulse' : 'text-emerald-700'
                    }`}
                  >
                    {g.isOverdue ? `⚠️ Overdue (${Math.abs(g.daysRemaining)}d)` : `⏱️ ${g.daysRemaining}d left`}
                  </span>
                  <p className="text-[11px] text-gray-400">Target: {new Date(g.targetResolutionDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 text-xs">
                <span className="text-gray-500">
                  Project: <span className="font-mono">{g.projectId}</span> · Filed by: {g.submittedBy.email}
                </span>
                <Link
                  to={`/projects/${g.projectId}/grievances`}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Adjudicate in Grievance Dossier →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clean Clarification Thread Box
// ---------------------------------------------------------------------------
function CleanClarificationThread({
  clarification,
  instanceId,
}: {
  clarification: ClarificationView;
  instanceId: string;
}): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [followUpMessage, setFollowUpMessage] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['officer-application', instanceId] });
  };

  const resolveMutation = useMutation({
    mutationFn: () =>
      officerApi.resolve(
        clarification.id,
        note.trim() ? { note: note.trim() } : {},
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setNote('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not resolve query.'),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      officerApi.cancel(
        clarification.id,
        note.trim() ? { note: note.trim() } : {},
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setNote('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not cancel query.'),
  });

  const followUpMutation = useMutation({
    mutationFn: () =>
      officerApi.followUp(
        clarification.id,
        { message: followUpMessage.trim() },
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setFollowUpMessage('');
      setShowReplyForm(false);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send message.'),
  });

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <h4 className="font-bold text-slate-900 text-sm">{clarification.subject}</h4>
          <span className="text-[11px] text-slate-400 font-mono">
            {new Date(clarification.createdAt).toLocaleDateString()} at {new Date(clarification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase font-mono border ${
          clarification.status === 'responded'
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : clarification.status === 'resolved'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          {clarification.status}
        </span>
      </div>

      {/* Initial Query Message */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-800 space-y-1">
        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
          <span className="text-blue-700 font-semibold">Statutory Officer Query</span>
          <span>{clarification.requestedBy?.email ?? 'Desk Officer'}</span>
        </div>
        <p className="pt-0.5 leading-relaxed">{clarification.message}</p>
      </div>

      {/* Responses Timeline */}
      {clarification.responses.length > 0 && (
        <div className="space-y-2 pl-3 border-l-2 border-blue-200">
          {clarification.responses.map((r) => {
            const isApplicant = r.authorRole === 'applicant';
            return (
              <div
                key={r.id}
                className={`p-3 rounded-xl text-xs border ${
                  isApplicant
                    ? 'bg-amber-50/60 border-amber-200/70 text-amber-950'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex justify-between text-[11px] font-medium pb-1 border-b border-black/5">
                  <span className={isApplicant ? 'text-amber-800 font-bold' : 'text-blue-700 font-bold'}>
                    {isApplicant ? '🏢 Applicant Response' : '🛡️ Officer Follow-up'}
                  </span>
                  <span className="text-slate-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>

                <p className="mt-1 leading-relaxed">{r.message}</p>

                {r.documents.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-black/5 flex flex-wrap gap-1.5 text-[11px]">
                    <span className="text-slate-500 font-medium">Attached:</span>
                    {r.documents.map((d) => (
                      <span key={d.id} className="px-2 py-0.2 rounded bg-white border border-slate-200 text-slate-700 font-mono">
                        {d.currentVersion?.originalFilename ?? d.id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      {/* Actions */}
      {clarification.isOpen && (
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Resolution note (optional)…"
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate()}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1 shadow-2xs transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Resolve</span>
            </button>
            <button
              type="button"
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              <span>{showReplyForm ? 'Close Reply' : 'Reply'}</span>
            </button>
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs transition-colors"
            >
              <span>Cancel Query</span>
            </button>
          </div>

          {showReplyForm && (
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (followUpMessage.trim() && !followUpMutation.isPending) {
                  followUpMutation.mutate();
                }
              }}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mt-2"
            >
              <textarea
                rows={2}
                value={followUpMessage}
                onChange={(e) => setFollowUpMessage(e.target.value)}
                placeholder="Type your follow-up question…"
                className="w-full p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={followUpMutation.isPending || !followUpMessage.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Follow-Up</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {clarification.resolutionNote && (
        <p className="text-xs text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-mono">
          <strong>Resolution:</strong> {clarification.resolutionNote}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clean Application Review Detail Page
// ---------------------------------------------------------------------------
export function OfficerApplicationPage(): JSX.Element {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { accessToken, isRestoring, user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'dossier' | 'documents' | 'clarifications' | 'consistency' | 'risk_actions' | 'audit'>('dossier');
  const [clarificationSubject, setClarificationSubject] = useState('');
  const [clarificationMessage, setClarificationMessage] = useState('');
  const [clarificationError, setClarificationError] = useState<string | null>(null);

  const packetQuery = useQuery({
    queryKey: ['officer-application', instanceId, accessToken],
    queryFn: () => officerApi.application(instanceId ?? '', accessToken ?? undefined),
    enabled: accessToken !== null && instanceId !== undefined,
  });

  const askClarificationMutation = useMutation({
    mutationFn: () =>
      officerApi.requestClarification(
        instanceId ?? '',
        {
          ...(clarificationSubject.trim() ? { subject: clarificationSubject.trim() } : {}),
          message: clarificationMessage.trim(),
        },
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setClarificationSubject('');
      setClarificationMessage('');
      setClarificationError(null);
      void queryClient.invalidateQueries({ queryKey: ['officer-application', instanceId] });
      setActiveTab('clarifications');
    },
    onError: (err) => setClarificationError(err instanceof ApiError ? err.message : 'Could not send query.'),
  });

  if (packetQuery.isLoading || isRestoring || instanceId === undefined) {
    return <LoadingSpinner label="Loading statutory application dossier…" />;
  }

  if (accessToken === null) {
    return <ErrorBanner message="Your session has ended — please log in again." />;
  }

  if (user !== null && user.role !== 'officer' && user.role !== 'admin') {
    return (
      <ErrorBanner message="This portal is reserved for statutory officers." />
    );
  }

  if (packetQuery.isError) {
    return (
      <ErrorBanner
        message={packetQuery.error instanceof Error ? packetQuery.error.message : 'Could not load application packet.'}
        onRetry={() => void packetQuery.refetch()}
      />
    );
  }

  const packet = packetQuery.data;
  if (!packet) {
    return <LoadingSpinner label="Loading application…" />;
  }

  const auth = getAuthorityBadge(packet.approval?.authority?.code);
  const pendingAttentionCount = packet.clarifications.filter((c) => c.status === 'responded').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between gap-4 pb-2">
        <Link
          to="/officer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Officer Queue</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase font-mono border ${
            packet.instance.status === 'in_progress'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {packet.instance.status.replace('_', ' ')}
          </span>

          <span className="text-xs text-slate-500 font-mono">
            SLA: {packet.approval?.slaDays ? `${packet.approval.slaDays} Days` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Main Dossier Header Card */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border ${auth.bg} ${auth.text} ${auth.border}`}>
                {packet.approval?.authority?.code ?? 'AUTH'} · {packet.approval?.authority?.name}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Code: {packet.approval?.code}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {packet.approval?.name ?? 'Statutory Clearance'}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
              <span><strong>Project:</strong> {packet.project?.name ?? '—'}</span>
              <span>•</span>
              <span><strong>Industry:</strong> {packet.project?.industry ?? '—'}</span>
              <span>•</span>
              <span><strong>Applicant Contact:</strong> {(packet.project?.contacts ?? []).map((c) => c.email).join(', ') || 'Direct'}</span>
            </div>
          </div>

          {packet.approval?.officialApplicationUrl && (
            <a
              href={packet.approval.officialApplicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors shrink-0"
            >
              <span>State Department Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {pendingAttentionCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Attention:</strong> {pendingAttentionCount} clarification response{pendingAttentionCount === 1 ? '' : 's'} received from applicant awaiting your assessment.
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 text-xs sm:text-sm overflow-x-auto">
        {[
          { id: 'dossier', label: '1. Legal Basis & Summary', icon: Building2 },
          { id: 'documents', label: `2. Evidence & Documents (${packet.documents.length})`, icon: FileText },
          { id: 'clarifications', label: `3. Clarifications (${packet.clarificationSummary.total})`, icon: MessageSquare },
          { id: 'consistency', label: `4. AI Pre-Audit Findings (${packet.consistencyFindings.length})`, icon: Sparkles },
          { id: 'risk_actions', label: '5. Risk & Officer Actions', icon: ShieldCheck },
          { id: 'audit', label: `6. Audit Trail (${(packet.auditTrail as unknown[] | undefined)?.length ?? 0})`, icon: FolderOpen },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2.5 font-semibold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: LEGAL BASIS & SUMMARY */}
      {activeTab === 'dossier' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Statutory Rule &amp; Applicability</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {packet.approval?.whyRequired ?? 'Determined applicable based on industrial activity, location, and plant threshold criteria.'}
            </p>

            {packet.approval?.ambiguityNotes && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <strong className="text-slate-800">Desk Guidance:</strong> {packet.approval.ambiguityNotes}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Statutory Source &amp; Authority
              </h4>
              <div className="text-xs space-y-1.5 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[11px]">Authority:</span>
                  <strong>{packet.approval?.authority?.name ?? '—'}</strong>
                </div>
                {packet.approval?.source && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">Source Title:</span>
                    <p>{packet.approval.source.title}</p>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Verified: {new Date(packet.approval.source.lastVerifiedDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                Evaluation Snapshot
              </h4>
              <div className="text-xs font-mono space-y-1.5 text-slate-700">
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-400">Industry:</span>
                  <span>{packet.project?.industry ?? '—'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-100">
                  <span className="text-slate-400">Engine Version:</span>
                  <span>{packet.evaluation?.engineVersion ?? '0.1.0'}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-400">Knowledge Release:</span>
                  <span>{packet.evaluation?.releaseVersion ?? 'v1.0.0'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EVIDENCE & DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Required Statutory Checklist</h3>
              <p className="text-xs text-slate-500">
                {packet.requiredDocuments.total} Required · {packet.requiredDocuments.verified} Verified · {packet.requiredDocuments.missing} Missing
              </p>
            </div>

            <div className="space-y-2">
              {packet.requiredDocuments.items.map((doc) => (
                <div
                  key={doc.code}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">{doc.name}</span>
                    <span className="text-slate-400 font-mono ml-2">({doc.code})</span>
                    {doc.condition && <p className="text-slate-500 text-[11px] mt-0.5">{doc.condition}</p>}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono border ${
                      doc.status === 'verified'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : doc.status === 'provided_unverified'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {doc.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600" />
              <span>Applicant Vault Uploads ({packet.documents.length})</span>
            </h3>

            {packet.documents.length === 0 ? (
              <p className="text-xs text-slate-500">No documents uploaded into the project vault yet.</p>
            ) : (
              <div className="space-y-2">
                {packet.documents.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <div>
                          <span className="font-semibold text-slate-900">
                            {d.currentVersion?.originalFilename ?? d.id}
                          </span>
                          <span className="text-slate-400 font-mono ml-2">v{d.currentVersion?.versionNumber ?? 1}</span>
                        </div>
                      </div>

                      <a
                        href={officerApi.documentDownloadUrl(packet.instance.id, d.id, d.currentVersion?.id ?? '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-blue-600 text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    </div>
                    <VersionList versions={(d as unknown as { versions?: Array<Record<string, unknown>> }).versions ?? []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CLARIFICATIONS */}
      {activeTab === 'clarifications' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Clarification Threads ({packet.clarifications.length})
            </h3>

            {packet.clarifications.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Clarifications Open</h4>
                <p className="text-xs text-slate-500">Use the form below to ask for missing evidence or details.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {packet.clarifications.map((c) => (
                  <CleanClarificationThread
                    key={c.id}
                    clarification={c}
                    instanceId={packet.instance.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* New Query Composer */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Send New Clarification Request</span>
            </h3>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                'Land Lease Agreement & Title Deed',
                'Effluent Treatment Plant (ETP) Flowchart',
                'Factory Layout & Fire Evacuation Plan',
                'High-Tension Power Sanction Letter',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setClarificationSubject(preset);
                    if (!clarificationMessage) {
                      setClarificationMessage(`Please upload the latest statutory document for ${preset.toLowerCase()} as mandated under state norms.`);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            {clarificationError && <ErrorBanner message={clarificationError} />}

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (clarificationMessage.trim() && !askClarificationMutation.isPending) {
                  askClarificationMutation.mutate();
                }
              }}
              className="space-y-3 pt-1"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={clarificationSubject}
                  onChange={(e) => setClarificationSubject(e.target.value)}
                  placeholder="e.g. Missing Zero Liquid Discharge Flowchart"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Query Message *
                </label>
                <textarea
                  rows={3}
                  required
                  value={clarificationMessage}
                  onChange={(e) => setClarificationMessage(e.target.value)}
                  placeholder="Specify the exact documentation or technical calculations needed…"
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={askClarificationMutation.isPending || !clarificationMessage.trim()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{askClarificationMutation.isPending ? 'Sending…' : 'Issue Clarification'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: AI PRE-AUDIT */}
      {activeTab === 'consistency' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Automated Cross-Check Findings</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              ApprovalIQ verifies uploaded documents against the enterprise profile snapshot to detect discrepancies before manual desk review.
            </p>
          </div>

          {packet.consistencyFindings.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-800">All Consistency Checks Passed</h4>
              <p className="text-xs text-slate-500">No discrepancies detected across statutory parameters.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {packet.consistencyFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-950"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-900">{finding.checkId}</span>
                      <span className="px-2 py-0.2 rounded bg-amber-200/70 text-amber-900 text-[10px] font-mono uppercase">
                        {finding.outcome}
                      </span>
                    </div>
                    <p className="text-slate-700">{finding.detail ?? 'Discrepancy flagged.'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RISK ASSESSMENT & OFFICER ACTIONS */}
      {activeTab === 'risk_actions' && (
        <div className="space-y-4">
          {packet.riskScores && (
            <RiskScoresPanel riskScores={packet.riskScores as unknown as Record<string, unknown>} />
          )}
          <OfficerActionsPanel instanceId={packet.instance.id} />
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <AuditTrailPanel auditTrail={((packet.auditTrail ?? []) as unknown as Array<Record<string, unknown>>)} />
        </div>
      )}
    </div>
  );
}

function VersionList({ versions }: { versions: Array<Record<string, unknown>> }): JSX.Element | null {
  if (versions.length === 0) return null;
  return (
    <ul className="mt-1 space-y-1 text-xs text-gray-600">
      {versions.map((v) => {
        const extraction = v['extraction'] as Record<string, unknown> | null;
        const verification = v['verification'] as Record<string, unknown> | null;
        return (
          <li key={String(v['id'])}>
            v{String(v['versionNumber'])} · {String(v['state'])} · extraction:{' '}
            {typeof extraction?.['modelProvider'] === 'string' ? extraction['modelProvider'] : 'none'} ·
            verification: {typeof verification?.['method'] === 'string' ? verification['method'] : 'none'}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Feature 3: Risk Scores Panel
// ---------------------------------------------------------------------------

function RiskScoresPanel({ riskScores }: { riskScores: Record<string, unknown> }): JSX.Element {
  const submissionRisk = riskScores['submissionRisk'] as Record<string, unknown> | undefined;
  const complexity = riskScores['regulatoryComplexity'] as Record<string, unknown> | undefined;
  const recommendation = typeof riskScores['recommendation'] === 'string' ? riskScores['recommendation'] : 'Unknown';
  const missingReqs = Array.isArray(riskScores['missingRequirements']) ? riskScores['missingRequirements'] as Array<Record<string, unknown>> : [];
  const validationProblems = Array.isArray(riskScores['validationProblems']) ? riskScores['validationProblems'] as Array<Record<string, unknown>> : [];

  const levelColor = (level: string): string => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Explainable Risk-Based Scrutiny</h2>
          <p className="text-xs text-gray-500">
            Calibrated against DPIIT BRAP recommendations &amp; Right to Services (RTS) scrutiny priority guidelines.
          </p>
        </div>
        <span className="rounded bg-slate-100 border border-slate-300 px-2.5 py-1 text-[11px] font-mono font-semibold text-slate-700">
          Engine v0.0.1
        </span>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900">Statutory Risk Assessment</h2>
        <p className="text-xs text-slate-500">Automated submission risk analysis and regulatory complexity scoring</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Submission Risk */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Submission Risk</h3>
            {submissionRisk && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${levelColor(String(submissionRisk.level))}`}>
                {String(submissionRisk.score)} · {String(submissionRisk.level)}
              </span>
            )}
          </div>
          {submissionRisk && Array.isArray(submissionRisk.reasons) && (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {(submissionRisk.reasons as string[]).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Regulatory Complexity */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800">Regulatory Complexity</h3>
            {complexity && (
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${levelColor(String(complexity.level))}`}>
                {String(complexity.score)} · {String(complexity.level)}
              </span>
            )}
          </div>
          {complexity && Array.isArray(complexity.reasons) && (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {(complexity.reasons as string[]).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="shrink-0 text-slate-400">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5">
        <p className="text-xs sm:text-sm">
          <span className="font-bold text-blue-900">Recommendation:</span>{' '}
          <span className="text-blue-800">ApprovalIQ recommends <strong>{recommendation}</strong></span>
        </p>
      </div>

      {/* Missing Requirements */}
      {missingReqs.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-800">Missing Requirements</h3>
          <ul className="space-y-1 text-xs">
            {missingReqs.map((r, i) => (
              <li key={i} className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-red-800">
                {String(r['field'])} — {String(r['reason'])}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Problems */}
      {validationProblems.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-slate-800">Validation Problems</h3>
          <ul className="space-y-1 text-xs">
            {validationProblems.map((p, i) => (
              <li key={i} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-amber-800">
                {String(p['detail'])}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Feature 3: Audit Trail Panel
// ---------------------------------------------------------------------------

function AuditTrailPanel({ auditTrail }: { auditTrail: Array<Record<string, unknown>> }): JSX.Element {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Audit Trail</h2>
        <p className="text-xs text-slate-500">Immutable chronological log of statutory actions and status changes</p>
      </div>
      {auditTrail.length === 0 ? (
        <p className="text-xs text-slate-500">No audit events logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {auditTrail.map((event) => {
            const user = event['user'] as Record<string, unknown> | null;
            return (
              <li key={String(event['id'])} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <span className="shrink-0 font-mono text-slate-400 text-[11px]">
                  {event['createdAt'] ? new Date(String(event['createdAt'])).toLocaleString() : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    <span>{String(event['action'])}</span>
                    {user ? <span className="text-slate-500 font-normal"> by {String(user['email'])} ({String(user['role'])})</span> : null}
                  </p>
                  {Boolean(event['details']) && typeof event['details'] === 'object' && (
                    <pre className="mt-1 text-[10px] text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">{String(JSON.stringify(event['details'] as object, null, 2))}</pre>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Feature 3: Officer Actions Panel
// ---------------------------------------------------------------------------

function OfficerActionsPanel({ instanceId }: { instanceId: string }): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recordAction = useMutation({
    mutationFn: (action: string) =>
      fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/officer/applications/${instanceId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      }).then((r) => {
        if (!r.ok) throw new Error(`Failed: ${r.status}`);
        return r.json() as Promise<Record<string, unknown>>;
      }),
    onSuccess: () => {
      setNote('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['officer-application', instanceId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Action failed'),
  });

  const actions = [
    { action: 'review_application', label: 'Review Application', color: 'bg-blue-600 hover:bg-blue-700' },
    { action: 'recommend_approval', label: 'Recommend Approval', color: 'bg-emerald-600 hover:bg-emerald-700' },
    { action: 'recommend_rejection', label: 'Recommend Rejection', color: 'bg-rose-600 hover:bg-rose-700' },
    { action: 'return_for_correction', label: 'Return for Correction', color: 'bg-amber-600 hover:bg-amber-700' },
    { action: 'mark_document_reviewed', label: 'Mark Document Reviewed', color: 'bg-purple-600 hover:bg-purple-700' },
    { action: 'request_clarification', label: 'Request Clarification', color: 'bg-indigo-600 hover:bg-indigo-700' },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
      <h2 className="text-base font-bold text-slate-900">Officer Statutory Actions</h2>
      <p className="text-xs text-slate-500">All actions are recorded in the audit trail. No automatic approval/rejection occurs.</p>
      {error && <div className="mb-2"><ErrorBanner message={error} /></div>}
      <label className="block text-xs font-semibold text-slate-700">
        <span>Review Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500"
          placeholder="Add a statutory note about this action"
        />
      </label>
      <div className="flex flex-wrap gap-2 pt-1">
        {actions.map((a) => (
          <button
            key={a.action}
            type="button"
            disabled={recordAction.isPending}
            onClick={() => recordAction.mutate(a.action)}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50 ${a.color}`}
          >
            {recordAction.isPending ? 'Recording…' : a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
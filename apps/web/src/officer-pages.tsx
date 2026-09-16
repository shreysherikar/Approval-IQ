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

// ---------------------------------------------------------------------------
// Clean Application List Row Card
// ---------------------------------------------------------------------------
function CleanApplicationCard({ item }: { item: QueueItem }): JSX.Element {
  const auth = getAuthorityBadge(item.authority?.code);
  const isAwaitingOfficer = item.clarificationsAwaitingOfficer > 0;
  const verifiedCount = item.requiredDocuments.verified;
  const totalDocs = item.requiredDocuments.total;

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
            Application Review Queue
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            Manage statutory industrial clearances, inspect submitted evidence, and communicate with applicants.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void queueQuery.refetch();
            void authoritiesQuery.refetch();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

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

  const [activeTab, setActiveTab] = useState<'dossier' | 'documents' | 'clarifications' | 'consistency'>('dossier');
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
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
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
    </div>
  );
}
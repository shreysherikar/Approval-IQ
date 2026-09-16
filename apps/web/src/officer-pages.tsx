import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError, officerApi, type ApplicationPacket, type QueueItem } from './api-client';
import { useAuth } from './auth';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

function QueueCard({ item }: { item: QueueItem }): JSX.Element {
  return (
    <article className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{item.approval?.name ?? 'Approval'}</p>
          <p className="font-mono text-xs text-gray-500">{item.approval?.code}</p>
          <p className="mt-1 text-sm text-gray-700">
            {item.project?.name ?? 'Project'}{' '}
            <span className="text-xs text-gray-500">
              · {(item.project?.applicantEmails ?? []).join(', ') || 'no contact'}
            </span>
          </p>
        </div>
        <span className="shrink-0 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
          {item.instanceStatus}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5">
          {item.authority?.name ?? item.authority?.code ?? 'Authority'}
        </span>
        {item.attentionRequired && (
          <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 font-semibold text-red-800">
            Needs manual check
          </span>
        )}
        {item.clarificationsAwaitingOfficer > 0 && (
          <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
            {item.clarificationsAwaitingOfficer} waiting on you
          </span>
        )}
        {item.requiredDocuments.missing > 0 && (
          <span className="rounded border border-amber-200 bg-white px-2 py-0.5 text-amber-800">
            {item.requiredDocuments.missing} required document{item.requiredDocuments.missing === 1 ? '' : 's'} missing
          </span>
        )}
        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-600">
          SLA: {item.slaDays !== null ? `${item.slaDays} days` : 'not recorded'}
        </span>
      </div>

      <div className="mt-3">
        <Link
          to={`/officer/applications/${item.instanceId}`}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Open review
        </Link>
      </div>
    </article>
  );
}

/**
 * Phase 9 officer queue: submitted (in_progress) applications under the
 * officer's authorities, with response-waiting threads first. Other status
 * filters exist for oversight; the default view is the actionable one.
 */
export function OfficerQueuePage(): JSX.Element {
  const { accessToken, isRestoring, user } = useAuth();
  const [status, setStatus] = useState('in_progress');
  const [authorityId, setAuthorityId] = useState('');

  const authoritiesQuery = useQuery({
    queryKey: ['officer-authorities', accessToken],
    queryFn: () => officerApi.authorities(accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  const queueFilter = authorityId ? `status=${status}&authorityId=${authorityId}` : `status=${status}`;
  const queueQuery = useQuery({
    queryKey: ['officer-queue', accessToken, status, authorityId],
    queryFn: () => officerApi.queue(accessToken ?? undefined, queueFilter),
    enabled: accessToken !== null,
  });

  if (queueQuery.isLoading || authoritiesQuery.isLoading || isRestoring) {
    return <LoadingSpinner label="Loading the officer queue…" />;
  }
  if (accessToken === null) {
    return <ErrorBanner message="Your session has ended — please log in again." />;
  }
  if (user !== null && user.role !== 'officer' && user.role !== 'admin') {
    return (
      <ErrorBanner message="This page is only available to officers. Sign in with an officer account." />
    );
  }
  if (authoritiesQuery.isError) {
    return (
      <ErrorBanner
        message={authoritiesQuery.error instanceof Error ? authoritiesQuery.error.message : 'Could not load authorities.'}
        onRetry={() => void authoritiesQuery.refetch()}
      />
    );
  }
  if (queueQuery.isError) {
    return (
      <ErrorBanner
        message={queueQuery.error instanceof Error ? queueQuery.error.message : 'Could not load the queue.'}
        onRetry={() => void queueQuery.refetch()}
      />
    );
  }

  const authorities = authoritiesQuery.data?.authorities ?? [];
  const queue = queueQuery.data;
  if (queue === undefined) {
    return <LoadingSpinner label="Loading the officer queue…" />;
  }

  const [activeTab, setActiveTab] = useState<'applications' | 'grievances'>('applications');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Officer Workstation</h1>
          <p className="text-sm text-gray-600">
            Process clearance applications, answer inquiries, and adjudicate RTS statutory grievances.
          </p>
        </div>
        <div className="flex rounded-md border border-gray-300 bg-gray-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`rounded px-3 py-1.5 transition-colors ${
              activeTab === 'applications' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Applications ({queue.total})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grievances')}
            className={`rounded px-3 py-1.5 transition-colors ${
              activeTab === 'grievances' ? 'bg-white text-rose-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⚖️ Statutory RTS Grievances
          </button>
        </div>
      </div>

      {activeTab === 'grievances' ? (
        <OfficerGrievancesView />
      ) : (
        <>
          <div className="text-xs text-gray-500">
            {queue.total} application{queue.total === 1 ? '' : 's'} · {queue.summary.awaitingOfficer} waiting on
            you · {queue.summary.awaitingApplicant} waiting on applicants
          </div>

      <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3">
        <label className="text-sm">
          <span className="mr-2 text-gray-700">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border px-2 py-1">
            <option value="in_progress">Submitted (in progress)</option>
            <option value="available">Available</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mr-2 text-gray-700">Authority</span>
          <select
            value={authorityId}
            onChange={(e) => setAuthorityId(e.target.value)}
            className="rounded border px-2 py-1"
          >
            <option value="">All assigned</option>
            {authorities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.openApplications} open)
              </option>
            ))}
          </select>
        </label>
      </div>

      {authorities.length === 0 ? (
        <EmptyState
          title="No authority assigned"
          description="Your officer account is not assigned to any authority yet. Ask an administrator to assign you before reviewing applications."
        />
      ) : queue.items.length === 0 ? (
        <EmptyState title="Queue is clear" description="No applications in this view. Try another status filter." />
      ) : (
        <div className="space-y-3">
          {queue.items.map((item) => (
            <QueueCard key={item.instanceId} item={item} />
          ))}
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

function ClarificationBadge({ status }: { status: string }): JSX.Element {
  const badge =
    status === 'requested'
      ? 'bg-amber-100 text-amber-800 border-amber-300'
      : status === 'responded'
        ? 'bg-blue-100 text-blue-800 border-blue-300'
        : status === 'resolved'
          ? 'bg-green-100 text-green-800 border-green-300'
          : 'bg-gray-100 text-gray-700 border-gray-300';
  return (
    <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${badge}`}>
      {status}
    </span>
  );
}

function ClarificationThread({
  clarification,
  instanceId,
}: {
  clarification: import('./api-client').ClarificationView;
  instanceId: string;
}): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [followUpMessage, setFollowUpMessage] = useState('');
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
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not resolve.'),
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
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not cancel.'),
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
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send the follow-up.'),
  });

  return (
    <article className="rounded border border-gray-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-gray-900">{clarification.subject}</p>
        <ClarificationBadge status={clarification.status} />
      </div>
      <p className="mt-1 text-sm text-gray-800">{clarification.message}</p>
      <div className="mt-2 space-y-1.5">
        {clarification.responses.map((r) => (
          <div key={r.id} className="rounded border border-gray-100 bg-gray-50 p-2">
            <p className="text-xs text-gray-500">
              {r.authorRole} · {r.author?.email ?? ''} · {new Date(r.createdAt).toLocaleString()}
            </p>
            <p className="mt-0.5 text-sm">{r.message}</p>
            {r.documents.length > 0 && (
              <p className="mt-0.5 text-xs text-gray-600">
                📎 {r.documents.length} document{r.documents.length === 1 ? '' : 's'} attached (
                {r.documents.map((d) => d.currentVersion?.state ?? 'unknown').join(', ')})
              </p>
            )}
          </div>
        ))}
      </div>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} />
        </div>
      )}
      {clarification.isOpen && (
        <div className="mt-2 space-y-2 border-t pt-2">
          <label className="block text-sm">
            <span className="text-gray-700">Resolution / cancellation note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              placeholder="Optional note recorded with the decision"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={resolveMutation.isPending}
              onClick={() => resolveMutation.mutate()}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Resolving…' : 'Resolve'}
            </button>
            <button
              type="button"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              className="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel request'}
            </button>
          </div>
          {clarification.status === 'responded' && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (followUpMessage.trim().length > 0 && !followUpMutation.isPending) {
                  followUpMutation.mutate();
                }
              }}
            >
              <label className="min-w-0 flex-1 text-sm">
                <span className="text-gray-700">Follow-up question</span>
                <input
                  value={followUpMessage}
                  onChange={(e) => setFollowUpMessage(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1"
                  placeholder="Ask for something else…"
                />
              </label>
              <button
                type="submit"
                disabled={followUpMutation.isPending || followUpMessage.trim().length === 0}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {followUpMutation.isPending ? 'Sending…' : 'Send follow-up'}
              </button>
            </form>
          )}
        </div>
      )}
      {clarification.resolutionNote && (
        <p className="mt-2 text-xs text-gray-600">Resolution: {clarification.resolutionNote}</p>
      )}
    </article>
  );
}

function RequiredDocumentsPanel({ packet }: { packet: ApplicationPacket }): JSX.Element {
  const { verified, providedUnverified, missing, total, items } = packet.requiredDocuments;
  const statusStyle = (status: string): string =>
    status === 'verified'
      ? 'bg-green-100 text-green-800 border-green-300'
      : status === 'provided_unverified'
        ? 'bg-amber-100 text-amber-800 border-amber-300'
        : 'bg-red-50 text-red-800 border-red-200';
  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Required documents</h2>
      <p className="text-sm text-gray-600">
        {total} required · {verified} verified · {providedUnverified} provided, not verified · {missing} missing
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.code} className="rounded border border-gray-100 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {item.name} <span className="font-mono text-xs text-gray-500">{item.code}</span>
              </p>
              <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${statusStyle(item.status)}`}>
                {item.status === 'verified'
                  ? 'Verified'
                  : item.status === 'provided_unverified'
                    ? `Provided (${item.versionState ?? 'unverified'})`
                    : 'Missing'}
              </span>
            </div>
            {item.condition && <p className="mt-1 text-xs text-gray-500">Condition: {item.condition}</p>}
          </li>
        ))}
      </ul>
      {total === 0 && <p className="mt-1 text-sm text-gray-500">No documents required for this approval.</p>}
    </section>
  );
}

function AskClarificationForm({ instanceId }: { instanceId: string }): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const askMutation = useMutation({
    mutationFn: () =>
      officerApi.requestClarification(
        instanceId,
        {
          ...(subject.trim() ? { subject: subject.trim() } : {}),
          message: message.trim(),
        },
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setSubject('');
      setMessage('');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['officer-application', instanceId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send the request.'),
  });

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Request a clarification</h2>
      <p className="text-xs text-gray-500">
        The applicant sees this in their inbox and can respond with vault documents. Requested fields
        default to the pinned evaluation’s missing fields.
      </p>
      {error && (
        <div className="mt-2">
          <ErrorBanner message={error} />
        </div>
      )}
      <form
        className="mt-2 space-y-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          if (message.trim().length > 0 && !askMutation.isPending) askMutation.mutate();
        }}
      >
        <label className="block text-sm">
          <span className="text-gray-700">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="e.g. Land area evidence"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            required
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="What do you need from the applicant?"
          />
        </label>
        <button
          type="submit"
          disabled={askMutation.isPending || message.trim().length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {askMutation.isPending ? 'Sending…' : 'Send clarification request'}
        </button>
      </form>
    </section>
  );
}

/**
 * Phase 9 officer application review: pinned evaluation + citations, required
 * vs provided documents, uploaded documents with provenance, consistency
 * findings, and the full clarification thread with lifecycle actions.
 */
export function OfficerApplicationPage(): JSX.Element {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { accessToken, isRestoring, user } = useAuth();

  const packetQuery = useQuery({
    queryKey: ['officer-application', instanceId, accessToken],
    queryFn: () => officerApi.application(instanceId ?? '', accessToken ?? undefined),
    enabled: accessToken !== null && instanceId !== undefined,
  });

  if (packetQuery.isLoading || isRestoring || instanceId === undefined) {
    return <LoadingSpinner label="Loading the application…" />;
  }
  if (accessToken === null) {
    return <ErrorBanner message="Your session has ended — please log in again." />;
  }
  if (user !== null && user.role !== 'officer' && user.role !== 'admin') {
    return (
      <ErrorBanner message="This page is only available to officers. Sign in with an officer account." />
    );
  }
  if (packetQuery.isError) {
    return (
      <ErrorBanner
        message={
          packetQuery.error instanceof Error ? packetQuery.error.message : 'Could not load the application.'
        }
        onRetry={() => void packetQuery.refetch()}
      />
    );
  }

  const packet = packetQuery.data;
  if (packet === undefined) {
    return <LoadingSpinner label="Loading the application…" />;
  }
  const attention = packet.clarifications.filter((c) => c.status === 'responded').length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600">
          <Link to="/officer" className="text-blue-600 hover:underline">
            ← Officer queue
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{packet.approval?.name ?? 'Application'}</h1>
        <p className="text-sm text-gray-600">
          <span className="font-mono text-xs">{packet.approval?.code}</span> · {packet.instance.status} ·{' '}
          {packet.project?.name ?? ''} · {(packet.project?.contacts ?? []).map((c) => c.email).join(', ')}
        </p>
        {attention > 0 && (
          <p className="mt-1 text-sm font-medium text-amber-700">
            {attention} clarification{attention === 1 ? '' : 's'} awaiting your review
          </p>
        )}
      </div>

      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Why this approval applies</h2>
        <p className="mt-1 text-sm text-gray-800">{packet.approval?.whyRequired}</p>
        <p className="mt-1 text-sm">
          <span className="text-gray-600">Authority: </span>
          {packet.approval?.authority?.name ?? '—'}
        </p>
        {packet.approval?.officialApplicationUrl && (
          <p className="mt-1 text-sm">
            <span className="text-gray-600">Apply: </span>
            <a
              href={packet.approval.officialApplicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-blue-600 hover:underline"
            >
              {packet.approval.officialApplicationUrl}
            </a>
          </p>
        )}
        {packet.approval?.source && (
          <p className="mt-1 text-xs text-gray-500">
            Source: {packet.approval.source.title} · {packet.approval.source.url} · verified{' '}
            {new Date(packet.approval.source.lastVerifiedDate).toLocaleDateString()}
            {packet.approval.source.stalenessFlag ? ' · flagged stale' : ''}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Outcome: {packet.instance.outcome ?? '—'} · engine {packet.evaluation?.engineVersion ?? '—'} ·
          release {packet.evaluation?.releaseVersion ?? '—'} · SLA:{' '}
          {packet.approval?.slaDays !== null && packet.approval?.slaDays !== undefined
            ? `${packet.approval.slaDays} days`
            : 'not recorded'}
        </p>
      </section>

      <RequiredDocumentsPanel packet={packet} />

      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">
          Provided documents ({packet.documents.length}, {packet.documentSummary.totalVersions} versions)
        </h2>
        {packet.documents.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {packet.documents.map((d) => (
              <li key={d.id} className="rounded border border-gray-100 p-2">
                <p className="text-sm font-medium">
                  {d.currentVersion?.originalFilename ?? d.id}{' '}
                  <span className="text-xs text-gray-500">
                    v{d.currentVersion?.versionNumber ?? '?'} · {d.currentVersion?.state ?? 'unknown'}
                  </span>
                </p>
                <VersionList versions={d.versions} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {packet.consistencyFindings.length > 0 && (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-lg font-semibold text-amber-900">Consistency findings (warnings only)</h2>
          <ul className="mt-1 space-y-1 text-sm text-amber-900">
            {packet.consistencyFindings.map((c) => (
              <li key={c.id}>
                <span className="font-mono text-xs">{c.checkId}</span> · {c.outcome} · {c.detail ?? ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Clarifications ({packet.clarificationSummary.total}, {packet.clarificationSummary.open} open)
        </h2>
        {packet.clarifications.map((c) => (
          <ClarificationThread key={c.id} clarification={c} instanceId={packet.instance.id} />
        ))}
      </section>

      <AskClarificationForm instanceId={packet.instance.id} />
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
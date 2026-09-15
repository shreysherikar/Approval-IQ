import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError, officerApi, type ApplicationPacket, type QueueItem } from './api-client';
import { useAuth } from './auth';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

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

function QueueCard({ item }: { item: QueueItem }): JSX.Element {
  const risk = (item as unknown as { risk?: Record<string, unknown> })?.risk;
  const submissionRisk = risk?.['submissionRisk'] as Record<string, unknown> | undefined;
  const complexity = risk?.['regulatoryComplexity'] as Record<string, unknown> | undefined;
  const recommendation = typeof risk?.['recommendation'] === 'string' ? risk['recommendation'] : null;

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
        <div className="flex shrink-0 gap-2">
          {submissionRisk && (
            <RiskBadge level={String(submissionRisk.level ?? 'unknown')} score={Number(submissionRisk.score ?? 0)} />
          )}
          <span className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
            {item.instanceStatus}
          </span>
        </div>
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
        {complexity && (
          <span className="rounded border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-800">
            Complexity: {String(complexity.level ?? 'unknown')}
          </span>
        )}
        {recommendation && (
          <span className={`rounded border px-2 py-0.5 font-semibold ${
            recommendation === 'Priority Review' ? 'border-red-300 bg-red-50 text-red-800' :
            recommendation === 'Needs Clarification' ? 'border-amber-300 bg-amber-50 text-amber-800' :
            'border-green-300 bg-green-50 text-green-800'
          }`}>
            {recommendation}
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Officer queue</h1>
        <p className="text-sm text-gray-600">
          {queue.total} application{queue.total === 1 ? '' : 's'} · {queue.summary.awaitingOfficer} waiting on
          you · {queue.summary.awaitingApplicant} waiting on applicants
        </p>
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

      {/* Feature 3: Risk Scores */}
      {packet.riskScores && (
        <RiskScoresPanel riskScores={packet.riskScores as unknown as Record<string, unknown>} />
      )}

      {/* Feature 3: Audit Trail */}
      {packet.auditTrail && Array.isArray(packet.auditTrail) && packet.auditTrail.length > 0 && (
        <AuditTrailPanel auditTrail={packet.auditTrail as unknown as Array<Record<string, unknown>>} />
      )}

      {/* Officer Actions */}
      <OfficerActionsPanel instanceId={packet.instance.id} />

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
      <h2 className="text-lg font-semibold">Risk Assessment</h2>
      <p className="text-xs text-gray-500 mb-3">Prototype scoring — not government-approved weights</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Submission Risk */}
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Submission Risk</h3>
            {submissionRisk && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${levelColor(String(submissionRisk.level))}`}>
                {String(submissionRisk.score)} · {String(submissionRisk.level)}
              </span>
            )}
          </div>
          {submissionRisk && Array.isArray(submissionRisk.reasons) && (
            <ul className="mt-2 space-y-1 text-xs text-gray-700">
              {(submissionRisk.reasons as string[]).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="shrink-0 text-gray-400">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Regulatory Complexity */}
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Regulatory Complexity</h3>
            {complexity && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${levelColor(String(complexity.level))}`}>
                {String(complexity.score)} · {String(complexity.level)}
              </span>
            )}
          </div>
          {complexity && Array.isArray(complexity.reasons) && (
            <ul className="mt-2 space-y-1 text-xs text-gray-700">
              {(complexity.reasons as string[]).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="shrink-0 text-gray-400">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recommendation */}
      <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
        <p className="text-sm">
          <span className="font-semibold text-blue-800">Recommendation:</span>{' '}
          <span className="text-blue-700">ApprovalIQ recommends <strong>{recommendation}</strong></span>
        </p>
      </div>

      {/* Missing Requirements */}
      {missingReqs.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-gray-800">Missing Requirements</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {missingReqs.map((r, i) => (
              <li key={i} className="rounded bg-red-50 border border-red-200 px-2 py-1 text-red-800">
                {String(r.field)} — {String(r.reason)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validation Problems */}
      {validationProblems.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-gray-800">Validation Problems</h3>
          <ul className="mt-1 space-y-1 text-xs">
            {validationProblems.map((p, i) => (
              <li key={i} className="rounded bg-amber-50 border border-amber-200 px-2 py-1 text-amber-800">
                {String(p.detail)}
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
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Audit Trail</h2>
      <ul className="mt-2 space-y-2">
        {auditTrail.map((event) => {
          const user = event['user'] as Record<string, unknown> | null;
          return (
            <li key={String(event['id'])} className="flex items-start gap-3 rounded border border-gray-100 bg-gray-50 p-2 text-xs">
              <span className="shrink-0 font-mono text-gray-400">
                {event['createdAt'] ? new Date(String(event['createdAt'])).toLocaleString() : ''}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-800">
                  <span className="font-semibold">{String(event['action'])}</span>
                  {user ? <span className="text-gray-500"> by {String(user['email'])} ({String(user['role'])})</span> : null}
                </p>
                {Boolean(event['details']) && typeof event['details'] === 'object' && (
                  <pre className="mt-1 text-[10px] text-gray-500 overflow-x-auto">{String(JSON.stringify(event['details'] as object, null, 2))}</pre>
                )}
              </div>
            </li>
          );
        })}
      </ul>
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
    { action: 'recommend_approval', label: 'Recommend Approval', color: 'bg-green-600 hover:bg-green-700' },
    { action: 'recommend_rejection', label: 'Recommend Rejection', color: 'bg-red-600 hover:bg-red-700' },
    { action: 'return_for_correction', label: 'Return for Correction', color: 'bg-amber-600 hover:bg-amber-700' },
    { action: 'mark_document_reviewed', label: 'Mark Document Reviewed', color: 'bg-purple-600 hover:bg-purple-700' },
    { action: 'request_clarification', label: 'Request Clarification', color: 'bg-indigo-600 hover:bg-indigo-700' },
  ];

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Officer Actions</h2>
      <p className="text-xs text-gray-500 mb-2">All actions are recorded in the audit trail. No automatic approval/rejection occurs.</p>
      {error && <div className="mb-2"><ErrorBanner message={error} /></div>}
      <label className="block text-sm mb-2">
        <span className="text-gray-700">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Add a note about this action"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a.action}
            type="button"
            disabled={recordAction.isPending}
            onClick={() => recordAction.mutate(a.action)}
            className={`rounded px-3 py-1.5 text-sm text-white disabled:opacity-50 ${a.color}`}
          >
            {recordAction.isPending ? 'Recording…' : a.label}
          </button>
        ))}
      </div>
    </section>
  );
}
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  clarificationsApi,
  documentsApi,
  type ClarificationView,
  type Document,
} from './api-client';
import { useAuth } from './auth';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  requested: { badge: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Waiting on you' },
  responded: { badge: 'bg-blue-100 text-blue-800 border-blue-300', label: 'With the officer' },
  resolved: { badge: 'bg-green-100 text-green-800 border-green-300', label: 'Resolved' },
  cancelled: { badge: 'bg-gray-100 text-gray-700 border-gray-300', label: 'Cancelled' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function ThreadMessages({ clarification }: { clarification: ClarificationView }): JSX.Element | null {
  if (clarification.responses.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {clarification.responses.map((r) => (
        <div key={r.id} className="rounded border border-gray-100 bg-gray-50 p-2">
          <p className="text-xs text-gray-500">
            {r.authorRole === 'officer' || r.authorRole === 'admin'
              ? `Officer (${r.author?.email ?? 'authority'})`
              : `You (${r.author?.email ?? 'applicant'})`}{' '}
            · {formatDate(r.createdAt)}
          </p>
          <p className="mt-1 text-sm text-gray-800">{r.message}</p>
          {r.documents.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
              {r.documents.map((d) => (
                <li key={d.id}>
                  📎 document <span className="font-mono">{d.documentId.slice(0, 8)}…</span>{' '}
                  {d.currentVersion
                    ? `· ${d.currentVersion.originalFilename} · v${d.currentVersion.versionNumber} · ${d.currentVersion.state}`
                    : '· (details unavailable)'}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ResponseForm({
  clarification,
  projectId,
  documents,
}: {
  clarification: ClarificationView;
  projectId: string;
  documents: Document[];
}): JSX.Element {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const respondMutation = useMutation({
    mutationFn: (body: { message: string; documentIds?: string[] }) =>
      clarificationsApi.respond(projectId, clarification.id, body, accessToken ?? undefined),
    onSuccess: () => {
      setMessage('');
      setSelectedDocs([]);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['clarifications', projectId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Could not send the response.'),
  });

  const toggleDoc = (id: string): void => {
    setSelectedDocs((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || respondMutation.isPending) return;
    respondMutation.mutate(
      selectedDocs.length > 0 ? { message: trimmed, documentIds: selectedDocs } : { message: trimmed },
    );
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2 border-t pt-3">
      {error && <ErrorBanner message={error} />}
      <label className="block">
        <span className="text-sm font-medium text-gray-700">Your response</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          required
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          placeholder="Explain and/or attach documents from this project…"
        />
      </label>
      {documents.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">
            Attach documents (already in this project’s vault)
          </legend>
          <div className="mt-1 space-y-1">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedDocs.includes(d.id)}
                  onChange={() => toggleDoc(d.id)}
                />
                <span className="font-mono text-xs">{d.currentVersion?.originalFilename ?? d.id.slice(0, 8)}</span>
                <span className="text-xs text-gray-500">
                  v{d.currentVersion?.versionNumber ?? '?'} · {d.currentVersion?.state ?? 'unknown'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button
        type="submit"
        disabled={respondMutation.isPending || message.trim().length === 0}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {respondMutation.isPending ? 'Sending…' : 'Send response'}
      </button>
    </form>
  );
}

function ClarificationCard({
  clarification,
  projectId,
  documents,
}: {
  clarification: ClarificationView;
  projectId: string;
  documents: Document[];
}): JSX.Element {
  const style = STATUS_STYLES[clarification.status] ?? STATUS_STYLES.cancelled;
  const canRespond = clarification.isOpen && clarification.awaitingParty === 'applicant';

  return (
    <article className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{clarification.subject}</p>
          <p className="text-xs text-gray-500">
            {clarification.approval?.name ?? 'Approval'} · {clarification.authority?.name ?? ''} ·
            asked by {clarification.requestedBy?.email ?? 'officer'}
          </p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${style!.badge}`}>
          {style!.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-800">{clarification.message}</p>

      {clarification.requestedFields.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
          {clarification.requestedFields.map((f) => (
            <li key={f.field}>
              <span className="font-mono text-xs">{f.label ?? f.field}</span>
              {f.reason && <span className="text-xs text-gray-500"> — {f.reason}</span>}
            </li>
          ))}
        </ul>
      )}

      <ThreadMessages clarification={clarification} />

      {clarification.resolutionNote && (
        <p className="mt-2 text-xs text-gray-600">Resolution: {clarification.resolutionNote}</p>
      )}

      {canRespond && (
        <ResponseForm clarification={clarification} projectId={projectId} documents={documents} />
      )}
    </article>
  );
}

/**
 * Phase 9 applicant clarification inbox: every question an authority officer has
 * raised against this project's approvals, newest activity first with open items
 * on top. Responding appends to the thread — the officer sees it in their queue.
 */
export function ApplicantClarificationsPage({ projectId }: { projectId: string }): JSX.Element {
  const { accessToken, isRestoring } = useAuth();

  const inboxQuery = useQuery({
    queryKey: ['clarifications', projectId, accessToken],
    queryFn: () => clarificationsApi.list(projectId, accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  const documentsQuery = useQuery({
    queryKey: ['clarification-documents', projectId, accessToken],
    queryFn: () => documentsApi.list(projectId, accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  if (inboxQuery.isLoading || isRestoring) {
    return <LoadingSpinner label="Loading clarifications…" />;
  }
  if (accessToken === null) {
    return <ErrorBanner message="Your session has ended — please log in again to view clarifications." />;
  }
  if (inboxQuery.isError) {
    return (
      <ErrorBanner
        message={inboxQuery.error instanceof Error ? inboxQuery.error.message : 'Could not load clarifications.'}
        onRetry={() => void inboxQuery.refetch()}
      />
    );
  }

  const inbox = inboxQuery.data;
  if (inbox === undefined) {
    return <LoadingSpinner label="Loading clarifications…" />;
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Clarifications</h1>
        <p className="text-sm text-gray-600">
          Project <span className="font-mono text-xs">{projectId}</span> · {inbox.openCount} open
          {inbox.awaitingApplicantCount > 0 && (
            <span className="font-medium text-amber-700"> · {inbox.awaitingApplicantCount} waiting on you</span>
          )}
        </p>
      </div>
      {inbox.clarifications.length === 0 ? (
        <EmptyState
          title="No clarifications"
          description="Officers will ask here when they need more information about your applications."
        />
      ) : (
        <div className="space-y-3">
          {inbox.clarifications.map((c) => (
            <ClarificationCard
              key={c.id}
              clarification={c}
              projectId={projectId}
              documents={documentsQuery.data ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
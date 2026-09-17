import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { intelligenceApi, documentsApi, reuseApi, type ConsistencyCheckResult, type Document, type ExtractedField } from './api-client';
import { ConsentGrantModal, EmptyState, ErrorBanner, LoadingSpinner } from './components';
import { PROFILE_FIELD_LABELS } from './profile-form';

export function FieldRow(props: {
  field: ExtractedField;
  threshold: number;
  correctedValue: string | null;
  editing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onCancel: () => void;
  saving: boolean;
}): JSX.Element {
  const { field, threshold, correctedValue } = props;
  const isUnknown = field.value === 'unknown';
  const low = field.confidence < threshold;
  return (
    <div className={`rounded border p-3 ${low ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-semibold">{field.name}</p>
        <span className="rounded border px-2 py-0.5 text-xs">
          {isUnknown ? 'unknown' : `confidence ${field.confidence.toFixed(2)}`}
        </span>
      </div>
      <p className="mt-1 text-sm">{isUnknown ? <span className="italic text-gray-500">unknown — not inferred</span> : field.value}</p>
      {field.evidenceLocation && <p className="mt-1 text-xs text-gray-500">Evidence: {field.evidenceLocation}</p>}
      {low && !isUnknown && <p className="mt-1 text-xs font-medium text-amber-700">Needs extra attention (below {threshold.toFixed(2)}).</p>}
      {correctedValue !== null && <p className="mt-1 text-xs text-blue-700">Corrected to {correctedValue} (raw kept)</p>}
      {props.editing ? (
        <div className="mt-2 flex gap-2">
          <input aria-label={`Correct ${field.name}`} id={`correct-${field.name}`} className="w-full rounded border px-2 py-1 text-sm" defaultValue={correctedValue ?? (isUnknown ? '' : field.value)} />
          <button type="button" disabled={props.saving} onClick={() => {
            const el = document.getElementById(`correct-${field.name}`) as HTMLInputElement | null;
            props.onSave(el?.value ?? '');
          }} className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50">Save</button>
          <button type="button" onClick={props.onCancel} className="rounded border px-3 py-1 text-sm">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={props.onEdit} className="mt-2 rounded border px-3 py-1 text-sm">Correct</button>
      )}
    </div>
  );
}
const CONSISTENCY_ATTENTION_OUTCOMES = new Set(['mismatch', 'unknown', 'missing']);

function fieldLabel(key: string | null): string {
  if (!key) return 'document';
  return PROFILE_FIELD_LABELS[key] ?? key;
}

/**
 * Visible, NON-BLOCKING consistency warning banner for a document version.
 * It sits in the normal flow of the page — it is a pure, plain banner and never
 * disables, intercepts, or prevents any other action on the document detail view.
 */
function ConsistencyBanner({ checks }: { checks: ConsistencyCheckResult[] }): JSX.Element | null {
  if (!checks || checks.length === 0) return null;
  const attention = checks.filter((c) => CONSISTENCY_ATTENTION_OUTCOMES.has(c.outcome));
  const mismatches = checks.filter((c) => c.outcome === 'mismatch');
  const summary =
    attention.length > 0
      ? `${attention.length} of ${checks.length} checks need attention`
      : `all ${checks.length} checks consistent`;
  return (
    <div
      role="status"
      className={`rounded-md border p-3 ${attention.length > 0 ? 'border-amber-400 bg-amber-50' : 'border-green-200 bg-green-50'}`}
    >
      <p className={`text-sm font-semibold ${attention.length > 0 ? 'text-amber-900' : 'text-green-900'}`}>
        Consistency check — {summary}
      </p>
      {attention.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-5 text-sm text-amber-900">
          {mismatches.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{fieldLabel(c.profileField)}</span>: mismatch —{' '}
              {c.detail ?? `${c.sideAValue ?? '?'} vs ${c.sideBValue ?? '?'}`}
            </li>
          ))}
          {attention
            .filter((c) => c.outcome !== 'mismatch')
            .map((c) => (
              <li key={c.id}>
                <span className="font-medium">{fieldLabel(c.profileField ?? c.documentField)}</span>:{' '}
                {c.outcome.replace('_', ' ')}
                {c.detail ? ` — ${c.detail}` : ''}
              </li>
            ))}
        </ul>
      )}
      {attention.length === 0 && (
        <p className="mt-1 text-xs text-green-900">
          All persisted checks match the confirmed profile or peer document.
        </p>
      )}
      <p className="mt-1 text-xs text-gray-600">
        Consistency results are warnings only — they do not block or change any action on this page.
      </p>
    </div>
  );
}

export function DocumentDetailPage(props: { projectId: string; documentId: string }): JSX.Element {
  const { projectId, documentId } = props;
  const { accessToken, isRestoring } = useAuth();
  const token = accessToken ?? undefined;
  const qc = useQueryClient();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [evidenceInspected, setEvidenceInspected] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const docsQuery = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.list(projectId, token),
    // Documents routes are authenticated + membership-scoped. Hold the first
    // fetch until the in-memory token exists (AuthProvider restores it from the
    // httpOnly cookie), otherwise the very first request can only be a 401.
    enabled: token !== undefined,
  });
  const doc: Document | undefined = (docsQuery.data ?? []).find((d) => d.id === documentId);
  const version = doc?.currentVersion ?? null;
  const extractionQuery = useQuery({
    queryKey: ['extraction', projectId, documentId, version?.id],
    queryFn: () => (version ? intelligenceApi.extraction(projectId, documentId, version.id, token) : Promise.resolve(null)),
    enabled: version !== null, refetchInterval: jobId ? 1500 : false,
  });
  const jobQuery = useQuery({
    queryKey: ['job', projectId, jobId],
    queryFn: () => (jobId ? intelligenceApi.job(projectId, jobId, token) : Promise.resolve(null)),
    enabled: jobId !== null, refetchInterval: 1500,
  });
  // Phase 6: when the async extraction job completes, the backend flips the
  // version to 'needs_verification'. docsQuery is a plain list query with no
  // polling, so without this its version.state would stay at the pre-extraction
  // value ('uploaded'/'queued'/'processing') and the Verify button would remain
  // disabled even though extractionQuery has the completed result. Invalidate
  // the documents query once per completed job so needs_verification is
  // reflected in the UI.
  const invalidatedDocsForJobRef = useRef<string | null>(null);
  useEffect(() => {
    const status = jobQuery.data?.status;
    if (jobId && status === 'completed' && invalidatedDocsForJobRef.current !== jobId) {
      invalidatedDocsForJobRef.current = jobId;
      void qc.invalidateQueries({ queryKey: ['documents', projectId] });
    }
  }, [jobId, jobQuery.data?.status, projectId, qc]);
  // Phase 7 consistency checks for this version — persisted warning-layer rows.
  // Rendered as a visible, NON-blocking banner (it never gates any action here).
  const consistencyQuery = useQuery({
    queryKey: ['consistency-checks', projectId, documentId, version?.id],
    queryFn: () => (version ? intelligenceApi.consistencyChecks(projectId, documentId, version.id, token) : Promise.resolve([])),
    enabled: version !== null && version.id !== undefined,
    staleTime: 10_000,
  });
  const extractMutation = useMutation({
    mutationFn: () => intelligenceApi.extract(projectId, documentId, token),
    onSuccess: (job) => { setJobId(job.id); setStatusMsg(`Extraction queued (job ${job.id}). Polling…`); },
    onError: (e) => setStatusMsg(e instanceof Error ? e.message : 'Enqueue failed'),
  });
  const correctMutation = useMutation({
    mutationFn: (input: { fieldName: string; correctedValue: string }) =>
      version ? intelligenceApi.correctField(projectId, documentId, version.id, input, token) : Promise.reject(new Error('no version')),
    onSuccess: () => { setEditingField(null); void qc.invalidateQueries({ queryKey: ['extraction'] }); },
  });
  const verifyMutation = useMutation({
    mutationFn: () => (version ? intelligenceApi.verify(projectId, documentId, version.id, { notes, evidenceInspected }, token) : Promise.reject(new Error('no version'))),
    onSuccess: () => { setStatusMsg('Verified — state is now verified.'); void qc.invalidateQueries({ queryKey: ['documents'] }); void qc.invalidateQueries({ queryKey: ['extraction'] }); },
    onError: (e) => setStatusMsg(e instanceof Error ? e.message : 'Verify failed'),
  });
  if (docsQuery.isLoading || isRestoring) return <LoadingSpinner label="Loading document…" />;
  if (accessToken === null) {
    return <ErrorBanner message="Your session has ended — please log in again to view this document." />;
  }
  if (docsQuery.isError) return <ErrorBanner message="Could not load the document." onRetry={() => void docsQuery.refetch()} />;
  if (!doc || !version) return <EmptyState title="Document not found" />;
  const job = jobQuery.data;
  const extraction = extractionQuery.data;
  const correctionByField = new Map((extraction?.corrections ?? []).map((c) => [c.fieldName, c.correctedValue]));
  const canVerify = version.state === 'needs_verification' || version.state === 'extracted';
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Document detail</h1>
      {/* Point-of-Display Extraction Statutory Disclaimer Banner (Dossier Part 9.2) */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-2xs">
        <span className="text-base shrink-0 mt-0.5">⚖️</span>
        <div className="space-y-0.5">
          <p className="font-bold tracking-tight">
            AI Field Extraction Notice &amp; Statutory Disclaimer
          </p>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            Extracted fields and evidence locations are machine-assisted previews based on regulations published as of September 2026. Not formal legal advice. The issuing authority’s official determination governs.
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-600">{version.originalFilename} · v{version.versionNumber} · state <span className="font-mono">{version.state}</span></p>
      <ConsistencyBanner checks={consistencyQuery.data ?? []} />
      {statusMsg && <p className="rounded border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800">{statusMsg}</p>}
      {job && <p className="text-sm text-gray-600">Job {job.id}: <span className="font-mono">{job.status}</span> (attempts {job.attemptCount}){job.errorDetails ? ` — ${job.errorDetails}` : ''}</p>}
      <button type="button" onClick={() => extractMutation.mutate()} disabled={extractMutation.isPending} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
        {extractMutation.isPending ? 'Queueing…' : 'Run extraction'}
      </button>
      {extractionQuery.isLoading && <LoadingSpinner label="Loading extraction…" />}
      {extraction && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Provider {extraction.modelProvider} · model {extraction.modelVersion} · prompt {extraction.promptVersion}</p>
          <div className="grid gap-2 md:grid-cols-2">
            {extraction.fields.map((f) => (
              <FieldRow key={f.name} field={f} threshold={extraction.reviewThreshold} correctedValue={correctionByField.get(f.name) ?? null} editing={editingField === f.name} onEdit={() => setEditingField(f.name)} onCancel={() => setEditingField(null)} saving={correctMutation.isPending} onSave={(value) => correctMutation.mutate({ fieldName: f.name, correctedValue: value })} />
            ))}
          </div>
          <div className="rounded border p-3">
            <p className="font-medium">Verify</p>
            <label className="mt-2 block text-sm"><span className="text-gray-700">Notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" rows={2} />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={evidenceInspected} onChange={(e) => setEvidenceInspected(e.target.checked)} /> Evidence inspected
            </label>
            <button type="button" onClick={() => verifyMutation.mutate()} disabled={!canVerify || verifyMutation.isPending} className="mt-2 rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50">
              {verifyMutation.isPending ? 'Verifying…' : 'Verify'}
            </button>
            {!canVerify && <p className="mt-1 text-xs text-gray-500">Verify unlocks once extraction lands in needs_verification.</p>}
          </div>
        </div>
      )}

      {/* DPDP Act 2023 Consent Grants Log */}
      <ConsentGrantsSection projectId={projectId} documentId={documentId} documentName={version.originalFilename} token={accessToken ?? undefined} />
    </div>
  );
}

function ConsentGrantsSection({ projectId, documentId, documentName, token }: { projectId: string; documentId: string; documentName: string; token?: string }): JSX.Element {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const grantsQuery = useQuery({
    queryKey: ['consent-grants', projectId, documentId],
    queryFn: () => reuseApi.getConsentGrants(projectId, documentId, token),
    staleTime: 5_000,
  });

  const revokeMutation = useMutation({
    mutationFn: (grantId: string) => reuseApi.revokeConsent(projectId, grantId, token),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consent-grants', projectId, documentId] });
    },
  });

  const grants = grantsQuery.data ?? [];

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            DPDP Act 2023 Compliant
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 mt-1">Granular Data Share &amp; Reuse Consent Grants</h3>
          <p className="text-xs text-slate-500">Section 6(1) Explicit Consent Ledger &amp; Section 6(4) Revocation Registry</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 shadow-sm transition-all"
        >
          + Authorize New Department Share
        </button>
      </div>

      {grantsQuery.isLoading ? (
        <LoadingSpinner label="Loading consent grants..." />
      ) : grants.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">No cross-department consent grants recorded for this document.</p>
          <p>This document has not been authorized for reuse with external authorities yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-mono border-b border-slate-200">
              <tr>
                <th className="p-2.5">Grant ID</th>
                <th className="p-2.5">Target Authority</th>
                <th className="p-2.5">Purpose</th>
                <th className="p-2.5">Granted At</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {grants.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-mono text-slate-600 font-semibold">{g.id.slice(0, 8)}…</td>
                  <td className="p-2.5 font-bold text-slate-900">{g.targetAuthorityId}</td>
                  <td className="p-2.5 text-slate-700 max-w-xs truncate">{g.purpose}</td>
                  <td className="p-2.5 font-mono text-slate-500">{new Date(g.grantedAt).toLocaleString()}</td>
                  <td className="p-2.5">
                    {g.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">
                        ACTIVE CONSENT
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        REVOKED ({new Date(g.revokedAt!).toLocaleDateString()})
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-right">
                    {g.isActive && (
                      <button
                        type="button"
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(g.id)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline disabled:opacity-50"
                      >
                        Revoke Consent
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConsentGrantModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        documentId={documentId}
        documentName={documentName}
        targetAuthorityId="MPCB"
        targetAuthorityName="Maharashtra Pollution Control Board (MPCB)"
        projectId={projectId}
        token={token}
        onConsentUpdated={() => void grantsQuery.refetch()}
      />
    </div>
  );
}



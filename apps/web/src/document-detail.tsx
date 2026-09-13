import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { intelligenceApi, documentsApi, type Document, type ExtractedField } from './api-client';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

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
export function DocumentDetailPage(props: { projectId: string; documentId: string }): JSX.Element {
  const { projectId, documentId } = props;
  const { accessToken } = useAuth();
  const token = accessToken ?? undefined;
  const qc = useQueryClient();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [evidenceInspected, setEvidenceInspected] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const docsQuery = useQuery({ queryKey: ['documents', projectId], queryFn: () => documentsApi.list(projectId, token) });
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
  if (docsQuery.isLoading) return <LoadingSpinner label="Loading document…" />;
  if (docsQuery.isError) return <ErrorBanner message="Could not load the document." onRetry={() => void docsQuery.refetch()} />;
  if (!doc || !version) return <EmptyState title="Document not found" />;
  const job = jobQuery.data;
  const extraction = extractionQuery.data;
  const correctionByField = new Map((extraction?.corrections ?? []).map((c) => [c.fieldName, c.correctedValue]));
  const canVerify = version.state === 'needs_verification' || version.state === 'extracted';
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Document detail</h1>
      <p className="text-sm text-gray-600">{version.originalFilename} · v{version.versionNumber} · state <span className="font-mono">{version.state}</span></p>
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
    </div>
  );
}


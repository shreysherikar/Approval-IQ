import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, documentsApi, type DedupPromptResponse, type Document, type DocumentVersionState } from './api-client';

export function GoogleSignInButton({
  label = 'Continue with Google',
  disabled = false,
}: {
  label?: string;
  disabled?: boolean;
}): JSX.Element | null {
  const isEmbedded =
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window ||
      'Capacitor' in window ||
      import.meta.env.VITE_DESKTOP === 'true' ||
      import.meta.env.VITE_MOBILE === 'true');

  if (isEmbedded) {
    return null;
  }

  const handleGoogleSignIn = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleGoogleSignIn}
      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50/80 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 active:scale-[0.99]"
    >
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </svg>
      <span className="text-slate-800 font-semibold">{label}</span>
    </button>
  );
}

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-gray-600">
      <span
        aria-hidden="true"
        className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
      />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: JSX.Element;
}): JSX.Element {
  return (
    <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
      <p className="text-lg font-medium text-gray-800">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * State badge for DocumentVersion — Phase 5+.
 * Uses the same visual language as roadmap status/outcome badges.
 */
export function DocumentStateBadge({ state }: { state: DocumentVersionState }): JSX.Element {
  const styleMap: Record<DocumentVersionState, { bg: string; text: string; border: string; label: string }> = {
    uploaded: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'Uploaded' },
    queued: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', label: 'Queued' },
    processing: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', label: 'Processing' },
    extracted: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'Extracted' },
    needs_verification: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', label: 'Needs verification' },
    verified: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'Verified' },
    rejected: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Rejected' },
    superseded: { bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-300', label: 'Superseded' },
    archived: { bg: 'bg-gray-200', text: 'text-gray-600', border: 'border-gray-400', label: 'Archived' },
  };
  const s = styleMap[state] ?? styleMap.uploaded;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

/**
 * Date formatter for upload timestamps.
 */
export function formatUploadDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * File upload control for a single required document.
 * Shows current version (if any), upload date, state badge.
 * Upload action → POST /projects/:projectId/documents (first version).
 * Replace action → POST /projects/:projectId/documents/:documentId/versions (versioning endpoint).
 */
interface DocumentUploadControlProps {
  projectId: string;
  /** The required document from the deduplicated list (roadmap requiredDocuments). */
  requiredDoc: { id: string; name: string };
  /** Optional: pre-fetched existing document (by documentDefinitionId match). */
  existingDoc?: Document | null;
  /** Auth token for API calls. */
  token: string;
  /** Called after successful upload/replace to refresh parent list. */
  onChange?: () => void;
}

export function DocumentUploadControl({
  projectId,
  requiredDoc,
  existingDoc,
  token,
  onChange,
}: DocumentUploadControlProps): JSX.Element {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Phase 7 dedup: the upload returned a duplicate prompt (Prompt 5.2) with the
  // four choices. We keep the pending file so the user's chosen `dedupChoice`
  // can be re-submitted to the same endpoint and recorded.
  const [dedupPrompt, setDedupPrompt] = useState<DedupPromptResponse | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  const onUploaded = () => {
    setError(null);
    setDedupPrompt(null);
    pendingFileRef.current = null;
    void queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
    onChange?.();
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(projectId, file, requiredDoc.id, undefined, token),
    onSuccess: (result) => {
      setError(null);
      if (result && typeof result === 'object' && 'duplicateDetected' in result && result.duplicateDetected) {
        // A byte-identical file already exists in this project. Surface the four
        // choices instead of treating this as a successful fresh upload.
        setDedupPrompt(result as DedupPromptResponse);
        return;
      }
      onUploaded();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Upload failed');
    },
  });

  const replaceMutation = useMutation({
    mutationFn: (file: File) => documentsApi.addVersion(projectId, existingDoc!.id, file, token),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      onChange?.();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Replace failed');
    },
  });

  // Re-submits the same (pending) file with the user's chosen dedupChoice, so the
  // pick is recorded by the existing backend behavior. reject_duplicate is a 409
  // → it surfaces as an error banner via onError.
  const dedupChoiceMutation = useMutation({
    mutationFn: (choice: string) => {
      const file = pendingFileRef.current;
      if (!file) return Promise.reject(new Error('No pending file to submit.'));
      return documentsApi.upload(projectId, file, requiredDoc.id, choice, token);
    },
    onSuccess: () => onUploaded(),
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Dedup choice failed');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pendingFileRef.current = file;
    if (existingDoc) {
      replaceMutation.mutate(file);
    } else {
      uploadMutation.mutate(file);
    }
    // Reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  const isUploading = uploadMutation.isPending || replaceMutation.isPending || dedupChoiceMutation.isPending;
  const currentVersion = existingDoc?.currentVersion;

  return (
    <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{requiredDoc.name}</p>
          <p className="mt-0.5 text-xs text-gray-500 font-mono">Def ID: {requiredDoc.id}</p>
        </div>
        {currentVersion && (
          <DocumentStateBadge state={currentVersion.state} />
        )}
      </div>

      {currentVersion && (
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-gray-500">Version</p>
            <p className="font-mono text-gray-900">{currentVersion.versionNumber}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">Uploaded</p>
            <p className="font-mono text-gray-900">{formatUploadDate(currentVersion.uploadedAt)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500">File</p>
            <p className="truncate font-mono text-gray-700">{currentVersion.originalFilename}</p>
          </div>
        </div>
      )}

      {existingDoc && (
        <Link
          to={`/projects/${projectId}/documents/${existingDoc.id}`}
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Open document detail (extraction &amp; verification) →
        </Link>
      )}

      {error && (
        <ErrorBanner message={error} onRetry={() => setError(null)} />
      )}

      {dedupPrompt ? (
        <DedupPromptPanel
          prompt={dedupPrompt}
          projectId={projectId}
          pending={dedupChoiceMutation.isPending}
          onChoose={(choice) => dedupChoiceMutation.mutate(choice)}
          onDismiss={() => {
            setDedupPrompt(null);
            pendingFileRef.current = null;
          }}
        />
      ) : (
        <div className="mt-3">
        <label className="block">
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            disabled={isUploading}
            onChange={handleFileSelect}
            className="sr-only"
            id={`doc-upload-${requiredDoc.id}`}
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => document.getElementById(`doc-upload-${requiredDoc.id}`)?.click()}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <LoadingSpinner label="" />
                {existingDoc ? 'Replacing…' : 'Uploading…'}
              </>
            ) : existingDoc ? (
              'Replace document'
            ) : (
              'Upload document'
            )}
          </button>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Allowed: PDF, DOC, DOCX, PNG, JPG (max 20 MB).{' '}
          {existingDoc ? 'Replaces current version (prior version kept).' : 'Creates first version.'}
        </p>
        </div>
      )}

      {!existingDoc && !isUploading && !dedupPrompt && (
        <EmptyState
          title="No document uploaded yet"
          description="Upload the first version of this required document."
        />
      )}
    </div>
  );
}
/**
 * The blueprint's four dedup choices (Prompt 5.2), surfaced when the upload is a
 * byte-identical duplicate of an existing project document. Choosing one
 * re-submits the pending file with the selected `dedupChoice` so the backend
 * records the decision (link / new version / keep separate / reject).
 */
function DedupPromptPanel({
  prompt,
  projectId,
  pending,
  onChoose,
  onDismiss,
}: {
  prompt: DedupPromptResponse;
  projectId: string;
  pending: boolean;
  onChoose: (choice: string) => void;
  onDismiss: () => void;
}): JSX.Element {
  const existing = prompt.existingDocument;
  const existingVersion = existing.currentVersion;
  const choices: Array<{ value: string; label: string; description: string }> = [
    {
      value: 'link_to_existing',
      label: 'Link to existing',
      description: 'Use the existing document for this requirement (no new document is created).',
    },
    {
      value: 'create_new_version',
      label: 'Create new version',
      description: 'Add this file as a new version of the existing document.',
    },
    {
      value: 'keep_separate',
      label: 'Keep as separate document',
      description: 'Store this file as its own separate document.',
    },
    {
      value: 'reject_duplicate',
      label: 'Reject as duplicate',
      description: 'Do not upload — discard this file (nothing is created).',
    },
  ];

  return (
    <div className="mt-3 space-y-3 rounded border border-amber-300 bg-amber-50 p-3" role="alert">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-amber-900">
            This file is a duplicate already in this project.
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            A byte-identical file was uploaded before — choose how to handle it (never silently duplicate).
          </p>
        </div>
        <Link
          to={`/projects/${projectId}/documents/${existing.id}`}
          className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-100"
        >
          Existing v{existingVersion ? existingVersion.versionNumber : '—'}{existingVersion ? ` · ${existingVersion.state}` : ''}
        </Link>
      </div>
      <div className="grid gap-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            disabled={pending}
            onClick={() => onChoose(c.value)}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <span className="font-medium text-gray-900">{c.label}</span>
            <span className="mt-0.5 block text-xs text-gray-600">{c.description}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onDismiss}
          className="rounded border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel upload
        </button>
        <span className="text-xs text-amber-800">
          {pending ? 'Submitting choice…' : 'Your choice is recorded in the document metadata.'}
        </span>
      </div>
    </div>
  );
}

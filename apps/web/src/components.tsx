import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, type Document, type DocumentVersionState } from './api-client';

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

  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(projectId, file, requiredDoc.id, token),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['documents', projectId] });
      onChange?.();
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (existingDoc) {
      replaceMutation.mutate(file);
    } else {
      uploadMutation.mutate(file);
    }
    // Reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  const isUploading = uploadMutation.isPending || replaceMutation.isPending;
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

      {error && (
        <ErrorBanner message={error} onRetry={() => setError(null)} />
      )}

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

      {!existingDoc && !isUploading && (
        <EmptyState
          title="No document uploaded yet"
          description="Upload the first version of this required document."
        />
      )}
    </div>
  );
}

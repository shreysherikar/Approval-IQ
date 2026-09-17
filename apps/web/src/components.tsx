import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, documentsApi, reuseApi, type DedupPromptResponse, type Document, type DocumentVersionState } from './api-client';

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
      className="tactile-btn tactile-btn-secondary w-full py-2.5 px-4 text-sm flex items-center justify-center gap-3 border border-ink-border hover:border-ocean-300 hover:shadow-tactile transition-all"
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
      <span className="text-ink font-semibold">{label}</span>
    </button>
  );
}

export function LoadingSpinner({ label = 'Loading…' }: { label?: string }): JSX.Element {
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2.5 text-xs font-mono font-medium text-slate-700">
      <span
        aria-hidden="true"
        className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500 shadow-sm"
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
    <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-50/80 p-4 text-rose-700 shadow-sm animate-fade-in-up">
      <div className="flex items-start gap-2.5">
        <span className="font-mono text-sm font-bold text-rose-500">⚠</span>
        <div className="flex-1">
          <p className="font-semibold text-xs tracking-wide uppercase font-mono text-rose-800">Statutory Validation Warning</p>
          <p className="mt-1 text-xs text-slate-700 leading-relaxed">{message}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="tactile-btn mustard-btn-secondary mt-3 text-xs py-1 px-3 text-rose-700 border-rose-300 hover:bg-rose-100"
            >
              Retry Action
            </button>
          )}
        </div>
      </div>
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
    <div className="rounded-xl border border-dashed border-amber-300/70 bg-amber-50/30 p-8 text-center space-y-2.5 animate-fade-in-up">
      <p className="font-editorial text-lg font-bold text-slate-900">{title}</p>
      {description && <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

/**
 * State badge for DocumentVersion — Phase 5+.
 * Uses tactile oceanic stamp seals.
 */
export function DocumentStateBadge({ state }: { state: DocumentVersionState }): JSX.Element {
  const styleMap: Record<DocumentVersionState, { cls: string; label: string }> = {
    uploaded: { cls: 'stamp-neutral', label: 'Uploaded' },
    queued: { cls: 'stamp-neutral', label: 'Queued' },
    processing: { cls: 'stamp-neutral', label: 'Processing' },
    extracted: { cls: 'stamp-pending', label: 'OCR Extracted' },
    needs_verification: { cls: 'stamp-pending', label: 'Needs Verification' },
    verified: { cls: 'stamp-approved', label: '✓ Verified' },
    rejected: { cls: 'stamp-action', label: '✕ Rejected' },
    superseded: { cls: 'stamp-neutral', label: 'Superseded' },
    archived: { cls: 'stamp-neutral', label: 'Archived' },
  };
  const s = styleMap[state] ?? styleMap.uploaded;
  return (
    <span className={`stamp-seal ${s.cls}`}>
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
 */
interface DocumentUploadControlProps {
  projectId: string;
  requiredDoc: { id: string; name: string };
  existingDoc?: Document | null;
  token: string;
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
    e.target.value = '';
  };

  const isUploading = uploadMutation.isPending || replaceMutation.isPending || dedupChoiceMutation.isPending;
  const currentVersion = existingDoc?.currentVersion;

  return (
    <div className="editorial-card p-4 space-y-3 transition-all duration-300 hover:shadow-tactile-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-ink truncate">{requiredDoc.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted font-mono">ID: {requiredDoc.id}</p>
        </div>
        {currentVersion && (
          <DocumentStateBadge state={currentVersion.state} />
        )}
      </div>

      {currentVersion && (
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3 bg-ocean-50/60 p-2.5 rounded-lg border border-ocean-200/80">
          <div>
            <p className="text-[10px] font-mono uppercase text-ink-muted">Version</p>
            <p className="font-mono font-bold text-ocean-700">v{currentVersion.versionNumber}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-ink-muted">Uploaded</p>
            <p className="font-mono text-ink-soft truncate">{formatUploadDate(currentVersion.uploadedAt)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase text-ink-muted">File Name</p>
            <p className="truncate font-mono text-ink-soft">{currentVersion.originalFilename}</p>
          </div>
        </div>
      )}

      {existingDoc && (
        <Link
          to={`/projects/${projectId}/documents/${existingDoc.id}`}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ocean-600 hover:text-ocean-800 transition-colors group"
        >
          <span>Open inspection dossier (OCR extraction &amp; cross-reuse)</span>
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
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
              className="tactile-btn tactile-btn-secondary w-full py-2.5 px-3 text-xs flex items-center justify-center gap-2 border-ocean-200 hover:border-ocean-400"
            >
              {isUploading ? (
                <>
                  <LoadingSpinner label="" />
                  <span>{existingDoc ? 'Replacing version…' : 'Uploading evidence…'}</span>
                </>
              ) : existingDoc ? (
                'Upload New Version'
              ) : (
                'Upload Document Evidence'
              )}
            </button>
          </label>
          <p className="mt-1.5 text-[11px] font-mono text-ink-muted">
            PDF, DOCX, PNG, JPG (max 20 MB).{' '}
            {existingDoc ? 'Supersedes current version while preserving audit history.' : 'Establishes primary verified document.'}
          </p>
        </div>
      )}

      {!existingDoc && !isUploading && !dedupPrompt && (
        <EmptyState
          title="Awaiting Evidence Upload"
          description="Upload the initial certified copy of this document to satisfy statutory prerequisites."
        />
      )}
    </div>
  );
}

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
      label: 'Cross-Link to Existing Document',
      description: 'Reuses the previously uploaded byte-verified document without consuming redundant storage.',
    },
    {
      value: 'create_new_version',
      label: 'Create New Tracked Version',
      description: 'Appends this file as an incremented version of the existing record.',
    },
    {
      value: 'keep_separate',
      label: 'Store as Independent Record',
      description: 'Maintains this file as a standalone entry with separate audit timeline.',
    },
    {
      value: 'reject_duplicate',
      label: 'Discard Duplicate Submission',
      description: 'Cancels this upload without altering existing records.',
    },
  ];

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-amber-500/30 bg-amber-50/90 p-4 text-ink shadow-tactile-sm animate-fade-in-up" role="alert">
      <div className="flex items-start justify-between gap-2 border-b border-amber-500/20 pb-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider font-mono text-amber-600">
            Byte-Identical Document Detected
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            This file matches an existing verified dossier in this project. Choose statutory linking behavior:
          </p>
        </div>
        <Link
          to={`/projects/${projectId}/documents/${existing.id}`}
          className="shrink-0 stamp-seal stamp-neutral text-[10px]"
        >
          Existing v{existingVersion ? existingVersion.versionNumber : '—'}
        </Link>
      </div>

      <div className="grid gap-2">
        {choices.map((c) => (
          <button
            key={c.value}
            type="button"
            disabled={pending}
            onClick={() => onChoose(c.value)}
            className="tactile-btn tactile-btn-secondary p-3 text-left w-full block border-amber-500/30 hover:border-amber-500 hover:bg-white transition-all"
          >
            <span className="font-semibold text-xs text-ink block">{c.label}</span>
            <span className="mt-0.5 block text-[11px] text-ink-soft leading-tight">{c.description}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={onDismiss}
          className="tactile-btn tactile-btn-secondary px-3 py-1 text-xs text-ink-muted hover:bg-white"
        >
          Cancel
        </button>
        <span className="text-[11px] font-mono text-ink-muted">
          {pending ? 'Recording consensus…' : 'Decision is cryptographically logged.'}
        </span>
      </div>
    </div>
  );
}

/**
 * DPDP Act 2023 Granular Data Reuse Consent Modal (Section 6(1) & 6(4))
 * Allows explicit, revocable per-purpose authorization before sharing documents across departments.
 */
export function ConsentGrantModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  targetAuthorityId,
  targetAuthorityName,
  projectId,
  token,
  onConsentUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  targetAuthorityId: string;
  targetAuthorityName: string;
  projectId: string;
  token?: string | undefined;
  onConsentUpdated?: (() => void) | undefined;
}): JSX.Element | null {
  const [purpose, setPurpose] = useState('Verification & cross-departmental clearance review for statutory industrial registration');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantMutation = useMutation({
    mutationFn: () =>
      reuseApi.grantConsent(
        projectId,
        { documentId, targetAuthorityId, purpose },
        token,
      ),
    onSuccess: () => {
      setError(null);
      onConsentUpdated?.();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to grant consent');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-mono font-semibold">
              <span>DPDP Act 2023</span>
              <span>•</span>
              <span>Statutory Data Fiduciary Notice</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900">Granular Data Reuse Authorization</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Notice Description */}
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            Under Section 6(1) of the Digital Personal Data Protection (DPDP) Act 2023, ApprovalIQ requires explicit consent before re-using or sharing your document with another government department or regulatory authority.
          </p>
          
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Document:</span>
              <span className="font-semibold text-slate-900 truncate max-w-[240px]">{documentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Target Authority:</span>
              <span className="font-semibold text-blue-700">{targetAuthorityName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Statutory SLA:</span>
              <span className="font-semibold text-slate-900">15 Days (Section 6(4) Revocable)</span>
            </div>
          </div>
        </div>

        {/* Purpose Input */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            Specified Purpose of Data Share
          </label>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="Specify purpose of consent..."
          />
        </div>

        {/* Explicit Checkbox Consent */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-slate-700 leading-relaxed">
              I explicitly authorize ApprovalIQ to securely transmit <strong>{documentName}</strong> to <strong>{targetAuthorityName}</strong> strictly for the stated purpose. I acknowledge that I hold the right to revoke this consent at any time via the Document Vault.
            </span>
          </label>
        </div>

        {error && <p className="text-xs text-red-600 font-semibold">{error}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!agree || !purpose.trim() || grantMutation.isPending}
            onClick={() => grantMutation.mutate()}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {grantMutation.isPending ? 'Granting Consent…' : 'Grant Explicit Consent'}
          </button>
        </div>

      </div>
    </div>
  );
}

export { QuickOverviewCard } from './components/QuickOverviewCard';


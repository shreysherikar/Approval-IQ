import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth';
import { evaluationsApi } from './api-client';
import type { ApprovalEvaluationInfo, EvaluationResponse, MissingFieldInfo } from './api-client';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';
import { PROFILE_FIELD_LABELS } from './profile-form';

/**
 * Applicant-facing evaluation results — a simple, readable list (the
 * interactive roadmap graph is Phase 4). Unknown states are NEVER silently
 * hidden: needs_information names the exact missing fields, and
 * not_evaluable gets a distinct "check manually" note.
 */

const OUTCOME_STYLES: Record<ApprovalEvaluationInfo['outcome'], { label: string; className: string }> = {
  applicable: {
    label: 'Applicable',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  not_applicable: {
    label: 'Not applicable',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  needs_information: {
    label: 'Needs information',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  not_evaluable: {
    label: 'Not evaluable',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
};

function OutcomeBadge({ outcome }: { outcome: ApprovalEvaluationInfo['outcome'] }): JSX.Element {
  const style = OUTCOME_STYLES[outcome] ?? OUTCOME_STYLES.not_evaluable;
  return (
    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${style.className}`}>
      {style.label}
    </span>
  );
}

function formatDateTime(iso: string | undefined): string | null {
  if (iso === undefined) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

/** One missing field, explained in applicant language (never hidden). */
function MissingFieldItem({ missing }: { missing: MissingFieldInfo }): JSX.Element {
  const label = PROFILE_FIELD_LABELS[missing.field] ?? missing.field;
  const reason =
    missing.reason === 'type_mismatch'
      ? 'provided with a different definition than the rule uses'
      : 'not provided yet';
  return (
    <li className="text-sm text-amber-900">
      <span className="font-medium">{label}</span> — {reason}
      {missing.detail && <span className="text-amber-700"> ({missing.detail})</span>}
    </li>
  );
}

function ApprovalCard({ item }: { item: ApprovalEvaluationInfo }): JSX.Element {
  const { approval, outcome } = item;
  const verified = formatDateTime(approval.lastVerifiedDate);
  return (
    <li className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-gray-900">{approval.name}</p>
          <p className="text-xs text-gray-500">{approval.id}</p>
        </div>
        <OutcomeBadge outcome={outcome} />
      </div>

      {approval.description && (
        <p className="mt-2 text-sm text-gray-600">{approval.description}</p>
      )}

      {outcome === 'needs_information' && item.neededInformation.length > 0 && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Still needed before this can be decided:</p>
          <ul className="mt-1 list-disc pl-5">
            {item.neededInformation.map((m) => (
              <MissingFieldItem key={`${m.field}:${m.reason}`} missing={m} />
            ))}
          </ul>
        </div>
      )}

      {outcome === 'not_evaluable' && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          This approval couldn&rsquo;t be automatically evaluated — check manually with the
          authority. It is listed here so it is never silently skipped.
        </p>
      )}

      {(approval.sourceUrl !== undefined || verified !== null) && (
        <p className="mt-3 text-xs text-gray-500">
          {approval.sourceUrl !== undefined && (
            <>
              Source:{' '}
              <a
                href={approval.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {approval.sourceUrl}
              </a>
            </>
          )}
          {approval.sourceUrl !== undefined && verified !== null && ' · '}
          {verified !== null && <>Last verified: {verified}</>}
        </p>
      )}
    </li>
  );
}

export function EvaluationResultsView({
  evaluation,
}: {
  evaluation: EvaluationResponse;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Ruleset engine v{evaluation.engineVersion}
        {evaluation.releaseId ? ` · release ${evaluation.releaseId}` : ''}
      </p>

      {evaluation.warnings.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Evaluation warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {evaluation.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {evaluation.requiredDocuments.length > 0 && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm font-semibold text-gray-800">
            Documents required by your applicable approvals
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-gray-700">
            {evaluation.requiredDocuments.map((doc) => (
              <li key={doc.id}>{doc.name}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-3">
        {evaluation.approvals.map((item) => (
          <ApprovalCard key={item.approval.id} item={item} />
        ))}
      </ul>
    </div>
  );
}

export function EvaluationResultsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const evaluationId = searchParams.get('evaluation');
  // GET /evaluations/:id is authenticated (JwtAuthGuard) — the run contains the
  // applicant's business data. The token lives in memory only, so we must wait
  // for AuthProvider's silent refresh (httpOnly cookie) before fetching rather
  // than sending an unauthenticated request that can only ever be a 401.
  const { accessToken, isRestoring } = useAuth();

  const query = useQuery({
    queryKey: ['evaluation', evaluationId],
    queryFn: () => evaluationsApi.get(evaluationId as string, accessToken ?? undefined),
    enabled: evaluationId !== null && accessToken !== null,
    staleTime: Number.POSITIVE_INFINITY, // runs are persisted snapshots — replayable reads
    retry: 1,
  });

  if (evaluationId === null) {
    return (
      <EmptyState
        title="No evaluation yet"
        description="Confirm your business profile to generate your approvals list."
        action={
          <Link
            to={`/projects/${projectId ?? ''}/profile`}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go to profile
          </Link>
        }
      />
    );
  }

  if (query.isLoading || isRestoring) {
    return <LoadingSpinner label="Loading your approvals…" />;
  }

  if (accessToken === null) {
    return (
      <ErrorBanner message="Your session has ended — please log in again to view these results." />
    );
  }

  if (query.isError) {
    return (
      <ErrorBanner
        message={query.error instanceof Error ? query.error.message : 'Could not load the evaluation.'}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (query.data === undefined) {
    return <EmptyState title="Evaluation not found" description="This evaluation may have been removed." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Your approvals</h1>
        <Link
          to={`/projects/${projectId ?? ''}/roadmap`}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          View approval roadmap
        </Link>
      </div>
      <p className="text-sm text-gray-600">
        Based on your confirmed business profile.{' '}
        <Link to={`/projects/${projectId ?? ''}/profile`} className="text-blue-600 hover:underline">
          Update profile (creates a new version)
        </Link>
      </p>
      <EvaluationResultsView evaluation={query.data} />
    </div>
  );
}


import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { recoveryApi, type RecoveryActionView, ApiError } from './api-client';
import { useAuth } from './auth';
import { useLanguage } from './i18n/LanguageContext';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

// ---------------------------------------------------------------------------
// Compliance Recovery Plan — shown on the project/roadmap page
// ---------------------------------------------------------------------------

function ReadinessBadge({ level }: { level: string }): JSX.Element {
  const defaultStyle = { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', label: 'Unknown' };
  const styles: Record<string, { bg: string; text: string; border: string; label: string }> = {
    ready: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', label: 'Ready' },
    almost_ready: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', label: 'Almost Ready' },
    needs_attention: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', label: 'Needs Attention' },
    not_ready: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', label: 'Not Ready' },
    unknown: defaultStyle,
  };
  const s = styles[level] ?? defaultStyle;
  return (
    <span className={`inline-flex items-center rounded border px-3 py-1 text-sm font-bold ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }): JSX.Element {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    blocking: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
    high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
    low: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  };
  const defaultStyle = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  const s = styles[severity] ?? defaultStyle;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}>
      {severity}
    </span>
  );
}

function ActionStatusBadge({ status }: { status: string }): JSX.Element {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    open: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    resolved: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
    needs_review: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  };
  const defaultStyle = { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  const s = styles[status] ?? defaultStyle;
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${s.bg} ${s.text} ${s.border}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function RecoveryActionCard({
  action,
  projectId,
  token,
  onResolved,
}: {
  action: RecoveryActionView;
  projectId: string;
  token: string;
  onResolved: () => void;
}): JSX.Element {
  const [error, setError] = useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: () => recoveryApi.resolveAction(projectId, action.id, token),
    onSuccess: () => {
      setError(null);
      onResolved();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to mark as resolved'),
  });

  return (
    <article className="rounded border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">
            {action.title}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">#{action.sequenceOrder}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <SeverityBadge severity={action.severity} />
          <ActionStatusBadge status={action.status} />
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-800">{action.description}</p>
      <p className="mt-1 text-xs text-gray-500">Reason: {action.reason}</p>

      {(action.affectedApproval || action.affectedDocument) && (
        <p className="mt-1 text-xs text-gray-600">
          Affects: {action.affectedApproval ?? ''} {action.affectedDocument ?? ''}
        </p>
      )}

      {error && <div className="mt-2"><ErrorBanner message={error} /></div>}

      {action.status !== 'resolved' && (
        <button
          type="button"
          disabled={resolveMutation.isPending}
          onClick={() => resolveMutation.mutate()}
          className="mt-3 rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          {resolveMutation.isPending ? 'Marking…' : 'Mark Resolved'}
        </button>
      )}
    </article>
  );
}

export function RecoveryPlanPanel({ projectId }: { projectId: string }): JSX.Element {
  const { accessToken, isRestoring } = useAuth();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const planQuery = useQuery({
    queryKey: ['recovery-plan', projectId, accessToken],
    queryFn: () => recoveryApi.getPlan(projectId, accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  const generateMutation = useMutation({
    mutationFn: () => recoveryApi.generate(projectId, accessToken ?? undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['recovery-plan', projectId] }),
  });

  const rerunValidation = useMutation({
    mutationFn: async () => {
      // First generate the plan (which re-runs validation internally)
      return recoveryApi.generate(projectId, accessToken ?? undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recovery-plan', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['roadmap', projectId] });
    },
  });

  if (planQuery.isLoading || isRestoring) {
    return <LoadingSpinner label={language === 'mr' ? 'सुधारणा आराखडा लोड होत आहे…' : 'Loading recovery plan…'} />;
  }

  const plan = planQuery.data;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">{t('recovery.title')}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {plan?.planId
              ? `${plan.totalActions} ${language === 'mr' ? 'कृती' : 'actions'} · ${plan.resolvedActions} ${language === 'mr' ? 'निराकरण झाले' : 'resolved'}`
              : t('recovery.no_plan')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan?.planId && <ReadinessBadge level={plan.readinessLevel} />}
          <button
            type="button"
            disabled={generateMutation.isPending || rerunValidation.isPending}
            onClick={() => generateMutation.mutate()}
            className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {generateMutation.isPending ? t('recovery.generating') : plan?.planId ? t('recovery.regenerate_btn') : t('recovery.generate_btn')}
          </button>
          {plan?.planId && plan.totalActions > 0 && (
            <button
              type="button"
              disabled={rerunValidation.isPending}
              onClick={() => rerunValidation.mutate()}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {rerunValidation.isPending ? t('recovery.revalidating') : t('recovery.revalidate_btn')}
            </button>
          )}
        </div>
      </div>

      {generateMutation.isError && (
        <div className="mt-3">
          <ErrorBanner message={generateMutation.error instanceof Error ? generateMutation.error.message : (language === 'mr' ? 'आराखडा तयार करण्यात त्रुटी' : 'Generation failed')} />
        </div>
      )}

      {plan?.planId && plan.totalBlocking > 0 && (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50/80 p-3.5">
          <p className="text-xs font-semibold text-red-800">
            {plan.totalBlocking} {t('recovery.blocking_issues')}
          </p>
        </div>
      )}

      {plan?.planId && plan.totalWarnings > 0 && (
        <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5">
          <p className="text-xs text-amber-800">
            {plan.totalWarnings} {language === 'mr' ? 'सूचनांचे पुनरावलोकन करणे आवश्यक आहे.' : 'warning(s) should be reviewed.'}
          </p>
        </div>
      )}

      {!plan?.planId && (
        <div className="mt-4">
          <EmptyState
            title={language === 'mr' ? 'सुधारणा आराखडा उपलब्ध नाही' : 'No recovery plan'}
            description={language === 'mr' ? 'अर्ज सादर करण्यापूर्वी पूर्तता त्रुटी तपासण्यासाठी सुधारणा आराखडा तयार करा.' : 'Generate a recovery plan to identify and fix compliance issues before submission.'}
          />
        </div>
      )}

      {plan?.planId && plan.actions.length > 0 && (
        <div className="mt-4 space-y-3">
          {plan.actions.map((action) => (
            <RecoveryActionCard
              key={action.id}
              action={action}
              projectId={projectId}
              token={accessToken ?? ''}
              onResolved={() => void queryClient.invalidateQueries({ queryKey: ['recovery-plan', projectId] })}
            />
          ))}
        </div>
      )}

      {plan?.planId && plan.totalActions > 0 && plan.resolvedActions === plan.totalActions && (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-xs sm:text-sm font-bold text-green-800">
            {language === 'mr' ? 'सर्व त्रुटींचे यशस्वीरीत्या निराकरण झाले! अर्ज मंजुरीसाठी सादर करण्यास सज्ज आहे.' : 'All issues resolved! The application is ready for submission.'}
          </p>
        </div>
      )}
    </section>
  );
}

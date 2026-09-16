import { useState } from 'react';
import type { FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  regulatoryChangesApi,
  type RegulatoryChangeView,
  type RegulatoryImpactView,
} from './api-client';
import { useAuth } from './auth';
import { useLanguage } from './i18n';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

// ---------------------------------------------------------------------------
// Regulatory Changes List Page
// ---------------------------------------------------------------------------

function ChangeCard({ change }: { change: RegulatoryChangeView }): JSX.Element {
  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 border-gray-300',
    analyzing: 'bg-blue-100 text-blue-700 border-blue-300',
    analyzed: 'bg-green-100 text-green-700 border-green-300',
    published: 'bg-purple-100 text-purple-700 border-purple-300',
  };
  return (
    <article className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{change.title}</p>
          <p className="mt-0.5 text-sm text-gray-600">{change.description.slice(0, 120)}{change.description.length > 120 ? '…' : ''}</p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${statusColor[change.status] ?? 'bg-gray-100 text-gray-700'}`}>
          {change.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5">{change.approval.name}</span>
        {change.authority && <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5">{change.authority}</span>}
        <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5">
          Effective: {new Date(change.effectiveDate).toLocaleDateString()}
        </span>
        {change.totalImpacts > 0 && (
          <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">
            {change.totalImpacts} business{change.totalImpacts === 1 ? '' : 'es'} analyzed
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          to={`/regulatory-changes/${change.id}`}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          View Details
        </Link>
        {change.status === 'analyzed' && (
          <Link
            to={`/regulatory-changes/${change.id}/impacts`}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Impact Dashboard
          </Link>
        )}
      </div>
    </article>
  );
}

export function RegulatoryChangesListPage(): JSX.Element {
  const { accessToken, isRestoring, user } = useAuth();
  const { t } = useLanguage();
  const [showCreate, setShowCreate] = useState(false);

  const changesQuery = useQuery({
    queryKey: ['regulatory-changes', accessToken],
    queryFn: () => regulatoryChangesApi.list(accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  if (changesQuery.isLoading || isRestoring) {
    return (
      <LoadingSpinner
        label={t('regulatory.loading', 'Loading regulatory changes…')}
      />
    );
  }
  if (accessToken === null) {
    return (
      <ErrorBanner
        message={t('regulatory.login_required', 'Please log in to view regulatory changes.')}
      />
    );
  }

  const changes = changesQuery.data ?? [];
  const isAdmin = user?.role === 'admin' || user?.role === 'officer';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('regulatory.title', 'Regulatory Change Impact Engine')}
          </h1>
          <p className="text-sm text-gray-600">
            {t('regulatory.subtitle', 'Simulate regulatory rule changes and analyze their impact on existing businesses.')}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 font-medium cursor-pointer"
          >
            {showCreate
              ? t('regulatory.cancel', 'Cancel')
              : t('regulatory.new_change', '+ New Regulatory Change')}
          </button>
        )}
      </div>

      {showCreate && <CreateChangeForm onCreated={() => { setShowCreate(false); void changesQuery.refetch(); }} />}

      {changes.length === 0 ? (
        <EmptyState
          title={t('regulatory.empty_title', 'No regulatory changes yet')}
          description={t('regulatory.empty_desc', 'Create a regulatory change to analyze its impact on existing businesses.')}
        />
      ) : (
        <div className="space-y-3">
          {changes.map((change) => (
            <ChangeCard key={change.id} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Regulatory Change Form
// ---------------------------------------------------------------------------

function CreateChangeForm({ onCreated }: { onCreated: () => void }): JSX.Element {
  const { accessToken } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [approvalDefinitionId, setApprovalDefinitionId] = useState('');
  const [oldConditions, setOldConditions] = useState('');
  const [newConditions, setNewConditions] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      let oldCond: unknown;
      let newCond: unknown;
      try { oldCond = JSON.parse(oldConditions); } catch { oldCond = oldConditions; }
      try { newCond = JSON.parse(newConditions); } catch { newCond = newConditions; }

      return regulatoryChangesApi.create({
        title,
        description,
        approvalDefinitionId,
        oldConditions: oldCond,
        newConditions: newCond,
        effectiveDate,
        sourceUrl: sourceUrl || '',
      }, accessToken ?? undefined);
    },
    onSuccess: () => {
      setError(null);
      onCreated();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create'),
  });

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Create Regulatory Change</h2>
      {error && <div className="mt-2"><ErrorBanner message={error} /></div>}
      <form
        className="mt-3 space-y-3"
        onSubmit={(e: FormEvent) => { e.preventDefault(); if (!createMutation.isPending) createMutation.mutate(); }}
      >
        <label className="block text-sm">
          <span className="text-gray-700 font-medium">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. MPCB threshold increase for solar manufacturing"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700 font-medium">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Describe the regulatory change"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700 font-medium">Approval Definition ID</span>
          <input
            value={approvalDefinitionId}
            onChange={(e) => setApprovalDefinitionId(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder="e.g. MPCB-CTE-001"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Old Conditions (JSON)</span>
            <textarea
              value={oldConditions}
              onChange={(e) => setOldConditions(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder='{"all":[{"field":"industry","op":"equals","value":"solar_manufacturing"},{"kind":"range","field":"investmentAmountInr","min":5000000,"expectedInvestmentDefinition":"total_project_cost"}]}'
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">New Conditions (JSON)</span>
            <textarea
              value={newConditions}
              onChange={(e) => setNewConditions(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              placeholder='{"all":[{"field":"industry","op":"equals","value":"solar_manufacturing"},{"kind":"range","field":"investmentAmountInr","min":2000000,"expectedInvestmentDefinition":"total_project_cost"}]}'
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-gray-700 font-medium">Effective Date</span>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700 font-medium">Source URL (optional)</span>
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="https://..."
          />
        </label>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Creating…' : 'Create Regulatory Change'}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Regulatory Change Detail Page
// ---------------------------------------------------------------------------

export function RegulatoryChangeDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { accessToken, isRestoring, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'admin' || user?.role === 'officer';

  const changeQuery = useQuery({
    queryKey: ['regulatory-change', id, accessToken],
    queryFn: () => regulatoryChangesApi.get(id ?? '', accessToken ?? undefined),
    enabled: accessToken !== null && id !== undefined,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => regulatoryChangesApi.analyze(id ?? '', accessToken ?? undefined),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['regulatory-change', id] }),
  });

  if (changeQuery.isLoading || isRestoring || id === undefined) {
    return <LoadingSpinner label="Loading regulatory change…" />;
  }
  if (changeQuery.isError) {
    return <ErrorBanner message={changeQuery.error instanceof Error ? changeQuery.error.message : 'Failed to load'} />;
  }

  const change = changeQuery.data;
  if (!change) return <EmptyState title="Not found" />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600">
          <Link to="/regulatory-changes" className="text-blue-600 hover:underline">← All Changes</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{change.title}</h1>
        <p className="text-sm text-gray-600">{change.description}</p>
      </div>

      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Change Details</h2>
        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="font-medium text-gray-700">Approval:</span> {change.approval.name}</div>
          <div><span className="font-medium text-gray-700">Effective Date:</span> {new Date(change.effectiveDate).toLocaleDateString()}</div>
          <div><span className="font-medium text-gray-700">Status:</span> {change.status}</div>
          {change.sourceUrl && (
            <div>
              <span className="font-medium text-gray-700">Source: </span>
              <a href={change.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{change.sourceUrl}</a>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Statutory Applicability Rule Comparison</h2>
            <p className="text-xs text-gray-500">
              Deterministic evaluation logic compared by the Cascade Impact Engine.
            </p>
          </div>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">
            Rule Diff Logic
          </span>
        </div>

        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {/* Old Rule Card */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gray-400" />
                Previous Rule (Pre-Notification)
              </span>
              <span className="text-[11px] font-mono text-gray-500">Version 1.0</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded border border-gray-200 bg-white p-2.5 shadow-xs">
                <span className="text-gray-500 font-medium">Target Industry: </span>
                <span className="font-semibold text-gray-900 capitalize">
                  {typeof change.oldConditions === 'object' && change.oldConditions && 'all' in change.oldConditions
                    ? String(((change.oldConditions as any).all?.find((c: any) => c.field === 'industry')?.value) ?? 'Commercial Manufacturing')
                    : 'All Industries'}
                </span>
              </div>

              <div className="rounded border border-gray-200 bg-white p-2.5 shadow-xs">
                <span className="text-gray-500 font-medium">Investment / Scale Criteria: </span>
                <span className="font-semibold text-gray-900">
                  {typeof change.oldConditions === 'object' && change.oldConditions && 'all' in change.oldConditions
                    ? (() => {
                        const rangeCond = (change.oldConditions as any).all?.find((c: any) => c.field === 'investmentAmountInr' || c.field === 'areaSqft');
                        if (rangeCond?.field === 'investmentAmountInr' && rangeCond?.min) {
                          return `Capital Investment ≥ ₹${(rangeCond.min / 10000000).toLocaleString('en-IN')} Crore (Total Project Cost)`;
                        }
                        if (rangeCond?.field === 'areaSqft') {
                          return `Facility Footprint ≥ ${(rangeCond.min ?? rangeCond.value ?? 0).toLocaleString()} sq ft`;
                        }
                        return 'Standard baseline statutory conditions';
                      })()
                    : 'Standard baseline conditions'}
                </span>
              </div>
            </div>

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium hover:text-gray-700">
                🔍 View Raw Rule AST (JSON)
              </summary>
              <pre className="mt-2 rounded border bg-slate-900 text-emerald-400 p-2.5 text-[11px] overflow-x-auto font-mono">
                {JSON.stringify(change.oldConditions, null, 2)}
              </pre>
            </details>
          </div>

          {/* New Rule Card */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                Amended Rule (Gazette Effective)
              </span>
              <span className="text-[11px] font-mono text-indigo-700 font-semibold">Amended Criteria</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="rounded border border-indigo-100 bg-white p-2.5 shadow-xs">
                <span className="text-gray-500 font-medium">Target Industry: </span>
                <span className="font-semibold text-gray-900 capitalize">
                  {typeof change.newConditions === 'object' && change.newConditions && 'all' in change.newConditions
                    ? String(((change.newConditions as any).all?.find((c: any) => c.field === 'industry')?.value) ?? 'Commercial Manufacturing')
                    : 'All Industries'}
                </span>
              </div>

              <div className="rounded border border-indigo-100 bg-white p-2.5 shadow-xs">
                <span className="text-gray-500 font-medium">Amended Scale Threshold: </span>
                <span className="font-bold text-indigo-900">
                  {typeof change.newConditions === 'object' && change.newConditions && 'all' in change.newConditions
                    ? (() => {
                        const rangeCond = (change.newConditions as any).all?.find((c: any) => c.field === 'investmentAmountInr' || c.field === 'areaSqft');
                        if (rangeCond?.field === 'investmentAmountInr' && rangeCond?.min) {
                          return `Capital Investment ≥ ₹${(rangeCond.min / 10000000).toLocaleString('en-IN')} Crore (Expanded Scope)`;
                        }
                        if (rangeCond?.field === 'areaSqft') {
                          return `Facility Footprint ≥ ${(rangeCond.min ?? rangeCond.value ?? 0).toLocaleString()} sq ft (Lowered Threshold)`;
                        }
                        return 'Updated statutory criteria';
                      })()
                    : 'Updated statutory criteria'}
                </span>
              </div>
            </div>

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800">
                🔍 View Raw Rule AST (JSON)
              </summary>
              <pre className="mt-2 rounded border bg-slate-900 text-emerald-400 p-2.5 text-[11px] overflow-x-auto font-mono">
                {JSON.stringify(change.newConditions, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        {isAdmin && (
          <button
            type="button"
            disabled={analyzeMutation.isPending}
            onClick={() => analyzeMutation.mutate()}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs"
          >
            {analyzeMutation.isPending ? 'Simulating Cascade Impact…' : '⚡ Re-run Cascade Impact Simulation'}
          </button>
        )}
        {change.status === 'analyzed' && (
          <Link
            to={`/regulatory-changes/${id}/impacts`}
            className="rounded border border-indigo-600 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 shadow-xs"
          >
            View Live Impact Dashboard →
          </Link>
        )}
      </div>

      {!isAdmin && (
        <p className="text-xs text-gray-500 italic">
          ℹ️ Impact simulation triggers are managed by Regulatory Officers and Administrators. As an applicant, you can view the live cascade impact results on your business via the Impact Dashboard above.
        </p>
      )}

      {analyzeMutation.isError && (
        <ErrorBanner message={analyzeMutation.error instanceof Error ? analyzeMutation.error.message : 'Analysis failed'} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impact Dashboard Page
// ---------------------------------------------------------------------------

export function ImpactDashboardPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const { accessToken, isRestoring } = useAuth();
  const [filterType, setFilterType] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const impactsQuery = useQuery({
    queryKey: ['regulatory-impacts', id, filterType, filterPriority, accessToken],
    queryFn: () => {
      const filters: { impactType?: string; priority?: string; industry?: string } = {};
      if (filterType) filters.impactType = filterType;
      if (filterPriority) filters.priority = filterPriority;
      return regulatoryChangesApi.getImpacts(
        id ?? '',
        filters,
        accessToken ?? undefined,
      );
    },
    enabled: accessToken !== null && id !== undefined,
  });

  if (impactsQuery.isLoading || isRestoring || id === undefined) {
    return <LoadingSpinner label="Loading impact analysis…" />;
  }
  if (impactsQuery.isError) {
    return <ErrorBanner message={impactsQuery.error instanceof Error ? impactsQuery.error.message : 'Failed to load'} />;
  }

  const data = impactsQuery.data;
  const impacts = data?.impacts ?? [];

  const impactTypeColors: Record<string, string> = {
    newly_affected: 'bg-red-100 text-red-800 border-red-300',
    no_longer_affected: 'bg-green-100 text-green-800 border-green-300',
    requirement_changed: 'bg-amber-100 text-amber-800 border-amber-300',
    no_material_impact: 'bg-gray-100 text-gray-700 border-gray-300',
    needs_review: 'bg-blue-100 text-blue-800 border-blue-300',
  };

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-gray-100 text-gray-700 border-gray-300',
    no_impact: 'bg-gray-50 text-gray-500 border-gray-200',
  };

  // Summary counts
  const summary = {
    newlyAffected: impacts.filter(i => i.impactType === 'newly_affected').length,
    noLongerAffected: impacts.filter(i => i.impactType === 'no_longer_affected').length,
    requirementChanged: impacts.filter(i => i.impactType === 'requirement_changed').length,
    noMaterialImpact: impacts.filter(i => i.impactType === 'no_material_impact').length,
    needsReview: impacts.filter(i => i.impactType === 'needs_review').length,
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600">
          <Link to="/regulatory-changes" className="text-blue-600 hover:underline">← Regulatory Changes</Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Impact Dashboard</h1>
        <p className="text-sm text-gray-600">
          {impacts.length} businesses analyzed
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{summary.newlyAffected}</p>
          <p className="text-xs text-red-600">Newly Affected</p>
        </div>
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{summary.noLongerAffected}</p>
          <p className="text-xs text-green-600">No Longer Affected</p>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center">
          <p className="text-2xl font-bold text-amber-700">{summary.requirementChanged}</p>
          <p className="text-xs text-amber-600">Requirement Changed</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-center">
          <p className="text-2xl font-bold text-gray-700">{summary.noMaterialImpact}</p>
          <p className="text-xs text-gray-600">No Material Impact</p>
        </div>
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{summary.needsReview}</p>
          <p className="text-xs text-blue-600">Needs Review</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-md border border-gray-200 bg-white p-3">
        <label className="text-sm">
          <span className="mr-2 text-gray-700">Impact Type</span>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded border px-2 py-1">
            <option value="">All</option>
            <option value="newly_affected">Newly Affected</option>
            <option value="no_longer_affected">No Longer Affected</option>
            <option value="requirement_changed">Requirement Changed</option>
            <option value="no_material_impact">No Material Impact</option>
            <option value="needs_review">Needs Review</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mr-2 text-gray-700">Priority</span>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="rounded border px-2 py-1">
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      {/* Impact Cards */}
      {impacts.length === 0 ? (
        <EmptyState title="No impacts found" description="No businesses match the current filters." />
      ) : (
        <div className="space-y-3">
          {impacts.map((impact) => (
            <ImpactCard key={impact.id} impact={impact} impactTypeColors={impactTypeColors} priorityColors={priorityColors} />
          ))}
        </div>
      )}
    </div>
  );
}

function ImpactCard({
  impact,
  impactTypeColors,
  priorityColors,
}: {
  impact: RegulatoryImpactView;
  impactTypeColors: Record<string, string>;
  priorityColors: Record<string, string>;
}): JSX.Element {
  const [expanded, setExpanded] = useState(true);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs transition hover:shadow-md">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900">{impact.project.name}</h3>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-mono text-gray-600 border border-gray-200">
              {impact.project.businessId}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 capitalize">
            Industry Classification: <span className="font-semibold text-gray-700">{impact.project.industry}</span>
          </p>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${impactTypeColors[impact.impactType] ?? ''}`}>
            {impact.impactType.replace(/_/g, ' ')}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${priorityColors[impact.priority] ?? ''}`}>
            Priority: {impact.priority}
          </span>
        </div>
      </div>

      {/* Main Impact Narrative */}
      <div className="mt-3.5 space-y-3">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-800 leading-relaxed">
          <span className="font-bold text-slate-900 block mb-1">⚖️ Statutory Cascade Finding:</span>
          {impact.explanation}
        </div>

        {/* Action Required Callout */}
        {impact.requiredAction && (
          <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs">
            <span className="text-base leading-none">⚡</span>
            <div>
              <span className="font-bold text-amber-900 block mb-0.5">Mandatory Compliance Action Required:</span>
              <p className="text-amber-800 leading-relaxed">{impact.requiredAction}</p>
            </div>
          </div>
        )}
      </div>

      {/* Accordion / Details Toggle */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-xs font-bold text-gray-700 hover:text-indigo-600 transition"
        >
          <span className="flex items-center gap-1.5">
            <span>{expanded ? '▼' : '►'}</span>
            <span>Comparative Applicability & Rule Evaluation Details</span>
          </span>
          <span className="text-[11px] text-gray-400 font-normal">
            {expanded ? 'Click to collapse' : 'Click to expand'}
          </span>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {/* Side by side comparison cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Previous Status */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                  Previous Statutory Status (Old Rule)
                </span>
                <p className="font-semibold text-gray-900">{impact.oldApplicability}</p>
              </div>

              {/* New Status */}
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                  New Statutory Status (Amended Rule)
                </span>
                <p className="font-bold text-indigo-950">{impact.newApplicability}</p>
              </div>
            </div>

            {/* Changed Condition Diff & Confidence */}
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs space-y-2">
              {impact.changedCondition && (
                <div>
                  <span className="text-[11px] font-bold text-gray-600 block">Evaluated Condition Criteria:</span>
                  <p className="font-mono text-[11px] text-slate-700 bg-gray-50 p-2 rounded border border-gray-200 mt-1">
                    {impact.changedCondition}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between pt-1 text-[11px] text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span>Engine Confidence Score:</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 uppercase tracking-wider">
                    ✓ {impact.confidence} Confidence (Deterministic Match)
                  </span>
                </div>
                <Link
                  to={`/projects/${impact.projectId}/profile`}
                  className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                >
                  <span>Open Business Dossier</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

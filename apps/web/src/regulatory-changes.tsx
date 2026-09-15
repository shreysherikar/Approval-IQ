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
  const [showCreate, setShowCreate] = useState(false);

  const changesQuery = useQuery({
    queryKey: ['regulatory-changes', accessToken],
    queryFn: () => regulatoryChangesApi.list(accessToken ?? undefined),
    enabled: accessToken !== null,
  });

  if (changesQuery.isLoading || isRestoring) {
    return <LoadingSpinner label="Loading regulatory changes…" />;
  }
  if (accessToken === null) {
    return <ErrorBanner message="Please log in to view regulatory changes." />;
  }

  const changes = changesQuery.data ?? [];
  const isAdmin = user?.role === 'admin' || user?.role === 'officer';

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Regulatory Change Impact Engine</h1>
          <p className="text-sm text-gray-600">
            Simulate regulatory rule changes and analyze their impact on existing businesses.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreate(!showCreate)}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {showCreate ? 'Cancel' : '+ New Regulatory Change'}
          </button>
        )}
      </div>

      {showCreate && <CreateChangeForm onCreated={() => { setShowCreate(false); void changesQuery.refetch(); }} />}

      {changes.length === 0 ? (
        <EmptyState
          title="No regulatory changes yet"
          description="Create a regulatory change to analyze its impact on existing businesses."
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
  const { accessToken, isRestoring } = useAuth();
  const queryClient = useQueryClient();

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

      <section className="rounded-md border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Old vs New Conditions</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Old Rule</p>
            <pre className="mt-1 rounded bg-gray-50 p-3 text-xs overflow-x-auto">{JSON.stringify(change.oldConditions, null, 2)}</pre>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">New Rule</p>
            <pre className="mt-1 rounded bg-gray-50 p-3 text-xs overflow-x-auto">{JSON.stringify(change.newConditions, null, 2)}</pre>
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={analyzeMutation.isPending}
          onClick={() => analyzeMutation.mutate()}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze Impact'}
        </button>
        {change.status === 'analyzed' && (
          <Link
            to={`/regulatory-changes/${id}/impacts`}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            View Impact Dashboard →
          </Link>
        )}
      </div>

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
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{impact.project.name}</p>
          <p className="text-sm text-gray-600">
            {impact.project.industry} · {impact.project.businessId}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${impactTypeColors[impact.impactType] ?? ''}`}>
            {impact.impactType.replace(/_/g, ' ')}
          </span>
          <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${priorityColors[impact.priority] ?? ''}`}>
            {impact.priority}
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-800">{impact.explanation}</p>

      {impact.requiredAction && (
        <p className="mt-1 text-sm font-medium text-blue-800">
          Action required: {impact.requiredAction}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-blue-600 hover:underline"
      >
        {expanded ? 'Hide details' : 'Show details'}
      </button>

      {expanded && (
        <div className="mt-2 rounded border border-gray-100 bg-gray-50 p-3 text-xs space-y-1">
          <p><span className="font-medium">Old Applicability:</span> {impact.oldApplicability}</p>
          <p><span className="font-medium">New Applicability:</span> {impact.newApplicability}</p>
          {impact.changedCondition && <p><span className="font-medium">Changed Condition:</span> {impact.changedCondition}</p>}
          <p><span className="font-medium">Confidence:</span> {impact.confidence}</p>
        </div>
      )}

      <div className="mt-2">
        <Link
          to={`/projects/${impact.projectId}/profile`}
          className="text-xs text-blue-600 hover:underline"
        >
          View business profile →
        </Link>
      </div>
    </article>
  );
}

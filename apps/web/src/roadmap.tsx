/**
 * Phase 4 approval roadmap — interactive graph (React Flow + dagre).
 *
 * NEW DEPENDENCIES (flagged in the PR — not added silently):
 * - `@xyflow/react` (React Flow v12) — graph rendering.
 * - `@dagrejs/dagre` — automatic layered layout; each dagre rank corresponds
 *   to one engine-computed parallel group (both derive from the exact same
 *   depends_on edges, so dagre's columns ARE the parallel groups).
 *
 * Visual language rules:
 * - Nodes are styled by BOTH status (border + fill) and outcome (left accent
 *   stripe + badge), so a "blocked needs_information" node never reads like a
 *   "blocked applicable" node. attentionRequired is read-time data from the
 *   pinned evaluation, never a stored flag.
 * - Edges: depends_on is a solid dark edge WITH a directional arrow — a real
 *   blocker. informational / parallel_with / unknown are rendered with a
 *   deliberately DIFFERENT language — dotted, very light, NO arrow marker —
 *   plus an explicit "(never gates)" label and a legend.
 *
 * No document upload here (Phase 5) — the detail panel only displays the
 * deduplicated required-document list.
 */
import { useCallback, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import {
  roadmapApi,
  documentsApi,
  reuseApi,
  type ApprovalInstanceStatus,
  type DependencyRelationshipType,
  type Document as ApiDocument,
  type EvaluationOutcome,
  type MissingFieldInfo,
  type ReuseRequiredDocument,
  type RoadmapNode,
  type RoadmapResponse,
} from './api-client';
import {
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
  DocumentUploadControl,
} from './components';
import { PROFILE_FIELD_LABELS } from './profile-form';

// ---------------------------------------------------------------------------
// Styling maps — status × outcome
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ApprovalInstanceStatus, { ring: string; fill: string; label: string }> = {
  blocked: { ring: 'border-gray-300', fill: 'bg-gray-100', label: 'Blocked' },
  available: { ring: 'border-blue-500', fill: 'bg-white', label: 'Available' },
  in_progress: { ring: 'border-blue-600', fill: 'bg-blue-50', label: 'In progress' },
  done: { ring: 'border-green-600', fill: 'bg-green-50', label: 'Done' },
};

const OUTCOME_STYLES: Record<EvaluationOutcome, { stripe: string; badge: string; label: string }> = {
  applicable: {
    stripe: 'bg-green-400',
    badge: 'bg-green-100 text-green-800 border-green-300',
    label: 'Applicable',
  },
  not_applicable: {
    stripe: 'bg-gray-300',
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
    label: 'Not applicable',
  },
  needs_information: {
    stripe: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    label: 'Needs information',
  },
  not_evaluable: {
    stripe: 'bg-red-400',
    badge: 'bg-red-100 text-red-800 border-red-300',
    label: 'Not evaluable — check manually',
  },
};
// ---------------------------------------------------------------------------
// Edge styling — gating vs. never-gating
// ---------------------------------------------------------------------------

/**
 * Non-gating edges use a deliberately DIFFERENT visual language: dotted, very
 * light, arrowless — not a "softer solid" and not a subtle dash on the gating
 * color. There is no arrow because nothing is enforced.
 */
function edgeStyleFor(type: DependencyRelationshipType, gates: boolean): Partial<Edge> {
  if (gates) {
    return {
      type: 'smoothstep',
      animated: false,
      style: { stroke: '#374151', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#374151' },
      label: 'gates',
      labelStyle: { fill: '#374151', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: '#f9fafb' },
    };
  }
  const label = type === 'informational' ? 'informational (never gates)' : `${type} (never gates)`;
  return {
    type: 'straight',
    animated: false,
    style: { stroke: '#d1d5db', strokeWidth: 1, strokeDasharray: '3 7', strokeLinecap: 'round' },
    label,
    labelStyle: { fill: '#9ca3af', fontSize: 10, fontStyle: 'italic' },
    labelBgStyle: { fill: '#f9fafb' },
  };
}

// ---------------------------------------------------------------------------
// Layout — dagre, columned by parallel group
// ---------------------------------------------------------------------------

const NODE_W = 264;
const NODE_H = 128;

type LayoutPosition = { x: number; y: number };

/**
 * dagre layered layout over the GATING edges only (informational/parallel/
 * unknown never gate, so they never influence grouping). rankdir LR makes each
 * dagre rank a vertical column, which equals the engine-computed parallel
 * group. x is then snapped to the parallel-group column so the grouping is
 * explicit and stable even for unusual graphs.
 */
function buildLayout(data: RoadmapResponse): Map<string, LayoutPosition> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 130, ranker: 'longest-path' });

  const ids = new Set(data.nodes.map((n) => n.id));
  data.nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  data.edges.forEach((e) => {
    if (
      e.fromInstanceId !== null &&
      e.toInstanceId !== null &&
      ids.has(e.fromInstanceId) &&
      ids.has(e.toInstanceId) &&
      e.gates
    ) {
      g.setEdge(e.fromInstanceId, e.toInstanceId);
    }
  });
  dagre.layout(g);

  const groupColumn = new Map<string, number>();
  data.parallelGroups.forEach((group, index) => {
    group.forEach((id) => groupColumn.set(id, index));
  });
  const columnGap = NODE_W + 140;

  const positions = new Map<string, LayoutPosition>();
  data.nodes.forEach((n) => {
    const laid = g.node(n.id) as { x: number; y: number } | undefined;
    const column = groupColumn.get(n.id);
    const x = (column !== undefined ? column * columnGap : laid?.x ?? 0) - NODE_W / 2;
    const y = (laid?.y ?? (groupColumn.get(n.id) ?? 0) * (NODE_H + 40)) - NODE_H / 2;
    positions.set(n.id, { x, y });
  });

  // Normalize the coordinates to be non-negative: dagre centres nodes on their
  // midpoint (see the `- NODE_W / 2` / `- NODE_H / 2` above), which pushes the
  // top-left corner of the layout into negative space. React Flow's default
  // translateExtent treats nodes outside [0,0] as out of bounds, so negative
  // positions made the top/left nodes unreachable-by-scroll and clipped. Offsetting
  // everything so the top-left node sits at (0,0) keeps the exact relative layout
  // while bringing every node inside the pan/scroll bounds.
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  const offsetX = Number.isFinite(minX) ? -minX : 0;
  const offsetY = Number.isFinite(minY) ? -minY : 0;
  const normalized = new Map<string, LayoutPosition>();
  for (const [id, pos] of positions) {
    normalized.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
  }
  return normalized;
}
// ---------------------------------------------------------------------------
// Custom node card
// ---------------------------------------------------------------------------

type RoadmapNodeData = { node: RoadmapNode; isSelected: boolean };

function RoadmapNodeCard({ data }: NodeProps<Node<RoadmapNodeData>>): JSX.Element {
  const { node, isSelected } = data;
  const status = STATUS_STYLES[node.status];
  const outcome = OUTCOME_STYLES[node.outcome] ?? OUTCOME_STYLES.not_evaluable;
  return (
    <div
      className={`relative h-[118px] w-[250px] overflow-hidden rounded-lg border-2 bg-white shadow-sm ${
        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      } ${status.ring} ${status.fill}`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${outcome.stripe}`} />
      <div className="flex h-full flex-col px-3 py-2 pl-4">
        <p className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-snug text-gray-900">
          {node.approvalName}
        </p>
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-400">
          {node.approvalCode}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <span className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
            {status.label}
          </span>
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${outcome.badge}`}>
            {outcome.label}
          </span>
          {node.attentionRequired && (
            <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
              check
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Detail panel (no upload — Phase 5)
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Not recorded' : d.toLocaleDateString();
}

function MissingFieldItem({ missing }: { missing: MissingFieldInfo }): JSX.Element {
  const label = PROFILE_FIELD_LABELS[missing.field] ?? missing.field;
  return (
    <li className="text-sm text-amber-900">
      <span className="font-medium">{label}</span> —{' '}
      {missing.reason === 'type_mismatch'
        ? 'provided with a different definition than the rule uses'
        : 'not provided yet'}
      {missing.detail && <span className="text-amber-700"> ({missing.detail})</span>}
    </li>
  );
}

/**
 * Phase 7 reuse candidates for ONE required document on the roadmap detail
 * panel. Eligible candidates surface an explicit "Use existing document" action
 * with the reason they qualify; ineligible candidates are shown greyed out with
 * their SPECIFIC rejection reason — they are never hidden.
 */
function ReuseCandidates({
  group,
  projectId,
}: {
  group: ReuseRequiredDocument | undefined;
  projectId: string;
}): JSX.Element | null {
  if (!group || group.candidates.length === 0) return null;
  const eligible = group.candidates.filter((c) => c.eligible);
  const ineligible = group.candidates.filter((c) => !c.eligible);

  return (
    <div className="mt-2 space-y-2">
      {eligible.length > 0 && (
        <p className="text-xs font-semibold text-green-800">
          Reusable — existing document(s) that satisfy this requirement:
        </p>
      )}
      {eligible.map((c) => (
        <div key={c.documentId} className="rounded border border-green-300 bg-green-50 p-2">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/projects/${projectId}/documents/${c.documentId}`}
              className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
            >
              Use existing document
            </Link>
            {c.currentVersion && (
              <span className="text-xs text-green-800">
                v{c.currentVersion.versionNumber} · {c.currentVersion.state}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-green-900">{c.reason}</p>
        </div>
      ))}

      {ineligible.length > 0 && (
        <>
          <p className="pt-1 text-xs font-semibold text-gray-500">
            Existing candidates that cannot be reused:
          </p>
          {ineligible.map((c) => (
            <div
              key={c.documentId}
              className="rounded border border-gray-200 bg-gray-50 p-2 opacity-70"
              aria-disabled="true"
            >
              <p className="text-xs font-medium text-gray-500 line-through">Use existing document</p>
              <p className="mt-0.5 text-xs text-gray-500">{c.reason}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function DetailPanel({
  node,
  onClose,
  projectId,
}: {
  node: RoadmapNode;
  onClose: () => void;
  projectId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();
  const advance = useMutation({
    mutationFn: (next: 'in_progress' | 'done') =>
      roadmapApi.updateStatus(projectId, node.id, next, accessToken ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap', projectId] });
    },
  });

  // Fetch all project documents to match against required documents
  const { data: projectDocs } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.list(projectId, accessToken ?? undefined),
    enabled: projectId !== undefined && accessToken !== null,
    staleTime: 30_000,
  });

  // Build a map of document definition (FK id OR public code) -> Document.
  // The roadmap emits the stable DocumentDefinition.code as requiredDoc.id,
  // while the API stores the UUID FK — match on either so a just-uploaded
  // row links back to its requirement.
  const docMap = useMemo(() => {
    const map = new Map<string, ApiDocument>();
    projectDocs?.forEach((d) => {
      if (d.documentDefinitionId) map.set(d.documentDefinitionId, d);
      if (d.documentDefinitionCode) map.set(d.documentDefinitionCode, d);
    });
    return map;
  }, [projectDocs]);

  // Phase 7 reuse candidates for this approval instance — eligible AND
  // ineligible, each with its specific reason. Ineligible are never hidden.
  const { data: reuse } = useQuery({
    queryKey: ['reuse-candidates', projectId, node.id],
    queryFn: () => reuseApi.candidates(projectId, node.id, accessToken ?? undefined),
    enabled: projectId !== undefined && accessToken !== null,
    staleTime: 30_000,
  });

  // requiredDocs emitted by the roadmap are keyed by their DocumentDefinition
  // code (requiredDoc.id); the reuse response groups by the same code.
  const reuseByCode = useMemo(() => {
    const map = new Map<string, ReuseRequiredDocument>();
    reuse?.requiredDocuments.forEach((g) => map.set(g.code, g));
    return map;
  }, [reuse]);

  const canAdvance = node.status === 'available' || node.status === 'in_progress';
  const nextStatus = node.status === 'available' ? 'in_progress' : 'done';
  const status = STATUS_STYLES[node.status];
  const outcome = OUTCOME_STYLES[node.outcome] ?? OUTCOME_STYLES.not_evaluable;
  const showMissing = node.outcome === 'needs_information' && node.missingFields.length > 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-gray-900">{node.approvalName}</p>
          <p className="font-mono text-xs text-gray-500">{node.approvalCode}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
          {status.label}
        </span>
        <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${outcome.badge}`}>
          {outcome.label}
        </span>
        {node.attentionRequired && (
          <span className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
            Needs manual check
          </span>
        )}
      </div>

      {node.sourceUrl && (
        <p className="mt-3 text-sm">
          <span className="text-gray-600">Source: </span>
          <a
            href={node.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-blue-600 hover:underline"
          >
            {node.sourceUrl}
          </a>
        </p>
      )}
      <p className="mt-1 text-sm text-gray-600">Last verified: {formatDate(node.lastVerifiedDate)}</p>

      {showMissing && (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">Still needed before this can be decided:</p>
          <ul className="mt-1 list-disc pl-5">
            {node.missingFields.map((m) => (
              <MissingFieldItem key={`${m.field}:${m.reason}`} missing={m} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <p className="flex items-center justify-between text-sm font-semibold text-gray-800">
          <span>Required documents</span>
          <Link
            to={`/projects/${projectId}/clarifications`}
            className="text-xs font-normal text-blue-600 hover:underline"
          >
            Officer questions →
          </Link>
        </p>
        {node.requiredDocuments.length === 0 ? (
          <p className="mt-1 text-sm text-gray-500">None required for this approval.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {node.requiredDocuments.map((reqDoc) => (
              <div key={reqDoc.id}>
                <DocumentUploadControl
                  projectId={projectId}
                  requiredDoc={reqDoc}
                  existingDoc={docMap.get(reqDoc.id) ?? null}
                  token={accessToken ?? ''}
                />
                <ReuseCandidates group={reuseByCode.get(reqDoc.id)} projectId={projectId} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t pt-3">
        {node.status === 'blocked' && (
          <p className="text-sm text-gray-500">
            Blocked — complete its depends_on prerequisites first; availability is granted server-side.
          </p>
        )}
        {node.status === 'done' && (
          <p className="text-sm text-gray-500">
            Done — this approval is complete and its dependents were re-checked.
          </p>
        )}
        {canAdvance && (
          <button
            type="button"
            disabled={advance.isPending}
            onClick={() => void advance.mutate(nextStatus)}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {advance.isPending ? 'Saving…' : `Mark ${nextStatus.replace('_', ' ')}`}
          </button>
        )}
        {advance.isError && (
          <p className="mt-2 text-sm text-red-700">
            {advance.error instanceof Error ? advance.error.message : 'Could not advance status.'}
          </p>
        )}
      </div>
    </div>
  );
}
// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function RoadmapPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const projectId = id as string;
  // The roadmap route is authenticated (JwtAuthGuard) AND membership-scoped
  // (ProjectMemberGuard), so the in-memory access token must be sent. Waiting
  // for it avoids a guaranteed 401 on the first fetch after a page reload,
  // when AuthProvider is still silently refreshing from the httpOnly cookie.
  const { accessToken, isRestoring } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['roadmap', projectId],
    queryFn: () => roadmapApi.get(projectId, accessToken ?? undefined),
    enabled: projectId !== undefined && accessToken !== null,
    staleTime: 15_000,
    retry: 1,
  });

  const data = query.data;

  const positions = useMemo(() => (data ? buildLayout(data) : new Map<string, LayoutPosition>()), [data]);

  const nodeTypes = useMemo(() => ({ roadmap: RoadmapNodeCard }), []);

  const nodes = useMemo<Node[]>(() => {
    if (!data) return [];
    return data.nodes.map((rn) => ({
      id: rn.id,
      type: 'roadmap',
      position: positions.get(rn.id) ?? { x: 0, y: 0 },
      // Explicit initial dimensions so fitView can compute the flow bounds
      // before React Flow has measured the custom node cards (unmeasured nodes
      // default to 0×0, which made fitView under-zoom and clipped the bottom).
      width: NODE_W,
      height: NODE_H,
      data: { node: rn, isSelected: rn.id === selectedId },
    }));
  }, [data, positions, selectedId]);

  const edges = useMemo<Edge[]>(() => {
    if (!data) return [];
    const list: Edge[] = [];
    data.edges.forEach((e) => {
      if (e.fromInstanceId === null || e.toInstanceId === null) return; // endpoint not rendered
      list.push({
        id: e.id,
        source: e.fromInstanceId,
        target: e.toInstanceId,
        ...edgeStyleFor(e.type, e.gates),
      });
    });
    return list;
  }, [data]);

  const onNodeClick = useCallback((_: unknown, node: Node) => setSelectedId(String(node.id)), []);
  const onPaneClick = useCallback(() => setSelectedId(null), []);

  if (query.isLoading || isRestoring) {
    return (
      <div className="space-y-4">
        <LoadingSpinner label="Loading the approval roadmap…" />
      </div>
    );
  }

  if (accessToken === null) {
    return (
      <ErrorBanner message="Your session has ended — please log in again to view the approval roadmap." />
    );
  }

  if (query.isError) {
    return (
      <ErrorBanner
        message={query.error instanceof Error ? query.error.message : 'Could not load the roadmap.'}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (data === undefined || data.nodes.length === 0) {
    return (
      <EmptyState
        title="No approvals to act on yet"
        description="Confirm your business profile to generate the approval roadmap."
        action={
          <Link to={`/projects/${projectId}/profile`} className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Go to profile
          </Link>
        }
      />
    );
  }

  const selected = data.nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Approval roadmap</h1>
          <p className="text-sm text-gray-600">
            Project <span className="font-mono text-xs">{projectId}</span> · solid edges gate progress, dotted edges are informational only.
          </p>
          <p className="mt-1 text-sm">
            <Link to={`/projects/${projectId}/clarifications`} className="text-blue-600 hover:underline">
              View officer questions for this project →
            </Link>
          </p>
        </div>
        <Link
          to={`/projects/${projectId}/inspections`}
          className="rounded bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Joint Inspection Planner →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-6 rounded bg-gray-700" /> depends_on (gates)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-6 rounded border-t border-dashed border-gray-300" /> informational / parallel_with / unknown (never gates)
        </span>
      </div>

      <div className="h-[70vh] w-full overflow-hidden rounded-md border border-gray-200 bg-white">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
        >
          <Background gap={20} color="#e5e7eb" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected && (
        <DetailPanel node={selected} projectId={projectId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
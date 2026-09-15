import { useCallback, useMemo, useState } from 'react';
import { useAuth } from './auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Building,
  FlaskConical,
  Flame,
  Zap,
  Droplets,
  Sprout,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Award,
  Cog,
  Scale,
  Layers,
  CheckCircle2,
  PlayCircle,
  Lock,
  Network,
  ListFilter,
  GitCommitHorizontal,
  HelpCircle,
  Check,
  Clock,
  ChevronRight,
  Sparkles,
  X,
  Compass,
  AlertTriangle
} from 'lucide-react';
import {
  Background,
  Controls,
  ReactFlow,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type RoadmapEdgeData = { gates?: boolean };
type RoadmapEdge = Edge<RoadmapEdgeData>;
import dagre from '@dagrejs/dagre';
import {
  roadmapApi,
  documentsApi,
  reuseApi,
  type ApprovalInstanceStatus,
  type Document as ApiDocument,
  type EvaluationOutcome,
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
// Department & Regulatory Knowledge Mapping (Rule-aligned helper metadata)
// ---------------------------------------------------------------------------

interface ApprovalMeta {
  department: string;
  iconKey: string;
  summary: string;
  rationale: string;
  stage: string;
}

export function ApprovalIcon({ iconKey, className = "w-4 h-4 text-slate-700" }: { iconKey: string; className?: string }): JSX.Element {
  switch (iconKey) {
    case 'factory_plan':
      return <Building2 className={className} />;
    case 'mpcb_cte':
    case 'mpcb_cto':
      return <FlaskConical className={className} />;
    case 'fire_noc_provisional':
      return <Flame className={className} />;
    case 'fire_noc_final':
      return <ShieldAlert className={className} />;
    case 'building_plan':
      return <Building className={className} />;
    case 'power_sanction':
    case 'dg_set_approval':
      return <Zap className={className} />;
    case 'water_connection':
      return <Droplets className={className} />;
    case 'cgwa_noc':
      return <Sprout className={className} />;
    case 'occupancy_certificate':
      return <ClipboardCheck className={className} />;
    case 'factory_license':
      return <FileCheck2 className={className} />;
    case 'brewery_license':
      return <Award className={className} />;
    case 'fssai_license':
      return <ShieldCheck className={className} />;
    case 'boiler_registration':
      return <Cog className={className} />;
    case 'weighbridge_stamping':
      return <Scale className={className} />;
    default:
      return <FileText className={className} />;
  }
}

const APPROVAL_KNOWLEDGE_BASE: Record<string, ApprovalMeta> = {
  factory_plan: {
    department: 'Directorate of Industrial Safety & Health (DISH)',
    iconKey: 'factory_plan',
    summary: 'Statutory scrutiny of factory structural layout, worker ergonomics, ventilation, and emergency exits under Section 6 of the Factories Act.',
    rationale: 'Mandatory before commencing construction or structural alteration of any manufacturing premise where power is used.',
    stage: 'Pre-Construction Sanctions',
  },
  mpcb_cte: {
    department: 'State Pollution Control Board (SPCB / MPCB)',
    iconKey: 'mpcb_cte',
    summary: 'Consent to Establish under the Water (Prevention & Control of Pollution) Act 1974 & Air Act 1981.',
    rationale: 'Required prior to setting up industrial machinery to ensure effluent treatment plant (ETP) and stack emission compliance.',
    stage: 'Pre-Construction Sanctions',
  },
  fire_noc_provisional: {
    department: 'State Fire & Emergency Services',
    iconKey: 'fire_noc_provisional',
    summary: 'Provisional Fire Safety No Objection Certificate verifying hydrant layouts, sprinkler networks, and evacuation stairwells.',
    rationale: 'Prerequisite for civil construction clearance and building plan sanction from the municipal / industrial corporation.',
    stage: 'Pre-Construction Sanctions',
  },
  building_plan: {
    department: 'Municipal Corporation / Industrial Development Corp (MIDC)',
    iconKey: 'building_plan',
    summary: 'Sanction of architectural, structural, and civil engineering drawings for industrial building erection.',
    rationale: 'Authorizes physical civil construction on the allotted industrial plot or premise.',
    stage: 'Pre-Construction Sanctions',
  },
  power_sanction: {
    department: 'State Electricity Distribution Company (Discom)',
    iconKey: 'power_sanction',
    summary: 'High Tension (HT) / Low Tension (LT) industrial power load feasibility and substation grid connection sanction.',
    rationale: 'Ensures dedicated electrical substation infrastructure and transformer capacity for continuous processing lines.',
    stage: 'Civil & Utility Infrastructure',
  },
  water_connection: {
    department: 'Industrial Area Authority / Water Supply Board',
    iconKey: 'water_connection',
    summary: 'Bulk industrial water connection allotment & piped supply agreement for manufacturing and sanitation utilities.',
    rationale: 'Secures continuous water intake essential for brewing, beverage processing, cooling towers, and steam boilers.',
    stage: 'Civil & Utility Infrastructure',
  },
  cgwa_noc: {
    department: 'Central Ground Water Authority (CGWA)',
    iconKey: 'cgwa_noc',
    summary: 'Permission for borewell drilling and groundwater abstraction in industrial zones.',
    rationale: 'Statutory requirement when relying on groundwater resources for process extraction or backup utilities.',
    stage: 'Civil & Utility Infrastructure',
  },
  fire_noc_final: {
    department: 'Chief Fire Officer (CFO)',
    iconKey: 'fire_noc_final',
    summary: 'Final Fire Safety Compliance Certificate following on-site inspection of installed fire fighting systems.',
    rationale: 'Prerequisite for occupancy certificate and final factory licensing.',
    stage: 'Operational Licensing & Consents',
  },
  occupancy_certificate: {
    department: 'Municipal Authority / MIDC Town Planning',
    iconKey: 'occupancy_certificate',
    summary: 'Building completion and occupancy authorization certifying constructed structures conform to sanctioned plans.',
    rationale: 'Mandatory before personnel can occupy the premise or commence equipment installation.',
    stage: 'Operational Licensing & Consents',
  },
  factory_license: {
    department: 'Directorate of Industrial Safety & Health (DISH)',
    iconKey: 'factory_license',
    summary: 'Factory Registration and Operating License granted under Section 7 of the Factories Act 1948.',
    rationale: 'Authorizes the deployment of labor, machinery operations, and manufacturing activity.',
    stage: 'Operational Licensing & Consents',
  },
  mpcb_cto: {
    department: 'State Pollution Control Board (SPCB / MPCB)',
    iconKey: 'mpcb_cto',
    summary: 'Consent to Operate (CTO) verifying operational readiness of effluent treatment plants and pollution abatement mechanisms.',
    rationale: 'Mandatory to operate manufacturing equipment and discharge treated effluent within permissible limits.',
    stage: 'Operational Licensing & Consents',
  },
  brewery_license: {
    department: 'State Excise Commissionerate',
    iconKey: 'brewery_license',
    summary: 'Form B-1 / Microbrewery Manufacturing License for production, fermentation, storage, and kegging of potable liquor.',
    rationale: 'Primary statutory authorization governing alcohol formulation, raw material bonded storage, and excise revenue supervision.',
    stage: 'Operational Licensing & Consents',
  },
  fssai_license: {
    department: 'Food Safety and Standards Authority of India (FSSAI)',
    iconKey: 'fssai_license',
    summary: 'Central Food Business Operator (FBO) Manufacturing License.',
    rationale: 'Mandatory for food, beverage, and packaged goods manufacturing to guarantee food hygiene and consumer safety.',
    stage: 'Operational Licensing & Consents',
  },
  boiler_registration: {
    department: 'Directorate of Steam Boilers',
    iconKey: 'boiler_registration',
    summary: 'Steam Boiler and Piping Registration under the Indian Boilers Act 1923.',
    rationale: 'Statutory safety clearance for high-pressure industrial steam boilers utilized in brewing kettles and pasteurization.',
    stage: 'Operational Licensing & Consents',
  },
};

function getApprovalMeta(code: string, name: string): ApprovalMeta {
  const normalizedCode = code.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  
  for (const [key, meta] of Object.entries(APPROVAL_KNOWLEDGE_BASE)) {
    if (normalizedCode.includes(key) || key.includes(normalizedCode)) {
      return meta;
    }
  }

  // Fallback heuristic based on keywords in name
  const n = name.toLowerCase();
  if (n.includes('factory plan') || n.includes('plan approval')) {
    return APPROVAL_KNOWLEDGE_BASE.factory_plan!;
  }
  if (n.includes('pollution') || n.includes('cte') || n.includes('consent to establish')) {
    return APPROVAL_KNOWLEDGE_BASE.mpcb_cte!;
  }
  if (n.includes('cto') || n.includes('consent to operate')) {
    return APPROVAL_KNOWLEDGE_BASE.mpcb_cto!;
  }
  if (n.includes('fire') && n.includes('provisional')) {
    return APPROVAL_KNOWLEDGE_BASE.fire_noc_provisional!;
  }
  if (n.includes('fire')) {
    return APPROVAL_KNOWLEDGE_BASE.fire_noc_final!;
  }
  if (n.includes('brewery') || n.includes('excise')) {
    return APPROVAL_KNOWLEDGE_BASE.brewery_license!;
  }
  if (n.includes('food') || n.includes('fssai')) {
    return APPROVAL_KNOWLEDGE_BASE.fssai_license!;
  }
  if (n.includes('boiler')) {
    return APPROVAL_KNOWLEDGE_BASE.boiler_registration!;
  }
  if (n.includes('power') || n.includes('electricity')) {
    return APPROVAL_KNOWLEDGE_BASE.power_sanction!;
  }
  if (n.includes('water')) {
    return APPROVAL_KNOWLEDGE_BASE.water_connection!;
  }
  if (n.includes('factory license') || n.includes('factory registration')) {
    return APPROVAL_KNOWLEDGE_BASE.factory_license!;
  }

  return {
    department: 'State Regulatory Authority',
    iconKey: 'default',
    summary: 'Statutory compliance verification and regulatory permit.',
    rationale: 'Required under applicable state and central regulatory frameworks for project establishment.',
    stage: 'Statutory Approvals',
  };
}

// ---------------------------------------------------------------------------
// Status Styling Configurations
// ---------------------------------------------------------------------------

const STATUS_CONFIGS: Record<
  ApprovalInstanceStatus,
  { badgeBg: string; badgeText: string; ringColor: string; pillColor: string; label: string; iconType: 'available' | 'in_progress' | 'done' | 'blocked' }
> = {
  available: {
    badgeBg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    badgeText: 'text-emerald-700',
    ringColor: 'border-emerald-500 hover:border-emerald-600 ring-emerald-500/20',
    pillColor: 'bg-emerald-500',
    label: 'Ready to Start',
    iconType: 'available',
  },
  in_progress: {
    badgeBg: 'bg-blue-50 border-blue-300 text-blue-800',
    badgeText: 'text-blue-700',
    ringColor: 'border-blue-500 hover:border-blue-600 ring-blue-500/20',
    pillColor: 'bg-blue-600',
    label: 'In Progress',
    iconType: 'in_progress',
  },
  done: {
    badgeBg: 'bg-slate-100 border-slate-300 text-slate-800',
    badgeText: 'text-slate-700',
    ringColor: 'border-indigo-400 hover:border-indigo-500 ring-indigo-400/20',
    pillColor: 'bg-indigo-600',
    label: 'Completed',
    iconType: 'done',
  },
  blocked: {
    badgeBg: 'bg-amber-50 border-amber-300 text-amber-800',
    badgeText: 'text-amber-700',
    ringColor: 'border-amber-300 hover:border-amber-400 ring-amber-300/20',
    pillColor: 'bg-amber-500',
    label: 'Waiting on Blockers',
    iconType: 'blocked',
  },
};

function RenderStatusIcon({ type, className = "w-3 h-3 text-slate-700" }: { type: 'available' | 'in_progress' | 'done' | 'blocked'; className?: string }): JSX.Element {
  switch (type) {
    case 'available':
      return <PlayCircle className={className} />;
    case 'in_progress':
      return <Clock className={className} />;
    case 'done':
      return <Check className={className} />;
    case 'blocked':
    default:
      return <Lock className={className} />;
  }
}

const OUTCOME_CONFIGS: Record<
  EvaluationOutcome,
  { label: string; badgeClass: string; dotClass: string }
> = {
  applicable: {
    label: 'Applicable',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  not_applicable: {
    label: 'Not Applicable',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  needs_information: {
    label: 'Needs Profile Details',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  not_evaluable: {
    label: 'Check Manually',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

// ---------------------------------------------------------------------------
// Dagre Graph Layout Calculation
// ---------------------------------------------------------------------------

const NODE_WIDTH = 300;
const NODE_HEIGHT = 160;

type LayoutPosition = { x: number; y: number };

function buildOptimizedLayout(data: RoadmapResponse): Map<string, LayoutPosition> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 180, ranker: 'longest-path' });

  const ids = new Set(data.nodes.map((n) => n.id));
  data.nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
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
  const columnGap = NODE_WIDTH + 160;

  const positions = new Map<string, LayoutPosition>();
  data.nodes.forEach((n) => {
    const laid = g.node(n.id) as { x: number; y: number } | undefined;
    const column = groupColumn.get(n.id);
    const x = (column !== undefined ? column * columnGap : laid?.x ?? 0) - NODE_WIDTH / 2;
    const y = (laid?.y ?? (groupColumn.get(n.id) ?? 0) * (NODE_HEIGHT + 50)) - NODE_HEIGHT / 2;
    positions.set(n.id, { x, y });
  });

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
  }
  const offsetX = Number.isFinite(minX) ? -minX + 40 : 40;
  const offsetY = Number.isFinite(minY) ? -minY + 40 : 40;
  const normalized = new Map<string, LayoutPosition>();
  for (const [id, pos] of positions) {
    normalized.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Custom Node Component for ReactFlow
// ---------------------------------------------------------------------------

type CustomNodeData = {
  node: RoadmapNode;
  isSelected: boolean;
  blockerCount: number;
  meta: ApprovalMeta;
};

function EnhancedRoadmapNodeCard({ data }: NodeProps<Node<CustomNodeData>>): JSX.Element {
  const { node, isSelected, blockerCount, meta } = data;
  const statusConfig = STATUS_CONFIGS[node.status] || STATUS_CONFIGS.blocked;

  return (
    <div
      className={`relative w-[290px] rounded-2xl bg-white border-2 p-4 text-left shadow-md transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'border-blue-600 ring-4 ring-blue-500/25 shadow-xl scale-[1.02]'
          : `${statusConfig.ringColor} hover:shadow-lg`
      }`}
    >
      {/* Top Department & Icon */}
      <div className="flex items-center justify-between mb-2">
        <span className="p-2 rounded-xl bg-slate-100 border border-slate-200/80">
          <ApprovalIcon iconKey={meta.iconKey} className="w-5 h-5 text-slate-800" />
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${statusConfig.badgeBg}`}>
          <RenderStatusIcon type={statusConfig.iconType} className="w-3 h-3" />
          {statusConfig.label}
        </span>
      </div>

      {/* Approval Name & Code */}
      <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2 min-h-[2.5rem]">
        {node.approvalName}
      </h4>
      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate uppercase">
        {meta.department}
      </p>

      {/* Dependency Status Indicator */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        {node.status === 'done' ? (
          <span className="text-indigo-700 font-bold flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-indigo-700" />
            <span>Completed &amp; Unlocked</span>
          </span>
        ) : node.status === 'available' ? (
          <span className="text-emerald-700 font-bold flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ready to submit</span>
          </span>
        ) : node.status === 'in_progress' ? (
          <span className="text-blue-700 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-700" />
            <span>Under review</span>
          </span>
        ) : (
          <span className="text-amber-700 font-semibold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span>Waiting on {blockerCount || 1} prerequisite{blockerCount > 1 ? 's' : ''}</span>
          </span>
        )}

        <span className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
          <span>Details</span>
          <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right Slide-Over Detail Drawer
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Not recorded' : d.toLocaleDateString();
}

interface DetailDrawerProps {
  node: RoadmapNode;
  allNodes: RoadmapNode[];
  edges: RoadmapEdge[];
  projectId: string;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
}

function DetailDrawer({
  node,
  allNodes,
  edges,
  projectId,
  onClose,
  onSelectNode,
}: DetailDrawerProps): JSX.Element {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();
  const meta = getApprovalMeta(node.approvalCode, node.approvalName);
  const statusConfig = STATUS_CONFIGS[node.status] || STATUS_CONFIGS.blocked;
  const outcomeConfig = OUTCOME_CONFIGS[node.outcome] || OUTCOME_CONFIGS.not_evaluable;

  const advance = useMutation({
    mutationFn: (next: 'in_progress' | 'done') =>
      roadmapApi.updateStatus(projectId, node.id, next, accessToken ?? undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap', projectId] });
    },
  });

  const { data: projectDocs } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => documentsApi.list(projectId, accessToken ?? undefined),
    enabled: Boolean(projectId && accessToken),
    staleTime: 30_000,
  });

  const docMap = useMemo(() => {
    const map = new Map<string, ApiDocument>();
    projectDocs?.forEach((d) => {
      if (d.documentDefinitionId) map.set(d.documentDefinitionId, d);
      if (d.documentDefinitionCode) map.set(d.documentDefinitionCode, d);
    });
    return map;
  }, [projectDocs]);

  const { data: reuse } = useQuery({
    queryKey: ['reuse-candidates', projectId, node.id],
    queryFn: () => reuseApi.candidates(projectId, node.id, accessToken ?? undefined),
    enabled: Boolean(projectId && accessToken),
    staleTime: 30_000,
  });

  const reuseByCode = useMemo(() => {
    const map = new Map<string, ReuseRequiredDocument>();
    reuse?.requiredDocuments.forEach((g) => map.set(g.code, g));
    return map;
  }, [reuse]);

  // Find incoming gating blockers
  const blockingEdges = edges.filter((e) => e.target === node.id && e.data?.gates !== false);
  const blockingNodeIds = new Set(blockingEdges.map((e) => e.source));
  const blockingNodes = allNodes.filter((n) => blockingNodeIds.has(n.id));

  // Find outgoing dependents that this approval unlocks
  const outgoingEdges = edges.filter((e) => e.source === node.id);
  const dependentNodeIds = new Set(outgoingEdges.map((e) => e.target));
  const dependentNodes = allNodes.filter((n) => dependentNodeIds.has(n.id));

  const canAdvance = node.status === 'available' || node.status === 'in_progress';
  const nextStatus = node.status === 'available' ? 'in_progress' : 'done';

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[520px] bg-white border-l border-slate-200/90 shadow-2xl flex flex-col animate-slideLeft overflow-hidden">
      
      {/* Drawer Header */}
      <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
        <div className="pr-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-white shadow-2xs border border-slate-200/80">
              <ApprovalIcon iconKey={meta.iconKey} className="w-5 h-5 text-slate-800" />
            </span>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider font-bold">
              {node.approvalCode}
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 leading-snug">
            {node.approvalName}
          </h3>
          <p className="text-xs text-blue-700 font-semibold mt-1">
            {meta.department}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {/* Status & Outcome Summary Banner */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Current Status</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full ${statusConfig.pillColor}`} />
              <span className="font-extrabold text-sm text-slate-900">{statusConfig.label}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-mono uppercase font-bold">Evaluation Outcome</div>
            <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${outcomeConfig.badgeClass}`}>
              {outcomeConfig.label}
            </span>
          </div>
        </div>

<<<<<<< HEAD
        {/* What is this approval? */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5">
            What is this approval?
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            {meta.summary}
          </p>
        </div>

        {/* Why is it required for your project? */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5">
            Why is it required for your project?
          </h4>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
            {meta.rationale}
          </p>
        </div>

        {/* Prerequisites & Blockers */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
            Prerequisite Dependencies
          </h4>
          {blockingNodes.length === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>No blocking prerequisites — this clearance is ready for submission.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-amber-800 font-medium">
                Must be completed before this approval can be granted:
              </p>
              {blockingNodes.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">{b.approvalName}</div>
                    <div className="text-[10px] text-amber-700 font-mono">Status: {b.status.toUpperCase()}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectNode(b.id)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold"
                  >
                    View Blocker →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Downstream Unlocks */}
        {dependentNodes.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
              Approvals Unlocked Upon Completion
            </h4>
            <div className="space-y-1.5">
              {dependentNodes.map((d) => (
                <div
                  key={d.id}
                  onClick={() => onSelectNode(d.id)}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-xs cursor-pointer"
                >
                  <span className="font-medium text-slate-800">{d.approvalName}</span>
                  <span className="text-blue-600 font-bold">Inspect →</span>
                </div>
              ))}
            </div>
=======
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
>>>>>>> origin/main
          </div>
        )}

        {/* Required Documents & Checklists */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Required Documents ({node.requiredDocuments.length})
            </h4>
            <span className="text-[10px] text-slate-400 font-mono">Verifiable Uploads</span>
          </div>

          {node.requiredDocuments.length === 0 ? (
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              No mandatory document attachments specified for this clearance.
            </p>
          ) : (
            <div className="space-y-3">
              {node.requiredDocuments.map((reqDoc) => (
                <div key={reqDoc.id} className="space-y-2">
                  <DocumentUploadControl
                    projectId={projectId}
                    requiredDoc={reqDoc}
                    existingDoc={docMap.get(reqDoc.id) ?? null}
                    token={accessToken ?? ''}
                  />
                  {reuseByCode.get(reqDoc.id) && (
                    <div className="text-[11px] text-slate-600 pl-1">
                      {reuseByCode.get(reqDoc.id)?.candidates.length || 0} existing candidate(s) in repository
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Missing Profile Information (if needs_information) */}
        {node.outcome === 'needs_information' && node.missingFields.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
            <div className="font-bold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Missing Profile Information:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-amber-800">
              {node.missingFields.map((m, idx) => (
                <li key={idx}>
                  <strong>{PROFILE_FIELD_LABELS[m.field] || m.field}</strong> —{' '}
                  {m.reason === 'type_mismatch' ? 'Requires specific definition matching statute' : 'Not provided yet in business profile'}
                </li>
              ))}
            </ul>
            <Link
              to={`/projects/${projectId}/profile`}
              className="inline-block mt-1 font-bold text-blue-700 hover:underline"
            >
              Update Project Profile →
            </Link>
          </div>
        )}

        {/* Source & Verification Metadata */}
        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
          {node.sourceUrl && (
            <div className="flex items-center justify-between">
              <span>Official Regulatory Portal:</span>
              <a
                href={node.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-bold"
              >
                Visit Authority Portal ↗
              </a>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px]">
            <span>Last Rulebook Verification:</span>
            <span className="font-mono">{formatDate(node.lastVerifiedDate)}</span>
          </div>
        </div>

      </div>

      {/* Drawer Footer Action Buttons */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        {canAdvance && (
          <button
            type="button"
            disabled={advance.isPending}
            onClick={() => void advance.mutate(nextStatus)}
            className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all disabled:opacity-50"
          >
            {advance.isPending ? 'Updating…' : `Mark ${nextStatus === 'in_progress' ? 'as In Progress' : 'as Completed'}`}
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="py-3 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-200 text-xs font-bold"
        >
          Close
        </button>
      </div>

    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main Roadmap Page Component
// ---------------------------------------------------------------------------

export function RoadmapPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const projectId = id as string;
  const { accessToken, isRestoring } = useAuth();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'roadmap' | 'list' | 'timeline'>('roadmap');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const query = useQuery({
    queryKey: ['roadmap', projectId],
    queryFn: () => roadmapApi.get(projectId, accessToken ?? undefined),
    enabled: Boolean(projectId && accessToken),
    staleTime: 15_000,
    retry: 1,
  });

  const data = query.data;

  // Compute Layout & Map Data
  const positions = useMemo(() => (data ? buildOptimizedLayout(data) : new Map<string, LayoutPosition>()), [data]);
  const nodeTypes = useMemo(() => ({ roadmap: EnhancedRoadmapNodeCard }), []);

  // Filtered nodes based on search & filters
  const filteredNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter((n) => {
      const meta = getApprovalMeta(n.approvalCode, n.approvalName);
      const matchesSearch =
        n.approvalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.approvalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meta.department.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
      const matchesDept = departmentFilter === 'all' || meta.department.toLowerCase().includes(departmentFilter.toLowerCase());

      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [data, searchQuery, statusFilter, departmentFilter]);

  // Real Counts Derived from Database
  const totalCount = data?.nodes.length || 0;
  const applicableCount = data?.nodes.filter((n) => n.outcome === 'applicable').length || 0;
  const readyCount = data?.nodes.filter((n) => n.status === 'available').length || 0;
  const blockedCount = data?.nodes.filter((n) => n.status === 'blocked').length || 0;
  const completedCount = data?.nodes.filter((n) => n.status === 'done').length || 0;
  const inProgressCount = data?.nodes.filter((n) => n.status === 'in_progress').length || 0;

  // Real Overall Progress Percentage
  const progressPercent = applicableCount > 0 ? Math.round((completedCount / applicableCount) * 100) : 0;

  // Calculate Next Best Action Node
  const nextActionNode = useMemo(() => {
    if (!data || data.nodes.length === 0) return null;
    // 1. Ready to start
    const available = data.nodes.find((n) => n.status === 'available');
    if (available) return { node: available, reason: 'This approval has no blocking prerequisites and is ready for submission.' };
    // 2. In progress
    const inProgress = data.nodes.find((n) => n.status === 'in_progress');
    if (inProgress) return { node: inProgress, reason: 'Currently under active review with the regulatory authority.' };
    // 3. First blocked node
    const blocked = data.nodes.find((n) => n.status === 'blocked');
    if (blocked) return { node: blocked, reason: 'Waiting for preliminary statutory clearance prerequisites to complete.' };
    // 4. Completed all
    return null;
  }, [data]);

  // Edges mapped for React Flow
  const edges = useMemo<RoadmapEdge[]>(() => {
    if (!data) return [];
    const list: RoadmapEdge[] = [];
    data.edges
      .filter((e) => e.fromInstanceId !== null && e.toInstanceId !== null)
      .forEach((e) => {
        const isGating = e.gates;
        const edgeItem: RoadmapEdge = {
          id: e.id,
          source: e.fromInstanceId!,
          target: e.toInstanceId!,
          type: 'smoothstep',
          animated: isGating,
          style: isGating
            ? { stroke: '#2563eb', strokeWidth: 2.5 }
            : { stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' },
          data: { gates: isGating },
        };
        if (isGating) {
          edgeItem.markerEnd = { type: MarkerType.ArrowClosed, color: '#2563eb' };
        }
        list.push(edgeItem);
      });
    return list;
  }, [data]);

  // Nodes mapped for React Flow
  const flowNodes = useMemo<Node[]>(() => {
    if (!data) return [];
    return data.nodes.map((rn) => {
      const meta = getApprovalMeta(rn.approvalCode, rn.approvalName);
      const incomingGaters = edges.filter((e) => e.target === rn.id && e.data?.gates !== false);
      return {
        id: rn.id,
        type: 'roadmap',
        position: positions.get(rn.id) ?? { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        data: {
          node: rn,
          isSelected: rn.id === selectedId,
          blockerCount: incomingGaters.length,
          meta,
        },
      };
    });
  }, [data, positions, selectedId, edges]);

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId(String(node.id));
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedId(null);
  }, []);

  if (query.isLoading || isRestoring) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner label="Synthesizing your regulatory approval roadmap…" />
      </div>
    );
  }

  if (accessToken === null) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <ErrorBanner message="Your session has ended — please sign in again to view your project roadmap." />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <ErrorBanner
          message={query.error instanceof Error ? query.error.message : 'Could not load the approval roadmap.'}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <EmptyState
          title="No approvals generated yet"
          description="Complete your project profile intake to generate your regulatory roadmap."
          action={
            <Link to={`/projects/${projectId}/profile`} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow">
              Complete Profile Intake →
            </Link>
          }
        />
      </div>
    );
  }

  const selectedNode = data.nodes.find((n) => n.id === selectedId) || null;

  return (
    <div className="space-y-6 animate-fadeIn pb-16 font-sans">
      
      {/* 1. Breadcrumb & Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1.5">
            <Link to="/projects" className="hover:text-blue-600 transition-colors">Projects</Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">Pune Brewery Expansion</span>
            <span>/</span>
            <span className="text-blue-600 font-bold">Approval Roadmap</span>
          </nav>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Approval Roadmap
            </h1>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
              Pune, Maharashtra · Brewery
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Your compliance journey at a glance. Complete clearances progressively along the critical path.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <Link
            to={`/projects/${projectId}/clarifications`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition-colors"
          >
            <span>Officer Questions</span>
          </Link>

          <Link
            to={`/projects/${projectId}/inspections`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>Joint Inspections →</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-700" />
            <span>How It Works</span>
          </button>

          <Link
            to={`/projects/${projectId}/profile`}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* 2. Four Real Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md shadow-slate-100 flex items-center justify-between group hover:border-blue-400 transition-all">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Clearances</div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 font-mono">{totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Statutory compliance rules</div>
          </div>
          <span className="p-3 rounded-2xl bg-slate-100 group-hover:scale-110 transition-transform">
            <Layers className="w-5 h-5 text-slate-800" />
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md shadow-slate-100 flex items-center justify-between group hover:border-emerald-400 transition-all">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Applicable</div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-0.5 font-mono">{applicableCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Required for your premise</div>
          </div>
          <span className="p-3 rounded-2xl bg-emerald-50 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-5 h-5 text-emerald-800" />
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md shadow-slate-100 flex items-center justify-between group hover:border-cyan-400 transition-all">
          <div>
            <div className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider font-mono">Ready to Start</div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-600 mt-0.5 font-mono">{readyCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Zero blocking prerequisites</div>
          </div>
          <span className="p-3 rounded-2xl bg-cyan-50 group-hover:scale-110 transition-transform">
            <PlayCircle className="w-5 h-5 text-cyan-800" />
          </span>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md shadow-slate-100 flex items-center justify-between group hover:border-amber-400 transition-all">
          <div>
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider font-mono">Blocked / Waiting</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-0.5 font-mono">{blockedCount}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Awaiting prior approvals</div>
          </div>
          <span className="p-3 rounded-2xl bg-amber-50 group-hover:scale-110 transition-transform">
            <Lock className="w-5 h-5 text-amber-800" />
          </span>
        </div>

      </div>

      {/* 3. Overall Progress & Next Best Action Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Overall Progress (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-3xl bg-white border border-slate-200/80 shadow-md flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Overall Compliance Progress
            </span>
            <span className="text-xs font-black text-blue-600 font-mono bg-blue-50 px-2.5 py-1 rounded-full">
              {progressPercent}% Complete
            </span>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{completedCount} of {applicableCount} applicable clearances completed</span>
            <span>{inProgressCount} in progress</span>
          </div>
        </div>

        {/* Next Best Action Card (7 cols) */}
        {nextActionNode ? (
          <div className="lg:col-span-7 p-5 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                <Zap className="w-3 h-3 text-cyan-300" />
                <span>YOUR RECOMMENDED NEXT ACTION</span>
              </div>
              <h3 className="text-lg font-black text-white">
                {nextActionNode.node.approvalName}
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 max-w-lg">
                {nextActionNode.reason}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedId(nextActionNode.node.id)}
              className="px-5 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg shadow-cyan-400/30 transition-all hover:scale-105 shrink-0 cursor-pointer"
            >
              View Clearance →
            </button>
          </div>
        ) : (
          <div className="lg:col-span-7 p-5 rounded-3xl bg-emerald-900 text-white shadow-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-emerald-300">All Applicable Approvals Completed</div>
              <h3 className="text-lg font-black text-white mt-0.5">Project Ready for Commercial Operations</h3>
            </div>
            <Sparkles className="w-8 h-8 text-emerald-300" />
          </div>
        )}

      </div>

      {/* 4. Controls, View Switcher & Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        
        {/* View Mode Segmented Control */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0 w-full lg:w-auto justify-center">
          <button
            type="button"
            onClick={() => setViewMode('roadmap')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'roadmap' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Roadmap Graph</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'list' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3.5 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'timeline' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitCommitHorizontal className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          
          <div className="relative flex-1 sm:w-64">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search approvals or authority..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="available">Ready to Start</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Completed</option>
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="all">All Departments</option>
            <option value="Pollution Control Board">Pollution Control (SPCB/MPCB)</option>
            <option value="Fire & Emergency">Fire & Emergency Services</option>
            <option value="Industrial Safety">Labour & Factory Directorate</option>
            <option value="Municipal">Municipal / MIDC</option>
            <option value="Electricity">Power Discom</option>
            <option value="Water">Water Supply Authority</option>
            <option value="Food Safety">FSSAI Authority</option>
            <option value="Excise">State Excise Department</option>
          </select>

        </div>

      </div>

      {/* 5. View Mode Rendering */}

      {/* VIEW 1: ROADMAP GRAPH */}
      {viewMode === 'roadmap' && (
        <div className="space-y-3">
          
          {/* Legend Banner */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-2">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <span className="w-5 h-0.5 rounded bg-blue-600" /> Required Gating Prerequisite
              </span>
              <span className="inline-flex items-center gap-1.5 text-slate-400">
                <span className="w-5 h-0.5 border-t border-dashed border-slate-300" /> Informational Link
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {filteredNodes.length} nodes rendered • Click any node to inspect details
            </span>
          </div>

          {/* Interactive ReactFlow Canvas */}
          <div className="h-[620px] w-full rounded-3xl border border-slate-200/90 bg-slate-50/50 shadow-inner overflow-hidden relative">
            <ReactFlow
              nodes={flowNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              fitView
              fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
            >
              <Background gap={24} color="#cbd5e1" size={1.2} />
              <Controls position="bottom-left" showInteractive={false} />
            </ReactFlow>
          </div>

        </div>
      )}

      {/* VIEW 2: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider font-mono">
                  <th className="py-3.5 px-4">Approval Name &amp; Code</th>
                  <th className="py-3.5 px-4">Regulating Authority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Outcome</th>
                  <th className="py-3.5 px-4">Required Documents</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNodes.map((n) => {
                  const meta = getApprovalMeta(n.approvalCode, n.approvalName);
                  const statusConfig = STATUS_CONFIGS[n.status] || STATUS_CONFIGS.blocked;
                  const outcomeConfig = OUTCOME_CONFIGS[n.outcome] || OUTCOME_CONFIGS.not_evaluable;

                  return (
                    <tr
                      key={n.id}
                      onClick={() => setSelectedId(n.id)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{n.approvalName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{n.approvalCode}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-700">{meta.department}</div>
                        <div className="text-[10px] text-slate-400">{meta.stage}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${statusConfig.badgeBg}`}>
                          <RenderStatusIcon type={statusConfig.iconType} className="w-3 h-3" />
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${outcomeConfig.badgeClass}`}>
                          {outcomeConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {n.requiredDocuments.length} document{n.requiredDocuments.length !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(n.id);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-bold text-xs transition-all cursor-pointer"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="space-y-6 max-w-4xl mx-auto py-4">
          
          {['Pre-Construction Sanctions', 'Civil & Utility Infrastructure', 'Operational Licensing & Consents'].map((stageName, sIdx) => {
            const stageNodes = filteredNodes.filter((n) => {
              const meta = getApprovalMeta(n.approvalCode, n.approvalName);
              return meta.stage === stageName;
            });

            if (stageNodes.length === 0) return null;

            return (
              <div key={stageName} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center font-mono">
                    0{sIdx + 1}
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {stageName}
                  </h3>
                </div>

                <div className="ml-3.5 pl-6 border-l-2 border-slate-200 space-y-3">
                  {stageNodes.map((n) => {
                    const meta = getApprovalMeta(n.approvalCode, n.approvalName);
                    const statusConfig = STATUS_CONFIGS[n.status] || STATUS_CONFIGS.blocked;

                    return (
                      <div
                        key={n.id}
                        onClick={() => setSelectedId(n.id)}
                        className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-blue-500 shadow-xs hover:shadow-md transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="p-2.5 rounded-xl bg-slate-100 border border-slate-200/80">
                            <ApprovalIcon iconKey={meta.iconKey} className="w-5 h-5 text-slate-800" />
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{n.approvalName}</h4>
                            <p className="text-[11px] text-slate-500">{meta.department}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusConfig.badgeBg}`}>
                            <RenderStatusIcon type={statusConfig.iconType} className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                          <span className="text-blue-600 text-xs font-bold">Details →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {/* 6. Approval Detail Drawer (Slide-Over Panel) */}
      {selectedNode && (
        <DetailDrawer
          node={selectedNode}
          allNodes={data.nodes}
          edges={edges}
          projectId={projectId}
          onClose={() => setSelectedId(null)}
          onSelectNode={(nodeId) => setSelectedId(nodeId)}
        />
      )}

      {/* 7. "How This Roadmap Works" Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-slate-800" />
                <span>How the Approval Roadmap Works</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              ApprovalIQ maps the statutory relationships between government clearances so you can see what can be started right now, what must wait, and which approvals unlock subsequent construction and operating milestones.
            </p>

            <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2">
                <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span><strong>Ready to Start (Available):</strong> Zero blocking prerequisites. Can be prepared and submitted immediately.</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span><strong>In Progress:</strong> Currently submitted and awaiting departmental scrutiny.</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                <span><strong>Waiting on Blockers:</strong> Cannot be granted until prior statutory clearances are secured.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-indigo-600" />
                <span><strong>Completed:</strong> Successfully obtained and recorded in your compliance repository.</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
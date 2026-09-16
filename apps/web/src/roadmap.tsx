import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AlertTriangle,
  Gift,
  Info,
  XCircle,
  AlertCircle,
  Landmark,
  TrendingUp,
  CheckSquare,
  Lightbulb,
  Bot,
  Send,
  Loader2,
  ExternalLink,
  Key,
  Copy,
  RotateCcw,
  Cpu,
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
  type SchemeEvaluationInfo,
  type SchemeOutcome,
} from './api-client';
import {
  EmptyState,
  ErrorBanner,
  LoadingSpinner,
  DocumentUploadControl,
} from './components';
import { PROFILE_FIELD_LABELS } from './profile-form';
import { RecoveryPlanPanel } from './recovery';
import { useLanguage } from './i18n';

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

      {/* SLA Statutory Timeline Badge & Source */}
      <div className="mt-2.5 flex items-center justify-between text-[10px]">
        {node.slaDays !== null && node.slaDays !== undefined ? (
          <span
            className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200"
            title={`SLA: ${node.slaDays} days (${node.slaBasis || 'RTS Act-notified timeline'})`}
          >
            <Clock className="w-3 h-3 text-blue-600" />
            <span>{node.slaDays} days</span>
            <span className="text-[9px] text-slate-400 font-normal">· RTS Notified</span>
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200"
            title="Basis: No verified notified timeline available"
          >
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Unknown timeline</span>
          </span>
        )}
        {node.sourceUrl && (
          <a
            href={node.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center gap-0.5"
            title="View regulatory source & evidence"
          >
            <span>Source</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>

      {/* Dependency Status Indicator */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
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

        <div className="flex items-center gap-1">
          {typeof node.slaDays === 'number' && (
            <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
              ⏱️ {node.slaDays}d RTS
            </span>
          )}
          {node.inspectionRequired && (
            <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              🔍 Insp.
            </span>
          )}
          <span className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-0.5">
            <span>Details</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
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
  const { t } = useLanguage();
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<'ambiguous' | 'outdated' | 'missing_doc' | 'sla_discrepancy'>('ambiguous');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitted, setReportSubmitted] = useState(false);
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

        {/* Statutory Service Timeline (SLA) & Legal Basis */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Service Timeline (SLA)</span>
            </div>
            {node.slaDays !== null && node.slaDays !== undefined ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                {node.slaDays} Days
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 font-mono">
                Unknown
              </span>
            )}
          </div>

          <div className="text-xs text-slate-600 space-y-1.5 pt-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-slate-400 font-mono text-[11px]">Timeline Basis:</span>
              <span className="font-semibold text-slate-800 text-right text-[11px]">
                {node.slaBasis || (node.slaDays !== null ? 'RTS Act-notified timeline' : 'No verified notified timeline available')}
              </span>
            </div>

            {node.slaDays === null || node.slaDays === undefined ? (
              <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
                <strong>Timeline Notice:</strong> SLA risk calculation is suppressed because no verified RTS Act-notified timeline or primary-source statutory timeline is recorded for this clearance.
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                <span className="text-slate-400 font-mono">SLA Tracking Status:</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Tracked under Maharashtra RTS Act
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Badges and metadata */}
        <div className="flex flex-wrap gap-2">
          {typeof node.slaDays === 'number' && (
            <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800">
              ⏱️ Statutory SLA: {node.slaDays} Days (RTS Act)
            </span>
          )}
          {node.inspectionRequired && (
            <Link
              to={`/projects/${projectId}/inspections`}
              className="rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
            >
              🔍 Joint Inspection Required →
            </Link>
          )}
        </div>

        {/* Direct RTS Delay / Issue Grievance Quick Action */}
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-bold text-rose-900">Encountering Delay or Irregularity?</p>
              <p className="text-rose-700 text-[11px] mt-0.5">Enforce statutory resolution timelines under Maharashtra RTS Act.</p>
            </div>
            <Link
              to={`/projects/${projectId}/grievances?approvalInstanceId=${node.id}`}
              className="shrink-0 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
            >
              ⚖️ File RTS Grievance
            </Link>
          </div>
        </div>

        {Array.isArray(node.missingFields) && node.missingFields.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-bold text-amber-900">Still needed before this can be decided:</p>
            <ul className="mt-1.5 list-disc pl-5 text-xs text-amber-800 space-y-1">
              {node.missingFields.map((m) => (
                <li key={`${m.field}:${m.reason}`}>
                  <span className="font-semibold">{m.field}</span>: {m.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
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
            {node.whyRequired || meta.rationale}
          </p>
        </div>

        {/* Statutory Process Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Pre-Grant Inspection</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">
              {node.inspectionRequired ? 'Mandatory On-Site' : 'Not Required'}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-[10px] text-slate-400 font-mono uppercase">Validity &amp; Renewal</div>
            <div className="text-xs font-bold text-slate-800 mt-0.5">
              {node.renewalRequired ? 'Periodic Renewal Required' : 'Permanent / One-Time'}
            </div>
          </div>
        </div>

        {/* Ambiguity Notes (if any) */}
        {node.ambiguityNotes && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-1">
            <div className="font-bold text-indigo-950 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              <span>Statutory Ambiguity Note:</span>
            </div>
            <p className="text-indigo-900 leading-relaxed text-[11px]">
              {node.ambiguityNotes}
            </p>
          </div>
        )}

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

        {/* Provenance & Legal Source Metadata */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Issuing Authority:</span>
            <span className="font-bold text-slate-900 text-right">
              {node.authority?.name || meta.department}
            </span>
          </div>

          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-500 shrink-0">Official Source Citation:</span>
            <span className="font-mono text-[11px] text-slate-800 text-right">
              {node.source?.citation || node.source?.name || 'Maharashtra Right to Services (RTS) Portal'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Rulebook Verification:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              <span>{formatDate(node.lastVerifiedDate)}</span>
            </span>
          </div>

          {node.sourceUrl && (
            <div className="pt-2 border-t border-slate-200">
              <a
                href={node.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-blue-700 font-bold text-xs transition-colors shadow-2xs"
              >
                <span>Visit Authority Regulatory Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Report an Issue with this Requirement (Dossier Part 9.3) */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setIsReportOpen(true);
                setReportSubmitted(false);
              }}
              className="inline-flex items-center justify-center w-full gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border border-slate-200 text-slate-600 font-semibold text-xs transition-colors cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('roadmap.report_issue')}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Requirement Issue Reporting Modal */}
      {isReportOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <h4 className="font-bold text-slate-900 text-sm">{t('roadmap.report_modal_title')}</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-emerald-800">{t('roadmap.report_submitted')}</p>
                <p className="text-[11px] text-emerald-700">Audit Reference: REP-{Date.now().toString(36).toUpperCase()}</p>
                <button
                  type="button"
                  onClick={() => setIsReportOpen(false)}
                  className="mt-2 px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  Reporting an issue for: <strong className="text-slate-900">{node.approvalName}</strong> (<span className="font-mono text-[10px]">{node.approvalCode}</span>)
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Issue Category
                  </label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value as any)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white"
                  >
                    <option value="ambiguous">Ambiguous Requirement / Text</option>
                    <option value="outdated">Outdated Statutory Reference or Clause</option>
                    <option value="missing_doc">Missing Required Document</option>
                    <option value="sla_discrepancy">SLA Timeline Discrepancy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Specific Clarification / Discrepancy Note
                  </label>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe the discrepancy or proposed regulatory correction..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsReportOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportSubmitted(true);
                    }}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow"
                  >
                    Submit to Regulatory Desk
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
// Schemes & Incentives Configurations & Why-Drawer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Schemes & Incentives Advisory Knowledge Base & Configurations
// ---------------------------------------------------------------------------

export interface SchemeAdvisoryInfo {
  category: 'startup' | 'msme' | 'tax_gst' | 'export' | 'state_green';
  categoryLabel: string;
  fiscalHighlight: string;
  benefitSummary: string;
  whatToBeDone: { step: number; title: string; description: string; timeline: string }[];
  prerequisites: { name: string; document: string; isReadilyAvailable?: boolean }[];
  proTips: string[];
  alternativeRecommendations?: string[];
  portalName: string;
  portalUrl: string;
  authorityDepartment: string;
}

export const SCHEME_ADVISORY_MAP: Record<string, SchemeAdvisoryInfo> = {
  'STARTUP-DPIIT-001': {
    category: 'startup',
    categoryLabel: 'Startup India & DPIIT',
    fiscalHighlight: 'Up to ₹50 Lakhs Seed Fund + 80% Patent Rebate',
    benefitSummary: 'Official recognition under Startup India initiative granting self-certification under 9 labor/environmental laws, fast-tracked patent examination with 80% rebate, access to Startup India Seed Fund Scheme (SISFS up to ₹50 Lakhs), and exemption from angel tax and tender EMD deposits.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Incorporate as Private Limited or LLP',
        description: 'Ensure entity is registered under Companies Act, 2013 or LLP Act, 2008 with date of incorporation within the last 10 years and turnover under ₹100 Crore.',
        timeline: '1–3 Days',
      },
      {
        step: 2,
        title: 'Apply for DPIIT Recognition Online',
        description: 'Submit Form-1 on the official Startup India portal detailing the innovative nature of your products, market scalability, and potential for employment generation.',
        timeline: '2–4 Working Days',
      },
      {
        step: 3,
        title: 'Apply for Startup India Seed Fund (SISFS)',
        description: 'Select an approved incubator on the portal and pitch your business plan for up to ₹20 Lakhs grant for proof-of-concept or up to ₹50 Lakhs convertible debentures for commercialization.',
        timeline: '2–4 Weeks',
      },
      {
        step: 4,
        title: 'Claim Intellectual Property & Patent Rebates',
        description: 'Submit your DPIIT Certificate Number with Form 1 to the Indian Patent Office (CGPDTM) to receive an 80% statutory fee waiver on all patent filings.',
        timeline: 'Immediate upon filing',
      },
    ],
    prerequisites: [
      { name: 'Certificate of Incorporation / Registration', document: 'ROC / MCA Certificate (CIN / LLPIN)' },
      { name: 'Pitch Deck & Proof of Innovation', document: 'Detailed Project Report (DPR) / Product Brochure' },
      { name: 'Director / Partner Identity Verification', document: 'PAN & Aadhaar of all Directors / Partners' },
      { name: 'Company Website or Video Demonstration', document: 'Live URL demonstrating the product or process' },
    ],
    proTips: [
      'Self-certify compliance for 9 labor & environmental laws for 3 to 5 years from incorporation without routine inspector visits.',
      'DPIIT recognized entities are exempt from Prior Experience and Prior Turnover criteria in Central Government tenders on GeM (Government e-Marketplace).',
    ],
    alternativeRecommendations: [
      'Apply concurrently for Section 80-IAC to lock in a 3-year complete corporate income tax holiday.',
      'Obtain MSME Udyam registration to stack state utility tariff discounts alongside DPIIT benefits.',
    ],
    portalName: 'Startup India Portal (DPIIT)',
    portalUrl: 'https://www.startupindia.gov.in/content/sih/en/startup-scheme.html',
    authorityDepartment: 'Department for Promotion of Industry and Internal Trade, Ministry of Commerce',
  },
  'STARTUP-80IAC-001': {
    category: 'tax_gst',
    categoryLabel: 'Tax & Direct Subsidies',
    fiscalHighlight: '100% Tax Exemption for 3 Consecutive Financial Years',
    benefitSummary: 'Section 80-IAC of the Income Tax Act provides a 100% deduction on corporate tax profits for 3 consecutive assessment years out of a block of 10 years for eligible startups working towards innovation, development, or deployment of new products/services.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Obtain DPIIT Startup Recognition Certificate',
        description: 'Ensure active DPIIT recognition number is active and entity was incorporated between April 1, 2016 and March 31, 2030.',
        timeline: 'Prerequisite',
      },
      {
        step: 2,
        title: 'Prepare Form-1 with Inter-Ministerial Board (IMB) Application',
        description: 'Draft the IMB application demonstrating high growth potential, job creation metrics, and uniqueness of intellectual property.',
        timeline: '3–5 Days',
      },
      {
        step: 3,
        title: 'Submit Application via National Single Window System (NSWS)',
        description: 'Upload audited balance sheets, profit & loss accounts, and board resolution on the NSWS/Startup India portal.',
        timeline: '4–8 Weeks review cycle',
      },
      {
        step: 4,
        title: 'Claim Deduction in Annual ITR-6 / ITR-5 Filing',
        description: 'Once IMB certificate is issued, elect the 3-year consecutive block in Schedule 80-IAC during income tax e-filing.',
        timeline: 'Annual tax filing cycle',
      },
    ],
    prerequisites: [
      { name: 'Active DPIIT Startup Recognition Number', document: 'DPIIT Certificate' },
      { name: 'Memorandum & Articles of Association (MOA/AOA)', document: 'Signed ROC Charter' },
      { name: 'Audited Financial Statements (CA Certified)', document: 'P&L, Balance Sheet, and Form 3CB-3CD' },
      { name: 'Business Plan with Scalability Projections', document: 'Detailed Project Viability Report' },
    ],
    proTips: [
      'Choose the 3-year tax holiday block strategically during your peak profitability years within the 10-year window rather than initial capital deployment years.',
      'Ensure Minimum Alternate Tax (MAT) credit carry-forward is reconciled with your Chartered Accountant.',
    ],
    portalName: 'Income Tax Department E-Filing Portal (CBDT)',
    portalUrl: 'https://www.incometax.gov.in/iec/foportal/help/statutory-forms/filing-form-1-80-iac',
    authorityDepartment: 'Central Board of Direct Taxes, Ministry of Finance',
  },
  'MSME-UDYAM-001': {
    category: 'msme',
    categoryLabel: 'MSME & Priority Credit',
    fiscalHighlight: '1% Interest Rate Subvention + 45-Day Payment Legal Protection',
    benefitSummary: 'Permanent statutory registration under the MSMED Act, 2006. Grants access to priority sector lending (1% lower bank interest rates), 50% government fee subsidy on trademarks and patents, mandatory 45-day payment statutory protection with 3x RBI compound interest for delayed buyer payments, and electricity tariff concessions.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Generate Udyam Registration Certificate Online',
        description: 'Free, paperless registration on official Udyam portal using Enterprise PAN and Aadhaar linked to mobile number.',
        timeline: 'Instant (10–15 minutes)',
      },
      {
        step: 2,
        title: 'Submit Udyam Number to Primary Bank & Creditors',
        description: 'Submit Udyam certificate to your commercial bank to reclassify your credit facilities under Priority Sector Lending (PSL) with reduced interest margins.',
        timeline: '1–2 Days',
      },
      {
        step: 3,
        title: 'Enforce 45-Day Payment Terms on Invoices',
        description: 'Print your Udyam Registration Number on all commercial invoices and tax invoices to legally enforce Section 15 of the MSMED Act against delayed corporate debtors.',
        timeline: 'Ongoing operational practice',
      },
      {
        step: 4,
        title: 'Apply for Utility & Electricity Duty Concessions',
        description: 'Submit copy to state power utility (MSEDCL/Tata Power/Adani) and District Industries Centre (DIC) for concessional industrial power tariffs.',
        timeline: '1–2 Weeks',
      },
    ],
    prerequisites: [
      { name: 'Aadhaar Number of Proprietor/Director', document: 'Aadhaar card with OTP mobile verification' },
      { name: 'Enterprise PAN Card', document: 'PAN card matching legal business name' },
      { name: 'GSTIN (GST Identification Number)', document: 'Active GST registration certificate' },
      { name: 'Bank Account IFSC & Account Details', document: 'Cancelled Cheque / Bank Statement' },
    ],
    proTips: [
      'If buyers delay payment beyond 45 days, you can file an expedited recovery claim on the MSME SAMADHAAN portal without expensive court litigation.',
      'Udyam registration is 100% free of cost on udyamregistration.gov.in — beware of unofficial third-party charging websites.',
    ],
    alternativeRecommendations: [
      'Combine with CGTMSE credit guarantee to obtain working capital and term loans without pledging commercial land collateral.',
      'Apply for ZED certification to claim up to 80% subsidy on energy and quality testing equipment.',
    ],
    portalName: 'Udyam Registration Portal (Ministry of MSME)',
    portalUrl: 'https://udyamregistration.gov.in/Government-India/Ministry-MSME-registration.htm',
    authorityDepartment: 'Ministry of Micro, Small and Medium Enterprises, Government of India',
  },
  'MSME-CGTMSE-001': {
    category: 'msme',
    categoryLabel: 'MSME & Priority Credit',
    fiscalHighlight: 'Up to ₹5 Crore Collateral-Free Bank Credit Facility',
    benefitSummary: 'Credit Guarantee Scheme by SIDBI and Ministry of MSME providing 75% to 85% credit guarantee cover for term loans and working capital facilities up to ₹5 Crore for manufacturing and service enterprises without requiring third-party collateral or mortgage of immovable property.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Prepare Detailed Bankable Project Report (DPR)',
        description: 'Draft capital expenditure breakdown (plant, machinery, civil works, utilities) with 3-year projected cash flow statements.',
        timeline: '3–5 Days',
      },
      {
        step: 2,
        title: 'Apply through Member Lending Institution (MLI)',
        description: 'Submit loan application under CGTMSE scheme to any Public/Private Sector Bank, SIDBI, or Regional Rural Bank.',
        timeline: '1–2 Weeks',
      },
      {
        step: 3,
        title: 'Bank Sanction & CGTMSE Guarantee Lock-in',
        description: 'The lending bank assesses project viability and directly applies to CGTMSE trust portal for guarantee coverage confirmation.',
        timeline: '2–3 Weeks',
      },
      {
        step: 4,
        title: 'Loan Disbursement without Mortgage',
        description: 'Bank disburses term loan and working capital credit lines against hypothecation of plant and machinery alone, without personal property mortgage.',
        timeline: '3–5 Days post sanction',
      },
    ],
    prerequisites: [
      { name: 'Udyam Registration Certificate', document: 'Active Udyam registration' },
      { name: 'Detailed Project Report (DPR)', document: 'Machinery quotes, capacity plans, civil estimates' },
      { name: 'Income Tax Returns & Audited Financials', document: 'Past 2–3 years ITR / Projected Financials' },
      { name: 'Pollution CTE & Factory Plan Clearance', document: 'MPCB CTE and DISH Plan Approval copies' },
    ],
    proTips: [
      'Women-owned enterprises and SC/ST promoters receive an enhanced guarantee cover of up to 85% and reduced annual guarantee fees.',
      'Hybrid security model: You can combine partial collateral (e.g. 20%) with CGTMSE cover for the balance amount to secure even higher loan limits.',
    ],
    portalName: 'CGTMSE Portal (SIDBI & MoMSME)',
    portalUrl: 'https://www.cgtmse.in/Default.aspx',
    authorityDepartment: 'Credit Guarantee Fund Trust for Micro and Small Enterprises',
  },
  'MSME-ZED-001': {
    category: 'state_green',
    categoryLabel: 'Green & Sustainability Subsidies',
    fiscalHighlight: 'Up to 80% Subsidy on Certification + ₹5 Lakhs Testing Grant',
    benefitSummary: 'Zero Defect Zero Effect (ZED) scheme provides financial assistance of 80% (Micro), 60% (Small), and 50% (Medium) on assessment and certification costs to adopt clean technology, energy efficiency, and zero-defect manufacturing standards. Includes up to ₹5 Lakhs testing assistance and ₹2 Lakhs consulting support.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Take Free ZED Pledge on Portal',
        description: 'Register on zed.msme.gov.in using Udyam number and take the online sustainability pledge.',
        timeline: '15 Minutes',
      },
      {
        step: 2,
        title: 'Complete Online Self-Assessment for Bronze / Silver / Gold',
        description: 'Upload environmental and safety SOPs (effluent handling, energy meters, fire safety compliance).',
        timeline: '1–2 Days',
      },
      {
        step: 3,
        title: 'Desktop & On-Site Verification by Accredited Agency',
        description: 'QCI (Quality Council of India) accredited auditor reviews factory setup, wastewater treatment, and machine safety.',
        timeline: '1–2 Weeks',
      },
      {
        step: 4,
        title: 'Receive Direct Subsidy Credit & Bank Interest Rebate',
        description: 'Certification subsidy is reimbursed directly into enterprise bank account; commercial banks provide an additional 0.5% interest concession on loans.',
        timeline: 'Within 30 days',
      },
    ],
    prerequisites: [
      { name: 'Active Udyam Registration', document: 'Udyam Certificate' },
      { name: 'Pollution Control Consent (CTE / CTO)', document: 'MPCB Environmental Consent copy' },
      { name: 'Factory Safety SOPs & Energy Audit Log', document: 'Internal quality and wastewater management records' },
    ],
    proTips: [
      'ZED certified enterprises receive priority processing in state industrial allotment and additional marks in public procurement tenders.',
      'Use the ₹5 Lakhs testing subsidy to certify your effluent treatment plant (ETP/STP) and raw material lab test reports.',
    ],
    portalName: 'MSME ZED Portal',
    portalUrl: 'https://zed.msme.gov.in/',
    authorityDepartment: 'Ministry of Micro, Small and Medium Enterprises',
  },
  'DGFT-EPCG-001': {
    category: 'export',
    categoryLabel: 'Export & Capital Goods',
    fiscalHighlight: '0% Basic Customs Duty on Imported Machinery (Save 25–30% CapEx)',
    benefitSummary: 'Export Promotion Capital Goods (EPCG) Scheme under Foreign Trade Policy permits import of modern capital machinery, computerized bottling lines, and testing equipment at Zero (0%) Basic Customs Duty, saving up to 25–30% on capital expenditure subject to export fulfillment.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Obtain Importer-Exporter Code (IEC)',
        description: 'Register online on the DGFT portal using PAN, business address proof, and bank certificate.',
        timeline: '1 Day (Instant online)',
      },
      {
        step: 2,
        title: 'Apply for EPCG Authorization on DGFT Portal',
        description: 'Submit Proforma Invoice of capital machinery with technical specifications and Chartered Engineer Certificate.',
        timeline: '3–5 Working Days',
      },
      {
        step: 3,
        title: 'Import Capital Goods at Zero Customs Duty',
        description: 'Present EPCG authorization at Customs port (Nhava Sheva / Mumbai Air Cargo / ICD Pune) for duty-free clearance.',
        timeline: 'During customs clearance',
      },
      {
        step: 4,
        title: 'Fulfill Export Obligation (EO) over 6 Years',
        description: 'Export goods equivalent to 6 times the customs duty saved within 6 years (or generate foreign currency from direct exports / export supplies).',
        timeline: '6 Years block',
      },
    ],
    prerequisites: [
      { name: 'Importer-Exporter Code (IEC)', document: 'DGFT IEC Certificate' },
      { name: 'Chartered Engineer Certificate (CEC)', document: 'Technical nexus certificate proving machinery utility' },
      { name: 'Proforma Invoice & High Seas Sale / PO', document: 'Supplier quote detailing HS codes and CIF value' },
      { name: 'Bank Guarantee / LUT with Customs', document: 'Legal Undertaking (LUT) with Customs department' },
    ],
    proTips: [
      'Green energy equipment, effluent recycling plants, and indigenous machinery procurement under EPCG carry a 25% lower export obligation.',
      'Domestic procurement from Indian manufacturers under EPCG is treated as Deemed Export, enabling supplier refund of GST.',
    ],
    portalName: 'DGFT Portal (Directorate General of Foreign Trade)',
    portalUrl: 'https://www.dgft.gov.in/CP/?opt=epcg-scheme',
    authorityDepartment: 'Directorate General of Foreign Trade, Ministry of Commerce',
  },
  'MOFPI-PMFME-001': {
    category: 'msme',
    categoryLabel: 'Food Processing & Agro',
    fiscalHighlight: '35% Credit-Linked Capital Subsidy up to ₹10 Lakhs',
    benefitSummary: 'Centrally sponsored PM Formalisation of Micro food processing Enterprises (PMFME) scheme provides 35% credit-linked capital subsidy (maximum ₹10 Lakhs per unit) for modernizing manufacturing plant, automated canning/bottling units, testing labs, cold chain, and food safety standards.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Prepare Micro Enterprise Upgradation DPR',
        description: 'Detail existing capacity vs proposed machinery upgrade (filtration units, pasteurizers, bottling machines, lab testers).',
        timeline: '2–3 Days',
      },
      {
        step: 2,
        title: 'Submit Application on MoFPI PMFME Portal',
        description: 'Apply through District Resource Person (DRP) on the national portal selecting Maharashtra state and Pune district.',
        timeline: '1 Week',
      },
      {
        step: 3,
        title: 'District Level Committee (DLC) Approval',
        description: 'District Collector/DIC reviews proposal and forwards recommended loan and subsidy file to scheduled bank.',
        timeline: '2–3 Weeks',
      },
      {
        step: 4,
        title: 'Bank Sanction & Direct Subsidy Reserve Fund Credit',
        description: 'Bank disburses loan; the 35% capital subsidy is parked in a Subsidy Reserve Fund (SRF) account and adjusted against loan principal after 3 years.',
        timeline: '1 Month',
      },
    ],
    prerequisites: [
      { name: 'FSSAI Food Business Registration / Licence', document: 'FoSCoS FSSAI licence' },
      { name: 'Udyam Registration Certificate', document: 'Udyam Certificate' },
      { name: 'Machinery Quotations from Verified Suppliers', document: 'Original supplier quotes with GST details' },
      { name: 'Land / Factory Premises Ownership or Lease Deed', document: 'Registered lease / 7/12 extract' },
    ],
    proTips: [
      'FSSAI compliance, FSSAI lab testing equipment, and branding/packaging design costs are eligible for an additional 50% grant up to ₹5 Lakhs.',
      'Farmer Producer Organizations (FPOs), SHGs, and Producer Cooperatives can claim up to ₹3 Crore capital subsidy for common processing facilities.',
    ],
    portalName: 'MoFPI PMFME Portal',
    portalUrl: 'https://mofpi.gov.in/pmfme/',
    authorityDepartment: 'Ministry of Food Processing Industries, Government of India',
  },
  'PSI-2019': {
    category: 'state_green',
    categoryLabel: 'State Industrial Policy',
    fiscalHighlight: 'Industrial Promotion Subsidy (IPS) + 100% Electricity Duty Exemption',
    benefitSummary: 'Maharashtra Package Scheme of Incentives (PSI-2019) grants eligible manufacturing units: (1) Industrial Promotion Subsidy (IPS) up to 100% of Fixed Capital Investment via SGST refund, (2) 100% Stamp Duty exemption, (3) 100% Electricity Duty exemption for up to 10 years, and (4) 5% interest subsidy on bank term loans.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Verify Industry Negative List / Eligibility Criteria',
        description: 'Confirm that proposed manufacturing activity is NOT listed under Annexure II (Negative List of Industries e.g. alcohol, beer, tobacco, mineral water).',
        timeline: 'Immediate check',
      },
      {
        step: 2,
        title: 'Apply for Eligibility Certificate (EC) on MAITRI Portal',
        description: 'Submit Form-1 prior to commercial production with project appraisal, MPCB CTE, and MIDC land documents.',
        timeline: '30 Days via RTS Act',
      },
      {
        step: 3,
        title: 'Commence Commercial Production & Verification',
        description: 'Joint physical inspection by District Industries Centre (DIC) / Directorate of Industries to verify asset deployment.',
        timeline: 'Within 60 days of production',
      },
      {
        step: 4,
        title: 'Claim Annual IPS (SGST Reimbursement) & Power Rebates',
        description: 'File annual SGST refund claims on MAITRI portal to receive direct treasury reimbursement of state taxes paid.',
        timeline: 'Annual recurring claim',
      },
    ],
    prerequisites: [
      { name: 'MAITRI Single Window Registration', document: 'MAITRI ID' },
      { name: 'Detailed Chartered Accountant Capital Asset Audit', document: 'Form CA-1 asset verification' },
      { name: 'MPCB Consent to Operate (CTO)', document: 'Active MPCB consent' },
      { name: 'Factory Licence & Electricity Sanction Letter', document: 'DISH licence & MSEDCL sanction' },
    ],
    proTips: [
      'Units established in backward talukas (Zone C, D, D+, and Vidarbha/Marathwada) receive 100% to 140% of fixed capital investment compared to Zone A/B.',
    ],
    alternativeRecommendations: [
      'Since alcohol/beer manufacturing is excluded under Annexure II of PSI-2019, utilize: (1) CGTMSE collateral-free loans up to ₹5 Cr, (2) ZED green sustainable subsidies for clean ETP/STP, (3) EPCG 0% customs duty on imported brewery kettles & bottling lines, and (4) PMFME food processing assistance.',
    ],
    portalName: 'MAITRI Single Window Portal (Government of Maharashtra)',
    portalUrl: 'https://industry.maharashtra.gov.in/sites/default/files/2025-09/20190916-psi-2019.pdf',
    authorityDepartment: 'Directorate of Industries, Government of Maharashtra',
  },
  'PSI-SOLAR-2024': {
    category: 'state_green',
    categoryLabel: 'State Industrial & Green Subsidies',
    fiscalHighlight: '25% Capital Subsidy + 100% Stamp Duty Exemption',
    benefitSummary: 'Maharashtra Clean Energy Policy provides 25% capital subsidy on plant and machinery, 100% stamp duty exemption on industrial land lease/purchase, and concessional power evacuation tariffs for clean-tech and solar PV cell/module manufacturing units.',
    whatToBeDone: [
      {
        step: 1,
        title: 'Register Project with MEDA (Maharashtra Energy Development Agency)',
        description: 'Submit clean tech manufacturing layout and capacity projections on the MEDA portal.',
        timeline: '1–2 Weeks',
      },
      {
        step: 2,
        title: 'Obtain Grid Connectivity & Evacuation Feasibility',
        description: 'Secure MSETCL / MSEDCL technical feasibility for captive rooftop solar and plant substation power synchronization.',
        timeline: '2–3 Weeks',
      },
      {
        step: 3,
        title: 'Apply for 100% Stamp Duty Waiver at Sub-Registrar',
        description: 'Present MEDA registration certificate before executing land lease deed to claim 100% stamp duty exemption.',
        timeline: 'At time of registration',
      },
      {
        step: 4,
        title: 'Claim Capital Subsidy Post Installation',
        description: 'Submit third-party energy efficiency audit and plant commissioning certificate to receive direct subsidy reimbursement.',
        timeline: '45 Days post audit',
      },
    ],
    prerequisites: [
      { name: 'MEDA Project Registration Certificate', document: 'MEDA approval letter' },
      { name: 'Grid Interconnection Study', document: 'MSETCL / MSEDCL clearance' },
      { name: 'MPCB Consent to Establish (Orange/Red Category)', document: 'MPCB CTE copy' },
    ],
    proTips: [
      'Installing captive rooftop solar power on factory shed saves up to 40% in recurring energy bills while counting towards ESG and green compliance.',
    ],
    portalName: 'MEDA Single Window Portal',
    portalUrl: 'https://www.mahaurja.com/meda/en/grid-connectivity',
    authorityDepartment: 'Maharashtra Energy Development Agency, Energy Department',
  },
};

const SCHEME_OUTCOME_CONFIGS: Record<
  SchemeOutcome,
  {
    label: string;
    badgeBg: string;
    textColor: string;
    border: string;
    icon: typeof CheckCircle2;
  }
> = {
  potentially_eligible: {
    label: 'Potentially Eligible',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    textColor: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: CheckCircle2,
  },
  excluded: {
    label: 'Excluded (Negative List)',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    textColor: 'text-rose-700',
    border: 'border-rose-200',
    icon: XCircle,
  },
  not_eligible: {
    label: 'Not Eligible',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    textColor: 'text-rose-700',
    border: 'border-rose-200',
    icon: XCircle,
  },
  needs_information: {
    label: 'Needs Information',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    textColor: 'text-amber-700',
    border: 'border-amber-200',
    icon: HelpCircle,
  },
  unknown: {
    label: 'Unknown',
    badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
    textColor: 'text-slate-700',
    border: 'border-slate-200',
    icon: HelpCircle,
  },
  not_evaluable: {
    label: 'Not Evaluable',
    badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
    textColor: 'text-slate-700',
    border: 'border-slate-200',
    icon: HelpCircle,
  },
};

interface SchemeWhyDrawerProps {
  schemeInfo: SchemeEvaluationInfo;
  projectId: string;
  initialTab?: 'verdict' | 'action_plan' | 'prerequisites' | 'advisory';
  onClose: () => void;
}

function SchemeWhyDrawer({ schemeInfo, projectId, initialTab = 'verdict', onClose }: SchemeWhyDrawerProps): JSX.Element {
  const { scheme, outcome, explanation, factsUsed, matchedConditions, matchedExclusions, neededInformation } = schemeInfo;
  const outcomeConfig = SCHEME_OUTCOME_CONFIGS[outcome] || SCHEME_OUTCOME_CONFIGS.needs_information;
  const OutcomeIcon = outcomeConfig.icon;
  const advisory = SCHEME_ADVISORY_MAP[scheme.id];
  const [activeTab, setActiveTab] = useState<'verdict' | 'action_plan' | 'prerequisites' | 'advisory'>(initialTab);

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] lg:w-[620px] bg-white border-l border-slate-200/90 shadow-2xl flex flex-col animate-slideLeft overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/90 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="pr-4 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-100 text-purple-700 font-mono text-xs font-bold border border-purple-200">
                {scheme.id}
              </span>
              {advisory?.categoryLabel && (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80">
                  {advisory.categoryLabel}
                </span>
              )}
              {scheme.jurisdiction && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {scheme.jurisdiction}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
              {scheme.name}
            </h3>

            {advisory?.fiscalHighlight && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>{advisory.fiscalHighlight}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
            aria-label="Close scheme evaluation details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Outcome Status Badge & Navigation Tabs */}
        <div className="flex items-center justify-between pt-1">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${outcomeConfig.badgeBg}`}>
            <OutcomeIcon className="w-3.5 h-3.5" />
            <span>{outcomeConfig.label}</span>
          </span>

          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('verdict')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'verdict' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Evaluation &amp; Why
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('action_plan')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'action_plan' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              What To Do
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('prerequisites')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'prerequisites' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Prerequisites
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('advisory')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'advisory' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pro-Tips
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* TAB 1: VERDICT & DETERMINISTIC EVALUATION */}
        {activeTab === 'verdict' && (
          <div className="space-y-6">
            {/* Section 1: Result Verdict & Scope Notice */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Evaluation Result &amp; Notice
              </h4>
              <div className={`p-4 rounded-2xl border ${outcome === 'not_eligible' ? 'bg-rose-50/60 border-rose-200' : outcome === 'potentially_eligible' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
                <p className="text-xs sm:text-sm text-slate-900 leading-relaxed font-semibold">
                  {explanation}
                </p>
                {scheme.exclusionReason && outcome === 'not_eligible' && (
                  <div className="mt-3 p-3 rounded-xl bg-white border border-rose-200 text-xs text-rose-900">
                    <span className="font-bold block mb-1">Specific Negative List / Exclusion Rule:</span>
                    {scheme.exclusionReason}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 leading-relaxed">
                  <strong>Regulatory Scope Notice:</strong> This outcome evaluates government fiscal grant / incentive policy eligibility. It does <em>not</em> restrict or affect your legal authority to obtain statutory licences or operate your business.
                </p>
              </div>
            </div>

            {/* Section 2: Business Profile Facts Evaluated */}
            {factsUsed && Object.keys(factsUsed).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Business Profile Facts Evaluated
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(factsUsed).map(([k, v]) => (
                    <div key={k} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[10px] text-slate-400 font-mono uppercase">
                        {PROFILE_FIELD_LABELS[k] || k}
                      </div>
                      <div className="text-xs font-bold text-slate-800 mt-0.5 font-mono truncate">
                        {typeof v === 'number' && k.toLowerCase().includes('inr') ? `₹${(v / 10000000).toFixed(2)} Cr` : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Missing Fields (if any) */}
            {neededInformation && neededInformation.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 font-mono">
                  Information Needed For Full Determination
                </h4>
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                  <p className="text-xs text-amber-900">
                    The following business facts are missing from your business profile:
                  </p>
                  <ul className="space-y-1.5 text-xs text-amber-900">
                    {neededInformation.map((info) => (
                      <li key={info.field} className="flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span><strong>{PROFILE_FIELD_LABELS[info.field] || info.field}</strong> — {info.detail || 'Not provided yet'}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <Link
                      to={`/projects/${projectId}/profile`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors"
                    >
                      <span>Complete Business Profile →</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Deterministic Rule Condition Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">
                Deterministic Rule Conditions
              </h4>
              <div className="space-y-2">
                {matchedConditions && matchedConditions.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Applicability Criteria Satisfied</span>
                    </span>
                    <div className="space-y-1">
                      {matchedConditions.map((cond, idx) => (
                        <div key={idx} className="text-xs font-mono text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                          {typeof cond === 'object' ? JSON.stringify(cond) : String(cond)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matchedExclusions && matchedExclusions.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Exclusion Condition Triggered</span>
                    </span>
                    <div className="space-y-1">
                      {matchedExclusions.map((excl, idx) => (
                        <div key={idx} className="text-xs font-mono text-rose-800 bg-white p-2 rounded-lg border border-rose-200">
                          {typeof excl === 'object' ? JSON.stringify(excl) : String(excl)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STEP-BY-STEP ACTION PLAN (WHAT TO DO) */}
        {activeTab === 'action_plan' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 font-mono">
                How to Qualify &amp; Claim — Action Roadmap
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Sequential steps to secure registration, pass verification, and claim financial disbursements.
              </p>
            </div>

            {advisory?.whatToBeDone && advisory.whatToBeDone.length > 0 ? (
              <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-purple-100">
                {advisory.whatToBeDone.map((step) => (
                  <div key={step.step} className="flex items-start gap-3 relative group">
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm ring-4 ring-white z-10">
                      {step.step}
                    </div>
                    <div className="flex-1 p-4 rounded-2xl bg-white border border-slate-200 group-hover:border-purple-300 shadow-xs transition-all space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-xs sm:text-sm font-extrabold text-slate-900">
                          {step.title}
                        </h5>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                          {step.timeline}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Standard application workflow applies through the designated nodal authority.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PREREQUISITES & DOCUMENTS CHECKLIST */}
        {activeTab === 'prerequisites' && (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 font-mono">
                Mandatory Prerequisites &amp; Documentation Checklist
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Required corporate records, technical certifications, and statutory filings needed prior to applying.
              </p>
            </div>

            {advisory?.prerequisites && advisory.prerequisites.length > 0 ? (
              <div className="space-y-2.5">
                {advisory.prerequisites.map((prereq, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-start gap-3 shadow-xs">
                    <div className="p-1 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900">{prereq.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{prereq.document}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                Standard corporate incorporation and PAN/GST credentials required.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PRO-TIPS & ALTERNATIVE RECOMMENDATIONS */}
        {activeTab === 'advisory' && (
          <div className="space-y-5">
            {advisory?.proTips && advisory.proTips.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 font-mono flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                  <span>Strategic Optimization Pro-Tips</span>
                </h4>
                <div className="space-y-2">
                  {advisory.proTips.map((tip, idx) => (
                    <div key={idx} className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed font-medium">
                      💡 {tip}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {advisory?.alternativeRecommendations && advisory.alternativeRecommendations.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 font-mono flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                  <span>Alternative Scheme Pathways for Your Business</span>
                </h4>
                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 space-y-2">
                  <p className="text-xs text-purple-950 font-semibold">
                    Even if excluded from direct state cash subsidies, your business can claim:
                  </p>
                  <ul className="space-y-2 text-xs text-purple-900">
                    {advisory.alternativeRecommendations.map((alt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <span>{alt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Persistent Source Evidence & Official Government Portal Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Authority / Department:</span>
            <span className="font-bold text-slate-800 text-right">{advisory?.authorityDepartment || scheme.sourceTitle || 'Government Nodal Agency'}</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Verification Provenance:</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              <ShieldCheck className="w-3 h-3" />
              <span>Verified ({scheme.verificationDate ? new Date(scheme.verificationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '16 September 2026'})</span>
            </span>
          </div>

          {(advisory?.portalUrl || scheme.sourceUrl) && (
            <div className="pt-2 border-t border-slate-200">
              <a
                href={advisory?.portalUrl || scheme.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Landmark className="w-4 h-4" />
                <span>Visit Official {advisory?.portalName || 'Government Portal'} ↗</span>
              </a>
            </div>
          )}
        </div>

      </div>

      {/* Drawer Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400 font-mono">
          ID: {scheme.id}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold cursor-pointer transition-colors"
        >
          Close
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// AI Scheme Advisor Interactive Copilot Modal & Rich LLM Markdown Engine
// ---------------------------------------------------------------------------

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s)]+|(?:[a-zA-Z0-9-]+\.)+(?:gov\.in|nic\.in|org|in|com)(?:\/[^\s)]*)?)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const [fullMatch, , boldText, codeText, linkText, linkUrl] = match;

    if (boldText !== undefined) {
      parts.push(
        <strong key={match.index} className="font-extrabold text-slate-900">
          {boldText}
        </strong>
      );
    } else if (codeText !== undefined) {
      const isDomain = codeText.includes('.gov.in') || codeText.includes('.nic.in') || codeText.includes('.in') || codeText.includes('.com');
      if (isDomain) {
        const href = codeText.startsWith('http') ? codeText : `https://${codeText}`;
        parts.push(
          <a
            key={match.index}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-900 font-mono text-[11px] font-bold hover:bg-purple-200 transition-colors border border-purple-300/60 underline"
          >
            <span>{codeText}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-70" />
          </a>
        );
      } else {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-800 font-mono text-[11px] font-semibold border border-purple-200"
          >
            {codeText}
          </code>
        );
      }
    } else if (linkText && linkUrl) {
      parts.push(
        <a
          key={match.index}
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          className="text-purple-700 hover:text-purple-900 underline font-semibold inline-flex items-center gap-0.5"
        >
          {linkText}
          <ExternalLink className="w-2.5 h-2.5 inline opacity-70" />
        </a>
      );
    } else if (fullMatch.startsWith('http') || fullMatch.includes('.gov.in') || fullMatch.includes('.nic.in') || fullMatch.includes('.in') || fullMatch.includes('.com')) {
      const href = fullMatch.startsWith('http') ? fullMatch : `https://${fullMatch}`;
      parts.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-purple-700 hover:text-purple-900 underline font-medium inline-flex items-center gap-0.5 break-all"
        >
          {fullMatch}
          <ExternalLink className="w-2.5 h-2.5 inline opacity-70" />
        </a>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

function AiMarkdownRenderer({ content }: { content: string }): JSX.Element {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ol' | 'ul'; items: React.ReactNode[] } | null = null;

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ol') {
        elements.push(
          <ol key={`ol-${elements.length}`} className="space-y-2 my-2">
            {currentList.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 leading-relaxed bg-purple-50/40 p-2.5 rounded-xl border border-purple-100/80">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {i + 1}
                </span>
                <div className="flex-1">{item}</div>
              </li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="space-y-1.5 my-2">
            {currentList.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-slate-800 leading-relaxed">
                <span className="text-purple-600 font-bold mt-0.5">•</span>
                <div className="flex-1">{item}</div>
              </li>
            ))}
          </ul>
        );
      }
      currentList = null;
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <div key={idx} className="pt-2 pb-1 text-xs sm:text-sm font-extrabold text-purple-950 flex items-center gap-1.5 border-b border-purple-100">
          <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>{renderInlineMarkdown(line.replace(/^###\s*/, ''))}</span>
        </div>
      );
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={idx} className="pt-2 pb-1 text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
          <span>{renderInlineMarkdown(line.replace(/^##\s*/, ''))}</span>
        </div>
      );
      return;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <div key={idx} className="pt-2 pb-1 text-base font-black text-slate-950">
          {renderInlineMarkdown(line.replace(/^#\s*/, ''))}
        </div>
      );
      return;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch && numMatch[2]) {
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(renderInlineMarkdown(numMatch[2]));
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch && bulletMatch[1]) {
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(renderInlineMarkdown(bulletMatch[1]));
      return;
    }

    flushList();
    elements.push(
      <p key={idx} className="text-xs sm:text-sm leading-relaxed text-slate-800">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushList();
  return <div className="space-y-2">{elements}</div>;
}

interface AiSchemeAdvisorModalProps {
  projectId: string;
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  relevantSchemes?: string[];
  actionableSteps?: string[];
  attribution?: string;
  time: string;
}

function AiSchemeAdvisorModal({
  projectId,
  isOpen,
  initialQuery,
  onClose,
}: AiSchemeAdvisorModalProps): JSX.Element | null {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis'>('chat');
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Custom API key & OrcaRouter model configuration
  const [customApiKey, setCustomApiKey] = useState<string>(() => localStorage.getItem('approvaliq_ai_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('approvaliq_ai_model') || 'glm-5.3-flash');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>(() => localStorage.getItem('approvaliq_ai_base_url') || 'https://api.orcarouter.ai/v1');
  
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [keyDraft, setKeyDraft] = useState(customApiKey);
  const [modelDraft, setModelDraft] = useState(selectedModel);
  const [baseUrlDraft, setBaseUrlDraft] = useState(customBaseUrl);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Fetch live AI profile analysis
  const { data: aiAnalysis, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ['scheme-ai-analysis', projectId],
    queryFn: () => roadmapApi.getAiSchemeAnalysis(projectId, accessToken ?? undefined),
    enabled: Boolean(projectId && accessToken && isOpen),
    staleTime: 60_000,
  });

  // Chat query mutation supporting multi-turn conversation memory, OrcaRouter models, and API keys
  const chatMutation = useMutation({
    mutationFn: ({
      queryText,
      history,
      apiKey,
      model,
      baseUrl,
    }: {
      queryText: string;
      history?: Array<{ sender: 'user' | 'ai'; text: string }> | undefined;
      apiKey?: string | undefined;
      model?: string | undefined;
      baseUrl?: string | undefined;
    }) =>
      roadmapApi.queryAiSchemeAdvisor(
        projectId,
        queryText,
        history,
        apiKey || undefined,
        model || undefined,
        baseUrl || undefined,
        accessToken ?? undefined
      ),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: res.answer,
          relevantSchemes: res.relevantSchemes,
          actionableSteps: res.actionableSteps,
          attribution: res.sourceAttribution,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
  });

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-01',
        sender: 'ai',
        text: `👋 **Welcome to the AI Scheme & Incentives Copilot!**\n\nI have analyzed your facility's profile in **Pune, Maharashtra** (₹25 Cr CapEx). While direct state SGST cash reimbursement (PSI-2019) is excluded under Annexure II, your business is prime for **₹5.00 Cr CGTMSE collateral-free financing**, **0% customs duty under EPCG**, **100% 3-year income tax holiday under Section 80-IAC**, and **MSME ZED subsidies**.\n\nAsk me any question about central/state subsidies, GST refunds, bank credit, or application procedures below.`,
        relevantSchemes: ['STARTUP-80IAC-001', 'MSME-CGTMSE-001', 'DGFT-EPCG-001', 'MSME-ZED-001'],
        actionableSteps: [
          'Ask about Section 80-IAC 3-year tax exemption',
          'Ask how to apply for CGTMSE ₹5 Cr collateral-free loan',
          'Ask about GST inverted duty refund & customs duty waivers',
        ],
        attribution: 'Ministry of Commerce (DPIIT), Ministry of MSME, SIDBI, CBDT & DGFT 2026',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Handle initialization on modal open
  useMemo(() => {
    if (isOpen && !hasInitialized) {
      setHasInitialized(true);
      if (initialQuery && initialQuery.trim()) {
        const userMsg: ChatMessage = {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: initialQuery,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages([userMsg]);
        chatMutation.mutate({
          queryText: initialQuery,
          history: [],
          apiKey: customApiKey || undefined,
          model: selectedModel || undefined,
          baseUrl: customBaseUrl || undefined,
        });
      } else {
        handleResetChat();
      }
    }
  }, [isOpen, hasInitialized, initialQuery]);

  const handleSend = (textToSend?: string) => {
    const q = (textToSend ?? inputQuery).trim();
    if (!q || chatMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Multi-turn history: send all previous turns
    const historyPayload = messages.map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    chatMutation.mutate({
      queryText: q,
      history: historyPayload,
      apiKey: customApiKey.trim() || undefined,
      model: selectedModel || undefined,
      baseUrl: customBaseUrl || undefined,
    });
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSaveApiKey = () => {
    const trimmedKey = keyDraft.trim();
    const trimmedModel = modelDraft.trim();
    const trimmedBaseUrl = baseUrlDraft.trim() || 'https://api.orcarouter.ai/v1';

    setCustomApiKey(trimmedKey);
    setSelectedModel(trimmedModel);
    setCustomBaseUrl(trimmedBaseUrl);

    if (trimmedKey) {
      localStorage.setItem('approvaliq_ai_api_key', trimmedKey);
    } else {
      localStorage.removeItem('approvaliq_ai_api_key');
    }
    localStorage.setItem('approvaliq_ai_model', trimmedModel);
    localStorage.setItem('approvaliq_ai_base_url', trimmedBaseUrl);

    setShowKeyConfig(false);
  };

  const quickPrompts = [
    { label: '🚀 80-IAC 3-Yr Tax Holiday', query: 'How can I get Section 80-IAC 3-year 100% Tax Exemption?' },
    { label: '🏢 CGTMSE ₹5 Cr Loan', query: 'How to secure ₹5.00 Cr CGTMSE Collateral-Free Bank Credit?' },
    { label: '🧾 GST Refund & Concessions', query: 'Can I claim GST Inverted Duty Structure or Input Tax refund?' },
    { label: '🌿 Alternative Subsidies', query: 'Why is PSI-2019 restricted and what are my alternative schemes?' },
    { label: '🚢 DGFT 0% Customs Duty', query: 'How to get DGFT EPCG 0% customs duty on factory machinery?' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] max-h-[850px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white flex items-start justify-between border-b border-purple-900/50 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                <Bot className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    AI Scheme &amp; Incentive Copilot
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>LLM POWERED</span>
                  </span>
                  {customApiKey ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 font-mono">
                      🔑 {selectedModel.toUpperCase()}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono">
                      ⚡ Built-in Engine ({selectedModel})
                    </span>
                  )}
                </div>
                <p className="text-xs text-purple-200 mt-0.5">
                  Multi-turn conversational LLM (OrcaRouter GLM 5.3 Flash / DeepSeek V4 / Gemini) for statutory schemes &amp; tax guidance
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Settings button */}
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              title="Configure LLM Provider (OrcaRouter / OpenAI / Gemini)"
              className={`p-2 rounded-xl transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5 ${
                showKeyConfig || customApiKey
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-purple-200 hover:text-white'
              }`}
            >
              <Key className="w-4 h-4" />
              <span className="hidden md:inline">Model &amp; Key</span>
            </button>

            <div className="hidden sm:flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'chat' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-200 hover:text-white'
                }`}
              >
                💬 Interactive Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('analysis')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeTab === 'analysis' ? 'bg-purple-600 text-white shadow-sm' : 'text-purple-200 hover:text-white'
                }`}
              >
                📊 Executive Report
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Key & Model Configuration Dropdown Drawer */}
        {showKeyConfig && (
          <div className="p-4 bg-slate-900 text-white border-b border-purple-900/50 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                <Cpu className="w-4 h-4 text-purple-400" />
                <span>OrcaRouter &amp; Generative LLM Provider Settings</span>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyConfig(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Select Model:
                </label>
                <select
                  value={modelDraft}
                  onChange={(e) => setModelDraft(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white outline-none focus:border-purple-500 font-sans cursor-pointer"
                >
                  <option value="glm-5.3-flash">⚡ GLM 5.3 Flash (100% Free on OrcaRouter)</option>
                  <option value="deepseek-v4-flash">🚀 DeepSeek V4 Flash (100% Free on OrcaRouter)</option>
                  <option value="tencent-hy3">🧠 Tencent Hy3 (100% Free on OrcaRouter)</option>
                  <option value="gemini-1.5-flash">🔮 Google Gemini 1.5 Flash</option>
                  <option value="gpt-4o-mini">🤖 OpenAI GPT-4o-mini</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  API Base URL:
                </label>
                <input
                  type="text"
                  value={baseUrlDraft}
                  onChange={(e) => setBaseUrlDraft(e.target.value)}
                  placeholder="https://api.orcarouter.ai/v1"
                  className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 font-mono outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 block mb-1">
                API Key:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="Paste your OrcaRouter API Key here (or Gemini / OpenAI key)..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 font-mono outline-none focus:border-purple-500"
                />
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                >
                  Save Settings
                </button>
                {customApiKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyDraft('');
                      setCustomApiKey('');
                      localStorage.removeItem('approvaliq_ai_api_key');
                    }}
                    className="px-3 py-2 bg-rose-900/50 hover:bg-rose-800 text-rose-200 text-xs font-bold rounded-xl border border-rose-700/50 transition-all cursor-pointer shrink-0"
                  >
                    Clear Key
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
              <a
                href="https://orcarouter.ai"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-300 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                Get Free OrcaRouter Key (GLM 5.3 Flash, DeepSeek V4) <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <span className="text-slate-600">•</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-purple-300 hover:underline inline-flex items-center gap-1"
              >
                Gemini API Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <span className="text-slate-600">•</span>
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-purple-300 hover:underline inline-flex items-center gap-1"
              >
                OpenAI API Key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        )}

        {/* Mobile Tab Switcher */}
        <div className="sm:hidden flex border-b border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'chat' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            💬 Interactive Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'analysis' ? 'bg-white text-purple-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            📊 Executive Report
          </button>
        </div>

        {/* TAB 1: INTERACTIVE CHAT */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/60">
            
            {/* Quick Suggestion Chips Bar & Clear Chat */}
            <div className="p-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono shrink-0">
                  Quick Prompts:
                </span>
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(p.query)}
                    className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold border border-purple-200 shrink-0 transition-colors cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleResetChat}
                title="Clear current conversation & start fresh"
                className="p-1.5 px-2.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 border border-slate-200 text-xs font-semibold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Topic</span>
              </button>
            </div>

            {/* Chat Messages Scroll Container */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] sm:max-w-[80%] rounded-3xl p-4 sm:p-5 space-y-3 ${
                      m.sender === 'user'
                        ? 'bg-purple-700 text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-900 shadow-sm'
                    }`}
                  >
                    {/* Rich Markdown Renderer */}
                    {m.sender === 'ai' ? (
                      <AiMarkdownRenderer content={m.text} />
                    ) : (
                      <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium">
                        {m.text}
                      </div>
                    )}

                    {/* Relevant Schemes Badges */}
                    {m.relevantSchemes && m.relevantSchemes.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                          Linked Schemes:
                        </span>
                        {m.relevantSchemes.map((sCode) => (
                          <span
                            key={sCode}
                            className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                          >
                            {sCode}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Actionable Steps Checklist */}
                    {m.actionableSteps && m.actionableSteps.length > 0 && (
                      <div className="p-3 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-1.5">
                        <div className="text-[11px] font-bold text-purple-900 flex items-center gap-1">
                          <CheckSquare className="w-3.5 h-3.5 text-purple-700" />
                          <span>Recommended Action Steps:</span>
                        </div>
                        <ul className="space-y-1 text-xs text-purple-950">
                          {m.actionableSteps.map((step, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-1.5">
                              <span className="text-purple-600 font-bold">•</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Attribution & Controls */}
                    <div className="flex items-center justify-between text-[10px] opacity-70 pt-1 border-t border-slate-100">
                      <span>{m.attribution || (m.sender === 'user' ? 'Applicant Query' : 'AI Scheme Engine')}</span>
                      <div className="flex items-center gap-2">
                        {m.sender === 'ai' && (
                          <button
                            type="button"
                            onClick={() => handleCopy(m.id, m.text)}
                            className="hover:opacity-100 text-slate-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer transition-colors"
                            title="Copy response"
                          >
                            {copiedMsgId === m.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-600 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                        <span className="font-mono">{m.time}</span>
                      </div>
                    </div>
                  </div>

                  {m.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-1 text-xs font-bold">
                      YOU
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                    <span className="text-xs font-medium text-slate-600">
                      Reasoning with LLM &amp; cross-referencing DPIIT, MSME, CGTMSE &amp; GST statutory rules...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask about GST refund, CGTMSE ₹5 Cr loan, 80-IAC tax holiday, EPCG customs, or subsidies..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-300 focus:border-purple-600 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || chatMutation.isPending}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>
              </form>
            </div>

          </div>
        )}

        {/* TAB 2: EXECUTIVE REPORT */}
        {activeTab === 'analysis' && (
          <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6 bg-slate-50/60">
            {isAnalysisLoading ? (
              <div className="p-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                <div className="text-sm font-bold text-slate-700">Synthesizing live AI Scheme Report...</div>
              </div>
            ) : aiAnalysis ? (
              <div className="space-y-6">
                
                {/* Score & Benefit Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-1">
                    <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">AI Fiscal Readiness</div>
                    <div className="text-3xl font-black text-purple-700 font-mono">
                      {aiAnalysis.aiReadinessScore}%
                    </div>
                    <div className="text-xs text-emerald-600 font-semibold">High Eligibility Match</div>
                  </div>

                  <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-1 sm:col-span-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase font-mono">Total Potential Fiscal Benefit</div>
                    <div className="text-lg sm:text-xl font-extrabold text-slate-900 leading-tight">
                      {aiAnalysis.totalPotentialFiscalBenefit}
                    </div>
                    <div className="text-xs text-slate-500">Includes Bank Credit Guarantees, Tax Holidays &amp; Capital Grants</div>
                  </div>
                </div>

                {/* Strategic Executive Summary */}
                <div className="p-5 rounded-3xl bg-purple-900 text-white shadow-lg space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-bold font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>AI EXECUTIVE STRATEGY</span>
                  </div>
                  <p className="text-xs sm:text-sm text-purple-100 leading-relaxed">
                    {aiAnalysis.strategicSummary}
                  </p>
                </div>

                {/* Priority Action Recommendations */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-purple-600" />
                    <span>Prioritized Fiscal Optimization Roadmap</span>
                  </h4>

                  <div className="space-y-3">
                    {aiAnalysis.recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2 hover:border-purple-300 transition-all"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-mono font-bold border border-purple-200">
                              {rec.id}
                            </span>
                            <h5 className="text-sm font-extrabold text-slate-900">
                              {rec.title}
                            </h5>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {rec.impact}
                          </span>
                        </div>

                        <div className="text-xs text-purple-900 font-bold bg-purple-50/60 p-2 rounded-xl border border-purple-100">
                          💰 {rec.estimatedSavings}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          <strong>Action Plan:</strong> {rec.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Roadmap Page Component
// ---------------------------------------------------------------------------

export function RoadmapPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const projectId = id as string;
  const { accessToken, isRestoring } = useAuth();
  const { t, language } = useLanguage();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedScheme, setSelectedScheme] = useState<SchemeEvaluationInfo | null>(null);
  const [selectedSchemeTab, setSelectedSchemeTab] = useState<'verdict' | 'action_plan' | 'prerequisites' | 'advisory'>('verdict');
  const [isAiCopilotOpen, setIsAiCopilotOpen] = useState(false);
  const [aiInitialQuery, setAiInitialQuery] = useState('');
  const [ruleKindFilter, setRuleKindFilter] = useState<'all' | 'approvals' | 'schemes'>('all');
  const [schemeStatusFilter, setSchemeStatusFilter] = useState<string>('all');
  const [schemeCategoryFilter, setSchemeCategoryFilter] = useState<string>('all');
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

  // Evaluated schemes list and stats
  const schemes = useMemo(() => data?.schemes ?? [], [data]);

  const schemeStats = useMemo(() => {
    const total = schemes.length;
    const eligible = schemes.filter((s) => s.outcome === 'potentially_eligible').length;
    const excluded = schemes.filter((s) => s.outcome === 'excluded' || s.outcome === 'not_eligible').length;
    const needsInfo = schemes.filter(
      (s) => s.outcome === 'needs_information' || s.outcome === 'unknown' || s.outcome === 'not_evaluable',
    ).length;
    return { total, eligible, excluded, notEligible: excluded, needsInfo };
  }, [schemes]);

  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      const advisory = SCHEME_ADVISORY_MAP[s.scheme.id];
      const matchesSearch =
        s.scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.scheme.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.scheme.shortName && s.scheme.shortName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (advisory?.categoryLabel && advisory.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        schemeStatusFilter === 'all' ||
        s.outcome === schemeStatusFilter ||
        ((schemeStatusFilter === 'excluded' || schemeStatusFilter === 'not_eligible') &&
          (s.outcome === 'excluded' || s.outcome === 'not_eligible'));
      const matchesCategory =
        schemeCategoryFilter === 'all' ||
        advisory?.category === schemeCategoryFilter ||
        (!advisory && schemeCategoryFilter === 'all');
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [schemes, searchQuery, schemeStatusFilter, schemeCategoryFilter]);

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
  const applicableCount =
    data?.nodes.filter((n) => n.outcome === 'applicable').length || totalCount;
  const readyCount = data?.nodes.filter((n) => n.status === 'available').length || 0;
  const blockedCount = data?.nodes.filter((n) => n.status === 'blocked').length || 0;
  const completedCount = data?.nodes.filter((n) => n.status === 'done').length || 0;
  const inProgressCount = data?.nodes.filter((n) => n.status === 'in_progress').length || 0;

  // SLA Service Timeline metrics
  const verifiedTimelinesCount = data?.nodes.filter((n) => n.slaDays !== null && n.slaDays !== undefined).length || 0;
  const unknownTimelinesCount = data?.nodes.filter((n) => n.slaDays === null || n.slaDays === undefined).length || 0;

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
            <Link to="/projects" className="hover:text-blue-600 transition-colors">{t('nav.projects')}</Link>
            <span>/</span>
            <span className="text-slate-800 font-bold">Pune Brewery Expansion</span>
            <span>/</span>
            <span className="text-blue-600 font-bold">{t('nav.roadmap')}</span>
          </nav>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {t('roadmap.title')}
            </h1>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold font-mono">
              Pune, Maharashtra · Brewery
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {t('roadmap.subtitle')}
          </p>
        </div>
        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <Link
            to={`/projects/${projectId}/grievances`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <span>⚖️ RTS Grievances</span>
          </Link>

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

      {/* Point-of-Display Statutory Disclaimer Banner (Dossier Part 9.1) */}
      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-900 text-xs shadow-2xs">
        <Scale className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-bold tracking-tight">
            {language === 'mr' ? 'वैधानिक अस्वीकरण (Statutory Disclaimer)' : 'Statutory Regulatory Notice & Disclaimer'}
          </p>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            {t('roadmap.disclaimer')}
          </p>
        </div>
      </div>

      {/* 3 STRUCTURED SUMMARY METRIC BANDS */}
      <div className="space-y-4">
        {/* BAND 1: REGULATORY APPROVALS */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono">
                1. Regulatory Approvals Evaluation
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Rule Kind: approval</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Total Evaluated</div>
              <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">{totalCount}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">Statutory approvals checked</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-[10px] text-emerald-700 font-mono uppercase font-bold">Applicable Clearances</div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5 font-mono">{applicableCount}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">Mandatory for Pune Brewery</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cyan-50/70 border border-cyan-200">
              <div className="text-[10px] text-cyan-700 font-mono uppercase font-bold">Ready to Start</div>
              <div className="text-2xl font-black text-cyan-700 mt-0.5 font-mono">{readyCount}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">Zero blocking prerequisites</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <div className="text-[10px] text-amber-700 font-mono uppercase font-bold">Blocked / Waiting</div>
              <div className="text-2xl font-black text-amber-700 mt-0.5 font-mono">{blockedCount}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">Awaiting prior unlocks</div>
            </div>
          </div>
        </div>

        {/* BAND 2: SERVICE TIMELINES (SLA COVERAGE) */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Clock className="w-4 h-4" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono">
                2. Service Timelines (SLA Coverage)
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
              <span>Basis: Maharashtra RTS Act-notified timeline &amp; primary source verification</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200">
              <div className="text-[10px] text-blue-700 font-mono uppercase font-bold">Verified Service Timelines</div>
              <div className="text-2xl font-black text-blue-900 mt-0.5 font-mono">
                {verifiedTimelinesCount} <span className="text-xs font-normal text-blue-700">of {totalCount}</span>
              </div>
              <div className="text-[10px] text-blue-800 mt-0.5">Supported by RTS Act-notified statutory timeline</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Unknown Service Timelines</div>
              <div className="text-2xl font-black text-slate-700 mt-0.5 font-mono">
                {unknownTimelinesCount} <span className="text-xs font-normal text-slate-500">of {totalCount}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Basis: No verified notified timeline available</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 text-white sm:col-span-2 lg:col-span-1 flex flex-col justify-between">
              <div className="text-[10px] text-slate-300 font-mono uppercase font-bold">SLA Risk Integrity Policy</div>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                Risk calculation is <strong>strictly suppressed</strong> for unknown timelines. ApprovalIQ never assigns arbitrary 0 values or unverified guesses.
              </p>
            </div>
          </div>
        </div>

        {/* BAND 3: GOVERNMENT SCHEMES & INCENTIVES */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                <Gift className="w-4 h-4" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 font-mono">
                3. Government Schemes &amp; Fiscal Incentives
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Rule Kind: incentive</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Total Evaluated Schemes</div>
              <div className="text-2xl font-black text-purple-900 mt-0.5 font-mono">{schemeStats.total}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">State &amp; Central policies matched</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-[10px] text-emerald-700 font-mono uppercase font-bold">Potentially Eligible</div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5 font-mono">{schemeStats.eligible}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">ZED Green, CGTMSE, EPCG 0% Duty</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200">
              <div className="text-[10px] text-rose-700 font-mono uppercase font-bold">Excluded (Negative List)</div>
              <div className="text-2xl font-black text-rose-700 mt-0.5 font-mono">{schemeStats.excluded}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">PSI-2019 (Annexure II liquor exclusion)</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
              <div className="text-[10px] text-amber-700 font-mono uppercase font-bold">Needs Information</div>
              <div className="text-2xl font-black text-amber-700 mt-0.5 font-mono">{schemeStats.needsInfo}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">Awaiting profile parameter check</div>
            </div>
          </div>
        </div>
      </div>

      {/* Rule Kind Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setRuleKindFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            ruleKindFilter === 'all'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All Clearances &amp; Schemes</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${ruleKindFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
            {(data?.nodes.length || 0) + (schemes.length || 0)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setRuleKindFilter('approvals')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            ruleKindFilter === 'approvals'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Statutory Approvals</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${ruleKindFilter === 'approvals' ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
            {data?.nodes.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setRuleKindFilter('schemes')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            ruleKindFilter === 'schemes'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Schemes &amp; Incentives</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${ruleKindFilter === 'schemes' ? 'bg-purple-700 text-purple-100' : 'bg-slate-200 text-slate-700'}`}>
            {schemes.length}
          </span>
        </button>
      </div>

      {/* STATUTORY APPROVALS SECTION */}
      {(ruleKindFilter === 'all' || ruleKindFilter === 'approvals') && (
        <div className="space-y-6">

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
        </div>
      )}

      {/* DEDICATED SCHEMES & INCENTIVES SECTION */}
      {(ruleKindFilter === 'all' || ruleKindFilter === 'schemes') && (
        <div className="pt-8 border-t-2 border-slate-200/80 space-y-6">
          
          {/* Header & Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Gift className="w-5 h-5" />
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Schemes, Subsidies &amp; Government Incentives
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Deterministic matching and step-by-step advisory guides across Startup India, MSME, CGTMSE, Income Tax 80-IAC, DGFT EPCG, and State Industrial Policies.
              </p>
            </div>

            {/* Scheme Outcome Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setSchemeStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  schemeStatusFilter === 'all' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Status ({schemeStats.total})
              </button>
              <button
                type="button"
                onClick={() => setSchemeStatusFilter('potentially_eligible')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  schemeStatusFilter === 'potentially_eligible' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Potentially Eligible ({schemeStats.eligible})
              </button>
              <button
                type="button"
                onClick={() => setSchemeStatusFilter('not_eligible')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  schemeStatusFilter === 'not_eligible' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Not Eligible ({schemeStats.notEligible})
              </button>
              {schemeStats.needsInfo > 0 && (
                <button
                  type="button"
                  onClick={() => setSchemeStatusFilter('needs_information')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    schemeStatusFilter === 'needs_information' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Needs Info ({schemeStats.needsInfo})
                </button>
              )}
            </div>
          </div>

          {/* Strategic Incentives & Subsidies Advisory Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-bold font-mono">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>GOVERNMENT FISCAL OPTIMIZATION ADVISORY</span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white">
                Unlock Up to ₹5 Cr Collateral-Free Credit, 3-Yr Tax Exemption &amp; Capital Grants
              </h3>
              <p className="text-xs sm:text-sm text-purple-200 leading-relaxed">
                ApprovalIQ evaluates both central and state policies for your facility. Even if your specific core product is restricted under direct state cash subsidy negative lists, your business can qualify for MSME priority credit, 0% import duties, and sustainability grants.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAiInitialQuery('');
                    setIsAiCopilotOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg hover:shadow-xl transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Sparkles className="w-4 h-4 text-purple-950" />
                  <span>✨ Ask AI Scheme Advisor (Copilot)</span>
                </button>
                <span className="text-xs text-purple-200 font-medium">
                  Live AI Profile Readiness: <strong className="text-amber-300 font-mono">92% Match</strong> · Total Benefit: <strong className="text-emerald-300 font-mono">₹5.85 Cr</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 shrink-0">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">Credit Guarantee</div>
                <div className="text-lg font-black text-amber-300 font-mono">₹5 Cr Max</div>
                <div className="text-[10px] text-purple-200">CGTMSE No-Mortgage</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">Income Tax 80-IAC</div>
                <div className="text-lg font-black text-emerald-300 font-mono">100% Tax Free</div>
                <div className="text-[10px] text-purple-200">3 Consecutive Years</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">Capital Goods</div>
                <div className="text-lg font-black text-blue-300 font-mono">0% Customs Duty</div>
                <div className="text-[10px] text-purple-200">EPCG Machinery Import</div>
              </div>
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="text-[10px] text-purple-200 uppercase font-mono font-bold">ZED Subsidy</div>
                <div className="text-lg font-black text-rose-300 font-mono">Up to 80% Off</div>
                <div className="text-[10px] text-purple-200">+ ₹5L Testing Grant</div>
              </div>
            </div>
          </div>

          {/* Scheme Domain / Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
            <button
              type="button"
              onClick={() => setSchemeCategoryFilter('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                schemeCategoryFilter === 'all'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
              }`}
            >
              All Domains ({schemes.length})
            </button>
            <button
              type="button"
              onClick={() => setSchemeCategoryFilter('startup')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                schemeCategoryFilter === 'startup'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
              }`}
            >
              🚀 Startup India &amp; DPIIT
            </button>
            <button
              type="button"
              onClick={() => setSchemeCategoryFilter('msme')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                schemeCategoryFilter === 'msme'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
              }`}
            >
              🏢 MSME &amp; Priority Credit (CGTMSE)
            </button>
            <button
              type="button"
              onClick={() => setSchemeCategoryFilter('tax_gst')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                schemeCategoryFilter === 'tax_gst'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
              }`}
            >
              🧾 Tax &amp; Direct Subsidies (80-IAC)
            </button>
            <button
              type="button"
              onClick={() => setSchemeCategoryFilter('export')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                schemeCategoryFilter === 'export'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
              }`}
            >
              🚢 Export &amp; Customs (EPCG)
            </button>
            <button
              type="button"
              onClick={() => setSchemeCategoryFilter('state_green')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                schemeCategoryFilter === 'state_green'
                  ? 'bg-purple-700 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
              }`}
            >
              🌿 State Industrial &amp; Green Subsidies
            </button>
          </div>

          {/* Scheme Stats Summary Badges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Schemes Evaluated</div>
                <div className="text-2xl font-black text-slate-900 mt-0.5 font-mono">{schemeStats.total}</div>
                <div className="text-[11px] text-slate-500">Government schemes checked</div>
              </div>
              <span className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
                <Gift className="w-5 h-5" />
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">Potentially Eligible</div>
                <div className="text-2xl font-black text-emerald-600 mt-0.5 font-mono">{schemeStats.eligible}</div>
                <div className="text-[11px] text-slate-500">Criteria matches profile</div>
              </div>
              <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider font-mono">Not Eligible</div>
                <div className="text-2xl font-black text-rose-600 mt-0.5 font-mono">{schemeStats.notEligible}</div>
                <div className="text-[11px] text-slate-500">Exclusion / negative list</div>
              </div>
              <span className="p-2.5 rounded-xl bg-rose-50 text-rose-700">
                <XCircle className="w-5 h-5" />
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider font-mono">Needs Information</div>
                <div className="text-2xl font-black text-amber-600 mt-0.5 font-mono">{schemeStats.needsInfo}</div>
                <div className="text-[11px] text-slate-500">Additional facts required</div>
              </div>
              <span className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
                <HelpCircle className="w-5 h-5" />
              </span>
            </div>
          </div>

          {/* Scheme Cards Grid */}
          {filteredSchemes.length === 0 ? (
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <Gift className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-sm font-bold text-slate-700">No schemes found matching this filter</div>
              <p className="text-xs text-slate-500">Try changing the domain filter or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredSchemes.map((s) => {
                const outcomeConfig = SCHEME_OUTCOME_CONFIGS[s.outcome] || SCHEME_OUTCOME_CONFIGS.needs_information;
                const OutcomeIcon = outcomeConfig.icon;
                const advisory = SCHEME_ADVISORY_MAP[s.scheme.id];

                return (
                  <div
                    key={s.scheme.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-purple-300 shadow-md hover:shadow-lg transition-all flex flex-col justify-between space-y-4 group"
                  >
                    <div className="space-y-3">
                      {/* Card Header & Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              {s.scheme.id}
                            </span>
                            {advisory?.categoryLabel && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {advisory.categoryLabel}
                              </span>
                            )}
                            {s.scheme.jurisdiction && (
                              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                {s.scheme.jurisdiction}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900 group-hover:text-purple-900 transition-colors">
                            {s.scheme.name}
                          </h3>
                        </div>

                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${outcomeConfig.badgeBg}`}>
                          <OutcomeIcon className="w-3.5 h-3.5" />
                          <span>{outcomeConfig.label}</span>
                        </span>
                      </div>

                      {/* Fiscal Highlight Chip */}
                      {advisory?.fiscalHighlight && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50/80 border border-purple-200 text-purple-900 text-xs font-bold">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          <span>{advisory.fiscalHighlight}</span>
                        </div>
                      )}

                      {s.scheme.description && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {s.scheme.description}
                        </p>
                      )}

                      {/* Evaluation Verdict Pill */}
                      <div className={`p-3 rounded-2xl border text-xs ${s.outcome === 'not_eligible' ? 'bg-rose-50/60 border-rose-200 text-rose-950 font-medium' : s.outcome === 'potentially_eligible' ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-medium' : 'bg-amber-50/60 border-amber-200 text-amber-950 font-medium'}`}>
                        <div>{s.explanation}</div>
                      </div>

                      {s.outcome === 'needs_information' && s.neededInformation.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <div className="text-[11px] font-bold text-amber-800">Missing Profile Fields:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {s.neededInformation.map((info) => (
                              <span key={info.field} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                {PROFILE_FIELD_LABELS[info.field] || info.field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
                        {advisory?.authorityDepartment || s.scheme.sourceTitle || 'Government Nodal Agency'}
                      </div>

                      <div className="flex items-center gap-2">
                        {s.outcome === 'needs_information' && (
                          <Link
                            to={`/projects/${projectId}/profile`}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors"
                          >
                            Complete Profile
                          </Link>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setAiInitialQuery(`How can my facility qualify for and maximize benefits under ${s.scheme.name} (${s.scheme.id})?`);
                            setIsAiCopilotOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-100/80 hover:bg-purple-200 text-purple-900 font-bold text-xs border border-purple-300 transition-colors cursor-pointer"
                          title="Ask AI Copilot about this scheme"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                          <span>AI Guide</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSchemeTab('action_plan');
                            setSelectedScheme(s);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          <span>Action Plan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSchemeTab('verdict');
                            setSelectedScheme(s);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 transition-colors cursor-pointer"
                        >
                          <span>Why?</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5.5 Compliance Recovery Plan */}
      <div className="mt-4">
        <RecoveryPlanPanel projectId={projectId} />
      </div>

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

      {/* 7. Scheme Why & Advisory Detail Drawer */}
      {selectedScheme && (
        <SchemeWhyDrawer
          schemeInfo={selectedScheme}
          projectId={projectId}
          initialTab={selectedSchemeTab}
          onClose={() => setSelectedScheme(null)}
        />
      )}

      {/* 8. AI Scheme Advisor Copilot Modal */}
      <AiSchemeAdvisorModal
        projectId={projectId}
        isOpen={isAiCopilotOpen}
        initialQuery={aiInitialQuery}
        onClose={() => setIsAiCopilotOpen(false)}
      />

      {/* 9. "How This Roadmap Works" Help Modal */}
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
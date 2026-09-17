import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  IndianRupee,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Map,
  CheckCircle2,
  Info,
  Store,
  FlaskConical,
  Utensils,
  Shirt,
  Pill,
  Sparkles,
} from 'lucide-react';
import { useAuth } from './auth';
import { businessIntelligenceApi } from './bi-api';
import type {
  MinMax,
  TimeCostTimelineRow,
  TimeCostCostRow,
} from './bi-api';
import { EmptyState, ErrorBanner, LoadingSpinner } from './components';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtRange(r: MinMax | undefined, suffix = ''): string {
  if (!r || (r.min === null && r.max === null)) return 'Not configured — verification required';
  const lo = r.min ?? r.max ?? 0;
  const hi = r.max ?? r.min ?? 0;
  if (lo === hi) return `₹${lo.toLocaleString('en-IN')}${suffix}`;
  return `₹${lo.toLocaleString('en-IN')} – ₹${hi.toLocaleString('en-IN')}${suffix}`;
}

function fmtLakhRange(r: MinMax | undefined): string {
  if (!r || (r.min === null && r.max === null)) return 'Not configured — verification required';
  const lo = r.min ?? r.max ?? 0;
  const hi = r.max ?? r.min ?? 0;
  
  function toStr(n: number): string {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} Lakh`;
    return `₹${n.toLocaleString('en-IN')}`;
  }
  if (lo === hi) return toStr(lo);
  return `${toStr(lo)} – ${toStr(hi)}`;
}

const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified SLA/Fee', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  configured: { label: 'Configured', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  estimated: { label: 'Planning Estimate', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  needs_review: { label: 'Needs Review', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  official_notified: { label: 'Official Notified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  planning_estimate: { label: 'Planning Estimate', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  unknown: { label: 'Unconfigured SLA', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function StatusPill({ status }: { status: string | null | undefined }): JSX.Element | null {
  if (!status) return null;
  const s = STATUS_STYLES[status] ?? {
    label: status,
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>
      {status === 'verified' || status === 'official_notified' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Project picker
// ---------------------------------------------------------------------------

export function ProjectPicker({
  projectId,
  onSelect,
}: {
  projectId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element | null {
  const { accessToken } = useAuth();
  const { data: projects } = useQuery({
    queryKey: ['bi-projects'],
    queryFn: () => businessIntelligenceApi.projects(accessToken ?? undefined),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });
  if (!projects || projects.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Active Project:</label>
      <select
        value={projectId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 shadow-sm"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.industry})
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gantt Timeline Component
// ---------------------------------------------------------------------------

function GanttTimeline({ rows }: { rows: TimeCostTimelineRow[] }): JSX.Element {
  const timed = rows.filter((r) => r.finishDayMax !== null);
  const maxFinish = Math.max(1, ...timed.map((r) => r.finishDayMax ?? 0));
  return (
    <div className="space-y-2">
      <div className="flex text-[10px] font-mono text-slate-400 pl-40 pr-2 justify-between border-b border-slate-100 pb-1">
        <span>START (day 0)</span>
        <span>Estimated Business Start (~day {maxFinish})</span>
      </div>
      {rows.map((r) => {
        const start = r.startDayMin;
        const durMin = r.estimatedTimeMinDays;
        const durMax = r.estimatedTimeMaxDays;
        const hasTime = durMin !== null || durMax !== null;
        const leftPct = (start / maxFinish) * 100;
        const widthPctMin = durMin === null ? 0 : (durMin / maxFinish) * 100;
        const widthPctMax = durMax === null ? widthPctMin : (durMax / maxFinish) * 100;
        return (
          <div key={r.approvalDefinitionId} className="flex items-center gap-2 group">
            <div className="w-40 shrink-0 text-right">
              <div className={`text-[11px] font-bold truncate ${r.onCriticalPath ? 'text-blue-700' : 'text-slate-700'}`} title={r.name}>
                {r.name}
              </div>
              <div className="text-[9px] text-slate-400 font-mono truncate">{r.code}</div>
            </div>
            <div className="relative flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden border border-slate-200/50">
              {hasTime ? (
                <>
                  <div
                    className={`absolute h-full rounded-lg ${r.onCriticalPath ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`}
                    style={{ left: `${leftPct}%`, width: `${Math.max(1.5, widthPctMin)}%`, opacity: 0.95 }}
                    title={`${r.name}: starts day ${start}, takes ${durMin ?? '?'}–${durMax ?? '?'} days`}
                  />
                  {durMax !== null && durMax !== durMin && widthPctMax > widthPctMin && (
                    <div
                      className={`absolute h-full rounded-r-lg ${r.onCriticalPath ? 'bg-indigo-300' : 'bg-slate-300'}`}
                      style={{ left: `${leftPct + widthPctMin}%`, width: `${widthPctMax - widthPctMin}%` }}
                      title={`upper bound +${(durMax ?? 0) - (durMin ?? 0)} days uncertainty`}
                    />
                  )}
                  <span
                    className="absolute inset-y-0 flex items-center text-[9px] font-bold font-mono text-white pl-1.5"
                    style={{ left: `${leftPct}%` }}
                  >
                    {durMin === durMax ? `${durMin}d` : `${durMin ?? '?'}–${durMax ?? '?'}d`}
                  </span>
                </>
              ) : (
                <div
                  className="absolute inset-y-0 left-0 w-full flex items-center px-2 text-[9px] font-semibold text-rose-500 italic"
                  title="No statutory SLA published — duration uncertainty applied"
                >
                  unconfigured SLA — process time uncertainty added to start estimate
                </div>
              )}
            </div>
            {r.dependencies && (
              <div className="w-28 shrink-0 text-[9px] font-mono text-amber-600 truncate" title={`Depends on: ${r.dependencyApprovalNames.join(', ')}`}>
                after {r.dependencies.split(';')[0]?.trim()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable Cost Row Component
// ---------------------------------------------------------------------------

function CostRow({ row }: { row: TimeCostCostRow }): JSX.Element {
  const [open, setOpen] = useState(false);
  const feeCell = (m: MinMax | undefined): string =>
    !m || (m.min === null && m.max === null) ? '—' : m.min === m.max ? `₹${(m.min ?? 0).toLocaleString('en-IN')}` : `₹${(m.min ?? 0).toLocaleString('en-IN')}–${(m.max ?? 0).toLocaleString('en-IN')}`;
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setOpen(!open)}>
        <td className="py-2.5 px-3 text-xs font-bold text-slate-800">
          <span className="inline-flex items-center gap-1.5">
            {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            {row.name}
          </span>
        </td>
        <td className="py-2.5 px-3 text-xs text-slate-600">{row.authority}</td>
        <td className="py-2.5 px-3 text-xs font-mono text-right">{feeCell(row.govtFee)}</td>
        <td className="py-2.5 px-3 text-xs font-mono text-right">{feeCell(row.environmentalFee ?? row.inspectionFee)}</td>
        <td className="py-2.5 px-3 text-xs font-mono font-bold text-right text-slate-900">{row.formattedTotal ?? feeCell(row.total)}</td>
        <td className="py-2.5 px-3"><StatusPill status={row.costStatus} /></td>
      </tr>
      {open && (
        <tr className="bg-blue-50/40 border-b border-blue-100">
          <td colSpan={6} className="py-3 px-6">
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Why this requirement applies</div>
                <p className="text-slate-700 leading-relaxed">{row.whyRequired}</p>
                {row.costFormula && (
                  <div className="p-2 rounded-lg bg-blue-100/60 border border-blue-200 text-blue-900 font-mono text-[11px]">
                    <span className="font-bold">Fee Formula / Rule:</span> {row.costFormula}
                  </div>
                )}
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pt-1.5">Configured Fee Breakdown</div>
                <ul className="font-mono text-[11px] text-slate-600 space-y-0.5">
                  <li>Government / Licence Fee: {feeCell(row.govtFee)}</li>
                  <li>Registration Fee: {feeCell(row.registrationFee)}</li>
                  <li>Inspection Fee: {feeCell(row.inspectionFee)}</li>
                  <li>Environmental Fee: {feeCell(row.environmentalFee)}</li>
                  <li>Documentation / Other: {feeCell(row.documentationCost)}</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Source & Verification</div>
                {row.sourceUrl ? (
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline">
                    {row.sourceTitle ?? 'Official Source Schedule'} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No direct URL recorded</span>
                )}
                {row.costSourceNote && <p className="text-slate-600 leading-relaxed font-mono text-[11px]">{row.costSourceNote}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <StatusPill status={row.costStatus} />
                  {row.stalenessFlag && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
                      <AlertTriangle className="w-3 h-3" /> Source flagged stale
                    </span>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Benchmark Scenario Selector Card
// ---------------------------------------------------------------------------

function BenchmarkScenarioTester({
  activeSector,
  onSelectBenchmark,
}: {
  activeSector: string;
  onSelectBenchmark: (sector: string, investmentCr: number, capacityStr: string) => void;
}): JSX.Element {
  return (
    <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-cyan-300 font-mono">
            Benchmark Scenario Quick-Tester
          </h2>
        </div>
        <span className="text-[10px] font-mono text-slate-400">Click a sector to evaluate its business start prediction</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => onSelectBenchmark('brewery', 7.5, '1 Lakh cases/yr')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeSector.includes('brewery')
              ? 'bg-blue-600 border-cyan-400 text-white shadow-lg ring-2 ring-cyan-400/50'
              : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <FlaskConical className="w-4 h-4 text-amber-300" /> TEST 1: Brewery
          </div>
          <div className="text-[10px] font-mono text-slate-300 mt-1">Pune, MH · ₹7.5 Cr</div>
          <div className="text-[9px] text-cyan-300 font-semibold mt-0.5">BRL + MPCB + FSSAI</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectBenchmark('food', 3.0, 'Packaged Food')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeSector.includes('food')
              ? 'bg-blue-600 border-cyan-400 text-white shadow-lg ring-2 ring-cyan-400/50'
              : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <Utensils className="w-4 h-4 text-emerald-300" /> TEST 2: Food Unit
          </div>
          <div className="text-[10px] font-mono text-slate-300 mt-1">Pune, MH · ₹3.0 Cr</div>
          <div className="text-[9px] text-cyan-300 font-semibold mt-0.5">FSSAI + MPCB + DISH</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectBenchmark('clothing', 2.5, 'Garments')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeSector.includes('clothing') || activeSector.includes('garment')
              ? 'bg-blue-600 border-cyan-400 text-white shadow-lg ring-2 ring-cyan-400/50'
              : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <Shirt className="w-4 h-4 text-purple-300" /> TEST 3: Garments
          </div>
          <div className="text-[10px] font-mono text-slate-300 mt-1">Pune, MH · ₹2.5 Cr</div>
          <div className="text-[9px] text-cyan-300 font-semibold mt-0.5">DISH + Fire + GST</div>
        </button>

        <button
          type="button"
          onClick={() => onSelectBenchmark('pharma', 25.0, 'Formulation')}
          className={`p-3 rounded-xl border text-left transition-all ${
            activeSector.includes('pharma')
              ? 'bg-blue-600 border-cyan-400 text-white shadow-lg ring-2 ring-cyan-400/50'
              : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <Pill className="w-4 h-4 text-rose-300" /> TEST 4: Pharma
          </div>
          <div className="text-[10px] font-mono text-slate-300 mt-1">Pune, MH · ₹25.0 Cr</div>
          <div className="text-[9px] text-cyan-300 font-semibold mt-0.5">FDA + MPCB + GLP</div>
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function TimeCostPredictionPage(): JSX.Element {
  const { accessToken } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [showApprovalDetails, setShowApprovalDetails] = useState(false);

  const { data: projects } = useQuery({
    queryKey: ['bi-projects'],
    queryFn: () => businessIntelligenceApi.projects(accessToken ?? undefined),
    enabled: Boolean(accessToken),
    staleTime: 30_000,
  });

  const effectiveProjectId = projectId ?? projects?.[0]?.id ?? null;

  const query = useQuery({
    queryKey: ['time-cost', effectiveProjectId],
    queryFn: () => businessIntelligenceApi.timeCostPrediction(effectiveProjectId as string, accessToken ?? undefined),
    enabled: Boolean(effectiveProjectId && accessToken),
    staleTime: 15_000,
    retry: 1,
  });

  const data = query.data;

  const locationLabel = useMemo(() => {
    const loc = data?.businessContext?.location;
    if (!loc) return 'Pune, Maharashtra';
    const state = loc['state']?.status === 'known' ? (loc['state']?.value as string) : null;
    const district = loc['district']?.status === 'known' ? (loc['district']?.value as string) : null;
    return [district, state].filter(Boolean).join(', ') || 'Pune, Maharashtra';
  }, [data]);

  if (query.isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner label="Computing your regulatory time & cost prediction model…" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <ErrorBanner
          message={query.error instanceof Error ? query.error.message : 'Could not load prediction.'}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <h1 className="text-2xl font-extrabold text-slate-900">Regulatory Time &amp; Cost Prediction</h1>
        <p className="text-sm text-slate-600 mt-1">Estimate how long and how much it takes to legally start and operate your business.</p>
        <div className="mt-6">
          <EmptyState
            title="No approval roadmap evaluated yet"
            description={data?.message ?? 'Confirm a business profile first so applicable approvals can be analyzed.'}
            action={
              <Link to={`/projects/${data?.projectId ?? ''}/profile`} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow">
                Complete Profile Intake →
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const t = data.time!;
  const c = data.cost!;
  const conf = data.confidence!;
  const comp = data.complexity;

  const confidenceCls =
    conf.level === 'high'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : conf.level === 'medium'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-rose-50 border-rose-200 text-rose-800';

  return (
    <div className="space-y-6 pb-16 font-sans max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider font-mono mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Statutory Time &amp; Cost Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Regulatory Time &amp; Cost Prediction
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-3xl">
            Approximate legal readiness timeline and regulatory setup cost prediction based on dependency graphs and fee schedules.
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-2">
          <ProjectPicker projectId={effectiveProjectId} onSelect={setProjectId} />
          <Link
            to={`/market-intelligence?businessType=${encodeURIComponent(data.project.industry)}&location=${encodeURIComponent(locationLabel)}&projectId=${data.projectId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition-colors shadow-sm"
          >
            <Map className="w-3.5 h-3.5" />
            Analyze Market →
          </Link>
        </div>
      </div>

      {/* Benchmark Scenario Tester */}
      <BenchmarkScenarioTester
        activeSector={data.project.industry}
        onSelectBenchmark={(sec) => {
          // Switch active project matching sector or alert
          const match = projects?.find((p) => p.industry.toLowerCase().includes(sec));
          if (match) setProjectId(match.id);
        }}
      />

      {/* ----------------------------------------------------------------- */}
      {/* TOP SECTION: BUSINESS START ESTIMATE (Headline Range Cards) */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Estimated Time Card */}
        <section className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl relative overflow-hidden border border-slate-800">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-cyan-300 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" /> BUSINESS START ESTIMATE — TIME
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
              Confidence: {conf.level.toUpperCase()}
            </span>
          </div>

          <div className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-white">
            {t.estimatedTimeRangeStr ?? `${t.estimatedMinWorkingDays}–${t.estimatedMaxWorkingDays} working days`}
          </div>

          <div className="mt-2 text-xs text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Approximate business start journey (not a simple sum of durations)</span>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 space-y-2 text-xs text-slate-300">
            <div>
              <span className="font-bold text-white">Critical Path:</span>{' '}
              <span className="font-mono text-cyan-300">{t.criticalPath.join(' → ')}</span>
            </div>
            <div>
              <span className="font-bold text-white">Parallel Tracks:</span>{' '}
              <span>{t.parallelApprovalCodes.length > 0 ? t.parallelApprovalCodes.join(', ') : 'None — sequential dependencies'}</span>
            </div>
            {comp && (
              <div>
                <span className="font-bold text-white">Business Complexity:</span>{' '}
                <span className="capitalize font-semibold text-amber-300">{comp.level} Complexity</span>
              </div>
            )}
          </div>
        </section>

        {/* Estimated Cost Card */}
        <section className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
            <span className="inline-flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-slate-800" /> ESTIMATED STARTUP REGULATORY COST
            </span>
            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Regulatory Setup Only
            </span>
          </div>

          <div className="mt-4 text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
            {c.estimatedCostRangeStr ?? fmtLakhRange(c.total)}
          </div>

          <div className="mt-2 text-xs text-slate-500 font-mono">
            Calculated from dataset fee slabs (excludes land, machinery, rent &amp; salaries)
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
            {[
              ['Government / Licence Fees', c.governmentFees],
              ['Registration Fees', c.registrationFees],
              ['Inspection Fees', c.inspectionFees],
              ['Environmental / Compliance Fees', c.environmentalFees ?? c.otherComplianceCosts],
            ].map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{label as string}</span>
                <span className="font-mono font-bold text-slate-900">{fmtRange(v as MinMax)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* WHY THIS ESTIMATE? + TIME DRIVERS */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Why This Estimate */}
        <section className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 font-mono mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" /> Why This Estimate?
          </h2>
          <ul className="space-y-2.5 text-xs text-slate-700">
            {(data.whyThisEstimate ?? []).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                <span>{item}</span>
              </li>
            ))}
            {(data.whyThisEstimate ?? []).length === 0 && (
              <li className="text-slate-500 italic">Timeline driven by critical path dependencies over the approval graph.</li>
            )}
          </ul>
        </section>

        {/* Time Drivers Breakdown */}
        <section className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 font-mono mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" /> Key Time Drivers
          </h2>
          <div className="space-y-3">
            {(data.timeDrivers ?? []).map((driver, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{driver.name}</span>
                  <span className="font-mono text-slate-500 text-[11px]">~{driver.maxDays} days</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full"
                    style={{ width: `${Math.max(8, driver.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* COST BREAKDOWN TABLE */}
      {/* ----------------------------------------------------------------- */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Regulatory Setup Cost Breakdown</h2>
            <p className="text-[11px] text-slate-500">Calculated from configured fee slabs &amp; official schedules in the regulatory dataset.</p>
          </div>
          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
            Total: {c.estimatedCostRangeStr ?? fmtLakhRange(c.total)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">
                <th className="py-2.5 px-3">Requirement</th>
                <th className="py-2.5 px-3">Authority</th>
                <th className="py-2.5 px-3 text-right">Government Fee</th>
                <th className="py-2.5 px-3 text-right">Environmental / Inspection</th>
                <th className="py-2.5 px-3 text-right">Total Fee Range</th>
                <th className="py-2.5 px-3">Evidence Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.costRows ?? []).map((row) => (
                <CostRow key={row.approvalDefinitionId} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* VISUAL JOURNEY GANTT TIMELINE */}
      {/* ----------------------------------------------------------------- */}
      <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Visual Journey Gantt &amp; Critical Path</h2>
            <p className="text-[11px] text-slate-500">Blue bars show requirements on the critical path; lighter extensions represent upper-bound uncertainty.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAssumptions(!showAssumptions)}
              className="px-3 py-1 rounded-lg border text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              {showAssumptions ? 'Hide Assumptions' : 'View Assumptions'}
            </button>
            <button
              type="button"
              onClick={() => setShowApprovalDetails(!showApprovalDetails)}
              className="px-3 py-1 rounded-lg border text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors"
            >
              {showApprovalDetails ? 'Hide Approval Details' : 'View Approval Details'}
            </button>
          </div>
        </div>

        {showAssumptions && (
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-xs space-y-1.5 text-blue-900 font-mono">
            <div className="font-bold uppercase tracking-wider text-[10px] text-blue-700">Model Assumptions</div>
            <div>• Approvals without gating dependencies start concurrently at Day 0.</div>
            <div>• Critical path is calculated strictly over gating `depends_on` graph edges.</div>
            <div>• Duration ranges reflect official notified SLAs + business complexity uncertainty buffers.</div>
            <div>• Excludes business operational costs (land, building construction, raw materials, salaries).</div>
          </div>
        )}

        <GanttTimeline rows={data.timeline ?? []} />
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* DATA QUALITY & EVIDENCE CONFIDENCE */}
      {/* ----------------------------------------------------------------- */}
      <section className={`p-4 sm:p-5 rounded-2xl border ${confidenceCls}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            <h2 className="text-sm font-extrabold">Data Quality &amp; Evidence Confidence: {conf.level.toUpperCase()}</h2>
          </div>
          <span className="text-xs font-mono font-bold">Coverage: {Math.round((conf.score ?? 0.8) * 100)}%</span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 my-3">
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/60 text-xs">
            <div className="font-bold text-slate-900 font-mono">{data.dataQuality?.officialEvidenceCount ?? 0} Approvals</div>
            <div className="text-[10px] text-slate-500">Official Notified Statutory SLAs</div>
          </div>
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/60 text-xs">
            <div className="font-bold text-slate-900 font-mono">{data.dataQuality?.planningEstimatesCount ?? 0} Approvals</div>
            <div className="text-[10px] text-slate-500">Historical Planning Estimates</div>
          </div>
          <div className="p-3 rounded-xl bg-white/80 border border-slate-200/60 text-xs">
            <div className="font-bold text-slate-900 font-mono">{data.dataQuality?.unknownCount ?? 0} Approvals</div>
            <div className="text-[10px] text-slate-500">Unconfigured SLA Gaps</div>
          </div>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          {(conf.explanation ?? []).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* BUSINESS SETUP SUMMARY CARD */}
      {/* ----------------------------------------------------------------- */}
      <section className="p-6 rounded-3xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white shadow-xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider mb-3 font-mono">
          <Store className="w-3.5 h-3.5" /> Business Setup Summary
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div><span className="text-slate-400 text-xs font-mono uppercase">Business:</span> <span className="font-bold text-white">{data.project.name}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Location:</span> <span className="font-bold text-white">{locationLabel}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Applicable Clearances:</span> <span className="font-bold text-white">{data.timeline?.length ?? 0} statutory processes</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Estimated Business Start:</span> <span className="font-bold text-cyan-300">{t.estimatedTimeRangeStr}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Estimated Regulatory Cost:</span> <span className="font-bold text-cyan-300">{c.estimatedCostRangeStr ?? fmtLakhRange(c.total)}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Critical Path:</span> <span className="font-bold font-mono text-xs text-white">{t.criticalPath.join(' → ')}</span></div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-400" />
            Values are dynamically predicted based on graph topology + fee schedules.
          </p>
          <Link
            to={`/market-intelligence?businessType=${encodeURIComponent(data.project.industry)}&location=${encodeURIComponent(locationLabel)}&projectId=${data.projectId}`}
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg transition-colors"
          >
            Analyze Local Market →
          </Link>
        </div>
      </section>
    </div>
  );
}

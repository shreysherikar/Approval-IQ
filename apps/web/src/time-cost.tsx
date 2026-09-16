import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  IndianRupee,
  GitBranch,
  Layers,
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
// Shared formatting helpers
// ---------------------------------------------------------------------------

function fmtRange(r: MinMax | undefined, suffix = ''): string {
  if (!r || (r.min === null && r.max === null)) return 'No configured data';
  if (r.min === r.max) return `₹${(r.min ?? 0).toLocaleString('en-IN')}${suffix}`;
  const lo = r.min ?? r.max ?? 0;
  const hi = r.max ?? r.min ?? 0;
  return `₹${lo.toLocaleString('en-IN')} – ₹${hi.toLocaleString('en-IN')}${suffix}`;
}



const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  configured: { label: 'Configured', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  estimated: { label: 'Estimated', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  needs_review: { label: 'Needs Review', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function StatusPill({ status }: { status: string | null | undefined }): JSX.Element | null {
  if (!status) return null;
  const s = STATUS_STYLES[status] ?? {
    label: status,
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>
      {status === 'verified' ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Project picker (all BI pages share this shape)
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
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Project:</label>
      <select
        value={projectId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visual Gantt-style timeline built from startDay/finishDay (weighted graph)
// ---------------------------------------------------------------------------

function GanttTimeline({ rows }: { rows: TimeCostTimelineRow[] }): JSX.Element {
  const timed = rows.filter((r) => r.finishDayMax !== null);
  const maxFinish = Math.max(1, ...timed.map((r) => r.finishDayMax ?? 0));
  return (
    <div className="space-y-2">
      <div className="flex text-[10px] font-mono text-slate-400 pl-40 pr-2 justify-between">
        <span>START (day 0)</span>
        <span>day {maxFinish}</span>
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
            <div className="relative flex-1 h-7 bg-slate-100 rounded-lg overflow-hidden">
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
                  className="absolute inset-y-0 left-0 w-full flex items-center px-2 text-[9px] font-semibold text-slate-400 italic"
                  title="No processing time configured in the regulatory dataset"
                >
                  no configured processing time — shown as data gap
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
// Expandable cost row
// ---------------------------------------------------------------------------

function CostRow({ row }: { row: TimeCostCostRow }): JSX.Element {
  const [open, setOpen] = useState(false);
  const feeCell = (m: MinMax): string =>
    m.min === null && m.max === null ? '—' : m.min === m.max ? `₹${(m.min ?? 0).toLocaleString('en-IN')}` : `₹${(m.min ?? 0).toLocaleString('en-IN')}–${(m.max ?? 0).toLocaleString('en-IN')}`;
  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(!open)}>
        <td className="py-2.5 px-3 text-xs font-bold text-slate-800">
          <span className="inline-flex items-center gap-1.5">
            {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            {row.name}
          </span>
        </td>
        <td className="py-2.5 px-3 text-xs text-slate-600">{row.authority}</td>
        <td className="py-2.5 px-3 text-xs font-mono text-right">{feeCell(row.govtFee)}</td>
        <td className="py-2.5 px-3 text-xs font-mono text-right">{feeCell({ min: (row.registrationFee.min ?? 0) + (row.inspectionFee.min ?? 0) + (row.documentationCost.min ?? 0) + (row.otherCost.min ?? 0) || null, max: (row.registrationFee.max ?? 0) + (row.inspectionFee.max ?? 0) + (row.documentationCost.max ?? 0) + (row.otherCost.max ?? 0) || null })}</td>
        <td className="py-2.5 px-3 text-xs font-mono font-bold text-right text-slate-900">{feeCell(row.total)}</td>
        <td className="py-2.5 px-3"><StatusPill status={row.costStatus} /></td>
      </tr>
      {open && (
        <tr className="bg-blue-50/40 border-b border-blue-100">
          <td colSpan={6} className="py-3 px-6">
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Why this requirement applies</div>
                <p className="text-slate-700 leading-relaxed">{row.whyRequired}</p>
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 pt-1.5">Fee details</div>
                <ul className="font-mono text-[11px] text-slate-600 space-y-0.5">
                  <li>Government fee: {feeCell(row.govtFee)}</li>
                  <li>Registration: {feeCell(row.registrationFee)}</li>
                  <li>Inspection: {feeCell(row.inspectionFee)}</li>
                  <li>Documentation: {feeCell(row.documentationCost)}</li>
                  <li>Other: {feeCell(row.otherCost)}</li>
                </ul>
              </div>
              <div className="space-y-1.5">
                <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Evidence / source</div>
                {row.sourceUrl ? (
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-700 font-semibold hover:underline">
                    {row.sourceTitle ?? 'Official source'} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400 italic">No source URL recorded</span>
                )}
                {row.costSourceNote && <p className="text-slate-600 leading-relaxed">{row.costSourceNote}</p>}
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
// Main page
// ---------------------------------------------------------------------------

export function TimeCostPredictionPage(): JSX.Element {
  const { accessToken } = useAuth();
  const [projectId, setProjectId] = useState<string | null>(null);

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
    if (!loc) return null;
    const state = loc['state']?.status === 'known' ? (loc['state']?.value as string) : null;
    const district = loc['district']?.status === 'known' ? (loc['district']?.value as string) : null;
    return [district, state].filter(Boolean).join(', ') || null;
  }, [data]);

  if (query.isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner label="Computing your regulatory time & cost prediction…" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="max-w-xl mx-auto py-10">
        <ErrorBanner
          message={query.error instanceof Error ? query.error.message : 'Could not load the prediction.'}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (!data) return <EmptyState title="No data" description="Select a project to see its prediction." />;

  if (!data.hasData) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <h1 className="text-2xl font-extrabold text-slate-900">Regulatory Time &amp; Cost Prediction</h1>
        <p className="text-sm text-slate-600 mt-1">Estimate how long and how much it may take to complete your business's applicable legal and compliance requirements.</p>
        <div className="mt-6">
          <EmptyState
            title="No approval roadmap yet"
            description={data.message ?? 'Confirm a business profile first so approvals can be evaluated.'}
            action={
              <Link to={`/projects/${data.projectId}/profile`} className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow">
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

  const confidenceCls =
    conf.level === 'high'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : conf.level === 'medium'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-rose-50 border-rose-200 text-rose-800';

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider font-mono mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Business Intelligence
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Regulatory Time &amp; Cost Prediction
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 max-w-2xl">
            Estimate how long and how much it may take to complete your business's applicable legal and compliance requirements.
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-2">
          <ProjectPicker projectId={effectiveProjectId} onSelect={setProjectId} />
          <Link
            to={`/market-intelligence?businessType=${encodeURIComponent(data.project.industry)}&location=${encodeURIComponent(locationLabel ?? '')}&projectId=${data.projectId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-700 transition-colors"
          >
            <Map className="w-3.5 h-3.5" />
            Analyze Local Market →
          </Link>
        </div>
      </div>

      {/* 1. Business Context */}
      <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono mb-3">Business Context</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Project</div>
            <div className="font-bold text-slate-900">{data.project.name}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Industry</div>
            <div className="font-bold text-slate-900 capitalize">{data.businessContext?.industry ?? data.project.industry}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-slate-400 font-bold">Location</div>
            <div className="font-bold text-slate-900">{locationLabel ?? <span className="italic font-normal text-slate-400">Not set in the business profile</span>}</div>
          </div>
        </div>
      </section>

      {/* 2 + 3. Headline results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-cyan-300 font-mono">
            <Clock className="w-4 h-4" /> Estimated Legal Readiness
          </div>
          <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tight">
            {t.estimatedMinWorkingDays}–{t.estimatedMaxWorkingDays}
            <span className="text-base font-bold text-slate-300 ml-2">working days</span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-2">{t.basis}</p>
          <div className="mt-4 space-y-1.5 text-xs text-slate-300">
            <div><span className="font-bold text-white">Critical path:</span> {t.criticalPath.join(' → ')}</div>
            {t.longestApproval && (
              <div><span className="font-bold text-white">Longest approval:</span> {t.longestApproval.name} ({t.longestApproval.days}d)</div>
            )}
            <div><span className="font-bold text-white">Parallel approvals:</span> {t.parallelApprovalCodes.length > 0 ? t.parallelApprovalCodes.join(', ') : 'None — everything is sequential'}</div>
          </div>
          <p className="mt-3 text-[11px] text-slate-300 leading-relaxed border-l-2 border-cyan-500/50 pl-3">
            {t.explanation}
          </p>
          {t.approvalsMissingTime.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-300">
              ⚠ {t.approvalsMissingTime.length} approval(s) have no configured processing time and are excluded from this estimate: {t.approvalsMissingTime.join(', ')}
            </p>
          )}
        </section>

        <section className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-md">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
            <IndianRupee className="w-4 h-4 text-slate-700" /> Estimated Total Cost
          </div>
          <div className="mt-2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
            {fmtRange(c.total)}
          </div>
          <p className="text-[11px] text-slate-500 font-mono mt-2">{c.currency} · configured evidence only</p>
          <div className="mt-4 space-y-2">
            {[
              ['Government / Licence Fees', c.governmentFees],
              ['Registration Fees', c.registrationFees],
              ['Inspection Fees', c.inspectionFees],
              ['Documentation / Certificates', c.documentationCosts],
              ['Other Compliance Costs', c.otherComplianceCosts],
            ].map(([label, v]) => (
              <div key={label as string} className="flex items-center justify-between text-xs border-b border-slate-100 pb-1.5">
                <span className="text-slate-600 font-semibold">{label as string}</span>
                <span className="font-mono font-bold text-slate-900">{fmtRange(v as MinMax)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">{c.note}</p>
        </section>
      </div>

      {/* 4. Approval Timeline table */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">Approval Timeline</h2>
          <span className="text-[10px] font-mono text-slate-400">computed from the dependency graph, not the sum of durations</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">
                <th className="py-2.5 px-3">Requirement</th>
                <th className="py-2.5 px-3">Authority</th>
                <th className="py-2.5 px-3">Estimated Time</th>
                <th className="py-2.5 px-3">Dependency</th>
                <th className="py-2.5 px-3">Parallel / Sequential</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.timeline ?? []).map((r) => (
                <tr key={r.approvalDefinitionId} className={`border-b border-slate-100 ${r.onCriticalPath ? 'bg-blue-50/40' : ''}`}>
                  <td className="py-2.5 px-3 text-xs font-bold text-slate-800">
                    {r.name}
                    {r.onCriticalPath && <span className="ml-1.5 text-[9px] font-mono text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">CRITICAL</span>}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{r.authority}</td>
                  <td className="py-2.5 px-3 text-xs font-mono">
                    {r.timeKnown ? (
                      <span>
                        {r.estimatedTimeMinDays === r.estimatedTimeMaxDays ? `${r.estimatedTimeMinDays}d` : `${r.estimatedTimeMinDays}–${r.estimatedTimeMaxDays}d`}
                      </span>
                    ) : (
                      <span className="text-rose-600 font-semibold italic">unknown</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">{r.dependencies ?? <span className="text-slate-400">None</span>}</td>
                  <td className="py-2.5 px-3 text-xs">
                    {r.parallelRun ? (
                      <span className="text-emerald-700 font-semibold">Parallel (independent)</span>
                    ) : r.dependencies ? (
                      <span className="text-amber-700 font-semibold">Sequential</span>
                    ) : (
                      <span className="text-slate-500">Independent</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusPill status={r.timeStatus} />
                    {r.timeKnown && <StatusPill status={r.timeStatus} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Visual timeline (Gantt) */}
      <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900 mb-1">Journey Timeline</h2>
        <p className="text-[11px] text-slate-500 mb-4">Bars show when each requirement runs on the dependency graph. Blue bars are on the critical path; the lighter extension shows the uncertainty range.</p>
        <GanttTimeline rows={data.timeline ?? []} />
      </section>

      {/* 6. Critical Path + 7. Parallel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-blue-700" />
            <h2 className="text-sm font-extrabold text-slate-900">Critical Path</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {t.criticalPath.map((code, i) => (
              <span key={code} className="inline-flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-400">→</span>}
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold font-mono shadow-sm">{code}</span>
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            These approvals must finish in order — any delay cascades to the end of the journey.
          </p>
        </section>

        <section className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-extrabold text-slate-900">Parallel Approvals</h2>
          </div>
          {t.parallelGroups.map((g) => (
            <div key={g.layerIndex} className="mb-3">
              <div className="text-[10px] font-mono uppercase font-bold text-slate-400 mb-1">
                {g.layerIndex === 0 ? 'Start immediately' : `After prerequisites (~day ${g.startDay})`}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.approvalIds.map((code) => (
                  <span key={code} className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold font-mono">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* 5b. Cost Breakdown table */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <h2 className="text-sm font-extrabold text-slate-900">Cost Breakdown</h2>
          <p className="text-[11px] text-slate-500">Click any row for why the requirement applies, fee details, evidence and verification status.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold font-mono">
                <th className="py-2.5 px-3">Requirement</th>
                <th className="py-2.5 px-3">Authority</th>
                <th className="py-2.5 px-3 text-right">Government Fee</th>
                <th className="py-2.5 px-3 text-right">Other Cost</th>
                <th className="py-2.5 px-3 text-right">Total</th>
                <th className="py-2.5 px-3">Amount Status</th>
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

      {/* 8. Delay factors */}
      <section className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h2 className="text-sm font-extrabold text-slate-900">What Could Delay Your Business?</h2>
        </div>
        <div className="space-y-2.5">
          {(data.delayFactors ?? []).map((d, i) => (
            <div key={i} className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
              <p className="text-xs font-semibold text-amber-900">{d.factor}</p>
              <p className="text-[10px] font-mono text-amber-600 mt-1">Affects: {d.affectedApprovals.join(', ')} · basis: {d.basis}</p>
            </div>
          ))}
          {(data.delayFactors ?? []).length === 0 && (
            <p className="text-xs text-slate-500">No delay factors identified from the current data.</p>
          )}
        </div>
      </section>

      {/* 9. Evidence / Data Confidence */}
      <section className={`p-4 sm:p-5 rounded-2xl border ${confidenceCls}`}>
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-4 h-4" />
          <h2 className="text-sm font-extrabold">Data Confidence: {conf.level.toUpperCase()}</h2>
          <span className="ml-auto text-xs font-mono">evidence coverage {Math.round(conf.score * 100)}%</span>
        </div>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          {conf.explanation.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </section>

      {/* 10. Business Setup Summary */}
      <section className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-cyan-300 text-[10px] font-bold uppercase tracking-wider mb-3">
          <Store className="w-3 h-3" /> Business Setup Summary
        </div>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div><span className="text-slate-400 text-xs font-mono uppercase">Business:</span> <span className="font-bold">{data.project.name}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Location:</span> <span className="font-bold">{locationLabel ?? 'Not set'}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Applicable requirements:</span> <span className="font-bold">{conf.totalApprovals}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Estimated legal readiness:</span> <span className="font-bold">{t.estimatedMinWorkingDays}–{t.estimatedMaxWorkingDays} working days</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Estimated total cost:</span> <span className="font-bold">{fmtRange(c.total)}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Critical path:</span> <span className="font-bold font-mono text-xs">{t.criticalPath.join(' → ')}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Parallel approvals:</span> <span className="font-bold text-xs">{t.parallelApprovalCodes.join(', ') || 'None'}</span></div>
          <div><span className="text-slate-400 text-xs font-mono uppercase">Main delay factors:</span> <span className="font-bold text-xs">{(data.delayFactors ?? []).slice(0, 3).map((d) => d.factor.split('—')[0]?.trim()).join('; ')}</span></div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">
            <CheckCircle2 className="w-3 h-3 inline mr-1 text-emerald-400" />
            All values above are dynamically computed from your project's evaluation + the regulatory dataset — never hardcoded.
          </p>
          <Link
            to={`/market-intelligence?businessType=${encodeURIComponent(data.project.industry)}&location=${encodeURIComponent(locationLabel ?? '')}&projectId=${data.projectId}`}
            className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs shadow-lg transition-colors"
          >
            Analyze Local Market →
          </Link>
        </div>
      </section>
    </div>
  );
}

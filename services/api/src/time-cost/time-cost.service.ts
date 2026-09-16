import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Business Intelligence — Regulatory Time & Cost Prediction (Feature 1).
 *
 * Everything computed here is derived from the SAME data the roadmap uses:
 * the project's pinned EvaluationResults + ApprovalInstances + the Dependency
 * graph in Postgres. Nothing is hardcoded per-industry and nothing is invented:
 * - Time comes from the approval's configured processing-time evidence
 *   (verified SLA or clearly-labelled estimate). Approvals without a
 *   configured time are excluded from the numeric estimate and reported as
 *   data gaps instead — never guessed.
 * - The overall duration is the CRITICAL PATH over the depends_on graph
 *   (longest weighted path), not the sum of all durations. Approvals without
 *   gating dependencies start at day 0 and run in parallel.
 * - Costs are summed per configured category; rows missing cost evidence are
 *   reported as needing review.
 */

type GraphEdge = { from: string; to: string; relationship: string };

type EngineDependency = { from: string; to: string; relationship: string };

/** Structural shape of the approval-engine's graph utilities (ESM dynamic import). */
interface EngineGraph {
  gatingLayers(
    ids: readonly string[],
    deps: EngineDependency[],
  ): { layers: string[][]; cyclicIds: string[] };
}

async function loadEngineGraph(): Promise<EngineGraph> {
  const engine = (await import('@approvaliq/approval-engine' as string)) as unknown as EngineGraph;
  return engine;
}

interface TimeEvidence {
  minDays: number | null;
  maxDays: number | null;
  basis: string | null;
  status: string | null;
  note: string | null;
}

interface CostEvidence {
  govtMin: number | null; govtMax: number | null;
  regMin: number | null; regMax: number | null;
  inspMin: number | null; inspMax: number | null;
  docMin: number | null; docMax: number | null;
  othMin: number | null; othMax: number | null;
  status: string | null;
  note: string | null;
}

interface ApprovalRow {
  id: string;
  code: string;
  name: string;
  whyRequired: string;
  inspectionRequired: boolean;
  slaDays: number | null;
  officialApplicationUrl: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  verificationStatus: string | null;
  stalenessFlag: boolean;
  lastVerifiedDate: Date;
  time: TimeEvidence;
  cost: CostEvidence;
  authority: { code: string; name: string; department: string | null };
}

const FALLBACK_TIME_BASIS = 'sla_days';

/**
 * Time evidence resolution order (documented, honest fallback):
 * 1. processing_time_min/max_days — the dedicated BI evidence columns.
 * 2. sla_days — legacy column (used by the RTS Act data where it IS the
 *    notified statutory SLA). Marked with its own basis so the UI can label
 *    provenance.
 * Otherwise null (unknown — excluded from the estimate, reported as a gap).
 */
function resolveTime(row: {
  processingTimeMinDays: number | null;
  processingTimeMaxDays: number | null;
  timeBasis: string | null;
  timeStatus: string | null;
  timeSourceNote: string | null;
  slaDays: number | null;
}): TimeEvidence {
  if (row.processingTimeMinDays !== null || row.processingTimeMaxDays !== null) {
    return {
      minDays: row.processingTimeMinDays,
      maxDays: row.processingTimeMaxDays ?? row.processingTimeMinDays,
      basis: row.timeBasis ?? FALLBACK_TIME_BASIS,
      status: row.timeStatus ?? 'configured',
      note: row.timeSourceNote,
    };
  }
  if (row.slaDays !== null) {
    return {
      minDays: row.slaDays,
      maxDays: row.slaDays,
      basis: FALLBACK_TIME_BASIS,
      status: 'configured',
      note: 'Derived from the approval record\u2019s configured SLA (sla_days) column.',
    };
  }
  return { minDays: null, maxDays: null, basis: null, status: null, note: null };
}

function resolveCost(row: {
  govtFeeMinInr: number | null; govtFeeMaxInr: number | null;
  registrationFeeMinInr: number | null; registrationFeeMaxInr: number | null;
  inspectionFeeMinInr: number | null; inspectionFeeMaxInr: number | null;
  documentationCostMinInr: number | null; documentationCostMaxInr: number | null;
  otherCostMinInr: number | null; otherCostMaxInr: number | null;
  costStatus: string | null; costSourceNote: string | null;
}): CostEvidence {
  return {
    govtMin: row.govtFeeMinInr, govtMax: row.govtFeeMaxInr,
    regMin: row.registrationFeeMinInr, regMax: row.registrationFeeMaxInr,
    inspMin: row.inspectionFeeMinInr, inspMax: row.inspectionFeeMaxInr,
    docMin: row.documentationCostMinInr, docMax: row.documentationCostMaxInr,
    othMin: row.otherCostMinInr, othMax: row.otherCostMaxInr,
    status: row.costStatus, note: row.costSourceNote,
  };
}

function sumNullable(pairs: Array<[number | null, number | null]>): { min: number | null; max: number | null } {
  const mins = pairs.map(([m]) => m).filter((m): m is number => m !== null);
  const maxs = pairs.map(([, m]) => m).filter((m): m is number => m !== null);
  const all = [...mins, ...maxs];
  if (all.length === 0) return { min: null, max: null };
  return {
    min: mins.length > 0 ? mins.reduce((a, b) => a + b, 0) : null,
    max: maxs.length > 0 ? maxs.reduce((a, b) => a + b, 0) : null,
  };
}

@Injectable()
export class TimeCostService {
  constructor(private readonly prisma: PrismaService) {}

  async predict(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, industry: true, businessId: true },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);

    const latestProfile = await this.prisma.businessProfileVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { values: true, status: true, versionNumber: true },
    });

    const instances = await this.prisma.approvalInstance.findMany({
      where: { projectId },
      include: {
        evaluationResult: { select: { outcome: true, missingFields: true } },
        approvalDefinition: {
          include: {
            authority: { select: { code: true, name: true, department: true } },
            source: { select: { url: true, title: true, verificationStatus: true, stalenessFlag: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (instances.length === 0) {
      return {
        projectId,
        project,
        profile: latestProfile
          ? { versionNumber: latestProfile.versionNumber, status: latestProfile.status }
          : null,
        hasData: false,
        message:
          'No approval roadmap exists for this project yet. Confirm a business profile first so approvals can be evaluated.',
      };
    }

    const rows: ApprovalRow[] = instances.map((i) => ({
      id: i.approvalDefinition.id,
      code: i.approvalDefinition.code,
      name: i.approvalDefinition.name,
      whyRequired: i.approvalDefinition.whyRequired,
      inspectionRequired: i.approvalDefinition.inspectionRequired,
      slaDays: i.approvalDefinition.slaDays,
      officialApplicationUrl: i.approvalDefinition.officialApplicationUrl,
      sourceUrl: i.approvalDefinition.source?.url ?? null,
      sourceTitle: i.approvalDefinition.source?.title ?? null,
      verificationStatus: i.approvalDefinition.source?.verificationStatus ?? null,
      stalenessFlag: i.approvalDefinition.source?.stalenessFlag ?? false,
      lastVerifiedDate: i.approvalDefinition.lastVerifiedDate,
      time: resolveTime(i.approvalDefinition),
      cost: resolveCost(i.approvalDefinition),
      authority: i.approvalDefinition.authority,
    }));
    const rowByDefId = new Map(rows.map((r) => [r.id, r]));

    const depRows = await this.prisma.dependency.findMany({
      where: {
        fromApprovalId: { in: rows.map((r) => r.id) },
        toApprovalId: { in: rows.map((r) => r.id) },
      },
      select: { fromApprovalId: true, toApprovalId: true, relationship: true },
    });
    // Only depends_on edges gate sequencing (same rule as the roadmap engine).
    const edges: GraphEdge[] = depRows
      .filter((d) => d.relationship === 'depends_on')
      .map((d) => ({ from: d.fromApprovalId, to: d.toApprovalId, relationship: d.relationship }));

    // -----------------------------------------------------------------
    // Single forward pass (Kahn topological order): earliest start/finish
    // per approval. min and max are tracked separately so the result is an
    // honest RANGE, never a single fake-precise number.
    // -----------------------------------------------------------------
    // Edge direction (ADR-0001, same as the engine): `from` DEPENDS ON `to`,
    // i.e. `to` must finish before `from` can start. Indegree therefore counts
    // prerequisites of `from`, and completing `to` unlocks its dependents.
    const indegree = new Map<string, number>();
    const outAdj = new Map<string, string[]>();
    for (const r of rows) { indegree.set(r.id, 0); outAdj.set(r.id, []); }
    for (const e of edges) {
      if (!indegree.has(e.to) || !indegree.has(e.from)) continue;
      indegree.set(e.from, (indegree.get(e.from) ?? 0) + 1);
      outAdj.get(e.to)?.push(e.from);
    }
    const queue: string[] = [];
    for (const [id, d] of indegree) if (d === 0) queue.push(id);
    const ordered: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      ordered.push(id);
      for (const nxt of outAdj.get(id) ?? []) {
        const d = (indegree.get(nxt) ?? 0) - 1;
        indegree.set(nxt, d);
        if (d === 0) queue.push(nxt);
      }
    }
    // Defensive: if a cycle somehow slipped through, the remainder is appended
    // (their start = 0) — the roadmap endpoint separately refuses to render
    // cyclic graphs, so this is belt-and-braces for prediction only.
    if (ordered.length < rows.length) {
      const seen = new Set(ordered);
      for (const r of rows) if (!seen.has(r.id)) ordered.push(r.id);
    }

    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();
    // Min-duration chain: dependents start when the SLOWEST prerequisite
    // finishes under MIN durations — gives the optimistic bound of the range.
    const finishMinChain = new Map<string, number>();
    const durMin = new Map<string, number>();
    const durMax = new Map<string, number>();
    for (const r of rows) {
      durMin.set(r.id, r.time.minDays ?? 0);
      durMax.set(r.id, r.time.maxDays ?? 0);
    }
    for (const id of ordered) {
      // Prerequisites of `id` are the `to` nodes of edges whose `from` is id
      // (from depends on to).
      const deps = edges.filter((e) => e.from === id).map((e) => e.to);
      const start = deps.length === 0 ? 0 : Math.max(...deps.map((d) => earliestFinish.get(d) ?? 0));
      earliestStart.set(id, start);
      earliestFinish.set(id, start + (durMax.get(id) ?? 0));
      const startMin = deps.length === 0 ? 0 : Math.max(...deps.map((d) => finishMinChain.get(d) ?? 0));
      finishMinChain.set(id, startMin + (durMin.get(id) ?? 0));
    }

    let overallMin = 0;
    let overallMax = 0;
    for (const id of ordered) {
      overallMin = Math.max(overallMin, finishMinChain.get(id) ?? 0);
      overallMax = Math.max(overallMax, earliestFinish.get(id) ?? 0);
    }

    // -----------------------------------------------------------------
    // Critical path: walk backwards from the approval that finishes last,
    // always following the prerequisite with the latest finish.
    // -----------------------------------------------------------------
    let tailId: string | null = null;
    let tailFinish = -1;
    for (const id of ordered) {
      const f = earliestFinish.get(id) ?? 0;
      if (f > tailFinish) { tailFinish = f; tailId = id; }
    }
    const criticalPathIds: string[] = [];
    const visited = new Set<string>();
    let cursor = tailId;
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor);
      criticalPathIds.unshift(cursor);
      // Walk prerequisites of cursor: edges where cursor is the dependent.
      const deps = edges.filter((e) => e.from === cursor).map((e) => e.to);
      if (deps.length === 0) break;
      let best: string | null = null;
      let bestFinish = -1;
      for (const d of deps) {
        const f = earliestFinish.get(d) ?? 0;
        if (f > bestFinish) { bestFinish = f; best = d; }
      }
      cursor = best;
    }

    // -----------------------------------------------------------------
    // Parallel groups: engine-computed layers over the depends_on graph
    // (same rule as the roadmap). Layer 0 = no gating prerequisites, layer
    // N+1 = strictly after layer N. Annotations give the weighted view.
    // -----------------------------------------------------------------
    const engine = await loadEngineGraph();
    const engineDeps: EngineDependency[] = edges.map((e) => ({ from: e.from, to: e.to, relationship: 'depends_on' }));
    const idSet = new Set(rows.map((r) => r.id));
    const { layers, cyclicIds: layerCycles } = engine.gatingLayers([...idSet], engineDeps);
    const parallelGroups = layers.map((layer, idx) => ({
      layerIndex: idx,
      approvalIds: layer.map((id) => rowByDefId.get(id)?.code ?? id),
      startDay: Math.max(...layer.map((id) => earliestStart.get(id) ?? 0)),
      finishDayMax: Math.max(...layer.map((id) => earliestFinish.get(id) ?? 0)),
    }));
    // Cycle paranoia mirrors the roadmap: log-worthy data corruption should
    // never reach the prediction either; treat cyclic nodes as layer 0.
    if (layerCycles.length > 0) {
      parallelGroups.unshift({ layerIndex: -1, approvalIds: layerCycles.map((id) => rowByDefId.get(id)?.code ?? id), startDay: 0, finishDayMax: 0 });
    }
    // Layer-0 group starts at day 0; layer N starts when the earliest-start
    // node of layer N begins (min of its members' earliestStart). finishDayMax
    // is the max earliestFinish across the layer. All derived from the same
    // forward pass — engine layers define *who* runs in parallel, the
    // weighted forward pass defines *when*.
    for (let i = 0; i < parallelGroups.length; i++) {
      const g = parallelGroups[i] as { layerIndex: number; approvalIds: string[]; startDay: number; finishDayMax: number };
      if (g.layerIndex === 0) {
        g.startDay = 0;
      } else if (g.layerIndex > 0) {
        // startDay for layer N = min earliestStart over its members (nodes in
        // the layer unlock as soon as their own prerequisites finish).
        const memberIds = layers[g.layerIndex] ?? [];
        const starts = memberIds.map((id) => earliestStart.get(id) ?? 0);
        g.startDay = starts.length > 0 ? Math.min(...starts) : 0;
      }
    }

    // -----------------------------------------------------------------
    // Per-approval timeline rows (one per instance, always; unknown time is
    // displayed as a gap, never as a made-up number).
    // -----------------------------------------------------------------
    const timeline = rows.map((r) => {
      // Prerequisites: nodes `r` depends on (r is `from`). Dependents: nodes
      // that depend on `r` (r is `to`).
      const deps = edges.filter((e) => e.from === r.id).map((e) => e.to);
      const dependents = edges.filter((e) => e.to === r.id).map((e) => e.from);
      const startMin = earliestStart.get(r.id) ?? 0;
      const dMin = r.time.minDays;
      const dMax = r.time.maxDays;
      const durKnown = dMin !== null || dMax !== null;
      const onCriticalPath = criticalPathIds.includes(r.id);
      const dependencyLabel =
        deps.length === 0
          ? null
          : deps.map((d) => rowByDefId.get(d)?.code ?? d).join('; ');
      return {
        approvalDefinitionId: r.id,
        code: r.code,
        name: r.name,
        authority: r.authority.name,
        authorityDepartment: r.authority.department,
        estimatedTimeMinDays: dMin,
        estimatedTimeMaxDays: dMax,
        timeBasis: r.time.basis,
        timeStatus: r.time.status,
        timeSourceNote: r.time.note,
        dependencies: dependencyLabel,
        dependencyApprovalNames: deps.map((d) => rowByDefId.get(d)?.name ?? d),
        parallelRun: deps.length === 0 && ordered.length > 1,
        startDayMin: startMin,
        finishDayMin: dMin === null ? null : startMin + dMin,
        finishDayMax: dMax === null ? null : startMin + dMax,
        onCriticalPath,
        inspectionRequired: r.inspectionRequired,
        sourceUrl: r.sourceUrl ?? r.officialApplicationUrl,
        sourceTitle: r.sourceTitle,
        verificationStatus: r.verificationStatus,
        stalenessFlag: r.stalenessFlag,
        lastVerifiedDate: r.lastVerifiedDate,
        outcome: instances.find((i) => i.approvalDefinitionId === r.id)?.evaluationResult.outcome ?? null,
        dependents: dependents.map((d) => rowByDefId.get(d)?.code ?? d),
        timeKnown: durKnown,
      };
    });

    // -----------------------------------------------------------------
    // Cost breakdown, aggregated per category across applicable approvals.
    // -----------------------------------------------------------------
    const categorySum = (pick: (c: CostEvidence) => [number | null, number | null]) =>
      sumNullable(rows.map((r) => pick(r.cost)));
    const govt = categorySum((c) => [c.govtMin, c.govtMax]);
    const reg = categorySum((c) => [c.regMin, c.regMax]);
    const insp = categorySum((c) => [c.inspMin, c.inspMax]);
    const doc = categorySum((c) => [c.docMin, c.docMax]);
    const oth = categorySum((c) => [c.othMin, c.othMax]);
    const total = sumNullable([govt, reg, insp, doc, oth].map((x) => [x.min, x.max] as [number | null, number | null]));

    const costRows = rows.map((r) => {
      const t = sumNullable([
        [r.cost.govtMin, r.cost.govtMax],
        [r.cost.regMin, r.cost.regMax],
        [r.cost.inspMin, r.cost.inspMax],
        [r.cost.docMin, r.cost.docMax],
        [r.cost.othMin, r.cost.othMax],
      ]);
      return {
        approvalDefinitionId: r.id,
        code: r.code,
        name: r.name,
        authority: r.authority.name,
        govtFee: { min: r.cost.govtMin, max: r.cost.govtMax },
        registrationFee: { min: r.cost.regMin, max: r.cost.regMax },
        inspectionFee: { min: r.cost.inspMin, max: r.cost.inspMax },
        documentationCost: { min: r.cost.docMin, max: r.cost.docMax },
        otherCost: { min: r.cost.othMin, max: r.cost.othMax },
        total: t,
        costStatus: r.cost.status,
        costSourceNote: r.cost.note,
        whyRequired: r.whyRequired,
        sourceUrl: r.sourceUrl ?? r.officialApplicationUrl,
        sourceTitle: r.sourceTitle,
        verificationStatus: r.verificationStatus,
        stalenessFlag: r.stalenessFlag,
        lastVerifiedDate: r.lastVerifiedDate,
        costKnown: t.min !== null || t.max !== null,
      };
    });

    // -----------------------------------------------------------------
    // Confidence: fraction of applicable approvals with configured time and
    // cost evidence, plus how many values are verified vs estimated.
    // -----------------------------------------------------------------
    const timeKnownCount = timeline.filter((t) => t.timeKnown).length;
    const costKnownCount = costRows.filter((c) => c.costKnown).length;
    const verifiedTime = timeline.filter((t) => t.timeStatus === 'verified').length;
    const verifiedCost = costRows.filter((c) => c.costStatus === 'verified').length;
    const fraction = (n: number) => (rows.length === 0 ? 0 : n / rows.length);
    const score = (fraction(timeKnownCount) + fraction(costKnownCount)) / 2;
    const confidence =
      rows.length === 0
        ? 'no_data'
        : score >= 0.75 && verifiedTime > 0
          ? 'high'
          : score >= 0.4
            ? 'medium'
            : 'limited';
    const confidenceExplanation: string[] = [];
    if (verifiedTime > 0) confidenceExplanation.push(`${verifiedTime} of ${rows.length} approvals carry an official/verified processing SLA (e.g. RTS Act notified).`);
    if (verifiedTime < rows.length) confidenceExplanation.push(`${rows.length - verifiedTime} approval(s) have no verified statutory timeline — figures shown for them, if any, are clearly labelled estimates.`);
    if (verifiedCost > 0) confidenceExplanation.push(`${verifiedCost} of ${rows.length} approvals use a published fee schedule.`);
    if (verifiedCost < rows.length) confidenceExplanation.push(`${rows.length - verifiedCost} approval(s) have no verified fee — their cost rows are marked Needs Review.`);
    confidenceExplanation.push('Estimates assume typical application completeness; clarification requests and re-inspections are covered under delay factors below.');

    // -----------------------------------------------------------------
    // Delay factors, generated ONLY from actual data attributes.
    // -----------------------------------------------------------------
    const delayFactors: Array<{ factor: string; affectedApprovals: string[]; basis: string }> = [];
    const noTime = timeline.filter((t) => !t.timeKnown);
    if (noTime.length > 0) {
      delayFactors.push({
        factor: 'No statutory processing time is configured for some approvals — final duration cannot be bounded until the departments confirm SLAs.',
        affectedApprovals: noTime.map((t) => t.code),
        basis: 'data_gap: processing_time unset in the regulatory dataset',
      });
    }
    const inspections = timeline.filter((t) => t.inspectionRequired);
    if (inspections.length > 0) {
      delayFactors.push({
        factor: 'Inspections are required — scheduling and officer availability can add time beyond the configured processing window.',
        affectedApprovals: inspections.map((t) => t.code),
        basis: 'inspection_required = true in the approval data',
      });
    }
    const sequential = timeline.filter((t) => t.dependencies !== null);
    if (sequential.length > 0) {
      delayFactors.push({
        factor: 'Approval dependencies force sequencing — any delay in an upstream approval cascades to everything gated on it.',
        affectedApprovals: sequential.map((t) => t.code),
        basis: 'depends_on edges in the dependency graph',
      });
    }
    const stale = timeline.filter((t) => t.stalenessFlag);
    if (stale.length > 0) {
      delayFactors.push({
        factor: 'The underlying source for some approvals is flagged stale — requirements may have changed since verification.',
        affectedApprovals: stale.map((t) => t.code),
        basis: 'source.stalenessFlag = true',
      });
    }
    const missingDocs = instances.filter(
      (i) => i.evaluationResult.outcome === 'needs_information' && Array.isArray(i.evaluationResult.missingFields) && (i.evaluationResult.missingFields as unknown[]).length > 0,
    );
    if (missingDocs.length > 0) {
      delayFactors.push({
        factor: 'Some approvals still need profile information before they can be fully evaluated — collecting it is on your critical path.',
        affectedApprovals: missingDocs.map((i) => i.approvalDefinition.code),
        basis: 'evaluation outcome = needs_information',
      });
    }
    const notEvaluable = instances.filter((i) => i.evaluationResult.outcome === 'not_evaluable');
    if (notEvaluable.length > 0) {
      delayFactors.push({
        factor: 'Some approvals could not be evaluated automatically and need manual confirmation with the department.',
        affectedApprovals: notEvaluable.map((i) => i.approvalDefinition.code),
        basis: 'evaluation outcome = not_evaluable',
      });
    }

    const criticalPath = criticalPathIds.map((id) => rowByDefId.get(id)?.code ?? id);
    const parallelApprovalCodes = parallelGroups.filter((g) => g.approvalIds.length > 1).flatMap((g) => g.approvalIds);
    const longestRow = rows.reduce<{ code: string; name: string; days: number } | null>((best, r) => {
      const dMax = r.time.maxDays ?? r.time.minDays;
      if (dMax === null) return best;
      if (!best || dMax > best.days) return { code: r.code, name: r.name, days: dMax };
      return best;
    }, null);

    const primaryDriverNames = criticalPathIds
      .map((id) => rowByDefId.get(id)?.name)
      .filter((n): n is string => Boolean(n));
    const parallelNames = rows
      .filter((r) => (earliestStart.get(r.id) ?? 0) === 0 && !criticalPathIds.includes(r.id))
      .map((r) => r.name);
    const explanation =
      primaryDriverNames.length > 0
        ? `The estimated timeline is primarily driven by ${primaryDriverNames.slice(0, 3).join(', ')}.` +
          (parallelNames.length > 0 ? ` ${parallelNames.slice(0, 4).join(', ')} can proceed in parallel (no gating dependency on the critical path).` : '')
        : 'No dependency chain was configured for these approvals — all requirements can proceed in parallel.';

    return {
      projectId,
      project,
      profile: latestProfile
        ? { versionNumber: latestProfile.versionNumber, status: latestProfile.status }
        : null,
      hasData: true,
      businessContext: {
        industry: project.industry,
        location: (latestProfile?.values as Record<string, { value?: unknown }> | undefined) ?? null,
      },
      time: {
        estimatedMinWorkingDays: overallMin,
        estimatedMaxWorkingDays: overallMax,
        basis: 'working days, computed from the dependency graph critical path (not the sum of all durations)',
        criticalPath,
        criticalPathLengthDays: { min: overallMin, max: overallMax },
        longestApproval: longestRow,
        parallelGroups,
        parallelApprovalCodes: [...new Set(parallelApprovalCodes)],
        explanation,
        approvalsMissingTime: timeline.filter((t) => !t.timeKnown).map((t) => t.code),
      },
      cost: {
        currency: 'INR',
        governmentFees: govt,
        registrationFees: reg,
        inspectionFees: insp,
        documentationCosts: doc,
        otherComplianceCosts: oth,
        total: total,
        approvalsMissingCost: costRows.filter((c) => !c.costKnown).map((c) => c.code),
        note: 'Totals are sums of configured evidence only. Approvals without configured fees are excluded from the total and listed in approvalsMissingCost — the real total is at least this, and likely higher.',
      },
      timeline,
      costRows,
      confidence: {
        level: confidence,
        score: Math.round(score * 100) / 100,
        timeEvidenceKnown: timeKnownCount,
        costEvidenceKnown: costKnownCount,
        verifiedTimeApprovals: verifiedTime,
        verifiedCostApprovals: verifiedCost,
        totalApprovals: rows.length,
        explanation: confidenceExplanation,
      },
      delayFactors,
      generatedAt: new Date().toISOString(),
    };
  }
}

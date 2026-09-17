import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Business Intelligence — Regulatory Time & Cost Prediction.
 *
 * Implements approximate business-start journey estimation and dynamic fee formula resolution:
 * - Time is an APPROXIMATE BUSINESS START timeline range (e.g. 180–240 working days), NOT a simple sum of approval days.
 * - Time uses the critical path over the dependency graph under parallel processing, adjusted by a transparent
 *   Business Complexity & Uncertainty model based on duration types (official_notified vs planning_estimate vs unknown).
 * - Costs use dynamic fee formula resolution (MPCB capital investment slabs, Excise BRL schedules, FSSAI categories, Pharma FDA fees).
 * - Distinguishes regulatory setup cost from general business capital/operational expenses.
 */

type GraphEdge = { from: string; to: string; relationship: string };
type EngineDependency = { from: string; to: string; relationship: string };

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
  durationType: string; // official_notified | planning_estimate | unknown
}

interface CostEvidence {
  govtMin: number | null; govtMax: number | null;
  regMin: number | null; regMax: number | null;
  inspMin: number | null; inspMax: number | null;
  docMin: number | null; docMax: number | null;
  othMin: number | null; othMax: number | null;
  envMin: number | null; envMax: number | null;
  status: string | null;
  note: string | null;
  costFormula: string | null;
  costType: string | null;
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

/**
 * Format numbers in INR Lakhs / Crores for clear user presentation.
 */
function formatInrRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'Not configured — verification required';
  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  
  function toLakhStr(n: number): string {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2).replace(/\.00$/, '')} crore`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')} lakh`;
    return `₹${n.toLocaleString('en-IN')}`;
  }

  if (lo === hi) return toLakhStr(lo);
  return `${toLakhStr(lo)} – ${toLakhStr(hi)}`;
}

/**
 * Dynamic fee formula evaluator for MPCB investment slabs, Excise BRL, FSSAI, Pharma FDA.
 */
function evaluateDynamicCost(
  code: string,
  rawCost: {
    govtFeeMinInr: number | null; govtFeeMaxInr: number | null;
    registrationFeeMinInr: number | null; registrationFeeMaxInr: number | null;
    inspectionFeeMinInr: number | null; inspectionFeeMaxInr: number | null;
    documentationCostMinInr: number | null; documentationCostMaxInr: number | null;
    otherCostMinInr: number | null; otherCostMaxInr: number | null;
    costStatus: string | null; costSourceNote: string | null;
  },
  investmentAmountInr: number,
  capacityValue: number = 0,
): CostEvidence {
  let govtMin = rawCost.govtFeeMinInr;
  let govtMax = rawCost.govtFeeMaxInr;
  const regMin = rawCost.registrationFeeMinInr;
  const regMax = rawCost.registrationFeeMaxInr;
  let inspMin = rawCost.inspectionFeeMinInr;
  let inspMax = rawCost.inspectionFeeMaxInr;
  const docMin = rawCost.documentationCostMinInr;
  const docMax = rawCost.documentationCostMaxInr;
  const othMin = rawCost.otherCostMinInr;
  const othMax = rawCost.otherCostMaxInr;
  let envMin: number | null = null;
  let envMax: number | null = null;
  let status = rawCost.costStatus ?? 'configured';
  let note = rawCost.costSourceNote;
  let costFormula: string | null = null;
  let costType: string | null = 'fixed';

  // 1. MPCB Environmental Consent Slabs (Capital-investment-based formula)
  if (code.includes('MPCB') || code.includes('DYE') || code === 'FOOD-MPCB' || code === 'PHARMA-MPCB' || code === 'CLOTH-MPCB-CONSENT') {
    costFormula = 'Capital-investment-based MPCB fee slab';
    costType = 'formula';
    status = 'verified';
    if (investmentAmountInr < 10000000) { // < ₹1 Cr
      envMin = 10000; envMax = 25000;
    } else if (investmentAmountInr < 50000000) { // ₹1 Cr - ₹5 Cr
      envMin = 35000; envMax = 60000;
    } else if (investmentAmountInr < 100000000) { // ₹5 Cr - ₹10 Cr
      envMin = 100000; envMax = 125000;
    } else if (investmentAmountInr < 500000000) { // ₹10 Cr - ₹50 Cr
      envMin = 150000; envMax = 250000;
    } else { // > ₹50 Cr
      envMin = 300000; envMax = 500000;
    }
    note = `Computed dynamically from capital investment (₹${(investmentAmountInr / 100000).toFixed(1)}L) under MPCB Consent Fee Slabs.`;
  }
  // 2. Excise BRL / Craft Beer Licence
  else if (code === 'BRL-001' || code === 'BRW-BRL') {
    costFormula = 'FY2026-27 Maharashtra State Excise BRL Fee Schedule';
    costType = 'formula';
    govtMin = 1220000; govtMax = 1220000;
    status = 'verified';
    note = 'Official FY2026-27 BRL licence fee for standalone commercial brewery.';
  }
  else if (code === 'BRW-CRAFT') {
    costFormula = '₹3,20,100 up to 2,00,000 BL capacity';
    costType = 'formula';
    govtMin = 320100; govtMax = capacityValue > 200000 ? 600200 : 320100;
    status = 'verified';
    note = 'Microbrewery B-3 licence fee based on annual production capacity.';
  }
  // 3. FSSAI Licence
  else if (code.includes('FSSAI')) {
    costFormula = 'FSSAI FoSCoS Licence Schedule';
    costType = 'formula';
    status = 'verified';
    if (investmentAmountInr >= 50000000 || capacityValue > 1000) {
      govtMin = 7500; govtMax = 7500; // Central Licence
      note = 'FSSAI Central Licence fee (₹7,500/yr) for large scale / high investment food & beverage manufacturing.';
    } else {
      govtMin = 3000; govtMax = 5000; // State Licence
      note = 'FSSAI State Licence fee (₹3,000–₹5,000/yr) for medium scale food unit.';
    }
  }
  // 4. Pharma Drug Manufacturing Licence
  else if (code === 'PHARMA-DRUG') {
    costFormula = '₹6,000 licence fee + ₹1,500 inspection fee';
    costType = 'formula';
    govtMin = 6000; govtMax = 6000;
    inspMin = 1500; inspMax = 1500;
    status = 'verified';
    note = 'Maharashtra FDA statutory drug manufacturing licence fee (Form 25/28) + inspection fee.';
  }

  return {
    govtMin, govtMax, regMin, regMax, inspMin, inspMax,
    docMin, docMax, othMin, othMax, envMin, envMax,
    status, note, costFormula, costType,
  };
}

function resolveTime(row: {
  processingTimeMinDays: number | null;
  processingTimeMaxDays: number | null;
  timeBasis: string | null;
  timeStatus: string | null;
  timeSourceNote: string | null;
  slaDays: number | null;
}): TimeEvidence {
  if (row.processingTimeMinDays !== null || row.processingTimeMaxDays !== null) {
    const minD = row.processingTimeMinDays;
    const maxD = row.processingTimeMaxDays ?? row.processingTimeMinDays;
    const isOfficial = row.timeStatus === 'verified' || row.timeBasis === 'working_days' || row.timeBasis === 'sla_days';
    return {
      minDays: minD,
      maxDays: maxD,
      basis: row.timeBasis ?? 'working_days',
      status: row.timeStatus ?? 'configured',
      note: row.timeSourceNote,
      durationType: isOfficial ? 'official_notified' : 'planning_estimate',
    };
  }
  if (row.slaDays !== null) {
    return {
      minDays: row.slaDays,
      maxDays: row.slaDays,
      basis: 'sla_days',
      status: 'verified',
      note: 'RTS Act notified statutory SLA.',
      durationType: 'official_notified',
    };
  }
  return {
    minDays: null,
    maxDays: null,
    basis: null,
    status: 'unknown',
    note: 'No statutory SLA published. Treat as unconfigured planning estimate.',
    durationType: 'unknown',
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

    // Extract business profile parameters for dynamic fee & complexity calculations
    const profileValues = (latestProfile?.values as Record<string, { value?: unknown }> | undefined) ?? {};
    const investmentVal = profileValues['investmentAmountInr']?.value;
    const investmentAmountInr = typeof investmentVal === 'number' ? investmentVal : 50000000; // Default ₹5 Cr
    const capacityVal = profileValues['employeeCount']?.value ?? 0;

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
      cost: evaluateDynamicCost(
        i.approvalDefinition.code,
        {
          govtFeeMinInr: i.approvalDefinition.govtFeeMinInr,
          govtFeeMaxInr: i.approvalDefinition.govtFeeMaxInr,
          registrationFeeMinInr: i.approvalDefinition.registrationFeeMinInr,
          registrationFeeMaxInr: i.approvalDefinition.registrationFeeMaxInr,
          inspectionFeeMinInr: i.approvalDefinition.inspectionFeeMinInr,
          inspectionFeeMaxInr: i.approvalDefinition.inspectionFeeMaxInr,
          documentationCostMinInr: i.approvalDefinition.documentationCostMinInr,
          documentationCostMaxInr: i.approvalDefinition.documentationCostMaxInr,
          otherCostMinInr: i.approvalDefinition.otherCostMinInr,
          otherCostMaxInr: i.approvalDefinition.otherCostMaxInr,
          costStatus: i.approvalDefinition.costStatus,
          costSourceNote: i.approvalDefinition.costSourceNote,
        },
        investmentAmountInr,
        typeof capacityVal === 'number' ? capacityVal : 0,
      ),
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
    // Kahn Topological Forward Pass (Critical Path over Dependency Graph)
    // -----------------------------------------------------------------
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
    if (ordered.length < rows.length) {
      const seen = new Set(ordered);
      for (const r of rows) if (!seen.has(r.id)) ordered.push(r.id);
    }

    const earliestStart = new Map<string, number>();
    const earliestFinish = new Map<string, number>();
    const finishMinChain = new Map<string, number>();
    const durMin = new Map<string, number>();
    const durMax = new Map<string, number>();

    for (const r of rows) {
      durMin.set(r.id, r.time.minDays ?? 15);
      durMax.set(r.id, r.time.maxDays ?? 30);
    }
    for (const id of ordered) {
      const deps = edges.filter((e) => e.from === id).map((e) => e.to);
      const start = deps.length === 0 ? 0 : Math.max(...deps.map((d) => earliestFinish.get(d) ?? 0));
      earliestStart.set(id, start);
      earliestFinish.set(id, start + (durMax.get(id) ?? 0));
      const startMin = deps.length === 0 ? 0 : Math.max(...deps.map((d) => finishMinChain.get(d) ?? 0));
      finishMinChain.set(id, startMin + (durMin.get(id) ?? 0));
    }

    let rawCriticalPathMin = 0;
    let rawCriticalPathMax = 0;
    for (const id of ordered) {
      rawCriticalPathMin = Math.max(rawCriticalPathMin, finishMinChain.get(id) ?? 0);
      rawCriticalPathMax = Math.max(rawCriticalPathMax, earliestFinish.get(id) ?? 0);
    }

    // Critical Path traversal
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

    // Engine Parallel Gating Layers
    const engine = await loadEngineGraph();
    const engineDeps: EngineDependency[] = edges.map((e) => ({ from: e.from, to: e.to, relationship: 'depends_on' }));
    const idSet = new Set(rows.map((r) => r.id));
    const { layers } = engine.gatingLayers([...idSet], engineDeps);
    const parallelGroups = layers.map((layer, idx) => ({
      layerIndex: idx,
      approvalIds: layer.map((id) => rowByDefId.get(id)?.code ?? id),
      startDay: Math.max(...layer.map((id) => earliestStart.get(id) ?? 0)),
      finishDayMax: Math.max(...layer.map((id) => earliestFinish.get(id) ?? 0)),
    }));

    // -----------------------------------------------------------------
    // Business Complexity & Start-Timeline Uncertainty Model
    // -----------------------------------------------------------------
    const industryCode = project.industry.toLowerCase();
    const hasExcise = rows.some((r) => r.code.includes('BRL') || r.code.includes('EXCISE') || r.code.includes('CRAFT'));
    const hasPharma = rows.some((r) => r.code.includes('PHARMA') || r.code.includes('DRUG'));
    const hasMpcb = rows.some((r) => r.code.includes('MPCB') || r.code.includes('DYE'));
    const hasDish = rows.some((r) => r.code.includes('DISH') || r.code.includes('FACT'));
    const hasFire = rows.some((r) => r.code.includes('FIRE'));

    let complexityScore = 0.3; // Baseline
    const complexityFactors: string[] = [];

    if (investmentAmountInr >= 50000000) { // >= ₹5 Cr
      complexityScore += 0.2;
      complexityFactors.push(`High capital investment (₹${(investmentAmountInr / 10000000).toFixed(1)} Cr) increases documentation and inspection depth.`);
    }
    if (hasExcise) {
      complexityScore += 0.25;
      complexityFactors.push('State Excise licensing requires dual-stage vetting, background verification, and LOI clearance.');
    }
    if (hasPharma) {
      complexityScore += 0.25;
      complexityFactors.push('Pharma FDA licensing requires statutory factory layout verification, GLP/GMP compliance, and technical sampling.');
    }
    if (hasMpcb) {
      complexityScore += 0.15;
      complexityFactors.push('Environmental consent (Consent to Establish & Operate) requires pollution category review and effluent plant inspection.');
    }
    if (hasDish) {
      complexityScore += 0.1;
      complexityFactors.push('DISH factory plan sanction & worker safety inspection required.');
    }

    const officialCount = rows.filter((r) => r.time.durationType === 'official_notified').length;
    const planningCount = rows.filter((r) => r.time.durationType === 'planning_estimate').length;
    const unknownCount = rows.filter((r) => r.time.durationType === 'unknown').length;

    if (unknownCount > 0) {
      complexityScore += 0.1;
      complexityFactors.push(`${unknownCount} approval(s) carry unconfigured SLA timelines, adding operational scheduling uncertainty.`);
    }

    complexityScore = Math.min(1.0, Math.max(0.1, complexityScore));
    const complexityLevel = complexityScore >= 0.7 ? 'high' : complexityScore >= 0.4 ? 'medium' : 'low';

    // Calculate Business Start Timeline Range with Uncertainty Buffer
    let estimatedMinDays = rawCriticalPathMin;
    let estimatedMaxDays = rawCriticalPathMax;

    if (industryCode.includes('brewery') || hasExcise) {
      // Brewery benchmark range: 180–240 working days
      estimatedMinDays = Math.max(180, Math.round(rawCriticalPathMin * 1.1));
      estimatedMaxDays = Math.max(240, Math.round(rawCriticalPathMax * 1.4));
    } else if (industryCode.includes('pharma') || hasPharma) {
      // Pharma benchmark range: 180–240 working days
      estimatedMinDays = Math.max(180, Math.round(rawCriticalPathMin * 1.15));
      estimatedMaxDays = Math.max(240, Math.round(rawCriticalPathMax * 1.35));
    } else if (industryCode.includes('food') || industryCode.includes('beverage')) {
      // Food benchmark range: 90–120 working days
      estimatedMinDays = Math.max(90, Math.round(rawCriticalPathMin * 1.05));
      estimatedMaxDays = Math.max(120, Math.round(rawCriticalPathMax * 1.25));
    } else if (industryCode.includes('clothing') || industryCode.includes('garment')) {
      // Clothing benchmark range: 45–70 working days
      estimatedMinDays = Math.max(45, Math.round(rawCriticalPathMin * 1.0));
      estimatedMaxDays = Math.max(70, Math.round(rawCriticalPathMax * 1.2));
    } else {
      // General manufacturing default
      estimatedMinDays = Math.max(60, Math.round(rawCriticalPathMin * 1.1));
      estimatedMaxDays = Math.max(120, Math.round(rawCriticalPathMax * 1.3));
    }

    const estimatedTimeRangeStr = `${estimatedMinDays}–${estimatedMaxDays} working days`;

    // -----------------------------------------------------------------
    // Cost Aggregation & Fee Formula Resolution
    // -----------------------------------------------------------------
    const categorySum = (pick: (c: CostEvidence) => [number | null, number | null]) =>
      sumNullable(rows.map((r) => pick(r.cost)));

    const govt = categorySum((c) => [c.govtMin, c.govtMax]);
    const reg = categorySum((c) => [c.regMin, c.regMax]);
    const insp = categorySum((c) => [c.inspMin, c.inspMax]);
    const doc = categorySum((c) => [c.docMin, c.docMax]);
    const oth = categorySum((c) => [c.othMin, c.othMax]);
    const env = categorySum((c) => [c.envMin, c.envMax]);

    const total = sumNullable([govt, reg, insp, doc, oth, env].map((x) => [x.min, x.max] as [number | null, number | null]));
    const estimatedCostRangeStr = formatInrRange(total.min, total.max);

    // Timeline Rows for Frontend Table & Gantt
    const timeline = rows.map((r) => {
      const deps = edges.filter((e) => e.from === r.id).map((e) => e.to);
      const dependents = edges.filter((e) => e.to === r.id).map((e) => e.from);
      const startMin = earliestStart.get(r.id) ?? 0;
      const dMin = r.time.minDays;
      const dMax = r.time.maxDays;
      const durKnown = dMin !== null || dMax !== null;
      const onCriticalPath = criticalPathIds.includes(r.id);
      const dependencyLabel = deps.length === 0 ? null : deps.map((d) => rowByDefId.get(d)?.code ?? d).join('; ');

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
        durationType: r.time.durationType,
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

    const costRows = rows.map((r) => {
      const t = sumNullable([
        [r.cost.govtMin, r.cost.govtMax],
        [r.cost.regMin, r.cost.regMax],
        [r.cost.inspMin, r.cost.inspMax],
        [r.cost.docMin, r.cost.docMax],
        [r.cost.othMin, r.cost.othMax],
        [r.cost.envMin, r.cost.envMax],
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
        environmentalFee: { min: r.cost.envMin, max: r.cost.envMax },
        total: t,
        formattedTotal: formatInrRange(t.min, t.max),
        costStatus: r.cost.status,
        costSourceNote: r.cost.note,
        costFormula: r.cost.costFormula,
        costType: r.cost.costType,
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
    // Executive Bullet Points: "Why This Estimate?"
    // -----------------------------------------------------------------
    const whyThisEstimate: string[] = [];
    whyThisEstimate.push(`${rows.length} statutory regulatory clearance processes apply to this business profile.`);
    
    if (edges.length > 0) {
      whyThisEstimate.push(`${edges.length} major gating approval dependencies require strict sequential processing.`);
    } else {
      whyThisEstimate.push('Multiple approvals can proceed concurrently in parallel tracks.');
    }

    if (hasMpcb) {
      whyThisEstimate.push('Environmental Clearance (MPCB Consent to Establish) is a major critical-path time driver.');
    }
    if (hasExcise) {
      whyThisEstimate.push('State Excise licensing requires dual-stage background vetting and LOI issuance.');
    }
    if (hasPharma) {
      whyThisEstimate.push('Pharma FDA licensing involves technical laboratory inspection and GMP audit.');
    }
    if (hasDish) {
      whyThisEstimate.push('DISH Factory Plan approval and structural safety review are required.');
    }
    if (planningCount > 0) {
      whyThisEstimate.push(`${planningCount} timeline components rely on historical planning estimates rather than statutory SLAs.`);
    }
    if (costRows.some((c) => !c.costKnown)) {
      whyThisEstimate.push('1 or more minor municipal/departmental fee components require local departmental verification.');
    }

    // -----------------------------------------------------------------
    // Time Drivers Progress Breakdown
    // -----------------------------------------------------------------
    const totalMaxDaysForPercent = estimatedMaxDays > 0 ? estimatedMaxDays : 1;
    const timeDrivers = [
      { name: 'Environmental Consent (MPCB)', category: 'Environmental', maxDays: hasMpcb ? 90 : 0 },
      { name: 'Excise / Brand Licensing', category: 'Excise', maxDays: hasExcise ? 120 : 0 },
      { name: 'Factory Approval & DISH', category: 'Safety', maxDays: hasDish ? 30 : 0 },
      { name: 'Fire Safety & NOC', category: 'Fire', maxDays: hasFire ? 45 : 0 },
      { name: 'Pharma / FDA Clearance', category: 'Pharma', maxDays: hasPharma ? 120 : 0 },
      { name: 'General Registrations & GST', category: 'Registration', maxDays: 15 },
    ]
      .filter((d) => d.maxDays > 0)
      .map((d) => ({
        ...d,
        percentage: Math.min(100, Math.round((d.maxDays / totalMaxDaysForPercent) * 100)),
      }));

    // -----------------------------------------------------------------
    // Confidence & Data Quality Score
    // -----------------------------------------------------------------
    const timeKnownCount = timeline.filter((t) => t.timeKnown).length;
    const costKnownCount = costRows.filter((c) => c.costKnown).length;
    const fraction = (n: number) => (rows.length === 0 ? 0 : n / rows.length);
    const score = (fraction(timeKnownCount) + fraction(costKnownCount)) / 2;

    const confidenceLevel =
      rows.length === 0
        ? 'no_data'
        : score >= 0.75 && officialCount > 0
          ? 'high'
          : score >= 0.4
            ? 'medium'
            : 'limited';

    const confidenceExplanation: string[] = [
      `${officialCount} of ${rows.length} approvals carry an official/verified statutory processing SLA (e.g. RTS Act notified).`,
      `${planningCount} approval(s) carry historical benchmark planning estimates.`,
      `Fee formulas calculated dynamically using configured investment (₹${(investmentAmountInr / 100000).toFixed(1)}L) and capacity parameters.`,
      'Estimates assume complete application filings; re-inspections and clarification queries can extend timelines.',
    ];

    const delayFactors: Array<{ factor: string; affectedApprovals: string[]; basis: string }> = [];
    if (unknownCount > 0) {
      delayFactors.push({
        factor: 'No statutory SLA is published for some approvals — departmental query rounds can extend timelines.',
        affectedApprovals: timeline.filter((t) => !t.timeKnown).map((t) => t.code),
        basis: 'duration_type = unknown in regulatory dataset',
      });
    }
    if (rows.some((r) => r.inspectionRequired)) {
      delayFactors.push({
        factor: 'Site inspection is required — inspector availability and scheduling can add processing days.',
        affectedApprovals: rows.filter((r) => r.inspectionRequired).map((r) => r.code),
        basis: 'inspection_required = true in approval definition',
      });
    }

    return {
      projectId,
      project,
      profile: latestProfile
        ? { versionNumber: latestProfile.versionNumber, status: latestProfile.status }
        : null,
      hasData: true,
      businessContext: {
        industry: project.industry,
        investmentAmountInr,
        location: (latestProfile?.values as Record<string, { value?: unknown }> | undefined) ?? null,
      },
      time: {
        estimatedTimeRangeStr,
        estimatedMinWorkingDays: estimatedMinDays,
        estimatedMaxWorkingDays: estimatedMaxDays,
        basis: 'Calculated over dependency graph critical path with parallel processing and complexity uncertainty range.',
        criticalPath: criticalPathIds.map((id) => rowByDefId.get(id)?.code ?? id),
        parallelGroups,
        parallelApprovalCodes: [...new Set(parallelGroups.filter((g) => g.approvalIds.length > 1).flatMap((g) => g.approvalIds))],
        approvalsMissingTime: timeline.filter((t) => !t.timeKnown).map((t) => t.code),
      },
      cost: {
        currency: 'INR',
        estimatedCostRangeStr,
        governmentFees: govt,
        registrationFees: reg,
        inspectionFees: insp,
        documentationCosts: doc,
        environmentalFees: env,
        otherComplianceCosts: oth,
        total,
        approvalsMissingCost: costRows.filter((c) => !c.costKnown).map((c) => c.code),
        note: 'Totals are approximate regulatory setup costs derived from configured fee slabs. Non-regulatory capital/operational costs (land, machinery, rent, salaries) are excluded.',
      },
      complexity: {
        level: complexityLevel,
        score: Math.round(complexityScore * 100) / 100,
        factors: complexityFactors,
      },
      whyThisEstimate,
      timeDrivers,
      dataQuality: {
        officialEvidenceCount: officialCount,
        planningEstimatesCount: planningCount,
        unknownCount,
      },
      confidence: {
        level: confidenceLevel,
        score: Math.round(score * 100) / 100,
        explanation: confidenceExplanation,
      },
      timeline,
      costRows,
      delayFactors,
      generatedAt: new Date().toISOString(),
    };
  }
}

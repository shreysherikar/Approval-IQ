import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Regulatory Change Impact Engine
//
// Compares old vs new applicability conditions against each project's
// confirmed business profile to determine which businesses are affected.
// ---------------------------------------------------------------------------

/** Engine condition node (mirrors the approval-engine's typed condition tree). */
type EngineCondition =
  | { kind: 'all'; conditions: EngineCondition[] }
  | { kind: 'any'; conditions: EngineCondition[] }
  | { kind: 'not'; condition: EngineCondition }
  | { kind: 'eq'; field: string; value: string }
  | { kind: 'in'; field: string; values: string[] }
  | { kind: 'range'; field: string; min?: number; max?: number; minInclusive?: boolean; maxInclusive?: boolean; expectedAreaType?: string; expectedInvestmentDefinition?: string }
  | { kind: string; [k: string]: unknown };

type EvalResult = { pass: boolean; reason: string };

/** Evaluate a single condition node against a profile snapshot. */
function evalCondition(cond: EngineCondition, profile: Record<string, unknown>): EvalResult {
  if (!cond || typeof cond !== 'object') return { pass: false, reason: 'Unknown condition' };
  const c = cond as Record<string, unknown>;
  const kind = c.kind as string;
  switch (kind) {
    case 'all': {
      const children = (c.conditions ?? []) as EngineCondition[];
      for (const child of children) {
        const r = evalCondition(child, profile);
        if (!r.pass) return r;
      }
      return { pass: true, reason: 'All conditions met' };
    }
    case 'any': {
      const children = (c.conditions ?? []) as EngineCondition[];
      for (const child of children) {
        const r = evalCondition(child, profile);
        if (r.pass) return { pass: true, reason: 'At least one condition met' };
      }
      return { pass: false, reason: 'No conditions met' };
    }
    case 'not': {
      const r = evalCondition(c.condition as EngineCondition, profile);
      return { pass: !r.pass, reason: r.pass ? 'Negated condition was true' : 'Negated condition was false' };
    }
    case 'eq': {
      const field = String(c.field ?? '');
      const val = profile[field];
      const strVal = typeof val === 'object' && val !== null && 'value' in val
        ? String((val as { value: unknown }).value)
        : String(val ?? '');
      if (strVal === 'unknown' || strVal === 'undefined' || strVal === '') {
        return { pass: false, reason: `Field '${field}' is unknown` };
      }
      return { pass: strVal === String(c.value ?? ''), reason: `Field '${field}' is '${strVal}'` };
    }
    case 'in': {
      const field = String(c.field ?? '');
      const val = profile[field];
      const strVal = typeof val === 'object' && val !== null && 'value' in val
        ? String((val as { value: unknown }).value)
        : String(val ?? '');
      if (strVal === 'unknown' || strVal === 'undefined' || strVal === '') {
        return { pass: false, reason: `Field '${field}' is unknown` };
      }
      const values = Array.isArray(c.values) ? c.values.map(String) : [];
      return { pass: values.includes(strVal), reason: `Field '${field}' value '${strVal}' ${values.includes(strVal) ? 'is in' : 'is not in'} [${values.join(', ')}]` };
    }
    case 'range': {
      const field = String(c.field ?? '');
      const val = profile[field];
      const numVal = typeof val === 'object' && val !== null && 'value' in val
        ? Number((val as { value: unknown }).value)
        : Number(val ?? NaN);
      if (Number.isNaN(numVal)) return { pass: false, reason: `Field '${field}' is unknown or not numeric` };
      const min = typeof c.min === 'number' ? c.min : undefined;
      const max = typeof c.max === 'number' ? c.max : undefined;
      const minOk = min === undefined || (c.minInclusive !== false ? numVal >= min : numVal > min);
      const maxOk = max === undefined || (c.maxInclusive !== false ? numVal <= max : numVal < max);
      return { pass: minOk && maxOk, reason: `${field}=${numVal} ${minOk && maxOk ? 'within' : 'outside'} range` };
    }
    default:
      return { pass: false, reason: `Unknown condition kind: ${kind}` };
  }
}

function parseConditions(raw: unknown): EngineCondition | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return undefined;
    if (t.startsWith('{') || t.startsWith('[')) {
      try { return parseConditions(JSON.parse(t)); } catch { return undefined; }
    }
    return undefined;
  }
  if (typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.all)) return { kind: 'all', conditions: obj.all.map(c => parseConditions(c)).filter(Boolean) as EngineCondition[] };
  if (Array.isArray(obj.any)) return { kind: 'any', conditions: obj.any.map(c => parseConditions(c)).filter(Boolean) as EngineCondition[] };
  if (obj.kind) return obj as unknown as EngineCondition;
  // Operator-based clause
  if (typeof obj.field === 'string') {
    const op = (typeof obj.op === 'string' ? obj.op : 'eq').toLowerCase();
    if (op === 'in' && Array.isArray(obj.values)) return { kind: 'in', field: obj.field, values: obj.values.map(String) };
    if (op === 'equals' || op === 'eq') return { kind: 'eq', field: obj.field, value: String(obj.value ?? '') };
    if (op === 'range' || op === 'gte' || op === 'gt' || op === 'lte' || op === 'lt') {
      const range: Record<string, unknown> = { kind: 'range', field: obj.field };
      if (typeof obj.min === 'number') range.min = obj.min;
      if (typeof obj.max === 'number') range.max = obj.max;
      if (typeof obj.value === 'number') {
        if (op === 'gte') { range.min = obj.value; range.minInclusive = true; }
        if (op === 'gt') { range.min = obj.value; range.minInclusive = false; }
        if (op === 'lte') { range.max = obj.value; range.maxInclusive = true; }
        if (op === 'lt') { range.max = obj.value; range.maxInclusive = false; }
      }
      if (obj.field === 'areaSqft') range.expectedAreaType = obj.expectedAreaType ?? 'built_up';
      if (obj.field === 'investmentAmountInr') range.expectedInvestmentDefinition = obj.expectedInvestmentDefinition ?? 'total_project_cost';
      return range as unknown as EngineCondition;
    }
  }
  return undefined;
}

@Injectable()
export class RegulatoryChangesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** List all regulatory changes, newest first. */
  async list(): Promise<Record<string, unknown>[]> {
    const changes = await this.prisma.regulatoryChange.findMany({
      include: {
        approvalDefinition: { select: { id: true, code: true, name: true, authority: { select: { name: true } } } },
        _count: { select: { impacts: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return changes.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      approval: { id: c.approvalDefinition.id, code: c.approvalDefinition.code, name: c.approvalDefinition.name },
      authority: c.approvalDefinition.authority?.name ?? null,
      oldConditions: c.oldConditions,
      newConditions: c.newConditions,
      effectiveDate: c.effectiveDate,
      sourceUrl: c.sourceUrl,
      sourceNotes: c.sourceNotes,
      status: c.status,
      totalImpacts: c._count.impacts,
      createdAt: c.createdAt,
    }));
  }

  /** Get one regulatory change by id. */
  async findOne(id: string): Promise<Record<string, unknown>> {
    const change = await this.prisma.regulatoryChange.findUnique({
      where: { id },
      include: {
        approvalDefinition: { select: { id: true, code: true, name: true, whyRequired: true, authority: { select: { name: true } }, source: { select: { url: true, title: true } } } },
      },
    });
    if (!change) throw new NotFoundException(`Regulatory change '${id}' not found`);
    return {
      id: change.id,
      title: change.title,
      description: change.description,
      approval: change.approvalDefinition,
      oldConditions: change.oldConditions,
      newConditions: change.newConditions,
      effectiveDate: change.effectiveDate,
      sourceUrl: change.sourceUrl,
      sourceNotes: change.sourceNotes,
      status: change.status,
      createdAt: change.createdAt,
    };
  }

  /** Create a new regulatory change (draft status). */
  async create(body: {
    title: string;
    description: string;
    approvalDefinitionId: string;
    oldConditions: unknown;
    newConditions: unknown;
    effectiveDate: string;
    sourceUrl?: string | undefined;
    sourceNotes?: string | undefined;
    createdByUserId: string;
  }): Promise<Record<string, unknown>> {
    if (!body.title?.trim()) throw new BadRequestException('title is required');
    if (!body.approvalDefinitionId) throw new BadRequestException('approvalDefinitionId is required');
    if (!body.effectiveDate) throw new BadRequestException('effectiveDate is required');

    // Verify approval definition exists
    const approval = await this.prisma.approvalDefinition.findUnique({
      where: { id: body.approvalDefinitionId },
      select: { id: true },
    });
    if (!approval) throw new NotFoundException(`Approval definition '${body.approvalDefinitionId}' not found`);

    const created = await this.prisma.regulatoryChange.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() ?? '',
        approvalDefinitionId: body.approvalDefinitionId,
        oldConditions: body.oldConditions as Prisma.InputJsonValue,
        newConditions: body.newConditions as Prisma.InputJsonValue,
        effectiveDate: new Date(body.effectiveDate),
        sourceUrl: body.sourceUrl ?? null,
        sourceNotes: body.sourceNotes ?? null,
        status: 'draft',
        createdByUserId: body.createdByUserId,
      },
      include: {
        approvalDefinition: { select: { code: true, name: true } },
      },
    });

    return {
      id: created.id,
      title: created.title,
      description: created.description,
      approval: created.approvalDefinition,
      status: created.status,
      effectiveDate: created.effectiveDate,
      createdAt: created.createdAt,
    };
  }

  /** Run impact analysis on a regulatory change against all confirmed business profiles. */
  async analyzeImpact(id: string): Promise<Record<string, unknown>> {
    const change = await this.prisma.regulatoryChange.findUnique({
      where: { id },
      include: {
        approvalDefinition: { select: { id: true, code: true, name: true } },
      },
    });
    if (!change) throw new NotFoundException(`Regulatory change '${id}' not found`);

    const oldCond = parseConditions(change.oldConditions);
    const newCond = parseConditions(change.newConditions);

    // Find all projects with confirmed profiles
    const profileVersions = await this.prisma.businessProfileVersion.findMany({
      where: { status: 'confirmed' },
      include: {
        project: {
          select: {
            id: true, name: true, industry: true, businessId: true,
          },
        },
      },
    });

    // Clear previous impacts
    await this.prisma.regulatoryChangeImpact.deleteMany({ where: { regulatoryChangeId: id } });

    const impacts: Array<Record<string, unknown>> = [];

    for (const pv of profileVersions) {
      const profile = pv.values as Record<string, unknown>;
      const oldResult = oldCond ? evalCondition(oldCond, profile) : { pass: true, reason: 'No old condition (always applicable)' };
      const newResult = newCond ? evalCondition(newCond, profile) : { pass: true, reason: 'No new condition (always applicable)' };

      let impactType: string;
      let priority: string;
      let explanation: string;
      let requiredAction: string | null = null;
      let changedCondition: string | null = null;

      if (!oldResult.pass && newResult.pass) {
        impactType = 'newly_affected';
        priority = 'high';
        explanation = `Previously, this business did not require ${change.approvalDefinition.name} because: ${oldResult.reason}. Under the new rule, the business is now affected because: ${newResult.reason}. The business may need to initiate ${change.approvalDefinition.name} from ${new Date(change.effectiveDate).toLocaleDateString()}.`;
        requiredAction = `Evaluate whether ${change.approvalDefinition.name} applies and initiate application if required`;
      } else if (oldResult.pass && !newResult.pass) {
        impactType = 'no_longer_affected';
        priority = 'medium';
        explanation = `Previously, this business required ${change.approvalDefinition.name} because: ${oldResult.reason}. Under the new rule, the business is no longer affected because: ${newResult.reason}.`;
        requiredAction = null;
      } else if (oldResult.pass && newResult.pass) {
        // Both pass — check if conditions differ
        const oldStr = JSON.stringify(change.oldConditions);
        const newStr = JSON.stringify(change.newConditions);
        if (oldStr !== newStr) {
          impactType = 'requirement_changed';
          priority = 'medium';
          explanation = `This business remains affected by ${change.approvalDefinition.name}. The conditions have changed (old: ${oldResult.reason}, new: ${newResult.reason}). Requirements may differ under the new rule.`;
          requiredAction = 'Review updated requirements for compliance under new conditions';
          changedCondition = `Old: ${oldResult.reason} | New: ${newResult.reason}`;
        } else {
          impactType = 'no_material_impact';
          priority = 'no_impact';
          explanation = 'The regulatory change does not materially affect this business — both old and new conditions produce the same result.';
        }
      } else {
        // Both fail
        impactType = 'no_material_impact';
        priority = 'no_impact';
        explanation = `This business was not affected under the old rule (${oldResult.reason}) and remains unaffected under the new rule (${newResult.reason}).`;
      }

      const impact = await this.prisma.regulatoryChangeImpact.create({
        data: {
          regulatoryChangeId: id,
          projectId: pv.projectId,
          impactType: impactType as 'newly_affected' | 'no_longer_affected' | 'requirement_changed' | 'no_material_impact',
          priority: priority as 'critical' | 'high' | 'medium' | 'low' | 'no_impact',
          oldApplicability: oldResult.pass ? 'Applicable' : `Not applicable: ${oldResult.reason}`,
          newApplicability: newResult.pass ? 'Applicable' : `Not applicable: ${newResult.reason}`,
          changedCondition,
          requiredAction,
          explanation,
          confidence: (oldCond && newCond) ? 'high' : 'medium',
        },
      });

      impacts.push({
        id: impact.id,
        projectId: pv.projectId,
        project: { name: pv.project.name, industry: pv.project.industry, businessId: pv.project.businessId },
        impactType: impact.impactType,
        priority: impact.priority,
        oldApplicability: impact.oldApplicability,
        newApplicability: impact.newApplicability,
        changedCondition: impact.changedCondition,
        requiredAction: impact.requiredAction,
        explanation: impact.explanation,
        confidence: impact.confidence,
      });
    }

    // Update change status
    await this.prisma.regulatoryChange.update({
      where: { id },
      data: { status: 'analyzed' },
    });

    return {
      changeId: id,
      status: 'analyzed',
      totalBusinessesAnalyzed: profileVersions.length,
      summary: {
        newlyAffected: impacts.filter(i => i.impactType === 'newly_affected').length,
        noLongerAffected: impacts.filter(i => i.impactType === 'no_longer_affected').length,
        requirementChanged: impacts.filter(i => i.impactType === 'requirement_changed').length,
        noMaterialImpact: impacts.filter(i => i.impactType === 'no_material_impact').length,
        needsReview: impacts.filter(i => i.impactType === 'needs_review').length,
      },
      impacts,
    };
  }

  /** Get all impacts for a regulatory change, with optional filters. */
  async getImpacts(
    changeId: string,
    filters: { impactType?: string; priority?: string; industry?: string } = {},
  ): Promise<Record<string, unknown>> {
    const change = await this.prisma.regulatoryChange.findUnique({
      where: { id: changeId },
      include: { approvalDefinition: { select: { code: true, name: true } } },
    });
    if (!change) throw new NotFoundException(`Regulatory change '${changeId}' not found`);

    const where: Prisma.RegulatoryChangeImpactWhereInput = { regulatoryChangeId: changeId };
    if (filters.impactType) where.impactType = filters.impactType as 'newly_affected';
    if (filters.priority) where.priority = filters.priority as 'critical';

    const impacts = await this.prisma.regulatoryChangeImpact.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, industry: true, businessId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      changeId,
      approval: change.approvalDefinition,
      filters,
      total: impacts.length,
      impacts: impacts.map(i => ({
        id: i.id,
        projectId: i.projectId,
        project: i.project,
        impactType: i.impactType,
        priority: i.priority,
        oldApplicability: i.oldApplicability,
        newApplicability: i.newApplicability,
        changedCondition: i.changedCondition,
        requiredAction: i.requiredAction,
        explanation: i.explanation,
        confidence: i.confidence,
        createdAt: i.createdAt,
      })),
    };
  }

  /** Get impacts for a specific project (business-level impact view). */
  async getProjectImpacts(projectId: string): Promise<Record<string, unknown>[]> {
    const impacts = await this.prisma.regulatoryChangeImpact.findMany({
      where: { projectId },
      include: {
        regulatoryChange: {
          select: {
            id: true, title: true, effectiveDate: true, status: true,
            approvalDefinition: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return impacts.map(i => ({
      id: i.id,
      regulatoryChange: i.regulatoryChange,
      impactType: i.impactType,
      priority: i.priority,
      oldApplicability: i.oldApplicability,
      newApplicability: i.newApplicability,
      changedCondition: i.changedCondition,
      requiredAction: i.requiredAction,
      explanation: i.explanation,
      confidence: i.confidence,
      effectiveDate: i.regulatoryChange.effectiveDate,
      createdAt: i.createdAt,
    }));
  }
}

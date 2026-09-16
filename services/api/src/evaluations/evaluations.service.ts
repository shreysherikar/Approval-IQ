import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Engine entry point resolved at runtime via dynamic import (engine ships ESM; API is CJS). */
type EngineEvaluateFn = (profile: never, defs: never, deps: never) => unknown;

export const ENGINE_VERSION = '0.0.1';

/** Local structural mirror of the engine's Condition (avoids CJS/ESM static import). */
export type EngineCondition =
  | { kind: 'all'; conditions: readonly EngineCondition[] }
  | { kind: 'any'; conditions: readonly EngineCondition[] }
  | { kind: 'not'; condition: EngineCondition }
  | { kind: 'eq'; field: string; value: string }
  | { kind: 'in'; field: string; values: readonly string[] }
  | { kind: 'range'; field: string; [k: string]: unknown };

export type EngineRelationship = 'depends_on' | 'informational' | 'parallel_with' | 'unknown';

type KnownField = { status: 'known'; value: string };
type ProfileLike = { industry: { status: string; value?: string } };

type DbApproval = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  ruleKind: string;
  jurisdiction: string | null;
  whyRequired: string;
  officialApplicationUrl: string | null;
  lastVerifiedDate: Date;
  applicabilityConditions: unknown;
  exclusionConditions: unknown;
  exclusionReason: string | null;
  source: { url: string; title?: string } | null;
  requirements: Array<{ documentDefinition: { code: string; name: string } }>;
};

/**
 * Marker for an applicability condition that cannot be represented as the
 * engine's supported typed condition tree (e.g. free-text prose from the
 * regulatory dataset, or structured JSON with no supported clauses). The
 * engine's interpreter treats any unrecognized condition kind as unsupported
 * and reports the approval as `not_evaluable` — never a false `not_applicable`
 * and never a thrown error that would break sibling approvals.
 */
const NOT_MACHINE_EVALUABLE: EngineCondition = {
  kind: 'not_machine_evaluable',
} as unknown as EngineCondition;

/**
 * Helper to parse a single condition clause or sub-tree from either native
 * engine JSON or legacy CSV clause representation.
 */
function parseSingleCondition(item: unknown): EngineCondition | undefined {
  if (typeof item !== 'object' || item === null) return undefined;
  const obj = item as Record<string, unknown>;

  // Direct native engine kind
  if (typeof obj.kind === 'string') {
    switch (obj.kind) {
      case 'all':
      case 'any': {
        if (!Array.isArray(obj.conditions)) return NOT_MACHINE_EVALUABLE;
        const parsed = obj.conditions.map(parseSingleCondition).filter((c): c is EngineCondition => c !== undefined && c !== NOT_MACHINE_EVALUABLE);
        if (parsed.length === 0) return NOT_MACHINE_EVALUABLE;
        return { kind: obj.kind, conditions: parsed };
      }
      case 'not': {
        const child = parseSingleCondition(obj.condition);
        if (!child || child === NOT_MACHINE_EVALUABLE) return NOT_MACHINE_EVALUABLE;
        return { kind: 'not', condition: child };
      }
      case 'eq': {
        if (typeof obj.field === 'string' && typeof obj.value === 'string') {
          return { kind: 'eq', field: obj.field, value: obj.value };
        }
        return NOT_MACHINE_EVALUABLE;
      }
      case 'in': {
        if (typeof obj.field === 'string' && Array.isArray(obj.values)) {
          return { kind: 'in', field: obj.field, values: obj.values.map(String) };
        }
        return NOT_MACHINE_EVALUABLE;
      }
      case 'range': {
        if (typeof obj.field === 'string') {
          const rangeObj: Record<string, unknown> = { kind: 'range', field: obj.field };
          if (typeof obj.min === 'number') rangeObj.min = obj.min;
          if (typeof obj.max === 'number') rangeObj.max = obj.max;
          if (typeof obj.minInclusive === 'boolean') rangeObj.minInclusive = obj.minInclusive;
          if (typeof obj.maxInclusive === 'boolean') rangeObj.maxInclusive = obj.maxInclusive;
          if (obj.field === 'areaSqft') {
            rangeObj.expectedAreaType = (obj.expectedAreaType as string) ?? 'built_up';
          }
          if (obj.field === 'investmentAmountInr') {
            rangeObj.expectedInvestmentDefinition = (obj.expectedInvestmentDefinition as string) ?? 'total_project_cost';
          }
          return rangeObj as unknown as EngineCondition;
        }
        return NOT_MACHINE_EVALUABLE;
      }
      default:
        return NOT_MACHINE_EVALUABLE;
    }
  }

  // Operator-based clause: { field, op, value, ... }
  if (typeof obj.field === 'string') {
    const op = typeof obj.op === 'string' ? obj.op.toLowerCase() : 'equals';
    if (op === 'equals' || op === 'eq') {
      if (typeof obj.value === 'string') {
        return { kind: 'eq', field: obj.field, value: obj.value };
      }
      return NOT_MACHINE_EVALUABLE;
    }
    if (op === 'in') {
      const vals = Array.isArray(obj.values) ? obj.values : Array.isArray(obj.value) ? obj.value : null;
      if (vals) {
        return { kind: 'in', field: obj.field, values: vals.map(String) };
      }
      return NOT_MACHINE_EVALUABLE;
    }
    if (op === 'range' || op === 'gte' || op === 'gt' || op === 'lte' || op === 'lt') {
      const rangeObj: Record<string, unknown> = { kind: 'range', field: obj.field };
      if (typeof obj.min === 'number') rangeObj.min = obj.min;
      if (typeof obj.max === 'number') rangeObj.max = obj.max;
      if (op === 'gte') { rangeObj.min = Number(obj.value); rangeObj.minInclusive = true; }
      if (op === 'gt') { rangeObj.min = Number(obj.value); rangeObj.minInclusive = false; }
      if (op === 'lte') { rangeObj.max = Number(obj.value); rangeObj.maxInclusive = true; }
      if (op === 'lt') { rangeObj.max = Number(obj.value); rangeObj.maxInclusive = false; }
      if (typeof obj.minInclusive === 'boolean') rangeObj.minInclusive = obj.minInclusive;
      if (typeof obj.maxInclusive === 'boolean') rangeObj.maxInclusive = obj.maxInclusive;
      if (obj.field === 'areaSqft') {
        rangeObj.expectedAreaType = (obj.expectedAreaType as string) ?? 'built_up';
      }
      if (obj.field === 'investmentAmountInr') {
        rangeObj.expectedInvestmentDefinition = (obj.expectedInvestmentDefinition as string) ?? 'total_project_cost';
      }
      return rangeObj as unknown as EngineCondition;
    }
  }

  // Compound legacy all/any/not
  if (Array.isArray(obj.all)) {
    const conditions = obj.all.map(parseSingleCondition).filter((c): c is EngineCondition => c !== undefined && c !== NOT_MACHINE_EVALUABLE);
    return conditions.length > 0 ? { kind: 'all', conditions } : NOT_MACHINE_EVALUABLE;
  }
  if (Array.isArray(obj.any)) {
    const conditions = obj.any.map(parseSingleCondition).filter((c): c is EngineCondition => c !== undefined && c !== NOT_MACHINE_EVALUABLE);
    return conditions.length > 0 ? { kind: 'any', conditions } : NOT_MACHINE_EVALUABLE;
  }
  if (obj.not && typeof obj.not === 'object') {
    const child = parseSingleCondition(obj.not);
    return child && child !== NOT_MACHINE_EVALUABLE ? { kind: 'not', condition: child } : NOT_MACHINE_EVALUABLE;
  }

  return NOT_MACHINE_EVALUABLE;
}

/**
 * Translate applicability conditions (JSON strings, structured objects, or prose)
 * into the engine's typed Condition tree.
 */
export function toEngineCondition(raw: unknown): EngineCondition | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return toEngineCondition(JSON.parse(trimmed));
      } catch {
        return NOT_MACHINE_EVALUABLE;
      }
    }
    return NOT_MACHINE_EVALUABLE;
  }
  if (typeof raw !== 'object') return undefined;

  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.all)) {
    const conditions = obj.all.map(parseSingleCondition).filter((c): c is EngineCondition => c !== undefined && c !== NOT_MACHINE_EVALUABLE);
    if (conditions.length === 0) return NOT_MACHINE_EVALUABLE;
    return { kind: 'all', conditions };
  }
  if (Array.isArray(obj.any)) {
    const conditions = obj.any.map(parseSingleCondition).filter((c): c is EngineCondition => c !== undefined && c !== NOT_MACHINE_EVALUABLE);
    if (conditions.length === 0) return NOT_MACHINE_EVALUABLE;
    return { kind: 'any', conditions };
  }

  return parseSingleCondition(raw);
}


@Injectable()
export class EvaluationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(body: unknown): Promise<Record<string, unknown>> {
    const { createEvaluationSchema } = await import('@approvaliq/contracts');
    const parsed = createEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid evaluation request',
        details: parsed.error.flatten(),
      });
    }
    const profile = parsed.data.profile as unknown as Record<string, unknown>;
    const industry = (parsed.data.profile as unknown as ProfileLike).industry;
    const fromProfile =
      industry.status === 'known' && typeof (industry as KnownField).value === 'string'
        ? (industry as KnownField).value
        : undefined;
    const industryCode = parsed.data.industryCode ?? fromProfile;
    if (!industryCode) {
      throw new BadRequestException('industryCode is required (or profile.industry must be known)');
    }
    const release = await this.prisma.knowledgeRelease.findFirst({
      where: { status: 'draft' },
      orderBy: { version: 'desc' },
    });
    if (!release) throw new NotFoundException('No draft KnowledgeRelease found');
    const dbApprovals = (await this.prisma.approvalDefinition.findMany({
      where: {
        releaseId: release.id,
        OR: [
          { industry: { code: industryCode }, ruleKind: 'approval' },
          { ruleKind: 'incentive' },
        ],
      },
      include: {
        requirements: { include: { documentDefinition: true } },
        source: { select: { url: true, title: true } },
      },
      orderBy: { code: 'asc' },
    })) as unknown as DbApproval[];
    if (dbApprovals.length === 0) {
      throw new NotFoundException(
        `No approvals or incentive rules found for industry '${industryCode}' in draft release '${release.version}'`,
      );
    }
    // Display-only metadata (description, provenance) rides on the definition
    // and is echoed verbatim into the result snapshot by the engine, so the
    // results UI can show applicants WHY an approval applies and WHERE the
    // authoritative source is. It never influences evaluation logic.
    const engineDefs = dbApprovals.map((a) => ({
      id: a.code,
      name: a.name,
      shortName: a.shortName ?? undefined,
      ruleKind: (a.ruleKind as 'approval' | 'incentive') ?? 'approval',
      jurisdiction: a.jurisdiction ?? undefined,
      description: a.whyRequired,
      sourceTitle: a.source?.title ?? undefined,
      sourceUrl: a.officialApplicationUrl ?? a.source?.url ?? undefined,
      verificationDate: a.lastVerifiedDate ? new Date(a.lastVerifiedDate).toISOString() : undefined,
      lastVerifiedDate: a.lastVerifiedDate ? new Date(a.lastVerifiedDate).toISOString() : undefined,
      condition: toEngineCondition(a.applicabilityConditions),
      exclusionConditions: toEngineCondition(a.exclusionConditions),
      exclusionReason: a.exclusionReason ?? undefined,
      requiredDocuments: a.requirements.map((r) => ({
        id: r.documentDefinition.code,
        name: r.documentDefinition.name,
      })),
    }));
    const idSet = new Set(dbApprovals.map((a) => a.id));
    const codeById = new Map(dbApprovals.map((a) => [a.code, a.id]));
    const dbDeps = await this.prisma.dependency.findMany({
      where: { fromApprovalId: { in: [...idSet] }, toApprovalId: { in: [...idSet] } },
    });
    const engineDeps: Array<{ from: string; to: string; relationship: EngineRelationship }> = [];
    for (const d of dbDeps) {
      const from = codeById.get(d.fromApprovalId);
      const to = codeById.get(d.toApprovalId);
      if (from && to) {
        engineDeps.push({ from, to, relationship: d.relationship as EngineRelationship });
      }
    }
    // Pure engine call via dynamic import (engine ships ESM; API is CJS).
    // The API layer must not modify or reinterpret the engine's output.
    const engine = (await import(
      '@approvaliq/approval-engine' as string
    )) as unknown as { evaluate: EngineEvaluateFn };
    const { evaluate } = engine;
    const result = evaluate(
      profile as never,
      engineDefs as never,
      engineDeps as never,
    ) as {
      approvals: Array<{ approval: { id: string }; outcome: string; neededInformation: unknown }>;
      [k: string]: unknown;
    };
    const snapshot = JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
    const idByCode = new Map(dbApprovals.map((a) => [a.code, a.id]));
    const run = await this.prisma.evaluationRun.create({
      data: {
        profileSnapshot: JSON.parse(JSON.stringify(profile)) as object,
        releaseId: release.id,
        engineVersion: ENGINE_VERSION,
        resultSnapshot: snapshot as object,
        results: {
          create: result.approvals.map(
            (a: { approval: { id: string }; outcome: string; neededInformation: unknown }) => ({
              approvalDefinitionId: idByCode.get(a.approval.id) ?? dbApprovals[0]!.id,
              outcome: a.outcome,
              missingFields: JSON.parse(JSON.stringify(a.neededInformation)) as object,
            }),
          ),
        },
      },
    });
    return { id: run.id, releaseId: release.id, engineVersion: ENGINE_VERSION, ...snapshot };
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const run = await this.prisma.evaluationRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException(`Evaluation '${id}' not found`);
    return {
      id: run.id,
      releaseId: run.releaseId,
      engineVersion: run.engineVersion,
      createdAt: run.createdAt,
      profileSnapshot: run.profileSnapshot,
      ...(run.resultSnapshot as Record<string, unknown>),
    };
  }

  async simulateWhatIf(body: unknown): Promise<Record<string, unknown>> {
    const payload = body as Record<string, unknown>;
    const profile = (payload.profile ?? payload) as Record<string, unknown>;
    const industryCode = typeof payload.industryCode === 'string'
      ? payload.industryCode
      : typeof (profile.industry as KnownField)?.value === 'string'
      ? (profile.industry as KnownField).value
      : 'brewery';

    const release = await this.prisma.knowledgeRelease.findFirst({
      where: { status: 'draft' },
      orderBy: { version: 'desc' },
    });
    if (!release) throw new NotFoundException('No draft KnowledgeRelease found');

    const dbApprovals = (await this.prisma.approvalDefinition.findMany({
      where: {
        releaseId: release.id,
        OR: [
          { industry: { code: industryCode }, ruleKind: 'approval' },
          { ruleKind: 'incentive' },
        ],
      },
      include: {
        requirements: { include: { documentDefinition: true } },
        source: { select: { url: true, title: true } },
      },
      orderBy: { code: 'asc' },
    })) as unknown as DbApproval[];

    const engineDefs = dbApprovals.map((a) => ({
      id: a.code,
      name: a.name,
      shortName: a.shortName ?? undefined,
      ruleKind: (a.ruleKind as 'approval' | 'incentive') ?? 'approval',
      jurisdiction: a.jurisdiction ?? undefined,
      description: a.whyRequired,
      sourceTitle: a.source?.title ?? undefined,
      sourceUrl: a.officialApplicationUrl ?? a.source?.url ?? undefined,
      verificationDate: a.lastVerifiedDate ? new Date(a.lastVerifiedDate).toISOString() : undefined,
      lastVerifiedDate: a.lastVerifiedDate ? new Date(a.lastVerifiedDate).toISOString() : undefined,
      condition: toEngineCondition(a.applicabilityConditions),
      exclusionConditions: toEngineCondition(a.exclusionConditions),
      exclusionReason: a.exclusionReason ?? undefined,
      requiredDocuments: a.requirements.map((r) => ({
        id: r.documentDefinition.code,
        name: r.documentDefinition.name,
      })),
    }));

    const engine = (await import(
      '@approvaliq/approval-engine' as string
    )) as unknown as { evaluate: EngineEvaluateFn };
    const { evaluate } = engine;
    const result = evaluate(
      profile as never,
      engineDefs as never,
      [] as never,
    ) as Record<string, unknown>;

    return {
      sandbox: true,
      engineVersion: ENGINE_VERSION,
      simulatedAt: new Date().toISOString(),
      ...result,
    };
  }
}

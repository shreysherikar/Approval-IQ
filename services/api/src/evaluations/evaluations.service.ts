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

type StoredClause = { field?: unknown; op?: unknown; value?: unknown };
type DbApproval = {
  id: string;
  code: string;
  name: string;
  applicabilityConditions: unknown;
  requirements: Array<{ documentDefinition: { code: string; name: string } }>;
};

/** Marker that never matches a real profile: forces a clean not_applicable. */
const NEVER_MATCH: EngineCondition = { kind: 'eq', field: 'industry', value: '__never__' };

/**
 * Translate the Phase-1 CSV condition shape
 * `{ all: [{ field, op: 'equals', value }] }` into the engine's typed
 * Condition tree. Free-text prose rows are not machine-evaluable: they map
 * to NEVER_MATCH so the engine reports not_applicable instead of throwing.
 */
export function toEngineCondition(raw: unknown): EngineCondition | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') {
    return raw.trim() === '' ? undefined : NEVER_MATCH;
  }
  if (typeof raw !== 'object') return undefined;
  const all = (raw as { all?: unknown }).all;
  if (!Array.isArray(all)) return undefined;
  const conditions: EngineCondition[] = [];
  for (const c of all as StoredClause[]) {
    if (typeof c !== 'object' || c === null) continue;
    if (c.op !== 'equals' || typeof c.field !== 'string' || typeof c.value !== 'string') continue;
    if (c.field === 'industry' || c.field === 'state' || c.field === 'district') {
      conditions.push({ kind: 'eq', field: c.field, value: c.value });
    }
  }
  if (conditions.length === 0) return NEVER_MATCH;
  return { kind: 'all', conditions };
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
      where: { releaseId: release.id, industry: { code: industryCode } },
      include: { requirements: { include: { documentDefinition: true } } },
      orderBy: { code: 'asc' },
    })) as unknown as DbApproval[];
    if (dbApprovals.length === 0) {
      throw new NotFoundException(
        `No approvals for industry '${industryCode}' in draft release '${release.version}'`,
      );
    }
    const engineDefs = dbApprovals.map((a) => ({
      id: a.code,
      name: a.name,
      condition: toEngineCondition(a.applicabilityConditions),
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
}

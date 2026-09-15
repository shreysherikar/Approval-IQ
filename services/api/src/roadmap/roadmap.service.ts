import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoadmapUnavailableException } from '../common/errors/roadmap-unavailable.exception';

/**
 * Client-requestable statuses for the PATCH status endpoint. Everything the
 * server derives (blocked, available) is NOT client-requestable.
 */
const CLIENT_REQUESTABLE_STATUSES = ['in_progress', 'done'] as const;
type ClientRequestedStatus = (typeof CLIENT_REQUESTABLE_STATUSES)[number];

/** Valid client-requested transitions (per ADR-0002 decision 4). */
const VALID_TRANSITIONS: Record<string, readonly ClientRequestedStatus[]> = {
  available: ['in_progress'],
  in_progress: ['done'],
};

/**
 * Outcomes that produce an ApprovalInstance. `not_applicable` produces none —
 * there is nothing to act on. `not_evaluable` DOES produce one; its
 * "attention required" nature is derived at read time from the linked
 * EvaluationResult, never stored as an independent flag.
 */
const INSTANCE_WARRANTY_OUTCOMES = new Set([
  'applicable',
  'needs_information',
  'not_evaluable',
]);

/** Outcome that marks an instance as needing manual attention (read-time only). */
export function isAttentionRequired(outcome: string): boolean {
  return outcome === 'not_evaluable';
}

type DependencyRow = {
  fromApprovalId: string;
  toApprovalId: string;
  relationship: string;
};

/** Structural shape of the engine's graph utilities (dynamic-imported, ESM). */
interface EngineGraph {
  gatingPrerequisites(id: string, deps: EngineDependency[]): string[];
  transitiveGatingDependents(id: string, deps: EngineDependency[]): string[];
  topologicalGatingOrder(
    ids: readonly string[],
    deps: EngineDependency[],
  ): { ordered: string[]; cyclicIds: string[] };
  gatingLayers(
    ids: readonly string[],
    deps: EngineDependency[],
  ): { layers: string[][]; cyclicIds: string[] };
  findGatingCycle(ids: readonly string[], deps: EngineDependency[]): string[] | null;
}

type EngineDependency = { from: string; to: string; relationship: string };

async function loadEngineGraph(): Promise<EngineGraph> {
  const engine = (await import(
    '@approvaliq/approval-engine' as string
  )) as unknown as EngineGraph;
  return engine;
}

function toEngineDeps(rows: DependencyRow[], idSet: Set<string>): EngineDependency[] {
  const deps: EngineDependency[] = [];
  for (const r of rows) {
    if (!idSet.has(r.fromApprovalId) || !idSet.has(r.toApprovalId)) continue;
    deps.push({ from: r.fromApprovalId, to: r.toApprovalId, relationship: r.relationship });
  }
  return deps;
}

/** Dedupes an approval's document requirements by document code (first wins). */
function dedupeDocuments(
  requirements: Array<{ documentDefinition: { code: string; name: string } }>,
): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  const docs: Array<{ id: string; name: string }> = [];
  for (const r of requirements) {
    if (seen.has(r.documentDefinition.code)) continue;
    seen.add(r.documentDefinition.code);
    docs.push({ id: r.documentDefinition.code, name: r.documentDefinition.name });
  }
  return docs;
}

type InstanceRow = {
  id: string;
  projectId: string;
  approvalDefinitionId: string;
  evaluationResultId: string;
  status: string;
  unlockedAt: Date | null;
  updatedAt: Date;
};

type SerializedInstance = Record<string, unknown>;

function serializeInstance(row: InstanceRow): SerializedInstance {
  return {
    id: row.id,
    projectId: row.projectId,
    approvalDefinitionId: row.approvalDefinitionId,
    evaluationResultId: row.evaluationResultId,
    status: row.status,
    unlockedAt: row.unlockedAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async assertProjectExists(projectId: string): Promise<{ id: string; industry: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, industry: true },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);
    return project;
  }

  /**
   * Extends the Phase-3 confirm-then-evaluate flow: called right after an
   * evaluation run is persisted for a confirmed profile. Creates one
   * ApprovalInstance per evaluated approval whose outcome warrants one
   * (applicable | needs_information | not_evaluable — never not_applicable).
   *
   * If an instance already exists for the project + approval (a later profile
   * version was confirmed), the instance is re-pointed at the newer
   * EvaluationResult and its workflow status is PRESERVED (status is roadmap
   * progress, not evaluation state).
   */
  async syncInstancesForRun(
    projectId: string,
    runId: string,
  ): Promise<SerializedInstance[]> {
    const results = await this.prisma.evaluationResult.findMany({
      where: { evaluationRunId: runId },
      include: { approvalDefinition: { select: { id: true, code: true } } },
    });
    if (results.length === 0) {
      throw new NotFoundException(
        `Evaluation run '${runId}' has no persisted results — cannot build the roadmap`,
      );
    }

    const defIds = results.map((r) => r.approvalDefinition.id);
    const idSet = new Set(defIds);
    const depRows = (await this.prisma.dependency.findMany({
      where: { fromApprovalId: { in: [...idSet] }, toApprovalId: { in: [...idSet] } },
    })) as unknown as DependencyRow[];
    const graph = await loadEngineGraph();
    const engineDeps = toEngineDeps(depRows, idSet);

    // Existing roadmap slots for this project (from previous confirmations).
    const existing = await this.prisma.approvalInstance.findMany({
      where: { projectId },
      select: { id: true, approvalDefinitionId: true, status: true },
    });
    // defId -> current instance status (no entry when no instance exists).
    const statusByDef = new Map<string, string>(
      existing.map((i) => [i.approvalDefinitionId, i.status]),
    );

    // Phase A: decide which approvals GET an instance in this pass, so the
    // initial status of each can be computed against the FULL final set of
    // instances (not just the ones processed before it in row order).
    const toCreate: Array<{ defId: string; evaluationResultId: string }> = [];
    for (const r of results) {
      const defId = r.approvalDefinition.id;
      if (!INSTANCE_WARRANTY_OUTCOMES.has(r.outcome)) continue; // not_applicable → nothing to act on
      if (statusByDef.has(defId)) continue;
      toCreate.push({ defId, evaluationResultId: r.id });
      // New instances start incomplete; mark them so dependents created in the
      // same pass see them as gating (not done).
      statusByDef.set(defId, 'pending');
    }

    // Outcome flips across re-evaluations: an approval the NEWEST evaluation
    // says is not_applicable (or omits entirely) must NOT keep a stale
    // instance — the roadmap always reflects the pinned, latest evaluation.
    // Delete those first (cascade-conserving workflow state is irrelevant:
    // there is nothing to act on anymore).
    const warranted = new Set(
      results
        .filter((r) => INSTANCE_WARRANTY_OUTCOMES.has(r.outcome))
        .map((r) => r.approvalDefinition.id),
    );
    const stale = existing.filter((i) => !warranted.has(i.approvalDefinitionId));
    if (stale.length > 0) {
      await this.prisma.approvalInstance.deleteMany({
        where: { id: { in: stale.map((i) => i.id) } },
      });
      for (const i of stale) statusByDef.delete(i.approvalDefinitionId);
    }

    const out: SerializedInstance[] = [];
    for (const r of results) {
      const defId = r.approvalDefinition.id;
      if (!INSTANCE_WARRANTY_OUTCOMES.has(r.outcome)) continue;

      if (statusByDef.get(defId) !== 'pending') {
        // Re-evaluation of a new profile version: re-point at the newest
        // evaluation result, keep the existing workflow status.
        const row = (await this.prisma.approvalInstance.update({
          where: { projectId_approvalDefinitionId: { projectId, approvalDefinitionId: defId } },
          data: { evaluationResultId: r.id },
        })) as unknown as InstanceRow;
        out.push(serializeInstance(row));
        continue;
      }

      // Phase B: initial status. 'available' only when NO depends_on
      // prerequisite is an incomplete ApprovalInstance (any new/existing
      // instance that is not 'done'). informational/parallel_with/unknown
      // edges never gate; a prerequisite with no instance at all (e.g.
      // evaluated not_applicable) is satisfied — nothing to act on.
      const prereqIds = graph.gatingPrerequisites(defId, engineDeps);
      const blocked = prereqIds.some((p) => {
        const status = statusByDef.get(p);
        return status !== undefined && status !== 'done';
      });
      const status = blocked ? 'blocked' : 'available';
      const resultId = toCreate.find((c) => c.defId === defId)!.evaluationResultId;
      const row = (await this.prisma.approvalInstance.create({
        data: {
          projectId,
          approvalDefinitionId: defId,
          evaluationResultId: resultId,
          status,
          unlockedAt: blocked ? null : new Date(),
        },
      })) as unknown as InstanceRow;
      statusByDef.set(defId, status);
      out.push(serializeInstance(row));
    }

    // If a deleted (flipped to not_applicable) approval gated others, those
    // dependents may now be satisfiable — re-derive availability server-side,
    // same rule as the done-cascade (no instance = nothing to act on = done).
    if (stale.length > 0) {
      const staleDefIds = new Set(stale.map((i) => i.approvalDefinitionId));
      const touched = new Set<string>();
      for (const defId of staleDefIds) {
        for (const id of await this.unlockDependents(projectId, defId)) {
          touched.add(id);
        }
      }
      if (touched.size > 0) {
        const fresh = await this.prisma.approvalInstance.findMany({
          where: { id: { in: [...touched] } },
        });
        const freshById = new Map(fresh.map((i) => [i.id, i]));
        out.forEach((o, idx) => {
          const f = freshById.get(o.id as string);
          if (f) out[idx] = serializeInstance(f as unknown as InstanceRow);
        });
      }
    }
    return out;
  }

  /**
   * Applies a client-requested status transition. ONLY `available →
   * in_progress` and `in_progress → done` are accepted — everything else is
   * rejected with a clear error (blocked → anything, skipping in_progress,
   * backward moves, and the terminal `done` state). `blocked → available`
   * is NEVER client-requestable: availability is derived server-side from the
   * dependency graph when a prerequisite completes (see cascade below).
   */
  async updateStatus(
    projectId: string,
    instanceId: string,
    body: unknown,
  ): Promise<SerializedInstance> {
    await this.assertProjectExists(projectId);
    const instance = (await this.prisma.approvalInstance.findFirst({
      where: { id: instanceId, projectId },
      include: { approvalDefinition: { select: { code: true } } },
    })) as unknown as (InstanceRow & { approvalDefinition: { code: string } }) | null;
    if (!instance) {
      throw new NotFoundException(
        `Approval instance '${instanceId}' not found for project '${projectId}'`,
      );
    }

    const requested = (body as { status?: unknown } | null)?.status;
    if (
      typeof requested !== 'string' ||
      !CLIENT_REQUESTABLE_STATUSES.includes(requested as ClientRequestedStatus)
    ) {
      throw new BadRequestException({
        message: `'${String(requested)}' is not a client-requestable status. Only 'in_progress' and 'done' may be requested — availability (unblocking) is derived by the server from the dependency graph.`,
      });
    }

    const allowedFrom = Object.entries(VALID_TRANSITIONS).find(([, tos]) =>
      tos.includes(requested as ClientRequestedStatus),
    );
    if (!allowedFrom || allowedFrom[0] !== instance.status) {
      const from = instance.status;
      let reason: string;
      if (from === 'blocked') {
        reason =
          'a blocked approval has unsatisfied depends_on prerequisites — complete them first; availability is granted server-side, never by client request';
      } else if (from === 'done') {
        reason = `'done' is terminal — no further transitions are possible`;
      } else if (from === 'available' && requested === 'done') {
        reason = 'progress must pass through in_progress — no skipping';
      } else {
        reason = `backward transitions are not allowed`;
      }
      throw new BadRequestException({
        message: `Cannot transition approval '${instance.approvalDefinition.code}' from '${from}' to '${requested}': ${reason}.`,
        validTransitions: { available: ['in_progress'], in_progress: ['done'] },
      });
    }

    const row = (await this.prisma.approvalInstance.update({
      where: { id: instance.id },
      data: { status: requested as 'in_progress' | 'done' },
    })) as unknown as InstanceRow;

    if (requested === 'done') {
      const unlocked = await this.unlockDependents(projectId, instance.approvalDefinitionId);
      return { ...serializeInstance(row), unlockedDependentIds: unlocked };
    }
    return serializeInstance(row);
  }

  /**
   * Server-side dependency re-evaluation after `approvalDefinitionId` was
   * marked done: walks FORWARD through every approval that transitively
   * depends on it (depends_on edges only) and flips 'blocked' instances whose
   * prerequisites are now ALL satisfied to 'available', stamping unlockedAt on
   * first unlock. Uses the approval-engine's graph utilities — no ad-hoc
   * topological logic here.
   */
  async unlockDependents(
    projectId: string,
    approvalDefinitionId: string,
  ): Promise<string[]> {
    const instances = await this.prisma.approvalInstance.findMany({
      where: { projectId },
      select: { id: true, approvalDefinitionId: true, status: true, unlockedAt: true },
    });
    const instanceByDef = new Map(instances.map((i) => [i.approvalDefinitionId, i]));
    const defIds = instances.map((i) => i.approvalDefinitionId);
    const idSet = new Set(defIds);
    const depRows = (await this.prisma.dependency.findMany({
      where: { fromApprovalId: { in: [...idSet] }, toApprovalId: { in: [...idSet] } },
    })) as unknown as DependencyRow[];
    const engineDeps = toEngineDeps(depRows, idSet);
    const graph = await loadEngineGraph();

    // Forward walk (not just one hop): the transitive dependents, considered
    // prerequisite-first so a chain of three is all reconsidered in order.
    const closure = graph.transitiveGatingDependents(approvalDefinitionId, engineDeps);
    const { ordered } = graph.topologicalGatingOrder(closure, engineDeps);

    const unlockedIds: string[] = [];
    for (const defId of ordered) {
      if (defId === approvalDefinitionId) continue;
      const inst = instanceByDef.get(defId);
      if (!inst || inst.status !== 'blocked') continue;
      const prereqs = graph.gatingPrerequisites(defId, engineDeps);
      const allSatisfied = prereqs.every((p) => {
        const prereqInstance = instanceByDef.get(p);
        // No instance (e.g. prerequisite evaluated not_applicable) → satisfied.
        return !prereqInstance || prereqInstance.status === 'done';
      });
      if (!allSatisfied) continue;
      const updated = (await this.prisma.approvalInstance.update({
        where: { id: inst.id },
        data: { status: 'available', unlockedAt: inst.unlockedAt ?? new Date() },
      })) as unknown as { id: string };
      instanceByDef.set(defId, { ...inst, status: 'available' });
      unlockedIds.push(updated.id);
    }
    return unlockedIds;
  }

  /**
   * Full roadmap graph for a project, shaped for direct consumption by a graph
   * UI: nodes (instance + approval name + outcome + status + source URL +
   * lastVerifiedDate + read-time attentionRequired), edges (dependency
   * relationship + type) and parallelGroups (engine-computed layers over the
   * gating graph).
   */
  async getRoadmap(projectId: string): Promise<Record<string, unknown>> {
    await this.assertProjectExists(projectId);
    const instances = await this.prisma.approvalInstance.findMany({
      where: { projectId },
      include: {
        evaluationResult: { select: { id: true, outcome: true, missingFields: true } },
        // Per-approval document requirements (deduplicated by document code) —
        // displayed read-only in the roadmap detail panel (upload is Phase 5).
        approvalDefinition: {
          select: {
            id: true,
            code: true,
            name: true,
            officialApplicationUrl: true,
            lastVerifiedDate: true,
            source: { select: { url: true } },
            requirements: {
              select: { documentDefinition: { select: { code: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const instanceByDef = new Map(instances.map((i) => [i.approvalDefinitionId, i]));
    const defIds = instances.map((i) => i.approvalDefinitionId);
    const idSet = new Set(defIds);
    const depRows = (await this.prisma.dependency.findMany({
      where: { fromApprovalId: { in: [...idSet] }, toApprovalId: { in: [...idSet] } },
      include: { fromApproval: { select: { code: true } }, toApproval: { select: { code: true } } },
    })) as unknown as Array<
      DependencyRow & {
        id: string;
        fromApproval: { code: string };
        toApproval: { code: string };
      }
    >;

    // Nodes: everything the graph UI needs to render a card per approval.
    const nodes = instances.map((i) => ({
      id: i.id,
      projectId: i.projectId,
      approvalDefinitionId: i.approvalDefinitionId,
      approvalCode: i.approvalDefinition.code,
      approvalName: i.approvalDefinition.name,
      // Pinned evaluation, never recomputed: outcome + attentionRequired are
      // derived from the linked EvaluationResult, not from instance state.
      evaluationResultId: i.evaluationResult.id,
      outcome: i.evaluationResult.outcome,
      attentionRequired: isAttentionRequired(i.evaluationResult.outcome),
      missingFields: i.evaluationResult.missingFields,
      status: i.status,
      // Read-only document list for the detail panel (deduped by document
      // code — the same dedup rule the engine applies to its document list).
      requiredDocuments: dedupeDocuments(i.approvalDefinition.requirements),
      sourceUrl: i.approvalDefinition.officialApplicationUrl ?? i.approvalDefinition.source?.url ?? null,
      lastVerifiedDate: i.approvalDefinition.lastVerifiedDate,
      unlockedAt: i.unlockedAt,
      updatedAt: i.updatedAt,
    }));

    // Edges: every dependency among the project's roadmap approvals, labeled
    // with its relationship type. Endpoints without an instance (e.g. a
    // prerequisite evaluated not_applicable) are referenced by definition id.
    const edges = depRows.map((d) => ({
      id: d.id,
      fromInstanceId: instanceByDef.get(d.fromApprovalId)?.id ?? null,
      toInstanceId: instanceByDef.get(d.toApprovalId)?.id ?? null,
      fromApprovalId: d.fromApprovalId,
      fromApprovalCode: d.fromApproval.code,
      toApprovalId: d.toApprovalId,
      toApprovalCode: d.toApproval.code,
      type: d.relationship,
      gates: d.relationship === 'depends_on',
    }));

    // Parallel groups: engine-computed layers over the depends_on graph of the
    // approvals that have instances (informational/parallel_with/unknown never gate).
    const graph = await loadEngineGraph();
    const gatingDeps = toEngineDeps(depRows, idSet);
    const { layers, cyclicIds } = graph.gatingLayers(defIds, gatingDeps);

    // Phase-2-style cycle assertion, extended one level further to THIS exact
    // subset of ApprovalInstances + depends_on edges being returned. Upstream
    // (Phase 1 import detection + Phase 2 evaluate assertion) makes a cycle
    // provably impossible here — but if it is ever violated (e.g. an approval
    // dependency was manually edited in the DB, bypassing the importer), we must
    // NOT hand the frontend a broken or infinite-loop graph. Instead: log a
    // severity alert, and return an explicit `roadmap_unavailable` error that
    // describes the offending cycle.
    if (cyclicIds.length > 0) {
      const cycle =
        graph.findGatingCycle(defIds, gatingDeps) ?? [...cyclicIds];
      const codeById = new Map<string, string>(
        instances.map((i) => [i.approvalDefinitionId, i.approvalDefinition.code]),
      );
      const cycleDescription = cycle.map((id) => codeById.get(id) ?? id).join(' -> ');
      this.logger.error(
        `[SEVERITY_ALERT][roadmap_unavailable] project=${projectId}: the subset of approval instances + depends_on edges about to be returned contains a dependency cycle → ${cycleDescription}. This should be impossible after Phase 1 import cycle detection; treating it as a data-integrity assertion failure. Refusing to render the roadmap graph.`,
      );
      throw new RoadmapUnavailableException(projectId, cycle, cycleDescription);
    }

    const parallelGroups = layers.map((layer) =>
      layer
        .map((defId) => instanceByDef.get(defId)?.id)
        .filter((id): id is string => id !== undefined),
    );

    return {
      projectId,
      nodes,
      edges,
      parallelGroups,
    };
  }

  /** Single instance lookup used by the status endpoint's tests/introspection. */
  async findInstance(projectId: string, instanceId: string): Promise<SerializedInstance> {
    const row = (await this.prisma.approvalInstance.findFirst({
      where: { id: instanceId, projectId },
    })) as unknown as InstanceRow | null;
    if (!row) {
      throw new NotFoundException(
        `Approval instance '${instanceId}' not found for project '${projectId}'`,
      );
    }
    return serializeInstance(row);
  }
}

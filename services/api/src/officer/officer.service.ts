import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RiskService } from '../risk/risk.service';
import { AuditService } from '../audit/audit.service';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from '../documents/documents.service';
import { isAttentionRequired } from '../roadmap/roadmap.service';
import type { UserRole } from '../common/decorators/roles.decorator';
import { isAuthorityInScope, type OfficerScope } from '../common/guards/officer.guard';
import {
  CLARIFICATION_INCLUDE,
  applyClarificationAction,
  serializeClarification,
  type ClarificationRow,
} from '../clarifications/clarification.support';
import {
  closeClarificationSchema,
  createClarificationSchema,
  followUpClarificationSchema,
  parseBody,
} from '../clarifications/clarification.dto';
import { isOpen, type ClarificationStatus } from '../clarifications/clarification-state';

/** Officer-actionable queue views. `all` is deliberately the only "no filter" value. */
export const QUEUE_STATUS_FILTERS = ['in_progress', 'available', 'blocked', 'done', 'all'] as const;
export type QueueStatusFilter = (typeof QUEUE_STATUS_FILTERS)[number];

export interface OfficerQueueParams {
  authorityId?: string;
  status?: string;
  q?: string;
  limit?: number;
}

export interface OfficerActor {
  userId: string;
  role: UserRole;
}

const DEFAULT_QUEUE_LIMIT = 100;
const MAX_QUEUE_LIMIT = 200;

/** Requirement satisfaction is reported honestly — never as a bare boolean. */
export type RequiredDocumentStatus = 'verified' | 'provided_unverified' | 'missing';

/** Structural row types for the officer reads (repo convention: explicit shapes). */
interface QueueDocumentRow {
  id: string;
  documentDefinition: { code: string; name: string } | null;
  currentVersion: { id: string; state: string; versionNumber: number } | null;
}

interface QueueInstanceRow {
  id: string;
  projectId: string;
  status: string;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    industry: string;
    businessId: string;
    members: Array<{ user: { id: string; email: string } }>;
    documents: QueueDocumentRow[];
  } | null;
  approvalDefinition: {
    id: string;
    code: string;
    name: string;
    authorityId: string;
    slaDays: number | null;
    inspectionRequired: boolean;
    renewalRequired: boolean;
    authority: { id: string; code: string; name: string; department: string | null } | null;
    requirements: Array<{ documentDefinition: { code: string; name: string } }>;
  } | null;
  evaluationResult: { id: string; outcome: string; missingFields: unknown } | null;
  clarifications: Array<{
    id: string;
    status: string;
    subject: string;
    dueAt: Date | null;
    updatedAt: Date;
  }>;
}

/**
 * The include fragment shared by the queue and the single-application read.
 * Deliberately bounded (one authority's approvals, one project's documents) and
 * never including storageKey.
 */
const INSTANCE_INCLUDE = {
  project: {
    select: {
      id: true,
      name: true,
      industry: true,
      businessId: true,
      members: { select: { user: { select: { id: true, email: true } } } },
      documents: {
        select: {
          id: true,
          documentDefinition: { select: { code: true, name: true } },
          currentVersion: { select: { id: true, state: true, versionNumber: true } },
        },
      },
    },
  },
  approvalDefinition: {
    select: {
      id: true,
      code: true,
      name: true,
      authorityId: true,
      slaDays: true,
      inspectionRequired: true,
      renewalRequired: true,
      authority: { select: { id: true, code: true, name: true, department: true } },
      requirements: { select: { documentDefinition: { select: { code: true, name: true } } } },
    },
  },
  evaluationResult: { select: { id: true, outcome: true, missingFields: true } },
  clarifications: {
    select: { id: true, status: true, subject: true, dueAt: true, updatedAt: true },
  },
};

/**
 * Matches an approval's required documents against what the project's vault
 * actually contains, by DocumentDefinition code. Three honest outcomes:
 *   verified            — a matching document exists AND its current version is verified
 *   provided_unverified — a matching document exists but is not verified yet
 *   missing             — no matching document at all
 * A requirement is never reported as satisfied just because *something* was uploaded.
 */
function summarizeRequirements(
  requirements: Array<{ documentDefinition: { code: string; name: string } }>,
  documents: QueueDocumentRow[],
): Array<{ code: string; name: string; status: RequiredDocumentStatus; documentId: string | null; versionState: string | null }> {
  const byCode = new Map<string, QueueDocumentRow>();
  for (const doc of documents) {
    const code = doc.documentDefinition?.code;
    if (code !== undefined && !byCode.has(code)) byCode.set(code, doc);
  }
  const seen = new Set<string>();
  const out: Array<{ code: string; name: string; status: RequiredDocumentStatus; documentId: string | null; versionState: string | null }> = [];
  for (const req of requirements) {
    const code = req.documentDefinition.code;
    if (seen.has(code)) continue;
    seen.add(code);
    const match = byCode.get(code);
    const versionState = match?.currentVersion?.state ?? null;
    const status: RequiredDocumentStatus =
      versionState === 'verified' ? 'verified' : match !== undefined ? 'provided_unverified' : 'missing';
    out.push({
      code,
      name: req.documentDefinition.name,
      status,
      documentId: match?.id ?? null,
      versionState,
    });
  }
  return out;
}

/** Structural row types for the single-application review packet. */
interface PacketInstanceRow {
  id: string;
  projectId: string;
  status: string;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    industry: string;
    businessId: string;
    createdAt: Date;
    members: Array<{ user: { id: string; email: string; role: string } }>;
    documents: QueueDocumentRow[];
  } | null;
  approvalDefinition: {
    id: string;
    code: string;
    name: string;
    authorityId: string;
    whyRequired: string;
    officialApplicationUrl: string | null;
    ambiguityNotes: string | null;
    lastVerifiedDate: Date;
    slaDays: number | null;
    inspectionRequired: boolean;
    renewalRequired: boolean;
    authority: { id: string; code: string; name: string; department: string | null } | null;
    source: {
      id: string;
      url: string;
      title: string;
      department: string | null;
      lastVerifiedDate: Date;
      verificationStatus: string;
      sourceLastReviewed: Date | null;
      stalenessFlag: boolean;
    } | null;
    requirements: Array<{
      condition: string | null;
      documentDefinition: {
        id: string;
        code: string;
        name: string;
        documentType: string;
        reusability: string;
        reuseConditions: string;
        validityRule: string;
        verificationMethod: string;
      };
    }>;
  } | null;
  evaluationResult: {
    id: string;
    outcome: string;
    missingFields: unknown;
    evaluationRun: {
      id: string;
      engineVersion: string;
      releaseId: string | null;
      createdAt: Date;
      profileSnapshot: unknown;
      release: { version: string; status: string } | null;
    } | null;
  } | null;
}

/**
 * Read shape for the review packet. Like INSTANCE_INCLUDE, this never selects
 * a storageKey: documents are downloaded through DocumentsService only.
 */
const PACKET_INCLUDE = {
  project: {
    select: {
      id: true,
      name: true,
      industry: true,
      businessId: true,
      createdAt: true,
      members: { select: { user: { select: { id: true, email: true, role: true } } } },
      documents: {
        select: {
          id: true,
          documentDefinition: { select: { code: true, name: true } },
          currentVersion: { select: { id: true, state: true, versionNumber: true } },
        },
      },
    },
  },
  approvalDefinition: {
    select: {
      id: true,
      code: true,
      name: true,
      authorityId: true,
      whyRequired: true,
      officialApplicationUrl: true,
      ambiguityNotes: true,
      lastVerifiedDate: true,
      slaDays: true,
      inspectionRequired: true,
      renewalRequired: true,
      authority: { select: { id: true, code: true, name: true, department: true } },
      source: {
        select: {
          id: true,
          url: true,
          title: true,
          department: true,
          lastVerifiedDate: true,
          verificationStatus: true,
          sourceLastReviewed: true,
          stalenessFlag: true,
        },
      },
      requirements: {
        select: {
          condition: true,
          documentDefinition: {
            select: {
              id: true,
              code: true,
              name: true,
              documentType: true,
              reusability: true,
              reuseConditions: true,
              validityRule: true,
              verificationMethod: true,
            },
          },
        },
      },
    },
  },
  evaluationResult: {
    select: {
      id: true,
      outcome: true,
      missingFields: true,
      evaluationRun: {
        select: {
          id: true,
          engineVersion: true,
          releaseId: true,
          createdAt: true,
          profileSnapshot: true,
          release: { select: { version: true, status: true } },
        },
      },
    },
  },
};


@Injectable()
export class OfficerService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DocumentsService) private readonly documents: DocumentsService,
    private readonly riskService: RiskService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Resolves the authorityId filter for a queue/packet query.
   *
   * Scoping happens IN THE QUERY (never as a post-filter), and asking for an
   * authority outside your scope is an explicit 403 instead of an empty list —
   * "you may not look there" must not be indistinguishable from "nothing there".
   */
  private resolveAuthorityIds(scope: OfficerScope, requested?: string): string[] | undefined {
    if (requested !== undefined) {
      if (!isAuthorityInScope(scope, requested)) {
        throw new ForbiddenException({
          code: 'officer_out_of_scope',
          message: 'You are not assigned to that authority',
          details: { requiredAuthorityId: requested, assignedAuthorityIds: scope.authorityIds },
        });
      }
      return [requested];
    }
    return scope.unrestricted ? undefined : scope.authorityIds;
  }

  /**
   * The authorities this officer may act for, each with the counts that make the
   * queue legible at a glance: open applications (in_progress) and
   * clarifications whose ball is in the OFFICER's court (status = responded).
   * An unassigned officer gets an empty list — not an error — so the UI can say
   * "no authority assigned" instead of looking like a broken page.
   */
  async listAuthorities(scope: OfficerScope): Promise<Record<string, unknown>> {
    const authorityIds = this.resolveAuthorityIds(scope);
    const authorities = await this.prisma.authority.findMany({
      where: authorityIds === undefined ? {} : { id: { in: authorityIds } },
      select: { id: true, code: true, name: true, department: true, jurisdiction: true },
      orderBy: { name: 'asc' },
    });

    const [applicationCounts, awaitingOfficerCounts] = await Promise.all([
      this.prisma.approvalInstance.groupBy({
        by: ['approvalDefinitionId'],
        where: {
          status: 'in_progress',
          ...(authorityIds === undefined ? {} : { approvalDefinition: { authorityId: { in: authorityIds } } }),
        },
        _count: { _all: true },
      }),
      this.prisma.clarificationRequest.groupBy({
        by: ['authorityId'],
        where: {
          status: 'responded',
          ...(authorityIds === undefined ? {} : { authorityId: { in: authorityIds } }),
        },
        _count: { _all: true },
      }),
    ]);

    // groupBy on the instance cannot reach authorityId transitively, so map the
    // definition ids back to their authority in one extra read.
    const defIds = applicationCounts.map((c) => c.approvalDefinitionId);
    const defToAuthority = new Map<string, string>();
    if (defIds.length > 0) {
      const defs = await this.prisma.approvalDefinition.findMany({
        where: { id: { in: defIds } },
        select: { id: true, authorityId: true },
      });
      for (const d of defs) defToAuthority.set(d.id, d.authorityId);
    }
    const openByAuthority = new Map<string, number>();
    for (const c of applicationCounts) {
      const authorityId = defToAuthority.get(c.approvalDefinitionId);
      if (!authorityId) continue;
      openByAuthority.set(authorityId, (openByAuthority.get(authorityId) ?? 0) + c._count._all);
    }
    const awaitingByAuthority = new Map<string, number>(
      awaitingOfficerCounts.map((c) => [c.authorityId, c._count._all]),
    );

    return {
      unrestricted: scope.unrestricted,
      authorities: authorities.map((a) => ({
        ...a,
        openApplications: openByAuthority.get(a.id) ?? 0,
        clarificationsAwaitingOfficer: awaitingByAuthority.get(a.id) ?? 0,
      })),
    };
  }

  /**
   * Authority-scoped application queue.
   *
   * Default filter is `in_progress`: the applicant has SUBMITTED (advanced the
   * instance out of `available`) and the authority now owes a decision, so this
   * is precisely "work waiting on me". `all` is available for oversight.
   *
   * Ordering is FAIRNESS, not risk scoring: threads whose ball is in the
   * officer's court first (an applicant is waiting on an answer), then the
   * longest-waiting application first.
   */
  async listQueue(scope: OfficerScope, params: OfficerQueueParams = {}): Promise<Record<string, unknown>> {
    const authorityIds = this.resolveAuthorityIds(scope, params.authorityId);
    const status = params.status ?? 'in_progress';
    if (!(QUEUE_STATUS_FILTERS as readonly string[]).includes(status)) {
      throw new BadRequestException({
        message: `Unknown queue status '${status}'`,
        details: { allowed: [...QUEUE_STATUS_FILTERS] },
      });
    }
    const limit = params.limit ?? DEFAULT_QUEUE_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_QUEUE_LIMIT) {
      throw new BadRequestException({
        message: `limit must be an integer between 1 and ${MAX_QUEUE_LIMIT}`,
      });
    }

    const clauses: Prisma.ApprovalInstanceWhereInput[] = [];
    if (authorityIds !== undefined) {
      clauses.push({ approvalDefinition: { authorityId: { in: authorityIds } } });
    }
    if (status !== 'all') {
      clauses.push({ status: status as 'blocked' | 'available' | 'in_progress' | 'done' });
    }
    const q = params.q?.trim();
    if (q !== undefined && q.length > 0) {
      clauses.push({
        OR: [
          { project: { name: { contains: q, mode: 'insensitive' } } },
          { project: { businessId: { contains: q, mode: 'insensitive' } } },
          { approvalDefinition: { code: { contains: q, mode: 'insensitive' } } },
          { approvalDefinition: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const rows = (await this.prisma.approvalInstance.findMany({
      where: clauses.length > 0 ? { AND: clauses } : {},
      include: INSTANCE_INCLUDE,
    })) as unknown as QueueInstanceRow[];

    const items = rows.map((row) => this.serializeQueueItem(row));

    // Feature 3: attach risk scores to each queue item
    const riskPromises = items.map(async (item) => {
      try {
        const risk = await this.riskService.calculateRiskForInstance(String(item['instanceId']));
        item['risk'] = risk;
      } catch {
        item['risk'] = { submissionRisk: { score: 0, level: 'unknown', reasons: [] }, regulatoryComplexity: { score: 0, level: 'unknown', reasons: [] }, recommendation: 'Needs assessment' };
      }
    });
    await Promise.all(riskPromises);

    items.sort((a, b) => {
      // Sort by highest submission risk first, then by awaiting officer, then by date
      const riskA = (a['risk'] as Record<string, unknown>)?.['submissionRisk'] as Record<string, unknown> | undefined;
      const riskB = (b['risk'] as Record<string, unknown>)?.['submissionRisk'] as Record<string, unknown> | undefined;
      const riskDelta = (Number(riskB?.['score'] ?? 0)) - (Number(riskA?.['score'] ?? 0));
      if (riskDelta !== 0) return riskDelta;
      const awaitingDelta =
        Number(b['clarificationsAwaitingOfficer'] as number) -
        Number(a['clarificationsAwaitingOfficer'] as number);
      if (awaitingDelta !== 0) return awaitingDelta;
      return new Date(String(a['updatedAt'])).getTime() - new Date(String(b['updatedAt'])).getTime();
    });

    return {
      status,
      authorityIds: authorityIds ?? null,
      unrestricted: scope.unrestricted,
      returned: Math.min(items.length, limit),
      total: items.length,
      truncated: items.length > limit,
      summary: {
        awaitingOfficer: items.filter((i) => (i['clarificationsAwaitingOfficer'] as number) > 0).length,
        awaitingApplicant: items.filter((i) => (i['clarificationsAwaitingApplicant'] as number) > 0).length,
        withMissingDocuments: items.filter(
          (i) => ((i['requiredDocuments'] as { missing: number }).missing ?? 0) > 0,
        ).length,
      },
      items: items.slice(0, limit),
    };
  }

  /** One queue row: enough to triage without opening the application. */
  private serializeQueueItem(row: QueueInstanceRow): Record<string, unknown> {
    const documents = row.project?.documents ?? [];
    const required = summarizeRequirements(row.approvalDefinition?.requirements ?? [], documents);
    const outcome = row.evaluationResult?.outcome ?? null;
    const latest = [...row.clarifications].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    )[0];
    return {
      instanceId: row.id,
      projectId: row.projectId,
      project: row.project
        ? {
            id: row.project.id,
            name: row.project.name,
            industry: row.project.industry,
            businessId: row.project.businessId,
            applicantEmails: row.project.members.map((m) => m.user.email),
          }
        : null,
      approval: row.approvalDefinition
        ? { id: row.approvalDefinition.id, code: row.approvalDefinition.code, name: row.approvalDefinition.name }
        : null,
      authority: row.approvalDefinition?.authority ?? null,
      instanceStatus: row.status,
      outcome,
      attentionRequired: outcome !== null && isAttentionRequired(outcome),
      missingFields: Array.isArray(row.evaluationResult?.missingFields)
        ? row.evaluationResult?.missingFields
        : [],
      slaDays: row.approvalDefinition?.slaDays ?? null,
      inspectionRequired: row.approvalDefinition?.inspectionRequired ?? false,
      renewalRequired: row.approvalDefinition?.renewalRequired ?? false,
      requiredDocuments: {
        total: required.length,
        verified: required.filter((r) => r.status === 'verified').length,
        providedUnverified: required.filter((r) => r.status === 'provided_unverified').length,
        missing: required.filter((r) => r.status === 'missing').length,
        items: required,
      },
      openClarifications: row.clarifications.filter((c) => isOpen(c.status as ClarificationStatus)).length,
      clarificationsAwaitingOfficer: row.clarifications.filter((c) => c.status === 'responded').length,
      clarificationsAwaitingApplicant: row.clarifications.filter((c) => c.status === 'requested').length,
      lastClarification: latest
        ? {
            id: latest.id,
            status: latest.status,
            subject: latest.subject,
            dueAt: latest.dueAt,
            updatedAt: latest.updatedAt,
          }
        : null,
      unlockedAt: row.unlockedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Feature 3: Risk scores (computed asynchronously in listQueue)
      risk: null as Record<string, unknown> | null,
    };
  }

  /**
   * The full review packet for ONE application: what the engine decided (pinned
   * snapshot), why the approval applies and on whose authority (citations), every
   * document with its extraction/verification provenance, consistency findings
   * (warning layer), and the clarification thread(s).
   *
   * NOTHING here is recomputed or invented: the profile is the run's own
   * `profileSnapshot`, the outcome is the pinned EvaluationResult, SLA/inspection/
   * renewal values are passed through as stored (null stays null), and document
   * states are the real DocumentVersion states.
   *
   * The scope check is repeated here even though OfficerApplicationGuard already
   * performed it — this service must be safe to call on its own.
   */
  async getApplication(scope: OfficerScope, instanceId: string): Promise<Record<string, unknown>> {
    const row = (await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      include: PACKET_INCLUDE,
    })) as unknown as PacketInstanceRow | null;
    if (!row) throw new NotFoundException(`Approval instance '${instanceId}' not found`);

    const authorityId = row.approvalDefinition?.authorityId;
    if (authorityId === undefined || !isAuthorityInScope(scope, authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message:
          'This application belongs to an authority you are not assigned to; you cannot review it',
        details: {
          instanceId,
          requiredAuthorityId: authorityId ?? null,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }

    const documents = (await this.documents.list(row.projectId)) as Record<string, unknown>[];
    const [versions, findings, clarifications] = await Promise.all([
      this.prisma.documentVersion.findMany({
        where: { document: { projectId: row.projectId } },
        select: {
          id: true,
          documentId: true,
          versionNumber: true,
          state: true,
          originalFilename: true,
          mimeType: true,
          sizeBytes: true,
          fileHash: true,
          uploadedAt: true,
          extractions: {
            select: {
              id: true,
              modelProvider: true,
              modelVersion: true,
              promptVersion: true,
              extractedAt: true,
            },
            orderBy: { extractedAt: 'desc' },
            take: 1,
          },
          verifications: {
            select: {
              id: true,
              verifiedAt: true,
              verifiedBy: true,
              method: true,
              evidenceInspected: true,
            },
            orderBy: { verifiedAt: 'desc' },
            take: 1,
          },
          corrections: {
            select: { id: true, fieldName: true, correctedValue: true, createdAt: true },
          },
        },
        orderBy: [{ documentId: 'asc' }, { versionNumber: 'desc' }],
      }),
      this.prisma.consistencyCheckResult.findMany({
        where: { projectId: row.projectId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.loadClarifications(row.id),
    ]);

    const versionsByDocument = new Map<string, Record<string, unknown>[]>();
    const stateCounts: Record<string, number> = {};
    for (const v of versions) {
      const list = versionsByDocument.get(v.documentId) ?? [];
      list.push({
        id: v.id,
        versionNumber: v.versionNumber,
        state: v.state,
        originalFilename: v.originalFilename,
        mimeType: v.mimeType,
        sizeBytes: v.sizeBytes,
        fileHash: v.fileHash,
        uploadedAt: v.uploadedAt,
        extraction: v.extractions[0] ?? null,
        verification: v.verifications[0] ?? null,
        corrections: v.corrections,
      });
      versionsByDocument.set(v.documentId, list);
      stateCounts[v.state] = (stateCounts[v.state] ?? 0) + 1;
    }

    // Feature 3: compute risk scores and fetch audit trail
    const [riskScores, auditTrail] = await Promise.all([
      this.riskService.calculateRiskForInstance(instanceId),
      this.auditService.getInstanceAudit(instanceId, 50),
    ]);

    const packet = this.serializePacket({
      row,
      documents,
      versionsByDocument,
      totalVersions: versions.length,
      stateCounts,
      consistencyFindings: findings.map((c) => ({
        id: c.id,
        checkType: c.checkType,
        checkId: c.checkId,
        profileField: c.profileField,
        documentField: c.documentField,
        sideAValue: c.sideAValue,
        sideBValue: c.sideBValue,
        outcome: c.outcome,
        tolerancePct: c.tolerancePct,
        detail: c.detail,
        documentId: c.documentId,
        documentVersionId: c.documentVersionId,
        createdAt: c.createdAt,
      })),
      clarifications,
      riskScores,
      auditTrail,
    });
    return packet;
  }

  /** Assembles the packet document. Pure formatting — no further I/O. */
  private serializePacket(args: {
    row: PacketInstanceRow;
    documents: Record<string, unknown>[];
    versionsByDocument: Map<string, Record<string, unknown>[]>;
    totalVersions: number;
    stateCounts: Record<string, number>;
    consistencyFindings: Record<string, unknown>[];
    clarifications: Record<string, unknown>[];
    riskScores?: Record<string, unknown>;
    auditTrail?: Record<string, unknown>[];
  }): Record<string, unknown> {
    const { row, documents, versionsByDocument, totalVersions, stateCounts, consistencyFindings, clarifications, riskScores, auditTrail } = args;
    const requirements = row.approvalDefinition?.requirements ?? [];
    const projectDocuments = row.project?.documents ?? [];
    const requiredItems = summarizeRequirements(requirements, projectDocuments);
    const outcome = row.evaluationResult?.outcome ?? null;

    return {
      instance: {
        id: row.id,
        projectId: row.projectId,
        status: row.status,
        unlockedAt: row.unlockedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        outcome,
        attentionRequired: outcome !== null && isAttentionRequired(outcome),
        missingFields: Array.isArray(row.evaluationResult?.missingFields)
          ? row.evaluationResult?.missingFields
          : [],
      },
      project: row.project
        ? {
            id: row.project.id,
            name: row.project.name,
            industry: row.project.industry,
            businessId: row.project.businessId,
            createdAt: row.project.createdAt,
            contacts: row.project.members.map((m) => m.user),
          }
        : null,
      // What the engine ACTUALLY evaluated (pinned), not a re-read of "the
      // current profile" — the packet must show the basis of THIS decision.
      evaluation: row.evaluationResult?.evaluationRun
        ? {
            runId: row.evaluationResult.evaluationRun.id,
            engineVersion: row.evaluationResult.evaluationRun.engineVersion,
            releaseId: row.evaluationResult.evaluationRun.releaseId,
            releaseVersion: row.evaluationResult.evaluationRun.release?.version ?? null,
            releaseStatus: row.evaluationResult.evaluationRun.release?.status ?? null,
            evaluatedAt: row.evaluationResult.evaluationRun.createdAt,
            profileSnapshot: row.evaluationResult.evaluationRun.profileSnapshot,
          }
        : null,
      approval: row.approvalDefinition
        ? {
            id: row.approvalDefinition.id,
            code: row.approvalDefinition.code,
            name: row.approvalDefinition.name,
            whyRequired: row.approvalDefinition.whyRequired,
            officialApplicationUrl: row.approvalDefinition.officialApplicationUrl,
            ambiguityNotes: row.approvalDefinition.ambiguityNotes,
            lastVerifiedDate: row.approvalDefinition.lastVerifiedDate,
            slaDays: row.approvalDefinition.slaDays,
            inspectionRequired: row.approvalDefinition.inspectionRequired,
            renewalRequired: row.approvalDefinition.renewalRequired,
            authority: row.approvalDefinition.authority,
            source: row.approvalDefinition.source,
          }
        : null,
      requiredDocuments: {
        total: requiredItems.length,
        verified: requiredItems.filter((r) => r.status === 'verified').length,
        providedUnverified: requiredItems.filter((r) => r.status === 'provided_unverified').length,
        missing: requiredItems.filter((r) => r.status === 'missing').length,
        items: requiredItems.map((item) => {
          const requirement = requirements.find((r) => r.documentDefinition.code === item.code);
          return {
            ...item,
            documentType: requirement?.documentDefinition.documentType ?? null,
            reusability: requirement?.documentDefinition.reusability ?? null,
            reuseConditions: requirement?.documentDefinition.reuseConditions ?? null,
            condition: requirement?.condition ?? null,
            matchingDocumentIds: projectDocuments
              .filter((d) => d.documentDefinition?.code === item.code)
              .map((d) => d.id),
          };
        }),
      },
      documents: documents.map((doc) => ({
        ...doc,
        versions: versionsByDocument.get(String(doc['id'])) ?? [],
      })),
      documentSummary: { totalVersions, stateCounts },
      // WARNING layer, exactly as stored — the officer sees findings and nothing
      // in the system gates on them.
      consistencyFindings,
      clarifications,
      clarificationSummary: {
        total: clarifications.length,
        open: clarifications.filter((c) => c['isOpen'] === true).length,
        awaitingOfficer: clarifications.filter((c) => c['status'] === 'responded').length,
        awaitingApplicant: clarifications.filter((c) => c['status'] === 'requested').length,
      },
      // Feature 3: Risk scores and audit trail
      riskScores: riskScores ?? null,
      auditTrail: auditTrail ?? [],
    };
  }

  /** Clarification threads for one application, newest activity first. */
  async listClarifications(
    scope: OfficerScope,
    instanceId: string,
  ): Promise<Record<string, unknown>[]> {
    await this.assertInstanceAuthority(scope, instanceId, 'list clarifications for');
    return this.loadClarifications(instanceId);
  }

  /** Every document in the application's project, with its current version. */
  async listDocuments(scope: OfficerScope, instanceId: string): Promise<Record<string, unknown>> {
    const projectId = await this.assertInstanceAuthority(scope, instanceId, 'list documents for');
    return { projectId, documents: await this.documents.list(projectId) };
  }

  /**
   * Serves a document's bytes to an officer. Deliberately a thin delegation to
   * DocumentsService: ONE file-serving path exists in the codebase, it already
   * refuses to expose storageKey as a URL, and the officer scope check happens
   * here (an officer is not a project member, so ProjectMemberGuard would — and
   * should — reject them on the applicant routes).
   */
  async downloadDocument(
    scope: OfficerScope,
    instanceId: string,
    documentId: string,
    versionId: string,
  ): Promise<{ buffer: Buffer; originalFilename: string; mimeType: string }> {
    const projectId = await this.assertInstanceAuthority(scope, instanceId, 'download documents for');
    return this.documents.download(projectId, documentId, versionId);
  }

  /** Clarification thread scoped to the officer's authorities. */
  async getClarification(
    scope: OfficerScope,
    clarificationId: string,
  ): Promise<Record<string, unknown>> {
    return this.loadClarificationForOfficer(scope, clarificationId);
  }

  /**
   * Resolves the authority that owns an instance and proves it is inside the
   * officer's scope. Missing instance → 404; present but out of scope → an
   * explicit 403 `officer_out_of_scope` (never a silently empty result).
   * Returns the instance's projectId.
   */
  private async assertInstanceAuthority(
    scope: OfficerScope,
    instanceId: string,
    verb: string,
  ): Promise<string> {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      select: { projectId: true, approvalDefinition: { select: { authorityId: true } } },
    });
    if (!instance) throw new NotFoundException(`Approval instance '${instanceId}' not found`);
    const authorityId = instance.approvalDefinition.authorityId;
    if (!isAuthorityInScope(scope, authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message: `You may not ${verb} this application — it belongs to an authority you are not assigned to`,
        details: {
          instanceId,
          requiredAuthorityId: authorityId,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }
    return instance.projectId;
  }

  private async assertClarificationAuthority(
    scope: OfficerScope,
    clarificationId: string,
  ): Promise<{ projectId: string; authorityId: string; status: string }> {
    const row = await this.prisma.clarificationRequest.findUnique({
      where: { id: clarificationId },
      select: { projectId: true, authorityId: true, status: true },
    });
    if (!row) throw new NotFoundException(`Clarification '${clarificationId}' not found`);
    if (!isAuthorityInScope(scope, row.authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message:
          'This clarification was raised by an authority you are not assigned to; you cannot act on it',
        details: {
          clarificationId,
          requiredAuthorityId: row.authorityId,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }
    return row;
  }

  private async loadClarificationForOfficer(
    scope: OfficerScope,
    clarificationId: string,
  ): Promise<Record<string, unknown>> {
    const row = (await this.prisma.clarificationRequest.findUnique({
      where: { id: clarificationId },
      include: CLARIFICATION_INCLUDE,
    })) as unknown as ClarificationRow | null;
    if (!row) throw new NotFoundException(`Clarification '${clarificationId}' not found`);
    if (!isAuthorityInScope(scope, row.authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message:
          'This clarification was raised by an authority you are not assigned to; you cannot act on it',
        details: {
          clarificationId,
          requiredAuthorityId: row.authorityId,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }
    return serializeClarification(row);
  }

  private async loadClarifications(instanceId: string): Promise<Record<string, unknown>[]> {
    const rows = (await this.prisma.clarificationRequest.findMany({
      where: { approvalInstanceId: instanceId },
      include: CLARIFICATION_INCLUDE,
    })) as unknown as ClarificationRow[];
    return rows
      .map((r) => serializeClarification(r))
      .sort(
        (a, b) =>
          new Date(String(b['updatedAt'])).getTime() - new Date(String(a['updatedAt'])).getTime(),
      );
  }

  /**
   * Officer raises a clarification on an application.
   *
   * - `requestedFields` defaults to the pinned evaluation's missingFields (the
   *   engine's own "what is unknown" list), so the ask carries the reason it was
   *   generated instead of being a free-text question with no provenance.
   * - projectId/authorityId are DENORMALIZED onto the row at creation, so the
   *   applicant inbox and the officer scope check never need a join later.
   * - A still-`blocked` application cannot be clarified: nothing has been
   *   submitted yet, so there is nothing for the applicant to answer → 409.
   */
  async createClarification(
    scope: OfficerScope,
    instanceId: string,
    body: unknown,
    actor: OfficerActor,
  ): Promise<Record<string, unknown>> {
    const input = parseBody(createClarificationSchema, body, 'clarification request');
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        projectId: true,
        status: true,
        approvalDefinition: { select: { code: true, name: true, authorityId: true } },
        evaluationResult: { select: { missingFields: true } },
      },
    });
    if (!instance) throw new NotFoundException(`Approval instance '${instanceId}' not found`);
    if (!isAuthorityInScope(scope, instance.approvalDefinition.authorityId)) {
      throw new ForbiddenException({
        code: 'officer_out_of_scope',
        message:
          'This application belongs to an authority you are not assigned to; you cannot review it',
        details: {
          instanceId,
          requiredAuthorityId: instance.approvalDefinition.authorityId,
          assignedAuthorityIds: scope.authorityIds,
        },
      });
    }
    if (instance.status === 'blocked') {
      throw new ConflictException({
        code: 'application_not_submitted',
        message:
          'This application is still blocked on a prerequisite approval — there is nothing for the applicant to clarify yet',
        details: { instanceId, instanceStatus: instance.status },
      });
    }

    const requestedFields =
      input.requestedFields !== undefined && input.requestedFields.length > 0
        ? input.requestedFields
        : deriveRequestedFields(instance.evaluationResult?.missingFields);

    const created = await this.prisma.clarificationRequest.create({
      data: {
        approvalInstanceId: instance.id,
        projectId: instance.projectId,
        authorityId: instance.approvalDefinition.authorityId,
        requestedByUserId: actor.userId,
        subject: input.subject ?? `Clarification needed for ${instance.approvalDefinition.name}`,
        message: input.message,
        requestedFields: requestedFields as unknown as Prisma.InputJsonValue,
        status: 'requested',
        dueAt: input.dueAt !== undefined ? new Date(input.dueAt) : null,
      },
      select: { id: true },
    });
    return this.loadClarificationForOfficer(scope, created.id);
  }

  /** Officer asks a follow-up question — the thread moves back to `requested`. */
  async followUpClarification(
    scope: OfficerScope,
    clarificationId: string,
    body: unknown,
    actor: OfficerActor,
  ): Promise<Record<string, unknown>> {
    const input = parseBody(followUpClarificationSchema, body, 'clarification follow-up');
    const extraData: Prisma.ClarificationRequestUncheckedUpdateInput = {};
    if (input.requestedFields !== undefined) {
      extraData.requestedFields = input.requestedFields as unknown as Prisma.InputJsonValue;
    }
    if (input.dueAt !== undefined) extraData.dueAt = new Date(input.dueAt);
    return this.applyOfficerAction(scope, clarificationId, 'officer_follow_up', actor, {
      note: null,
      message: input.message,
      extraData,
    });
  }

  /** Officer accepts the response and closes the thread as `resolved`. */
  async resolveClarification(
    scope: OfficerScope,
    clarificationId: string,
    body: unknown,
    actor: OfficerActor,
  ): Promise<Record<string, unknown>> {
    const input = parseBody(closeClarificationSchema, body, 'clarification resolution');
    return this.applyOfficerAction(scope, clarificationId, 'officer_resolve', actor, {
      note: input.note ?? null,
      message: null,
    });
  }

  /** Officer withdraws the question as `cancelled` (also a terminal close). */
  async cancelClarification(
    scope: OfficerScope,
    clarificationId: string,
    body: unknown,
    actor: OfficerActor,
  ): Promise<Record<string, unknown>> {
    const input = parseBody(closeClarificationSchema, body, 'clarification cancellation');
    return this.applyOfficerAction(scope, clarificationId, 'officer_cancel', actor, {
      note: input.note ?? null,
      message: null,
    });
  }

  /**
   * The single officer write path: scope check → state-machine transition →
   * append the officer's message (when there is one) → persist the new status.
   *
   * A terminal transition records WHO closed it and WHY in the SAME transaction
   * as the status change, so provenance can never be separated from the state.
   */
  private async applyOfficerAction(
    scope: OfficerScope,
    clarificationId: string,
    action: 'officer_follow_up' | 'officer_resolve' | 'officer_cancel',
    actor: OfficerActor,
    options: {
      note: string | null;
      message: string | null;
      extraData?: Prisma.ClarificationRequestUncheckedUpdateInput;
    },
  ): Promise<Record<string, unknown>> {
    const current = await this.assertClarificationAuthority(scope, clarificationId);
    const nextStatus = applyClarificationAction(current.status, action);
    const closing = nextStatus === 'resolved' || nextStatus === 'cancelled';

    const data: Prisma.ClarificationRequestUncheckedUpdateInput = {
      ...(options.extraData ?? {}),
      status: nextStatus,
    };
    if (closing) {
      // Closing records WHO and WHY in the same write as the status change.
      data.resolvedAt = new Date();
      data.resolvedByUserId = actor.userId;
      data.resolutionNote = options.note;
    }

    await this.prisma.$transaction(async (tx) => {
      if (options.message !== null) {
        await tx.clarificationResponse.create({
          data: {
            clarificationRequestId: clarificationId,
            authorUserId: actor.userId,
            authorRole: actor.role as 'applicant' | 'officer' | 'admin',
            message: options.message,
          },
        });
      }
      await tx.clarificationRequest.update({ where: { id: clarificationId }, data });
    });

    return this.loadClarificationForOfficer(scope, clarificationId);
  }

  /** Get instance info for audit logging (used by the controller). */
  async getInstanceForAudit(instanceId: string): Promise<{ projectId: string } | null> {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      select: { projectId: true },
    });
    return instance;
  }

  /** Record an audit event (delegated to AuditService). */
  async recordAuditEvent(params: {
    userId: string;
    projectId?: string;
    approvalInstanceId?: string;
    action: string;
    actor: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    return this.auditService.record(params);
  }
}

/**
 * Turns the pinned evaluation's `neededInformation` (the engine's own list of
 * unknown/mismatched fields) into clarification `requestedFields`, preserving the
 * engine's reason verbatim instead of re-inventing one.
 */
function deriveRequestedFields(missingFields: unknown): Array<{ field: string; reason?: string }> {
  if (!Array.isArray(missingFields)) return [];
  const out: Array<{ field: string; reason?: string }> = [];
  for (const item of missingFields) {
    if (typeof item !== 'object' || item === null) continue;
    const field = (item as { field?: unknown }).field;
    if (typeof field !== 'string' || field.length === 0) continue;
    const reason = (item as { reason?: unknown }).reason;
    const detail = (item as { detail?: unknown }).detail;
    const parts: string[] = [];
    if (typeof reason === 'string' && reason.length > 0) parts.push(reason);
    if (typeof detail === 'string' && detail.length > 0) parts.push(detail);
    const entry: { field: string; reason?: string } = { field };
    if (parts.length > 0) entry.reason = parts.join(' — ');
    out.push(entry);
  }
  return out;
}
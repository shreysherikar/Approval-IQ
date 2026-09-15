import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '../common/decorators/roles.decorator';
import { respondToClarificationSchema, parseBody } from './clarification.dto';
import {
  CLARIFICATION_INCLUDE,
  applyClarificationAction,
  assertDocumentsInProject,
  serializeClarification,
  type ClarificationRow,
} from './clarification.support';
import { isClarificationStatus, isOpen, type ClarificationStatus } from './clarification-state';

export interface ListClarificationsParams {
  status?: string;
  approvalInstanceId?: string;
}

export interface ClarificationActor {
  userId: string;
  role: UserRole;
}

/**
 * Applicant side of the Phase 9 clarification loop.
 *
 * AUTHORIZATION: every route is project-scoped and runs JwtAuthGuard +
 * ProjectMemberGuard, so only a member of the project can read or answer its
 * clarifications — the applicant inbox is exactly "my project's open questions".
 *
 * READ-ONLY toward everything else: this service never changes an
 * ApprovalInstance status, a document's state, or an evaluation. It only
 * appends responses and moves the clarification's own status through the state
 * machine.
 */
@Injectable()
export class ClarificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Builds the status filter, rejecting an unknown status rather than ignoring it. */
  private statusWhere(status: string | undefined): Prisma.EnumClarificationStatusFilter | undefined {
    if (status === undefined) return undefined;
    if (status === 'open') return { in: ['requested', 'responded'] };
    if (isClarificationStatus(status)) return { equals: status };
    throw new BadRequestException({
      message: `Unknown clarification status '${status}'`,
      details: { allowed: ['open', 'requested', 'responded', 'resolved', 'cancelled'] },
    });
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);
  }

  private async loadOrThrow(projectId: string, clarificationId: string): Promise<ClarificationRow> {
    const row = (await this.prisma.clarificationRequest.findFirst({
      where: { id: clarificationId, projectId },
      include: CLARIFICATION_INCLUDE,
    })) as unknown as ClarificationRow | null;
    if (!row) {
      throw new NotFoundException(
        `Clarification '${clarificationId}' not found for project '${projectId}'`,
      );
    }
    return row;
  }

  /** Full thread for one clarification, scoped to the project. */
  async get(projectId: string, clarificationId: string): Promise<Record<string, unknown>> {
    const row = await this.loadOrThrow(projectId, clarificationId);
    return serializeClarification(row);
  }

  /**
   * The applicant's clarification inbox: every clarification raised against this
   * project's approval instances, newest activity first with OPEN items ahead of
   * closed ones (so an unanswered question is never buried under history).
   */
  async list(
    projectId: string,
    params: ListClarificationsParams = {},
  ): Promise<Record<string, unknown>> {
    await this.assertProjectExists(projectId);
    const statusFilter = this.statusWhere(params.status);
    const where: Prisma.ClarificationRequestWhereInput = { projectId };
    if (statusFilter !== undefined) where.status = statusFilter;
    if (params.approvalInstanceId !== undefined) {
      where.approvalInstanceId = params.approvalInstanceId;
    }

    const rows = (await this.prisma.clarificationRequest.findMany({
      where,
      include: CLARIFICATION_INCLUDE,
    })) as unknown as ClarificationRow[];

    const serialized = rows.map((r) => serializeClarification(r));
    serialized.sort((a, b) => {
      const openDelta = Number(b['isOpen'] === true) - Number(a['isOpen'] === true);
      if (openDelta !== 0) return openDelta;
      return new Date(String(b['updatedAt'])).getTime() - new Date(String(a['updatedAt'])).getTime();
    });

    const byStatus: Record<ClarificationStatus, number> = {
      requested: 0,
      responded: 0,
      resolved: 0,
      cancelled: 0,
    };
    let openCount = 0;
    let awaitingApplicantCount = 0;
    for (const r of rows) {
      const status = r.status as ClarificationStatus;
      byStatus[status] += 1;
      if (isOpen(status)) {
        openCount += 1;
        if (status === 'requested') awaitingApplicantCount += 1;
      }
    }

    return {
      projectId,
      total: serialized.length,
      openCount,
      awaitingApplicantCount,
      countsByStatus: byStatus,
      clarifications: serialized,
    };
  }

  /**
   * Applicant answers (optionally attaching documents ALREADY in the project's
   * vault). Appends an immutable response row, records `respondedAt`, and moves
   * requested|responded → responded. Illegal transitions (e.g. answering a
   * resolved clarification) are rejected with 409.
   */
  async respond(
    projectId: string,
    clarificationId: string,
    body: unknown,
    actor: ClarificationActor,
  ): Promise<Record<string, unknown>> {
    const input = parseBody(respondToClarificationSchema, body, 'clarification response');
    const row = await this.loadOrThrow(projectId, clarificationId);
    const nextStatus = applyClarificationAction(row.status, 'applicant_response');
    const documentIds = [...new Set(input.documentIds ?? [])];
    await assertDocumentsInProject(this.prisma, projectId, documentIds);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const response = await tx.clarificationResponse.create({
        data: {
          clarificationRequestId: clarificationId,
          authorUserId: actor.userId,
          // Role at the time of writing — never re-derived later.
          authorRole: actor.role as 'applicant' | 'officer' | 'admin',
          message: input.message,
        },
      });
      if (documentIds.length > 0) {
        await tx.clarificationResponseDocument.createMany({
          data: documentIds.map((documentId) => ({
            clarificationResponseId: response.id,
            documentId,
          })),
          skipDuplicates: true,
        });
      }
      await tx.clarificationRequest.update({
        where: { id: clarificationId },
        data: { status: nextStatus, respondedAt: now },
      });
    });

    return this.get(projectId, clarificationId);
  }
}
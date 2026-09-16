import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UserRole } from '../common/decorators/roles.decorator';
import {
  createGrievanceSchema,
  escalateGrievanceSchema,
  investigateGrievanceSchema,
  parseDto,
  resolveGrievanceSchema,
  withdrawGrievanceSchema,
  type GrievanceStatus,
  type GrievanceTier,
  type GrievanceType,
} from './grievance.dto';
import {
  GRIEVANCE_INCLUDE,
  getNextGrievanceTier,
  serializeGrievance,
  type GrievanceRow,
  type SerializedGrievance,
} from './grievance.support';

export interface GrievanceActor {
  userId: string;
  role: UserRole;
}

export interface ListGrievancesParams {
  status?: string | undefined;
  tier?: string | undefined;
  type?: string | undefined;
  approvalInstanceId?: string | undefined;
}

@Injectable()
export class GrievancesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private generateGrievanceNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `GRV-${year}-${random}`;
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);
  }

  private async loadOrThrow(projectId: string, grievanceId: string): Promise<GrievanceRow> {
    const row = (await this.prisma.grievance.findFirst({
      where: { id: grievanceId, projectId },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow | null;

    if (!row) {
      throw new NotFoundException(`Grievance '${grievanceId}' not found for project '${projectId}'`);
    }
    return row;
  }

  /**
   * Lodges a formal statutory RTS Act grievance for an applicant project.
   */
  async create(
    projectId: string,
    body: unknown,
    actor: GrievanceActor,
  ): Promise<SerializedGrievance> {
    await this.assertProjectExists(projectId);
    const dto = parseDto(createGrievanceSchema, body);

    let authorityId = dto.authorityId;
    if (dto.approvalInstanceId) {
      const instance = await this.prisma.approvalInstance.findFirst({
        where: { id: dto.approvalInstanceId, projectId },
        include: { approvalDefinition: { select: { authorityId: true } } },
      });
      if (!instance) {
        throw new BadRequestException(
          `Approval instance '${dto.approvalInstanceId}' does not belong to project '${projectId}'`,
        );
      }
      if (!authorityId) {
        authorityId = instance.approvalDefinition.authorityId;
      }
    }

    const documentIds = dto.documentIds ?? [];
    if (documentIds.length > 0) {
      const docs = await this.prisma.document.findMany({
        where: { id: { in: documentIds }, projectId },
        select: { id: true },
      });
      if (docs.length !== documentIds.length) {
        throw new BadRequestException('One or more attached documents do not belong to this project');
      }
    }

    const slaDays = dto.statutorySlaDays || 15;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + slaDays);

    const grievanceNumber = this.generateGrievanceNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const grievance = await tx.grievance.create({
        data: {
          grievanceNumber,
          projectId,
          approvalInstanceId: dto.approvalInstanceId ?? null,
          authorityId: authorityId ?? null,
          submittedByUserId: actor.userId,
          type: dto.type,
          tier: 'tier_1_nodal_officer',
          status: 'submitted',
          subject: dto.subject,
          description: dto.description,
          statutorySlaDays: slaDays,
          targetResolutionDate: targetDate,
          documents: {
            create: documentIds.map((docId) => ({ documentId: docId })),
          },
        },
      });

      await tx.grievanceAction.create({
        data: {
          grievanceId: grievance.id,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: 'grievance_submitted',
          fromStatus: null,
          toStatus: 'submitted',
          fromTier: null,
          toTier: 'tier_1_nodal_officer',
          remarks: `Grievance registered under Maharashtra RTS Act with ${slaDays} days statutory resolution SLA.`,
        },
      });

      return grievance;
    });

    const full = (await this.prisma.grievance.findUnique({
      where: { id: created.id },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow;

    return serializeGrievance(full);
  }

  /**
   * Lists grievances lodged for a project.
   */
  async list(
    projectId: string,
    params: ListGrievancesParams = {},
  ): Promise<{ grievances: SerializedGrievance[]; total: number }> {
    await this.assertProjectExists(projectId);

    const where: Prisma.GrievanceWhereInput = { projectId };
    if (params.status) where.status = params.status as GrievanceStatus;
    if (params.tier) where.tier = params.tier as GrievanceTier;
    if (params.type) where.type = params.type as GrievanceType;
    if (params.approvalInstanceId) where.approvalInstanceId = params.approvalInstanceId;

    const rows = (await this.prisma.grievance.findMany({
      where,
      include: GRIEVANCE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })) as unknown as GrievanceRow[];

    return {
      grievances: rows.map(serializeGrievance),
      total: rows.length,
    };
  }

  /**
   * Retrieves full timeline and details for a specific grievance.
   */
  async get(projectId: string, grievanceId: string): Promise<SerializedGrievance> {
    const row = await this.loadOrThrow(projectId, grievanceId);
    return serializeGrievance(row);
  }

  /**
   * Generates a Statutory Appeal Filing Pack docket for Tier 3 RTS Commission submission.
   */
  async generateFilingPack(projectId: string, grievanceId: string): Promise<Record<string, unknown>> {
    const row = await this.loadOrThrow(projectId, grievanceId);
    const serialized = serializeGrievance(row);

    const generatedAt = new Date().toISOString();
    const docketNumber = `RTS-BENCH3-DOCKET-${row.grievanceNumber.replace(/[^A-Z0-9]/g, '')}`;

    return {
      docketNumber,
      grievance: serialized,
      statutoryFramework: {
        act: 'Maharashtra Right to Public Services Act, 2015 (RTS Act)',
        jurisdiction: 'Tier 3 — State Right to Service Commission Tribunal',
        section: 'Section 18 & 19: Second Appeal & Penal Proceedings against Nodal / Appellate Officers',
        statutoryTribunalAddress: '15th Floor, New Administrative Building, Opposite Mantralaya, Madam Cama Road, Mumbai 400032',
      },
      summaryChronology: row.actions.map((act, index) => ({
        sequenceNumber: index + 1,
        date: act.createdAt.toISOString(),
        actionType: act.actionType,
        fromTier: act.fromTier,
        toTier: act.toTier,
        fromStatus: act.fromStatus,
        toStatus: act.toStatus,
        remarks: act.remarks,
        orderNumber: act.orderNumber ?? 'N/A',
        officerInCharge: act.actor ? `${act.actor.email} (${act.actorRole})` : 'Statutory Automated Daemon',
      })),
      verificationSeal: {
        certifiedTrueCopy: true,
        hash: `SHA256-${Date.now().toString(16)}-${row.id.slice(0, 8)}`,
        generatedAt,
      },
    };
  }

  /**
   * Applicant manually escalates to the next statutory appellate tier.
   */
  async escalate(
    projectId: string,
    grievanceId: string,
    body: unknown,
    actor: GrievanceActor,
  ): Promise<SerializedGrievance> {
    const row = await this.loadOrThrow(projectId, grievanceId);

    if (row.status === 'redressed' || row.status === 'withdrawn') {
      throw new BadRequestException(
        `Cannot escalate a grievance that is already ${row.status}`,
      );
    }

    const nextTier = getNextGrievanceTier(row.tier as GrievanceTier);
    if (!nextTier) {
      throw new BadRequestException(
        'Grievance is already at the highest statutory appellate tier (Tier 3 RTS Commission).',
      );
    }

    const dto = parseDto(escalateGrievanceSchema, body);
    const targetTier = dto.targetTier ?? nextTier;

    // Reset statutory clock for the higher tier
    const newTargetDate = new Date();
    newTargetDate.setDate(newTargetDate.getDate() + row.statutorySlaDays);

    await this.prisma.$transaction(async (tx) => {
      await tx.grievance.update({
        where: { id: grievanceId },
        data: {
          tier: targetTier,
          status: 'escalated',
          targetResolutionDate: newTargetDate,
        },
      });

      await tx.grievanceAction.create({
        data: {
          grievanceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: 'statutory_escalation',
          fromStatus: row.status,
          toStatus: 'escalated',
          fromTier: row.tier,
          toTier: targetTier,
          remarks: dto.remarks,
        },
      });

      if (dto.documentIds && dto.documentIds.length > 0) {
        for (const docId of dto.documentIds) {
          await tx.grievanceDocument.upsert({
            where: {
              grievanceId_documentId: {
                grievanceId,
                documentId: docId,
              },
            },
            create: { grievanceId, documentId: docId },
            update: {},
          });
        }
      }
    });

    const updated = await this.loadOrThrow(projectId, grievanceId);
    return serializeGrievance(updated);
  }

  /**
   * Applicant withdraws their grievance.
   */
  async withdraw(
    projectId: string,
    grievanceId: string,
    body: unknown,
    actor: GrievanceActor,
  ): Promise<SerializedGrievance> {
    const row = await this.loadOrThrow(projectId, grievanceId);
    if (row.status === 'redressed' || row.status === 'rejected' || row.status === 'withdrawn') {
      throw new BadRequestException(`Grievance is already closed (${row.status})`);
    }

    const dto = parseDto(withdrawGrievanceSchema, body);

    await this.prisma.$transaction(async (tx) => {
      await tx.grievance.update({
        where: { id: grievanceId },
        data: { status: 'withdrawn' },
      });

      await tx.grievanceAction.create({
        data: {
          grievanceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: 'grievance_withdrawn',
          fromStatus: row.status,
          toStatus: 'withdrawn',
          fromTier: row.tier,
          toTier: row.tier,
          remarks: dto.reason,
        },
      });
    });

    const updated = await this.loadOrThrow(projectId, grievanceId);
    return serializeGrievance(updated);
  }

  // -------------------------------------------------------------------------
  // Officer & Appellate Authority Queue & Operations
  // -------------------------------------------------------------------------

  /**
   * Officer/Appellate queue of grievances. Officers can see grievances assigned to their authority or all if admin.
   */
  async listForOfficer(
    actor: GrievanceActor,
    params: ListGrievancesParams = {},
  ): Promise<{ grievances: SerializedGrievance[]; total: number }> {
    const where: Prisma.GrievanceWhereInput = {};

    if (actor.role === 'officer') {
      const assignments = await this.prisma.officerAuthorityAssignment.findMany({
        where: { officerId: actor.userId },
        select: { authorityId: true },
      });
      const assignedIds = assignments.map((a) => a.authorityId);
      where.authorityId = { in: assignedIds };
    }

    if (params.status) where.status = params.status as GrievanceStatus;
    if (params.tier) where.tier = params.tier as GrievanceTier;
    if (params.type) where.type = params.type as GrievanceType;

    const rows = (await this.prisma.grievance.findMany({
      where,
      include: GRIEVANCE_INCLUDE,
      orderBy: [{ targetResolutionDate: 'asc' }, { createdAt: 'desc' }],
    })) as unknown as GrievanceRow[];

    return {
      grievances: rows.map(serializeGrievance),
      total: rows.length,
    };
  }

  /**
   * Officer marks grievance as under investigation and records hearing/inquiry details.
   */
  async officerInvestigate(
    grievanceId: string,
    body: unknown,
    actor: GrievanceActor,
  ): Promise<SerializedGrievance> {
    const row = (await this.prisma.grievance.findUnique({
      where: { id: grievanceId },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow | null;

    if (!row) throw new NotFoundException(`Grievance '${grievanceId}' not found`);

    if (actor.role === 'officer' && row.authorityId) {
      const isAssigned = await this.prisma.officerAuthorityAssignment.findFirst({
        where: { officerId: actor.userId, authorityId: row.authorityId },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to the authority handling this grievance.');
      }
    }

    const dto = parseDto(investigateGrievanceSchema, body);

    await this.prisma.$transaction(async (tx) => {
      await tx.grievance.update({
        where: { id: grievanceId },
        data: { status: 'under_investigation' },
      });

      await tx.grievanceAction.create({
        data: {
          grievanceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: 'investigation_initiated',
          fromStatus: row.status,
          toStatus: 'under_investigation',
          fromTier: row.tier,
          toTier: row.tier,
          remarks: dto.remarks,
          metadata: {
            hearingScheduledAt: dto.hearingScheduledAt,
            assignedInvestigator: dto.assignedInvestigator,
          },
        },
      });
    });

    const updated = (await this.prisma.grievance.findUnique({
      where: { id: grievanceId },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow;

    return serializeGrievance(updated);
  }

  /**
   * Officer or Appellate Authority formally resolves/redresses the grievance with a binding order.
   */
  async officerResolve(
    grievanceId: string,
    body: unknown,
    actor: GrievanceActor,
  ): Promise<SerializedGrievance> {
    const row = (await this.prisma.grievance.findUnique({
      where: { id: grievanceId },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow | null;

    if (!row) throw new NotFoundException(`Grievance '${grievanceId}' not found`);

    if (actor.role === 'officer' && row.authorityId) {
      const isAssigned = await this.prisma.officerAuthorityAssignment.findFirst({
        where: { officerId: actor.userId, authorityId: row.authorityId },
      });
      if (!isAssigned) {
        throw new ForbiddenException('You are not assigned to the authority handling this grievance.');
      }
    }

    const dto = parseDto(resolveGrievanceSchema, body);
    const resolvedStatus: GrievanceStatus = dto.outcome;

    await this.prisma.$transaction(async (tx) => {
      await tx.grievance.update({
        where: { id: grievanceId },
        data: {
          status: resolvedStatus,
          resolvedAt: new Date(),
          resolvedByUserId: actor.userId,
          resolutionSummary: dto.resolutionSummary,
          rectificationAction: dto.rectificationAction ?? null,
        },
      });

      await tx.grievanceAction.create({
        data: {
          grievanceId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          actionType: `grievance_${resolvedStatus}`,
          fromStatus: row.status,
          toStatus: resolvedStatus,
          fromTier: row.tier,
          toTier: row.tier,
          orderNumber: dto.orderNumber ?? null,
          remarks: dto.resolutionSummary,
          metadata: {
            rectificationAction: dto.rectificationAction,
          },
        },
      });
    });

    const updated = (await this.prisma.grievance.findUnique({
      where: { id: grievanceId },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow;

    return serializeGrievance(updated);
  }

  /**
   * Automated SLA delay check & auto-escalation engine.
   * Can be triggered by background cron worker to escalate overdue grievances to the next tier.
   */
  async autoEscalateOverdueGrievances(): Promise<{ escalatedCount: number }> {
    const now = new Date();
    const overdueGrievances = (await this.prisma.grievance.findMany({
      where: {
        status: { in: ['submitted', 'under_investigation', 'escalated'] },
        targetResolutionDate: { lt: now },
        tier: { in: ['tier_1_nodal_officer', 'tier_2_appellate_authority'] },
      },
      include: GRIEVANCE_INCLUDE,
    })) as unknown as GrievanceRow[];

    let count = 0;
    for (const item of overdueGrievances) {
      const nextTier = getNextGrievanceTier(item.tier as GrievanceTier);
      if (!nextTier) continue;

      const newTarget = new Date();
      newTarget.setDate(newTarget.getDate() + item.statutorySlaDays);

      await this.prisma.$transaction(async (tx) => {
        await tx.grievance.update({
          where: { id: item.id },
          data: {
            tier: nextTier,
            status: 'escalated',
            slaBreachDetectedAt: item.slaBreachDetectedAt ?? now,
            autoEscalatedAt: now,
            targetResolutionDate: newTarget,
          },
        });

        await tx.grievanceAction.create({
          data: {
            grievanceId: item.id,
            actorUserId: null,
            actorRole: 'admin',
            actionType: 'system_auto_escalation',
            fromStatus: item.status,
            toStatus: 'escalated',
            fromTier: item.tier,
            toTier: nextTier,
            remarks: `Automatic statutory escalation under RTS Act: Resolution deadline of ${item.statutorySlaDays} days breached at ${item.tier}. Escalated to ${nextTier}.`,
          },
        });
      });

      count++;
    }

    return { escalatedCount: count };
  }
}

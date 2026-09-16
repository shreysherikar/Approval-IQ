import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Record an audit event. */
  async record(params: {
    userId: string;
    projectId?: string;
    approvalInstanceId?: string;
    action: string;
    actor: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        userId: params.userId,
        projectId: params.projectId ?? null,
        approvalInstanceId: params.approvalInstanceId ?? null,
        action: params.action,
        actor: params.actor,
        details: params.details !== undefined ? JSON.parse(JSON.stringify(params.details)) as Prisma.InputJsonValue : Prisma.JsonNull,
      },
    });
  }

  /** Get audit trail for a project. */
  async getProjectAudit(projectId: string, limit = 100): Promise<Record<string, unknown>[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map(e => ({
      id: e.id,
      userId: e.userId,
      user: e.user,
      projectId: e.projectId,
      approvalInstanceId: e.approvalInstanceId,
      action: e.action,
      actor: e.actor,
      details: e.details,
      createdAt: e.createdAt,
    }));
  }

  /** Get audit trail for an approval instance. */
  async getInstanceAudit(instanceId: string, limit = 100): Promise<Record<string, unknown>[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: { approvalInstanceId: instanceId },
      include: {
        user: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map(e => ({
      id: e.id,
      userId: e.userId,
      user: e.user,
      projectId: e.projectId,
      approvalInstanceId: e.approvalInstanceId,
      action: e.action,
      actor: e.actor,
      details: e.details,
      createdAt: e.createdAt,
    }));
  }
}

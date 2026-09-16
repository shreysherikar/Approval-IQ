import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** Membership-scoped project list for dashboards/BI pages. */
  async listForUser(userId: string): Promise<Array<Record<string, unknown>>> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: { select: { id: true, name: true, industry: true, businessId: true, createdAt: true, updatedAt: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map((m) => m.project as unknown as Record<string, unknown>);
  }

  /** One project, only if the user is a member (object-level authorization). */
  async getForMember(projectId: string, userId: string): Promise<Record<string, unknown>> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      include: { project: { select: { id: true, name: true, industry: true, businessId: true, createdAt: true, updatedAt: true } } },
    });
    if (!membership) throw new ForbiddenException(`User is not a member of project '${projectId}'`);
    return membership.project as unknown as Record<string, unknown>;
  }

  async create(dto: CreateProjectDto, userId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.$transaction(async (tx) => {
      // Ensure user row exists in DB before linking membership
      const userExists = await tx.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        await tx.user.create({
          data: {
            id: userId,
            email: `${userId}@auth.local`,
            authProvider: 'google',
            role: 'applicant',
          },
        });
      }

      const p = await tx.project.create({
        data: { name: dto.name, industry: dto.industry, businessId: dto.businessId },
      });
      // Seed the creator as a project member so ProjectMemberGuard passes for them.
      await tx.projectMember.create({ data: { projectId: p.id, userId } });
      return p;
    });
    return {
      id: project.id,
      name: project.name,
      industry: project.industry,
      businessId: project.businessId,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
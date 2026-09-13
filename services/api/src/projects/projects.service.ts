import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, userId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.$transaction(async (tx) => {
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
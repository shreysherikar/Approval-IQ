import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.create({
      data: { name: dto.name, industry: dto.industry, businessId: dto.businessId },
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
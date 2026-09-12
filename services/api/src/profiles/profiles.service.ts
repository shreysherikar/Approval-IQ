import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationsService } from '../evaluations/evaluations.service';
import { RoadmapService } from '../roadmap/roadmap.service';

type VersionRow = {
  id: string;
  projectId: string;
  versionNumber: number;
  values: unknown;
  status: string;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DraftPayload = { values: Record<string, unknown> };

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EvaluationsService) private readonly evaluations: EvaluationsService,
    @Inject(RoadmapService) private readonly roadmap: RoadmapService,
  ) {}

  private async assertProjectExists(projectId: string): Promise<{ id: string; industry: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, industry: true },
    });
    if (!project) throw new NotFoundException(`Project '${projectId}' not found`);
    return project;
  }

  private async assertVersion(projectId: string, versionId: string): Promise<VersionRow> {
    const row = (await this.prisma.businessProfileVersion.findFirst({
      where: { id: versionId, projectId },
    })) as unknown as VersionRow | null;
    if (!row) {
      throw new NotFoundException(
        `Profile version '${versionId}' not found for project '${projectId}'`,
      );
    }
    return row;
  }

  private serialize(row: VersionRow): Record<string, unknown> {
    return {
      id: row.id,
      projectId: row.projectId,
      versionNumber: row.versionNumber,
      values: row.values,
      status: row.status,
      confirmedAt: row.confirmedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Validates the request body `{ values: { ...partial BusinessProfile } }`
   * against the shared draft schema. ANY SUBSET of fields is accepted (the
   * intake form is filled incrementally), but every field that IS provided
   * must satisfy the shared types/units — wrong types, negative numbers or
   * invalid enum values are rejected.
   */
  private async parseDraftBody(body: unknown): Promise<Record<string, unknown>> {
    const { businessProfileDraftSchema } = await import('@approvaliq/contracts');
    const parsed = businessProfileDraftSchema.safeParse(
      (body as DraftPayload | null)?.values ?? body,
    );
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid BusinessProfile draft',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data as Record<string, unknown>;
  }

  async createDraft(projectId: string, body: unknown): Promise<Record<string, unknown>> {
    const [values] = await Promise.all([
      this.parseDraftBody(body),
      this.assertProjectExists(projectId),
    ]);
    const last = await this.prisma.businessProfileVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    const row = (await this.prisma.businessProfileVersion.create({
      data: {
        projectId,
        versionNumber,
        values: values as unknown as Prisma.InputJsonValue,
        status: 'draft',
      },
    })) as unknown as VersionRow;
    return this.serialize(row);
  }

  /**
   * Updates a DRAFT version's values. Explicit immutability check: a
   * confirmed version must never be mutated — edits require a new version.
   */
  async updateDraft(
    projectId: string,
    versionId: string,
    body: unknown,
  ): Promise<Record<string, unknown>> {
    await this.assertProjectExists(projectId);
    const existing = await this.assertVersion(projectId, versionId);
    if (existing.status !== 'draft') {
      throw new ConflictException(
        `Profile version ${existing.versionNumber} is '${existing.status}' and ` +
          `immutable — create a new version to revise it.`,
      );
    }
    const values = await this.parseDraftBody(body);
    const row = (await this.prisma.businessProfileVersion.update({
      where: { id: versionId },
      data: { values: values as unknown as Prisma.InputJsonValue },
    })) as unknown as VersionRow;
    return this.serialize(row);
  }

  /**
   * Locks a draft profile: status → 'confirmed', confirmedAt set. Once
   * confirmed the version is immutable (enforced above in updateDraft).
   * On success the Phase-2 evaluation engine is automatically invoked with
   * this profile version and its result is returned alongside the profile.
   */
  async confirm(
    projectId: string,
    versionId: string,
  ): Promise<Record<string, unknown>> {
    const project = await this.assertProjectExists(projectId);
    const existing = await this.assertVersion(projectId, versionId);
    if (existing.status === 'confirmed') {
      throw new ConflictException(
        `Profile version ${existing.versionNumber} is already confirmed and ` +
          `immutable — create a new version to revise it.`,
      );
    }
    // Confirming requires a COMPLETE profile: validate the stored values
    // against the FULL shared schema (partial drafts are not confirmable).
    const { businessProfileSchema } = await import('@approvaliq/contracts');
    const parsed = businessProfileSchema.safeParse(existing.values);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Profile draft is incomplete — all BusinessProfile fields must be provided before confirming',
        details: parsed.error.flatten(),
      });
    }
    const row = (await this.prisma.businessProfileVersion.update({
      where: { id: versionId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })) as unknown as VersionRow;

    // Auto-call the Phase-2 /evaluations endpoint with this profile version.
    // industryCode falls back to the project's industry for release scoping.
    const evaluation = await this.evaluations.create({
      profile: parsed.data,
      industryCode: project.industry,
    } as never);
    // Phase-4 extension of the confirm-then-evaluate flow: derive the
    // applicant's approval roadmap (ApprovalInstances) from the pinned
    // evaluation results of THIS run. applicable / needs_information /
    // not_evaluable produce instances (not_evaluable is flagged as
    // attention-required at read time via its linked EvaluationResult);
    // not_applicable produces none.
    const roadmapInstances = await this.roadmap.syncInstancesForRun(
      projectId,
      evaluation.id as string,
    );
    return { profile: this.serialize(row), evaluation, roadmapInstances };
  }
}

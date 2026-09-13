import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JobsService } from '../jobs/jobs.service';

@Injectable()
export class IntelligenceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async enqueueExtraction(projectId: string, documentId: string): Promise<Record<string, unknown>> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId },
      include: { currentVersion: true },
    });
    if (!doc) throw new NotFoundException(`Document '${documentId}' not found in project '${projectId}'`);
    const version = doc.currentVersion;
    if (!version) throw new NotFoundException('No document version to extract');
    const state = String(version.state);
    if (state === 'superseded' || state === 'archived') {
      throw new BadRequestException(`Cannot extract a ${state} version`);
    }
    await this.prisma.documentVersion.updateMany({
      where: { id: version.id, state: 'uploaded' },
      data: { state: 'queued' },
    });
    return this.jobs.enqueue(
      'document_extraction',
      { projectId, documentId, documentVersionId: version.id },
      `extract:${version.id}`,
    );
  }

  async jobStatus(jobId: string): Promise<Record<string, unknown>> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException(`Job '${jobId}' not found`);
    return job;
  }
  async latestExtraction(projectId: string, documentId: string, versionId: string): Promise<Record<string, unknown> | null> {
    await this.assertVersion(projectId, documentId, versionId);
    const row = await this.prisma.extractionResult.findFirst({
      where: { documentVersionId: versionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    const corrections = await this.prisma.fieldCorrection.findMany({ where: { documentVersionId: versionId } });
    const threshold = Number(this.config.get('EXTRACTION_REVIEW_THRESHOLD') ?? 0.6);
    return {
      id: row.id, documentVersionId: row.documentVersionId, fields: row.fields,
      corrections: corrections.map((c) => ({ fieldName: c.fieldName, correctedValue: c.correctedValue, source: c.source })),
      modelProvider: row.modelProvider, modelVersion: row.modelVersion,
      promptVersion: row.promptVersion, extractedAt: row.extractedAt, reviewThreshold: threshold,
    };
  }

  async correctField(projectId: string, documentId: string, versionId: string, fieldName: string, correctedValue: string, userId: string): Promise<Record<string, unknown>> {
    await this.assertVersion(projectId, documentId, versionId);
    if (!fieldName || typeof correctedValue !== 'string') throw new BadRequestException('fieldName and correctedValue are required');
    await this.prisma.fieldCorrection.create({
      data: { documentVersionId: versionId, fieldName, correctedValue, source: 'user_corrected', correctedByUserId: userId },
    });
    return (await this.latestExtraction(projectId, documentId, versionId)) ?? {};
  }

  async verify(projectId: string, documentId: string, versionId: string, userId: string, body: { fieldsVerified?: string[]; notes?: string; evidenceInspected?: boolean }): Promise<Record<string, unknown>> {
    const version = await this.assertVersion(projectId, documentId, versionId);
    if (version.state !== 'needs_verification' && version.state !== 'extracted') {
      throw new BadRequestException(`Version must be needs_verification before verifying; current state is '${version.state}'`);
    }
    const extraction = await this.prisma.extractionResult.findFirst({ where: { documentVersionId: versionId }, orderBy: { createdAt: 'desc' } });
    if (!extraction) throw new BadRequestException('Cannot verify a version with no extraction result');
    const fields = Array.isArray(extraction.fields) ? (extraction.fields as Array<{ name: string }>) : [];
    const record = await this.prisma.verificationRecord.create({
      data: {
        documentVersionId: versionId, verifierUserId: userId,
        fieldsVerified: (body.fieldsVerified ?? fields.map((f) => f.name)) as never,
        notes: body.notes ?? null, method: 'manual_review',
        evidenceInspected: body.evidenceInspected ?? false, verifiedBy: 'applicant',
      },
    });
    await this.prisma.documentVersion.update({ where: { id: versionId }, data: { state: 'verified' } });
    return { id: record.id, documentVersionId: record.documentVersionId, verifierUserId: record.verifierUserId, verifiedAt: record.verifiedAt, fieldsVerified: record.fieldsVerified, notes: record.notes, method: record.method, evidenceInspected: record.evidenceInspected, verifiedBy: record.verifiedBy };
  }

  async verifications(projectId: string, documentId: string, versionId: string): Promise<Record<string, unknown>[]> {
    await this.assertVersion(projectId, documentId, versionId);
    const rows = await this.prisma.verificationRecord.findMany({ where: { documentVersionId: versionId }, orderBy: { verifiedAt: 'asc' } });
    return rows.map((r) => ({ id: r.id, verifierUserId: r.verifierUserId, verifiedAt: r.verifiedAt, fieldsVerified: r.fieldsVerified, notes: r.notes, method: r.method, evidenceInspected: r.evidenceInspected, verifiedBy: r.verifiedBy }));
  }

  private async assertVersion(projectId: string, documentId: string, versionId: string): Promise<{ id: string; state: string }> {
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId, document: { projectId } },
      select: { id: true, state: true },
    });
    if (!version) throw new NotFoundException(`Version '${versionId}' not found for document '${documentId}'`);
    return { id: version.id, state: version.state as string };
  }
}

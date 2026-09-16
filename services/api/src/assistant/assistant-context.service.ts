import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimeCostService } from '../time-cost/time-cost.service';

/**
 * Project Knowledge Snapshot for the ApprovalIQ Assistant.
 *
 * Builds a compact, fully data-derived JSON brief of a project: business
 * profile, applicable approvals with evaluation outcomes, the time/cost
 * prediction (reused from Feature 1 — no duplicated calculation), documents,
 * and clarifications. The assistant's answers are grounded ONLY in this
 * snapshot + the static product-knowledge system prompt; nothing is invented.
 */
@Injectable()
export class AssistantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeCost: TimeCostService,
  ) {}

  async buildSnapshot(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, industry: true, businessId: true, createdAt: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const [latestProfile, prediction, documents, clarifications] = await Promise.all([
      this.prisma.businessProfileVersion.findFirst({
        where: { projectId },
        orderBy: { versionNumber: 'desc' },
        select: { versionNumber: true, status: true, values: true },
      }),
      // Reuse Feature 1's real computation — single source of truth for
      // timeline, critical path, parallel groups, cost and confidence.
      this.timeCost.predict(projectId).catch(() => null),
      this.prisma.document.findMany({
        where: { projectId },
        select: {
          id: true,
          createdAt: true,
          documentDefinition: { select: { name: true } },
          currentVersion: { select: { versionNumber: true, mimeType: true, sizeBytes: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.clarificationRequest.findMany({
        where: { projectId },
        select: { id: true, status: true, message: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const flattenedProfile = flattenKnownValues(latestProfile?.values);

    return {
      project,
      businessProfile: {
        versionNumber: latestProfile?.versionNumber ?? null,
        status: latestProfile?.status ?? null,
        values: flattenedProfile,
      },
      timeCostPrediction: prediction,
      documents: {
        total: documents.length,
        items: documents.map((d) => ({
          name: d.documentDefinition?.name ?? 'Unclassified document',
          versionNumber: d.currentVersion?.versionNumber ?? null,
          mimeType: d.currentVersion?.mimeType ?? null,
          uploadedAt: d.createdAt,
        })),
      },
      clarifications: {
        total: clarifications.length,
        items: clarifications.map((c) => ({ status: c.status, message: c.message, createdAt: c.createdAt })),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * BusinessProfile values are stored as { status: 'known'|'unknown', value? }
 * wrappers — flatten to { field: value } so the LLM sees plain data.
 */
function flattenKnownValues(values: unknown): Record<string, unknown> {
  if (typeof values !== 'object' || values === null) return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values as Record<string, unknown>)) {
    if (typeof raw === 'object' && raw !== null && 'status' in raw) {
      const wrapper = raw as { status: string; value?: unknown };
      out[key] = wrapper.status === 'known' ? wrapper.value : 'unknown';
    } else {
      out[key] = raw;
    }
  }
  return out;
}

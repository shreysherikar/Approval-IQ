import type { Grievance, GrievanceAction, GrievanceDocument } from '@prisma/client';
import type { GrievanceTier, GrievanceStatus, GrievanceType } from './grievance.dto';

export const GRIEVANCE_INCLUDE = {
  project: { select: { id: true, name: true, industry: true, businessId: true } },
  authority: { select: { id: true, code: true, name: true, department: true } },
  approvalInstance: {
    select: {
      id: true,
      approvalDefinition: { select: { id: true, code: true, name: true, slaDays: true } },
    },
  },
  submittedBy: { select: { id: true, email: true, role: true } },
  resolvedBy: { select: { id: true, email: true, role: true } },
  documents: {
    include: {
      document: {
        select: {
          id: true,
          currentVersion: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
          },
        },
      },
    },
  },
  actions: {
    include: {
      actor: { select: { id: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} as const;

export type GrievanceRow = Grievance & {
  project?: { id: string; name: string; industry?: string | null; businessId?: string | null } | null;
  authority?: { id: string; code: string; name: string; department: string | null } | null;
  approvalInstance?: {
    id: string;
    approvalDefinition: { id: string; code: string; name: string; slaDays: number | null };
  } | null;
  submittedBy: { id: string; email: string; role: string };
  resolvedBy?: { id: string; email: string; role: string } | null;
  documents: Array<
    GrievanceDocument & {
      document: {
        id: string;
        currentVersion: {
          id: string;
          originalFilename: string;
          mimeType: string;
          sizeBytes: number;
        } | null;
      };
    }
  >;
  actions: Array<
    GrievanceAction & {
      actor: { id: string; email: string; role: string } | null;
    }
  >;
};

export interface SerializedGrievance extends Record<string, unknown> {
  id: string;
  grievanceNumber: string;
  projectId: string;
  type: GrievanceType;
  tier: GrievanceTier;
  status: GrievanceStatus;
  subject: string;
  description: string;
  statutorySlaDays: number;
  targetResolutionDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  slaBreachDetectedAt: string | null;
  autoEscalatedAt: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  rectificationAction: string | null;
  authority: { id: string; code: string; name: string; department: string | null } | null;
  approval: { id: string; code: string; name: string; slaDays: number | null } | null;
  submittedBy: { id: string; email: string; role: string };
  resolvedBy: { id: string; email: string; role: string } | null;
  documents: Array<{
    id: string;
    documentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  actions: Array<{
    id: string;
    actionType: string;
    fromStatus: string | null;
    toStatus: string;
    fromTier: string | null;
    toTier: string | null;
    remarks: string;
    orderNumber: string | null;
    metadata: unknown;
    actor: { id: string; email: string; role: string } | null;
    actorRole: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export function serializeGrievance(row: GrievanceRow): SerializedGrievance {
  const now = new Date();
  const target = new Date(row.targetResolutionDate);
  const diffMs = target.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue =
    (row.status === 'submitted' || row.status === 'under_investigation' || row.status === 'escalated') &&
    daysRemaining < 0;

  return {
    id: row.id,
    grievanceNumber: row.grievanceNumber,
    projectId: row.projectId,
    project: row.project ?? null,
    type: row.type as GrievanceType,
    tier: row.tier as GrievanceTier,
    status: row.status as GrievanceStatus,
    subject: row.subject,
    description: row.description,
    statutorySlaDays: row.statutorySlaDays,
    targetResolutionDate: row.targetResolutionDate.toISOString(),
    daysRemaining,
    isOverdue,
    slaBreachDetectedAt: row.slaBreachDetectedAt ? row.slaBreachDetectedAt.toISOString() : null,
    autoEscalatedAt: row.autoEscalatedAt ? row.autoEscalatedAt.toISOString() : null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolutionSummary: row.resolutionSummary,
    rectificationAction: row.rectificationAction,
    authority: row.authority ?? null,
    approval: row.approvalInstance
      ? {
          id: row.approvalInstance.id,
          code: row.approvalInstance.approvalDefinition.code,
          name: row.approvalInstance.approvalDefinition.name,
          slaDays: row.approvalInstance.approvalDefinition.slaDays,
        }
      : null,
    submittedBy: row.submittedBy,
    resolvedBy: row.resolvedBy ?? null,
    documents: row.documents.map((d) => ({
      id: d.id,
      documentId: d.documentId,
      filename: d.document.currentVersion?.originalFilename ?? 'unknown',
      mimeType: d.document.currentVersion?.mimeType ?? 'application/octet-stream',
      sizeBytes: d.document.currentVersion?.sizeBytes ?? 0,
    })),
    actions: row.actions.map((a) => ({
      id: a.id,
      actionType: a.actionType,
      fromStatus: a.fromStatus,
      toStatus: a.toStatus,
      fromTier: a.fromTier,
      toTier: a.toTier,
      remarks: a.remarks,
      orderNumber: a.orderNumber,
      metadata: a.metadata,
      actor: a.actor,
      actorRole: a.actorRole,
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function getNextGrievanceTier(current: GrievanceTier): GrievanceTier | null {
  if (current === 'tier_1_nodal_officer') return 'tier_2_appellate_authority';
  if (current === 'tier_2_appellate_authority') return 'tier_3_rts_commission';
  return null;
}

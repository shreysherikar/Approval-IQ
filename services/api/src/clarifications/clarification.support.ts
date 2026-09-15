import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvalidClarificationTransitionError,
  awaitingParty,
  isOpen,
  isTerminal,
  legalActions,
  nextStatus,
  type ClarificationAction,
  type ClarificationStatus,
} from './clarification-state';
import type { ClarificationRequestedField } from './clarification.dto';

/**
 * Shared plumbing for the Phase 9 clarification workflow, used by BOTH sides:
 * the applicant controller (ClarificationsService) and the officer controller
 * (OfficerService). Kept in one place so the two sides can never disagree about
 * what a clarification looks like or what a caller is allowed to do next.
 *
 * Row types are structural (the repo's convention — see RoadmapService's
 * InstanceRow / ProfilesService's VersionRow) rather than Prisma generics, so
 * the read shape is explicit and the serializers are easy to reason about.
 */

export interface ClarificationPerson {
  id: string;
  email: string;
  role: string;
}

export interface ClarificationDocumentVersionView {
  id: string;
  versionNumber: number;
  state: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileHash: string;
}

export interface ClarificationResponseRow {
  id: string;
  authorUserId: string;
  authorRole: string;
  message: string;
  createdAt: Date;
  author: ClarificationPerson | null;
  documents: Array<{
    id: string;
    documentId: string;
    document: {
      id: string;
      documentDefinitionId: string | null;
      currentVersion: ClarificationDocumentVersionView | null;
    } | null;
  }>;
}

export interface ClarificationRow {
  id: string;
  projectId: string;
  approvalInstanceId: string;
  authorityId: string;
  subject: string;
  message: string;
  requestedFields: unknown;
  status: string;
  dueAt: Date | null;
  respondedAt: Date | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  requestedByUserId: string;
  resolvedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  authority: { id: string; code: string; name: string; department: string | null } | null;
  requestedBy: ClarificationPerson | null;
  resolvedBy: ClarificationPerson | null;
  approvalInstance: {
    id: string;
    projectId: string;
    status: string;
    approvalDefinition: { id: string; code: string; name: string; authorityId: string } | null;
  } | null;
  responses: ClarificationResponseRow[];
}

/**
 * The single include shape for every clarification read on both sides. The
 * APPROVAL DEFINITION is pulled through the instance so the applicant sees
 * exactly which approval an officer is asking about, and the attached document
 * VERSIONS so evidence can be shown as provided-but-unverified rather than as a
 * bare id.
 */
export const CLARIFICATION_INCLUDE = {
  authority: { select: { id: true, code: true, name: true, department: true } },
  requestedBy: { select: { id: true, email: true, role: true } },
  resolvedBy: { select: { id: true, email: true, role: true } },
  approvalInstance: {
    select: {
      id: true,
      projectId: true,
      status: true,
      approvalDefinition: { select: { id: true, code: true, name: true, authorityId: true } },
    },
  },
  responses: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      author: { select: { id: true, email: true, role: true } },
      documents: {
        include: {
          document: {
            select: {
              id: true,
              documentDefinitionId: true,
              currentVersion: {
                select: {
                  id: true,
                  versionNumber: true,
                  state: true,
                  originalFilename: true,
                  mimeType: true,
                  sizeBytes: true,
                  fileHash: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

/** Coerces the stored `requestedFields` JSONB into the typed array shape. */
export function parseRequestedFields(raw: unknown): ClarificationRequestedField[] {
  if (!Array.isArray(raw)) return [];
  const out: ClarificationRequestedField[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const field = (item as { field?: unknown }).field;
    if (typeof field !== 'string' || field.length === 0) continue;
    const entry: ClarificationRequestedField = { field };
    const reason = (item as { reason?: unknown }).reason;
    if (typeof reason === 'string') entry.reason = reason;
    const label = (item as { label?: unknown }).label;
    if (typeof label === 'string') entry.label = label;
    out.push(entry);
  }
  return out;
}

/**
 * Serializes a clarification for BOTH audiences. Status is always accompanied by
 * `awaitingParty` / `isOpen` / `isTerminal` derived from the state machine, so a
 * client never has to re-implement the lifecycle rules to decide which actions
 * to offer.
 */
export function serializeClarification(row: ClarificationRow): Record<string, unknown> {
  const status = row.status as ClarificationStatus;
  return {
    id: row.id,
    projectId: row.projectId,
    approvalInstanceId: row.approvalInstanceId,
    approvalInstanceStatus: row.approvalInstance?.status ?? null,
    approval: row.approvalInstance?.approvalDefinition
      ? {
          id: row.approvalInstance.approvalDefinition.id,
          code: row.approvalInstance.approvalDefinition.code,
          name: row.approvalInstance.approvalDefinition.name,
        }
      : null,
    authorityId: row.authorityId,
    authority: row.authority
      ? {
          id: row.authority.id,
          code: row.authority.code,
          name: row.authority.name,
          department: row.authority.department,
        }
      : null,
    subject: row.subject,
    message: row.message,
    requestedFields: parseRequestedFields(row.requestedFields),
    status,
    awaitingParty: awaitingParty(status),
    isOpen: isOpen(status),
    isTerminal: isTerminal(status),
    // Every action legal for the CURRENT status (the state machine's own view),
    // so a client renders exactly the buttons the API will accept.
    allowedActions: legalActions(status),
    dueAt: row.dueAt,
    respondedAt: row.respondedAt,
    resolvedAt: row.resolvedAt,
    resolutionNote: row.resolutionNote,
    requestedBy: row.requestedBy,
    resolvedBy: row.resolvedBy,
    responses: row.responses.map((r) => ({
      id: r.id,
      authorUserId: r.authorUserId,
      author: r.author,
      authorRole: r.authorRole,
      message: r.message,
      documents: r.documents.map((link) => ({
        id: link.id,
        documentId: link.documentId,
        documentDefinitionId: link.document?.documentDefinitionId ?? null,
        currentVersion: link.document?.currentVersion ?? null,
      })),
      createdAt: r.createdAt,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Applies a state-machine action, converting an illegal transition into a 409
 * with the pinned domain code `invalid_clarification_transition` (honored by
 * AllExceptionsFilter). Callers therefore get an explicit, machine-readable
 * rejection instead of a silent status overwrite.
 */
export function applyClarificationAction(
  status: string,
  action: ClarificationAction,
): ClarificationStatus {
  try {
    return nextStatus(status as ClarificationStatus, action);
  } catch (error) {
    if (error instanceof InvalidClarificationTransitionError) {
      throw new ConflictException({
        code: error.code,
        message: error.message,
        details: {
          from: error.from,
          action: error.action,
          allowedActions: error.allowedActions,
        },
      });
    }
    throw error;
  }
}

/**
 * Every attached document must already exist in THIS project's vault. Evidence
 * can never be an arbitrary document id (and never another project's), so an
 * unknown or foreign id is a 400 listing exactly which ids were rejected.
 */
export async function assertDocumentsInProject(
  prisma: PrismaService,
  projectId: string,
  documentIds: readonly string[],
): Promise<void> {
  if (documentIds.length === 0) return;
  const unique = [...new Set(documentIds)];
  const found = await prisma.document.findMany({
    where: { id: { in: unique }, projectId },
    select: { id: true },
  });
  const foundIds = new Set(found.map((d) => d.id));
  const unknown = unique.filter((id) => !foundIds.has(id));
  if (unknown.length > 0) {
    throw new BadRequestException({
      code: 'invalid_clarification_documents',
      message:
        'Every attached document must already exist in this project (upload it to the project vault first)',
      details: { unknownDocumentIds: unknown },
    });
  }
}
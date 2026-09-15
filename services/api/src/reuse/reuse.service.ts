import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// The document-engine package is source-only (.ts-extension imports), so the
// API consumes it via dynamic import — same pattern as consistency.service.ts.
interface ReuseConditionOutcome {
  condition: string;
  passed: boolean;
  detail: string;
}

interface ValidityCheck {
  valid: boolean | null;
  mismatchReason?: string;
  unknownCaveat?: string;
}

interface ReuseEligibility {
  eligible: boolean;
  status: string;
  reason: string;
  passedConditions?: string[];
}

interface EngineModule {
  evaluateReuseCondition(
    condition: string,
    context: { expiryDate: string | null; today: Date; jurisdictionMatches: boolean | null },
  ): ReuseConditionOutcome;
  evaluateReuseEligibility(input: {
    requiredDocumentType: string | null;
    candidateDocumentType: string | null;
    candidateVerified: boolean;
    sameProject: boolean;
    validForPurpose: ValidityCheck;
    validForJurisdiction: ValidityCheck;
    reusability: 'reusable' | 'conditional' | 'fresh_required' | 'unknown';
    conditions: ReuseConditionOutcome[];
  }): ReuseEligibility;
}

let engineCache: EngineModule | null = null;
async function engine(): Promise<EngineModule> {
  if (!engineCache) {
    engineCache = (await import('@approvaliq/document-engine' as string)) as unknown as EngineModule;
  }
  return engineCache;
}

interface ExtractedFieldLike {
  name: string;
  value: string;
  confidence: number;
}

/** Extracts a field from an ExtractionResult.fields JSON array; 'unknown'/zero-confidence → null. */
function extractedValue(fields: unknown, name: string): string | null {
  if (!Array.isArray(fields)) return null;
  const field = (fields as ExtractedFieldLike[]).find((f) => f && f.name === name);
  if (!field || typeof field.value !== 'string') return null;
  if (field.value.trim() === '' || field.value.trim().toLowerCase() === 'unknown') return null;
  if (typeof field.confidence === 'number' && field.confidence <= 0) return null;
  return field.value;
}

/**
 * Parses a DocumentDefinition's reuseConditions text into individual condition
 * strings. Accepts a JSON array (of strings or {condition} objects) or plain
 * text split on semicolons/newlines — the importer stores free text.
 */
export function parseReuseConditions(text: string): string[] {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'object' && item !== null && 'condition' in item ? String((item as { condition: unknown }).condition) : String(item)))
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (typeof parsed === 'string') return [parsed];
  } catch {
    // plain text — fall through
  }
  return trimmed.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
}

@Injectable()
export class ReuseService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * GET /projects/:projectId/documents/reuse-candidates?approvalInstanceId=X
   *
   * For every document the approval requires (ApprovalDocumentRequirement →
   * DocumentDefinition), returns this project's candidate documents — same
   * project only (Decision #7, the same-applicant/premises proxy) — each run
   * through the blueprint's reuse decision sequence and marked eligible or
   * ineligible WITH its specific reason. Ineligible candidates are included,
   * never hidden.
   */
  async listReuseCandidates(projectId: string, approvalInstanceId: string): Promise<Record<string, unknown>> {
    const engineModule = await engine();

    const instance = await this.prisma.approvalInstance.findFirst({
      where: { id: approvalInstanceId, projectId },
      include: {
        approvalDefinition: {
          include: {
            authority: { select: { jurisdiction: true } },
            requirements: { include: { documentDefinition: true } },
          },
        },
      },
    });
    if (!instance) {
      throw new NotFoundException(`ApprovalInstance '${approvalInstanceId}' not found in project '${projectId}'`);
    }

    const today = new Date();
    const authorityJurisdiction = instance.approvalDefinition.authority?.jurisdiction ?? null;

    const requiredDocuments: Record<string, unknown>[] = [];
    for (const requirement of instance.approvalDefinition.requirements) {
      const def = requirement.documentDefinition;
      // Same-project candidates only (Decision #7): the query is scoped to
      // projectId, and the pure function still receives the explicit boolean
      // so the sequence itself stays complete.
      const candidates = await this.prisma.document.findMany({
        where: { projectId, documentDefinitionId: def.id },
        include: {
          documentDefinition: { select: { documentType: true, code: true } },
          currentVersion: { include: { extractions: { orderBy: { createdAt: 'desc' }, take: 1 } } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const conditionTexts = parseReuseConditions(def.reuseConditions);
      const requiredType = def.documentType;

      const candidateEvaluations = candidates.map((doc) =>
        this.evaluateCandidate(engineModule, {
          doc,
          projectId,
          requiredType,
          reusability: def.reusability as 'reusable' | 'conditional' | 'fresh_required' | 'unknown',
          conditionTexts,
          authorityJurisdiction,
          today,
        }),
      );

      requiredDocuments.push({
        documentDefinitionId: def.id,
        code: def.code,
        name: def.name,
        documentType: def.documentType,
        reusability: def.reusability,
        reuseConditions: conditionTexts,
        candidates: candidateEvaluations,
      });
    }

    return {
      approvalInstanceId: instance.id,
      approvalDefinition: {
        id: instance.approvalDefinition.id,
        code: instance.approvalDefinition.code,
        name: instance.approvalDefinition.name,
      },
      // Decision #7: same-project reuse only this sprint.
      reuseScope: 'same_project',
      requiredDocuments,
    };
  }

  // Implementation continues below.

  /** Runs the pure blueprint sequence for ONE candidate document. */
  private evaluateCandidate(
    engineModule: EngineModule,
    args: {
      doc: {
        id: string;
        projectId: string;
        documentDefinition: { documentType: string; code: string } | null;
        currentVersion: {
          id: string;
          versionNumber: number;
          state: string;
          fileHash: string;
          extractions: Array<{ fields: unknown }>;
        } | null;
      };
      projectId: string;
      requiredType: string;
      reusability: 'reusable' | 'conditional' | 'fresh_required' | 'unknown';
      conditionTexts: string[];
      authorityJurisdiction: string | null;
      today: Date;
    },
  ): Record<string, unknown> {
    const { doc, projectId, requiredType, reusability, conditionTexts, authorityJurisdiction, today } = args;
    const version = doc.currentVersion;
    const verified = version?.state === 'verified';
    const latestExtraction = version?.extractions?.[0] ?? null;
    const extractedFields = latestExtraction?.fields ?? null;

    const extractedDocType = extractedValue(extractedFields, 'documentType');
    const candidateType = doc.documentDefinition?.documentType ?? null;

    // Purpose: a KNOWN extracted document type that differs from what the
    // approval requires is a genuine mismatch. Unknown/absent extraction is
    // never a mismatch — it is an explicit caveat instead.
    let validForPurpose: ValidityCheck;
    if (extractedDocType !== null) {
      validForPurpose = extractedDocType === requiredType
        ? { valid: true }
        : { valid: false, mismatchReason: `the document states type '${extractedDocType}' but '${requiredType}' is required` };
    } else if (latestExtraction) {
      validForPurpose = { valid: null, unknownCaveat: 'document purpose could not be confirmed from extraction (document type unknown)' };
    } else {
      validForPurpose = { valid: null, unknownCaveat: 'document has no extraction result; purpose could not be machine-verified' };
    }

    // Jurisdiction: compare the extracted jurisdiction against the approval's
    // authority jurisdiction. Unknown on either side is a caveat, never a
    // silent pass or a guessed mismatch.
    let validForJurisdiction: ValidityCheck;
    const extractedJurisdiction = extractedValue(extractedFields, 'jurisdiction');
    if (extractedJurisdiction !== null && authorityJurisdiction !== null) {
      const a = extractedJurisdiction.trim().toLowerCase();
      const b = authorityJurisdiction.trim().toLowerCase();
      validForJurisdiction = (a === b || a.includes(b) || b.includes(a))
        ? { valid: true }
        : { valid: false, mismatchReason: `the document states jurisdiction '${extractedJurisdiction}' but the approval's authority jurisdiction is '${authorityJurisdiction}'` };
    } else if (authorityJurisdiction === null) {
      validForJurisdiction = { valid: null, unknownCaveat: 'the approval definition has no jurisdiction recorded; jurisdiction could not be verified' };
    } else {
      validForJurisdiction = { valid: null, unknownCaveat: 'the document does not state its jurisdiction (not guessed); jurisdiction could not be verified' };
    }

    // Approval-specific reuse conditions from the DocumentDefinition's
    // reuseConditions, evaluated fail-safe.
    const expiryDate = extractedValue(extractedFields, 'expiryDate');
    const jurisdictionMatches = validForJurisdiction.valid;
    const conditions: ReuseConditionOutcome[] = conditionTexts.map((condition) =>
      engineModule.evaluateReuseCondition(condition, { expiryDate, today, jurisdictionMatches }),
    );

    const evaluation = engineModule.evaluateReuseEligibility({
      requiredDocumentType: requiredType,
      candidateDocumentType: candidateType,
      candidateVerified: verified,
      sameProject: doc.projectId === projectId,
      validForPurpose,
      validForJurisdiction,
      reusability,
      conditions,
    });

    return {
      documentId: doc.id,
      documentDefinitionCode: doc.documentDefinition?.code ?? null,
      currentVersion: version
        ? { id: version.id, versionNumber: version.versionNumber, state: version.state, fileHash: version.fileHash }
        : null,
      eligible: evaluation.eligible,
      status: evaluation.status,
      reason: evaluation.reason,
      passedConditions: evaluation.eligible ? (evaluation.passedConditions ?? []) : undefined,
    };
  }
}

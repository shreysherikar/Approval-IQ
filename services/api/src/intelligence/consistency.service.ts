import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Structural mirrors of the document-engine's public comparator types. The
// engine package is source-only (.ts-extension imports), so the API consumes
// it via dynamic import (same pattern as jobs/extraction.handler.ts) and
// keeps these local structural types instead of static type imports.
type ComparisonSide =
  | { status: 'known'; value: string | number }
  | { status: 'unknown' }
  | { status: 'missing' }
  | { status: 'not_verified' };

interface CheckDefinition {
  checkId: string;
  comparison: 'exact_string' | 'contains_string' | 'numeric_tolerance';
  fieldA: string;
  fieldB: string;
  fieldBUnits?: string;
  tolerancePct?: number;
  appliesToDocumentTypes?: string[];
  detail?: string;
}

type ConsistencyOutcome = 'match' | 'mismatch' | 'missing' | 'unknown' | 'not_applicable' | 'not_verified';

interface RunCheckResult {
  checkId: string;
  outcome: ConsistencyOutcome;
  fieldA: string;
  fieldB: string;
  detail: string | null;
}

interface EngineModule {
  PROFILE_VS_DOCUMENT_CHECKS: CheckDefinition[];
  DOCUMENT_VS_DOCUMENT_CHECKS: CheckDefinition[];
  parseAreaToSqft(value: string | number, units?: string | null): number | null;
  runCheck(check: CheckDefinition, args: {
    checkType: 'profile_vs_document' | 'document_vs_document';
    sideA: ComparisonSide;
    sideB: ComparisonSide;
    documentTypeB?: string | null;
    documentTypeA?: string | null;
  }): RunCheckResult;
}

let engineCache: EngineModule | null = null;
async function engine(): Promise<EngineModule> {
  if (!engineCache) {
    engineCache = (await import('@approvaliq/document-engine' as string)) as unknown as EngineModule;
  }
  return engineCache;
}

interface ResolvedField {
  side: ComparisonSide;
  /** Display value recorded on the persisted row (null when not known). */
  displayValue: string | null;
}

/**
 * Phase 7 consistency engine (blueprint Section 8). Runs the shared
 * document-engine comparator for profile-vs-document (priority) and
 * document-vs-document checks, and persists ConsistencyCheckResult rows.
 *
 * CONSTRAINT (explicit): this module NEVER writes to DocumentVersion, never
 * changes any document state, and never blocks confirmation of anything.
 * Its only writes are new ConsistencyCheckResult rows — a warning layer.
 */
@Injectable()
export class ConsistencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listChecks(projectId: string, documentId: string, versionId: string): Promise<Record<string, unknown>[]> {
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId, document: { projectId } },
      select: { id: true },
    });
    if (!version) throw new NotFoundException(`Version '${versionId}' not found for document '${documentId}'`);
    const rows = await this.prisma.consistencyCheckResult.findMany({
      where: { documentVersionId: versionId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      checkType: r.checkType,
      checkId: r.checkId,
      profileField: r.profileField,
      documentField: r.documentField,
      sideAValue: r.sideAValue,
      sideBValue: r.sideBValue,
      outcome: r.outcome as ConsistencyOutcome,
      tolerancePct: r.tolerancePct,
      detail: r.detail,
      profileVersionId: r.profileVersionId,
      otherDocumentVersionId: r.otherDocumentVersionId,
      createdAt: r.createdAt,
    }));
  }

  /** Resolves one profile field out of a BusinessProfileVersion's Known-wrapped values. */
  private resolveProfileSide(values: Record<string, unknown>, field: string): ResolvedField {
    const wrapped = values[field] as { status?: string; value?: unknown } | undefined;
    if (wrapped === undefined) return { side: { status: 'missing' }, displayValue: null };
    if (wrapped.status !== 'known' || wrapped.value === undefined) {
      return { side: { status: 'unknown' }, displayValue: 'unknown' };
    }
    return { side: { status: 'known', value: wrapped.value as string | number }, displayValue: String(wrapped.value) };
  }

  /**
   * Resolves the document side of every check for a version, applying the
   * latest user correction per field (corrections win for comparison — they
   * are what the user verified) and falling back to the raw extraction.
   * When the version has NO extraction at all, every field resolves to
   * not_verified — never a silent pass-through.
   */
  private async resolveDocumentSide(versionId: string, checks: CheckDefinition[]): Promise<{ fields: Record<string, ResolvedField>; documentType: string | null }> {
    const extraction = await this.prisma.extractionResult.findFirst({
      where: { documentVersionId: versionId },
      orderBy: { createdAt: 'desc' },
    });
    if (!extraction) {
      const fields: Record<string, ResolvedField> = {};
      for (const check of checks) {
        fields[check.fieldB] = { side: { status: 'not_verified' }, displayValue: null };
        if (check.fieldBUnits) fields[check.fieldBUnits] = { side: { status: 'not_verified' }, displayValue: null };
      }
      return { fields, documentType: null };
    }
    const corrections = await this.prisma.fieldCorrection.findMany({ where: { documentVersionId: versionId }, orderBy: { createdAt: 'asc' } });
    const corrected = new Map<string, string>();
    for (const c of corrections) corrected.set(c.fieldName, c.correctedValue);

    const raw = Array.isArray(extraction.fields) ? (extraction.fields as Array<{ name: string; value: string }>) : [];
    const byName = new Map<string, string>();
    for (const f of raw) byName.set(f.name, f.value);

    const fields: Record<string, ResolvedField> = {};
    const wanted = new Set<string>();
    for (const check of checks) {
      wanted.add(check.fieldB);
      if (check.fieldBUnits) wanted.add(check.fieldBUnits);
    }
    for (const name of wanted) {
      const correctedValue = corrected.get(name);
      if (correctedValue !== undefined) {
        fields[name] = { side: { status: 'known', value: correctedValue }, displayValue: correctedValue };
        continue;
      }
      const value = byName.get(name);
      if (value === undefined) {
        fields[name] = { side: { status: 'missing' }, displayValue: null };
      } else if (value === 'unknown') {
        // Explicit extraction unknown stays unknown — never guessed into a value.
        fields[name] = { side: { status: 'unknown' }, displayValue: 'unknown' };
      } else {
        fields[name] = { side: { status: 'known', value }, displayValue: value };
      }
    }
    const docType = corrected.get('documentType') ?? byName.get('documentType') ?? null;
    return { fields, documentType: docType && docType !== 'unknown' ? docType : null };
  }

  async runChecks(
    projectId: string,
    documentId: string,
    body: { checkType?: string; profileVersionId?: string; otherDocumentId?: string } = {},
  ): Promise<Record<string, unknown>> {
    const { PROFILE_VS_DOCUMENT_CHECKS, DOCUMENT_VS_DOCUMENT_CHECKS, parseAreaToSqft, runCheck } = await engine();
    const checkType =
      body.checkType === 'document_vs_document' ? 'document_vs_document' : 'profile_vs_document';
    if (body.checkType !== undefined && body.checkType !== checkType) {
      throw new BadRequestException(`checkType must be 'profile_vs_document' or 'document_vs_document'`);
    }

    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, projectId },
      include: { currentVersion: true },
    });
    if (!doc) throw new NotFoundException(`Document '${documentId}' not found in project '${projectId}'`);
    const version = doc.currentVersion;
    if (!version) throw new NotFoundException('Document has no current version to check');

    const checks: CheckDefinition[] =
      checkType === 'profile_vs_document' ? PROFILE_VS_DOCUMENT_CHECKS : DOCUMENT_VS_DOCUMENT_CHECKS;

    // Resolve side B (the subject document) once.
    const subject = await this.resolveDocumentSide(version.id, checks);
    const documentTypeB = subject.documentType;

    let sideAResolver: (check: CheckDefinition) => ResolvedField;
    let otherDocumentVersionId: string | null = null;
    let profileVersionId: string | null = null;

    if (checkType === 'profile_vs_document') {
      const profileVersion = body.profileVersionId
        ? await this.prisma.businessProfileVersion.findFirst({ where: { id: body.profileVersionId, projectId } })
        : await this.prisma.businessProfileVersion.findFirst({
            where: { projectId, status: 'confirmed' },
            orderBy: { versionNumber: 'desc' },
          });
      if (!profileVersion) {
        throw new NotFoundException('No confirmed profile version found for this project — confirm a profile before running profile-vs-document checks');
      }
      profileVersionId = profileVersion.id;
      const values = (profileVersion.values ?? {}) as Record<string, unknown>;
      sideAResolver = (check) => this.resolveProfileSide(values, check.fieldA);
    } else {
      if (!body.otherDocumentId) {
        throw new BadRequestException('otherDocumentId is required for document_vs_document checks');
      }
      const other = await this.prisma.document.findFirst({
        where: { id: body.otherDocumentId, projectId },
        include: { currentVersion: true },
      });
      if (!other?.currentVersion) {
        throw new NotFoundException(`Other document '${body.otherDocumentId}' not found (or has no current version)`);
      }
      if (other.currentVersion.id === version.id) {
        throw new BadRequestException('A document cannot be checked against itself');
      }
      otherDocumentVersionId = other.currentVersion.id;
      const otherSide = await this.resolveDocumentSide(other.currentVersion.id, checks);
      sideAResolver = (check) => otherSide.fields[check.fieldA] ?? { side: { status: 'missing' }, displayValue: null };
    }

    const results: Array<RunCheckResult & { sideAValue: string | null; sideBValue: string | null; tolerancePct: number | null; profileField: string | null }> = [];
    const rows: Prisma.ConsistencyCheckResultUncheckedCreateInput[] = [];

    for (const check of checks) {
      const sideA = sideAResolver(check);
      let sideBResolved: ResolvedField = subject.fields[check.fieldB] ?? { side: { status: 'missing' }, displayValue: null };

      // Area: units-normalize BOTH sides to sqft before the numeric compare.
      if (check.fieldBUnits) {
        const unitsField = subject.fields[check.fieldBUnits];
        const units = unitsField?.side.status === 'known' ? String(unitsField.side.value) : null;
        const rawB = sideBResolved.side.status === 'known' ? sideBResolved.side.value : null;
        const sqftB = rawB === null ? null : parseAreaToSqft(rawB, units);
        if (sideBResolved.side.status === 'known' && sqftB === null) {
          // Unparseable value or unrecognized units → explicit unknown, never a mismatch.
          sideBResolved = { side: { status: 'unknown' }, displayValue: String(rawB) };
        } else if (sqftB !== null) {
          sideBResolved = { side: { status: 'known', value: sqftB }, displayValue: `${sqftB} sqft` };
        }
      }

      const result = runCheck(check, {
        checkType,
        sideA: sideA.side,
        sideB: sideBResolved.side,
        documentTypeB,
      });

      const sideAValue = sideA.displayValue;
      const sideBValue = sideBResolved.displayValue;
      results.push({
        checkId: result.checkId,
        outcome: result.outcome,
        fieldA: result.fieldA,
        fieldB: result.fieldB,
        detail: result.detail,
        sideAValue,
        sideBValue,
        tolerancePct: check.tolerancePct ?? null,
        profileField: checkType === 'profile_vs_document' ? check.fieldA : null,
      });
      rows.push({
        projectId,
        documentId,
        documentVersionId: version.id,
        profileVersionId: profileVersionId ?? null,
        otherDocumentVersionId: otherDocumentVersionId ?? null,
        checkType,
        checkId: result.checkId,
        profileField: checkType === 'profile_vs_document' ? check.fieldA : null,
        documentField: result.fieldB,
        sideAValue: sideAValue ?? null,
        sideBValue: sideBValue ?? null,
        outcome: result.outcome,
        tolerancePct: check.tolerancePct ?? null,
        detail: result.detail ?? null,
      });
    }

    await this.prisma.consistencyCheckResult.createMany({ data: rows });

    const counts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.outcome] = (acc[r.outcome] ?? 0) + 1;
      return acc;
    }, {});
    return {
      documentId,
      documentVersionId: version.id,
      checkType,
      profileVersionId,
      otherDocumentVersionId,
      results,
      summary: counts,
      // Warning-layer contract: a mismatch is recorded and surfaced, never a gate.
      note: 'Consistency results are warnings only — they do not change document state or block confirmation.',
    };
  }
}
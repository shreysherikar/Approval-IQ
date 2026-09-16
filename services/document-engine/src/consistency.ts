/**
 * Phase 7 consistency comparator — shared by profile-vs-document and
 * document-vs-document checks (blueprint Section 8.6).
 *
 * EXACTLY six outcome categories, never collapsed. In particular `unknown`
 * ("we could not read/compare this — reviewer must look") and `mismatch`
 * ("we compared and the values disagree — reviewer must look") are DIFFERENT
 * things to a reviewer, so they never share a code path: each has its own
 * dedicated branch below with no fall-through.
 */
export const CONSISTENCY_OUTCOMES = [
  'match',
  'mismatch',
  'missing',
  'unknown',
  'not_applicable',
  'not_verified',
] as const;

export type ConsistencyOutcome = (typeof CONSISTENCY_OUTCOMES)[number];

/** Which side of the comparison a value came from, and how trustworthy it is. */
export type ComparisonSide =
  | { status: 'known'; value: string | number }
  | { status: 'unknown' } // field exists but value could not be read (extraction says "unknown", confidence 0)
  | { status: 'missing' } // field not present at all on that side
  | { status: 'not_verified' }; // side has no trusted extraction/verification provenance yet

/** Semantic comparison kinds. Both check scopes reuse the same comparator. */
export type ComparisonCheckType =
  | 'exact_string'
  | 'contains_string'
  | 'numeric_tolerance';

/** The two check scopes (blueprint Section 8). */
export type ConsistencyCheckType = 'profile_vs_document' | 'document_vs_document';

/** Relative tolerance for numeric comparisons (e.g. area within 1%). */
export const DEFAULT_AREA_TOLERANCE_PCT = 0.01;

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function toFiniteNumber(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'unknown') return null;
  const parsed = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Converts a raw extracted area + units string into square feet. Returns null
 * when the value is not parseable or the units are unrecognized — the caller
 * must treat that as an explicit `unknown` side, never as a mismatch.
 * When units are absent, `sqft` is assumed (recorded by the caller in detail).
 */
export function parseAreaToSqft(value: string | number, units?: string | null): number | null {
  const n = toFiniteNumber(value);
  if (n === null) return null;
  const normalizedUnits = (units ?? 'sqft').trim().toLowerCase();
  switch (normalizedUnits) {
    case '':
    case 'sqft':
    case 'sq_ft':
    case 'sq ft':
    case 'square_feet':
    case 'square feet':
    case 'sq.feet':
    case 'चौ. फूट':
    case 'चौ.फू':
    case 'चौरस फूट':
    case 'चौ फूट':
      return n;
    case 'sqm':
    case 'sq_m':
    case 'sq m':
    case 'square_meters':
    case 'square meters':
    case 'चौ. मी.':
    case 'चौ.मी.':
    case 'चौरस मीटर':
    case 'चौ मीटर':
      return n * 10.7639;
    case 'guntha':
    case 'gunthas':
    case 'गुंठा':
    case 'गुंठे':
      return n * 1089;
    case 'sqyd':
    case 'sq_yd':
    case 'sq yd':
    case 'square_yards':
    case 'square yards':
    case 'वार':
      return n * 9;
    case 'acre':
    case 'acres':
    case 'एकर':
      return n * 43_560;
    case 'hectare':
    case 'hectares':
    case 'हेक्टर':
      return n * 107_639;
    default:
      return null;
  }
}

/**
 * The six-outcome comparator. `valueA` and `valueB` are the two resolved
 * sides; `checkType` is the semantic comparison to run once both sides are
 * known. The outcome precedence is fixed and each category is its own branch:
 *
 *   1. not_verified  — a side lacks verified provenance (no extraction yet).
 *   2. missing       — a field is absent from a side entirely.
 *   3. unknown       — a side explicitly says it could not read the value.
 *   4. match / mismatch — both sides known and comparable.
 *   (`not_applicable` is decided in runCheck — it is a property of the check
 *    vs the document type, not of the two values.)
 */
export function compare(
  valueA: ComparisonSide,
  valueB: ComparisonSide,
  checkType: ComparisonCheckType,
  options?: { tolerancePct?: number | undefined },
): ConsistencyOutcome {
  // Branch 1 — not_verified: never a pass-through. A side without verified
  // provenance cannot confirm or contradict anything.
  if (valueA.status === 'not_verified' || valueB.status === 'not_verified') {
    return 'not_verified';
  }
  // Branch 2 — missing: the field does not exist on one side at all.
  if (valueA.status === 'missing' || valueB.status === 'missing') {
    return 'missing';
  }
  // Branch 3 — unknown: an explicit unknown stays unknown. This is a SEPARATE
  // branch from mismatch on purpose: an unknown is not a disagreement, it is
  // an unreadable/unobtained value that a reviewer must inspect.
  if (valueA.status === 'unknown' || valueB.status === 'unknown') {
    return 'unknown';
  }

  // Both sides known — compare according to the check's semantics.
  const a = valueA as { status: 'known'; value: string | number };
  const b = valueB as { status: 'known'; value: string | number };
  switch (checkType) {
    case 'exact_string':
      return normalizeText(String(a.value)) === normalizeText(String(b.value)) ? 'match' : 'mismatch';
    case 'contains_string':
      return normalizeText(String(a.value)).length > 0 &&
        normalizeText(String(b.value)).includes(normalizeText(String(a.value)))
        ? 'match'
        : 'mismatch';
    case 'numeric_tolerance': {
      const na = toFiniteNumber(a.value);
      const nb = toFiniteNumber(b.value);
      // Unparseable known-side values are treated as unknown (branch 3
      // semantics), not as a mismatch — we never declare a disagreement we
      // could not actually compute.
      if (na === null || nb === null) return 'unknown';
      const tolerancePct = options?.tolerancePct ?? 0;
      return Math.abs(na - nb) <= Math.abs(na) * tolerancePct ? 'match' : 'mismatch';
    }
  }
}

// ---------------------------------------------------------------------------
// Reusable check definitions. Profile-vs-document pairs are the priority path;
// document-vs-document pairs reuse the SAME comparator with different sides.
// ---------------------------------------------------------------------------

export interface CheckDefinition {
  checkId: string;
  /** Comparison semantics applied by compare(). */
  comparison: ComparisonCheckType;
  /** Field read from the profile (profile_vs_document) or document A. */
  fieldA: string;
  /** Field read from the document (or document B). */
  fieldB: string;
  /** Optional secondary document field (e.g. areaUnits alongside area). */
  fieldBUnits?: string;
  tolerancePct?: number;
  /**
   * When set, the check is `not_applicable` for documents whose (known)
   * documentType is outside this list. An unknown documentType does NOT
   * trigger not_applicable — it keeps the normal outcome precedence.
   */
  appliesToDocumentTypes?: string[];
  detail?: string;
}

/** Profile-vs-document checks (demo priority path). */
export const PROFILE_VS_DOCUMENT_CHECKS: CheckDefinition[] = [
  {
    checkId: 'area',
    comparison: 'numeric_tolerance',
    fieldA: 'areaSqft',
    fieldB: 'area',
    fieldBUnits: 'areaUnits',
    tolerancePct: DEFAULT_AREA_TOLERANCE_PCT,
    appliesToDocumentTypes: ['trade_licence', 'lease_deed', 'building_plan', 'property_tax_receipt'],
    detail: 'profile.areaSqft vs extracted area (units-normalized, within tolerance)',
  },
  {
    checkId: 'jurisdiction',
    comparison: 'exact_string',
    fieldA: 'state',
    fieldB: 'jurisdiction',
  },
  {
    checkId: 'premises',
    comparison: 'contains_string',
    fieldA: 'district',
    fieldB: 'address',
    detail: 'profile.district should appear in the extracted premises address',
  },
  {
    checkId: 'activity',
    comparison: 'exact_string',
    fieldA: 'activityType',
    fieldB: 'activityIndustry',
  },
];

/** Document-vs-document checks — same comparator, different field pairs. */
export const DOCUMENT_VS_DOCUMENT_CHECKS: CheckDefinition[] = [
  {
    checkId: 'document_number',
    comparison: 'exact_string',
    fieldA: 'documentNumber',
    fieldB: 'documentNumber',
  },
  {
    checkId: 'validity_expiry',
    comparison: 'exact_string',
    fieldA: 'expiryDate',
    fieldB: 'expiryDate',
    detail: 'two documents for the same premises must agree on expiry',
  },
  {
    checkId: 'premises_address',
    comparison: 'contains_string',
    fieldA: 'address',
    fieldB: 'address',
  },
  {
    checkId: 'activity',
    comparison: 'exact_string',
    fieldA: 'activityIndustry',
    fieldB: 'activityIndustry',
  },
];

export interface RunCheckArgs {
  checkType: ConsistencyCheckType;
  sideA: ComparisonSide;
  sideB: ComparisonSide;
  /** Known documentType of side B (profile_vs_document) or both sides (doc-vs-doc). */
  documentTypeB?: string | null;
  documentTypeA?: string | null;
  options?: { tolerancePct?: number };
}

export interface RunCheckResult {
  checkId: string;
  outcome: ConsistencyOutcome;
  fieldA: string;
  fieldB: string;
  detail: string | null;
}

/**
 * Runs ONE check definition through the comparator, adding the
 * not_applicable gate on top. All other outcome precedence lives in
 * compare() alone.
 */
export function runCheck(check: CheckDefinition, args: RunCheckArgs): RunCheckResult {
  // not_applicable branch — only when the relevant documentType is KNOWN and
  // outside the check's scope. An unknown type never produces not_applicable.
  if (check.appliesToDocumentTypes) {
    const typeB = args.documentTypeB;
    // The literal 'unknown' sentinel (Phase 6 extraction) is NOT a known type —
    // it must never trigger not_applicable.
    if (typeB && typeB !== 'unknown' && !check.appliesToDocumentTypes.includes(typeB)) {
      return {
        checkId: check.checkId,
        outcome: 'not_applicable',
        fieldA: check.fieldA,
        fieldB: check.fieldB,
        detail: `documentType '${typeB}' is outside this check's scope`,
      };
    }
    if (args.checkType === 'document_vs_document') {
      const typeA = args.documentTypeA;
      if (typeA && typeA !== 'unknown' && !check.appliesToDocumentTypes.includes(typeA)) {
        return {
          checkId: check.checkId,
          outcome: 'not_applicable',
          fieldA: check.fieldA,
          fieldB: check.fieldB,
          detail: `documentType '${typeA}' is outside this check's scope`,
        };
      }
    }
  }

  const outcome = compare(args.sideA, args.sideB, check.comparison, {
    tolerancePct: check.tolerancePct,
    ...args.options,
  });
  return {
    checkId: check.checkId,
    outcome,
    fieldA: check.fieldA,
    fieldB: check.fieldB,
    detail: check.detail ?? null,
  };
}
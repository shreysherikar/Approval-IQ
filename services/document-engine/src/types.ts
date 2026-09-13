/**
 * Extraction field schema (blueprint Phase 6). A field the provider cannot
 * find MUST be explicit "unknown" with zero/low confidence — never inferred.
 */
export const EXTRACTION_FIELD_NAMES = [
  'documentType',
  'entityName',
  'issuingAuthority',
  'documentNumber',
  'issueDate',
  'expiryDate',
  'address',
  'propertyIdentifier',
  'area',
  'areaUnits',
  'ownerHolder',
  'purpose',
  'jurisdiction',
  'activityIndustry',
  'conditions',
] as const;

export type ExtractionFieldName = (typeof EXTRACTION_FIELD_NAMES)[number];

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  evidenceLocation: string | null;
}

export interface ExtractionOutput {
  fields: ExtractedField[];
  modelProvider: string;
  modelVersion: string;
  promptVersion: string;
  extractedAt: string;
}

export interface ExtractionProvider {
  readonly providerName: string;
  extract(fileBuffer: Buffer, mimeType: string): Promise<ExtractionOutput>;
}

/** A field that could not be found: explicit unknown, zero confidence. */
export function unknownField(name: string): ExtractedField {
  return { name, value: 'unknown', confidence: 0, evidenceLocation: null };
}

/** Distinguishes transient (retryable) failures from corrupt files. */
export class TransientExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientExtractionError';
  }
}

export class UnreadableDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnreadableDocumentError';
  }
}

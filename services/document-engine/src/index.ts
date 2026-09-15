export {
  EXTRACTION_FIELD_NAMES,
  TransientExtractionError,
  UnreadableDocumentError,
  unknownField,
} from './types.ts';
export type {
  ExtractedField,
  ExtractionFieldName,
  ExtractionOutput,
  ExtractionProvider,
} from './types.ts';
export { AnthropicExtractionProvider } from './anthropic-provider.ts';
export { MockExtractionProvider, sha256Hex } from './mock-provider.ts';
export type { MockFixtureFields } from './mock-provider.ts';
export {
  evaluateReuseCondition,
  evaluateReuseEligibility,
} from './reuse.ts';
export type {
  DocumentReusability as ReusabilityEnum,
  ReuseConditionOutcome,
  ReuseEligibility,
  ReuseEligibilityInput,
  ValidityCheck,
} from './reuse.ts';
export {
  CONSISTENCY_OUTCOMES,
  DEFAULT_AREA_TOLERANCE_PCT,
  DOCUMENT_VS_DOCUMENT_CHECKS,
  PROFILE_VS_DOCUMENT_CHECKS,
  compare,
  parseAreaToSqft,
  runCheck,
} from './consistency.ts';
export type {
  CheckDefinition,
  ComparisonCheckType,
  ComparisonSide,
  ConsistencyCheckType,
  ConsistencyOutcome,
  RunCheckArgs,
  RunCheckResult,
} from './consistency.ts';

/**
 * @approvaliq/approval-engine — pure approval evaluation logic.
 *
 * CONSTRAINT: this package is a self-contained TypeScript package. It must NOT
 * import NestJS, any database client, any HTTP client, or any LLM SDK. This is
 * enforced by an ESLint rule (see eslint.config.mjs in this package) so the
 * engine stays portable and trivially unit-testable with zero other services
 * running.
 */

export type {
  AllCondition,
  AnyCondition,
  ApprovalDefinition,
  ApprovalEvaluation,
  ApprovalOutcome,
  Condition,
  Dependency,
  DependencyRelationship,
  DocumentRequirement,
  EqCondition,
  EvaluationResult,
  InCondition,
  MissingField,
  NotCondition,
  NumericProfileField,
  NumericRange,
  ProfileFieldName,
  RangeOnArea,
  RangeOnEmployees,
  RangeOnInvestment,
  StringProfileField,
} from './types.ts';
export { evaluate } from './evaluate.ts';

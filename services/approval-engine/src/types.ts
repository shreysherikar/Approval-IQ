/**
 * Public type model for the approval engine: approval definitions, the typed
 * condition expression language, dependency edges, and evaluation results.
 *
 * These types deliberately carry no runtime behaviour and no references to
 * NestJS, databases, HTTP clients or LLM SDKs — the engine is a pure,
 * deterministic, side-effect-free interpreter.
 */

import type { AreaType, InvestmentDefinition } from '@approvaliq/domain-types';

/** Every field a condition may reference on a `BusinessProfile`. */
export type ProfileFieldName =
  | 'industry'
  | 'state'
  | 'district'
  | 'landStatus'
  | 'areaSqft'
  | 'areaType'
  | 'investmentAmountInr'
  | 'investmentDefinition'
  | 'employeeCount'
  | 'employeeCountDefinition'
  | 'activityType';

/** String-valued profile fields (valid targets for equality / membership). */
export type StringProfileField =
  | 'industry'
  | 'state'
  | 'district'
  | 'landStatus'
  | 'areaType'
  | 'investmentDefinition'
  | 'employeeCountDefinition'
  | 'activityType';

/** Numeric profile fields (valid targets for a typed range check). */
export type NumericProfileField = 'areaSqft' | 'investmentAmountInr' | 'employeeCount';

/**
 * A typed numeric range. Bounds are inclusive by default; flip
 * `minInclusive`/`maxInclusive` to `false` for strict (< / >) bounds.
 */
export interface NumericRange {
  min?: number;
  max?: number;
  /** Inclusive lower bound; defaults to `true`. */
  minInclusive?: boolean;
  /** Inclusive upper bound; defaults to `true`. */
  maxInclusive?: boolean;
}

/** A range check on `areaSqft`. Must pin the expected `areaType`. */
export interface RangeOnArea extends NumericRange {
  kind: 'range';
  field: 'areaSqft';
  /** The `areaType` this threshold applies to — never compare across definitions. */
  expectedAreaType: AreaType;
}

/** A range check on `investmentAmountInr`. Must pin the expected definition. */
export interface RangeOnInvestment extends NumericRange {
  kind: 'range';
  field: 'investmentAmountInr';
  /** The only accepted definition is `"total_project_cost"`. */
  expectedInvestmentDefinition: InvestmentDefinition;
}

/** A range check on `employeeCount` (no definition gate required). */
export interface RangeOnEmployees extends NumericRange {
  kind: 'range';
  field: 'employeeCount';
}

/** Equality of a string profile field against a literal value. */
export interface EqCondition {
  kind: 'eq';
  field: StringProfileField;
  value: string;
}

/** Set membership: the field's value must be one of `values`. */
export interface InCondition {
  kind: 'in';
  field: StringProfileField;
  values: readonly string[];
}

export interface AllCondition {
  kind: 'all';
  conditions: readonly Condition[];
}

export interface AnyCondition {
  kind: 'any';
  conditions: readonly Condition[];
}

export interface NotCondition {
  kind: 'not';
  condition: Condition;
}

/**
 * A condition is a small, closed, typed expression tree. There is no arbitrary
 * code execution — the engine is a fixed interpreter over exactly these nodes.
 */
export type Condition =
  | AllCondition
  | AnyCondition
  | NotCondition
  | EqCondition
  | InCondition
  | RangeOnArea
  | RangeOnInvestment
  | RangeOnEmployees;
/** A document the business must provide as part of an approval. */
export interface DocumentRequirement {
  id: string;
  name: string;
  description?: string;
}

/**
 * A single approval (permit / licence / compliance gate) whose applicability
 * is described by an optional condition and which can require documents.
 */
export interface ApprovalDefinition {
  id: string;
  name: string;
  description?: string;
  /**
   * Gate condition. When omitted the approval is assumed applicable — the
   * engine reports it as `applicable` with no conditions to match.
   */
  condition?: Condition;
  requiredDocuments: readonly DocumentRequirement[];
}

/**
 * How one approval relates to another.
 * Only `depends_on` gates ordering — the other relationships are display-only
 * context and never influence the topological order.
 */
export type DependencyRelationship = 'depends_on' | 'informational' | 'parallel_with' | 'unknown';

export interface Dependency {
  /** The approval id that depends on `to`. */
  from: string;
  /** The approval id that must be satisfied before `from` (when gating). */
  to: string;
  /**
   * `depends_on` means `to` gates `from` and orders before it.
   * `informational`/`unknown` never gate; `parallel_with` is an explicit
   * confirmation that no gating relationship exists.
   */
  relationship: DependencyRelationship;
  /** Required whenever `relationship === "depends_on"`; explains the gating. */
  gatingRationale?: string;
}

export type ApprovalOutcome =
  'applicable' | 'not_applicable' | 'needs_information' | 'not_evaluable';

/** A specific profile field that blocked evaluation of an approval. */
export interface MissingField {
  field: ProfileFieldName;
  /** `unknown` — the field was never provided; `type_mismatch` — wrong definition. */
  reason: 'unknown' | 'type_mismatch';
  detail?: string;
}

export interface ApprovalEvaluation {
  approval: ApprovalDefinition;
  outcome: ApprovalOutcome;
  /** Leaf conditions whose comparison passed against the profile. */
  matchedConditions: readonly Condition[];
  /** Leaf conditions whose comparison failed against the profile. */
  failedConditions: readonly Condition[];
  /**
   * When `outcome === "needs_information"`, the exact fields that are missing
   * (or mismatched) and therefore must be collected before the approval can be
   * decided. Empty for every other outcome.
   */
  neededInformation: readonly MissingField[];
}

export interface EvaluationResult {
  /** One entry per `ApprovalDefinition`, in the same order as provided. */
  approvals: readonly ApprovalEvaluation[];
  /**
   * Deduplicated list of required documents across all *applicable* approvals
   * (first-seen order wins).
   */
  requiredDocuments: readonly DocumentRequirement[];
  /** Applicable approvals, topologically ordered over `depends_on` edges only. */
  orderedApprovalIds: readonly string[];
  /**
   * Groups of applicable approvals with no gating (`depends_on`) dependency
   * between members — these are the topological "layers" that can run in
   * parallel. Members are sorted for determinism.
   */
  parallelGroups: readonly (readonly string[])[];
  /**
   * Populated when a dependency cycle is detected among the evaluated subset.
   * Per ADR-0001 this should be impossible after Phase 1 cycle detection, so a
   * cycle is treated as an assertion failure: the affected approvals are marked
   * `not_evaluable` and a warning is emitted (never a silent skip).
   */
  warnings: readonly string[];
  /**
   * Always `true` — the engine is side-effect free and fully deterministic:
   * the same inputs always yield the exact same result.
   */
  deterministic: true;
}

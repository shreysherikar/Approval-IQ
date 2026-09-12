/**
 * @approvaliq/domain-types — shared domain model types
 * (BusinessProfile, Approval, Document, Authority, ...).
 *
 * Pure TypeScript with no runtime dependencies so any service or app can
 * import these safely.
 */

/**
 * Wraps a business field so the platform can distinguish a **known** value
 * ("we asked and got told 60 employees") from an **unknown** one ("we haven't
 * asked yet"). `null`/`0`/empty-string are deliberately NOT used to mean
 * unknown — an unknown field is expressed explicitly via `{ status: "unknown" }`.
 */
export type Known<T> =
  { readonly status: 'known'; readonly value: T } | { readonly status: 'unknown' };

/** Mark a value as known. */
export function known<T>(value: T): Known<T> {
  return { status: 'known', value };
}

/** Mark a value as unknown (not yet asked / not provided). */
export function unknown<T>(): Known<T> {
  return { status: 'unknown' };
}

/** `true` when the wrapped value is known. */
export function isKnown<T>(
  field: Known<T>,
): field is { readonly status: 'known'; readonly value: T } {
  return field.status === 'known';
}

/**
 * Returns the known value, or `undefined` when the field is unknown.
 * Use this to read a `Known<T>` without collapsing onto the value space.
 */
export function valueOf<T>(field: Known<T>): T | undefined {
  return isKnown(field) ? field.value : undefined;
}

export type LandStatus = 'owned' | 'leased' | 'not_yet_acquired';

/**
 * How a premises' physical space is counted. NOTE: `"unknown"` is a permitted
 * raw value for backwards-compat with regulatory data; the authoritative way
 * to express "not known" on a `BusinessProfile` is the `Known` wrapper status.
 */
export type AreaType = 'plot' | 'built_up' | 'leased' | 'operational' | 'unknown';

/** The single accepted definition of the reported investment figure. */
export type InvestmentDefinition = 'total_project_cost';

/** The single accepted definition of the reported headcount. */
export type EmployeeCountDefinition = 'full_operational_capacity';

/**
 * The structured business profile the approval engine evaluates conditions
 * against. Every field is a `Known<T>` so the engine can tell "we know the
 * answer" apart from "we haven't asked yet." A profile must never use `null`
 * or `0` to encode "unknown".
 */
export interface BusinessProfile {
  industry: Known<string>;
  state: Known<string>;
  district: Known<string>;
  landStatus: Known<LandStatus>;
  areaSqft: Known<number>;
  areaType: Known<AreaType>;
  investmentAmountInr: Known<number>;
  investmentDefinition: Known<InvestmentDefinition>;
  employeeCount: Known<number>;
  employeeCountDefinition: Known<EmployeeCountDefinition>;
  activityType: Known<string>;
}

/**
 * A synthetic profile where every field is unknown. Useful as a default
 * starting point and in tests; individual fields can then be lifted onto
 * known values with `known(...)`.
 */
export function emptyBusinessProfile(): BusinessProfile {
  return {
    industry: unknown<string>(),
    state: unknown<string>(),
    district: unknown<string>(),
    landStatus: unknown<LandStatus>(),
    areaSqft: unknown<number>(),
    areaType: unknown<AreaType>(),
    investmentAmountInr: unknown<number>(),
    investmentDefinition: unknown<InvestmentDefinition>(),
    employeeCount: unknown<number>(),
    employeeCountDefinition: unknown<EmployeeCountDefinition>(),
    activityType: unknown<string>(),
  };
}

/**
 * A small, typed, side-effect-free interpreter for the approval condition
 * language, plus the `evaluate()` entry point that turns a business profile,
 * a set of approval definitions and inter-approval dependencies into a full
 * `EvaluationResult`.
 *
 * Deterministic and pure: no I/O, no randomness, no date/time, no network.
 * Given the same inputs it always returns the exact same result.
 */

import type { BusinessProfile } from '@approvaliq/domain-types';
import { valueOf } from '@approvaliq/domain-types';
import type {
  ApprovalDefinition,
  ApprovalEvaluation,
  Condition,
  Dependency,
  DocumentRequirement,
  EvaluationResult,
  MissingField,
  NumericRange,
  StringProfileField,
} from './types.ts';

/** Reads a known string field, normalising a literal `"unknown"` to unknown. */
function stringValue(profile: BusinessProfile, field: StringProfileField): string | undefined {
  const raw = valueOf(profile[field]);
  if (raw === undefined) return undefined;
  if (field === 'areaType' && raw === 'unknown') return undefined;
  return raw;
}

/**
 * Internal truth used by the interpreter.
 * `needs_info` propagates which exact fields are missing / mismatched.
 * `not_evaluable` marks a malformed condition (unknown field/kind) without
 * throwing, so sibling approvals still evaluate.
 */
interface CondTruth {
  readonly truth: 'pass' | 'fail';
}
interface CondNeedsInfo {
  readonly truth: 'needs_info';
  readonly fields: readonly MissingField[];
}
interface CondNotEvaluable {
  readonly truth: 'not_evaluable';
}
type CondEval = CondTruth | CondNeedsInfo | CondNotEvaluable;

const pass = (): CondEval => ({ truth: 'pass' });
const fail = (): CondEval => ({ truth: 'fail' });
const notEvaluable = (): CondEval => ({ truth: 'not_evaluable' });
const needsInfo = (field: MissingField): CondEval => ({
  truth: 'needs_info',
  fields: [field],
});

function missing(
  field: MissingField['field'],
  reason: MissingField['reason'],
  detail?: string,
): MissingField {
  return detail === undefined ? { field, reason } : { field, reason, detail };
}

/** Deduplicate missing fields by field name, keeping the first occurrence. */
function dedupeFields(fields: readonly MissingField[]): MissingField[] {
  const seen = new Set<string>();
  const out: MissingField[] = [];
  for (const f of fields) {
    if (seen.has(f.field)) continue;
    seen.add(f.field);
    out.push(f);
  }
  return out;
}

function mergeNeeds(groups: readonly (readonly MissingField[])[]): CondEval {
  const flattened: MissingField[] = [];
  for (const g of groups) flattened.push(...g);
  return { truth: 'needs_info', fields: dedupeFields(flattened) };
}

interface EvalContext {
  matched: Condition[];
  failed: Condition[];
}
/** Evaluates a numeric range (inclusive bounds by default) against a value. */
function rangeResult(
  value: number,
  range: NumericRange,
  leaf: Condition,
  ctx: EvalContext,
): CondEval {
  const minInclusive = range.minInclusive ?? true;
  const maxInclusive = range.maxInclusive ?? true;

  const minOk = range.min === undefined || (minInclusive ? value >= range.min : value > range.min);
  const maxOk = range.max === undefined || (maxInclusive ? value <= range.max : value < range.max);

  if (minOk && maxOk) {
    ctx.matched.push(leaf);
    return pass();
  }
  ctx.failed.push(leaf);
  return fail();
}

/**
 * The typed numeric gate: checks on `areaSqft` must pin an `areaType`, and
 * checks on `investmentAmountInr` must pin the investment definition. A
 * mismatch (or an unknown definition) is `needs_information` — never a silent
 * numeric comparison across incompatible definitions.
 */
function evaluateRange(
  cond: Extract<Condition, { kind: 'range' }>,
  profile: BusinessProfile,
  ctx: EvalContext,
): CondEval {
  switch (cond.field) {
    case 'areaSqft': {
      const areaType = valueOf(profile.areaType);
      if (areaType === undefined || areaType === 'unknown') {
        return needsInfo(
          missing('areaType', 'unknown', 'Cannot compare area without knowing its type.'),
        );
      }
      if (areaType !== cond.expectedAreaType) {
        return needsInfo(
          missing(
            'areaType',
            'type_mismatch',
            `Area condition expects '${cond.expectedAreaType}' but profile reports '${areaType}'.`,
          ),
        );
      }
      const area = valueOf(profile.areaSqft);
      if (area === undefined) return needsInfo(missing('areaSqft', 'unknown'));
      return rangeResult(area, cond, cond, ctx);
    }
    case 'investmentAmountInr': {
      const definition = valueOf(profile.investmentDefinition);
      if (definition === undefined) {
        return needsInfo(missing('investmentDefinition', 'unknown'));
      }
      if (definition !== cond.expectedInvestmentDefinition) {
        return needsInfo(
          missing(
            'investmentDefinition',
            'type_mismatch',
            `Investment condition expects '${cond.expectedInvestmentDefinition}' but profile reports '${definition}'.`,
          ),
        );
      }
      const amount = valueOf(profile.investmentAmountInr);
      if (amount === undefined) {
        return needsInfo(missing('investmentAmountInr', 'unknown'));
      }
      return rangeResult(amount, cond, cond, ctx);
    }
    case 'employeeCount': {
      const count = valueOf(profile.employeeCount);
      if (count === undefined) return needsInfo(missing('employeeCount', 'unknown'));
      return rangeResult(count, cond, cond, ctx);
    }
  }
}
/** Recursive interpreter over the closed `Condition` tree. */
function evalCondition(cond: Condition, profile: BusinessProfile, ctx: EvalContext): CondEval {
  switch (cond.kind) {
    case 'all': {
      let anyNeeds = false;
      const needsGroups: (readonly MissingField[])[] = [];
      for (const child of cond.conditions) {
        const r = evalCondition(child, profile, ctx);
        if (r.truth === 'not_evaluable') return r;
        if (r.truth === 'fail') return fail();
        if (r.truth === 'needs_info') {
          anyNeeds = true;
          needsGroups.push(r.fields);
        }
      }
      if (anyNeeds) return mergeNeeds(needsGroups);
      return pass();
    }
    case 'any': {
      let anyNeeds = false;
      const needsGroups: (readonly MissingField[])[] = [];
      for (const child of cond.conditions) {
        const r = evalCondition(child, profile, ctx);
        if (r.truth === 'not_evaluable') return r;
        if (r.truth === 'pass') return pass();
        if (r.truth === 'needs_info') {
          anyNeeds = true;
          needsGroups.push(r.fields);
        }
      }
      if (anyNeeds) return mergeNeeds(needsGroups);
      return fail();
    }
    case 'not': {
      const r = evalCondition(cond.condition, profile, ctx);
      if (r.truth === 'needs_info' || r.truth === 'not_evaluable') return r;
      return r.truth === 'pass' ? fail() : pass();
    }
    case 'eq': {
      if (!(cond.field in profile)) return notEvaluable();
      const v = stringValue(profile, cond.field);
      if (v === undefined) return needsInfo(missing(cond.field, 'unknown'));
      if (v === cond.value) {
        ctx.matched.push(cond);
        return pass();
      }
      ctx.failed.push(cond);
      return fail();
    }
    case 'in': {
      if (!(cond.field in profile)) return notEvaluable();
      const v = stringValue(profile, cond.field);
      if (v === undefined) return needsInfo(missing(cond.field, 'unknown'));
      if (cond.values.includes(v)) {
        ctx.matched.push(cond);
        return pass();
      }
      ctx.failed.push(cond);
      return fail();
    }
    case 'range':
      return evaluateRange(cond, profile, ctx);
    default:
      return notEvaluable();
  }
}

/** Per-approval condition verdict before dependency ordering is applied. */
interface ApprovalVerdict {
  def: ApprovalDefinition;
  outcome: 'applicable' | 'not_applicable' | 'needs_information' | 'not_evaluable';
  matched: readonly Condition[];
  failed: readonly Condition[];
  needed: readonly MissingField[];
}

function evaluateApproval(def: ApprovalDefinition, profile: BusinessProfile): ApprovalVerdict {
  if (def.condition === undefined) {
    return { def, outcome: 'applicable', matched: [], failed: [], needed: [] };
  }
  const ctx: EvalContext = { matched: [], failed: [] };
  let r: CondEval;
  try {
    r = evalCondition(def.condition, profile, ctx);
  } catch {
    return { def, outcome: 'not_evaluable', matched: ctx.matched, failed: ctx.failed, needed: [] };
  }
  switch (r.truth) {
    case 'pass':
      return { def, outcome: 'applicable', matched: ctx.matched, failed: ctx.failed, needed: [] };
    case 'fail':
      return {
        def,
        outcome: 'not_applicable',
        matched: ctx.matched,
        failed: ctx.failed,
        needed: [],
      };
    case 'needs_info':
      return {
        def,
        outcome: 'needs_information',
        matched: ctx.matched,
        failed: ctx.failed,
        needed: dedupeFields(r.fields),
      };
    case 'not_evaluable':
      return { def, outcome: 'not_evaluable', matched: ctx.matched, failed: ctx.failed, needed: [] };
  }
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function sortedStrings(ids: Iterable<string>): string[] {
  return Array.from(ids).sort();
}

function sortedNumbers(nums: Iterable<number>): number[] {
  return Array.from(nums).sort((a, b) => a - b);
}
/**
 * Topologically order the applicable approvals over `depends_on` edges only.
 * Returns the ordered ids, the ids involved in a detected cycle (if any), and
 * the parallel layers. Deterministic — lexicographic tie-breaking by id.
 */
function orderApplicable(
  applicableIds: ReadonlySet<string>,
  dependencies: readonly Dependency[],
): { ordered: string[]; cyclicIds: string[]; layers: string[][] } {
  // successors[lower] contains the ids that (transitively) depend on `lower`.
  const successors = new Map<string, string[]>();
  // predecessors[higher] lists the approvals `higher` depends on (its gates).
  const predecessors = new Map<string, string[]>();

  const indegree = new Map<string, number>();
  for (const id of applicableIds) indegree.set(id, 0);

  for (const dep of dependencies) {
    if (dep.relationship !== 'depends_on') continue;
    if (!applicableIds.has(dep.from) || !applicableIds.has(dep.to)) continue;
    // `to` must precede `from`.
    push(successors, dep.to, dep.from);
    push(predecessors, dep.from, dep.to);
    indegree.set(dep.from, (indegree.get(dep.from) ?? 0) + 1);
  }

  // `ready` stays sorted (ascending id) so the traversal is deterministic.
  const ready = sortedStrings([...applicableIds].filter((id) => (indegree.get(id) ?? 0) === 0));

  const ordered: string[] = [];
  while (ready.length > 0) {
    const id = ready[0]!;
    ready.splice(0, 1);
    ordered.push(id!);
    for (const next of successors.get(id!) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 0) - 1);
      if ((indegree.get(next) ?? 0) === 0) {
        const insertAt = ready.findIndex((x) => x > next);
        if (insertAt === -1) ready.push(next);
        else ready.splice(insertAt, 0, next);
      }
    }
  }

  // Whatever Kahn's algorithm could not order is part of a cycle.
  const remaining = new Set<string>(applicableIds);
  for (const id of ordered) remaining.delete(id);
  const cyclicIds = sortedStrings(remaining);

  const cyclic = new Set<string>(cyclicIds);
  const layer = new Map<string, number>();
  for (const id of ordered) {
    let l = 0;
    for (const dep of predecessors.get(id) ?? []) {
      if (applicableIds.has(dep) && !cyclic.has(dep)) {
        l = Math.max(l, (layer.get(dep) ?? 0) + 1);
      }
    }
    layer.set(id, l);
  }

  const distinctLayers = sortedNumbers([...new Set(ordered.map((id) => layer.get(id) ?? 0))]);
  const layers = distinctLayers.map((l) =>
    ordered.filter((id) => (layer.get(id) ?? 0) === l).sort(),
  );

  return { ordered, cyclicIds, layers };
}

/**
 * Evaluate every approval against the profile, then order the applicable ones
 * according to the gating (`depends_on`) dependencies.
 *
 * Deterministic and side-effect free: no I/O, no randomness, no time source.
 */
export function evaluate(
  profile: BusinessProfile,
  approvalDefinitions: readonly ApprovalDefinition[],
  dependencies: readonly Dependency[],
): EvaluationResult {
  const verdicts = approvalDefinitions.map((def) => evaluateApproval(def, profile));

  const applicableIds = new Set<string>();
  for (const v of verdicts) if (v.outcome === 'applicable') applicableIds.add(v.def.id);

  const { ordered, cyclicIds, layers } = orderApplicable(applicableIds, dependencies);
  const cyclic = new Set<string>(cyclicIds);

  // --- Per-approval results -------------------------------------------------
  const approvals: ApprovalEvaluation[] = [];
  for (const v of verdicts) {
    const outcome = cyclic.has(v.def.id) ? 'not_evaluable' : v.outcome;
    approvals.push({
      approval: v.def,
      outcome,
      matchedConditions: v.matched,
      failedConditions: v.failed,
      neededInformation: outcome === 'needs_information' ? v.needed : [],
    });
  }

  // --- Deduplicated required documents across applicable approvals ---------
  const seenDocs = new Set<string>();
  const requiredDocuments: DocumentRequirement[] = [];
  for (const v of verdicts) {
    if (v.outcome !== 'applicable' || cyclic.has(v.def.id)) continue;
    for (const doc of v.def.requiredDocuments) {
      if (seenDocs.has(doc.id)) continue;
      seenDocs.add(doc.id);
      requiredDocuments.push(doc);
    }
  }

  // --- Cycle warning (assertion failure, never a silent skip) ---------------
  const warnings: string[] = [];
  if (cyclicIds.length > 0) {
    warnings.push(
      `Dependency cycle detected among evaluated approvals; marked not_evaluable: ${cyclicIds.join(' -> ')}. ` +
        `This should be impossible after Phase 1 cycle detection — treat as an assertion failure.`,
    );
  }

  return {
    approvals,
    requiredDocuments,
    orderedApprovalIds: ordered,
    parallelGroups: layers,
    warnings,
    deterministic: true,
  };
}

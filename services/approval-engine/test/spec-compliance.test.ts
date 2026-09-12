/**
 * Spec-compliance tests (prompt 2.2 items 1-10).
 * Runner: monorepo default for this package is `node --test` (not Vitest/Jest).
 * Run: `node --test test/spec-compliance.test.ts`.
 * Real Phase-1 brewery data: test/fixtures/brewery-sample.json.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BusinessProfile } from '@approvaliq/domain-types';
import { emptyBusinessProfile, known, unknown } from '@approvaliq/domain-types';
import { evaluate } from '../src/index.ts';
import type { ApprovalDefinition, Condition, Dependency } from '../src/index.ts';
import brewerySample from './fixtures/brewery-sample.json' with { type: 'json' };

interface FixtureDoc {
  id: string;
  name: string;
}
interface FixtureApproval {
  id: string;
  name: string;
  description?: string;
  condition?: Condition;
  requiredDocuments: FixtureDoc[];
}
interface FixtureDependency {
  from: string;
  to: string;
  relationship: Dependency['relationship'];
  gatingRationale?: string;
}
const sample = brewerySample as unknown as {
  approvals: FixtureApproval[];
  dependencies: FixtureDependency[];
};

function toDefs(list: readonly FixtureApproval[]): ApprovalDefinition[] {
  return list.map((a) => {
    const d: ApprovalDefinition = { id: a.id, name: a.name, requiredDocuments: a.requiredDocuments };
    if (a.condition !== undefined) d.condition = a.condition;
    if (a.description !== undefined) d.description = a.description;
    return d;
  });
}

/** Maharashtra brewery profile matching the real BRL-001/MPCB conditions. */
function maharashtraBrewery(): BusinessProfile {
  const p = emptyBusinessProfile();
  p.industry = known('brewery');
  p.state = known('Maharashtra');
  p.district = known('Pune');
  p.landStatus = known('owned');
  p.areaSqft = known(25_000);
  p.areaType = known('leased');
  p.investmentAmountInr = known(400_000_000);
  p.investmentDefinition = known('total_project_cost');
  p.employeeCount = known(120);
  p.employeeCountDefinition = known('full_operational_capacity');
  p.activityType = known('beer-manufacturing');
  return p;
}

function mkDef(
  id: string,
  name: string,
  condition: Condition | undefined,
  docs: { id: string; name: string }[] = [],
): ApprovalDefinition {
  const d: ApprovalDefinition = { id, name, requiredDocuments: docs };
  if (condition !== undefined) d.condition = condition;
  return d;
}

function mkDep(from: string, to: string, relationship: Dependency['relationship']): Dependency {
  return { from, to, relationship };
}

test('1. exact match against real BRL-001 fixture is applicable', () => {
  const brl = toDefs(sample.approvals.filter((a) => a.id === 'BRL-001'));
  const r = evaluate(maharashtraBrewery(), brl, []);
  assert.equal(r.approvals[0]?.outcome, 'applicable');
});

test('2. wrong state against real BRL-001 fixture is not_applicable', () => {
  const brl = toDefs(sample.approvals.filter((a) => a.id === 'BRL-001'));
  const p = maharashtraBrewery();
  p.state = known('Karnataka');
  const r = evaluate(p, brl, []);
  assert.equal(r.approvals[0]?.outcome, 'not_applicable');
});

test('3. unknown state yields needs_information naming state', () => {
  const brl = toDefs(sample.approvals.filter((a) => a.id === 'BRL-001'));
  const p = maharashtraBrewery();
  p.state = unknown<string>();
  const r = evaluate(p, brl, []);
  assert.equal(r.approvals[0]?.outcome, 'needs_information');
  assert.deepEqual(
    (r.approvals[0]?.neededInformation ?? []).map((n) => n.field),
    ['state'],
  );
});

test('4. exclusive >5000 boundary: 4999 fail, 5000 fail, 5001 pass', () => {
  const cond: Condition = { kind: 'range', field: 'employeeCount', min: 5000, minInclusive: false };
  const outcomes: string[] = [];
  for (const n of [4999, 5000, 5001]) {
    const p = maharashtraBrewery();
    p.employeeCount = known(n);
    const r = evaluate(p, [mkDef('headcount', 'Headcount', cond)], []);
    outcomes.push(r.approvals[0]?.outcome ?? 'missing');
  }
  assert.deepEqual(outcomes, ['not_applicable', 'not_applicable', 'applicable']);
});

test('5. real DOC-002 shared by two approvals deduplicates', () => {
  const defs = toDefs(sample.approvals.filter((a) => a.id === 'BRL-001' || a.id === 'MPCB-CTE-001'));
  const r = evaluate(maharashtraBrewery(), defs, []);
  assert.deepEqual(
    r.approvals.map((a) => a.outcome),
    ['applicable', 'applicable'],
  );
  assert.equal(r.requiredDocuments.filter((d) => d.id === 'DOC-002').length, 1);
});

test('6. A depends_on B depends_on C orders [C, B, A]', () => {
  const defs = [mkDef('a', 'A', undefined), mkDef('b', 'B', undefined), mkDef('c', 'C', undefined)];
  const deps = [mkDep('a', 'b', 'depends_on'), mkDep('b', 'c', 'depends_on')];
  const r = evaluate(maharashtraBrewery(), defs, deps);
  assert.deepEqual(r.orderedApprovalIds, ['c', 'b', 'a']);
  assert.deepEqual(r.parallelGroups, [['c'], ['b'], ['a']]);
});

test('7. independent approvals share a parallel group', () => {
  const defs = [mkDef('x', 'X', undefined), mkDef('y', 'Y', undefined)];
  const r = evaluate(maharashtraBrewery(), defs, []);
  assert.deepEqual(r.parallelGroups, [['x', 'y']]);
});

test('8. malformed condition is not_evaluable without crashing siblings', () => {
  const malformed = { kind: 'eq', field: 'nope', value: 'x' } as unknown as Condition;
  const defs = [
    mkDef('bad', 'Bad', malformed),
    mkDef('good', 'Good', { kind: 'eq', field: 'state', value: 'Maharashtra' }),
  ];
  const r = evaluate(maharashtraBrewery(), defs, []);
  assert.equal(r.approvals[0]?.outcome, 'not_evaluable');
  assert.equal(r.approvals[1]?.outcome, 'applicable');
  assert.deepEqual(r.orderedApprovalIds, ['good']);
});

test('9. leased areaType vs built_up expectation is needs_information', () => {
  const cond: Condition = { kind: 'range', field: 'areaSqft', min: 5000, expectedAreaType: 'built_up' };
  const r = evaluate(maharashtraBrewery(), [mkDef('plot-rule', 'Plot Rule', cond)], []);
  assert.equal(r.approvals[0]?.outcome, 'needs_information');
  const needed = r.approvals[0]?.neededInformation ?? [];
  assert.ok(needed.some((n) => n.field === 'areaType'));
  assert.equal(r.approvals[0]?.matchedConditions.length, 0);
});

test('10. informational unknown parallel_with do not gate, depends_on does', () => {
  const defs = [mkDef('m', 'M', undefined), mkDef('n', 'N', undefined)];
  for (const rel of ['informational', 'unknown', 'parallel_with'] as const) {
    const r = evaluate(maharashtraBrewery(), defs, [mkDep('n', 'm', rel)]);
    assert.deepEqual(r.parallelGroups, [['m', 'n']]);
    assert.deepEqual(r.orderedApprovalIds, ['m', 'n']);
  }
  const gated = evaluate(maharashtraBrewery(), defs, [mkDep('n', 'm', 'depends_on')]);
  assert.deepEqual(gated.parallelGroups, [['m'], ['n']]);
  assert.deepEqual(gated.orderedApprovalIds, ['m', 'n']);
});


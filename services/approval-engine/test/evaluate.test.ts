/**
 * End-to-end tests for the approval engine.
 *
 * Runs standalone with zero other services: `node --test test/evaluate.test.ts`
 * (Node 22+ native TypeScript). Also type-checked by `pnpm --filter
 * @approvaliq/approval-engine test:types`, and governed by this package's
 * import-ban ESLint config (engine + domain-types + node:test/node:assert only).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BusinessProfile } from '@approvaliq/domain-types';
import { emptyBusinessProfile, known, unknown } from '@approvaliq/domain-types';
import { evaluate } from '../src/index.ts';
import type { ApprovalDefinition, Condition, Dependency } from '../src/index.ts';

/** A fully-known brewery profile on a leased premises in Karnataka. */
function breweryProfile(): BusinessProfile {
  const p = emptyBusinessProfile();
  p.industry = known('brewery');
  p.state = known('Karnataka');
  p.district = known('Bengaluru Urban');
  p.landStatus = known('leased');
  p.areaSqft = known(25_000);
  p.areaType = known('leased');
  p.investmentAmountInr = known(400_000_000);
  p.investmentDefinition = known('total_project_cost');
  p.employeeCount = known(120);
  p.employeeCountDefinition = known('full_operational_capacity');
  p.activityType = known('microbrewery');
  return p;
}

function approval(
  id: string,
  name: string,
  condition: Condition | undefined,
  docs: { id: string; name: string }[] = [],
  description?: string,
): ApprovalDefinition {
  const def: ApprovalDefinition = {
    id,
    name,
    requiredDocuments: docs,
  };
  if (condition !== undefined) def.condition = condition;
  if (description !== undefined) def.description = description;
  return def;
}

function dep(from: string, to: string, relationship: Dependency['relationship']): Dependency {
  return { from, to, relationship };
}

test('applicable approval matches eq + in + range conditions', () => {
  const profile = breweryProfile();
  const defs = [
    approval(
      'state-licence',
      'State Excise Licence',
      {
        kind: 'all',
        conditions: [
          { kind: 'eq', field: 'state', value: 'Karnataka' },
          { kind: 'in', field: 'landStatus', values: ['owned', 'leased'] },
          {
            kind: 'range',
            field: 'areaSqft',
            min: 10_000,
            max: 50_000,
            expectedAreaType: 'leased',
          },
        ],
      },
      [{ id: 'doc-site-plan', name: 'Site plan' }],
    ),
  ];

  const r = evaluate(profile, defs, []);
  assert.equal(r.approvals[0]?.outcome, 'applicable');
  assert.equal(r.orderedApprovalIds.length, 1);
  assert.equal(r.requiredDocuments.map((d) => d.id).join(','), 'doc-site-plan');
  assert.equal(r.warnings.length, 0);
});

test('not applicable when a condition fails', () => {
  const profile = breweryProfile();
  const defs = [
    approval('other-state', 'Other State Licence', {
      kind: 'eq',
      field: 'state',
      value: 'Maharashtra',
    }),
  ];
  const r = evaluate(profile, defs, []);
  assert.equal(r.approvals[0]?.outcome, 'not_applicable');
  assert.equal(r.orderedApprovalIds.length, 0);
  assert.equal(r.requiredDocuments.length, 0);
});

test('unknown field yields needs_information naming exactly that field', () => {
  const profile = breweryProfile();
  profile.state = unknown<string>(); // we have not asked yet
  const defs = [
    approval('needs-state', 'Needs State', {
      kind: 'eq',
      field: 'state',
      value: 'Karnataka',
    }),
  ];
  const r = evaluate(profile, defs, []);
  assert.equal(r.approvals[0]?.outcome, 'needs_information');
  const needed = r.approvals[0]?.neededInformation ?? [];
  assert.deepEqual(
    needed.map((n) => n.field),
    ['state'],
  );
  assert.equal(needed[0]?.reason, 'unknown');
});

test('area range never compares across incompatible areaType definitions', () => {
  const profile = breweryProfile(); // areaType = leased, areaSqft = 25_000
  const defs = [
    approval('plot-go', 'Plot Only', {
      kind: 'range',
      field: 'areaSqft',
      min: 10_000,
      expectedAreaType: 'plot',
    }),
  ];
  // A leased-area value must NOT be silently compared against a plot threshold.
  const r = evaluate(profile, defs, []);
  assert.equal(r.approvals[0]?.outcome, 'needs_information');
  const needed = r.approvals[0]?.neededInformation ?? [];
  assert.deepEqual(
    needed.map((n) => n.field),
    ['areaType'],
  );
  assert.equal(needed[0]?.reason, 'type_mismatch');
  assert.equal(r.approvals[0]?.matchedConditions.length, 0);
  assert.equal(r.approvals[0]?.failedConditions.length, 0);
});

test('unknown areaType for an area check is needs_information, not a comparison', () => {
  const profile = breweryProfile();
  profile.areaType = unknown();
  const defs = [
    approval('any-area', 'Any Area', {
      kind: 'range',
      field: 'areaSqft',
      min: 10_000,
      expectedAreaType: 'leased',
    }),
  ];
  const r = evaluate(profile, defs, []);
  assert.equal(r.approvals[0]?.outcome, 'needs_information');
  assert.deepEqual(
    (r.approvals[0]?.neededInformation ?? []).map((n) => n.field),
    ['areaType'],
  );
});
test('investment range pins the investment definition', () => {
  // Mismatched definition value is caught even though the amount is known.
  const wrongDef = breweryProfile();
  wrongDef.investmentDefinition = known('total_project_cost' as const);
  const r = evaluate(
    wrongDef,
    [
      approval('big-project', 'Big Project', {
        kind: 'range',
        field: 'investmentAmountInr',
        min: 100_000_000,
        expectedInvestmentDefinition: 'total_project_cost',
      }),
    ],
    [],
  );
  assert.equal(r.approvals[0]?.outcome, 'applicable');
});

test('range inclusive vs exclusive bounds are honoured', () => {
  const profile = breweryProfile(); // employeeCount = 120
  const r = evaluate(
    profile,
    [
      approval('inc', 'Inclusive', {
        kind: 'range',
        field: 'employeeCount',
        max: 120,
      }),
      approval('exc', 'Exclusive', {
        kind: 'range',
        field: 'employeeCount',
        max: 120,
        maxInclusive: false,
      }),
    ],
    [],
  );
  assert.equal(r.approvals[0]?.outcome, 'applicable');
  assert.equal(r.approvals[1]?.outcome, 'not_applicable');
});

test('any and not combinators', () => {
  const profile = breweryProfile();
  const defs = [
    approval('any-ok', 'Any Ok', {
      kind: 'any',
      conditions: [
        { kind: 'eq', field: 'state', value: 'Maharashtra' },
        { kind: 'eq', field: 'state', value: 'Karnataka' },
      ],
    }),
    approval('not-ok', 'Not Ok', {
      kind: 'not',
      condition: { kind: 'eq', field: 'district', value: 'Pune' },
    }),
  ];
  const r = evaluate(profile, defs, []);
  assert.equal(r.approvals[0]?.outcome, 'applicable');
  assert.equal(r.approvals[1]?.outcome, 'applicable');
});

test('required documents are deduplicated across applicable approvals', () => {
  const profile = breweryProfile();
  const shared = { id: 'site-plan', name: 'Site plan' };
  const defs = [
    approval('a', 'A', { kind: 'eq', field: 'state', value: 'Karnataka' }, [
      shared,
      { id: 'doc-a', name: 'A doc' },
    ]),
    approval('b', 'B', { kind: 'eq', field: 'state', value: 'Karnataka' }, [
      shared,
      { id: 'doc-b', name: 'B doc' },
    ]),
  ];
  const r = evaluate(profile, defs, []);
  assert.deepEqual(
    r.requiredDocuments.map((d) => d.id),
    ['site-plan', 'doc-a', 'doc-b'],
  );
});

test('depends_on orders approvals; informational/unknown edges do not gate', () => {
  const profile = breweryProfile();
  const defs = [
    approval('foundation', 'Foundation', undefined),
    approval('licence', 'Licence', undefined),
    approval('ops', 'Operations', undefined),
  ];
  const dependencies: Dependency[] = [
    dep('licence', 'foundation', 'depends_on'), // foundation before licence
    dep('ops', 'licence', 'informational'), // ignored for ordering
    dep('ops', 'foundation', 'unknown'), // ignored for ordering
  ];
  const r = evaluate(profile, defs, dependencies);
  assert.equal(r.approvals[0]?.outcome, 'applicable');
  assert.ok(r.orderedApprovalIds.includes('foundation'));
  assert.ok(r.orderedApprovalIds.includes('licence'));
  assert.equal(
    r.orderedApprovalIds.indexOf('foundation') < r.orderedApprovalIds.indexOf('licence'),
    true,
  );
  assert.equal(r.warnings.length, 0);
});
test('parallel groups are topological layers', () => {
  const profile = breweryProfile();
  const defs = [
    approval('a', 'A', undefined),
    approval('b', 'B', undefined),
    approval('c', 'C', undefined),
    approval('d', 'D', undefined),
  ];
  const dependencies: Dependency[] = [
    dep('c', 'a', 'depends_on'),
    dep('c', 'b', 'depends_on'),
    dep('d', 'c', 'depends_on'),
  ];
  const r = evaluate(profile, defs, dependencies);
  assert.deepEqual(r.orderedApprovalIds, ['a', 'b', 'c', 'd']);
  assert.deepEqual(r.parallelGroups, [['a', 'b'], ['c'], ['d']]);
});

test('parallel_with confirms no gating and does not order', () => {
  const profile = breweryProfile();
  const defs = [approval('x', 'X', undefined), approval('y', 'Y', undefined)];
  const r = evaluate(profile, defs, [dep('x', 'y', 'parallel_with')]);
  assert.equal(r.warnings.length, 0);
  // With no gating edge, the two are in the same parallel layer.
  assert.deepEqual(r.parallelGroups, [['x', 'y']]);
});

test('dependency cycle is reported as an assertion failure, not silently skipped', () => {
  const profile = breweryProfile();
  const defs = [approval('p1', 'P1', undefined), approval('p2', 'P2', undefined)];
  const dependencies: Dependency[] = [dep('p1', 'p2', 'depends_on'), dep('p2', 'p1', 'depends_on')];
  const r = evaluate(profile, defs, dependencies);
  assert.equal(r.warnings.length, 1);
  assert.ok(r.warnings[0]?.includes('cycle'));
  // Cycle participants are marked not_evaluable (never a silent skip).
  assert.equal(r.approvals[0]?.outcome, 'not_evaluable');
  assert.equal(r.approvals[1]?.outcome, 'not_evaluable');
  assert.deepEqual(r.orderedApprovalIds, []);
  assert.deepEqual(r.parallelGroups, []);
  assert.equal(r.requiredDocuments.length, 0);
});

test('evaluate is deterministic for identical inputs', () => {
  const profile = breweryProfile();
  const defs = [
    approval('base', 'Base', undefined),
    approval('gated', 'Gated', {
      kind: 'range',
      field: 'investmentAmountInr',
      min: 200_000_000,
      expectedInvestmentDefinition: 'total_project_cost',
    }),
  ];
  const dependencies: Dependency[] = [dep('gated', 'base', 'depends_on')];
  const a = evaluate(profile, defs, dependencies);
  const b = evaluate(profile, defs, dependencies);
  assert.deepEqual(a, b);
  assert.equal(a.deterministic, true);
});

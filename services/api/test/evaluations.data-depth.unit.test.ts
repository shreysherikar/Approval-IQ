import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toEngineCondition } from '../src/evaluations/evaluations.service';
import { evaluate } from '../../../services/approval-engine/src/evaluate';
import { known } from '../../../packages/domain-types/src/index';

describe('Data Depth & Rich Condition Evaluator', () => {
  it('translates native and operator-based range conditions for area', () => {
    const cond = toEngineCondition({
      kind: 'range',
      field: 'areaSqft',
      min: 10000,
      expectedAreaType: 'built_up',
    });
    assert.deepEqual(cond, {
      kind: 'range',
      field: 'areaSqft',
      min: 10000,
      expectedAreaType: 'built_up',
    });
  });

  it('translates set membership (in condition) on district', () => {
    const cond = toEngineCondition({
      kind: 'in',
      field: 'district',
      values: ['Pune', 'Thane', 'Raigad'],
    });
    assert.deepEqual(cond, {
      kind: 'in',
      field: 'district',
      values: ['Pune', 'Thane', 'Raigad'],
    });
  });

  it('translates compound all / range / eq conditions from JSON strings', () => {
    const rawJson = JSON.stringify({
      all: [
        { field: 'industry', op: 'equals', value: 'solar_manufacturing' },
        { field: 'state', op: 'equals', value: 'Maharashtra' },
        { kind: 'range', field: 'areaSqft', min: 10000, expectedAreaType: 'built_up' },
      ],
    });
    const cond = toEngineCondition(rawJson);
    assert.ok(cond);
    assert.equal(cond.kind, 'all');
    if (cond.kind === 'all') {
      assert.equal(cond.conditions.length, 3);
      assert.deepEqual(cond.conditions[0], { kind: 'eq', field: 'industry', value: 'solar_manufacturing' });
      assert.deepEqual(cond.conditions[1], { kind: 'eq', field: 'state', value: 'Maharashtra' });
      assert.deepEqual(cond.conditions[2], { kind: 'range', field: 'areaSqft', min: 10000, expectedAreaType: 'built_up' });
    }
  });

  it('evaluates solar manufacturing approvals dynamically based on range and set filters', () => {
    const profile = {
      industry: known('solar_manufacturing'),
      state: known('Maharashtra'),
      district: known('Pune'),
      landStatus: known('leased' as const),
      areaSqft: known(25000),
      areaType: known('built_up' as const),
      investmentAmountInr: known(25000000),
      investmentDefinition: known('total_project_cost' as const),
      employeeCount: known(150),
      employeeCountDefinition: known('full_operational_capacity' as const),
      activityType: known('manufacturing'),
    };

    const definitions = [
      {
        id: 'MIDC-ALLOTMENT-001',
        name: 'MIDC Industrial Land Allotment',
        condition: toEngineCondition({
          all: [
            { field: 'industry', op: 'equals', value: 'solar_manufacturing' },
            { field: 'state', op: 'equals', value: 'Maharashtra' },
          ],
        }),
        requiredDocuments: [],
      },
      {
        id: 'FIRE-NOC-002',
        name: 'Maharashtra Fire Services Provisional NOC',
        condition: toEngineCondition({
          all: [
            { field: 'industry', op: 'equals', value: 'solar_manufacturing' },
            { field: 'state', op: 'equals', value: 'Maharashtra' },
            { kind: 'range', field: 'areaSqft', min: 10000, expectedAreaType: 'built_up' },
          ],
        }),
        requiredDocuments: [],
      },
      {
        id: 'CGWA-GW-001',
        name: 'CGWA Ground Water Extraction Clearance',
        condition: toEngineCondition({
          all: [
            { field: 'industry', op: 'equals', value: 'solar_manufacturing' },
            { kind: 'in', field: 'district', values: ['Pune', 'Thane', 'Raigad'] },
          ],
        }),
        requiredDocuments: [],
      },
      {
        id: 'CEIG-SUBSTATION-001',
        name: 'CEIG HT Substation Approval',
        condition: toEngineCondition({
          all: [
            { field: 'industry', op: 'equals', value: 'solar_manufacturing' },
            { kind: 'range', field: 'investmentAmountInr', min: 5000000, expectedInvestmentDefinition: 'total_project_cost' },
          ],
        }),
        requiredDocuments: [],
      },
    ];

    const dependencies = [
      { from: 'FIRE-NOC-002', to: 'MIDC-ALLOTMENT-001', relationship: 'depends_on' as const },
      { from: 'CEIG-SUBSTATION-001', to: 'MIDC-ALLOTMENT-001', relationship: 'depends_on' as const },
    ];

    // 1. High capacity profile in Pune: all 4 approvals should be applicable
    const result1 = evaluate(profile as never, definitions as never, dependencies as never);
    assert.equal(result1.approvals.length, 4);
    for (const app of result1.approvals) {
      assert.equal(app.outcome, 'applicable', `Expected ${app.approval.id} to be applicable`);
    }

    // 2. Small built-up area (5,000 sq ft < 10,000 threshold): Fire NOC should be not_applicable
    const smallAreaProfile = {
      ...profile,
      areaSqft: known(5000),
    };
    const result2 = evaluate(smallAreaProfile as never, definitions as never, dependencies as never);
    const fireApp = result2.approvals.find((a) => a.approval.id === 'FIRE-NOC-002');
    assert.equal(fireApp?.outcome, 'not_applicable');

    // 3. District outside CGWA notified list (e.g. Nanded): CGWA NOC should be not_applicable
    const nonNotifiedDistrictProfile = {
      ...profile,
      district: known('Nanded'),
    };
    const result3 = evaluate(nonNotifiedDistrictProfile as never, definitions as never, dependencies as never);
    const cgwaApp = result3.approvals.find((a) => a.approval.id === 'CGWA-GW-001');
    assert.equal(cgwaApp?.outcome, 'not_applicable');
  });
});

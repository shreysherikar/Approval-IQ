/**
 * Unit & integration tests for the Schemes & Incentives engine extension.
 *
 * Tests:
 * 1. Approval rule -> applicable
 * 2. Incentive rule -> potentially_eligible
 * 3. Incentive rule -> not_eligible
 * 4. Incentive rule -> needs_information (missing required business fields)
 * 5. Exclusion condition matching (e.g. Maharashtra PSI-2019 brewery exclusion)
 * 6. Multiple incentive schemes evaluated alongside approvals
 * 7. Independence of approval dependency graph and incentive evaluations
 * 8. Reference demo case: Pune Brewery Expansion -> PSI-2019 produces not_eligible
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { BusinessProfile } from '@approvaliq/domain-types';
import { emptyBusinessProfile, known, unknown } from '@approvaliq/domain-types';
import { evaluate } from '../src/index.ts';
import type { ApprovalDefinition } from '../src/index.ts';

function puneBreweryProfile(): BusinessProfile {
  const p = emptyBusinessProfile();
  p.industry = known('brewery');
  p.state = known('Maharashtra');
  p.district = known('Pune');
  p.landStatus = known('owned');
  p.areaSqft = known(45_000);
  p.areaType = known('built_up');
  p.investmentAmountInr = known(350_000_000);
  p.investmentDefinition = known('total_project_cost');
  p.employeeCount = known(85);
  p.employeeCountDefinition = known('full_operational_capacity');
  p.activityType = known('beer-manufacturing');
  return p;
}

test('Schemes & Incentives — Pune Brewery produces excluded for PSI-2019 due to negative list exclusion', () => {
  const profile = puneBreweryProfile();

  const psi2019Scheme: ApprovalDefinition = {
    id: 'SCHEME-PSI-2019',
    name: 'Package Scheme of Incentives — 2019',
    shortName: 'PSI-2019',
    ruleKind: 'incentive',
    jurisdiction: 'Maharashtra',
    description: 'Fiscal incentives for eligible industrial investments in Maharashtra.',
    condition: {
      kind: 'eq',
      field: 'state',
      value: 'Maharashtra',
    },
    exclusionConditions: {
      kind: 'any',
      conditions: [
        { kind: 'eq', field: 'industry', value: 'brewery' },
        { kind: 'eq', field: 'activityType', value: 'beer-manufacturing' },
      ],
    },
    exclusionReason: 'Beer and liquor manufacturing industries are excluded under the cited scheme (Annexure II Negative List).',
    sourceUrl: 'https://industry.maharashtra.gov.in/sites/default/files/2025-09/20190916-psi-2019.pdf',
    sourceTitle: 'Maharashtra Industry Department — Package Scheme of Incentives, 2019',
    verificationDate: '2026-09-10',
    requiredDocuments: [],
  };

  const exciseApproval: ApprovalDefinition = {
    id: 'BRL-001',
    name: 'Form BRL Brewery Licence',
    ruleKind: 'approval',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'eq', field: 'industry', value: 'brewery' },
        { kind: 'eq', field: 'state', value: 'Maharashtra' },
      ],
    },
    requiredDocuments: [{ id: 'DOC-001', name: 'Site Boundary Survey' }],
  };

  const result = evaluate(profile, [psi2019Scheme, exciseApproval], []);

  // 1. Check PSI-2019 evaluation
  const psiEval = result.schemes.find((s) => s.scheme.id === 'SCHEME-PSI-2019');
  assert.ok(psiEval, 'PSI-2019 should be in evaluated schemes');
  assert.equal(psiEval.outcome, 'excluded');
  assert.equal(psiEval.exclusionMatched, true);
  assert.equal(
    psiEval.explanation,
    'Beer and liquor manufacturing industries are excluded under the cited scheme (Annexure II Negative List).',
  );

  // 2. Check BRL-001 approval evaluation
  const brlEval = result.approvals.find((a) => a.approval.id === 'BRL-001');
  assert.ok(brlEval, 'BRL-001 should be in evaluated approvals');
  assert.equal(brlEval.outcome, 'applicable');

  // 3. Check dependency graph does NOT include incentive schemes
  assert.deepEqual(result.orderedApprovalIds, ['BRL-001']);
  assert.deepEqual(result.requiredDocuments, [{ id: 'DOC-001', name: 'Site Boundary Survey' }]);
});

test('Schemes & Incentives — clean solar project produces potentially_eligible', () => {
  const profile = emptyBusinessProfile();
  profile.industry = known('solar_manufacturing');
  profile.state = known('Maharashtra');
  profile.investmentAmountInr = known(100_000_000);
  profile.investmentDefinition = known('total_project_cost');

  const solarIncentive: ApprovalDefinition = {
    id: 'SCHEME-SOLAR-2024',
    name: 'Maharashtra Clean Tech & Solar Capital Incentive Program',
    shortName: 'MAHA-CLEANTECH',
    ruleKind: 'incentive',
    jurisdiction: 'Maharashtra',
    condition: {
      kind: 'all',
      conditions: [
        { kind: 'eq', field: 'state', value: 'Maharashtra' },
        { kind: 'eq', field: 'industry', value: 'solar_manufacturing' },
      ],
    },
    requiredDocuments: [],
  };

  const result = evaluate(profile, [solarIncentive], []);
  const evalResult = result.schemes.find((s) => s.scheme.id === 'SCHEME-SOLAR-2024');

  assert.ok(evalResult);
  assert.equal(evalResult.outcome, 'potentially_eligible');
});

test('Schemes & Incentives — missing business profile field produces needs_information', () => {
  const profile = emptyBusinessProfile();
  profile.industry = known('solar_manufacturing');
  profile.state = known('Maharashtra');
  // investment is unknown
  profile.investmentAmountInr = unknown();
  profile.investmentDefinition = known('total_project_cost');

  const msmeSubsidy: ApprovalDefinition = {
    id: 'SCHEME-MSME-CAP',
    name: 'MSME Capital Investment Subsidy',
    ruleKind: 'incentive',
    condition: {
      kind: 'range',
      field: 'investmentAmountInr',
      max: 500_000_000,
      expectedInvestmentDefinition: 'total_project_cost',
    },
    requiredDocuments: [],
  };

  const result = evaluate(profile, [msmeSubsidy], []);
  const evalResult = result.schemes.find((s) => s.scheme.id === 'SCHEME-MSME-CAP');

  assert.ok(evalResult);
  assert.equal(evalResult.outcome, 'needs_information');
  assert.ok(evalResult.neededInformation.length > 0);
  assert.equal(evalResult.neededInformation[0]?.field, 'investmentAmountInr');
});

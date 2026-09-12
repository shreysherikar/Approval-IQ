/**
 * Regression tests for EvaluationsService.toEngineCondition(): the API-layer
 * translation from the DB's `applicabilityConditions` JSONB into the engine's
 * typed Condition tree.
 *
 * Contract under test:
 * - Non-empty free-text prose (unresolved applicability, e.g. DISH-LICENCE-001)
 *   must surface as `not_evaluable` via the engine's unsupported-kind branch —
 *   NEVER as a fabricated `not_applicable` (the old `industry == "__never__"`
 *   sentinel bug).
 * - Structured JSON with supported clauses must keep evaluating deterministically.
 * - Empty/blank or missing condition stays `undefined` (approval assumed
 *   applicable per the engine's ApprovalDefinition contract).
 *
 * Run: `pnpm --filter api test:unit` (tsx --test; the service module uses
 * extensionless relative imports, so Node's bare type-stripping can't resolve it).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyBusinessProfile, known } from '@approvaliq/domain-types';
import { evaluate } from '@approvaliq/approval-engine';
import type { ApprovalDefinition, Condition } from '@approvaliq/approval-engine';

import { toEngineCondition } from '../src/evaluations/evaluations.service';

const PROSE =
  'Applies if the brewery is classified as a MAH/hazardous or other factory — ' +
  'classification depends on facts not yet available in the BusinessProfile.';

function breweryProfile() {
  const p = emptyBusinessProfile();
  p.industry = known('brewery');
  p.state = known('Karnataka');
  return p;
}

function def(id: string, condition: Condition | undefined): ApprovalDefinition {
  const d: ApprovalDefinition = { id, name: id, requiredDocuments: [] };
  if (condition !== undefined) d.condition = condition;
  return d;
}

test('non-empty prose condition is not a deterministic never-match sentinel', () => {
  const cond = toEngineCondition(PROSE);
  assert.ok(cond, 'prose must translate to a condition (not undefined)');
  // Regression against the old bug: { kind: 'eq', field: 'industry', value: '__never__' }
  const asAny = cond as { kind: string; field?: string; value?: string };
  assert.notEqual(asAny.kind, 'eq');
  assert.notEqual(asAny.value, '__never__');
});

test('non-empty prose condition evaluates to not_evaluable (not not_applicable)', async () => {
  const cond = toEngineCondition(PROSE);
  const r = evaluate(breweryProfile(), [def('prose-approval', cond)], []);
  assert.equal(r.approvals[0]?.outcome, 'not_evaluable');
  assert.equal(r.orderedApprovalIds.includes('prose-approval'), false);
});

test('prose-condition approval does not crash sibling approvals', () => {
  const good: Condition = { kind: 'eq', field: 'state', value: 'Karnataka' };
  const r = evaluate(breweryProfile(), [
    def('prose-approval', toEngineCondition(PROSE)),
    def('good', good),
  ], []);
  assert.equal(r.approvals[0]?.outcome, 'not_evaluable');
  assert.equal(r.approvals[1]?.outcome, 'applicable');
  assert.deepEqual(r.orderedApprovalIds, ['good']);
});

test('structured supported clauses keep evaluating deterministically', () => {
  const cond = toEngineCondition({
    all: [{ field: 'state', op: 'equals', value: 'Karnataka' }],
  });
  assert.deepEqual(cond, {
    kind: 'all',
    conditions: [{ kind: 'eq', field: 'state', value: 'Karnataka' }],
  });
  const r = evaluate(breweryProfile(), [def('structured', cond)], []);
  assert.equal(r.approvals[0]?.outcome, 'applicable');
});

test('structured JSON with no supported clauses is not_evaluable, not not_applicable', () => {
  const cond = toEngineCondition({
    all: [{ field: 'productionCapacity', op: 'equals', value: 'large' }],
  });
  assert.ok(cond, 'unsupported structured condition must still translate');
  const r = evaluate(breweryProfile(), [def('unsupported-structured', cond)], []);
  assert.equal(r.approvals[0]?.outcome, 'not_evaluable');
});

test('empty/blank/missing condition stays undefined (assumed applicable)', () => {
  assert.equal(toEngineCondition(''), undefined);
  assert.equal(toEngineCondition('   '), undefined);
  assert.equal(toEngineCondition(null), undefined);
  assert.equal(toEngineCondition(undefined), undefined);
});

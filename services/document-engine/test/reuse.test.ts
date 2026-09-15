import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  evaluateReuseCondition,
  evaluateReuseEligibility,
} from '../src/index.ts';
import type { ReuseEligibilityInput } from '../src/index.ts';

/** A fully-passing baseline; each test flips exactly the check under test. */
function baseInput(overrides: Partial<ReuseEligibilityInput> = {}): ReuseEligibilityInput {
  return {
    requiredDocumentType: 'trade_licence',
    candidateDocumentType: 'trade_licence',
    candidateVerified: true,
    sameProject: true,
    validForPurpose: { valid: true },
    validForJurisdiction: { valid: true },
    reusability: 'reusable',
    conditions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The decision sequence, exactly in order — first failure wins.
// ---------------------------------------------------------------------------

test('eligible candidate passes the full sequence and lists passing conditions', () => {
  const r = evaluateReuseEligibility(baseInput({
    conditions: [
      { condition: 'valid for 1 year', passed: true, detail: 'valid until 2027-01-01' },
      { condition: 'same premises', passed: true, detail: 'same-project reuse (Decision #7)' },
    ],
  }));
  assert.equal(r.eligible, true);
  assert.equal(r.status, 'eligible_for_conditional_reuse');
  assert.deepEqual(r.passedConditions, ['valid until 2027-01-01', 'same-project reuse (Decision #7)']);
});

test('step 1: wrong document type → ineligible with the specific types named', () => {
  const r = evaluateReuseEligibility(baseInput({
    requiredDocumentType: 'trade_licence',
    candidateDocumentType: 'fire_noc',
  }));
  assert.equal(r.eligible, false);
  assert.equal(r.status, 'ineligible');
  assert.match(r.reason, /wrong document type/);
  assert.match(r.reason, /trade_licence/);
  assert.match(r.reason, /fire_noc/);
});

test('step 1: unclassified document type is a wrong-type rejection, not a pass', () => {
  const r = evaluateReuseEligibility(baseInput({ candidateDocumentType: null }));
  assert.equal(r.eligible, false);
  assert.match(r.reason, /wrong document type/);
});

test('step 2: not yet verified → ineligible, reason says so', () => {
  const r = evaluateReuseEligibility(baseInput({ candidateVerified: false }));
  assert.equal(r.eligible, false);
  assert.match(r.reason, /not yet verified/);
});

test('step 3: different applicant/premises → ineligible', () => {
  const r = evaluateReuseEligibility(baseInput({ sameProject: false }));
  assert.equal(r.eligible, false);
  assert.match(r.reason, /different applicant\/premises/);
});

test('step 4: purpose mismatch names the mismatch in the reason', () => {
  const r = evaluateReuseEligibility(baseInput({
    validForPurpose: { valid: false, mismatchReason: "the document states type 'fire_noc' but 'trade_licence' is required" },
  }));
  assert.equal(r.eligible, false);
  assert.match(r.reason, /not valid for this purpose/);
  assert.match(r.reason, /fire_noc/);
});

test('step 4: jurisdiction mismatch names the mismatch in the reason', () => {
  const r = evaluateReuseEligibility(baseInput({
    validForJurisdiction: { valid: false, mismatchReason: "the document states jurisdiction 'Karnataka' but the approval's authority jurisdiction is 'Maharashtra'" },
  }));
  assert.equal(r.eligible, false);
  assert.match(r.reason, /not valid for this jurisdiction/);
  assert.match(r.reason, /Karnataka/);
});

test('step 5: failed approval-specific condition → ineligible, reason names WHICH condition failed', () => {
  const r = evaluateReuseEligibility(baseInput({
    conditions: [
      { condition: 'valid until 2027', passed: true, detail: 'ok' },
      { condition: 'same premises', passed: false, detail: 'condition "same premises" cannot be machine-verified' },
    ],
  }));
  assert.equal(r.eligible, false);
  assert.match(r.reason, /reuse condition not satisfied/);
  assert.match(r.reason, /same premises/);
});

// ---------------------------------------------------------------------------
// Check ORDER: the first failing step wins, not the most severe.
// ---------------------------------------------------------------------------

test('order: an unverified candidate reports step 2, not a later step-5 failure', () => {
  const r = evaluateReuseEligibility(baseInput({
    candidateVerified: false,
    conditions: [{ condition: 'x', passed: false, detail: 'condition "x" failed' }],
  }));
  assert.match(r.reason, /not yet verified/);
  assert.doesNotMatch(r.reason, /reuse condition/);
});

test('order: wrong type wins over not-verified', () => {
  const r = evaluateReuseEligibility(baseInput({ candidateDocumentType: 'fire_noc', candidateVerified: false }));
  assert.match(r.reason, /wrong document type/);
});

test('unknown validity is NOT a mismatch (never collapsed into a false "No")', () => {
  const r = evaluateReuseEligibility(baseInput({
    validForPurpose: { valid: null, unknownCaveat: 'purpose could not be machine-verified' },
    validForJurisdiction: { valid: null, unknownCaveat: 'jurisdiction could not be verified' },
  }));
  assert.equal(r.eligible, true);
  assert.deepEqual(r.passedConditions, [
    'purpose could not be machine-verified',
    'jurisdiction could not be verified',
  ]);
});

// ---------------------------------------------------------------------------
// fresh_required short-circuit — wins REGARDLESS of every other check.
// ---------------------------------------------------------------------------

test('fresh_required short-circuits even when every other check would pass', () => {
  const r = evaluateReuseEligibility(baseInput({
    reusability: 'fresh_required',
    conditions: [{ condition: 'valid forever', passed: true, detail: 'ok' }],
  }));
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'this document type must be obtained fresh for every use');
});

test('fresh_required wins even when the document type check would ALSO fail', () => {
  const r = evaluateReuseEligibility(baseInput({
    reusability: 'fresh_required',
    candidateDocumentType: 'fire_noc',
  }));
  assert.equal(r.eligible, false);
  assert.equal(r.reason, 'this document type must be obtained fresh for every use');
});

test('unknown reusability does NOT short-circuit — it follows the normal sequence', () => {
  const r = evaluateReuseEligibility(baseInput({ reusability: 'unknown' }));
  assert.equal(r.eligible, true);
});

// ---------------------------------------------------------------------------
// evaluateReuseCondition — fail-safe condition evaluation.
// ---------------------------------------------------------------------------

const condCtx = {
  expiryDate: '2027-06-30',
  today: new Date('2026-09-13T00:00:00Z'),
  jurisdictionMatches: true as boolean | null,
};

test('expiry condition: valid future expiry passes', () => {
  const r = evaluateReuseCondition('reuse valid only while document is not expired', condCtx);
  assert.equal(r.passed, true);
  assert.match(r.detail, /2027-06-30/);
});

test('expiry condition: expired document fails and names the expiry date', () => {
  const r = evaluateReuseCondition('reuse valid only while document is not expired', {
    ...condCtx,
    expiryDate: '2026-01-01',
  });
  assert.equal(r.passed, false);
  assert.match(r.detail, /expired on 2026-01-01/);
});

test('expiry condition: unknown expiry NEVER passes (never guessed)', () => {
  const r = evaluateReuseCondition('reuse valid only while document is not expired', {
    ...condCtx,
    expiryDate: null,
  });
  assert.equal(r.passed, false);
  assert.match(r.detail, /expiry date is unknown/);
});

test('premises/applicant condition passes via the same-project guarantee (Decision #7)', () => {
  const r = evaluateReuseCondition('document must cover the same premises', condCtx);
  assert.equal(r.passed, true);
  assert.match(r.detail, /same-project/);
});

test('jurisdiction condition: mismatch fails; unknown fails safe', () => {
  const mismatch = evaluateReuseCondition('jurisdiction must match', { ...condCtx, jurisdictionMatches: false });
  assert.equal(mismatch.passed, false);
  assert.match(mismatch.detail, /jurisdiction/);

  const unknown = evaluateReuseCondition('jurisdiction must match', { ...condCtx, jurisdictionMatches: null });
  assert.equal(unknown.passed, false);
  assert.match(unknown.detail, /unknown/);

  const ok = evaluateReuseCondition('jurisdiction must match', condCtx);
  assert.equal(ok.passed, true);
});

test('unrecognizable condition text is fail-safe: never a silent pass', () => {
  const r = evaluateReuseCondition('signed in blue ink by the deputy commissioner', condCtx);
  assert.equal(r.passed, false);
  assert.match(r.detail, /cannot be machine-verified/);
});

test('every rejection across the module carries a NON-EMPTY reason string', () => {
  const cases: ReuseEligibilityInput[] = [
    baseInput({ reusability: 'fresh_required' }),
    baseInput({ candidateDocumentType: 'other' }),
    baseInput({ candidateDocumentType: null }),
    baseInput({ candidateVerified: false }),
    baseInput({ sameProject: false }),
    baseInput({ validForPurpose: { valid: false } }),
    baseInput({ validForJurisdiction: { valid: false } }),
    baseInput({ conditions: [{ condition: 'c', passed: false, detail: 'failed' }] }),
  ];
  for (const input of cases) {
    const r = evaluateReuseEligibility(input);
    assert.equal(r.eligible, false, `expected ineligible for ${JSON.stringify(input)}`);
    assert.equal(typeof r.reason, 'string');
    assert.ok(r.reason.length > 0, 'reason must be non-empty');
  }
});

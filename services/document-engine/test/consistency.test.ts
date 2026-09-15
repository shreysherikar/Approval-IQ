import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CONSISTENCY_OUTCOMES,
  DEFAULT_AREA_TOLERANCE_PCT,
  DOCUMENT_VS_DOCUMENT_CHECKS,
  PROFILE_VS_DOCUMENT_CHECKS,
  compare,
  parseAreaToSqft,
  runCheck,
  type ComparisonSide,
} from '../src/index.ts';

function known(value: string | number): ComparisonSide {
  return { status: 'known', value };
}
const unknownSide: ComparisonSide = { status: 'unknown' };
const missingSide: ComparisonSide = { status: 'missing' };
const notVerifiedSide: ComparisonSide = { status: 'not_verified' };

test('all six outcomes are distinct and present', () => {
  assert.equal(CONSISTENCY_OUTCOMES.length, 6);
  assert.deepEqual(
    [...CONSISTENCY_OUTCOMES].sort(),
    ['match', 'mismatch', 'missing', 'not_applicable', 'not_verified', 'unknown'].sort(),
  );
});

test('match and mismatch for exact_string', () => {
  assert.equal(compare(known('Maharashtra'), known('maharashtra '), 'exact_string'), 'match');
  assert.equal(compare(known('Maharashtra'), known('Karnataka'), 'exact_string'), 'mismatch');
});

test('unknown NEVER collapses into mismatch (separate code path)', () => {
  assert.equal(compare(unknownSide, known('5000'), 'numeric_tolerance'), 'unknown');
  assert.equal(compare(known(5000), unknownSide, 'exact_string'), 'unknown');
  assert.equal(compare(unknownSide, unknownSide, 'exact_string'), 'unknown');
  // And unparseable values are unknown, not mismatch:
  assert.equal(compare(known('n/a'), known(5000), 'numeric_tolerance'), 'unknown');
});

test('missing is its own outcome, distinct from unknown and mismatch', () => {
  assert.equal(compare(missingSide, known(5000), 'numeric_tolerance'), 'missing');
  assert.equal(compare(known('x'), missingSide, 'exact_string'), 'missing');
});

test('not_verified wins over everything (no silent pass-through)', () => {
  assert.equal(compare(notVerifiedSide, known(5000), 'numeric_tolerance'), 'not_verified');
  assert.equal(compare(known(5000), notVerifiedSide, 'exact_string'), 'not_verified');
  assert.equal(compare(notVerifiedSide, unknownSide, 'exact_string'), 'not_verified');
});

test('numeric tolerance boundary: within 1% matches, beyond mismatches', () => {
  assert.equal(compare(known(5000), known(5040), 'numeric_tolerance', { tolerancePct: DEFAULT_AREA_TOLERANCE_PCT }), 'match');
  assert.equal(compare(known(5000), known(5051), 'numeric_tolerance', { tolerancePct: DEFAULT_AREA_TOLERANCE_PCT }), 'mismatch');
  assert.equal(compare(known(6000), known(5000), 'numeric_tolerance', { tolerancePct: DEFAULT_AREA_TOLERANCE_PCT }), 'mismatch');
});

test('contains_string for premises', () => {
  assert.equal(compare(known('Pune'), known('Plot 12, Pune, Maharashtra'), 'contains_string'), 'match');
  assert.equal(compare(known('Nagpur'), known('Plot 12, Pune, Maharashtra'), 'contains_string'), 'mismatch');
});

test('parseAreaToSqft unit conversions and unknowns', () => {
  assert.equal(parseAreaToSqft('5000', 'sqft'), 5000);
  assert.equal(parseAreaToSqft(5000), 5000);
  assert.equal(parseAreaToSqft('500', 'sqm'), 500 * 10.7639);
  assert.equal(parseAreaToSqft('100', 'sq yd'), 900);
  assert.equal(parseAreaToSqft('2', 'acres'), 87_120);
  assert.equal(parseAreaToSqft('unknown', 'sqft'), null);
  assert.equal(parseAreaToSqft('5000', 'bigha'), null);
});

const areaCheck = PROFILE_VS_DOCUMENT_CHECKS.find((c) => c.checkId === 'area')!;

test('profile-vs-document area: mismatch beyond tolerance', () => {
  const r = runCheck(areaCheck, {
    checkType: 'profile_vs_document',
    sideA: known(6000),
    sideB: known('5000'),
    documentTypeB: 'trade_licence',
  });
  assert.equal(r.outcome, 'mismatch');
});

test('profile-vs-document area: match within tolerance', () => {
  const r = runCheck(areaCheck, {
    checkType: 'profile_vs_document',
    sideA: known(5020),
    sideB: known('5000'),
    documentTypeB: 'trade_licence',
  });
  assert.equal(r.outcome, 'match');
});

test('profile-vs-document area: unknown side stays unknown, not mismatch', () => {
  const r = runCheck(areaCheck, {
    checkType: 'profile_vs_document',
    sideA: known(6000),
    sideB: unknownSide,
    documentTypeB: 'trade_licence',
  });
  assert.equal(r.outcome, 'unknown');
});

test('not_applicable only when documentType is known and out of scope', () => {
  const r = runCheck(areaCheck, {
    checkType: 'profile_vs_document',
    sideA: known(6000),
    sideB: known('5000'),
    documentTypeB: 'photo_id',
  });
  assert.equal(r.outcome, 'not_applicable');
  // Unknown documentType does NOT silently drop the check:
  const r2 = runCheck(areaCheck, {
    checkType: 'profile_vs_document',
    sideA: known(6000),
    sideB: known('5000'),
    documentTypeB: 'unknown',
  });
  assert.equal(r2.outcome, 'mismatch');
});

test('document-vs-document reuses the same comparator with different pairs', () => {
  const numCheck = DOCUMENT_VS_DOCUMENT_CHECKS.find((c) => c.checkId === 'document_number')!;
  assert.equal(
    runCheck(numCheck, { checkType: 'document_vs_document', sideA: known('TL-1'), sideB: known('TL-1'), documentTypeA: 'trade_licence', documentTypeB: 'trade_licence' }).outcome,
    'match',
  );
  assert.equal(
    runCheck(numCheck, { checkType: 'document_vs_document', sideA: known('TL-1'), sideB: known('TL-2'), documentTypeA: 'trade_licence', documentTypeB: 'trade_licence' }).outcome,
    'mismatch',
  );
  const expiry = DOCUMENT_VS_DOCUMENT_CHECKS.find((c) => c.checkId === 'validity_expiry')!;
  assert.equal(
    runCheck(expiry, { checkType: 'document_vs_document', sideA: unknownSide, sideB: known('2026-01-01'), documentTypeA: 'trade_licence', documentTypeB: 'trade_licence' }).outcome,
    'unknown',
  );
});

test('no extraction on a side yields not_verified through runCheck too', () => {
  const r = runCheck(areaCheck, {
    checkType: 'profile_vs_document',
    sideA: known(6000),
    sideB: notVerifiedSide,
    documentTypeB: 'trade_licence',
  });
  assert.equal(r.outcome, 'not_verified');
});

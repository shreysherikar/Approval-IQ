/**
 * Regression tests for the Phase 9 clarification state machine.
 *
 * The machine is the ONLY authority on what an applicant/officer may do next, so
 * it is tested exhaustively: every (status × action) pair must either transition
 * to a specific status or throw a typed error. There is deliberately no "silent
 * no-op" outcome — that is the failure mode that would let a resolved thread be
 * quietly reopened or a cancelled one be answered.
 *
 * Run: `pnpm --filter api test:unit` (tsx --test).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CLARIFICATION_ACTIONS,
  CLARIFICATION_STATUSES,
  InvalidClarificationTransitionError,
  awaitingParty,
  canApply,
  isClarificationStatus,
  isOpen,
  isTerminal,
  legalActions,
  nextStatus,
  type ClarificationAction,
  type ClarificationStatus,
} from '../src/clarifications/clarification-state';

const LEGAL: Record<ClarificationStatus, Partial<Record<ClarificationAction, ClarificationStatus>>> = {
  requested: {
    applicant_response: 'responded',
    officer_follow_up: 'requested',
    officer_resolve: 'resolved',
    officer_cancel: 'cancelled',
  },
  responded: {
    applicant_response: 'responded',
    officer_follow_up: 'requested',
    officer_resolve: 'resolved',
    officer_cancel: 'cancelled',
  },
  resolved: {},
  cancelled: {},
};

test('every status × action is either a defined transition or an explicit rejection', () => {
  for (const status of CLARIFICATION_STATUSES) {
    for (const action of CLARIFICATION_ACTIONS) {
      const expected = LEGAL[status][action];
      if (expected === undefined) {
        assert.equal(canApply(status, action), false, `${status} + ${action} must not be allowed`);
        assert.throws(
          () => nextStatus(status, action),
          (err: unknown) =>
            err instanceof InvalidClarificationTransitionError &&
            err.code === 'invalid_clarification_transition' &&
            err.from === status &&
            err.action === action,
          `${status} + ${action} must throw rather than silently no-op`,
        );
      } else {
        assert.equal(canApply(status, action), true, `${status} + ${action} must be allowed`);
        assert.equal(nextStatus(status, action), expected, `${status} + ${action} -> ${expected}`);
      }
    }
  }
});

test('the happy path is request -> respond -> resolve', () => {
  const requested = nextStatus('requested', 'applicant_response');
  assert.equal(requested, 'responded');
  assert.equal(awaitingParty(requested), 'officer');
  assert.equal(nextStatus(requested, 'officer_resolve'), 'resolved');
  assert.equal(awaitingParty('resolved'), null);
});

test('a follow-up sends the thread back to the applicant', () => {
  assert.equal(nextStatus('responded', 'officer_follow_up'), 'requested');
  // The applicant may answer again after a follow-up.
  assert.equal(nextStatus('requested', 'applicant_response'), 'responded');
  // An officer may also follow up before the applicant ever answers.
  assert.equal(nextStatus('requested', 'officer_follow_up'), 'requested');
});

test('resolved and cancelled are terminal — nothing reopens them', () => {
  for (const status of ['resolved', 'cancelled'] as const) {
    assert.equal(isTerminal(status), true);
    assert.equal(legalActions(status).length, 0);
    for (const action of CLARIFICATION_ACTIONS) {
      assert.throws(() => nextStatus(status, action));
    }
  }
  assert.equal(isOpen('resolved'), false);
  assert.equal(isOpen('cancelled'), false);
});

test('open statuses are exactly the two waiting states', () => {
  assert.equal(isOpen('requested'), true);
  assert.equal(isOpen('responded'), true);
  assert.equal(isOpen('resolved'), false);
  assert.equal(isOpen('cancelled'), false);
});

test('awaitingParty names the side that owes the next move', () => {
  assert.equal(awaitingParty('requested'), 'applicant');
  assert.equal(awaitingParty('responded'), 'officer');
  assert.equal(awaitingParty('resolved'), null);
  assert.equal(awaitingParty('cancelled'), null);
});

test('legalActions agrees exactly with canApply, in declaration order', () => {
  for (const status of CLARIFICATION_STATUSES) {
    const actions = legalActions(status);
    for (const action of CLARIFICATION_ACTIONS) {
      assert.equal(
        actions.includes(action),
        canApply(status, action),
        `${status}: legalActions must agree with canApply for ${action}`,
      );
    }
    // Declaration order, not object-key order.
    const expectedOrder = CLARIFICATION_ACTIONS.filter((a) => TRANSITION_ORDER.includes(`${status}:${a}`));
    assert.deepEqual(actions, expectedOrder, `${status}: legalActions order`);
  }
});

/**
 * Independent restatement of the intended matrix (status:action) so the ordering
 * assertion above cannot be satisfied by mirroring a bug from the module.
 */
const TRANSITION_ORDER = [
  'requested:applicant_response',
  'requested:officer_follow_up',
  'requested:officer_resolve',
  'requested:officer_cancel',
  'responded:applicant_response',
  'responded:officer_follow_up',
  'responded:officer_resolve',
  'responded:officer_cancel',
];

test('the rejection error names the status, the action and what IS allowed', () => {
  assert.throws(
    () => nextStatus('resolved', 'applicant_response'),
    (error: unknown) => {
      assert.ok(error instanceof InvalidClarificationTransitionError);
      assert.deepEqual(error.allowedActions, []);
      assert.match(error.message, /terminal/);
      return true;
    },
  );
  // Resolving straight from `requested` IS allowed (a waiver of the answer).
  assert.equal(nextStatus('requested', 'officer_resolve'), 'resolved');
});

test('isClarificationStatus rejects anything outside the enum', () => {
  for (const status of CLARIFICATION_STATUSES) {
    assert.equal(isClarificationStatus(status), true);
  }
  assert.equal(isClarificationStatus('open'), false);
  assert.equal(isClarificationStatus('RESOLVED'), false);
  assert.equal(isClarificationStatus(undefined), false);
  assert.equal(isClarificationStatus(42), false);
});
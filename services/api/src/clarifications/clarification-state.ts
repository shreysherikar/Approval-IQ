/**
 * Phase 9 clarification state machine — PURE, deterministic, dependency-free.
 *
 * The clarification lifecycle is the only thing that decides what an applicant
 * or officer may do next, so it is isolated here (like the approval engine's
 * graph/condition modules) instead of being re-implemented as scattered `if`
 * statements in the API and UI.
 *
 * Lifecycle:
 *
 *   requested  ⇄  responded  -->  resolved      (terminal)
 *       |            |
 *       +------------+--------->  cancelled     (terminal)
 *
 * - `requested`   → the officer has asked and the ball is with the APPLICANT.
 * - `responded`   → the applicant answered (possibly with evidence documents)
 *                   and the ball is with the OFFICER.
 * - officer_follow_up sends a `responded` request BACK to `requested`: the
 *   officer asked something else, so the applicant owes another answer. It is
 *   deliberately NOT a new clarification row — the thread stays one thread.
 * - `resolved` / `cancelled` are terminal: no action may ever move them again,
 *   so history can never be rewritten after the loop is closed.
 *
 * The machine is exhaustive over the action enum: an action that is not listed
 * for the current status is REJECTED rather than silently ignored, so an
 * invalid transition surfaces as a 409 instead of a corrupted status.
 */

export const CLARIFICATION_STATUSES = ['requested', 'responded', 'resolved', 'cancelled'] as const;

export type ClarificationStatus = (typeof CLARIFICATION_STATUSES)[number];

export const CLARIFICATION_ACTIONS = [
  'applicant_response',
  'officer_follow_up',
  'officer_resolve',
  'officer_cancel',
] as const;

export type ClarificationAction = (typeof CLARIFICATION_ACTIONS)[number];

/** Who is expected to act next, or null when the loop is closed. */
export type AwaitingParty = 'applicant' | 'officer' | null;

const TRANSITIONS: Readonly<
  Record<ClarificationStatus, Partial<Record<ClarificationAction, ClarificationStatus>>>
> = {
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

export const TERMINAL_STATUSES: ReadonlySet<ClarificationStatus> = new Set<ClarificationStatus>([
  'resolved',
  'cancelled',
]);

/** Statuses that still need somebody: the applicant inbox / officer attention list. */
export const OPEN_STATUSES: ReadonlySet<ClarificationStatus> = new Set<ClarificationStatus>([
  'requested',
  'responded',
]);

export function isClarificationStatus(value: unknown): value is ClarificationStatus {
  return (
    typeof value === 'string' && (CLARIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isOpen(status: ClarificationStatus): boolean {
  return OPEN_STATUSES.has(status);
}

export function isTerminal(status: ClarificationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canApply(status: ClarificationStatus, action: ClarificationAction): boolean {
  return TRANSITIONS[status][action] !== undefined;
}

/**
 * Raised when an action is not legal for the current status. Carries a pinned
 * domain error code (honored by AllExceptionsFilter) so callers can assert on a
 * stable machine-readable code, not on message text.
 */
export class InvalidClarificationTransitionError extends Error {
  readonly code = 'invalid_clarification_transition';
  readonly from: ClarificationStatus;
  readonly action: ClarificationAction;
  readonly allowedActions: ClarificationAction[];

  constructor(status: ClarificationStatus, action: ClarificationAction) {
    const allowed = legalActions(status);
    super(
      `Clarification in status '${status}' cannot accept action '${action}'` +
        (allowed.length > 0 ? ` (allowed: ${allowed.join(', ')})` : ' (status is terminal)'),
    );
    this.name = 'InvalidClarificationTransitionError';
    this.from = status;
    this.action = action;
    this.allowedActions = allowed;
  }
}

/** Every action legal for `status`, in declaration order. */
export function legalActions(status: ClarificationStatus): ClarificationAction[] {
  const map = TRANSITIONS[status];
  return CLARIFICATION_ACTIONS.filter((a) => map[a] !== undefined);
}

/**
 * The single transition function. Throws (never silently no-ops) when the
 * action is illegal, so callers must handle the rejection explicitly.
 */
export function nextStatus(
  status: ClarificationStatus,
  action: ClarificationAction,
): ClarificationStatus {
  const next = TRANSITIONS[status][action];
  if (next === undefined) {
    throw new InvalidClarificationTransitionError(status, action);
  }
  return next;
}

export function awaitingParty(status: ClarificationStatus): AwaitingParty {
  if (status === 'requested') return 'applicant';
  if (status === 'responded') return 'officer';
  return null;
}
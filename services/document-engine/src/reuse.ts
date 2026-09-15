/**
 * Phase 7 reuse eligibility — the blueprint's own decision sequence
 * (Section 9.2) as a PURE function: no database, no HTTP, no framework.
 *
 * The sequence is evaluated EXACTLY in order; the first failing check wins and
 * its reason string is returned. Every rejection carries a SPECIFIC reason —
 * this module never returns a bare boolean.
 *
 * `fresh_required` short-circuits BEFORE the numbered sequence: no matter how
 * well every other check would have passed, a document type marked
 * `fresh_required` (Phase 1's DocumentReusability enum) is NEVER reusable.
 */
export type DocumentReusability = 'reusable' | 'conditional' | 'fresh_required' | 'unknown';

/** One approval-specific reuse condition and whether it passed. */
export interface ReuseConditionOutcome {
  /** The condition as written on the DocumentDefinition's reuseConditions. */
  condition: string;
  passed: boolean;
  /** Human-readable detail (why it passed / why it failed). */
  detail: string;
}

/** A validity side-check: true = valid, false = mismatch, null = unknown. */
export interface ValidityCheck {
  valid: boolean | null;
  /** Required when valid === false; names the specific mismatch. */
  mismatchReason?: string;
  /** Optional caveat recorded when valid === null (could not verify). */
  unknownCaveat?: string;
}

export interface ReuseEligibilityInput {
  /** What the approval requires (DocumentDefinition.documentType), null when unclassified. */
  requiredDocumentType: string | null;
  /** What the candidate document is (classification or extracted documentType). */
  candidateDocumentType: string | null;
  /** DocumentVersion.state === 'verified'. */
  candidateVerified: boolean;
  /** Decision #7: same-project reuse only — the proxy for same applicant/premises. */
  sameProject: boolean;
  validForPurpose: ValidityCheck;
  validForJurisdiction: ValidityCheck;
  /** Phase 1's DocumentReusability enum value on the DocumentDefinition. */
  reusability: DocumentReusability;
  /** Evaluated approval-specific reuse conditions (see evaluateReuseCondition). */
  conditions: ReuseConditionOutcome[];
}

export type ReuseEligibility =
  | {
      eligible: true;
      status: 'eligible_for_conditional_reuse';
      reason: 'Eligible for conditional reuse.';
      /** The conditions that passed, listed explicitly. */
      passedConditions: string[];
    }
  | {
      eligible: false;
      status: 'ineligible';
      /** A SPECIFIC reason string — never a bare boolean. */
      reason: string;
    };

const ineligible = (reason: string): ReuseEligibility => ({ eligible: false, status: 'ineligible', reason });

/**
 * Evaluates ONE reuse-condition string from a DocumentDefinition's
 * reuseConditions field against the candidate's context. Conditions are
 * fail-safe: a condition that cannot be machine-verified NEVER silently
 * passes — it fails with a reason saying so.
 */
export function evaluateReuseCondition(
  condition: string,
  context: {
    /** Extracted expiryDate — null means explicit unknown/absent. */
    expiryDate: string | null;
    today: Date;
    /** Jurisdiction compare result: true = match, false = mismatch, null = unknown. */
    jurisdictionMatches: boolean | null;
  },
): ReuseConditionOutcome {
  const text = condition.trim();
  if (!text) return { condition, passed: true, detail: 'empty condition text — nothing to enforce' };
  const lower = text.toLowerCase();

  // Expiry / validity conditions.
  if (/expir|valid until|valid till|valid for|valid up|validity/.test(lower)) {
    if (context.expiryDate === null) {
      return {
        condition: text,
        passed: false,
        detail: `condition "${text}" cannot be confirmed: the document's expiry date is unknown (never guessed)`,
      };
    }
    const expiry = new Date(context.expiryDate);
    if (Number.isNaN(expiry.getTime())) {
      return { condition: text, passed: false, detail: `condition "${text}" cannot be confirmed: expiry date "${context.expiryDate}" is unparseable` };
    }
    if (expiry.getTime() < context.today.getTime()) {
      return { condition: text, passed: false, detail: `condition "${text}" failed: the document expired on ${context.expiryDate}` };
    }
    return { condition: text, passed: true, detail: `condition "${text}" passed: document is valid until ${context.expiryDate}` };
  }

  // Same-premises / same-applicant conditions — guaranteed by Decision #7's
  // same-project reuse scope, which is enforced upstream of this evaluation.
  if (/premises|applicant|same address|same project|same location/.test(lower)) {
    return { condition: text, passed: true, detail: `condition "${text}" passed: reuse is same-project only (Decision #7), so applicant and premises are identical` };
  }

  // Jurisdiction conditions.
  if (/jurisdiction|state|region/.test(lower)) {
    if (context.jurisdictionMatches === false) {
      return { condition: text, passed: false, detail: `condition "${text}" failed: the document's jurisdiction does not match the approval's jurisdiction` };
    }
    if (context.jurisdictionMatches === null) {
      return { condition: text, passed: false, detail: `condition "${text}" cannot be confirmed: the document's jurisdiction is unknown (never guessed)` };
    }
    return { condition: text, passed: true, detail: `condition "${text}" passed: document jurisdiction matches the approval's jurisdiction` };
  }

  // Unknown condition shape: fail-safe, never a silent pass.
  return {
    condition: text,
    passed: false,
    detail: `condition "${text}" cannot be machine-verified; reviewer confirmation is required before reuse`,
  };
}

/**
 * The blueprint's reuse decision sequence, exactly in order.
 * Step 0 (fresh_required) short-circuits before everything else.
 */
export function evaluateReuseEligibility(input: ReuseEligibilityInput): ReuseEligibility {
  // Step 0 — fresh_required short-circuit. Checked FIRST and unconditionally:
  // "regardless of how well every other check would have passed."
  if (input.reusability === 'fresh_required') {
    return ineligible('this document type must be obtained fresh for every use');
  }

  // Step 1 — Correct document type?
  if (!input.requiredDocumentType || !input.candidateDocumentType) {
    return ineligible('wrong document type: the required or candidate document type is unclassified');
  }
  if (input.requiredDocumentType !== input.candidateDocumentType) {
    return ineligible(`wrong document type: required '${input.requiredDocumentType}' but candidate is '${input.candidateDocumentType}'`);
  }

  // Step 2 — Verified?
  if (!input.candidateVerified) {
    return ineligible('not yet verified: the document version has not completed manual verification');
  }

  // Step 3 — Same applicant and premises (same project per Decision #7)?
  if (!input.sameProject) {
    return ineligible('different applicant/premises: the candidate document belongs to a different project');
  }

  // Step 4 — Valid for purpose and jurisdiction? The reason names the mismatch.
  if (input.validForPurpose.valid === false) {
    return ineligible(`not valid for this purpose: ${input.validForPurpose.mismatchReason ?? 'purpose check failed'}`);
  }
  if (input.validForJurisdiction.valid === false) {
    return ineligible(`not valid for this jurisdiction: ${input.validForJurisdiction.mismatchReason ?? 'jurisdiction check failed'}`);
  }

  // Step 5 — All approval-specific reuse conditions pass?
  const failed = input.conditions.filter((c) => !c.passed);
  if (failed.length > 0) {
    return ineligible(`reuse condition not satisfied: ${failed.map((c) => c.detail).join('; ')}`);
  }

  // Eligible — list the passing conditions explicitly.
  const passedConditions = input.conditions.filter((c) => c.passed).map((c) => c.detail);
  if (input.validForPurpose.valid === null && input.validForPurpose.unknownCaveat) {
    passedConditions.push(input.validForPurpose.unknownCaveat);
  }
  if (input.validForJurisdiction.valid === null && input.validForJurisdiction.unknownCaveat) {
    passedConditions.push(input.validForJurisdiction.unknownCaveat);
  }
  return {
    eligible: true,
    status: 'eligible_for_conditional_reuse',
    reason: 'Eligible for conditional reuse.',
    passedConditions,
  };
}

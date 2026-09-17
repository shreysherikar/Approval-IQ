/**
 * @approvaliq/contracts — shared API DTO types + Zod schemas.
 */

import { z } from 'zod';

export type UserRole = 'applicant' | 'officer' | 'admin';

export interface RegisterRequest {
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisteredUser {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Evaluations contract.
// The API accepts a BusinessProfile payload validated by this shared Zod
// schema. Each field carries `{ status: 'known', value }` or
// `{ status: 'unknown' }` so the engine can distinguish "we know the answer"
// from "we haven't asked yet" (never null/0/empty-string for unknown).
// ---------------------------------------------------------------------------

function knownField<T extends z.ZodTypeAny>(value: T): z.ZodTypeAny {
  return z.union([
    z.object({ status: z.literal('known'), value }),
    z.object({ status: z.literal('unknown') }),
  ]);
}

export const businessProfileSchema = z.object({
  industry: knownField(z.string()),
  state: knownField(z.string()),
  district: knownField(z.string()),
  landStatus: knownField(z.enum(['owned', 'leased', 'not_yet_acquired'])),
  areaSqft: knownField(z.number()),
  areaType: knownField(z.enum(['plot', 'built_up', 'leased', 'operational', 'unknown'])),
  investmentAmountInr: knownField(z.number()),
  investmentDefinition: knownField(z.enum(['total_project_cost'])),
  employeeCount: knownField(z.number()),
  employeeCountDefinition: knownField(z.enum(['full_operational_capacity'])),
  activityType: knownField(z.string()),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export const createEvaluationSchema = z.object({
  /** Business profile to evaluate. Validated by businessProfileSchema. */
  profile: businessProfileSchema,
  /**
   * Industry code used to scope the draft KnowledgeRelease lookup
   * (e.g. "brewery"). Optional — falls back to profile.industry when known.
   */
  industryCode: z.string().min(1).optional(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;

// ---------------------------------------------------------------------------
// BusinessProfile drafts (Phase 3). A draft accepts ANY SUBSET of the
// BusinessProfile fields because the intake form is filled incrementally.
// Each field that IS provided must still match the shared schema's
// types/units: non-empty strings, non-negative numbers (areaSqft positive),
// and exactly the shared enum values. Absent fields mean "not yet asked" —
// never null/0/empty-string.
// ---------------------------------------------------------------------------

function draftKnownField<T extends z.ZodTypeAny>(value: T): z.ZodTypeAny {
  return z.union([
    z.object({ status: z.literal('known'), value }),
    z.object({ status: z.literal('unknown') }),
  ]);
}

export const businessProfileDraftSchema = z
  .object({
    industry: draftKnownField(z.string().min(1)).optional(),
    state: draftKnownField(z.string().min(1)).optional(),
    district: draftKnownField(z.string().min(1)).optional(),
    landStatus: draftKnownField(z.enum(['owned', 'leased', 'not_yet_acquired'])).optional(),
    areaSqft: draftKnownField(z.number().positive()).optional(),
    areaType: draftKnownField(
      z.enum(['plot', 'built_up', 'leased', 'operational', 'unknown']),
    ).optional(),
    investmentAmountInr: draftKnownField(z.number().nonnegative()).optional(),
    investmentDefinition: draftKnownField(z.enum(['total_project_cost'])).optional(),
    employeeCount: draftKnownField(z.number().int().nonnegative()).optional(),
    employeeCountDefinition: draftKnownField(z.enum(['full_operational_capacity'])).optional(),
    activityType: draftKnownField(z.string().min(1)).optional(),
  })
  .strict();

export type BusinessProfileDraftInput = z.infer<typeof businessProfileDraftSchema>;

// ---------------------------------------------------------------------------
// Quick Overview Contract (AI-Generated Executive Project Synthesis)
// ---------------------------------------------------------------------------

export interface QuickOverviewHighlight {
  label: string;
  value: string;
  badge?: string;
  tone?: 'positive' | 'warning' | 'neutral' | 'urgent';
}

export interface QuickOverviewNextStep {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionRoute: string;
  priority: 'high' | 'medium' | 'low';
}

export interface QuickOverviewMissingField {
  field: string;
  label: string;
  impact: string;
}

export interface QuickOverviewDocumentStatus {
  totalRequired: number;
  uploadedCount: number;
  verifiedCount: number;
  missingCount: number;
  missingList: string[];
}

export interface QuickOverviewResponse {
  isReady: boolean;
  projectId: string;
  projectName: string;
  summary: string;
  businessContext: {
    name: string;
    industry: string;
    location: string;
    investmentFormatted: string;
    workforceFormatted: string;
    status: string;
  };
  keyHighlights: QuickOverviewHighlight[];
  situation: string;
  whatYouNeedToDo: string;
  whatIsReady: string;
  whatIsBlocking: string;
  schemesAndIncentives: string;
  missingInformation: QuickOverviewMissingField[];
  documents: QuickOverviewDocumentStatus;
  nextSteps: QuickOverviewNextStep[];
  rtsSlaTimelineSummary?: string;
  generatedAt: string;
  isAiSynthesized: boolean;
}

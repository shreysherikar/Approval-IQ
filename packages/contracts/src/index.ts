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



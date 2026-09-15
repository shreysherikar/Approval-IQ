import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

/**
 * Request-body schemas for the Phase 9 clarification endpoints.
 *
 * Same approach as ProfilesService/EvaluationsService: the body is parsed with
 * zod and a failure becomes a 400 BAD_REQUEST whose `details` is the flattened
 * issue list — never a silently coerced value.
 */

/** One thing the officer is asking about (a profile field or a document code). */
export const clarificationRequestedFieldSchema = z.object({
  /** Machine key — a BusinessProfile field name or a DocumentDefinition code. */
  field: z.string().min(1).max(120),
  /** Human explanation of what is missing / why it is needed. */
  reason: z.string().max(500).optional(),
  /** Free-form label for UI display; defaults to `field` when absent. */
  label: z.string().max(200).optional(),
});

export type ClarificationRequestedField = z.infer<typeof clarificationRequestedFieldSchema>;

export const createClarificationSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(4000),
  requestedFields: z.array(clarificationRequestedFieldSchema).max(50).optional(),
  /** ISO-8601 due date; must be a parseable date in the future (not enforced here). */
  dueAt: z.string().datetime({ offset: true }).optional(),
});

export type CreateClarificationInput = z.infer<typeof createClarificationSchema>;

export const respondToClarificationSchema = z.object({
  message: z.string().min(1).max(4000),
  /** Document ids from THIS project's vault offered as evidence. */
  documentIds: z.array(z.string().min(1)).max(20).optional(),
});

export type RespondToClarificationInput = z.infer<typeof respondToClarificationSchema>;

export const followUpClarificationSchema = z.object({
  message: z.string().min(1).max(4000),
  requestedFields: z.array(clarificationRequestedFieldSchema).max(50).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
});

export type FollowUpClarificationInput = z.infer<typeof followUpClarificationSchema>;

export const closeClarificationSchema = z.object({
  note: z.string().max(2000).optional(),
});

export type CloseClarificationInput = z.infer<typeof closeClarificationSchema>;

/**
 * Parses a body against a schema, raising the repo-standard 400 envelope:
 * `{ error: { code: 'BAD_REQUEST', message: 'Invalid <what>', details: {...} } }`.
 */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown, what: string): z.infer<T> {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new BadRequestException({
      message: `Invalid ${what}`,
      details: parsed.error.flatten(),
    });
  }
  return parsed.data as z.infer<T>;
}
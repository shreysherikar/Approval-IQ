import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

export const GRIEVANCE_TYPES = [
  'sla_breach_delay',
  'unjustified_clarification',
  'arbitrary_rejection',
  'inspection_harassment',
  'fee_overcharge',
  'other',
] as const;

export const GRIEVANCE_TIERS = [
  'tier_1_nodal_officer',
  'tier_2_appellate_authority',
  'tier_3_rts_commission',
] as const;

export const GRIEVANCE_STATUSES = [
  'submitted',
  'under_investigation',
  'escalated',
  'redressed',
  'rejected',
  'withdrawn',
] as const;

export type GrievanceType = (typeof GRIEVANCE_TYPES)[number];
export type GrievanceTier = (typeof GRIEVANCE_TIERS)[number];
export type GrievanceStatus = (typeof GRIEVANCE_STATUSES)[number];

export const createGrievanceSchema = z.object({
  type: z.enum(GRIEVANCE_TYPES, {
    errorMap: () => ({ message: `Type must be one of: ${GRIEVANCE_TYPES.join(', ')}` }),
  }),
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(200),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000),
  approvalInstanceId: z.string().uuid().optional(),
  authorityId: z.string().uuid().optional(),
  statutorySlaDays: z.number().int().min(1).max(90).default(15),
  documentIds: z.array(z.string().uuid()).default([]),
});

export const escalateGrievanceSchema = z.object({
  remarks: z.string().trim().min(5, 'Escalation remarks must be at least 5 characters').max(2000),
  targetTier: z.enum(['tier_2_appellate_authority', 'tier_3_rts_commission']).optional(),
  documentIds: z.array(z.string().uuid()).default([]),
});

export const withdrawGrievanceSchema = z.object({
  reason: z.string().trim().min(5, 'Withdrawal reason must be at least 5 characters').max(1000),
});

export const investigateGrievanceSchema = z.object({
  remarks: z.string().trim().min(5, 'Investigation notes must be at least 5 characters').max(3000),
  hearingScheduledAt: z.string().datetime().optional(),
  assignedInvestigator: z.string().trim().max(100).optional(),
});

export const resolveGrievanceSchema = z.object({
  outcome: z.enum(['redressed', 'rejected'], {
    errorMap: () => ({ message: "Outcome must be 'redressed' or 'rejected'" }),
  }),
  resolutionSummary: z.string().trim().min(10, 'Resolution summary must be at least 10 characters').max(3000),
  rectificationAction: z.string().trim().max(2000).optional(),
  orderNumber: z.string().trim().max(100).optional(),
});

export type CreateGrievanceDto = z.infer<typeof createGrievanceSchema>;
export type EscalateGrievanceDto = z.infer<typeof escalateGrievanceSchema>;
export type WithdrawGrievanceDto = z.infer<typeof withdrawGrievanceSchema>;
export type InvestigateGrievanceDto = z.infer<typeof investigateGrievanceSchema>;
export type ResolveGrievanceDto = z.infer<typeof resolveGrievanceSchema>;

export function parseDto<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: result.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  return result.data;
}

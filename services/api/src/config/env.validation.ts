import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRY: z.string().default('1d'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./data/storage'),
  LLM_PROVIDER: z.enum(['mock', 'anthropic']).default('mock'),
  // Phase 6 Decision #6: per-field confidence threshold below which the UI flags
  // a field as needing extra attention. Provisional default until real
  // accuracy data exists — config, never a hardcoded number in an `if`.
  EXTRACTION_REVIEW_THRESHOLD: z.coerce.number().min(0).max(1).default(0.6),
  PORT: z.coerce.number().int().positive().default(3001),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates process.env at boot. Throws on missing/invalid required vars
 * so the app fails fast instead of running misconfigured.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }
  return parsed.data;
}

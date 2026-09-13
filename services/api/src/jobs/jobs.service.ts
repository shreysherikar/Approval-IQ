import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'exponential' | 'fixed';
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  backoffStrategy: 'exponential',
  baseDelayMs: 1000,
};

function parseRetryPolicy(raw: unknown): RetryPolicy {
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>;
    return {
      maxAttempts: typeof r.maxAttempts === 'number' ? r.maxAttempts : DEFAULT_RETRY_POLICY.maxAttempts,
      backoffStrategy: r.backoffStrategy === 'fixed' ? 'fixed' : 'exponential',
      baseDelayMs: typeof r.baseDelayMs === 'number' ? r.baseDelayMs : DEFAULT_RETRY_POLICY.baseDelayMs,
    };
  }
  return DEFAULT_RETRY_POLICY;
}

export function computeBackoffDelay(policy: RetryPolicy, attemptCount: number): number {
  if (policy.backoffStrategy === 'fixed') return policy.baseDelayMs;
  return policy.baseDelayMs * 2 ** Math.max(0, attemptCount - 1);
}

/**
 * Postgres-backed job queue (Phase 6, blueprint Section 20.2).
 * Polling worker claims pending jobs atomically; retries with backoff up to
 * maxAttempts, then moves to dead_letter rather than retrying forever.
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async enqueue(
    type: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
    retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
  ): Promise<Record<string, unknown>> {
    const existing = await this.prisma.job.findUnique({ where: { idempotencyKey } });
    if (existing) return this.serialize(existing as Record<string, unknown>);
    const created = await this.prisma.job.create({
      data: {
        type,
        payload: payload as never,
        payloadSchemaVersion: 1,
        idempotencyKey,
        status: 'pending',
        retryPolicy: retryPolicy as never,
        nextAttemptAt: new Date(),
      },
    });
    return this.serialize(created as Record<string, unknown>);
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    return job ? this.serialize(job as Record<string, unknown>) : null;
  }

  /**
   * Atomically claims the next eligible job. Only one worker wins the
   * conditional update, so concurrent pollers never double-run a job.
   */
  async claimNext(types?: string[]): Promise<Record<string, unknown> | null> {
    const now = new Date();
    const candidate = await this.prisma.job.findFirst({
      where: {
        status: 'pending',
        nextAttemptAt: { lte: now },
        ...(types && types.length > 0 ? { type: { in: types } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!candidate) return null;
    const claimed = await this.prisma.job.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'processing', attemptCount: { increment: 1 }, updatedAt: now },
    });
    if (claimed.count === 0) return null; // lost the race
    const fresh = await this.prisma.job.findUnique({ where: { id: candidate.id } });
    return fresh ? this.serialize(fresh as Record<string, unknown>) : null;
  }

  async complete(id: string): Promise<void> {
    await this.prisma.job.update({
      where: { id },
      data: { status: 'completed', completedAt: new Date(), errorDetails: null },
    });
  }

  /** Records a failure; retries with backoff or moves to dead_letter. */
  async fail(id: string, errorDetails: string): Promise<Record<string, unknown>> {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new Error(`Job '${id}' not found`);
    const policy = parseRetryPolicy(job.retryPolicy);
    if (job.attemptCount >= policy.maxAttempts) {
      const dead = await this.prisma.job.update({
        where: { id },
        data: { status: 'dead_letter', errorDetails, completedAt: new Date() },
      });
      this.logger.warn(`Job ${id} exhausted retries (${job.attemptCount}) → dead_letter`);
      return this.serialize(dead as Record<string, unknown>);
    }
    const delayMs = computeBackoffDelay(policy, job.attemptCount);
    const retry = await this.prisma.job.update({
      where: { id },
      data: {
        status: 'pending',
        errorDetails,
        nextAttemptAt: new Date(Date.now() + delayMs),
      },
    });
    return this.serialize(retry as Record<string, unknown>);
  }

  /**
   * Crash recovery: jobs stuck in "processing" (worker killed mid-job) are
   * re-queued as pending so a restarted worker resumes them instead of
   * leaving the document corrupted. Called once at worker boot.
   */
  async resetStuckProcessing(olderThanMs = 60_000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const res = await this.prisma.job.updateMany({
      where: { status: 'processing', updatedAt: { lt: cutoff } },
      data: { status: 'pending', errorDetails: 'Worker restarted mid-job; re-queued', nextAttemptAt: new Date() },
    });
    if (res.count > 0) this.logger.warn(`Re-queued ${res.count} stuck processing job(s) after worker restart`);
    return res.count;
  }

  private serialize(job: Record<string, unknown>): Record<string, unknown> {
    return {
      id: job.id,
      type: job.type,
      payload: job.payload,
      payloadSchemaVersion: job.payloadSchemaVersion,
      attemptCount: job.attemptCount,
      idempotencyKey: job.idempotencyKey,
      status: job.status,
      errorDetails: job.errorDetails,
      retryPolicy: job.retryPolicy,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }
}

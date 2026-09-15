import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { ExtractionHandler } from './extraction.handler';

/**
 * Polling worker process for the Postgres-backed job queue.
 * Runs inside the API process (documented choice: one deployable, no extra
 * infra — matches blueprint 20.3 "initial implementation"). Polls every
 * second, claims pending jobs atomically, runs the registered handler, then
 * marks completed / failed (retry with backoff) / dead_letter.
 * Crash recovery: on boot, stuck "processing" jobs are re-queued.
 */
@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(ExtractionHandler) private readonly extraction: ExtractionHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.WORKER_ENABLED === '0') {
      this.logger.log('Worker disabled via WORKER_ENABLED=0');
      return;
    }
    try {
      await this.jobs.resetStuckProcessing();
    } catch {
      this.logger.warn('Could not reset stuck jobs on startup (DB may be offline).');
    }
    this.timer = setInterval(() => void this.tick(), 1000);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Single poll iteration — also called directly by tests. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let job: Record<string, unknown> | null = null;
      try {
        job = await this.jobs.claimNext(['document_extraction']);
      } catch {
        // DB unreachable or busy — skip this tick
        return;
      }
      if (!job) return;
      try {
        await this.dispatch(job);
        await this.jobs.complete(job.id as string);
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        const updated = await this.jobs.fail(job.id as string, msg);
        if (updated.status === 'dead_letter' && job.type === 'document_extraction') {
          await this.extraction.onExhausted(job);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async dispatch(job: Record<string, unknown>): Promise<void> {
    if (job.type === 'document_extraction') {
      await this.extraction.handle(job);
      return;
    }
    throw new Error(`No handler for job type '${String(job.type)}'`);
  }
}

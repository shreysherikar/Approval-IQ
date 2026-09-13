import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { JobsService } from './jobs.service';
import { ExtractionHandler } from './extraction.handler';
import { WorkerService } from './worker.service';

@Module({
  imports: [StorageModule],
  providers: [JobsService, ExtractionHandler, WorkerService],
  exports: [JobsService, ExtractionHandler],
})
export class JobsModule {}

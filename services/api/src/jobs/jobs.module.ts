import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { GrievancesModule } from '../grievances/grievances.module';
import { JobsService } from './jobs.service';
import { ExtractionHandler } from './extraction.handler';
import { WorkerService } from './worker.service';

@Module({
  imports: [StorageModule, forwardRef(() => GrievancesModule)],
  providers: [JobsService, ExtractionHandler, WorkerService],
  exports: [JobsService, ExtractionHandler],
})
export class JobsModule {}

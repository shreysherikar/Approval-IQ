import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, ProjectMemberGuard],
  // Phase 9: the officer review packet lists and serves the SAME project
  // documents through the same authorized code path — no second file-serving
  // implementation, and no storageKey exposure.
  exports: [DocumentsService],
})
export class DocumentsModule {}
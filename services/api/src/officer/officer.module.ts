import { Module } from '@nestjs/common';
import { OfficerController } from './officer.controller';
import { OfficerService } from './officer.service';
import { DocumentsModule } from '../documents/documents.module';
import { RolesGuard } from '../common/guards/roles.guard';
import { OfficerGuard } from '../common/guards/officer.guard';
import { OfficerApplicationGuard } from '../common/guards/officer-application.guard';
import { OfficerClarificationGuard } from '../common/guards/officer-clarification.guard';

/**
 * Phase 9 officer surface. DocumentsModule is imported so the review packet can
 * list/download project documents through the ONE existing authorized code path
 * instead of growing a second file server.
 */
@Module({
  imports: [DocumentsModule],
  controllers: [OfficerController],
  providers: [
    OfficerService,
    OfficerGuard,
    OfficerApplicationGuard,
    OfficerClarificationGuard,
    RolesGuard,
  ],
})
export class OfficerModule {}
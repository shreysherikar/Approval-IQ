import { Module } from '@nestjs/common';
import { ClarificationsController } from './clarifications.controller';
import { ClarificationsService } from './clarifications.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';

/**
 * Applicant side of the Phase 9 clarification loop. ProjectMemberGuard is the
 * object-level authorization boundary (a member of :projectId), exactly as in
 * the Documents/Profiles/Roadmap modules.
 */
@Module({
  controllers: [ClarificationsController],
  providers: [ClarificationsService, ProjectMemberGuard],
  exports: [ClarificationsService],
})
export class ClarificationsModule {}
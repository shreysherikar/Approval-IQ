import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { IntelligenceController } from './intelligence.controller';
import { JobsController } from './jobs.controller';
import { IntelligenceService } from './intelligence.service';

@Module({
  imports: [JobsModule],
  controllers: [IntelligenceController, JobsController],
  providers: [IntelligenceService, ProjectMemberGuard],
})
export class IntelligenceModule {}

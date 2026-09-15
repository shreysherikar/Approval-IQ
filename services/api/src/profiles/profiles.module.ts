import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';

@Module({
  imports: [EvaluationsModule, RoadmapModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, ProjectMemberGuard],
})
export class ProfilesModule {}

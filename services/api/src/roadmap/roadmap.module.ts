import { Module } from '@nestjs/common';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';

@Module({
  controllers: [RoadmapController],
  providers: [RoadmapService, ProjectMemberGuard],
  exports: [RoadmapService],
})
export class RoadmapModule {}

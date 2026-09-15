import { Module } from '@nestjs/common';
import { ReuseController } from './reuse.controller';
import { ReuseService } from './reuse.service';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';

@Module({
  controllers: [ReuseController],
  providers: [ReuseService, ProjectMemberGuard],
})
export class ReuseModule {}

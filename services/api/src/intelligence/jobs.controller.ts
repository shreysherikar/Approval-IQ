import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { IntelligenceService } from './intelligence.service';

@ApiTags('jobs')
@Controller('projects/:projectId/jobs')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class JobsController {
  constructor(@Inject(IntelligenceService) private readonly intel: IntelligenceService) {}

  @Get(':jobId')
  job(@Param('jobId') jobId: string) {
    return this.intel.jobStatus(jobId);
  }
}

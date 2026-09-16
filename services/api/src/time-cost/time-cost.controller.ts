import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { TimeCostService } from './time-cost.service';

/**
 * Business Intelligence — Regulatory Time & Cost Prediction.
 * Project-scoped read: JwtAuthGuard (who are you?) + ProjectMemberGuard
 * (are you a member of :projectId?) — same authorization shape as the
 * roadmap and profile routes.
 */
@ApiTags('time-cost')
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class TimeCostController {
  constructor(private readonly service: TimeCostService) {}

  @Get('time-cost-prediction')
  @ApiOperation({
    summary:
      'Estimated legal-readiness time (critical path over the dependency graph) + estimated cost breakdown for the project\u2019s applicable approvals.',
  })
  predict(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.service.predict(projectId);
  }
}

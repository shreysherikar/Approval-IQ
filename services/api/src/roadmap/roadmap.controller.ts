import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { RoadmapService } from './roadmap.service';

/**
 * Phase 4 roadmap workspace (blueprint Sections 14, 18-19). Status
 * transitions are applicant-scoped workflow actions: JwtAuthGuard + object-level
 * ProjectMemberGuard, same as the Document Vault.
 */
@ApiTags('roadmap')
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class RoadmapController {
  constructor(@Inject(RoadmapService) private readonly service: RoadmapService) {}

  @Get('roadmap')
  @ApiOperation({
    summary:
      'Full approval roadmap graph for the project (nodes, edges, parallelGroups)',
  })
  getRoadmap(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.service.getRoadmap(projectId);
  }

  @Patch('approval-instances/:instanceId/status')
  @ApiOperation({
    summary:
      'Advance an approval instance\u2019s status. Only available\u2192in_progress and in_progress\u2192done are client-requestable.',
  })
  updateStatus(
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.service.updateStatus(projectId, instanceId, body);
  }

  @Get('schemes/ai-analysis')
  @ApiOperation({
    summary:
      'Get dynamic AI Profile analysis, readiness score, and strategic optimization roadmap for schemes.',
  })
  getAiSchemeAnalysis(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.service.getAiSchemeAnalysis(projectId);
  }

  @Post('schemes/ai-chat')
  @ApiOperation({
    summary:
      'Interactive AI copilot query synthesizer for government schemes and incentives.',
  })
  queryAiSchemeAdvisor(
    @Param('projectId') projectId: string,
    @Body() body: { query: string; context?: Record<string, unknown> },
  ): Promise<Record<string, unknown>> {
    return this.service.queryAiSchemeAdvisor(projectId, body);
  }

  @Patch('roadmap/batch-status')
  @ApiOperation({
    summary:
      'Atomic batch status transition for multiple parallel layer approvals in a single transaction.',
  })
  batchUpdateStatus(
    @Param('projectId') projectId: string,
    @Body() body: { instanceIds: string[]; status: 'available' | 'in_progress' | 'done' },
  ): Promise<Record<string, unknown>> {
    return this.service.batchUpdateStatus(projectId, body.instanceIds, body.status);
  }

  @Post('rules/discrepancies')
  @ApiOperation({
    summary:
      'Report a statutory rule discrepancy and generate a version-controlled Git issue / PR tracking entry.',
  })
  reportRuleDiscrepancy(
    @Param('projectId') projectId: string,
    @Body()
    body: {
      approvalCode: string;
      releaseVersion: string;
      category: string;
      description: string;
      approvalDefinitionId?: string;
      evaluationResultId?: string;
    },
    @Req() req: { user?: { userId?: string } },
  ): Promise<Record<string, unknown>> {
    const userId = req.user?.userId;
    return this.service.reportRuleDiscrepancy(projectId, body, userId);
  }
}


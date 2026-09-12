import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoadmapService } from './roadmap.service';

@ApiTags('roadmap')
@Controller('projects/:projectId')
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
}

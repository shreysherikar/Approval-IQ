import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { ReuseService } from './reuse.service';

/**
 * Phase 7 reuse endpoints. Same authorization shape as the Document Vault:
 * JWT (who are you?) then object-level project membership (are you a member
 * of :projectId?).
 */
@ApiTags('reuse')
@Controller('projects/:projectId/documents')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class ReuseController {
  constructor(@Inject(ReuseService) private readonly reuse: ReuseService) {}

  @Get('reuse-candidates')
  @ApiOperation({
    summary: 'Reuse candidates for an approval instance (each marked eligible/ineligible with its reason)',
    description:
      'Candidates are same-project (Decision #7) documents classified as one of the approval\'s required ' +
      'document definitions. Every candidate — eligible or NOT — is returned with its specific reason; ' +
      'ineligible candidates are never hidden.',
  })
  listCandidates(
    @Param('projectId') projectId: string,
    @Query('approvalInstanceId') approvalInstanceId: string,
  ) {
    return this.reuse.listReuseCandidates(projectId, approvalInstanceId);
  }
}

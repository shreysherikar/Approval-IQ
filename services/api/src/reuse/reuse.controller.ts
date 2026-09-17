import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('consent-grants')
  @ApiOperation({
    summary: 'List active and historical DPDP Act 2023 consent grants for a document / project',
  })
  getConsentGrants(
    @Param('projectId') projectId: string,
    @Query('documentId') documentId?: string,
  ) {
    return this.reuse.getConsentGrants(projectId, documentId);
  }

  @Post('consent-grants')
  @ApiOperation({
    summary: 'Grant granular per-purpose data reuse consent under DPDP Act 2023',
  })
  grantConsent(
    @Param('projectId') projectId: string,
    @Body() body: { documentId: string; targetAuthorityId: string; purpose: string },
    @Req() req: { user?: { userId?: string }; ip?: string; headers?: Record<string, string | string[]> },
  ) {
    const userId = req.user?.userId || 'usr-applicant-001';
    const userAgent = (req.headers?.['user-agent'] as string) || undefined;
    return this.reuse.grantConsent(projectId, userId, body, req.ip, userAgent);
  }

  @Patch('consent-grants/:grantId/revoke')
  @ApiOperation({
    summary: 'Revoke an existing DPDP Act 2023 data reuse consent grant',
  })
  revokeConsent(
    @Param('projectId') projectId: string,
    @Param('grantId') grantId: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    const userId = req.user?.userId || 'usr-applicant-001';
    return this.reuse.revokeConsent(projectId, grantId, userId);
  }
}


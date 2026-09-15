import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { IntelligenceService } from './intelligence.service';
import { ConsistencyService } from './consistency.service';

@ApiTags('intelligence')
@Controller('projects/:projectId/documents/:documentId')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class IntelligenceController {
  constructor(
    @Inject(IntelligenceService) private readonly intel: IntelligenceService,
    @Inject(ConsistencyService) private readonly consistency: ConsistencyService,
  ) {}

  @Post('extract')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Enqueue async extraction for the current version (mock provider)' })
  extract(@Param('projectId') projectId: string, @Param('documentId') documentId: string) {
    return this.intel.enqueueExtraction(projectId, documentId);
  }

  @Get('versions/:versionId/extraction')
  @ApiOperation({ summary: 'Latest extraction result with corrections and review threshold' })
  extraction(@Param('projectId') projectId: string, @Param('documentId') documentId: string, @Param('versionId') versionId: string) {
    return this.intel.latestExtraction(projectId, documentId, versionId);
  }

  @Patch('versions/:versionId/fields')
  @ApiOperation({ summary: 'Correct one extracted field (stored alongside raw extraction)' })
  correct(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Body() body: { fieldName: string; correctedValue: string },
    @Req() req: Request,
  ) {
    const { userId } = req.user as { userId: string };
    return this.intel.correctField(projectId, documentId, versionId, body.fieldName, body.correctedValue, userId);
  }

  @Post('versions/:versionId/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Verify a version (human action, applicant only)' })
  verify(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Body() body: { fieldsVerified?: string[]; notes?: string; evidenceInspected?: boolean },
    @Req() req: Request,
  ) {
    const { userId } = req.user as { userId: string };
    return this.intel.verify(projectId, documentId, versionId, userId, body ?? {});
  }

  @Get('versions/:versionId/verifications')
  @ApiOperation({ summary: 'List verification records for a version' })
  verifications(@Param('projectId') projectId: string, @Param('documentId') documentId: string, @Param('versionId') versionId: string) {
    return this.intel.verifications(projectId, documentId, versionId);
  }

  // --- Phase 7: consistency (warning layer — never gates anything) ---

  @Post('consistency-check')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Run consistency checks against the confirmed profile (or another document)',
    description: 'Persists ConsistencyCheckResult rows. WARNING layer only: never changes document state.',
  })
  consistencyCheck(
    @Param('projectId') projectId: string,
    @Param('documentId') documentId: string,
    @Body() body: { checkType?: string; profileVersionId?: string; otherDocumentId?: string } | undefined,
  ) {
    return this.consistency.runChecks(projectId, documentId, body ?? {});
  }

  @Get('versions/:versionId/consistency-checks')
  @ApiOperation({ summary: 'Persisted consistency check results for a version' })
  consistencyChecks(@Param('projectId') projectId: string, @Param('documentId') documentId: string, @Param('versionId') versionId: string) {
    return this.consistency.listChecks(projectId, documentId, versionId);
  }
}

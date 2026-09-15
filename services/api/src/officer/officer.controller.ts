import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, type UserRole } from '../common/decorators/roles.decorator';
import { OfficerGuard, requireOfficerScope } from '../common/guards/officer.guard';
import { OfficerApplicationGuard } from '../common/guards/officer-application.guard';
import { OfficerClarificationGuard } from '../common/guards/officer-clarification.guard';
import { OfficerService } from './officer.service';

/**
 * Phase 9 officer surface: authority-scoped queue → application review →
 * clarification round-trip.
 *
 * AUTH, in order, for EVERY route here:
 *   1. JwtAuthGuard      — who are you?
 *   2. OfficerGuard      — are you an officer/admin, and WHICH authorities may
 *                          you act for? (attaches request.officerScope)
 *   3. RolesGuard        — declared `@Roles('officer','admin')` (defense in depth)
 *   4. per-object guard  — OfficerApplicationGuard / OfficerClarificationGuard
 *                          proves the specific item is inside that scope.
 *
 * An applicant JWT is rejected at step 2 with `officer_role_required`. An officer
 * from another authority is rejected at step 4 with `officer_out_of_scope`.
 */
@ApiTags('officer')
@Controller('officer')
@UseGuards(JwtAuthGuard, OfficerGuard, RolesGuard)
@Roles('officer', 'admin')
export class OfficerController {
  constructor(@Inject(OfficerService) private readonly service: OfficerService) {}

  private actor(req: Request): { userId: string; role: UserRole } {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return { userId, role };
  }

  @Get('authorities')
  @ApiOperation({ summary: 'Authorities the signed-in officer is assigned to (with queue counts)' })
  authorities(@Req() req: Request): Promise<Record<string, unknown>> {
    return this.service.listAuthorities(requireOfficerScope(req));
  }

  @Get('queue')
  @ApiOperation({
    summary: 'Authority-scoped application queue',
    description:
      'Defaults to status=in_progress (submitted, awaiting authority action) and is ordered by ' +
      'fairness: threads already answered by the applicant first, then the longest-waiting ' +
      'application. Authority scoping is applied in the query, never as a post-filter.',
  })
  queue(
    @Req() req: Request,
    @Query('authorityId') authorityId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<Record<string, unknown>> {
    const params: { authorityId?: string; status?: string; q?: string; limit?: number } = {};
    if (authorityId !== undefined) params.authorityId = authorityId;
    if (status !== undefined) params.status = status;
    if (q !== undefined) params.q = q;
    if (limit !== undefined) params.limit = Number.parseInt(limit, 10);
    return this.service.listQueue(requireOfficerScope(req), params);
  }

  @Get('applications/:instanceId')
  @UseGuards(OfficerApplicationGuard)
  @ApiOperation({
    summary:
      'Full review packet for one application (evaluation snapshot, citations, documents, clarifications)',
  })
  application(@Req() req: Request, @Param('instanceId') instanceId: string) {
    return this.service.getApplication(requireOfficerScope(req), instanceId);
  }

  @Get('applications/:instanceId/clarifications')
  @UseGuards(OfficerApplicationGuard)
  @ApiOperation({ summary: 'Clarification threads raised on one application' })
  clarifications(@Req() req: Request, @Param('instanceId') instanceId: string) {
    return this.service.listClarifications(requireOfficerScope(req), instanceId);
  }

  @Get('applications/:instanceId/documents')
  @UseGuards(OfficerApplicationGuard)
  @ApiOperation({ summary: 'Documents in the application\u2019s project (with current version state)' })
  documents(@Req() req: Request, @Param('instanceId') instanceId: string) {
    return this.service.listDocuments(requireOfficerScope(req), instanceId);
  }

  @Get('applications/:instanceId/documents/:documentId/versions/:versionId/download')
  @UseGuards(OfficerApplicationGuard)
  @ApiOperation({ summary: 'Download a document version for review (authorized officer path)' })
  async download(
    @Req() req: Request,
    @Param('instanceId') instanceId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, originalFilename, mimeType } = await this.service.downloadDocument(
      requireOfficerScope(req),
      instanceId,
      documentId,
      versionId,
    );
    res.contentType(mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buffer);
  }

  @Post('applications/:instanceId/clarifications')
  @UseGuards(OfficerApplicationGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Request a clarification (defaults requestedFields to the pinned evaluation\u2019s missing fields)',
  })
  requestClarification(
    @Req() req: Request,
    @Param('instanceId') instanceId: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.service.createClarification(
      requireOfficerScope(req),
      instanceId,
      body,
      this.actor(req),
    );
  }

  @Get('clarifications/:clarificationId')
  @UseGuards(OfficerClarificationGuard)
  @ApiOperation({ summary: 'One clarification thread' })
  clarification(@Req() req: Request, @Param('clarificationId') clarificationId: string) {
    return this.service.getClarification(requireOfficerScope(req), clarificationId);
  }

  @Post('clarifications/:clarificationId/follow-up')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OfficerClarificationGuard)
  @ApiOperation({ summary: 'Ask a follow-up question (thread returns to `requested`)' })
  followUp(
    @Req() req: Request,
    @Param('clarificationId') clarificationId: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.service.followUpClarification(
      requireOfficerScope(req),
      clarificationId,
      body,
      this.actor(req),
    );
  }

  @Post('clarifications/:clarificationId/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OfficerClarificationGuard)
  @ApiOperation({ summary: 'Accept the applicant\u2019s answer and close the thread as `resolved`' })
  resolve(
    @Req() req: Request,
    @Param('clarificationId') clarificationId: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.service.resolveClarification(
      requireOfficerScope(req),
      clarificationId,
      body,
      this.actor(req),
    );
  }

  @Post('clarifications/:clarificationId/cancel')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OfficerClarificationGuard)
  @ApiOperation({ summary: 'Withdraw the request and close the thread as `cancelled`' })
  cancel(
    @Req() req: Request,
    @Param('clarificationId') clarificationId: string,
    @Body() body: unknown,
  ): Promise<Record<string, unknown>> {
    return this.service.cancelClarification(
      requireOfficerScope(req),
      clarificationId,
      body,
      this.actor(req),
    );
  }
}
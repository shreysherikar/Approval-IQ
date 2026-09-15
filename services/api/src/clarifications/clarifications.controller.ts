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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import type { UserRole } from '../common/decorators/roles.decorator';
import { ClarificationsService } from './clarifications.service';

/**
 * Phase 9 applicant side of the clarification loop.
 *
 * AUTH: JwtAuthGuard (who are you?) THEN ProjectMemberGuard (are you a member of
 * :projectId?) — the same shape as the Document Vault and profile intake. The
 * officer who raised the question writes through /officer/* instead; nothing
 * here is officer-reachable, and nothing there is applicant-reachable.
 */
@ApiTags('clarifications')
@Controller('projects/:projectId/clarifications')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class ClarificationsController {
  constructor(@Inject(ClarificationsService) private readonly service: ClarificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Applicant clarification inbox for a project (open items first)',
    description:
      'Each item carries status + awaitingParty + allowedActions derived from the ' +
      'clarification state machine, so the client never re-implements the lifecycle.',
  })
  list(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('approvalInstanceId') approvalInstanceId?: string,
  ): Promise<Record<string, unknown>> {
    const params: { status?: string; approvalInstanceId?: string } = {};
    if (status !== undefined) params.status = status;
    if (approvalInstanceId !== undefined) params.approvalInstanceId = approvalInstanceId;
    return this.service.list(projectId, params);
  }

  @Get(':clarificationId')
  @ApiOperation({ summary: 'One clarification thread (request + all responses)' })
  get(
    @Param('projectId') projectId: string,
    @Param('clarificationId') clarificationId: string,
  ): Promise<Record<string, unknown>> {
    return this.service.get(projectId, clarificationId);
  }

  @Post(':clarificationId/responses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Applicant answers a clarification (optionally attaching project documents)',
    description:
      'Attachments must already exist in this project\u2019s vault — upload them via the ' +
      'document endpoints first, then pass their ids here. Appends an immutable response ' +
      'and moves the clarification to `responded`.',
  })
  respond(
    @Param('projectId') projectId: string,
    @Param('clarificationId') clarificationId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return this.service.respond(projectId, clarificationId, body, { userId, role });
  }
}
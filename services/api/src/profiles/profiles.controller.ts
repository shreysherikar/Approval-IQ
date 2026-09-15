import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { ProfilesService } from './profiles.service';

/**
 * Phase 3 profile intake (blueprint Sections 18-19: authorization enforced
 * server-side). Every route requires JwtAuthGuard (who are you?) then
 * ProjectMemberGuard (are you a member of :projectId?) — same shape as the
 * Document Vault — so one applicant cannot touch another's profiles.
 */
@ApiTags('profiles')
@Controller('projects/:projectId/profiles')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class ProfilesController {
  constructor(@Inject(ProfilesService) private readonly service: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a BusinessProfile draft version for the project' })
  create(@Param('projectId') projectId: string, @Body() body: unknown) {
    return this.service.createDraft(projectId, body);
  }

  @Patch(':versionId')
  @ApiOperation({ summary: 'Update a draft version\u2019s values (drafts only)' })
  update(
    @Param('projectId') projectId: string,
    @Param('versionId') versionId: string,
    @Body() body: unknown,
  ) {
    return this.service.updateDraft(projectId, versionId, body);
  }

  @Post(':versionId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm (lock) a draft version and auto-run the approval evaluation',
  })
  confirm(@Param('projectId') projectId: string, @Param('versionId') versionId: string) {
    return this.service.confirm(projectId, versionId);
  }
}

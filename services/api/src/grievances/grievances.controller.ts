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
import { GrievancesService } from './grievances.service';
import type { SerializedGrievance } from './grievance.support';

@ApiTags('grievances')
@Controller('projects/:projectId/grievances')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class GrievancesController {
  constructor(@Inject(GrievancesService) private readonly service: GrievancesService) {}

  @Get()
  @ApiOperation({
    summary: 'Applicant grievance center: list grievances for a project',
    description: 'Retrieves all grievances lodged under Maharashtra RTS Act with status and escalation tiers.',
  })
  list(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('type') type?: string,
    @Query('approvalInstanceId') approvalInstanceId?: string,
  ): Promise<{ grievances: SerializedGrievance[]; total: number }> {
    const params: {
      status?: string | undefined;
      tier?: string | undefined;
      type?: string | undefined;
      approvalInstanceId?: string | undefined;
    } = {};
    if (status !== undefined) params.status = status;
    if (tier !== undefined) params.tier = tier;
    if (type !== undefined) params.type = type;
    if (approvalInstanceId !== undefined) params.approvalInstanceId = approvalInstanceId;

    return this.service.list(projectId, params);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Lodge a formal statutory grievance for delayed approvals or issues',
    description: 'Registers grievance under RTS Act with 15-day statutory resolution timeline and Tier 1 assignment.',
  })
  create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SerializedGrievance> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return this.service.create(projectId, body, { userId, role });
  }

  @Get(':grievanceId')
  @ApiOperation({ summary: 'Get full details, audit trail, and escalation timeline for a grievance' })
  get(
    @Param('projectId') projectId: string,
    @Param('grievanceId') grievanceId: string,
  ): Promise<SerializedGrievance> {
    return this.service.get(projectId, grievanceId);
  }

  @Get(':grievanceId/filing-pack')
  @ApiOperation({
    summary: 'Generate Statutory Appeal Filing Pack docket for Tier 3 State RTS Commission',
    description: 'Exports certified printable docket containing full timeline, SLA breach records, and officer correspondence history.',
  })
  generateFilingPack(
    @Param('projectId') projectId: string,
    @Param('grievanceId') grievanceId: string,
  ): Promise<Record<string, unknown>> {
    return this.service.generateFilingPack(projectId, grievanceId);
  }

  @Post(':grievanceId/escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Applicant manually escalates grievance to next statutory appellate authority',
    description: 'Escalates to Tier 2 (Appellate Authority / Dist. Collector) or Tier 3 (RTS Commission).',
  })
  escalate(
    @Param('projectId') projectId: string,
    @Param('grievanceId') grievanceId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SerializedGrievance> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return this.service.escalate(projectId, grievanceId, body, { userId, role });
  }

  @Post(':grievanceId/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Applicant formally withdraws a grievance' })
  withdraw(
    @Param('projectId') projectId: string,
    @Param('grievanceId') grievanceId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SerializedGrievance> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return this.service.withdraw(projectId, grievanceId, body, { userId, role });
  }
}

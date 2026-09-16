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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, type UserRole } from '../common/decorators/roles.decorator';
import { GrievancesService } from './grievances.service';
import type { SerializedGrievance } from './grievance.support';

@ApiTags('officer-grievances')
@Controller('officer/grievances')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('officer', 'admin')
export class OfficerGrievancesController {
  constructor(@Inject(GrievancesService) private readonly service: GrievancesService) {}

  @Get()
  @ApiOperation({
    summary: 'Officer/Appellate Authority Grievance Queue',
    description: 'Lists all active grievances under jurisdiction sorted by statutory deadline urgency.',
  })
  list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('tier') tier?: string,
    @Query('type') type?: string,
  ): Promise<{ grievances: SerializedGrievance[]; total: number }> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    const params: {
      status?: string | undefined;
      tier?: string | undefined;
      type?: string | undefined;
    } = {};
    if (status !== undefined) params.status = status;
    if (tier !== undefined) params.tier = tier;
    if (type !== undefined) params.type = type;

    return this.service.listForOfficer({ userId, role }, params);
  }

  @Post(':grievanceId/investigate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Officer records investigation findings / schedules hearing',
    description: 'Transitions grievance status to under_investigation and logs remarks/hearing timestamp.',
  })
  investigate(
    @Param('grievanceId') grievanceId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SerializedGrievance> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return this.service.officerInvestigate(grievanceId, body, { userId, role });
  }

  @Post(':grievanceId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Officer or Appellate Authority issues formal redressal or reasoned rejection order',
    description: 'Issues order number, resolution summary, and statutory rectification directives.',
  })
  resolve(
    @Param('grievanceId') grievanceId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<SerializedGrievance> {
    const { userId, role } = req.user as { userId: string; role: UserRole };
    return this.service.officerResolve(grievanceId, body, { userId, role });
  }

  @Post('auto-escalate')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiOperation({
    summary: 'Admin trigger to run auto-escalation for overdue statutory grievances',
  })
  triggerAutoEscalate(): Promise<{ escalatedCount: number }> {
    return this.service.autoEscalateOverdueGrievances();
  }
}

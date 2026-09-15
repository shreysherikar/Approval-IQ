import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { InspectionsService } from './inspections.service';
import {
  CreateJointInspectionDto,
  ScheduleInspectionDto,
} from './dto/schedule-inspection.dto';
import {
  CompleteInspectionDto,
  SignoffChecklistDto,
} from './dto/signoff.dto';
import {
  ProposeSlotsDto,
  RespondSlotDto,
} from './dto/negotiate-slots.dto';
import {
  ReviewRectificationDto,
  SubmitRectificationDto,
} from './dto/rectification.dto';

@ApiTags('inspections')
@Controller('projects/:projectId/inspections')
@UseGuards(JwtAuthGuard, ProjectMemberGuard, RolesGuard)
export class InspectionsController {
  constructor(
    @Inject(InspectionsService) private readonly service: InspectionsService,
  ) {}

  @Get('candidates')
  @ApiOperation({
    summary:
      'Auto-detect eligible inspection approvals and group them into recommended joint inspection stages',
  })
  getCandidates(@Param('projectId') projectId: string) {
    return this.service.getCandidates(projectId);
  }

  @Get()
  @ApiOperation({
    summary:
      'List all planned, scheduled, and past joint inspections for the project',
  })
  listInspections(@Param('projectId') projectId: string) {
    return this.service.listInspections(projectId);
  }

  @Get(':inspectionId')
  @ApiOperation({
    summary: 'Get details of a specific joint inspection',
  })
  getInspection(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
  ) {
    return this.service.getInspection(projectId, inspectionId);
  }

  @Post('plan')
  @ApiOperation({
    summary: 'Auto-generate or create a unified joint inspection plan',
  })
  createPlan(
    @Param('projectId') projectId: string,
    @Body() body: CreateJointInspectionDto,
  ) {
    return this.service.createPlan(projectId, body);
  }

  @Patch(':inspectionId/schedule')
  @ApiOperation({
    summary:
      'Schedule inspection date, time slot, and site readiness checklist',
  })
  scheduleInspection(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: ScheduleInspectionDto,
  ) {
    return this.service.scheduleInspection(projectId, inspectionId, dto);
  }

  @Post(':inspectionId/slots/propose')
  @ApiOperation({
    summary: 'Propose preferred time slots for multi-department negotiation',
  })
  proposeSlots(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: ProposeSlotsDto,
  ) {
    return this.service.proposeSlots(projectId, inspectionId, dto);
  }

  @Patch(':inspectionId/slots/respond')
  @Roles('officer', 'admin')
  @ApiOperation({
    summary:
      'Department officer response to proposed slot (Accept / Unavailable / Alternate)',
  })
  respondSlot(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: RespondSlotDto,
  ) {
    return this.service.respondSlot(projectId, inspectionId, dto);
  }

  @Patch(':inspectionId/checklists/:checklistId/signoff')
  @Roles('officer', 'admin')
  @ApiOperation({
    summary:
      'Submit inspector sign-off and findings for a specific authority checklist',
  })
  signoffChecklist(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Param('checklistId') checklistId: string,
    @Body() dto: SignoffChecklistDto,
  ) {
    return this.service.signoffChecklist(
      projectId,
      inspectionId,
      checklistId,
      dto,
    );
  }

  @Post(':inspectionId/rectifications/submit')
  @ApiOperation({
    summary:
      'Applicant submits rectification corrective actions and evidence for flagged items',
  })
  submitRectification(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: SubmitRectificationDto,
  ) {
    return this.service.submitRectification(projectId, inspectionId, dto);
  }

  @Patch(':inspectionId/rectifications/review')
  @Roles('officer', 'admin')
  @ApiOperation({
    summary:
      'Department officer reviews rectification proof and grants clearance or orders spot re-inspection',
  })
  reviewRectification(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: ReviewRectificationDto,
  ) {
    return this.service.reviewRectification(projectId, inspectionId, dto);
  }

  @Post(':inspectionId/complete')
  @Roles('officer', 'admin')
  @ApiOperation({
    summary: 'Finalize and complete a joint inspection session',
  })
  completeInspection(
    @Param('projectId') projectId: string,
    @Param('inspectionId') inspectionId: string,
    @Body() dto: CompleteInspectionDto,
  ) {
    return this.service.completeInspection(projectId, inspectionId, dto);
  }
}

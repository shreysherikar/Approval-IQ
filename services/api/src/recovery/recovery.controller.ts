import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecoveryService } from './recovery.service';

@ApiTags('Compliance Recovery')
@Controller('projects/:projectId/recovery')
export class RecoveryController {
  constructor(private readonly service: RecoveryService) {}

  /** POST /projects/:projectId/recovery/generate — generate or regenerate a recovery plan */
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async generate(
    @Param('projectId') projectId: string,
    @Query('approvalInstanceId') approvalInstanceId?: string,
  ): Promise<Record<string, unknown>> {
    return this.service.generatePlan(projectId, approvalInstanceId);
  }

  /** GET /projects/:projectId/recovery — get the active recovery plan */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPlan(@Param('projectId') projectId: string): Promise<Record<string, unknown>> {
    return this.service.getPlan(projectId);
  }

  /** PATCH /projects/:projectId/recovery/actions/:actionId/resolve — mark action resolved */
  @Patch('actions/:actionId/resolve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async resolveAction(@Param('actionId') actionId: string): Promise<Record<string, unknown>> {
    return this.service.resolveAction(actionId);
  }
}

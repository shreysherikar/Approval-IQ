import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluationsService } from './evaluations.service';

/**
 * Phase 2 evaluation record endpoints (blueprint Sections 18-19: authorization
 * enforced server-side). POST /evaluations runs the deterministic engine over
 * caller-supplied profile values; GET returns a persisted snapshot containing
 * applicant business/premises data — both require a valid JWT. Project-scoped
 * flows (Phase 3 confirm → evaluate → roadmap) additionally pass through
 * ProjectMemberGuard on the profiles/roadmap controllers.
 */
@Controller('evaluations')
@UseGuards(JwtAuthGuard)
export class EvaluationsController {
  constructor(@Inject(EvaluationsService) private readonly service: EvaluationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: unknown): Promise<Record<string, unknown>> {
    return this.service.create(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.service.findOne(id);
  }
}

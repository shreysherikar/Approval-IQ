import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RegulatoryChangesService } from './regulatory-changes.service';

@ApiTags('Regulatory Changes')
@Controller('regulatory-changes')
export class RegulatoryChangesController {
  constructor(private readonly service: RegulatoryChangesService) {}

  /** GET /regulatory-changes — list all regulatory changes */
  @Get()
  async list(): Promise<Record<string, unknown>[]> {
    return this.service.list();
  }

  /** GET /regulatory-changes/:id — get one regulatory change */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.service.findOne(id);
  }

  /** POST /regulatory-changes — create a new regulatory change (admin only) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'officer')
  @ApiBearerAuth()
  async create(@Body() body: Record<string, unknown>, @Req() req: { user: { userId: string } }): Promise<Record<string, unknown>> {
    const sourceUrl = body.sourceUrl ? String(body.sourceUrl) : '';
    const sourceNotes = body.sourceNotes ? String(body.sourceNotes) : '';
    return this.service.create({
      title: String(body.title ?? ''),
      description: String(body.description ?? ''),
      approvalDefinitionId: String(body.approvalDefinitionId ?? ''),
      oldConditions: body.oldConditions,
      newConditions: body.newConditions,
      effectiveDate: String(body.effectiveDate ?? ''),
      sourceUrl: sourceUrl || undefined,
      sourceNotes: sourceNotes || undefined,
      createdByUserId: req.user.userId,
    });
  }

  /** POST /regulatory-changes/:id/analyze — run impact analysis */
  @Post(':id/analyze')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'officer')
  @ApiBearerAuth()
  async analyzeImpact(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.service.analyzeImpact(id);
  }

  /** GET /regulatory-changes/:id/impacts — get impact results */
  @Get(':id/impacts')
  async getImpacts(
    @Param('id') id: string,
    @Query('impactType') impactType?: string,
    @Query('priority') priority?: string,
    @Query('industry') industry?: string,
  ): Promise<Record<string, unknown>> {
    const filters: { impactType?: string; priority?: string; industry?: string } = {};
    if (impactType) filters.impactType = impactType;
    if (priority) filters.priority = priority;
    if (industry) filters.industry = industry;
    return this.service.getImpacts(id, filters);
  }

  /** GET /regulatory-changes/project/:projectId/impacts — business-level impacts */
  @Get('project/:projectId/impacts')
  async getProjectImpacts(@Param('projectId') projectId: string): Promise<Record<string, unknown>[]> {
    return this.service.getProjectImpacts(projectId);
  }
}

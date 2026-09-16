import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List the signed-in user\u2019s projects (membership-scoped)' })
  list(@Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.projects.listForUser(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'One project, membership-scoped' })
  async get(@Param('id') id: string, @Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.projects.getForMember(id, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project (minimal Phase-3 skeleton)' })
  @ApiResponse({ status: 201, description: 'Project created' })
  create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const { userId } = req.user as { userId: string };
    return this.projects.create(dto, userId);
  }
}
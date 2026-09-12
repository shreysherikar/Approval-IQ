import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project (minimal Phase-3 skeleton)' })
  @ApiResponse({ status: 201, description: 'Project created' })
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }
}
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Post } from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';

@Controller('evaluations')
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

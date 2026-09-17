import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntelligenceService, AiDagSimulationResult } from './intelligence.service';

@ApiTags('ai-simulation')
@Controller('ai-simulation')
export class AiSimulationController {
  constructor(@Inject(IntelligenceService) private readonly intel: IntelligenceService) {}

  @Post('simulate-dag')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate an AI-synthesized topological regulatory DAG clearance graph',
    description: 'Calculates sequential vs parallel timelines, prerequisite dependencies, and RTS SLA guarantees for any industry and state.',
  })
  async simulateDag(
    @Body()
    body: {
      sector: string;
      state?: string;
      landAreaSqft?: number;
      investmentInr?: number;
      hasHazardous?: boolean;
      customNiche?: string;
    },
  ): Promise<AiDagSimulationResult> {
    return this.intel.simulateDagWithAi(body);
  }

  @Post('analyze-lens')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Evaluate dynamic AI statutory lens diagnosis for founder vs authority mode',
  })
  async analyzeLens(
    @Body()
    body: {
      mode: 'founder' | 'authority';
      sector?: string;
      state?: string;
    },
  ) {
    return this.intel.analyzeLensWithAi(body);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { BusinessMapService, BusinessMapResult, ClusterAiAnalysisResult } from './business-map.service';

@Controller('business-map')
export class BusinessMapController {
  constructor(private readonly businessMapService: BusinessMapService) {}

  @Get('search')
  async searchBusinessLandscape(
    @Query('q') query?: string,
    @Query('category') category?: string,
  ): Promise<BusinessMapResult> {
    return this.businessMapService.searchBusinessConcentration(query || '', category);
  }

  @Post('ai-analyze-cluster')
  async analyzeClusterWithAi(
    @Body()
    body: {
      clusterName: string;
      stateCode: string;
      stateName: string;
      sector: string;
      customQuery?: string;
    },
  ): Promise<ClusterAiAnalysisResult> {
    return this.businessMapService.analyzeClusterWithAi(body);
  }
}

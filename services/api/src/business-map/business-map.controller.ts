import { Controller, Get, Query } from '@nestjs/common';
import { BusinessMapService, BusinessMapResult } from './business-map.service';

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
}

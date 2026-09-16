import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketIntelligenceService } from './market-places.service';
import { MarketAnalysisService } from './market-analysis.service';

@Module({
  controllers: [MarketController],
  providers: [MarketIntelligenceService, MarketAnalysisService],
})
export class MarketModule {}

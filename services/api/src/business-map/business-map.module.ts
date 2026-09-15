import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessMapController } from './business-map.controller';
import { BusinessMapService } from './business-map.service';

@Module({
  imports: [ConfigModule],
  controllers: [BusinessMapController],
  providers: [BusinessMapService],
  exports: [BusinessMapService],
})
export class BusinessMapModule {}

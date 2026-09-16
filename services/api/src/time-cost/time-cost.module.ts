import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TimeCostController } from './time-cost.controller';
import { TimeCostService } from './time-cost.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimeCostController],
  providers: [TimeCostService],
  exports: [TimeCostService],
})
export class TimeCostModule {}

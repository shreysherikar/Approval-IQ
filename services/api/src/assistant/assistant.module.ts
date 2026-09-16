import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './assistant-context.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TimeCostModule } from '../time-cost/time-cost.module';

@Module({
  imports: [PrismaModule, TimeCostModule],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantContextService],
})
export class AssistantModule {}

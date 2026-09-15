import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';

@Module({
  imports: [PrismaModule, RoadmapModule],
  controllers: [InspectionsController],
  providers: [InspectionsService],
  exports: [InspectionsService],
})
export class InspectionsModule {}

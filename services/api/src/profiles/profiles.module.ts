import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { EvaluationsModule } from '../evaluations/evaluations.module';
import { RoadmapModule } from '../roadmap/roadmap.module';

@Module({
  imports: [EvaluationsModule, RoadmapModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}

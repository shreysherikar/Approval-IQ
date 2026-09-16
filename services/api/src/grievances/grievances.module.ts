import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GrievancesService } from './grievances.service';
import { GrievancesController } from './grievances.controller';
import { OfficerGrievancesController } from './officer-grievances.controller';

@Module({
  imports: [PrismaModule],
  controllers: [GrievancesController, OfficerGrievancesController],
  providers: [GrievancesService],
  exports: [GrievancesService],
})
export class GrievancesModule {}

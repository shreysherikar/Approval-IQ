import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RegulatoryChangesService } from './regulatory-changes.service';
import { RegulatoryChangesController } from './regulatory-changes.controller';

@Module({
  imports: [PrismaModule],
  providers: [RegulatoryChangesService],
  controllers: [RegulatoryChangesController],
  exports: [RegulatoryChangesService],
})
export class RegulatoryChangesModule {}

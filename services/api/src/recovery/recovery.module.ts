import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';

@Module({
  imports: [PrismaModule],
  providers: [RecoveryService],
  controllers: [RecoveryController],
  exports: [RecoveryService],
})
export class RecoveryModule {}

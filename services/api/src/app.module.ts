import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { ProjectsModule } from './projects/projects.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RoadmapModule } from './roadmap/roadmap.module';
import { DocumentsModule } from './documents/documents.module';
import { JobsModule } from './jobs/jobs.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { ReuseModule } from './reuse/reuse.module';
import { ClarificationsModule } from './clarifications/clarifications.module';
import { OfficerModule } from './officer/officer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    HealthModule,
    AuthModule,
    EvaluationsModule,
    ProjectsModule,
    ProfilesModule,
    RoadmapModule,
    DocumentsModule,
    JobsModule,
    IntelligenceModule,
    ReuseModule,
    // Phase 9: applicant clarification inbox + officer queue/review.
    ClarificationsModule,
    OfficerModule,
  ],
})
export class AppModule {}

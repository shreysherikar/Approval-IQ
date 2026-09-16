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
import { BusinessMapModule } from './business-map/business-map.module';
import { InspectionsModule } from './inspections/inspections.module';
import { ClarificationsModule } from './clarifications/clarifications.module';
import { OfficerModule } from './officer/officer.module';
import { GrievancesModule } from './grievances/grievances.module';
import { RegulatoryChangesModule } from './regulatory-changes/regulatory-changes.module';
import { RecoveryModule } from './recovery/recovery.module';
import { RiskModule } from './risk/risk.module';
import { AuditModule } from './audit/audit.module';
import { TimeCostModule } from './time-cost/time-cost.module';
import { MarketModule } from './market/market.module';
import { AssistantModule } from './assistant/assistant.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    EventsModule,
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
    BusinessMapModule,
    InspectionsModule,
    ClarificationsModule,
    OfficerModule,
    GrievancesModule,
    RegulatoryChangesModule,
    RecoveryModule,
    RiskModule,
    AuditModule,
    TimeCostModule,
    MarketModule,
    AssistantModule,
    IntegrationsModule,
  ],
})
export class AppModule {}

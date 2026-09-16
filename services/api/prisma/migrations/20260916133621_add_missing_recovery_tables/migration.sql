-- CreateEnum
CREATE TYPE "RegulatoryChangeStatus" AS ENUM ('draft', 'analyzing', 'analyzed', 'published');

-- CreateEnum
CREATE TYPE "ImpactType" AS ENUM ('newly_affected', 'no_longer_affected', 'requirement_changed', 'no_material_impact', 'needs_review');

-- CreateEnum
CREATE TYPE "ImpactPriority" AS ENUM ('critical', 'high', 'medium', 'low', 'no_impact');

-- CreateEnum
CREATE TYPE "RecoveryPlanStatus" AS ENUM ('active', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "RecoveryActionStatus" AS ENUM ('open', 'in_progress', 'resolved', 'needs_review');

-- CreateEnum
CREATE TYPE "RecoveryActionSeverity" AS ENUM ('blocking', 'high', 'medium', 'low');

-- CreateTable
CREATE TABLE "regulatory_changes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "approval_definition_id" TEXT NOT NULL,
    "old_conditions" JSONB NOT NULL,
    "new_conditions" JSONB NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "source_url" TEXT,
    "source_notes" TEXT,
    "status" "RegulatoryChangeStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regulatory_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regulatory_change_impacts" (
    "id" TEXT NOT NULL,
    "regulatory_change_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "impact_type" "ImpactType" NOT NULL,
    "priority" "ImpactPriority" NOT NULL DEFAULT 'no_impact',
    "old_applicability" TEXT NOT NULL,
    "new_applicability" TEXT NOT NULL,
    "changed_condition" TEXT,
    "required_action" TEXT,
    "explanation" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'high',
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "regulatory_change_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_plans" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "approval_instance_id" TEXT,
    "status" "RecoveryPlanStatus" NOT NULL DEFAULT 'active',
    "readiness_level" TEXT NOT NULL DEFAULT 'not_ready',
    "total_blocking" INTEGER NOT NULL DEFAULT 0,
    "total_warnings" INTEGER NOT NULL DEFAULT 0,
    "total_actions" INTEGER NOT NULL DEFAULT 0,
    "resolved_actions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_actions" (
    "id" TEXT NOT NULL,
    "recovery_plan_id" TEXT NOT NULL,
    "issue_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "RecoveryActionSeverity" NOT NULL,
    "status" "RecoveryActionStatus" NOT NULL DEFAULT 'open',
    "sequence_order" INTEGER NOT NULL,
    "affected_approval" TEXT,
    "affected_document" TEXT,
    "dependency_on_action_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recovery_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "approval_instance_id" TEXT,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regulatory_changes_approval_definition_id_idx" ON "regulatory_changes"("approval_definition_id");

-- CreateIndex
CREATE INDEX "regulatory_change_impacts_project_id_idx" ON "regulatory_change_impacts"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "regulatory_change_impacts_regulatory_change_id_project_id_key" ON "regulatory_change_impacts"("regulatory_change_id", "project_id");

-- CreateIndex
CREATE INDEX "recovery_plans_project_id_idx" ON "recovery_plans"("project_id");

-- CreateIndex
CREATE INDEX "audit_events_project_id_idx" ON "audit_events"("project_id");

-- CreateIndex
CREATE INDEX "audit_events_approval_instance_id_idx" ON "audit_events"("approval_instance_id");

-- CreateIndex
CREATE INDEX "audit_events_user_id_idx" ON "audit_events"("user_id");

-- AddForeignKey
ALTER TABLE "regulatory_changes" ADD CONSTRAINT "regulatory_changes_approval_definition_id_fkey" FOREIGN KEY ("approval_definition_id") REFERENCES "approval_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_change_impacts" ADD CONSTRAINT "regulatory_change_impacts_regulatory_change_id_fkey" FOREIGN KEY ("regulatory_change_id") REFERENCES "regulatory_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regulatory_change_impacts" ADD CONSTRAINT "regulatory_change_impacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plans" ADD CONSTRAINT "recovery_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_plans" ADD CONSTRAINT "recovery_plans_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_actions" ADD CONSTRAINT "recovery_actions_recovery_plan_id_fkey" FOREIGN KEY ("recovery_plan_id") REFERENCES "recovery_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

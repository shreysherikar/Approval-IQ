-- CreateEnum
CREATE TYPE "JointInspectionStage" AS ENUM ('pre_construction', 'plant_readiness', 'pre_commissioning', 'annual_compliance');

-- CreateEnum
CREATE TYPE "JointInspectionStatus" AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'rescheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "InspectorSignoffStatus" AS ENUM ('pending', 'satisfactory', 'needs_rectification', 'rejected');

-- CreateTable
CREATE TABLE "joint_inspections" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "stage" "JointInspectionStage" NOT NULL,
    "status" "JointInspectionStatus" NOT NULL DEFAULT 'draft',
    "scheduled_date" TIMESTAMP(3),
    "time_slot" TEXT,
    "premises_address" TEXT,
    "lead_authority_code" TEXT,
    "lead_authority_name" TEXT,
    "notes" TEXT,
    "readiness_checklist" JSONB,
    "slot_negotiation" JSONB,
    "rectification_plan" JSONB,
    "joint_report_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joint_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joint_inspection_approvals" (
    "id" TEXT NOT NULL,
    "joint_inspection_id" TEXT NOT NULL,
    "approval_instance_id" TEXT,
    "approval_code" TEXT NOT NULL,
    "approval_name" TEXT NOT NULL,
    "authority_code" TEXT NOT NULL,
    "authority_name" TEXT NOT NULL,
    "specific_requirements" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "joint_inspection_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "joint_inspector_checklists" (
    "id" TEXT NOT NULL,
    "joint_inspection_id" TEXT NOT NULL,
    "authority_code" TEXT NOT NULL,
    "authority_name" TEXT NOT NULL,
    "inspector_name" TEXT,
    "inspector_designation" TEXT,
    "status" "InspectorSignoffStatus" NOT NULL DEFAULT 'pending',
    "items" JSONB NOT NULL,
    "findings_notes" TEXT,
    "signed_off_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "joint_inspector_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "joint_inspections_project_id_idx" ON "joint_inspections"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "joint_inspection_approvals_joint_inspection_id_approval_code_key" ON "joint_inspection_approvals"("joint_inspection_id", "approval_code");

-- CreateIndex
CREATE UNIQUE INDEX "joint_inspector_checklists_joint_inspection_id_authority_code_key" ON "joint_inspector_checklists"("joint_inspection_id", "authority_code");

-- AddForeignKey
ALTER TABLE "joint_inspections" ADD CONSTRAINT "joint_inspections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_inspection_approvals" ADD CONSTRAINT "joint_inspection_approvals_joint_inspection_id_fkey" FOREIGN KEY ("joint_inspection_id") REFERENCES "joint_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_inspection_approvals" ADD CONSTRAINT "joint_inspection_approvals_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "joint_inspector_checklists" ADD CONSTRAINT "joint_inspector_checklists_joint_inspection_id_fkey" FOREIGN KEY ("joint_inspection_id") REFERENCES "joint_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

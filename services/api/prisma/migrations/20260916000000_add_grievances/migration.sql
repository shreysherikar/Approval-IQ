-- CreateEnum
CREATE TYPE "GrievanceType" AS ENUM ('sla_breach_delay', 'unjustified_clarification', 'arbitrary_rejection', 'inspection_harassment', 'fee_overcharge', 'other');

-- CreateEnum
CREATE TYPE "GrievanceTier" AS ENUM ('tier_1_nodal_officer', 'tier_2_appellate_authority', 'tier_3_rts_commission');

-- CreateEnum
CREATE TYPE "GrievanceStatus" AS ENUM ('submitted', 'under_investigation', 'escalated', 'redressed', 'rejected', 'withdrawn');

-- CreateTable
CREATE TABLE "grievances" (
    "id" TEXT NOT NULL,
    "grievance_number" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "approval_instance_id" TEXT,
    "authority_id" TEXT,
    "submitted_by_user_id" TEXT NOT NULL,
    "type" "GrievanceType" NOT NULL,
    "tier" "GrievanceTier" NOT NULL DEFAULT 'tier_1_nodal_officer',
    "status" "GrievanceStatus" NOT NULL DEFAULT 'submitted',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statutory_sla_days" INTEGER NOT NULL DEFAULT 15,
    "target_resolution_date" TIMESTAMP(3) NOT NULL,
    "sla_breach_detected_at" TIMESTAMP(3),
    "auto_escalated_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_summary" TEXT,
    "rectification_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grievances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievance_documents" (
    "id" TEXT NOT NULL,
    "grievance_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grievance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grievance_actions" (
    "id" TEXT NOT NULL,
    "grievance_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_role" "Role" NOT NULL,
    "action_type" TEXT NOT NULL,
    "from_status" "GrievanceStatus",
    "to_status" "GrievanceStatus" NOT NULL,
    "from_tier" "GrievanceTier",
    "to_tier" "GrievanceTier",
    "remarks" TEXT NOT NULL,
    "order_number" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grievance_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grievances_grievance_number_key" ON "grievances"("grievance_number");

-- CreateIndex
CREATE INDEX "grievances_project_id_status_idx" ON "grievances"("project_id", "status");

-- CreateIndex
CREATE INDEX "grievances_authority_id_status_idx" ON "grievances"("authority_id", "status");

-- CreateIndex
CREATE INDEX "grievances_tier_status_idx" ON "grievances"("tier", "status");

-- CreateIndex
CREATE UNIQUE INDEX "grievance_documents_grievance_id_document_id_key" ON "grievance_documents"("grievance_id", "document_id");

-- CreateIndex
CREATE INDEX "grievance_actions_grievance_id_idx" ON "grievance_actions"("grievance_id");

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievances" ADD CONSTRAINT "grievances_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_documents" ADD CONSTRAINT "grievance_documents_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_documents" ADD CONSTRAINT "grievance_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_actions" ADD CONSTRAINT "grievance_actions_grievance_id_fkey" FOREIGN KEY ("grievance_id") REFERENCES "grievances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_actions" ADD CONSTRAINT "grievance_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add the Phase 4 approval roadmap: instances trace back to the exact
-- EvaluationResult that produced them (outcome is never restated here).
CREATE TYPE "ApprovalInstanceStatus" AS ENUM ('blocked', 'available', 'in_progress', 'done');

CREATE TABLE "approval_instances" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "approval_definition_id" TEXT NOT NULL,
    "evaluation_result_id" TEXT NOT NULL,
    "status" "ApprovalInstanceStatus" NOT NULL DEFAULT 'blocked',
    "unlocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- One roadmap slot per approval per project; re-evaluations re-point the
-- same instance at the newer evaluation result.
CREATE UNIQUE INDEX "approval_instances_project_id_approval_definition_id_key" ON "approval_instances"("project_id", "approval_definition_id");
CREATE UNIQUE INDEX "approval_instances_evaluation_result_id_key" ON "approval_instances"("evaluation_result_id");
CREATE INDEX "approval_instances_project_id_idx" ON "approval_instances"("project_id");

ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_approval_definition_id_fkey" FOREIGN KEY ("approval_definition_id") REFERENCES "approval_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_evaluation_result_id_fkey" FOREIGN KEY ("evaluation_result_id") REFERENCES "evaluation_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
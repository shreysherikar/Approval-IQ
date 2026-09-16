-- AlterTable
ALTER TABLE "approval_definitions" ADD COLUMN     "exclusion_conditions" JSONB,
ADD COLUMN     "exclusion_reason" TEXT,
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "rule_kind" TEXT NOT NULL DEFAULT 'approval',
ADD COLUMN     "short_name" TEXT;

-- RenameIndex
ALTER INDEX "joint_inspection_approvals_joint_inspection_id_approval_code_ke" RENAME TO "joint_inspection_approvals_joint_inspection_id_approval_cod_key";

-- RenameIndex
ALTER INDEX "joint_inspector_checklists_joint_inspection_id_authority_code_k" RENAME TO "joint_inspector_checklists_joint_inspection_id_authority_co_key";

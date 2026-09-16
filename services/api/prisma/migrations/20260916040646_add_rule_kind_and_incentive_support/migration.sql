-- AlterTable
ALTER TABLE "approval_definitions" ADD COLUMN     "exclusion_conditions" JSONB,
ADD COLUMN     "exclusion_reason" TEXT,
ADD COLUMN     "jurisdiction" TEXT,
ADD COLUMN     "rule_kind" TEXT NOT NULL DEFAULT 'approval',
ADD COLUMN     "short_name" TEXT;

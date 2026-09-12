-- Add approval-specific research notes to ApprovalDefinition.
-- Maps 1:1 from the approvals.csv `notes` column so researcher annotations
-- (e.g. "High confidence on service existence, low confidence on document
-- checklist.") are not discarded. Nullable Text; empty CSV values import as NULL.
ALTER TABLE "approval_definitions" ADD COLUMN "ambiguityNotes" TEXT;
-- Business Intelligence (Regulatory Time & Cost Prediction): optional,
-- evidence-tracked time/cost fields on approval_definitions. All columns are
-- nullable — NULL means "unknown" and the UI marks it as such.
ALTER TABLE "approval_definitions"
  ADD COLUMN "processing_time_min_days" INTEGER,
  ADD COLUMN "processing_time_max_days" INTEGER,
  ADD COLUMN "time_basis" TEXT,
  ADD COLUMN "time_status" TEXT,
  ADD COLUMN "time_source_note" TEXT,
  ADD COLUMN "govt_fee_min_inr" INTEGER,
  ADD COLUMN "govt_fee_max_inr" INTEGER,
  ADD COLUMN "registration_fee_min_inr" INTEGER,
  ADD COLUMN "registration_fee_max_inr" INTEGER,
  ADD COLUMN "inspection_fee_min_inr" INTEGER,
  ADD COLUMN "inspection_fee_max_inr" INTEGER,
  ADD COLUMN "documentation_cost_min_inr" INTEGER,
  ADD COLUMN "documentation_cost_max_inr" INTEGER,
  ADD COLUMN "other_cost_min_inr" INTEGER,
  ADD COLUMN "other_cost_max_inr" INTEGER,
  ADD COLUMN "cost_status" TEXT,
  ADD COLUMN "cost_source_note" TEXT;

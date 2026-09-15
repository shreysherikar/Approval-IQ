-- CreateEnum
CREATE TYPE "ConsistencyCheckType" AS ENUM ('profile_vs_document', 'document_vs_document');

-- CreateTable
CREATE TABLE "consistency_check_results" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "profile_version_id" TEXT,
    "other_document_version_id" TEXT,
    "check_type" "ConsistencyCheckType" NOT NULL,
    "check_id" TEXT NOT NULL,
    "profile_field" TEXT,
    "document_field" TEXT NOT NULL,
    "side_a_value" TEXT,
    "side_b_value" TEXT,
    "outcome" TEXT NOT NULL,
    "tolerance_pct" DOUBLE PRECISION,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consistency_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consistency_check_results_document_version_id_idx" ON "consistency_check_results"("document_version_id");

-- CreateIndex
CREATE INDEX "consistency_check_results_project_id_idx" ON "consistency_check_results"("project_id");

-- AddForeignKey
ALTER TABLE "consistency_check_results" ADD CONSTRAINT "consistency_check_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_check_results" ADD CONSTRAINT "consistency_check_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_check_results" ADD CONSTRAINT "consistency_check_results_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_check_results" ADD CONSTRAINT "consistency_check_results_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "business_profile_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consistency_check_results" ADD CONSTRAINT "consistency_check_results_other_document_version_id_fkey" FOREIGN KEY ("other_document_version_id") REFERENCES "document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

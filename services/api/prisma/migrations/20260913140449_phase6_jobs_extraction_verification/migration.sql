-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead_letter');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_schema_version" INTEGER NOT NULL DEFAULT 1,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "idempotency_key" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "error_details" TEXT,
    "retry_policy" JSONB NOT NULL,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_results" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "model_provider" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "extracted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extraction_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_corrections" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "corrected_value" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user_corrected',
    "corrected_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_records" (
    "id" TEXT NOT NULL,
    "document_version_id" TEXT NOT NULL,
    "verifier_user_id" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fields_verified" JSONB NOT NULL,
    "notes" TEXT,
    "method" TEXT NOT NULL DEFAULT 'manual_review',
    "evidence_inspected" BOOLEAN NOT NULL,
    "verified_by" TEXT NOT NULL DEFAULT 'applicant',

    CONSTRAINT "verification_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_idempotency_key_key" ON "jobs"("idempotency_key");

-- CreateIndex
CREATE INDEX "jobs_status_next_attempt_at_idx" ON "jobs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "jobs_type_status_idx" ON "jobs"("type", "status");

-- CreateIndex
CREATE INDEX "extraction_results_document_version_id_idx" ON "extraction_results"("document_version_id");

-- CreateIndex
CREATE INDEX "field_corrections_document_version_id_idx" ON "field_corrections"("document_version_id");

-- CreateIndex
CREATE INDEX "verification_records_document_version_id_idx" ON "verification_records"("document_version_id");

-- AddForeignKey
ALTER TABLE "extraction_results" ADD CONSTRAINT "extraction_results_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_corrections" ADD CONSTRAINT "field_corrections_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_corrections" ADD CONSTRAINT "field_corrections_corrected_by_user_id_fkey" FOREIGN KEY ("corrected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_verifier_user_id_fkey" FOREIGN KEY ("verifier_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

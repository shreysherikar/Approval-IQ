-- Phase 9: officer authority scoping + clarification workflow.
-- Hand-written (no live database in this environment) but matches Prisma's
-- generated DDL conventions exactly: TEXT ids, TIMESTAMP(3), JSONB, and
-- named FK/index/PK constraints identical to what `prisma migrate diff` emits.

-- CreateEnum
CREATE TYPE "ClarificationStatus" AS ENUM ('requested', 'responded', 'resolved', 'cancelled');

-- CreateTable
CREATE TABLE "officer_authority_assignments" (
    "id" TEXT NOT NULL,
    "officer_id" TEXT NOT NULL,
    "authority_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "officer_authority_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarification_requests" (
    "id" TEXT NOT NULL,
    "approval_instance_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "authority_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "requested_fields" JSONB NOT NULL DEFAULT '[]',
    "status" "ClarificationStatus" NOT NULL DEFAULT 'requested',
    "due_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_user_id" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarification_responses" (
    "id" TEXT NOT NULL,
    "clarification_request_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "author_role" "Role" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarification_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarification_response_documents" (
    "id" TEXT NOT NULL,
    "clarification_response_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarification_response_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "officer_authority_assignments_officer_id_authority_id_key" ON "officer_authority_assignments"("officer_id", "authority_id");

-- CreateIndex
CREATE INDEX "officer_authority_assignments_authority_id_idx" ON "officer_authority_assignments"("authority_id");

-- CreateIndex
CREATE INDEX "clarification_requests_project_id_status_idx" ON "clarification_requests"("project_id", "status");

-- CreateIndex
CREATE INDEX "clarification_requests_approval_instance_id_idx" ON "clarification_requests"("approval_instance_id");

-- CreateIndex
CREATE INDEX "clarification_requests_authority_id_status_idx" ON "clarification_requests"("authority_id", "status");

-- CreateIndex
CREATE INDEX "clarification_responses_clarification_request_id_idx" ON "clarification_responses"("clarification_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "clarification_response_documents_clarification_response_id__key" ON "clarification_response_documents"("clarification_response_id", "document_id");

-- AddForeignKey
ALTER TABLE "officer_authority_assignments" ADD CONSTRAINT "officer_authority_assignments_officer_id_fkey" FOREIGN KEY ("officer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "officer_authority_assignments" ADD CONSTRAINT "officer_authority_assignments_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "authorities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "authorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_responses" ADD CONSTRAINT "clarification_responses_clarification_request_id_fkey" FOREIGN KEY ("clarification_request_id") REFERENCES "clarification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_responses" ADD CONSTRAINT "clarification_responses_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_response_documents" ADD CONSTRAINT "clarification_response_documents_clarification_response_id_fkey" FOREIGN KEY ("clarification_response_id") REFERENCES "clarification_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_response_documents" ADD CONSTRAINT "clarification_response_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

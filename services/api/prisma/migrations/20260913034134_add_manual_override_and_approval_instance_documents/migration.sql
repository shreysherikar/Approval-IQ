-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "document_definition_manual_override" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "metadata" JSONB;

-- CreateTable
CREATE TABLE "approval_instance_documents" (
    "id" TEXT NOT NULL,
    "approval_instance_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_instance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_instance_documents_approval_instance_id_document_i_key" ON "approval_instance_documents"("approval_instance_id", "document_id");

-- AddForeignKey
ALTER TABLE "approval_instance_documents" ADD CONSTRAINT "approval_instance_documents_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instance_documents" ADD CONSTRAINT "approval_instance_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

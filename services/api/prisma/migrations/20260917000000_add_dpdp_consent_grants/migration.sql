-- CreateTable
CREATE TABLE "consent_grants" (
    "id" TEXT NOT NULL,
    "principal_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "target_authority_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_grants_project_id_principal_id_idx" ON "consent_grants"("project_id", "principal_id");

-- CreateIndex
CREATE INDEX "consent_grants_document_id_idx" ON "consent_grants"("document_id");

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_principal_id_fkey" FOREIGN KEY ("principal_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_grants" ADD CONSTRAINT "consent_grants_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

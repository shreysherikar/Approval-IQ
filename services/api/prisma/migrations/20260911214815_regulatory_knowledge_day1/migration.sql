-- Replace placeholder HealthCheck with Day-1 regulatory knowledge schema.
-- Phase 13 will add claim/evidence-per-fact granularity, formal
-- draft/review/publish state machine, automatic staleness computation,
-- and an append-only versioned model.

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('research_verified', 'production_verified');
CREATE TYPE "KnowledgeReleaseStatus" AS ENUM ('draft', 'published');
CREATE TYPE "DocumentReusability" AS ENUM ('reusable', 'conditional', 'fresh_required');
CREATE TYPE "DependencyRelationship" AS ENUM ('depends_on', 'informational', 'parallel_with', 'unknown');

-- DropPlaceholder
DROP TABLE IF EXISTS "health_checks";

-- CreateTable
CREATE TABLE "industries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "industries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "industries_code_key" ON "industries"("code");

CREATE TABLE "authorities" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "jurisdiction" TEXT,
    "official_url" TEXT,
    CONSTRAINT "authorities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "authorities_code_key" ON "authorities"("code");

CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "published_date" TIMESTAMP(3),
    "retrieved_date" TIMESTAMP(3) NOT NULL,
    "last_verified_date" TIMESTAMP(3) NOT NULL,
    "verified_by" TEXT NOT NULL,
    "notes" TEXT,
    "source_last_reviewed" DATE,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'research_verified',
    "staleness_flag" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "knowledge_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "KnowledgeReleaseStatus" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "published_by" TEXT,
    "change_summary" TEXT,
    CONSTRAINT "knowledge_releases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "knowledge_releases_version_key" ON "knowledge_releases"("version");
-- Second half: approval/document/dependency tables + FKs + check + seed.
CREATE TABLE "approval_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry_id" TEXT NOT NULL,
    "authority_id" TEXT NOT NULL,
    "why_required" TEXT NOT NULL,
    "applicability_conditions" JSONB,
    "inspection_required" BOOLEAN NOT NULL,
    "renewal_required" BOOLEAN NOT NULL,
    "sla_days" INTEGER,
    "official_application_url" TEXT,
    "source_id" TEXT NOT NULL,
    "last_verified_date" TIMESTAMP(3) NOT NULL,
    "release_id" TEXT,
    CONSTRAINT "approval_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "approval_definitions_code_key" ON "approval_definitions"("code");

CREATE TABLE "document_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "issuing_authority_id" TEXT,
    "validity_rule" TEXT NOT NULL,
    "reusability" "DocumentReusability" NOT NULL,
    "reuse_conditions" TEXT NOT NULL,
    "verification_method" TEXT NOT NULL,
    CONSTRAINT "document_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "document_definitions_code_key" ON "document_definitions"("code");

CREATE TABLE "approval_document_requirements" (
    "id" TEXT NOT NULL,
    "approval_definition_id" TEXT NOT NULL,
    "document_definition_id" TEXT NOT NULL,
    "condition" TEXT,
    CONSTRAINT "approval_document_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dependencies" (
    "id" TEXT NOT NULL,
    "from_approval_id" TEXT NOT NULL,
    "relationship" "DependencyRelationship" NOT NULL,
    "to_approval_id" TEXT NOT NULL,
    "condition" TEXT,
    "gating_rationale" TEXT,
    CONSTRAINT "dependencies_pkey" PRIMARY KEY ("id"),
    -- depends_on rows must carry specific workflow-gating evidence.
    CONSTRAINT "dependencies_depends_on_requires_rationale" CHECK (
        "relationship" <> 'depends_on'::"DependencyRelationship"
        OR ("gating_rationale" IS NOT NULL AND btrim("gating_rationale") <> '')
    )
);

ALTER TABLE "approval_definitions" ADD CONSTRAINT "approval_definitions_industry_id_fkey" FOREIGN KEY ("industry_id") REFERENCES "industries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_definitions" ADD CONSTRAINT "approval_definitions_authority_id_fkey" FOREIGN KEY ("authority_id") REFERENCES "authorities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_definitions" ADD CONSTRAINT "approval_definitions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_definitions" ADD CONSTRAINT "approval_definitions_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "knowledge_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_definitions" ADD CONSTRAINT "document_definitions_issuing_authority_id_fkey" FOREIGN KEY ("issuing_authority_id") REFERENCES "authorities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_document_requirements" ADD CONSTRAINT "approval_document_requirements_approval_definition_id_fkey" FOREIGN KEY ("approval_definition_id") REFERENCES "approval_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_document_requirements" ADD CONSTRAINT "approval_document_requirements_document_definition_id_fkey" FOREIGN KEY ("document_definition_id") REFERENCES "document_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_from_approval_id_fkey" FOREIGN KEY ("from_approval_id") REFERENCES "approval_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_to_approval_id_fkey" FOREIGN KEY ("to_approval_id") REFERENCES "approval_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed a single draft KnowledgeRelease for the brewery dataset.
INSERT INTO "knowledge_releases" ("id", "version", "status", "change_summary")
VALUES (gen_random_uuid(), '2026.09.11-brewery-v1', 'draft', 'Initial Day-1 brewery knowledge release (draft).')
ON CONFLICT ("version") DO NOTHING;


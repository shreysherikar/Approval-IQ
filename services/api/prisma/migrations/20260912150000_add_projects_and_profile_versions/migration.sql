-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('draft', 'confirmed');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profile_versions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_profile_versions_project_id_version_number_key" ON "business_profile_versions"("project_id", "version_number");

-- CreateIndex
CREATE INDEX "business_profile_versions_project_id_idx" ON "business_profile_versions"("project_id");

-- AddForeignKey
ALTER TABLE "business_profile_versions" ADD CONSTRAINT "business_profile_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

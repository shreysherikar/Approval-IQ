-- CreateTable
CREATE TABLE "evaluation_runs" (
    "id" TEXT NOT NULL,
    "profile_snapshot" JSONB NOT NULL,
    "release_id" TEXT,
    "engine_version" TEXT NOT NULL,
    "result_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_results" (
    "id" TEXT NOT NULL,
    "evaluation_run_id" TEXT NOT NULL,
    "approval_definition_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "missing_fields" JSONB NOT NULL,

    CONSTRAINT "evaluation_results_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "knowledge_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_evaluation_run_id_fkey" FOREIGN KEY ("evaluation_run_id") REFERENCES "evaluation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_results" ADD CONSTRAINT "evaluation_results_approval_definition_id_fkey" FOREIGN KEY ("approval_definition_id") REFERENCES "approval_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

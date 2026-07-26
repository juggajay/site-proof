-- AlterTable
ALTER TABLE "ai_proposals" ADD COLUMN     "import_batch_id" TEXT;

-- AlterTable
ALTER TABLE "itp_templates" ADD COLUMN     "spec_affirmed_at" TIMESTAMP(3),
ADD COLUMN     "spec_affirmed_by_id" TEXT;

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploaded',
    "project_id" TEXT NOT NULL,
    "source_format" TEXT NOT NULL,
    "failed_reason" TEXT,
    "source_document_id" TEXT,
    "mapping_profile_id" TEXT,
    "parse_result" JSONB,
    "dry_run" JSONB,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_mapping_profiles" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "company_id" TEXT,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source_format" TEXT NOT NULL,
    "field_map" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_built_in" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mapping_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_project_id_kind_status_idx" ON "import_batches"("project_id", "kind", "status");

-- CreateIndex
CREATE INDEX "import_batches_project_id_created_at_idx" ON "import_batches"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_status_updated_at_idx" ON "import_batches"("status", "updated_at");

-- CreateIndex
CREATE INDEX "import_mapping_profiles_company_id_kind_idx" ON "import_mapping_profiles"("company_id", "kind");

-- CreateIndex
CREATE INDEX "import_mapping_profiles_project_id_kind_idx" ON "import_mapping_profiles"("project_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ai_proposals_import_batch_id_key" ON "ai_proposals"("import_batch_id");

-- CreateIndex
CREATE INDEX "itp_templates_project_id_idx" ON "itp_templates"("project_id");

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_mapping_profile_id_fkey" FOREIGN KEY ("mapping_profile_id") REFERENCES "import_mapping_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mapping_profiles" ADD CONSTRAINT "import_mapping_profiles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_mapping_profiles" ADD CONSTRAINT "import_mapping_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Wave B [WBR2-6]: affirm every template that exists TODAY. The importer does
-- not exist yet at this migration, so every project-scoped template in the
-- database was hand-made by a human in that project — exactly the population
-- the spec says the Tier-A gate must leave unaffected. Without this, the new
-- gate would silently demote every existing hand-made template out of Tier-A
-- auto-fill. Only imported templates start unaffirmed from here on.
UPDATE "itp_templates"
SET "spec_affirmed_at" = "created_at"
WHERE "project_id" IS NOT NULL AND "spec_affirmed_at" IS NULL;

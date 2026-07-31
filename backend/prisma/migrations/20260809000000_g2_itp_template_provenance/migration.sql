-- Wave G G2 (docs/plans/wave-g-execution-spec-2026-07-31.md §2.4).
--
-- Additive only, all-null on apply. Twelve nullable columns on itp_templates
-- (the ten in spec §2.2(a) plus §2.2(b) annexure_warning and §2.2(c)
-- import_batch_id), one nullable column on itp_checklist_items, one self-FK
-- for the GLOBAL library supersession chain, and the per-project unique that
-- lets §1.7 E2 cover project-scoped templates.
--
-- The unique index is inert against existing rows on purpose: Postgres treats
-- NULLs as distinct, and every row has spec_edition NULL until a seeder run
-- sets one. It constrains new editions, not history.

-- AlterTable
ALTER TABLE "itp_checklist_items" ADD COLUMN     "source_checklist_item_id" TEXT;

-- AlterTable
ALTER TABLE "itp_templates" ADD COLUMN     "annexure_warning" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "authority" TEXT,
ADD COLUMN     "change_summary" TEXT,
ADD COLUMN     "effective_from" TIMESTAMP(3),
ADD COLUMN     "import_batch_id" TEXT,
ADD COLUMN     "review_due_on" TIMESTAMP(3),
ADD COLUMN     "source_template_id" TEXT,
ADD COLUMN     "spec_edition" TEXT,
ADD COLUMN     "spec_issued_on" TIMESTAMP(3),
ADD COLUMN     "superseded_at" TIMESTAMP(3),
ADD COLUMN     "superseded_by_id" TEXT,
ADD COLUMN     "superseded_by_seed_run" TEXT;

-- CreateIndex
CREATE INDEX "itp_checklist_items_source_checklist_item_id_idx" ON "itp_checklist_items"("source_checklist_item_id");

-- CreateIndex
CREATE INDEX "itp_templates_project_id_superseded_by_id_idx" ON "itp_templates"("project_id", "superseded_by_id");

-- CreateIndex
CREATE INDEX "itp_templates_source_template_id_idx" ON "itp_templates"("source_template_id");

-- CreateIndex
CREATE INDEX "itp_templates_import_batch_id_idx" ON "itp_templates"("import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "itp_templates_project_id_name_spec_edition_key" ON "itp_templates"("project_id", "name", "spec_edition");

-- AddForeignKey
ALTER TABLE "itp_templates" ADD CONSTRAINT "itp_templates_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "itp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "itp_templates" ADD CONSTRAINT "itp_templates_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

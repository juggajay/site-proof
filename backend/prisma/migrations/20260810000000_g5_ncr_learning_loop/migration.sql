-- Wave G G5 (docs/plans/wave-g-execution-spec-2026-07-31.md §5.3, §5.4).
--
-- Additive only, all-null on apply. Two things:
--
--  1. ncrs.itp_checklist_item_id — the NCR -> failed ITP item link the spec
--     calls the loop's missing edge (§5.2 gap 4). Today the only artefact is a
--     free-text `[itp-item:<uuid>]` marker inside rectification_notes, which is
--     regex-parsed and unindexed. Nullable + SET NULL: deleting a checklist item
--     must never delete the record that work against it did not conform.
--     Backfilled by scripts/backfill-ncr-checklist-items.ts, NOT by this
--     migration — the backfill parses free text and leaves anything it cannot
--     resolve null. Never guess.
--
--  2. template_revision_proposals — where a recurring failure becomes a human's
--     proposed template change (§5.3). Accepting one creates a NEW template
--     revision through the G2 supersession chain; nothing here ever edits a
--     template in place, and no AI writes a row (boundary §0.3.5).
--
-- Nothing is rewritten, no column is dropped, no constraint is tightened on an
-- existing column. The category / root-cause vocabulary is enforced in the
-- ROUTE, behind NCR_LEARNING_LOOP_ENABLED — constraining a live free-text
-- column would mean rewriting stored quality records, which spec §5.2 forbids.

-- AlterTable
ALTER TABLE "ncrs" ADD COLUMN     "itp_checklist_item_id" TEXT;

-- CreateTable
CREATE TABLE "template_revision_proposals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "checklist_item_id" TEXT,
    "ncr_count" INTEGER NOT NULL,
    "subcontractor_count" INTEGER NOT NULL,
    "activity_slug" TEXT,
    "proposed_change" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "proposed_by_id" TEXT,
    "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "resulting_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_revision_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_revision_proposals_project_id_status_proposed_at_idx" ON "template_revision_proposals"("project_id", "status", "proposed_at");

-- CreateIndex
CREATE INDEX "template_revision_proposals_template_id_idx" ON "template_revision_proposals"("template_id");

-- CreateIndex
CREATE INDEX "template_revision_proposals_checklist_item_id_idx" ON "template_revision_proposals"("checklist_item_id");

-- CreateIndex
CREATE INDEX "template_revision_proposals_resulting_template_id_idx" ON "template_revision_proposals"("resulting_template_id");

-- CreateIndex
-- Recurrence-by-checklist-item is always project-scoped (spec §5.4 AT-G31), so
-- the index leads with project_id — the same shape as ncrs_project_id_category_status_idx.
CREATE INDEX "ncrs_project_id_itp_checklist_item_id_idx" ON "ncrs"("project_id", "itp_checklist_item_id");

-- AddForeignKey
ALTER TABLE "ncrs" ADD CONSTRAINT "ncrs_itp_checklist_item_id_fkey" FOREIGN KEY ("itp_checklist_item_id") REFERENCES "itp_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revision_proposals" ADD CONSTRAINT "template_revision_proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revision_proposals" ADD CONSTRAINT "template_revision_proposals_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "itp_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revision_proposals" ADD CONSTRAINT "template_revision_proposals_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "itp_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revision_proposals" ADD CONSTRAINT "template_revision_proposals_resulting_template_id_fkey" FOREIGN KEY ("resulting_template_id") REFERENCES "itp_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revision_proposals" ADD CONSTRAINT "template_revision_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_revision_proposals" ADD CONSTRAINT "template_revision_proposals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Wave G G1 migration 3 of 3 (docs/plans/wave-g-execution-spec-2026-07-31.md §1.5).
-- Additive: one new table.

-- CreateTable
CREATE TABLE "lot_governing_revisions" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "revision_label" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_by_id" TEXT,
    "unlinked_at" TIMESTAMP(3),

    CONSTRAINT "lot_governing_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lot_governing_revisions_lot_id_unlinked_at_idx" ON "lot_governing_revisions"("lot_id", "unlinked_at");

-- CreateIndex
CREATE INDEX "lot_governing_revisions_project_id_entity_type_entity_id_idx" ON "lot_governing_revisions"("project_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "lot_governing_revisions" ADD CONSTRAINT "lot_governing_revisions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_governing_revisions" ADD CONSTRAINT "lot_governing_revisions_linked_by_id_fkey" FOREIGN KEY ("linked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written; Prisma cannot express a partial unique (spec §1.3(c),
-- [GR-A5], AT-G38). Rows are never hard-deleted — unlinking sets
-- `unlinked_at` — so uniqueness has to be scoped to the ACTIVE rows or
-- re-linking after an unlink would collide with the historical row.
CREATE UNIQUE INDEX "lot_governing_revision_active_uniq"
  ON "lot_governing_revisions" ("lot_id", "entity_type", "entity_id")
  WHERE "unlinked_at" IS NULL;

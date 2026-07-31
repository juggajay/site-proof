-- Wave G G1 migration 2 of 3 (docs/plans/wave-g-execution-spec-2026-07-31.md §1.5).
-- Additive and all-null on apply. This is the DG-1 "ride on documents" branch,
-- confirmed by Jay 2026-07-31: specifications, approved methods and client
-- directions are Document rows and gain supersession here rather than getting
-- four dedicated registers.
--
-- Deliberately NOT merged with `is_latest_version` (spec §1.3(b), §1.7 E8).

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "superseded_by_id" TEXT;

-- CreateIndex
CREATE INDEX "documents_project_id_superseded_by_id_idx" ON "documents"("project_id", "superseded_by_id");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

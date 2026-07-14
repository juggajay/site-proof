-- Add provenance columns to diary_events so the day's QA activity can be
-- auto-compiled into the diary as idempotent, reconcilable rows.
-- Additive only: existing rows default to source='manual', source_ref=NULL.
-- AlterTable
ALTER TABLE "diary_events" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "diary_events" ADD COLUMN "source_ref" TEXT;

-- CreateIndex
-- Postgres treats NULLs as distinct, so multiple manual rows (source_ref NULL)
-- never collide; the constraint only enforces one auto row per (diary, sourceRef).
CREATE UNIQUE INDEX "diary_events_diary_id_source_ref_key" ON "diary_events"("diary_id", "source_ref");

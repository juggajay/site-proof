-- H5: offline-sync idempotency keys.
--
-- Strictly additive. Four nullable `request_key` columns plus their scoped
-- unique indexes. No backfill, no NOT NULL, no data rewrite: every existing row
-- keeps request_key NULL, and Postgres treats NULLs as distinct in a unique
-- index, so the new constraints cannot conflict with any historical row.
--
-- The columns carry the client-generated key the offline sync worker sends
-- (its own stable local id for the queued NCR / delivery / event / photo). The
-- unique index is the dedupe: a retry of a request that already committed
-- replays the original row instead of creating a duplicate field record.

-- AlterTable
ALTER TABLE "diary_deliveries" ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "diary_events" ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "request_key" TEXT;

-- AlterTable
ALTER TABLE "ncrs" ADD COLUMN     "request_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "diary_deliveries_diary_id_request_key_key" ON "diary_deliveries"("diary_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "diary_events_diary_id_request_key_key" ON "diary_events"("diary_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "documents_project_id_request_key_key" ON "documents"("project_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "ncrs_project_id_request_key_key" ON "ncrs"("project_id", "request_key");

-- Wave C2 Phase 3 (spec §4.1): the two lab-wait columns.
--
-- Additive and reversible: two nullable columns, no default, no index, no
-- backfill inside the migration. The backfill is a separate manual script
-- (`npm run db:backfill-sent-to-lab`, dry-run by default) because it reads the
-- audit log, which SQL here has no business parsing.
--
-- No index is added on purpose: any at-lab query filters on (project_id, status),
-- which is already indexed, and the register's status filter is client-side.
-- Indexing a column that is NULL for essentially every row is cost without gain.
ALTER TABLE "test_results" ADD COLUMN "sent_to_lab_at" TIMESTAMP(3);
ALTER TABLE "test_results" ADD COLUMN "expected_result_date" TIMESTAMP(3);

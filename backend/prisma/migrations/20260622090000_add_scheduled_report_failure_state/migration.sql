ALTER TABLE "scheduled_reports"
  ADD COLUMN "failure_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_failure_at" TIMESTAMP(3),
  ADD COLUMN "last_failure_reason" TEXT;

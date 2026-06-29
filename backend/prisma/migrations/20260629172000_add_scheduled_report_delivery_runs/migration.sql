ALTER TABLE "notification_digest_items"
  ADD COLUMN "source_key" TEXT;

CREATE UNIQUE INDEX "notification_digest_items_source_key_key"
  ON "notification_digest_items"("source_key");

CREATE TABLE "scheduled_report_runs" (
  "id" TEXT NOT NULL,
  "schedule_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "report_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'processing',
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "sent_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "digest_count" INTEGER NOT NULL DEFAULT 0,
  "suppressed_count" INTEGER NOT NULL DEFAULT 0,
  "error_reason" TEXT,
  "generated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_report_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduled_report_recipient_deliveries" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "schedule_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "recipient_kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "retryable" BOOLEAN NOT NULL DEFAULT false,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "last_attempt_at" TIMESTAMP(3),
  "next_attempt_at" TIMESTAMP(3),
  "error_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_report_recipient_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scheduled_report_runs_schedule_created_idx"
  ON "scheduled_report_runs"("schedule_id", "created_at");

CREATE INDEX "scheduled_report_runs_project_created_idx"
  ON "scheduled_report_runs"("project_id", "created_at");

CREATE INDEX "scheduled_report_runs_status_created_idx"
  ON "scheduled_report_runs"("status", "created_at");

CREATE UNIQUE INDEX "scheduled_report_delivery_run_recipient_key"
  ON "scheduled_report_recipient_deliveries"("run_id", "recipient");

CREATE INDEX "scheduled_report_delivery_schedule_status_next_idx"
  ON "scheduled_report_recipient_deliveries"("schedule_id", "status", "next_attempt_at");

CREATE INDEX "scheduled_report_delivery_schedule_recipient_retry_idx"
  ON "scheduled_report_recipient_deliveries"("schedule_id", "recipient", "retryable");

CREATE INDEX "scheduled_report_delivery_project_created_idx"
  ON "scheduled_report_recipient_deliveries"("project_id", "created_at");

ALTER TABLE "scheduled_report_runs"
  ADD CONSTRAINT "scheduled_report_runs_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_report_runs"
  ADD CONSTRAINT "scheduled_report_runs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_report_recipient_deliveries"
  ADD CONSTRAINT "scheduled_report_deliveries_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "scheduled_report_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_report_recipient_deliveries"
  ADD CONSTRAINT "scheduled_report_deliveries_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "scheduled_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduled_report_recipient_deliveries"
  ADD CONSTRAINT "scheduled_report_deliveries_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

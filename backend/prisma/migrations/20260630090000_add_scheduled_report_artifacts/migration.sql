ALTER TABLE "scheduled_report_runs"
  ADD COLUMN "artifact_file_url" TEXT,
  ADD COLUMN "artifact_report_name" TEXT,
  ADD COLUMN "artifact_filename" TEXT,
  ADD COLUMN "artifact_mime_type" TEXT,
  ADD COLUMN "artifact_file_size" INTEGER,
  ADD COLUMN "artifact_sha256" TEXT,
  ADD COLUMN "artifact_created_at" TIMESTAMP(3);

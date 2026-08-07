CREATE TABLE "design_models" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "design_models_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "design_models_project_id_idx" ON "design_models"("project_id");
ALTER TABLE "design_models" ADD CONSTRAINT "design_models_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "design_models" ADD CONSTRAINT "design_models_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "design_model_versions" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "file_name" TEXT NOT NULL,
    "source_size_bytes" BIGINT NOT NULL,
    "source_sha256" TEXT NOT NULL,
    "source_storage_ref" TEXT,
    "frag_storage_ref" TEXT,
    "frag_size_bytes" BIGINT,
    "converter_version" TEXT,
    "diagnostics" JSONB,
    "lease_owner" TEXT,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_reason" TEXT,
    "uploaded_by" TEXT,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "design_model_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "design_model_versions_model_id_version_number_key" ON "design_model_versions"("model_id", "version_number");
CREATE INDEX "design_model_versions_status_next_attempt_at_idx" ON "design_model_versions"("status", "next_attempt_at");
CREATE INDEX "design_model_versions_source_sha256_idx" ON "design_model_versions"("source_sha256");
ALTER TABLE "design_model_versions" ADD CONSTRAINT "design_model_versions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "design_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "design_model_versions" ADD CONSTRAINT "design_model_versions_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

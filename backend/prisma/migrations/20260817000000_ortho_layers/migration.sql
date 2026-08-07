CREATE TABLE "ortho_layers" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'uploading',
    "file_name" TEXT NOT NULL,
    "source_size_bytes" BIGINT NOT NULL,
    "source_sha256" TEXT NOT NULL,
    "source_storage_ref" TEXT,
    "tile_storage_root" TEXT,
    "bounds_wgs84" JSONB,
    "min_zoom" INTEGER,
    "max_zoom" INTEGER,
    "tile_count" INTEGER,
    "diagnostics" JSONB,
    "lease_owner" TEXT,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failure_reason" TEXT,
    "uploaded_by" TEXT,
    "tiled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ortho_layers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ortho_layers_project_id_idx" ON "ortho_layers"("project_id");
CREATE INDEX "ortho_layers_status_next_attempt_at_idx" ON "ortho_layers"("status", "next_attempt_at");
ALTER TABLE "ortho_layers" ADD CONSTRAINT "ortho_layers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ortho_layers" ADD CONSTRAINT "ortho_layers_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ai_proposals" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "requested_by_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "source_refs" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "warnings" JSONB,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "edited_payload" JSONB,
    "applied_record_ids" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_proposals_project_id_stage_idx" ON "ai_proposals"("project_id", "stage");

-- CreateIndex
CREATE INDEX "ai_proposals_project_id_status_idx" ON "ai_proposals"("project_id", "status");

-- AddForeignKey
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

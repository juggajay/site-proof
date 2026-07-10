-- AlterTable
ALTER TABLE "progress_claims" ADD COLUMN "request_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "progress_claims_project_id_request_key_key" ON "progress_claims"("project_id", "request_key");

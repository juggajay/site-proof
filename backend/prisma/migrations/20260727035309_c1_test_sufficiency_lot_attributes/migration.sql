-- AlterTable
ALTER TABLE "lots" ADD COLUMN     "activity_slug" TEXT,
ADD COLUMN     "quantity_unit" TEXT,
ADD COLUMN     "quantity_value" DECIMAL(65,30),
ADD COLUMN     "test_scale" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "test_sufficiency_mode" TEXT NOT NULL DEFAULT 'warn';

-- CreateIndex
CREATE INDEX "lots_project_activity_slug_conformed_idx" ON "lots"("project_id", "activity_slug", "conformed_at");

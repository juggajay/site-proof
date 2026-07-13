-- CreateTable
CREATE TABLE "plan_sheets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "document_id" TEXT,
    "name" TEXT NOT NULL,
    "page_number" INTEGER NOT NULL DEFAULT 1,
    "image_ref" TEXT NOT NULL,
    "image_width" INTEGER NOT NULL,
    "image_height" INTEGER NOT NULL,
    "coordinate_system" TEXT NOT NULL,
    "registration" JSONB,
    "perimeter" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_sheets_project_id_idx" ON "plan_sheets"("project_id");

-- AddForeignKey
ALTER TABLE "plan_sheets" ADD CONSTRAINT "plan_sheets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sheets" ADD CONSTRAINT "plan_sheets_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_sheets" ADD CONSTRAINT "plan_sheets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

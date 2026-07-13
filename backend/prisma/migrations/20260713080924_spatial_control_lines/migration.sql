-- CreateTable
CREATE TABLE "control_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "coordinate_system" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "geometry_wgs84" JSONB,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "control_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_geometries" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "control_line_id" TEXT,
    "chainage_start" DECIMAL(65,30),
    "chainage_end" DECIMAL(65,30),
    "offset_left" DECIMAL(65,30),
    "offset_right" DECIMAL(65,30),
    "geometry_wgs84" JSONB NOT NULL,
    "area_m2" DECIMAL(65,30),
    "length_m" DECIMAL(65,30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lot_geometries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "control_lines_project_id_idx" ON "control_lines"("project_id");

-- CreateIndex
CREATE INDEX "lot_geometries_lot_id_idx" ON "lot_geometries"("lot_id");

-- AddForeignKey
ALTER TABLE "control_lines" ADD CONSTRAINT "control_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "control_lines" ADD CONSTRAINT "control_lines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_geometries" ADD CONSTRAINT "lot_geometries_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_geometries" ADD CONSTRAINT "lot_geometries_control_line_id_fkey" FOREIGN KEY ("control_line_id") REFERENCES "control_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

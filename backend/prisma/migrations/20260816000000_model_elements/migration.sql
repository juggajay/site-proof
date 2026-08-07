CREATE TABLE "model_elements" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "ifc_guid" TEXT NOT NULL,
    "name" TEXT,
    "category" TEXT,
    "lot_number_value" TEXT,
    "object_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "model_elements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "model_elements_version_id_ifc_guid_key" ON "model_elements"("version_id", "ifc_guid");
ALTER TABLE "model_elements" ADD CONSTRAINT "model_elements_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "design_model_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "model_element_lot_links" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "element_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "model_element_lot_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "model_element_lot_links_element_id_key" ON "model_element_lot_links"("element_id");
CREATE INDEX "model_element_lot_links_version_id_idx" ON "model_element_lot_links"("version_id");
CREATE INDEX "model_element_lot_links_lot_id_idx" ON "model_element_lot_links"("lot_id");
ALTER TABLE "model_element_lot_links" ADD CONSTRAINT "model_element_lot_links_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "design_model_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_element_lot_links" ADD CONSTRAINT "model_element_lot_links_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "model_elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_element_lot_links" ADD CONSTRAINT "model_element_lot_links_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_element_lot_links" ADD CONSTRAINT "model_element_lot_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

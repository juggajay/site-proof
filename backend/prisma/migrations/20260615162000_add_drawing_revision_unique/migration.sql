CREATE UNIQUE INDEX "drawings_project_id_drawing_number_revision_key"
ON "drawings"("project_id", "drawing_number", "revision") NULLS NOT DISTINCT;

DROP INDEX "drawings_project_id_drawing_number_revision_idx";

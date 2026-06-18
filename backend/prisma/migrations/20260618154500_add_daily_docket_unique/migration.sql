CREATE UNIQUE INDEX "daily_dockets_subcontractor_company_id_project_id_date_key"
ON "daily_dockets"("subcontractor_company_id", "project_id", "date");

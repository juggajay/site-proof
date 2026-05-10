-- AddIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- AddIndex
CREATE INDEX "api_keys_user_id_created_at_idx" ON "api_keys"("user_id", "created_at");

-- AddIndex
CREATE INDEX "projects_company_id_status_idx" ON "projects"("company_id", "status");

-- AddIndex
CREATE INDEX "projects_status_created_at_idx" ON "projects"("status", "created_at");

-- AddIndex
CREATE INDEX "project_areas_project_id_chainage_start_idx" ON "project_areas"("project_id", "chainage_start");

-- AddIndex
CREATE INDEX "subcontractor_companies_project_id_status_idx" ON "subcontractor_companies"("project_id", "status");

-- AddIndex
CREATE INDEX "employee_roster_subcontractor_company_id_status_idx" ON "employee_roster"("subcontractor_company_id", "status");

-- AddIndex
CREATE INDEX "plant_register_subcontractor_company_id_status_idx" ON "plant_register"("subcontractor_company_id", "status");

-- AddIndex
CREATE INDEX "daily_dockets_subcontractor_company_id_date_idx" ON "daily_dockets"("subcontractor_company_id", "date");

-- AddIndex
CREATE INDEX "docket_labour_docket_id_idx" ON "docket_labour"("docket_id");

-- AddIndex
CREATE INDEX "docket_labour_employee_id_idx" ON "docket_labour"("employee_id");

-- AddIndex
CREATE INDEX "docket_labour_lots_docket_labour_id_idx" ON "docket_labour_lots"("docket_labour_id");

-- AddIndex
CREATE INDEX "docket_labour_lots_lot_id_idx" ON "docket_labour_lots"("lot_id");

-- AddIndex
CREATE INDEX "docket_plant_docket_id_idx" ON "docket_plant"("docket_id");

-- AddIndex
CREATE INDEX "docket_plant_plant_id_idx" ON "docket_plant"("plant_id");

-- AddIndex
CREATE INDEX "docket_plant_lots_docket_plant_id_idx" ON "docket_plant_lots"("docket_plant_id");

-- AddIndex
CREATE INDEX "docket_plant_lots_lot_id_idx" ON "docket_plant_lots"("lot_id");

-- AddIndex
CREATE INDEX "documents_project_id_uploaded_at_idx" ON "documents"("project_id", "uploaded_at");

-- AddIndex
CREATE INDEX "documents_uploaded_by_uploaded_at_idx" ON "documents"("uploaded_by", "uploaded_at");

-- AddIndex
CREATE INDEX "documents_parent_document_id_idx" ON "documents"("parent_document_id");

-- AddIndex
CREATE INDEX "drawings_project_id_drawing_number_revision_idx" ON "drawings"("project_id", "drawing_number", "revision");

-- AddIndex
CREATE INDEX "drawings_project_id_status_idx" ON "drawings"("project_id", "status");

-- AddIndex
CREATE INDEX "drawings_project_id_superseded_by_id_idx" ON "drawings"("project_id", "superseded_by_id");

-- AddIndex
CREATE INDEX "drawings_document_id_idx" ON "drawings"("document_id");

-- AddIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- AddIndex
CREATE INDEX "sync_queue_user_id_created_at_idx" ON "sync_queue"("user_id", "created_at");

-- AddIndex
CREATE INDEX "password_reset_tokens_user_id_used_at_expires_at_idx" ON "password_reset_tokens"("user_id", "used_at", "expires_at");

-- AddIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- AddIndex
CREATE INDEX "email_verification_tokens_user_id_used_at_expires_at_idx" ON "email_verification_tokens"("user_id", "used_at", "expires_at");

-- AddIndex
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

-- AddIndex
CREATE INDEX "scheduled_reports_is_active_next_run_at_created_at_idx" ON "scheduled_reports"("is_active", "next_run_at", "created_at");

-- AddIndex
CREATE INDEX "scheduled_reports_project_id_created_at_idx" ON "scheduled_reports"("project_id", "created_at");

-- AddIndex
CREATE INDEX "scheduled_reports_created_by_created_at_idx" ON "scheduled_reports"("created_by", "created_at");

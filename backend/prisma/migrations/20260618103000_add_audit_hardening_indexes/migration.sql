-- Safe non-unique indexes from the paying-user hardening audit.
CREATE INDEX "itp_instances_template_id_idx" ON "itp_instances"("template_id");
CREATE INDEX "hold_points_lot_id_status_idx" ON "hold_points"("lot_id", "status");
CREATE INDEX "daily_dockets_subcontractor_company_id_status_idx" ON "daily_dockets"("subcontractor_company_id", "status");

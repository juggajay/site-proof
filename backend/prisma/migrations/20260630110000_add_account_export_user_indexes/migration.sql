-- Account export reads several large record tables by user attribution.
-- These indexes keep GDPR exports from degrading into full table scans as tenants grow.
CREATE INDEX "lots_created_by_created_at_idx" ON "lots"("created_by", "created_at");
CREATE INDEX "itp_completions_completed_by_completed_at_idx" ON "itp_completions"("completed_by", "completed_at");
CREATE INDEX "test_results_entered_by_created_at_idx" ON "test_results"("entered_by", "created_at");
CREATE INDEX "ncrs_raised_by_raised_at_idx" ON "ncrs"("raised_by", "raised_at");
CREATE INDEX "ncrs_responsible_user_raised_at_idx" ON "ncrs"("responsible_user_id", "raised_at");
CREATE INDEX "daily_diaries_submitted_by_created_at_idx" ON "daily_diaries"("submitted_by", "created_at");
CREATE INDEX "comments_author_created_at_idx" ON "comments"("author_id", "created_at");

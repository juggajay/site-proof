-- Onboarding tour: persist an account-level "completed the tour" timestamp so an
-- existing user is never re-shown the first-run product tour on a new device or
-- after clearing local storage. The per-device localStorage marker remains a
-- cache on top of this. Additive + nullable: no backfill, no data loss.
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);

ALTER TABLE "notification_digest_items"
  ADD COLUMN "delivery_failure_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_delivery_failure_at" TIMESTAMP(3),
  ADD COLUMN "last_delivery_failure_reason" TEXT,
  ADD COLUMN "next_attempt_at" TIMESTAMP(3);

CREATE INDEX "digest_items_user_next_attempt_created_idx"
  ON "notification_digest_items"("user_id", "next_attempt_at", "created_at");

CREATE INDEX "digest_items_next_attempt_created_idx"
  ON "notification_digest_items"("next_attempt_at", "created_at");

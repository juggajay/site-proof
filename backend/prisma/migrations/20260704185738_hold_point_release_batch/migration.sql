-- AlterTable
ALTER TABLE "hold_point_release_tokens" ADD COLUMN     "batch_id" TEXT;

-- CreateTable
CREATE TABLE "hold_point_release_batches" (
    "id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scheduled_date" TIMESTAMP(3),
    "scheduled_time" TEXT,
    "requested_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hold_point_release_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hold_point_release_batches_token_key" ON "hold_point_release_batches"("token");

-- CreateIndex
CREATE INDEX "hold_point_release_batches_lot_id_idx" ON "hold_point_release_batches"("lot_id");

-- CreateIndex
CREATE INDEX "hold_point_release_tokens_batch_id_idx" ON "hold_point_release_tokens"("batch_id");

-- AddForeignKey
ALTER TABLE "hold_point_release_tokens" ADD CONSTRAINT "hold_point_release_tokens_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "hold_point_release_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hold_point_release_batches" ADD CONSTRAINT "hold_point_release_batches_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Batch release tokens are stored as sha256:<64 hex> hashes only, mirroring
-- hold_point_release_tokens. NOT VALID keeps the add cheap; all inserts are hashed.
ALTER TABLE "hold_point_release_batches"
  ADD CONSTRAINT "hold_point_release_batches_token_sha256_check"
  CHECK ("token" ~ '^sha256:[0-9a-f]{64}$') NOT VALID;

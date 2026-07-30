-- Wave E2.1 — the Spam Act consent gate for automated hold-point chase mail.
--
-- Additive only: two nullable columns and one new table. No column is dropped,
-- no existing row is rewritten, and every existing row reads as "never opened",
-- which is the fail-closed side of the gate.

-- AlterTable
ALTER TABLE "hold_point_release_batches" ADD COLUMN     "opened_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "hold_point_release_tokens" ADD COLUMN     "opened_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "hold_point_mail_consents" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_opened_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hold_point_mail_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hold_point_mail_consents_email_idx" ON "hold_point_mail_consents"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hold_point_mail_consents_project_id_email_key" ON "hold_point_mail_consents"("project_id", "email");

-- AddForeignKey
ALTER TABLE "hold_point_mail_consents" ADD CONSTRAINT "hold_point_mail_consents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

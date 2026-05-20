-- Add explicit expiry for pending subcontractor portal invitations.
ALTER TABLE "subcontractor_companies"
ADD COLUMN "invitation_expires_at" TIMESTAMP(3);

-- Backfill existing pending invitations from their creation time so old links
-- do not remain valid forever after this migration lands.
UPDATE "subcontractor_companies"
SET "invitation_expires_at" = "created_at" + INTERVAL '14 days'
WHERE "status" = 'pending_approval'
  AND "invitation_expires_at" IS NULL;

CREATE INDEX "subcontractor_companies_status_invitation_expires_at_idx"
ON "subcontractor_companies"("status", "invitation_expires_at");

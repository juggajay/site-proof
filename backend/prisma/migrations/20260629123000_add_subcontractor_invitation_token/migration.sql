-- Store a hashed email-link credential for subcontractor invitation acceptance.
-- The subcontractor row id remains a non-secret database identifier.
ALTER TABLE "subcontractor_companies"
  ADD COLUMN "invitation_token_hash" TEXT;

CREATE UNIQUE INDEX "subcontractor_companies_invitation_token_hash_key"
  ON "subcontractor_companies"("invitation_token_hash");

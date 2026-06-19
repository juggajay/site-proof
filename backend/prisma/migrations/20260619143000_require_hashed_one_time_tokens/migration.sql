-- Enforce hashed bearer-token storage for new one-time token rows.
-- NOT VALID avoids blocking deploy if historical plaintext rows exist; run
-- scripts/backfill-one-time-token-hashes.ts before validating these constraints
-- in a later migration.

ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "password_reset_tokens_token_sha256_check"
  CHECK ("token" ~ '^sha256:[0-9a-f]{64}$') NOT VALID;

ALTER TABLE "email_verification_tokens"
  ADD CONSTRAINT "email_verification_tokens_token_sha256_check"
  CHECK ("token" ~ '^sha256:[0-9a-f]{64}$') NOT VALID;

ALTER TABLE "hold_point_release_tokens"
  ADD CONSTRAINT "hold_point_release_tokens_token_sha256_check"
  CHECK ("token" ~ '^sha256:[0-9a-f]{64}$') NOT VALID;

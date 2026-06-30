-- Exact bearer-token revocation for current-session logout.
-- Tokens are stored as sha256 hashes only, and expire with the JWT.
CREATE TABLE "revoked_auth_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "revoked_auth_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "revoked_auth_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "revoked_auth_tokens_token_hash_sha256_check"
    CHECK ("token_hash" ~ '^sha256:[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "revoked_auth_tokens_token_hash_key"
  ON "revoked_auth_tokens"("token_hash");

CREATE INDEX "revoked_auth_tokens_user_id_revoked_at_idx"
  ON "revoked_auth_tokens"("user_id", "revoked_at");

CREATE INDEX "revoked_auth_tokens_expires_at_idx"
  ON "revoked_auth_tokens"("expires_at");

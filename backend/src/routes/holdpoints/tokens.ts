import { Prisma } from '@prisma/client';
import crypto from 'crypto';

/**
 * Hold-point release-token helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts as a slice of the holdpoints route split
 * (engineering-health Workstream 1).
 *
 * Hold-point release links are bearer tokens emailed to recipients. The stored
 * token is a `sha256:`-prefixed SHA-256 hash of the secret, so a database leak
 * does not expose usable links. Lookup hashes the presented raw token and also
 * accepts a legacy plaintext match (older tokens issued before hashing) — but
 * never accepts an already-prefixed hash directly as a bearer token. Behaviour —
 * the exact hash prefix, the sha256 hex digest, the legacy plaintext fallback,
 * and the Prisma `OR` where shape — is preserved exactly as it was inline in the
 * route file. The helpers are unit-tested in tokens.test.ts.
 */

// Secure link expiry time (48 hours)
export const SECURE_LINK_EXPIRY_HOURS = 48;
export const HOLD_POINT_TOKEN_HASH_PREFIX = 'sha256:';
export const HOLD_POINT_LEGACY_PLAINTEXT_CREATED_BEFORE = new Date('2026-06-22T00:00:00.000+10:00');

export function hashHoldPointReleaseToken(token: string): string {
  return `${HOLD_POINT_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

export function holdPointReleaseTokenLookup(
  rawToken: string,
): Prisma.HoldPointReleaseTokenWhereInput {
  const conditions: Prisma.HoldPointReleaseTokenWhereInput[] = [
    { token: hashHoldPointReleaseToken(rawToken) },
  ];

  // Legacy plaintext release tokens remain valid until their normal expiry.
  // Prefixed hashes are never accepted directly as bearer tokens.
  if (!rawToken.startsWith(HOLD_POINT_TOKEN_HASH_PREFIX)) {
    conditions.push({
      token: rawToken,
      createdAt: { lt: HOLD_POINT_LEGACY_PLAINTEXT_CREATED_BEFORE },
      expiresAt: { gt: new Date() },
    });
  }

  return { OR: conditions };
}

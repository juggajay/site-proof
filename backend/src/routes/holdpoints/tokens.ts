import { Prisma } from '@prisma/client';
import crypto from 'crypto';

/**
 * Hold-point release-token helpers, extracted verbatim from
 * backend/src/routes/holdpoints.ts as a slice of the holdpoints route split
 * (engineering-health Workstream 1).
 *
 * Hold-point release links are bearer tokens emailed to recipients. The stored
 * token is a `sha256:`-prefixed SHA-256 hash of the secret, so a database leak
 * does not expose usable links. Lookup hashes the presented raw token and never
 * accepts a plaintext database value or an already-prefixed hash directly as a
 * bearer token. The helpers are unit-tested in tokens.test.ts.
 */

// Secure link expiry time (48 hours)
export const SECURE_LINK_EXPIRY_HOURS = 48;
export const HOLD_POINT_TOKEN_HASH_PREFIX = 'sha256:';

export function hashHoldPointReleaseToken(token: string): string {
  return `${HOLD_POINT_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

export function holdPointReleaseTokenLookup(
  rawToken: string,
): Prisma.HoldPointReleaseTokenWhereInput {
  return { token: hashHoldPointReleaseToken(rawToken) };
}

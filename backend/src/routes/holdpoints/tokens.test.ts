import { describe, expect, it } from 'vitest';
import {
  HOLD_POINT_LEGACY_PLAINTEXT_CREATED_BEFORE,
  HOLD_POINT_TOKEN_HASH_PREFIX,
  SECURE_LINK_EXPIRY_HOURS,
  hashHoldPointReleaseToken,
  holdPointReleaseTokenLookup,
} from './tokens.js';

/**
 * Characterizes the hold-point release-token helpers extracted verbatim from
 * backend/src/routes/holdpoints.ts. These freeze the security-relevant
 * behaviour: the `sha256:` storage prefix, the exact SHA-256 hex digest, the
 * bounded legacy plaintext fallback for raw tokens, and the rule that an
 * already-prefixed hash is never accepted directly as a bearer token.
 *
 * No database is touched: tokens.ts imports the Prisma namespace for a type only
 * and never constructs a client. The expected hashes below are public SHA-256
 * vectors, asserted as literals so the test does not tautologically re-derive
 * the digest with the same algorithm the implementation uses.
 */

// Public SHA-256 vectors (hex digest of the UTF-8 input).
const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

describe('token constants', () => {
  it('keeps the 48-hour secure-link expiry and the sha256: hash prefix', () => {
    expect(SECURE_LINK_EXPIRY_HOURS).toBe(48);
    expect(HOLD_POINT_TOKEN_HASH_PREFIX).toBe('sha256:');
    expect(HOLD_POINT_LEGACY_PLAINTEXT_CREATED_BEFORE.toISOString()).toBe(
      '2026-06-21T14:00:00.000Z',
    );
  });
});

describe('hashHoldPointReleaseToken', () => {
  it('prefixes the SHA-256 hex digest with sha256:', () => {
    expect(hashHoldPointReleaseToken('')).toBe(`sha256:${SHA256_EMPTY}`);
    expect(hashHoldPointReleaseToken('abc')).toBe(`sha256:${SHA256_ABC}`);
  });

  it('produces a sha256: prefix followed by a 64-char lowercase hex digest', () => {
    const hashed = hashHoldPointReleaseToken('some-release-token');
    expect(hashed.startsWith('sha256:')).toBe(true);
    expect(hashed.slice('sha256:'.length)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic and input-sensitive', () => {
    expect(hashHoldPointReleaseToken('token-a')).toBe(hashHoldPointReleaseToken('token-a'));
    expect(hashHoldPointReleaseToken('token-a')).not.toBe(hashHoldPointReleaseToken('token-b'));
  });
});

describe('holdPointReleaseTokenLookup', () => {
  it('always includes the hashed form of the presented raw token first', () => {
    const raw = 'plain-release-token';
    const where = holdPointReleaseTokenLookup(raw);
    const conditions = where.OR as { token: string }[];

    expect(conditions[0]).toEqual({ token: hashHoldPointReleaseToken(raw) });
  });

  it('adds an expiry and creation-time-bounded legacy plaintext fallback for a raw token', () => {
    const raw = 'plain-release-token';
    const where = holdPointReleaseTokenLookup(raw);
    const conditions = where.OR as Array<Record<string, unknown>>;

    expect(conditions).toHaveLength(2);
    expect(conditions[0]).toEqual({ token: hashHoldPointReleaseToken(raw) });
    expect(conditions[1]).toEqual({
      token: raw,
      createdAt: { lt: HOLD_POINT_LEGACY_PLAINTEXT_CREATED_BEFORE },
      expiresAt: { gt: expect.any(Date) },
    });
  });

  it('does NOT add a plaintext fallback when the raw token already starts with sha256:', () => {
    const raw = `sha256:${SHA256_ABC}`; // looks like a stored hash
    const where = holdPointReleaseTokenLookup(raw);
    const conditions = where.OR as { token: string }[];

    // Only the re-hashed condition — a prefixed hash is never accepted as a bearer token.
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toEqual({ token: hashHoldPointReleaseToken(raw) });
    // The presented hash is itself re-hashed, so it is not used as a literal token match.
    expect(conditions).not.toContainEqual({ token: raw });
  });
});

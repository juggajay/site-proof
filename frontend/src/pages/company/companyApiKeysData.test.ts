import { describe, expect, it } from 'vitest';
import {
  canRevokeApiKey,
  describeApiKeyStatus,
  formatApiKeyLastUsed,
  type CompanyApiKey,
} from './companyApiKeysData';

function key(overrides: Partial<CompanyApiKey> = {}): CompanyApiKey {
  return {
    id: 'key-1',
    name: 'CI key',
    keyPrefix: 'sp_abcd123',
    scopes: 'read',
    lastUsedAt: null,
    expiresAt: null,
    isActive: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    owner: { id: 'user-1', fullName: 'Owner One', email: 'o@x.test' },
    ...overrides,
  };
}

describe('canRevokeApiKey', () => {
  it('allows revoking an active key the current user owns', () => {
    expect(canRevokeApiKey(key({ isActive: true }), 'user-1')).toBe(true);
  });

  it('does not allow revoking another user’s key', () => {
    expect(canRevokeApiKey(key({ isActive: true }), 'user-2')).toBe(false);
  });

  it('does not allow revoking an already-revoked key', () => {
    expect(canRevokeApiKey(key({ isActive: false }), 'user-1')).toBe(false);
  });

  it('handles an unknown current user or ownerless key', () => {
    expect(canRevokeApiKey(key(), undefined)).toBe(false);
    expect(canRevokeApiKey(key({ owner: null }), 'user-1')).toBe(false);
  });
});

describe('describeApiKeyStatus', () => {
  it('labels active and revoked keys', () => {
    expect(describeApiKeyStatus({ isActive: true })).toBe('Active');
    expect(describeApiKeyStatus({ isActive: false })).toBe('Revoked');
  });
});

describe('formatApiKeyLastUsed', () => {
  it('returns a friendly never-used label when the key has not been used', () => {
    expect(formatApiKeyLastUsed(null)).toBe('Never used');
  });

  it('formats an actual last-used timestamp', () => {
    expect(formatApiKeyLastUsed('2026-06-20T00:00:00.000Z')).not.toBe('Never used');
  });
});

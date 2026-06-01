import { describe, expect, it } from 'vitest';

import {
  buildApiKeyCreatedResponse,
  buildApiKeyListResponse,
  buildApiKeyRevokedResponse,
} from './responses.js';

describe('API key response helpers', () => {
  it('preserves the create response shape and one-time raw key', () => {
    const createdAt = new Date('2026-06-01T00:00:00.000Z');
    const expiresAt = new Date('2026-07-01T00:00:00.000Z');
    const apiKeyRecord = {
      id: 'key-1',
      name: 'Integration',
      keyPrefix: 'sp_abcdef12',
      scopes: 'read,write',
      expiresAt,
      createdAt,
    };

    expect(buildApiKeyCreatedResponse(apiKeyRecord, 'sp_raw')).toEqual({
      apiKey: {
        ...apiKeyRecord,
        key: 'sp_raw',
      },
      message: 'API key created. Save this key securely - it cannot be retrieved again.',
    });
  });

  it('preserves the list response envelope', () => {
    const apiKeys = [
      {
        id: 'key-1',
        name: 'Integration',
        keyPrefix: 'sp_abcdef12',
        scopes: 'read',
        lastUsedAt: null,
        expiresAt: null,
        isActive: true,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    ];

    expect(buildApiKeyListResponse(apiKeys)).toEqual({ apiKeys });
  });

  it('preserves the revoke response message', () => {
    expect(buildApiKeyRevokedResponse()).toEqual({
      message: 'API key revoked successfully',
    });
  });
});

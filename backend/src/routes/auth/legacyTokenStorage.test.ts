import { describe, expect, it, vi } from 'vitest';

import { upgradeLegacyOneTimeTokenStorage } from './legacyTokenStorage.js';

function hashTokenForTest(token: string): string {
  return `hashed:${token}`;
}

describe('upgradeLegacyOneTimeTokenStorage', () => {
  it('does not rewrite tokens already stored as hashes', async () => {
    const updateToken = vi.fn();

    await upgradeLegacyOneTimeTokenStorage({
      context: 'Test Token',
      tokenRecord: { id: 'token-1', token: hashTokenForTest('raw-token') },
      rawToken: 'raw-token',
      hashOneTimeToken: hashTokenForTest,
      updateToken,
    });

    expect(updateToken).not.toHaveBeenCalled();
  });

  it('rewrites legacy plaintext token records to the hashed value', async () => {
    const updateToken = vi.fn(async () => 1);
    const tokenRecord = { id: 'token-1', token: 'raw-token' };

    await upgradeLegacyOneTimeTokenStorage({
      context: 'Test Token',
      tokenRecord,
      rawToken: 'raw-token',
      hashOneTimeToken: hashTokenForTest,
      updateToken,
    });

    expect(updateToken).toHaveBeenCalledWith(tokenRecord, 'hashed:raw-token');
  });

  it('does not fail token validation when a best-effort rewrite fails', async () => {
    const updateToken = vi.fn(async () => {
      throw new Error('unique collision');
    });

    await expect(
      upgradeLegacyOneTimeTokenStorage({
        context: 'Test Token',
        tokenRecord: { id: 'token-1', token: 'raw-token' },
        rawToken: 'raw-token',
        hashOneTimeToken: hashTokenForTest,
        updateToken,
      }),
    ).resolves.toBeUndefined();
  });
});

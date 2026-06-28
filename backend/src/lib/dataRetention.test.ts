import { describe, expect, it, vi } from 'vitest';
import { applyRetentionPolicies } from './dataRetention.js';

function makeClient() {
  return {
    passwordResetToken: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    emailVerificationToken: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    syncQueue: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    documentSignedUrlToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    holdPointReleaseToken: { deleteMany: vi.fn().mockResolvedValue({ count: 4 }) },
    revokedAuthToken: { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) },
  };
}

describe('applyRetentionPolicies (GAP-B/C)', () => {
  it('deletes expired tokens + processed sync rows and returns per-category totals', async () => {
    const client = makeClient();

    const result = await applyRetentionPolicies(client as any);

    expect(client.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
    expect(client.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
    expect(client.syncQueue.deleteMany).toHaveBeenCalledWith({
      where: { status: 'synced', syncedAt: { lt: expect.any(Date) } },
    });
    expect(client.documentSignedUrlToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });

    // GAP-C: expired and old-used hold-point release (capability) tokens are purged.
    expect(client.holdPointReleaseToken.deleteMany).toHaveBeenCalledTimes(1);
    const hpWhere = client.holdPointReleaseToken.deleteMany.mock.calls[0][0].where;
    expect(hpWhere.OR).toEqual([
      { expiresAt: { lt: expect.any(Date) } },
      { usedAt: { not: null, lt: expect.any(Date) } },
    ]);
    expect(client.revokedAuthToken.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });

    expect(result.totalDeleted).toBe(2 + 1 + 3 + 0 + 4 + 5);
    expect(result.holdPointReleaseTokens).toBe(4);
    expect(result.passwordResetTokens).toBe(2);
    expect(result.revokedAuthTokens).toBe(5);
  });
});

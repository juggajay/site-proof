import { Prisma } from '@prisma/client';
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
    productEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 6 }) },
    // Wave E2.1 — the consent/unsubscribe sweep (E.0 item 16's required policy).
    holdPointMailConsent: { deleteMany: vi.fn().mockResolvedValue({ count: 8 }) },
    importBatch: { updateMany: vi.fn().mockResolvedValue({ count: 7 }) },
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

    // A6: product/UX telemetry purged past its 180-day window.
    expect(client.productEvent.deleteMany).toHaveBeenCalledWith({
      where: { createdAt: { lt: expect.any(Date) } },
    });

    // Review §4b: the abandoned-import-batch sweep had NO invoker. This is it.
    expect(client.importBatch.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['uploaded', 'parsed', 'mapped', 'dry_run', 'review'] },
        updatedAt: { lt: expect.any(Date) },
      },
      data: { status: 'cancelled', parseResult: Prisma.DbNull, dryRun: Prisma.DbNull },
    });
    // Wave E2.1 — E.0 item 16 allowed the mail-consent table only if it shipped
    // WITH a retention policy. This is the invoker for that policy, and the
    // shape of the predicate is the policy: an UNSUBSCRIBED row is never swept,
    // because deleting an opt-out is how mail to someone who said stop resumes.
    expect(client.holdPointMailConsent.deleteMany).toHaveBeenCalledWith({
      where: { unsubscribedAt: null, updatedAt: { lt: expect.any(Date) } },
    });
    expect(result.holdPointMailConsents).toBe(8);

    expect(result.abandonedImportBatches).toBe(7);
    // …and it stays OUT of `totalDeleted`: a swept batch is cancelled, not deleted.
    expect(result.totalDeleted).toBe(2 + 1 + 3 + 0 + 4 + 5 + 6 + 8);
    expect(result.holdPointReleaseTokens).toBe(4);
    expect(result.passwordResetTokens).toBe(2);
    expect(result.revokedAuthTokens).toBe(5);
    expect(result.productEvents).toBe(6);
  });

  it('never deletes an audit row, even when the client offers the table', async () => {
    // Wave E.0 §9.3 side finding 2 asked whether `RETENTION_POLICIES.auditLogs`
    // should be "wired". It must not be: `chaseCore.ts:391` resolves a hold
    // point's original requester from an `HP_RELEASE_REQUESTED` row long after
    // every capability token for it is purged, and `AuditLog` is the compliance
    // record. The omission from `RetentionPrismaClient` is the design; this is
    // the guard that makes it fail loudly instead of silently deleting.
    const client = { ...makeClient(), auditLog: { deleteMany: vi.fn() } };

    await applyRetentionPolicies(client as any);

    expect(client.auditLog.deleteMany).not.toHaveBeenCalled();
  });
});

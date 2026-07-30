import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from './prisma.js';
import {
  isRegisteredProductEvent,
  parseProductEventItem,
  writeProductEvents,
} from './productEvents.js';
import { applyRetentionPolicies, DAYS_TO_MS, RETENTION_POLICIES } from './dataRetention.js';
import { createTestUser } from '../test/setup.js';

describe('parseProductEventItem (catalog + metadata whitelist)', () => {
  const identity = { userId: 'session-user', companyId: 'session-company' };

  it('accepts a registered event and keeps only whitelisted metadata keys', () => {
    const row = parseProductEventItem(
      {
        event: 'lot_create.succeeded',
        metadata: { activityType: 'earthworks', usedSuggestedTemplate: true, secret: 'drop me' },
      },
      identity,
    );

    expect(row).not.toBeNull();
    expect(row!.event).toBe('lot_create.succeeded');
    // Non-whitelisted `secret` is stripped, never persisted.
    expect(row!.metadata).toEqual({ activityType: 'earthworks', usedSuggestedTemplate: true });
    // Identity always comes from the session, never the client body.
    expect(row!.userId).toBe('session-user');
    expect(row!.companyId).toBe('session-company');
  });

  it('rejects an unregistered event name', () => {
    expect(isRegisteredProductEvent('lot.delete.everything')).toBe(false);
    expect(parseProductEventItem({ event: 'lot.delete.everything' }, identity)).toBeNull();
  });

  it('rejects metadata with a wrong-typed whitelisted key', () => {
    expect(
      parseProductEventItem(
        { event: 'lot_create.opened', metadata: { usedSuggestedTemplate: 'yes' } },
        identity,
      ),
    ).toBeNull();
  });
});

describe('writeProductEvents (DB-backed, best-effort)', () => {
  const userIds: string[] = [];

  afterEach(async () => {
    if (userIds.length === 0) return;
    await prisma.productEvent.deleteMany({ where: { userId: { in: userIds } } });
    for (const id of userIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
    userIds.length = 0;
  });

  it('persists a validated batch with structured metadata', async () => {
    const user = await createTestUser();
    userIds.push(user.id);
    const identity = { userId: user.id, companyId: user.companyId };

    await writeProductEvents([
      parseProductEventItem(
        { event: 'lot_create.opened', metadata: { activityType: 'earthworks' } },
        identity,
      )!,
      parseProductEventItem(
        { event: 'lot_create.succeeded', metadata: { usedSuggestedTemplate: false } },
        identity,
      )!,
    ]);

    const rows = await prisma.productEvent.findMany({
      where: { userId: user.id },
      orderBy: { event: 'asc' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].event).toBe('lot_create.opened');
    expect(rows[0].metadata).toEqual({ activityType: 'earthworks' });
    expect(rows[1].event).toBe('lot_create.succeeded');
  });

  it('swallows a write failure (bad FK) without throwing', async () => {
    await expect(
      writeProductEvents([{ event: 'lot_create.opened', userId: 'does-not-exist' } as never]),
    ).resolves.toBeUndefined();
  });
});

describe('product-events retention (DB-backed)', () => {
  // Stub the non-telemetry tables so the shared test DB takes no collateral;
  // productEvent is the real client, so the 180-day cutoff + deleteMany run for real.
  // Only `productEvent` is real; every other table is stubbed so this test
  // measures the product-event window and nothing else. The `as never` cast is
  // what lets it stay a partial — which also means TypeScript will NOT tell you
  // when `applyRetentionPolicies` grows a table. Add its stub here when it does.
  function clientWithRealProductEvent() {
    const noop = { deleteMany: async () => ({ count: 0 }) };
    return {
      passwordResetToken: noop,
      emailVerificationToken: noop,
      syncQueue: noop,
      documentSignedUrlToken: noop,
      holdPointReleaseToken: noop,
      revokedAuthToken: noop,
      productEvent: prisma.productEvent,
      holdPointMailConsent: noop,
      // The abandoned-import-batch sweep CANCELS (updateMany), it does not delete.
      importBatch: { updateMany: async () => ({ count: 0 }) },
    } as never;
  }

  it('deletes events older than 180 days and keeps recent ones', async () => {
    const user = await createTestUser();
    const oldDate = new Date(Date.now() - (RETENTION_POLICIES.productEvents + 5) * DAYS_TO_MS);
    const old = await prisma.productEvent.create({
      data: { userId: user.id, event: 'lot_create.opened', createdAt: oldDate },
    });
    const recent = await prisma.productEvent.create({
      data: { userId: user.id, event: 'lot_create.opened' },
    });

    const result = await applyRetentionPolicies(clientWithRealProductEvent());
    expect(result.productEvents).toBeGreaterThanOrEqual(1);

    expect(await prisma.productEvent.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.productEvent.findUnique({ where: { id: recent.id } })).not.toBeNull();

    await prisma.productEvent.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

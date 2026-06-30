import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import * as email from './email.js';
import { clearEmailQueue, getQueuedEmails } from './email.js';
import { processDueNotificationDigests } from './notificationJobs.js';
import { prisma } from './prisma.js';

async function createDigestUser(
  dailyDigest = true,
  id?: string,
  preferenceOverrides: Partial<Prisma.NotificationEmailPreferenceUncheckedCreateInput> = {},
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      ...(id ? { id } : {}),
      email: `digest-${id ?? suffix}@example.com`,
      passwordHash: 'hash',
      fullName: 'Digest User',
      emailVerified: true,
    },
  });

  await prisma.notificationEmailPreference.create({
    data: {
      userId: user.id,
      enabled: true,
      dailyDigest,
      ...preferenceOverrides,
    },
  });

  return user;
}

async function cleanupDigestUser(userId: string) {
  await prisma.notificationDigestItem.deleteMany({ where: { userId } });
  await prisma.notificationEmailPreference.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

afterEach(() => {
  clearEmailQueue();
});

describe('processDueNotificationDigests', () => {
  it('sends due digest items and leaves future items queued', async () => {
    const user = await createDigestUser(true);
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));
    const dueAt = new Date(Date.UTC(2026, 4, 10, 16, 30, 0, 0));
    // After `now`: the cutoff is the run instant (items are deleted after send),
    // so an item created after `now` is held for the next digest window.
    const futureAt = new Date(Date.UTC(2026, 4, 10, 17, 45, 0, 0));

    await prisma.notificationDigestItem.createMany({
      data: [
        {
          userId: user.id,
          type: 'mentions',
          title: 'Mentioned on NCR',
          message: 'A teammate mentioned you on NCR-001',
          projectName: 'Gateway Upgrade',
          linkUrl: '/projects/project-1/ncr?ncr=ncr-1',
          createdAt: dueAt,
        },
        {
          userId: user.id,
          type: 'commentReply',
          title: 'Later reply',
          message: 'This item should wait until the next digest window',
          createdAt: futureAt,
        },
      ],
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.cutoffAt).toBe(now.toISOString());

      const queuedEmails = getQueuedEmails();
      expect(queuedEmails).toHaveLength(1);
      expect(queuedEmails[0]!.to).toBe(user.email);
      expect(queuedEmails[0]!.subject).toContain('Daily Digest');
      expect(queuedEmails[0]!.text).toContain('Mentioned on NCR');
      expect(queuedEmails[0]!.text).not.toContain('Later reply');

      const remainingItems = await prisma.notificationDigestItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0]!.title).toBe('Later reply');
    } finally {
      await cleanupDigestUser(user.id);
    }
  });

  it('filters queued items against current category opt-outs before sending', async () => {
    const user = await createDigestUser(true, undefined, { ncrAssigned: false });
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));
    const dueAt = new Date(Date.UTC(2026, 4, 10, 16, 30, 0, 0));

    await prisma.notificationDigestItem.createMany({
      data: [
        {
          userId: user.id,
          type: 'mentions',
          title: 'Allowed mention',
          message: 'This category is still enabled',
          createdAt: dueAt,
        },
        {
          userId: user.id,
          type: 'ncrAssigned',
          title: 'Suppressed NCR',
          message: 'This category was disabled after queueing',
          createdAt: dueAt,
        },
      ],
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });

      expect(result.sent).toBe(1);
      expect(result.results[0]!.itemCount).toBe(1);

      const queuedEmails = getQueuedEmails();
      expect(queuedEmails).toHaveLength(1);
      expect(queuedEmails[0]!.text).toContain('Allowed mention');
      expect(queuedEmails[0]!.text).not.toContain('Suppressed NCR');

      await expect(
        prisma.notificationDigestItem.count({ where: { userId: user.id } }),
      ).resolves.toBe(0);
    } finally {
      await cleanupDigestUser(user.id);
    }
  });

  it('deletes due digest items without emailing when every queued category is now disabled', async () => {
    const user = await createDigestUser(true, undefined, { ncrAssigned: false });
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));

    await prisma.notificationDigestItem.create({
      data: {
        userId: user.id,
        type: 'ncrAssigned',
        title: 'Suppressed NCR',
        message: 'This category was disabled after queueing',
        createdAt: new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0)),
      },
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });

      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(1);
      expect(getQueuedEmails()).toHaveLength(0);
      await expect(
        prisma.notificationDigestItem.count({ where: { userId: user.id } }),
      ).resolves.toBe(0);
    } finally {
      await cleanupDigestUser(user.id);
    }
  });

  it('does not send before the configured digest time', async () => {
    const user = await createDigestUser(true);
    const now = new Date(Date.UTC(2026, 4, 10, 16, 30, 0, 0));

    await prisma.notificationDigestItem.create({
      data: {
        userId: user.id,
        type: 'mentions',
        title: 'Queued mention',
        message: 'This should wait for the digest window',
        createdAt: new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0)),
      },
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(getQueuedEmails()).toHaveLength(0);
      await expect(
        prisma.notificationDigestItem.count({ where: { userId: user.id } }),
      ).resolves.toBe(1);
    } finally {
      await cleanupDigestUser(user.id);
    }
  });

  it('skips users that have disabled daily digest delivery', async () => {
    const user = await createDigestUser(false);
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));

    await prisma.notificationDigestItem.create({
      data: {
        userId: user.id,
        type: 'mentions',
        title: 'Queued mention',
        message: 'This user disabled digest delivery',
        createdAt: new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0)),
      },
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });

      expect(result.processed).toBe(0);
      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(0);
      await expect(
        prisma.notificationDigestItem.count({ where: { userId: user.id } }),
      ).resolves.toBe(1);
      expect(getQueuedEmails()).toHaveLength(0);
    } finally {
      await cleanupDigestUser(user.id);
    }
  });

  it('selects enabled digest users before applying the user batch limit', async () => {
    const disabledUsers = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createDigestUser(false, `digest-disabled-${Date.now()}-${index}`),
      ),
    );
    const enabledUser = await createDigestUser(true, `digest-enabled-${Date.now()}`);
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));
    const dueAt = new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0));
    const allUsers = [...disabledUsers, enabledUser];

    await prisma.notificationDigestItem.createMany({
      data: allUsers.map((user) => ({
        userId: user.id,
        type: 'mentions',
        title: user.id === enabledUser.id ? 'Enabled digest item' : 'Disabled digest item',
        message: 'Queued digest item',
        createdAt: dueAt,
      })),
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: allUsers.map((user) => user.id),
        limit: 1,
      });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(getQueuedEmails()).toHaveLength(1);
      expect(getQueuedEmails()[0]!.to).toBe(enabledUser.email);

      await expect(
        prisma.notificationDigestItem.count({
          where: { userId: { in: disabledUsers.map((user) => user.id) } },
        }),
      ).resolves.toBe(disabledUsers.length);
    } finally {
      for (const user of allUsers) {
        await cleanupDigestUser(user.id);
      }
    }
  });

  it('backs off failed digest users so later due users are not starved by the batch limit', async () => {
    const suffix = Date.now();
    const failingUser = await createDigestUser(true, `digest-a-failing-${suffix}`);
    const laterUser = await createDigestUser(true, `digest-b-later-${suffix}`);
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));
    const dueAt = new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0));
    const retryDelayMs = 60 * 60 * 1000;
    const digestSpy = vi.spyOn(email, 'sendDailyDigestEmail').mockImplementation(async (to) => {
      if (to === failingUser.email) {
        return { success: false, error: 'provider temporarily unavailable' };
      }

      return { success: true, messageId: 'sent-ok', provider: 'mock' };
    });

    await prisma.notificationDigestItem.createMany({
      data: [failingUser, laterUser].map((user) => ({
        userId: user.id,
        type: 'mentions',
        title: user.id === failingUser.id ? 'Failing digest item' : 'Later digest item',
        message: 'Queued digest item',
        createdAt: dueAt,
      })),
    });

    try {
      const firstRun = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [failingUser.id, laterUser.id],
        limit: 1,
        failureRetryDelayMs: retryDelayMs,
      });

      expect(firstRun.processed).toBe(1);
      expect(firstRun.failed).toBe(1);
      expect(firstRun.results[0]).toMatchObject({
        userId: failingUser.id,
        status: 'failed',
        error: 'provider temporarily unavailable',
      });

      const backedOffItem = await prisma.notificationDigestItem.findFirstOrThrow({
        where: { userId: failingUser.id },
      });
      expect(backedOffItem.deliveryFailureCount).toBe(1);
      expect(backedOffItem.lastDeliveryFailureReason).toBe('provider temporarily unavailable');
      expect(backedOffItem.nextAttemptAt?.toISOString()).toBe(
        new Date(now.getTime() + retryDelayMs).toISOString(),
      );

      const secondRun = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [failingUser.id, laterUser.id],
        limit: 1,
        failureRetryDelayMs: retryDelayMs,
      });

      expect(secondRun.processed).toBe(1);
      expect(secondRun.sent).toBe(1);
      expect(secondRun.results[0]).toMatchObject({
        userId: laterUser.id,
        status: 'sent',
      });
      expect(digestSpy.mock.calls.map(([to]) => to)).toEqual([failingUser.email, laterUser.email]);
    } finally {
      digestSpy.mockRestore();
      await cleanupDigestUser(failingUser.id);
      await cleanupDigestUser(laterUser.id);
    }
  });

  it('backs off only digest items included in the failed email attempt', async () => {
    const user = await createDigestUser(true, `digest-item-limit-${Date.now()}`);
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));
    const firstDueAt = new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0));
    const secondDueAt = new Date(Date.UTC(2026, 4, 10, 15, 5, 0, 0));
    const digestSpy = vi
      .spyOn(email, 'sendDailyDigestEmail')
      .mockResolvedValue({ success: false, error: 'provider unavailable' });

    await prisma.notificationDigestItem.createMany({
      data: [
        {
          userId: user.id,
          type: 'mentions',
          title: 'Attempted item',
          message: 'This item is inside the item limit',
          createdAt: firstDueAt,
        },
        {
          userId: user.id,
          type: 'mentions',
          title: 'Unattempted item',
          message: 'This item is outside the item limit',
          createdAt: secondDueAt,
        },
      ],
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
        itemLimit: 1,
        failureRetryDelayMs: 60 * 60 * 1000,
      });

      expect(result.failed).toBe(1);
      expect(digestSpy).toHaveBeenCalledWith(
        user.email,
        expect.arrayContaining([expect.objectContaining({ title: 'Attempted item' })]),
      );
      expect(digestSpy.mock.calls[0]?.[1]).toHaveLength(1);

      const items = await prisma.notificationDigestItem.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        title: 'Attempted item',
        deliveryFailureCount: 1,
        lastDeliveryFailureReason: 'provider unavailable',
      });
      expect(items[0]!.nextAttemptAt).toBeTruthy();
      expect(items[1]).toMatchObject({
        title: 'Unattempted item',
        deliveryFailureCount: 0,
        lastDeliveryFailureReason: null,
        nextAttemptAt: null,
      });
    } finally {
      digestSpy.mockRestore();
      await cleanupDigestUser(user.id);
    }
  });

  it('does not send duplicate digest emails when a concurrent worker starts mid-send', async () => {
    const user = await createDigestUser(true);
    const now = new Date(Date.UTC(2026, 4, 10, 17, 30, 0, 0));
    let releaseFirstSend: () => void = () => {};
    let firstSendStarted: () => void = () => {};
    const firstSendStartedPromise = new Promise<void>((resolve) => {
      firstSendStarted = resolve;
    });
    const releaseFirstSendPromise = new Promise<void>((resolve) => {
      releaseFirstSend = resolve;
    });
    let sendCalls = 0;
    const digestSpy = vi.spyOn(email, 'sendDailyDigestEmail').mockImplementation(async () => {
      sendCalls += 1;
      if (sendCalls === 1) {
        firstSendStarted();
        await releaseFirstSendPromise;
      }
      return { success: true };
    });

    await prisma.notificationDigestItem.create({
      data: {
        userId: user.id,
        type: 'mentions',
        title: 'Queued mention',
        message: 'This item should only be sent once',
        createdAt: new Date(Date.UTC(2026, 4, 10, 15, 0, 0, 0)),
      },
    });

    try {
      const firstRun = processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });
      await firstSendStartedPromise;

      const secondRun = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });
      releaseFirstSend();
      const firstResult = await firstRun;

      expect(firstResult.sent).toBe(1);
      expect(secondRun.processed).toBe(0);
      expect(secondRun.sent).toBe(0);
      expect(digestSpy).toHaveBeenCalledTimes(1);
      await expect(
        prisma.notificationDigestItem.count({ where: { userId: user.id } }),
      ).resolves.toBe(0);
    } finally {
      releaseFirstSend();
      digestSpy.mockRestore();
      await cleanupDigestUser(user.id);
    }
  });
});

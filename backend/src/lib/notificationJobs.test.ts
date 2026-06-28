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

import { afterEach, describe, expect, it } from 'vitest';
import { clearEmailQueue, getQueuedEmails } from './email.js';
import { processDueNotificationDigests } from './notificationJobs.js';
import { prisma } from './prisma.js';

async function createDigestUser(dailyDigest = true) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `digest-${suffix}@example.com`,
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
    const now = new Date(2026, 4, 10, 17, 30, 0, 0);
    const dueAt = new Date(2026, 4, 10, 16, 30, 0, 0);
    const futureAt = new Date(2026, 4, 10, 17, 15, 0, 0);

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
      expect(result.cutoffAt).toBe(new Date(2026, 4, 10, 17, 0, 0, 0).toISOString());

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

  it('does not send before the configured digest time', async () => {
    const user = await createDigestUser(true);
    const now = new Date(2026, 4, 10, 16, 30, 0, 0);

    await prisma.notificationDigestItem.create({
      data: {
        userId: user.id,
        type: 'mentions',
        title: 'Queued mention',
        message: 'This should wait for the digest window',
        createdAt: new Date(2026, 4, 10, 15, 0, 0, 0),
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
    const now = new Date(2026, 4, 10, 17, 30, 0, 0);

    await prisma.notificationDigestItem.create({
      data: {
        userId: user.id,
        type: 'mentions',
        title: 'Queued mention',
        message: 'This user disabled digest delivery',
        createdAt: new Date(2026, 4, 10, 15, 0, 0, 0),
      },
    });

    try {
      const result = await processDueNotificationDigests({
        now,
        timeOfDay: '17:00',
        userIds: [user.id],
      });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.results[0]!.error).toContain('disabled');
      expect(getQueuedEmails()).toHaveLength(0);
    } finally {
      await cleanupDigestUser(user.id);
    }
  });
});

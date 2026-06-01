import type { NotificationDigestItem as NotificationDigestItemRecord } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { DigestItem } from '../../lib/email.js';

/**
 * Notification digest-queue helpers, extracted verbatim from
 * backend/src/routes/notifications.ts as a slice of the notifications route
 * split (engineering-health Workstream 1).
 *
 * Covers the per-user digest queue backed by the NotificationDigestItem table:
 * the record→DigestItem mapper, the add (create + count), the ordered read
 * (createdAt ascending, mapped), the clear (deleteMany), and the public
 * getUserDigestQueue accessor. Behaviour — the exact response shapes, the
 * `?? undefined` JSON coercion, the createdAt ordering, the post-add count, and
 * the clear semantics — is preserved exactly as it was inline in the route file.
 * The pure toDigestItem mapper is unit-tested in digestQueue.test.ts; the
 * Prisma-backed add/get/clear remain covered by the route/integration tests.
 */

export function toDigestItem(record: NotificationDigestItemRecord): DigestItem {
  return {
    type: record.type,
    title: record.title,
    message: record.message,
    projectName: record.projectName ?? undefined,
    linkUrl: record.linkUrl ?? undefined,
    timestamp: record.createdAt,
  };
}

export async function addDigestItem(userId: string, item: DigestItem): Promise<number> {
  await prisma.notificationDigestItem.create({
    data: {
      userId,
      type: item.type,
      title: item.title,
      message: item.message,
      projectName: item.projectName,
      linkUrl: item.linkUrl,
    },
  });

  return prisma.notificationDigestItem.count({ where: { userId } });
}

export async function getDigestItems(userId: string): Promise<DigestItem[]> {
  const items = await prisma.notificationDigestItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return items.map(toDigestItem);
}

export async function clearDigestItems(userId: string): Promise<void> {
  await prisma.notificationDigestItem.deleteMany({ where: { userId } });
}

// Helper function to get digest queue for a user
export async function getUserDigestQueue(userId: string): Promise<DigestItem[]> {
  return getDigestItems(userId);
}

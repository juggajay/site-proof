import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

// G6: a single place to create in-app notifications. Today this is a thin,
// behavior-preserving wrapper around prisma.notification.create(Many); it is the
// substrate that G4 will extend to also fan out web-push from real domain
// events, so call sites should migrate to it incrementally.

export type NotificationDispatchClient = typeof prisma | Prisma.TransactionClient;

export interface NotificationInput {
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  projectId?: string | null;
  linkUrl?: string | null;
}

/**
 * Normalize a notification into the row written to the `notifications` table.
 * The optional/nullable columns (projectId, message, linkUrl) default to null,
 * matching the Prisma schema.
 */
export function buildNotificationCreateData(
  input: NotificationInput,
): Prisma.NotificationUncheckedCreateInput {
  return {
    userId: input.userId,
    projectId: input.projectId ?? null,
    type: input.type,
    title: input.title,
    message: input.message ?? null,
    linkUrl: input.linkUrl ?? null,
  };
}

/** Recipient ids, de-duplicated and stripped of empty/nullish values (order preserved). */
export function dedupeRecipientIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  );
}

/** Create a single in-app notification. */
export async function createNotification(
  input: NotificationInput,
  client: NotificationDispatchClient = prisma,
) {
  return client.notification.create({ data: buildNotificationCreateData(input) });
}

/**
 * Create the same notification for many recipients (de-duplicated). Skips the
 * write entirely when there is no valid recipient.
 */
export async function createNotificationsForRecipients(
  recipientIds: Array<string | null | undefined>,
  input: Omit<NotificationInput, 'userId'>,
  client: NotificationDispatchClient = prisma,
) {
  const userIds = dedupeRecipientIds(recipientIds);
  if (userIds.length === 0) {
    return { count: 0 };
  }
  return client.notification.createMany({
    data: userIds.map((userId) => buildNotificationCreateData({ ...input, userId })),
  });
}

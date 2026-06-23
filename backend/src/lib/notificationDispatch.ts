import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { logError } from './serverLogger.js';
import { sendPushNotification } from '../routes/pushNotifications/delivery.js';

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

type PushSender = (
  userId: string,
  payload: { title: string; body: string; url?: string },
) => Promise<unknown>;

/**
 * G4: fan out a web push for a freshly-created notification, best-effort. The
 * push send is gated on VAPID config and cleans up expired subscriptions inside
 * {@link sendPushNotification}; any failure here must never affect the in-app
 * notification, so errors are swallowed (logged).
 */
export async function dispatchNotificationPush(
  input: { userId: string; title: string; message?: string | null; linkUrl?: string | null },
  send: PushSender = sendPushNotification,
): Promise<void> {
  try {
    await send(input.userId, {
      title: input.title,
      body: input.message ?? input.title,
      url: input.linkUrl ?? undefined,
    });
  } catch (error) {
    logError('Failed to dispatch web push for notification', error);
  }
}

/** Create a single in-app notification, then best-effort fan out a web push. */
export async function createNotification(
  input: NotificationInput,
  client: NotificationDispatchClient = prisma,
) {
  const created = await client.notification.create({ data: buildNotificationCreateData(input) });
  // G4: only push outside a transaction — inside a tx the row is not yet
  // committed and the push send must not run network I/O in the tx. Callers
  // creating notifications in a transaction should dispatch the push after
  // commit.
  if (client === prisma) {
    await dispatchNotificationPush(input);
  }
  return created;
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
  const result = await client.notification.createMany({
    data: userIds.map((userId) => buildNotificationCreateData({ ...input, userId })),
  });
  // G4: best-effort web push per recipient (only outside a transaction).
  if (client === prisma) {
    await Promise.all(userIds.map((userId) => dispatchNotificationPush({ ...input, userId })));
  }
  return result;
}

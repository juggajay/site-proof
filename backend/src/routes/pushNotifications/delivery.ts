import webpush from 'web-push';
import type { PushSubscription as PushSubscriptionRecord } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import {
  parseEndpoint,
  parseNotificationUrl,
  parseOptionalData,
  parseOptionalString,
  parseRequiredString,
  PUSH_MESSAGE_BODY_MAX_LENGTH,
  PUSH_MESSAGE_TAG_MAX_LENGTH,
  PUSH_MESSAGE_TITLE_MAX_LENGTH,
  type PushSubscriptionPayload,
} from './validation.js';
import { initializeWebPush } from './vapid.js';

export function getPushErrorDetails(error: unknown): { statusCode?: number; message: string } {
  if (error instanceof Error) {
    const candidate = error as Error & { statusCode?: unknown };
    const statusCode = typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined;
    return { statusCode, message: error.message };
  }
  if (error && typeof error === 'object') {
    const candidate = error as Record<string, unknown>;
    return {
      statusCode: typeof candidate.statusCode === 'number' ? candidate.statusCode : undefined,
      message:
        typeof candidate.message === 'string'
          ? candidate.message
          : 'Unknown push notification error',
    };
  }
  return { message: 'Unknown push notification error' };
}

function toWebPushSubscription(subscription: PushSubscriptionRecord): PushSubscriptionPayload {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export async function removeInvalidStoredPushSubscription(
  subscription: PushSubscriptionRecord,
): Promise<string> {
  await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
  return `Subscription ${subscription.id.slice(0, 8)}... invalid endpoint - removed`;
}

export async function sendStoredPushSubscription(
  subscription: PushSubscriptionRecord,
  payload: string,
): Promise<void> {
  parseEndpoint(subscription.endpoint);
  await webpush.sendNotification(toWebPushSubscription(subscription), payload);
}

// Helper function to send push notification to a user (exported for use by other modules)
export async function sendPushNotification(
  userId: string,
  notification: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
  },
): Promise<{ success: boolean; sent: number; failed: number; errors?: string[] }> {
  const userSubscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (userSubscriptions.length === 0) {
    return { success: false, sent: 0, failed: 0, errors: ['No subscriptions found for user'] };
  }

  const pushConfig = initializeWebPush();
  if (!pushConfig.configured) {
    return {
      success: false,
      sent: 0,
      failed: userSubscriptions.length,
      errors: [
        'Push notifications are not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
      ],
    };
  }

  const title = parseRequiredString(notification.title, 'title', PUSH_MESSAGE_TITLE_MAX_LENGTH);
  const body = parseRequiredString(notification.body, 'body', PUSH_MESSAGE_BODY_MAX_LENGTH);
  const url = parseNotificationUrl(notification.url);
  const tag = parseOptionalString(notification.tag, 'tag', PUSH_MESSAGE_TAG_MAX_LENGTH);
  const data = parseOptionalData(notification.data);

  const payload = JSON.stringify({
    title,
    body,
    icon: notification.icon || '/pwa-192x192.png',
    badge: notification.badge || '/pwa-192x192.png',
    tag: tag || 'siteproof-notification',
    data: {
      ...data,
      url: url || '/',
      timestamp: new Date().toISOString(),
    },
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const subscription of userSubscriptions) {
    try {
      await sendStoredPushSubscription(subscription, payload);
      sent++;
    } catch (error: unknown) {
      if (error instanceof AppError) {
        failed++;
        errors.push(await removeInvalidStoredPushSubscription(subscription));
        continue;
      }

      const pushError = getPushErrorDetails(error);
      failed++;
      // Remove expired subscriptions
      if (pushError.statusCode === 410 || pushError.statusCode === 404) {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        errors.push(`Subscription ${subscription.id.slice(0, 8)}... expired and removed`);
      } else {
        errors.push(`Subscription ${subscription.id.slice(0, 8)}...: ${pushError.message}`);
      }
    }
  }

  return {
    success: sent > 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Helper function to broadcast push notification to multiple users
export async function broadcastPushNotification(
  userIds: string[],
  notification: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    data?: Record<string, unknown>;
  },
): Promise<{
  totalSent: number;
  totalFailed: number;
  results: Record<string, { sent: number; failed: number }>;
}> {
  const results: Record<string, { sent: number; failed: number }> = {};
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of Array.from(new Set(userIds))) {
    const result = await sendPushNotification(userId, notification);
    results[userId] = { sent: result.sent, failed: result.failed };
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { totalSent, totalFailed, results };
}

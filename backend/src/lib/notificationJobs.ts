import type { DigestItem } from './email.js';
import { sendDailyDigestEmail } from './email.js';
import { prisma } from './prisma.js';
import { logError, logInfo } from './serverLogger.js';

const DEFAULT_DIGEST_TIME_OF_DAY = '17:00';
const DEFAULT_DIGEST_WORKER_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_DIGEST_USER_LIMIT = 100;
const DEFAULT_DIGEST_ITEM_LIMIT = 200;
const DEFAULT_DIGEST_RETENTION_DAYS = 30;

type NotificationDigestItemRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  projectName: string | null;
  linkUrl: string | null;
  createdAt: Date;
};

export type NotificationDigestDeliveryStatus = 'sent' | 'failed' | 'skipped';

export type NotificationDigestDeliveryResult = {
  userId: string;
  itemCount: number;
  status: NotificationDigestDeliveryStatus;
  error?: string;
};

export type ProcessDueNotificationDigestsResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  deletedExpiredItems: number;
  cutoffAt?: string;
  results: NotificationDigestDeliveryResult[];
};

export type ProcessDueNotificationDigestsOptions = {
  now?: Date;
  limit?: number;
  itemLimit?: number;
  timeOfDay?: string;
  retentionDays?: number;
  userIds?: string[];
};

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTimeOfDay(value: string | undefined): { hours: number; minutes: number } {
  const candidate = value?.trim() || DEFAULT_DIGEST_TIME_OF_DAY;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(candidate);
  if (!match) {
    return parseTimeOfDay(DEFAULT_DIGEST_TIME_OF_DAY);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function getDigestCutoff(now: Date, timeOfDay: string | undefined): Date | null {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const cutoff = new Date(now);
  cutoff.setHours(hours, minutes, 0, 0);

  return now >= cutoff ? cutoff : null;
}

function toDigestItem(record: NotificationDigestItemRecord): DigestItem {
  return {
    type: record.type,
    title: record.title,
    message: record.message,
    projectName: record.projectName ?? undefined,
    linkUrl: record.linkUrl ?? undefined,
    timestamp: record.createdAt,
  };
}

async function cleanupExpiredDigestItems(now: Date, retentionDays: number): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await prisma.notificationDigestItem.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return deleted.count;
}

async function processUserDigest(
  userId: string,
  cutoffAt: Date,
  itemLimit: number,
): Promise<NotificationDigestDeliveryResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      notificationEmailPreference: true,
    },
  });

  if (!user) {
    await prisma.notificationDigestItem.deleteMany({ where: { userId } });
    return {
      userId,
      itemCount: 0,
      status: 'skipped',
      error: 'User no longer exists',
    };
  }

  const preferences = user.notificationEmailPreference;
  if (!preferences?.enabled || !preferences.dailyDigest) {
    return {
      userId,
      itemCount: 0,
      status: 'skipped',
      error: 'Daily digest email preference is disabled',
    };
  }

  const itemRecords = await prisma.notificationDigestItem.findMany({
    where: {
      userId,
      createdAt: { lte: cutoffAt },
    },
    orderBy: { createdAt: 'asc' },
    take: itemLimit,
  });

  if (itemRecords.length === 0) {
    return {
      userId,
      itemCount: 0,
      status: 'skipped',
      error: 'No digest items due',
    };
  }

  const emailResult = await sendDailyDigestEmail(user.email, itemRecords.map(toDigestItem));
  if (!emailResult.success) {
    return {
      userId,
      itemCount: itemRecords.length,
      status: 'failed',
      error: emailResult.error || 'Digest email failed',
    };
  }

  await prisma.notificationDigestItem.deleteMany({
    where: {
      id: { in: itemRecords.map((item) => item.id) },
    },
  });

  return {
    userId,
    itemCount: itemRecords.length,
    status: 'sent',
  };
}

export async function processDueNotificationDigests(
  options: ProcessDueNotificationDigestsOptions = {},
): Promise<ProcessDueNotificationDigestsResult> {
  if (options.userIds && options.userIds.length === 0) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0, deletedExpiredItems: 0, results: [] };
  }

  const now = options.now ?? new Date();
  const cutoffAt = getDigestCutoff(
    now,
    options.timeOfDay ?? process.env.NOTIFICATION_DIGEST_TIME_OF_DAY,
  );
  const deletedExpiredItems = await cleanupExpiredDigestItems(
    now,
    parsePositiveInteger(options.retentionDays, DEFAULT_DIGEST_RETENTION_DAYS),
  );

  if (!cutoffAt) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      deletedExpiredItems,
      results: [],
    };
  }

  const limit = parsePositiveInteger(options.limit, DEFAULT_DIGEST_USER_LIMIT);
  const itemLimit = parsePositiveInteger(options.itemLimit, DEFAULT_DIGEST_ITEM_LIMIT);
  const userGroups = await prisma.notificationDigestItem.groupBy({
    by: ['userId'],
    where: {
      ...(options.userIds ? { userId: { in: options.userIds } } : {}),
      createdAt: { lte: cutoffAt },
    },
    orderBy: { userId: 'asc' },
    take: limit,
  });

  const results: NotificationDigestDeliveryResult[] = [];
  for (const group of userGroups) {
    results.push(await processUserDigest(group.userId, cutoffAt, itemLimit));
  }

  const sent = results.filter((result) => result.status === 'sent').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;

  return {
    processed: results.length,
    sent,
    failed,
    skipped,
    deletedExpiredItems,
    cutoffAt: cutoffAt.toISOString(),
    results,
  };
}

function getNotificationDigestWorkerEnabled(): boolean {
  const configured = process.env.NOTIFICATION_DIGEST_WORKER_ENABLED?.trim().toLowerCase();
  if (configured === 'false' || configured === '0' || configured === 'no') {
    return false;
  }
  if (configured === 'true' || configured === '1' || configured === 'yes') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function getNotificationDigestWorkerIntervalMs(): number {
  return parsePositiveInteger(
    process.env.NOTIFICATION_DIGEST_WORKER_INTERVAL_MS,
    DEFAULT_DIGEST_WORKER_INTERVAL_MS,
  );
}

export function startNotificationDigestWorker(): { stop: () => void } | null {
  if (!getNotificationDigestWorkerEnabled()) {
    return null;
  }

  const intervalMs = getNotificationDigestWorkerIntervalMs();
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await processDueNotificationDigests();
      if (result.processed > 0 || result.deletedExpiredItems > 0) {
        logInfo('[Notification Digests] Processed due digests', {
          processed: result.processed,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
          deletedExpiredItems: result.deletedExpiredItems,
        });
      }
      for (const failedResult of result.results.filter((item) => item.status === 'failed')) {
        logError('[Notification Digests] Delivery failed', failedResult);
      }
    } catch (error) {
      logError('[Notification Digests] Worker run failed', error);
    } finally {
      isRunning = false;
    }
  };

  const initialTimer = setTimeout(
    () => {
      void run();
    },
    Math.min(5000, intervalMs),
  );
  const intervalTimer = setInterval(() => {
    void run();
  }, intervalMs);

  logInfo('[Notification Digests] Worker started', { intervalMs });

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      logInfo('[Notification Digests] Worker stopped');
    },
  };
}

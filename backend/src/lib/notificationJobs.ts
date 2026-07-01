import type { DigestItem } from './email.js';
import { sendDailyDigestEmail } from './email.js';
import { getZonedMinutesOfDay } from './notificationAutomation/helpers.js';
import { prisma } from './prisma.js';
import { logError, logInfo } from './serverLogger.js';

const DEFAULT_DIGEST_TIME_OF_DAY = '17:00';
const DEFAULT_DIGEST_WORKER_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_DIGEST_USER_LIMIT = 100;
const DEFAULT_DIGEST_ITEM_LIMIT = 200;
const DEFAULT_DIGEST_RETENTION_DAYS = 30;
const DEFAULT_DIGEST_FAILURE_RETRY_DELAY_MS = 30 * 60 * 1000;
const MAX_DIGEST_FAILURE_RETRY_DELAY_MS = 24 * 60 * 60 * 1000;
const MAX_DIGEST_FAILURE_REASON_LENGTH = 500;
const NOTIFICATION_DIGEST_WORKER_LOCK_ID = 731_452_020;

const DIGEST_ITEM_PREFERENCE_KEYS = {
  mentions: 'mentions',
  ncrAssigned: 'ncrAssigned',
  ncrStatusChange: 'ncrStatusChange',
  holdPointReminder: 'holdPointReminder',
  holdPointRelease: 'holdPointRelease',
  commentReply: 'commentReply',
  scheduledReports: 'scheduledReports',
  diaryReminder: 'diaryReminder',
} as const;

type NotificationDigestItemRecord = {
  id: string;
  type: string;
  title: string;
  message: string;
  projectName: string | null;
  linkUrl: string | null;
  createdAt: Date;
};

type DigestItemPreferenceKey =
  (typeof DIGEST_ITEM_PREFERENCE_KEYS)[keyof typeof DIGEST_ITEM_PREFERENCE_KEYS];

type NotificationDigestPreferences = {
  enabled: boolean;
  dailyDigest: boolean;
} & Partial<Record<DigestItemPreferenceKey, boolean>>;

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
  failureRetryDelayMs?: number;
  userIds?: string[];
};

function emptyDigestResult(): ProcessDueNotificationDigestsResult {
  return { processed: 0, sent: 0, failed: 0, skipped: 0, deletedExpiredItems: 0, results: [] };
}

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDigestFailureRetryDelayMs(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_DIGEST_FAILURE_RETRY_DELAY_MS;
  }

  return Math.min(parsed, MAX_DIGEST_FAILURE_RETRY_DELAY_MS);
}

function truncateDigestFailureReason(reason: string): string {
  return reason.length <= MAX_DIGEST_FAILURE_REASON_LENGTH
    ? reason
    : `${reason.slice(0, MAX_DIGEST_FAILURE_REASON_LENGTH - 3)}...`;
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
  // Gate on Australia/Sydney wall-clock time, not the server's UTC clock — the
  // previous cutoff.setHours() evaluated the daily digest time in server-local
  // (UTC in production), firing ~8-11h off the intended AU time.
  if (getZonedMinutesOfDay(now) < hours * 60 + minutes) {
    return null;
  }
  // Past today's AU digest time: include everything accumulated up to now.
  // Digest items are deleted after a successful send (see processUserDigest), so
  // using `now` rather than a reconstructed AU-local HH:MM instant cannot
  // double-send.
  return now;
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

function getDigestItemPreferenceKey(type: string): DigestItemPreferenceKey | null {
  return DIGEST_ITEM_PREFERENCE_KEYS[type as keyof typeof DIGEST_ITEM_PREFERENCE_KEYS] ?? null;
}

function isDigestItemEnabledForPreferences(
  item: NotificationDigestItemRecord,
  preferences: NotificationDigestPreferences,
): boolean {
  const preferenceKey = getDigestItemPreferenceKey(item.type);
  return preferenceKey ? preferences[preferenceKey] !== false : true;
}

async function cleanupExpiredDigestItems(now: Date, retentionDays: number): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await prisma.notificationDigestItem.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return deleted.count;
}

async function cleanupDisabledDueDigestItems(
  cutoffAt: Date,
  now: Date,
  userIds?: string[],
): Promise<number> {
  const deleted = await prisma.notificationDigestItem.deleteMany({
    where: {
      ...(userIds ? { userId: { in: userIds } } : {}),
      createdAt: { lte: cutoffAt },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      user: {
        OR: [
          { notificationEmailPreference: null },
          { notificationEmailPreference: { is: { enabled: false } } },
          { notificationEmailPreference: { is: { dailyDigest: false } } },
        ],
      },
    },
  });

  return deleted.count;
}

async function processUserDigest(
  userId: string,
  cutoffAt: Date,
  itemLimit: number,
  now: Date,
  failureRetryDelayMs: number,
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
    await prisma.notificationDigestItem.deleteMany({
      where: {
        userId,
        createdAt: { lte: cutoffAt },
      },
    });

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
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
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

  const enabledItemRecords = itemRecords.filter((item) =>
    isDigestItemEnabledForPreferences(item, preferences),
  );
  const disabledItemIds = itemRecords
    .filter((item) => !isDigestItemEnabledForPreferences(item, preferences))
    .map((item) => item.id);

  if (disabledItemIds.length > 0) {
    await prisma.notificationDigestItem.deleteMany({
      where: { id: { in: disabledItemIds } },
    });
  }

  if (enabledItemRecords.length === 0) {
    return {
      userId,
      itemCount: 0,
      status: 'skipped',
      error: 'No digest items enabled by current preferences',
    };
  }

  const emailResult = await sendDailyDigestEmail(user.email, enabledItemRecords.map(toDigestItem));
  if (!emailResult.success) {
    await prisma.notificationDigestItem.updateMany({
      where: {
        id: { in: enabledItemRecords.map((item) => item.id) },
      },
      data: {
        deliveryFailureCount: { increment: 1 },
        lastDeliveryFailureAt: now,
        lastDeliveryFailureReason: truncateDigestFailureReason(
          emailResult.error || 'Digest email failed',
        ),
        nextAttemptAt: new Date(now.getTime() + failureRetryDelayMs),
      },
    });

    return {
      userId,
      itemCount: enabledItemRecords.length,
      status: 'failed',
      error: emailResult.error || 'Digest email failed',
    };
  }

  await prisma.notificationDigestItem.deleteMany({
    where: {
      id: { in: enabledItemRecords.map((item) => item.id) },
    },
  });

  return {
    userId,
    itemCount: enabledItemRecords.length,
    status: 'sent',
  };
}

async function processDueNotificationDigestsUnlocked(
  options: ProcessDueNotificationDigestsOptions = {},
): Promise<ProcessDueNotificationDigestsResult> {
  if (options.userIds && options.userIds.length === 0) {
    return emptyDigestResult();
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
  const failureRetryDelayMs = parseDigestFailureRetryDelayMs(
    options.failureRetryDelayMs ?? process.env.NOTIFICATION_DIGEST_FAILURE_RETRY_DELAY_MS,
  );
  await cleanupDisabledDueDigestItems(cutoffAt, now, options.userIds);

  const dueUsers = await prisma.notificationDigestItem.findMany({
    where: {
      ...(options.userIds ? { userId: { in: options.userIds } } : {}),
      createdAt: { lte: cutoffAt },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      user: {
        notificationEmailPreference: {
          is: {
            enabled: true,
            dailyDigest: true,
          },
        },
      },
    },
    select: { userId: true },
    distinct: ['userId'],
    orderBy: { userId: 'asc' },
    take: limit,
  });

  const results: NotificationDigestDeliveryResult[] = [];
  for (const user of dueUsers) {
    results.push(
      await processUserDigest(user.userId, cutoffAt, itemLimit, now, failureRetryDelayMs),
    );
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

export async function processDueNotificationDigests(
  options: ProcessDueNotificationDigestsOptions = {},
): Promise<ProcessDueNotificationDigestsResult> {
  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${NOTIFICATION_DIGEST_WORKER_LOCK_ID}) AS locked
      `;
      if (lockRows[0]?.locked !== true) {
        return emptyDigestResult();
      }

      return processDueNotificationDigestsUnlocked(options);
    },
    {
      maxWait: 5_000,
      timeout: 30 * 60 * 1_000,
    },
  );
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

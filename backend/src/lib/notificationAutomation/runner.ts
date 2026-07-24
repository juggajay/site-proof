import type { PrismaClient } from '@prisma/client';

import type {
  NotificationAutomationJobOptions,
  NotificationAutomationRunResult,
} from '../notificationAutomation.js';
import { formatDateKey, parsePositiveInteger } from './helpers.js';
import { logError, logInfo } from '../serverLogger.js';

const DEFAULT_AUTOMATION_WORKER_INTERVAL_MS = 60 * 60 * 1000;
// Exported for tests that need to hold the lock to exercise contention paths.
export const NOTIFICATION_AUTOMATION_WORKER_LOCK_ID = 731_452_021;

type NotificationAutomationProcess = (
  options?: NotificationAutomationJobOptions,
) => Promise<NotificationAutomationRunResult>;

type NotificationAutomationRunnerDependencies = {
  prisma: PrismaClient;
  processUnlocked: NotificationAutomationProcess;
};

function emptyDeliverySummary() {
  return { inAppCreated: 0, emailsSent: 0, emailsQueued: 0, emailsFailed: 0 };
}

function emptyNotificationAutomationResult(now: Date): NotificationAutomationRunResult {
  const date = formatDateKey(now);
  return {
    diaryReminders: {
      ...emptyDeliverySummary(),
      projectsChecked: 0,
      remindersCreated: 0,
      skippedProjects: 0,
      usersNotified: 0,
      date,
    },
    docketBacklogAlerts: {
      ...emptyDeliverySummary(),
      overdueDockets: 0,
      projectsWithBacklog: 0,
      alertsCreated: 0,
      skippedProjects: 0,
      usersNotified: 0,
    },
    systemAlerts: {
      projectsChecked: 0,
      alertsCreated: 0,
      overdueNcrAlerts: 0,
      staleHoldPointAlerts: 0,
      missingDiaryAlerts: 0,
      notificationsCreated: 0,
      skippedAlerts: 0,
      createdAlerts: [],
    },
    alertEscalations: {
      ...emptyDeliverySummary(),
      alertsChecked: 0,
      escalated: 0,
      skippedAlerts: 0,
      usersNotified: 0,
    },
  };
}

/**
 * Run `fn` under the automation advisory lock, or return null if another
 * holder (the hourly worker or an admin-triggered check on another instance)
 * currently has it. One lock id covers every writer of notification alerts so
 * the worker and the admin route can never interleave their check-then-create
 * passes.
 */
export async function runWithNotificationAutomationLock<T>(
  prisma: PrismaClient,
  fn: () => Promise<T>,
): Promise<T | null> {
  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${NOTIFICATION_AUTOMATION_WORKER_LOCK_ID}) AS locked
      `;
      if (lockRows[0]?.locked !== true) {
        return null;
      }

      return fn();
    },
    {
      maxWait: 5_000,
      timeout: 30 * 60 * 1_000,
    },
  );
}

export async function processNotificationAutomationWithLock(
  options: NotificationAutomationJobOptions = {},
  { prisma, processUnlocked }: NotificationAutomationRunnerDependencies,
): Promise<NotificationAutomationRunResult> {
  const now = options.now ?? new Date();
  const result = await runWithNotificationAutomationLock(prisma, () =>
    processUnlocked({ ...options, now }),
  );
  return result ?? emptyNotificationAutomationResult(now);
}

function getNotificationAutomationWorkerEnabled(): boolean {
  const configured = process.env.NOTIFICATION_AUTOMATION_WORKER_ENABLED?.trim().toLowerCase();
  if (configured === 'false' || configured === '0' || configured === 'no') {
    return false;
  }
  if (configured === 'true' || configured === '1' || configured === 'yes') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function getNotificationAutomationWorkerIntervalMs(): number {
  return parsePositiveInteger(
    process.env.NOTIFICATION_AUTOMATION_WORKER_INTERVAL_MS,
    DEFAULT_AUTOMATION_WORKER_INTERVAL_MS,
  );
}

function countAutomationChanges(result: NotificationAutomationRunResult): number {
  return (
    result.diaryReminders.remindersCreated +
    result.docketBacklogAlerts.alertsCreated +
    result.systemAlerts.alertsCreated +
    result.alertEscalations.escalated
  );
}

export function startNotificationAutomationWorker(
  processNotificationAutomation: NotificationAutomationProcess,
): { stop: () => void } | null {
  if (!getNotificationAutomationWorkerEnabled()) {
    return null;
  }

  const intervalMs = getNotificationAutomationWorkerIntervalMs();
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await processNotificationAutomation();
      const changes = countAutomationChanges(result);
      if (changes > 0) {
        logInfo('[Notification Automation] Processed notification jobs', {
          diaryReminders: result.diaryReminders.remindersCreated,
          docketBacklogAlerts: result.docketBacklogAlerts.alertsCreated,
          systemAlerts: result.systemAlerts.alertsCreated,
          alertEscalations: result.alertEscalations.escalated,
        });
      }
    } catch (error) {
      logError('[Notification Automation] Worker run failed', error);
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

  logInfo('[Notification Automation] Worker started', { intervalMs });

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      logInfo('[Notification Automation] Worker stopped');
    },
  };
}

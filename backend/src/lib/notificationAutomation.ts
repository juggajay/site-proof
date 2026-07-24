import { sendNotificationEmail } from './email.js';
import { parsePositiveInteger } from './notificationAutomation/helpers.js';
import {
  type AlertEscalationAutomationDependencies,
  type AlertEscalationAutomationResult,
  processAlertEscalations as processAlertEscalationsJob,
} from './notificationAutomation/alertEscalations.js';
import {
  type BacklogAutomationDependencies,
  processDocketBacklogAlerts as processDocketBacklogAlertsJob,
} from './notificationAutomation/backlogAutomation.js';
import {
  type DiaryAutomationDependencies,
  processDueDiaryReminders as processDueDiaryRemindersJob,
} from './notificationAutomation/diaryAutomation.js';
import {
  type EmailPreferences,
  type NotificationTypeWithTiming,
  getNotificationTiming,
  isNotificationTypeEnabled,
  normalizeEmailPreferences,
} from './notificationAutomation/preferences.js';
import {
  type CreatedSystemAlert,
  type SystemAutomationDependencies,
  processSystemAlerts as processSystemAlertsJob,
} from './notificationAutomation/systemAutomation.js';
import {
  processNotificationAutomationWithLock,
  runWithNotificationAutomationLock,
  startNotificationAutomationWorker as startNotificationAutomationWorkerJob,
} from './notificationAutomation/runner.js';
import { prisma } from './prisma.js';
import { logError } from './serverLogger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_JOB_LIMIT = 100;

const DIARY_REMINDER_ROLES = ['site_engineer', 'foreman', 'project_manager'];

type ProjectForAutomation = {
  id: string;
  name: string;
  companyId: string;
  state: string | null;
  workingHoursEnd: string | null;
  workingDays: string | null;
  settings: string | null;
};

type NotificationRecipient = {
  id: string;
  email: string;
  fullName: string | null;
};

type NotificationDeliverySummary = {
  inAppCreated: number;
  emailsSent: number;
  emailsQueued: number;
  emailsFailed: number;
};

export type NotificationAutomationJobOptions = {
  now?: Date;
  limit?: number;
  projectIds?: string[];
};

export type DiaryReminderJobResult = NotificationDeliverySummary & {
  projectsChecked: number;
  remindersCreated: number;
  skippedProjects: number;
  usersNotified: number;
  date: string;
};

export type DocketBacklogAlertJobResult = NotificationDeliverySummary & {
  overdueDockets: number;
  projectsWithBacklog: number;
  alertsCreated: number;
  skippedProjects: number;
  usersNotified: number;
};

export type SystemAlertJobResult = {
  projectsChecked: number;
  alertsCreated: number;
  overdueNcrAlerts: number;
  staleHoldPointAlerts: number;
  missingDiaryAlerts: number;
  notificationsCreated: number;
  skippedAlerts: number;
  createdAlerts: CreatedSystemAlert[];
};

export type AlertEscalationJobResult = AlertEscalationAutomationResult;

export type NotificationAutomationRunResult = {
  diaryReminders: DiaryReminderJobResult;
  docketBacklogAlerts: DocketBacklogAlertJobResult;
  systemAlerts: SystemAlertJobResult;
  alertEscalations: AlertEscalationJobResult;
};

async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const preferences = await prisma.notificationEmailPreference.findUnique({ where: { userId } });
  return normalizeEmailPreferences(preferences);
}

async function sendNotificationIfEnabled(
  userId: string,
  notificationType: NotificationTypeWithTiming,
  data: {
    title: string;
    message: string;
    linkUrl?: string;
    projectName?: string;
  },
): Promise<{ sent: boolean; queued: boolean; failed: boolean }> {
  const preferences = await getEmailPreferences(userId);
  if (!preferences.enabled || !isNotificationTypeEnabled(preferences, notificationType)) {
    return { sent: false, queued: false, failed: false };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return { sent: false, queued: false, failed: false };
  }

  const timing = getNotificationTiming(preferences, notificationType);
  if (timing === 'digest' && !preferences.dailyDigest) {
    return { sent: false, queued: false, failed: false };
  }

  if (timing === 'digest') {
    await prisma.notificationDigestItem.create({
      data: {
        userId,
        type: notificationType,
        title: data.title,
        message: data.message,
        projectName: data.projectName,
        linkUrl: data.linkUrl,
      },
    });

    return { sent: false, queued: true, failed: false };
  }

  const result = await sendNotificationEmail(user.email, notificationType, data);
  if (!result.success) {
    logError('[Notification Automation] Email delivery failed', {
      userId,
      notificationType,
      error: result.error || 'Email delivery failed',
      provider: result.provider,
    });
  }

  return { sent: result.success, queued: false, failed: !result.success };
}

async function findActiveProjects(
  options: NotificationAutomationJobOptions,
): Promise<ProjectForAutomation[]> {
  const projectIds = options.projectIds;
  if (projectIds && projectIds.length === 0) {
    return [];
  }

  return prisma.project.findMany({
    where: {
      status: 'active',
      ...(projectIds ? { id: { in: projectIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      companyId: true,
      state: true,
      workingHoursEnd: true,
      workingDays: true,
      settings: true,
    },
    orderBy: { createdAt: 'asc' },
    take: parsePositiveInteger(options.limit, DEFAULT_JOB_LIMIT),
  });
}

async function findProjectUsersByRoles(
  projectId: string,
  roles: string[],
): Promise<NotificationRecipient[]> {
  return prisma.user.findMany({
    where: {
      projectUsers: {
        some: {
          projectId,
          status: 'active',
          role: { in: roles },
        },
      },
    },
    select: {
      id: true,
      email: true,
      fullName: true,
    },
    orderBy: [{ fullName: 'asc' }, { email: 'asc' }],
  });
}

async function notifyUsers(
  users: NotificationRecipient[],
  inAppNotification: {
    projectId: string | null;
    type: string;
    title: string;
    message: string;
    linkUrl?: string | null;
    createdAt?: Date;
  },
  emailNotificationType: NotificationTypeWithTiming,
  emailData: {
    title: string;
    message: string;
    linkUrl?: string;
    projectName?: string;
  },
): Promise<NotificationDeliverySummary & { usersNotified: number }> {
  const uniqueUsers = Array.from(new Map(users.map((user) => [user.id, user])).values());
  if (uniqueUsers.length === 0) {
    return { inAppCreated: 0, emailsSent: 0, emailsQueued: 0, emailsFailed: 0, usersNotified: 0 };
  }

  await prisma.notification.createMany({
    data: uniqueUsers.map((user) => ({
      userId: user.id,
      projectId: inAppNotification.projectId,
      type: inAppNotification.type,
      title: inAppNotification.title,
      message: inAppNotification.message,
      linkUrl: inAppNotification.linkUrl ?? null,
      createdAt: inAppNotification.createdAt,
    })),
  });

  let emailsSent = 0;
  let emailsQueued = 0;
  let emailsFailed = 0;
  for (const user of uniqueUsers) {
    const result = await sendNotificationIfEnabled(user.id, emailNotificationType, emailData);
    if (result.sent) {
      emailsSent += 1;
    }
    if (result.queued) {
      emailsQueued += 1;
    }
    if (result.failed) {
      emailsFailed += 1;
    }
  }

  return {
    inAppCreated: uniqueUsers.length,
    emailsSent,
    emailsQueued,
    emailsFailed,
    usersNotified: uniqueUsers.length,
  };
}

async function findEscalationUsers(
  projectId: string | null,
  roles: string[],
  fallbackUserId: string,
): Promise<NotificationRecipient[]> {
  if (!projectId) {
    const fallbackUser = await prisma.user.findUnique({
      where: { id: fallbackUserId },
      select: { id: true, email: true, fullName: true },
    });
    return fallbackUser ? [fallbackUser] : [];
  }

  const roleUsers = await findProjectUsersByRoles(projectId, roles);
  if (roleUsers.length > 0) {
    return roleUsers;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });
  const companyUsers = project
    ? await prisma.user.findMany({
        where: {
          companyId: project.companyId,
          roleInCompany: { in: ['owner', 'admin'] },
        },
        select: { id: true, email: true, fullName: true },
        orderBy: { createdAt: 'asc' },
      })
    : [];

  if (companyUsers.length > 0) {
    return companyUsers;
  }

  const fallbackUser = await prisma.user.findUnique({
    where: { id: fallbackUserId },
    select: { id: true, email: true, fullName: true },
  });
  return fallbackUser ? [fallbackUser] : [];
}

const diaryAutomationDependencies = {
  prisma,
  dayMs: DAY_MS,
  diaryReminderRoles: DIARY_REMINDER_ROLES,
  findActiveProjects,
  findProjectUsersByRoles,
  notifyUsers,
} satisfies DiaryAutomationDependencies;

const backlogAutomationDependencies = {
  prisma,
  hourMs: HOUR_MS,
  defaultJobLimit: DEFAULT_JOB_LIMIT,
  findProjectUsersByRoles,
  notifyUsers,
} satisfies BacklogAutomationDependencies;

const systemAutomationDependencies = {
  prisma,
  dayMs: DAY_MS,
  hourMs: HOUR_MS,
  findActiveProjects,
  findProjectUsersByRoles,
  notifyUsers,
} satisfies SystemAutomationDependencies;

const alertEscalationDependencies = {
  prisma,
  hourMs: HOUR_MS,
  defaultJobLimit: DEFAULT_JOB_LIMIT,
  findEscalationUsers,
  notifyUsers,
} satisfies AlertEscalationAutomationDependencies;

export async function processDueDiaryReminders(
  options: NotificationAutomationJobOptions = {},
): Promise<DiaryReminderJobResult> {
  return processDueDiaryRemindersJob(options, diaryAutomationDependencies);
}

export async function processDocketBacklogAlerts(
  options: NotificationAutomationJobOptions & { overdueHours?: number } = {},
): Promise<DocketBacklogAlertJobResult> {
  return processDocketBacklogAlertsJob(options, backlogAutomationDependencies);
}

export async function processSystemAlerts(
  options: NotificationAutomationJobOptions = {},
): Promise<SystemAlertJobResult> {
  return processSystemAlertsJob(options, systemAutomationDependencies);
}

export type { CreatedSystemAlert };

/**
 * The system-alerts job alone, under the same advisory lock as the hourly
 * worker — for the admin check endpoint. Returns null when the lock is held
 * (a worker run or another admin check is in progress) so the caller can
 * report "already running" instead of interleaving duplicate checks.
 */
export async function processSystemAlertsWithLock(
  options: NotificationAutomationJobOptions = {},
): Promise<SystemAlertJobResult | null> {
  return runWithNotificationAutomationLock(prisma, () => processSystemAlerts(options));
}

export async function processAlertEscalations(
  options: NotificationAutomationJobOptions & { alertIds?: string[] } = {},
): Promise<AlertEscalationJobResult> {
  return processAlertEscalationsJob(options, alertEscalationDependencies);
}

async function processNotificationAutomationUnlocked(
  options: NotificationAutomationJobOptions = {},
): Promise<NotificationAutomationRunResult> {
  const now = options.now ?? new Date();
  const sharedOptions = { ...options, now };

  return {
    diaryReminders: await processDueDiaryReminders(sharedOptions),
    docketBacklogAlerts: await processDocketBacklogAlerts(sharedOptions),
    systemAlerts: await processSystemAlerts(sharedOptions),
    alertEscalations: await processAlertEscalations(sharedOptions),
  };
}

export async function processNotificationAutomation(
  options: NotificationAutomationJobOptions = {},
): Promise<NotificationAutomationRunResult> {
  return processNotificationAutomationWithLock(options, {
    prisma,
    processUnlocked: processNotificationAutomationUnlocked,
  });
}

export function startNotificationAutomationWorker(): { stop: () => void } | null {
  return startNotificationAutomationWorkerJob(processNotificationAutomation);
}

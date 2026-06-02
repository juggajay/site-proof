import { sendNotificationEmail } from './email.js';
import {
  buildProjectEntityLink,
  formatDateKey,
  parsePositiveInteger,
} from './notificationAutomation/helpers.js';
import {
  type BacklogAutomationDependencies,
  processDocketBacklogAlerts as processDocketBacklogAlertsJob,
} from './notificationAutomation/backlogAutomation.js';
import {
  type DiaryAutomationDependencies,
  processDueDiaryReminders as processDueDiaryRemindersJob,
  processMissingDiaryAlerts as processMissingDiaryAlertsJob,
} from './notificationAutomation/diaryAutomation.js';
import {
  type EmailPreferences,
  type NotificationTypeWithTiming,
  getNotificationTiming,
  isNotificationTypeEnabled,
  normalizeEmailPreferences,
} from './notificationAutomation/preferences.js';
import {
  type SystemAutomationDependencies,
  processSystemAlerts as processSystemAlertsJob,
} from './notificationAutomation/systemAutomation.js';
import { prisma } from './prisma.js';
import { logError, logInfo } from './serverLogger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_AUTOMATION_WORKER_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFICATION_AUTOMATION_WORKER_LOCK_ID = 731_452_021;

type AlertType = 'overdue_ncr' | 'stale_hold_point' | 'pending_approval' | 'overdue_test';

const ESCALATION_CONFIG: Record<
  AlertType,
  {
    firstEscalationAfterHours: number;
    secondEscalationAfterHours: number;
    escalationRoles: string[];
  }
> = {
  overdue_ncr: {
    firstEscalationAfterHours: 24,
    secondEscalationAfterHours: 48,
    escalationRoles: ['project_manager', 'quality_manager', 'admin'],
  },
  stale_hold_point: {
    firstEscalationAfterHours: 4,
    secondEscalationAfterHours: 8,
    escalationRoles: ['superintendent', 'project_manager', 'admin'],
  },
  pending_approval: {
    firstEscalationAfterHours: 8,
    secondEscalationAfterHours: 24,
    escalationRoles: ['project_manager', 'admin'],
  },
  overdue_test: {
    firstEscalationAfterHours: 48,
    secondEscalationAfterHours: 96,
    escalationRoles: ['quality_manager', 'project_manager'],
  },
};

const DIARY_REMINDER_ROLES = ['site_engineer', 'foreman', 'project_manager'];
const MISSING_DIARY_ALERT_ROLES = ['project_manager', 'admin', 'owner'];

type ProjectForAutomation = {
  id: string;
  name: string;
  companyId: string;
  workingHoursEnd: string | null;
  workingDays: string | null;
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

export type MissingDiaryAlertJobResult = NotificationDeliverySummary & {
  projectsChecked: number;
  alertsCreated: number;
  skippedProjects: number;
  usersNotified: number;
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
};

export type AlertEscalationJobResult = NotificationDeliverySummary & {
  alertsChecked: number;
  escalated: number;
  skippedAlerts: number;
  usersNotified: number;
};

export type NotificationAutomationRunResult = {
  diaryReminders: DiaryReminderJobResult;
  missingDiaryAlerts: MissingDiaryAlertJobResult;
  docketBacklogAlerts: DocketBacklogAlertJobResult;
  systemAlerts: SystemAlertJobResult;
  alertEscalations: AlertEscalationJobResult;
};

function emptyDeliverySummary(): NotificationDeliverySummary {
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
    missingDiaryAlerts: {
      ...emptyDeliverySummary(),
      projectsChecked: 0,
      alertsCreated: 0,
      skippedProjects: 0,
      usersNotified: 0,
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

async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const preferences = await prisma.notificationEmailPreference.findUnique({ where: { userId } });
  return normalizeEmailPreferences(preferences);
}

function isAlertType(value: string): value is AlertType {
  return Object.prototype.hasOwnProperty.call(ESCALATION_CONFIG, value);
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
  if (timing === 'digest' && preferences.dailyDigest) {
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
      workingHoursEnd: true,
      workingDays: true,
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
  missingDiaryAlertRoles: MISSING_DIARY_ALERT_ROLES,
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
} satisfies SystemAutomationDependencies;

export async function processDueDiaryReminders(
  options: NotificationAutomationJobOptions = {},
): Promise<DiaryReminderJobResult> {
  return processDueDiaryRemindersJob(options, diaryAutomationDependencies);
}

export async function processMissingDiaryAlerts(
  options: NotificationAutomationJobOptions = {},
): Promise<MissingDiaryAlertJobResult> {
  return processMissingDiaryAlertsJob(options, diaryAutomationDependencies);
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

export async function processAlertEscalations(
  options: NotificationAutomationJobOptions & { alertIds?: string[] } = {},
): Promise<AlertEscalationJobResult> {
  const now = options.now ?? new Date();
  const alertIds = options.alertIds;
  if (alertIds && alertIds.length === 0) {
    return {
      alertsChecked: 0,
      escalated: 0,
      skippedAlerts: 0,
      usersNotified: 0,
      inAppCreated: 0,
      emailsSent: 0,
      emailsQueued: 0,
      emailsFailed: 0,
    };
  }

  const alerts = await prisma.notificationAlert.findMany({
    where: {
      resolvedAt: null,
      ...(alertIds ? { id: { in: alertIds } } : {}),
      ...(options.projectIds ? { projectId: { in: options.projectIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: parsePositiveInteger(options.limit, DEFAULT_JOB_LIMIT),
  });
  const result: AlertEscalationJobResult = {
    alertsChecked: alerts.length,
    escalated: 0,
    skippedAlerts: 0,
    usersNotified: 0,
    inAppCreated: 0,
    emailsSent: 0,
    emailsQueued: 0,
    emailsFailed: 0,
  };

  for (const alert of alerts) {
    if (!isAlertType(alert.type)) {
      result.skippedAlerts += 1;
      continue;
    }

    const config = ESCALATION_CONFIG[alert.type];
    const hoursSinceCreation = (now.getTime() - alert.createdAt.getTime()) / HOUR_MS;
    let newLevel: number | null = null;
    if (alert.escalationLevel === 0 && hoursSinceCreation >= config.firstEscalationAfterHours) {
      newLevel = 1;
    } else if (
      alert.escalationLevel === 1 &&
      hoursSinceCreation >= config.secondEscalationAfterHours
    ) {
      newLevel = 2;
    }

    if (newLevel === null) {
      result.skippedAlerts += 1;
      continue;
    }

    const escalationUsers = await findEscalationUsers(
      alert.projectId,
      config.escalationRoles,
      alert.assignedToId,
    );
    const escalatedToIds = escalationUsers.map((user) => user.id);
    const updateResult = await prisma.notificationAlert.updateMany({
      where: {
        id: alert.id,
        resolvedAt: null,
        escalationLevel: alert.escalationLevel,
      },
      data: {
        escalationLevel: newLevel,
        escalatedAt: now,
        escalatedTo: escalatedToIds,
      },
    });

    if (updateResult.count === 0) {
      result.skippedAlerts += 1;
      continue;
    }

    const linkUrl = buildProjectEntityLink(alert.entityType, alert.entityId, alert.projectId);
    const delivery = await notifyUsers(
      escalationUsers,
      {
        projectId: alert.projectId,
        type: 'alert_escalation',
        title: `ESCALATED: ${alert.title}`,
        message: `Alert has been escalated (Level ${newLevel}): ${alert.message}`,
        linkUrl,
        createdAt: now,
      },
      'ncrAssigned',
      {
        title: `ESCALATED ALERT: ${alert.title}`,
        message: `This alert has been escalated to you because it was not resolved within ${newLevel === 1 ? config.firstEscalationAfterHours : config.secondEscalationAfterHours} hours.\n\n${alert.message}`,
        linkUrl,
      },
    );

    result.escalated += 1;
    result.inAppCreated += delivery.inAppCreated;
    result.emailsSent += delivery.emailsSent;
    result.emailsQueued += delivery.emailsQueued;
    result.emailsFailed += delivery.emailsFailed;
    result.usersNotified += delivery.usersNotified;
  }

  return result;
}

async function processNotificationAutomationUnlocked(
  options: NotificationAutomationJobOptions = {},
): Promise<NotificationAutomationRunResult> {
  const now = options.now ?? new Date();
  const sharedOptions = { ...options, now };

  return {
    diaryReminders: await processDueDiaryReminders(sharedOptions),
    missingDiaryAlerts: await processMissingDiaryAlerts(sharedOptions),
    docketBacklogAlerts: await processDocketBacklogAlerts(sharedOptions),
    systemAlerts: await processSystemAlerts(sharedOptions),
    alertEscalations: await processAlertEscalations(sharedOptions),
  };
}

export async function processNotificationAutomation(
  options: NotificationAutomationJobOptions = {},
): Promise<NotificationAutomationRunResult> {
  const now = options.now ?? new Date();
  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${NOTIFICATION_AUTOMATION_WORKER_LOCK_ID}) AS locked
      `;
      if (lockRows[0]?.locked !== true) {
        return emptyNotificationAutomationResult(now);
      }

      return processNotificationAutomationUnlocked({ ...options, now });
    },
    {
      maxWait: 5_000,
      timeout: 30 * 60 * 1_000,
    },
  );
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
    result.missingDiaryAlerts.alertsCreated +
    result.docketBacklogAlerts.alertsCreated +
    result.systemAlerts.alertsCreated +
    result.alertEscalations.escalated
  );
}

export function startNotificationAutomationWorker(): { stop: () => void } | null {
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
          missingDiaryAlerts: result.missingDiaryAlerts.alertsCreated,
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

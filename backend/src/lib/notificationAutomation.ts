import { randomUUID } from 'node:crypto';
import { sendNotificationEmail } from './email.js';
import { prisma } from './prisma.js';
import { logError, logInfo } from './serverLogger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_JOB_LIMIT = 100;
const DEFAULT_AUTOMATION_WORKER_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_TIME_OF_DAY = '17:00';
const DEFAULT_WORKING_DAYS = new Set([1, 2, 3, 4, 5]);

type NotificationTiming = 'immediate' | 'digest';
type NotificationTypeWithTiming =
  | 'mentions'
  | 'ncrAssigned'
  | 'ncrStatusChange'
  | 'holdPointReminder'
  | 'holdPointRelease'
  | 'commentReply'
  | 'scheduledReports'
  | 'diaryReminder';

type EmailPreferences = {
  enabled: boolean;
  mentions: boolean;
  mentionsTiming: NotificationTiming;
  ncrAssigned: boolean;
  ncrAssignedTiming: NotificationTiming;
  ncrStatusChange: boolean;
  ncrStatusChangeTiming: NotificationTiming;
  holdPointReminder: boolean;
  holdPointReminderTiming: NotificationTiming;
  holdPointRelease: boolean;
  holdPointReleaseTiming: NotificationTiming;
  commentReply: boolean;
  commentReplyTiming: NotificationTiming;
  scheduledReports: boolean;
  scheduledReportsTiming: NotificationTiming;
  dailyDigest: boolean;
  diaryReminder: boolean;
  diaryReminderTiming: NotificationTiming;
};

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  enabled: true,
  mentions: true,
  mentionsTiming: 'immediate',
  ncrAssigned: true,
  ncrAssignedTiming: 'immediate',
  ncrStatusChange: true,
  ncrStatusChangeTiming: 'immediate',
  holdPointReminder: true,
  holdPointReminderTiming: 'immediate',
  holdPointRelease: true,
  holdPointReleaseTiming: 'immediate',
  commentReply: true,
  commentReplyTiming: 'immediate',
  scheduledReports: true,
  scheduledReportsTiming: 'immediate',
  dailyDigest: false,
  diaryReminder: true,
  diaryReminderTiming: 'immediate',
};

type AlertType = 'overdue_ncr' | 'stale_hold_point' | 'pending_approval' | 'overdue_test';
type AlertSeverity = 'medium' | 'high' | 'critical';

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
const DOCKET_BACKLOG_ALERT_ROLES = ['foreman', 'project_manager', 'admin'];
const HOLD_POINT_ALERT_ROLES = ['project_manager', 'superintendent', 'quality_manager'];
const SYSTEM_DIARY_ALERT_ROLES = ['site_engineer', 'foreman', 'project_manager'];
const ALERT_OWNER_ROLE_PRIORITY = [
  'project_manager',
  'quality_manager',
  'superintendent',
  'admin',
  'owner',
  'site_engineer',
  'foreman',
];

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

function parsePositiveInteger(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseTimeOfDay(value: string | null | undefined): { hours: number; minutes: number } {
  const candidate = value?.trim() || DEFAULT_TIME_OF_DAY;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(candidate);
  if (!match) {
    return parseTimeOfDay(DEFAULT_TIME_OF_DAY);
  }

  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
  };
}

function validateTiming(value: unknown, fallback: NotificationTiming): NotificationTiming {
  return value === 'immediate' || value === 'digest' ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeEmailPreferences(value: unknown): EmailPreferences {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    enabled: normalizeBoolean(input.enabled, DEFAULT_EMAIL_PREFERENCES.enabled),
    mentions: normalizeBoolean(input.mentions, DEFAULT_EMAIL_PREFERENCES.mentions),
    mentionsTiming: validateTiming(input.mentionsTiming, DEFAULT_EMAIL_PREFERENCES.mentionsTiming),
    ncrAssigned: normalizeBoolean(input.ncrAssigned, DEFAULT_EMAIL_PREFERENCES.ncrAssigned),
    ncrAssignedTiming: validateTiming(
      input.ncrAssignedTiming,
      DEFAULT_EMAIL_PREFERENCES.ncrAssignedTiming,
    ),
    ncrStatusChange: normalizeBoolean(
      input.ncrStatusChange,
      DEFAULT_EMAIL_PREFERENCES.ncrStatusChange,
    ),
    ncrStatusChangeTiming: validateTiming(
      input.ncrStatusChangeTiming,
      DEFAULT_EMAIL_PREFERENCES.ncrStatusChangeTiming,
    ),
    holdPointReminder: normalizeBoolean(
      input.holdPointReminder,
      DEFAULT_EMAIL_PREFERENCES.holdPointReminder,
    ),
    holdPointReminderTiming: validateTiming(
      input.holdPointReminderTiming,
      DEFAULT_EMAIL_PREFERENCES.holdPointReminderTiming,
    ),
    holdPointRelease: normalizeBoolean(
      input.holdPointRelease,
      DEFAULT_EMAIL_PREFERENCES.holdPointRelease,
    ),
    holdPointReleaseTiming: validateTiming(
      input.holdPointReleaseTiming,
      DEFAULT_EMAIL_PREFERENCES.holdPointReleaseTiming,
    ),
    commentReply: normalizeBoolean(input.commentReply, DEFAULT_EMAIL_PREFERENCES.commentReply),
    commentReplyTiming: validateTiming(
      input.commentReplyTiming,
      DEFAULT_EMAIL_PREFERENCES.commentReplyTiming,
    ),
    scheduledReports: normalizeBoolean(
      input.scheduledReports,
      DEFAULT_EMAIL_PREFERENCES.scheduledReports,
    ),
    scheduledReportsTiming: validateTiming(
      input.scheduledReportsTiming,
      DEFAULT_EMAIL_PREFERENCES.scheduledReportsTiming,
    ),
    dailyDigest: normalizeBoolean(input.dailyDigest, DEFAULT_EMAIL_PREFERENCES.dailyDigest),
    diaryReminder: normalizeBoolean(input.diaryReminder, DEFAULT_EMAIL_PREFERENCES.diaryReminder),
    diaryReminderTiming: validateTiming(
      input.diaryReminderTiming,
      DEFAULT_EMAIL_PREFERENCES.diaryReminderTiming,
    ),
  };
}

async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const preferences = await prisma.notificationEmailPreference.findUnique({ where: { userId } });
  return normalizeEmailPreferences(preferences);
}

function isNotificationTypeEnabled(
  preferences: EmailPreferences,
  notificationType: NotificationTypeWithTiming,
): boolean {
  switch (notificationType) {
    case 'mentions':
      return preferences.mentions;
    case 'ncrAssigned':
      return preferences.ncrAssigned;
    case 'ncrStatusChange':
      return preferences.ncrStatusChange;
    case 'holdPointReminder':
      return preferences.holdPointReminder;
    case 'holdPointRelease':
      return preferences.holdPointRelease;
    case 'commentReply':
      return preferences.commentReply;
    case 'scheduledReports':
      return preferences.scheduledReports;
    case 'diaryReminder':
      return preferences.diaryReminder;
  }
}

function getNotificationTiming(
  preferences: EmailPreferences,
  notificationType: NotificationTypeWithTiming,
): NotificationTiming {
  switch (notificationType) {
    case 'mentions':
      return preferences.mentionsTiming;
    case 'ncrAssigned':
      return preferences.ncrAssignedTiming;
    case 'ncrStatusChange':
      return preferences.ncrStatusChangeTiming;
    case 'holdPointReminder':
      return preferences.holdPointReminderTiming;
    case 'holdPointRelease':
      return preferences.holdPointReleaseTiming;
    case 'commentReply':
      return preferences.commentReplyTiming;
    case 'scheduledReports':
      return preferences.scheduledReportsTiming;
    case 'diaryReminder':
      return preferences.diaryReminderTiming;
  }
}

function startOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateKey(value: Date): string {
  return value.toISOString().split('T')[0]!;
}

function parseWorkingDays(value: string | null | undefined): Set<number> {
  const days = new Set(
    (value ?? '')
      .split(',')
      .map((day) => Number(day.trim()))
      .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
  );

  return days.size > 0 ? days : DEFAULT_WORKING_DAYS;
}

function getPreviousWorkingDay(now: Date, workingDaysValue: string | null | undefined): Date {
  const workingDays = parseWorkingDays(workingDaysValue);
  let candidate = startOfDay(addDays(now, -1));

  for (let attempt = 0; attempt < 7; attempt += 1) {
    if (workingDays.has(candidate.getDay())) {
      return candidate;
    }
    candidate = addDays(candidate, -1);
  }

  return startOfDay(addDays(now, -1));
}

function isWorkingDay(project: ProjectForAutomation, date: Date): boolean {
  return parseWorkingDays(project.workingDays).has(date.getDay());
}

function isDueForProjectTime(now: Date, timeOfDay: string | null | undefined): boolean {
  const { hours, minutes } = parseTimeOfDay(process.env.DIARY_REMINDER_TIME_OF_DAY ?? timeOfDay);
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes;
}

function appendQueryParams(pathname: string, params?: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function buildProjectEntityLink(
  entityType: string,
  entityId: string,
  projectId?: string | null,
  params?: Record<string, string | undefined>,
): string {
  if (!projectId) {
    return '/dashboard';
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedEntityId = encodeURIComponent(entityId);
  const normalizedType = entityType.toLowerCase().replace(/[\s-]/g, '_');

  switch (normalizedType) {
    case 'lot':
      return appendQueryParams(`/projects/${encodedProjectId}/lots/${encodedEntityId}`, params);
    case 'ncr':
      return appendQueryParams(`/projects/${encodedProjectId}/ncr`, { ncr: entityId, ...params });
    case 'test':
    case 'test_result':
    case 'testresult':
      return appendQueryParams(`/projects/${encodedProjectId}/tests`, {
        test: entityId,
        ...params,
      });
    case 'holdpoint':
    case 'hold_point':
      return appendQueryParams(`/projects/${encodedProjectId}/hold-points`, {
        holdPoint: entityId,
        ...params,
      });
    case 'document':
      return appendQueryParams(`/projects/${encodedProjectId}/documents`, {
        document: entityId,
        ...params,
      });
    case 'drawing':
      return appendQueryParams(`/projects/${encodedProjectId}/drawings`, {
        drawing: entityId,
        ...params,
      });
    case 'docket':
    case 'daily_docket':
    case 'dailydocket':
      return appendQueryParams(`/projects/${encodedProjectId}/dockets`, {
        docket: entityId,
        ...params,
      });
    case 'diary':
    case 'daily_diary':
    case 'dailydiary':
      return appendQueryParams(`/projects/${encodedProjectId}/diary`, params);
    case 'progress_claim':
    case 'progressclaim':
    case 'claim':
      return appendQueryParams(`/projects/${encodedProjectId}/claims`, {
        claim: entityId,
        ...params,
      });
    case 'itp':
    case 'itp_instance':
    case 'itpinstance':
      return appendQueryParams(`/projects/${encodedProjectId}/itp`, { itp: entityId, ...params });
    default:
      return appendQueryParams(`/projects/${encodedProjectId}`, params);
  }
}

function isAlertType(value: string): value is AlertType {
  return Object.prototype.hasOwnProperty.call(ESCALATION_CONFIG, value);
}

function generateAlertId(): string {
  return `alert-${randomUUID()}`;
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

async function findProjectAlertOwnerId(project: ProjectForAutomation): Promise<string | null> {
  const projectUsers = await prisma.projectUser.findMany({
    where: {
      projectId: project.id,
      status: 'active',
    },
    select: {
      userId: true,
      role: true,
    },
  });

  for (const role of ALERT_OWNER_ROLE_PRIORITY) {
    const match = projectUsers.find((projectUser) => projectUser.role === role);
    if (match) {
      return match.userId;
    }
  }

  const companyOwner = await prisma.user.findFirst({
    where: {
      companyId: project.companyId,
      roleInCompany: { in: ['owner', 'admin'] },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  return companyOwner?.id ?? projectUsers[0]?.userId ?? null;
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

async function createAlertRecord(data: {
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entityId: string;
  entityType: string;
  projectId: string;
  assignedToId: string;
  createdAt: Date;
}): Promise<string> {
  const id = generateAlertId();
  await prisma.notificationAlert.create({
    data: {
      id,
      type: data.type,
      severity: data.severity,
      title: data.title,
      message: data.message,
      entityId: data.entityId,
      entityType: data.entityType,
      projectId: data.projectId,
      assignedToId: data.assignedToId,
      createdAt: data.createdAt,
      escalationLevel: 0,
    },
  });

  return id;
}

export async function processDueDiaryReminders(
  options: NotificationAutomationJobOptions = {},
): Promise<DiaryReminderJobResult> {
  const now = options.now ?? new Date();
  const targetDate = startOfDay(now);
  const dateKey = formatDateKey(targetDate);
  const projects = await findActiveProjects(options);
  const result: DiaryReminderJobResult = {
    projectsChecked: projects.length,
    remindersCreated: 0,
    skippedProjects: 0,
    usersNotified: 0,
    inAppCreated: 0,
    emailsSent: 0,
    emailsQueued: 0,
    emailsFailed: 0,
    date: dateKey,
  };

  for (const project of projects) {
    if (!isWorkingDay(project, targetDate) || !isDueForProjectTime(now, project.workingHoursEnd)) {
      result.skippedProjects += 1;
      continue;
    }

    const existingDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + DAY_MS),
        },
      },
    });

    if (existingDiary) {
      result.skippedProjects += 1;
      continue;
    }

    const existingReminder = await prisma.notification.findFirst({
      where: {
        projectId: project.id,
        type: 'diary_reminder',
        message: { contains: dateKey },
      },
    });

    if (existingReminder) {
      result.skippedProjects += 1;
      continue;
    }

    const users = await findProjectUsersByRoles(project.id, DIARY_REMINDER_ROLES);
    const message = `No daily diary entry found for ${project.name} on ${dateKey}. Please complete your site diary.`;
    const delivery = await notifyUsers(
      users,
      {
        projectId: project.id,
        type: 'diary_reminder',
        title: 'Daily Diary Reminder',
        message,
        linkUrl: `/projects/${project.id}/diary`,
        createdAt: now,
      },
      'diaryReminder',
      {
        title: 'Daily Diary Reminder',
        message,
        projectName: project.name,
        linkUrl: `/projects/${project.id}/diary`,
      },
    );

    if (delivery.inAppCreated > 0) {
      result.remindersCreated += 1;
      result.inAppCreated += delivery.inAppCreated;
      result.emailsSent += delivery.emailsSent;
      result.emailsQueued += delivery.emailsQueued;
      result.emailsFailed += delivery.emailsFailed;
      result.usersNotified += delivery.usersNotified;
    } else {
      result.skippedProjects += 1;
    }
  }

  return result;
}

export async function processMissingDiaryAlerts(
  options: NotificationAutomationJobOptions = {},
): Promise<MissingDiaryAlertJobResult> {
  const now = options.now ?? new Date();
  const projects = await findActiveProjects(options);
  const result: MissingDiaryAlertJobResult = {
    projectsChecked: projects.length,
    alertsCreated: 0,
    skippedProjects: 0,
    usersNotified: 0,
    inAppCreated: 0,
    emailsSent: 0,
    emailsQueued: 0,
    emailsFailed: 0,
  };

  for (const project of projects) {
    const missingDate = getPreviousWorkingDay(now, project.workingDays);
    const missingDateKey = formatDateKey(missingDate);
    const existingDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: missingDate,
          lt: new Date(missingDate.getTime() + DAY_MS),
        },
      },
    });

    if (existingDiary) {
      result.skippedProjects += 1;
      continue;
    }

    const existingAlert = await prisma.notification.findFirst({
      where: {
        projectId: project.id,
        type: 'diary_missing_alert',
        message: { contains: missingDateKey },
      },
    });

    if (existingAlert) {
      result.skippedProjects += 1;
      continue;
    }

    const users = await findProjectUsersByRoles(project.id, MISSING_DIARY_ALERT_ROLES);
    const message = `ALERT: No daily diary entry was completed for ${project.name} on ${missingDateKey}. This is more than 24 hours overdue.`;
    const delivery = await notifyUsers(
      users,
      {
        projectId: project.id,
        type: 'diary_missing_alert',
        title: 'Missing Diary Alert',
        message,
        linkUrl: `/projects/${project.id}/diary`,
        createdAt: now,
      },
      'ncrAssigned',
      {
        title: 'Missing Diary Alert',
        message,
        projectName: project.name,
        linkUrl: `/projects/${project.id}/diary`,
      },
    );

    if (delivery.inAppCreated > 0) {
      result.alertsCreated += 1;
      result.inAppCreated += delivery.inAppCreated;
      result.emailsSent += delivery.emailsSent;
      result.emailsQueued += delivery.emailsQueued;
      result.emailsFailed += delivery.emailsFailed;
      result.usersNotified += delivery.usersNotified;
    } else {
      result.skippedProjects += 1;
    }
  }

  return result;
}

export async function processDocketBacklogAlerts(
  options: NotificationAutomationJobOptions & { overdueHours?: number } = {},
): Promise<DocketBacklogAlertJobResult> {
  const now = options.now ?? new Date();
  const cutoffTime = new Date(
    now.getTime() - parsePositiveInteger(options.overdueHours, 48) * HOUR_MS,
  );
  const today = startOfDay(now);
  const projectIds = options.projectIds;
  const overdueDockets = await prisma.dailyDocket.findMany({
    where: {
      status: 'pending_approval',
      submittedAt: { lt: cutoffTime },
      project: {
        status: 'active',
        ...(projectIds ? { id: { in: projectIds } } : {}),
      },
    },
    select: {
      id: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { submittedAt: 'asc' },
    take: parsePositiveInteger(options.limit, DEFAULT_JOB_LIMIT),
  });

  const docketsByProject = new Map<string, typeof overdueDockets>();
  for (const docket of overdueDockets) {
    const projectDockets = docketsByProject.get(docket.projectId) ?? [];
    projectDockets.push(docket);
    docketsByProject.set(docket.projectId, projectDockets);
  }

  const result: DocketBacklogAlertJobResult = {
    overdueDockets: overdueDockets.length,
    projectsWithBacklog: docketsByProject.size,
    alertsCreated: 0,
    skippedProjects: 0,
    usersNotified: 0,
    inAppCreated: 0,
    emailsSent: 0,
    emailsQueued: 0,
    emailsFailed: 0,
  };

  for (const [projectId, dockets] of docketsByProject.entries()) {
    const project = dockets[0]?.project;
    if (!project) {
      result.skippedProjects += 1;
      continue;
    }

    const existingAlert = await prisma.notification.findFirst({
      where: {
        projectId,
        type: 'docket_backlog_alert',
        createdAt: { gte: today },
      },
    });

    if (existingAlert) {
      result.skippedProjects += 1;
      continue;
    }

    const docketCount = dockets.length;
    const docketIds = dockets
      .slice(0, 3)
      .map((docket) => docket.id.substring(0, 8))
      .join(', ');
    const moreText = docketCount > 3 ? ` and ${docketCount - 3} more` : '';
    const users = await findProjectUsersByRoles(projectId, DOCKET_BACKLOG_ALERT_ROLES);
    const inAppMessage = `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}: ${docketIds}${moreText}. Please review.`;
    const delivery = await notifyUsers(
      users,
      {
        projectId,
        type: 'docket_backlog_alert',
        title: 'Docket Backlog Alert',
        message: inAppMessage,
        linkUrl: `/projects/${projectId}/dockets`,
        createdAt: now,
      },
      'holdPointReminder',
      {
        title: 'Docket Backlog Alert',
        message: `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}. Please review.`,
        projectName: project.name,
        linkUrl: `/projects/${projectId}/dockets`,
      },
    );

    if (delivery.inAppCreated > 0) {
      result.alertsCreated += 1;
      result.inAppCreated += delivery.inAppCreated;
      result.emailsSent += delivery.emailsSent;
      result.emailsQueued += delivery.emailsQueued;
      result.emailsFailed += delivery.emailsFailed;
      result.usersNotified += delivery.usersNotified;
    } else {
      result.skippedProjects += 1;
    }
  }

  return result;
}

export async function processSystemAlerts(
  options: NotificationAutomationJobOptions = {},
): Promise<SystemAlertJobResult> {
  const now = options.now ?? new Date();
  const projects = await findActiveProjects(options);
  const result: SystemAlertJobResult = {
    projectsChecked: projects.length,
    alertsCreated: 0,
    overdueNcrAlerts: 0,
    staleHoldPointAlerts: 0,
    missingDiaryAlerts: 0,
    notificationsCreated: 0,
    skippedAlerts: 0,
  };

  for (const project of projects) {
    const alertOwnerId = await findProjectAlertOwnerId(project);
    const overdueNcrs = await prisma.nCR.findMany({
      where: {
        projectId: project.id,
        status: { notIn: ['closed', 'closed_concession'] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        dueDate: true,
        responsibleUserId: true,
      },
    });

    for (const ncr of overdueNcrs) {
      const existingAlert = await prisma.notificationAlert.findFirst({
        where: {
          entityId: ncr.id,
          type: 'overdue_ncr',
          resolvedAt: null,
        },
      });

      if (existingAlert) {
        result.skippedAlerts += 1;
        continue;
      }

      const assignedToId = ncr.responsibleUserId ?? alertOwnerId;
      if (!assignedToId) {
        result.skippedAlerts += 1;
        continue;
      }

      const daysOverdue = ncr.dueDate
        ? Math.ceil((now.getTime() - ncr.dueDate.getTime()) / DAY_MS)
        : 0;
      const severity: AlertSeverity =
        daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium';
      const title = `NCR ${ncr.ncrNumber} is overdue`;
      const message = `NCR ${ncr.ncrNumber} is ${daysOverdue} day(s) overdue. ${ncr.description?.substring(0, 100) || 'No description'}`;
      await createAlertRecord({
        type: 'overdue_ncr',
        severity,
        title,
        message,
        entityId: ncr.id,
        entityType: 'ncr',
        projectId: project.id,
        assignedToId,
        createdAt: now,
      });
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          projectId: project.id,
          type: 'alert_overdue_ncr',
          title,
          message,
          linkUrl: buildProjectEntityLink('ncr', ncr.id, project.id),
        },
      });

      result.alertsCreated += 1;
      result.overdueNcrAlerts += 1;
      result.notificationsCreated += 1;
    }

    const staleThreshold = new Date(now.getTime() - DAY_MS);
    const staleHoldPoints = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId: project.id },
        status: { in: ['requested', 'scheduled'] },
        scheduledDate: { lt: staleThreshold },
      },
      include: {
        lot: { select: { id: true, lotNumber: true } },
        itpChecklistItem: { select: { description: true } },
      },
    });

    for (const holdPoint of staleHoldPoints) {
      const existingAlert = await prisma.notificationAlert.findFirst({
        where: {
          entityId: holdPoint.id,
          type: 'stale_hold_point',
          resolvedAt: null,
        },
      });

      if (existingAlert) {
        result.skippedAlerts += 1;
        continue;
      }

      if (!alertOwnerId) {
        result.skippedAlerts += 1;
        continue;
      }

      const hoursStale = holdPoint.scheduledDate
        ? Math.ceil((now.getTime() - holdPoint.scheduledDate.getTime()) / HOUR_MS)
        : 0;
      const severity: AlertSeverity =
        hoursStale > 48 ? 'critical' : hoursStale > 24 ? 'high' : 'medium';
      const title = `Hold Point stale: Lot ${holdPoint.lot.lotNumber}`;
      const message = `Hold Point for Lot ${holdPoint.lot.lotNumber} has been ${holdPoint.status} for ${hoursStale} hours. ${holdPoint.itpChecklistItem?.description?.substring(0, 80) || ''}`;
      await createAlertRecord({
        type: 'stale_hold_point',
        severity,
        title,
        message,
        entityId: holdPoint.id,
        entityType: 'holdpoint',
        projectId: project.id,
        assignedToId: alertOwnerId,
        createdAt: now,
      });

      const users = await findProjectUsersByRoles(project.id, HOLD_POINT_ALERT_ROLES);
      if (users.length > 0) {
        await prisma.notification.createMany({
          data: users.map((user) => ({
            userId: user.id,
            projectId: project.id,
            type: 'alert_stale_hold_point',
            title,
            message,
            linkUrl: buildProjectEntityLink('lot', holdPoint.lot.id, project.id, {
              tab: 'holdpoints',
            }),
          })),
        });
      }

      result.alertsCreated += 1;
      result.staleHoldPointAlerts += 1;
      result.notificationsCreated += users.length;
    }

    const missingDiaryDate = getPreviousWorkingDay(now, project.workingDays);
    const missingDiaryDateKey = formatDateKey(missingDiaryDate);
    const existingDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: missingDiaryDate,
          lt: new Date(missingDiaryDate.getTime() + DAY_MS),
        },
      },
    });

    if (!existingDiary) {
      const missingDiaryEntityId = `diary-${project.id}-${missingDiaryDateKey}`;
      const existingMissingAlert = await prisma.notificationAlert.findFirst({
        where: {
          type: 'pending_approval',
          entityType: 'diary',
          projectId: project.id,
          entityId: missingDiaryEntityId,
          resolvedAt: null,
        },
      });

      if (existingMissingAlert) {
        result.skippedAlerts += 1;
      } else if (!alertOwnerId) {
        result.skippedAlerts += 1;
      } else {
        const title = `Missing Daily Diary: ${project.name}`;
        const message = `No daily diary was submitted for ${project.name} on ${missingDiaryDateKey}. This affects project records and compliance.`;
        await createAlertRecord({
          type: 'pending_approval',
          severity: 'high',
          title,
          message,
          entityId: missingDiaryEntityId,
          entityType: 'diary',
          projectId: project.id,
          assignedToId: alertOwnerId,
          createdAt: now,
        });

        const users = await findProjectUsersByRoles(project.id, SYSTEM_DIARY_ALERT_ROLES);
        if (users.length > 0) {
          await prisma.notification.createMany({
            data: users.map((user) => ({
              userId: user.id,
              projectId: project.id,
              type: 'alert_missing_diary',
              title,
              message,
              linkUrl: `/projects/${project.id}/diary`,
            })),
          });
        }

        result.alertsCreated += 1;
        result.missingDiaryAlerts += 1;
        result.notificationsCreated += users.length;
      }
    }
  }

  return result;
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

export async function processNotificationAutomation(
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

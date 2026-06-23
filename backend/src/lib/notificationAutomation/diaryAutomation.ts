import type { PrismaClient } from '@prisma/client';
import { formatDateKey, isDueForProjectTime, isWorkingDay, startOfDay } from './helpers.js';
import type { NotificationTypeWithTiming } from './preferences.js';
import { isProjectNotificationEnabled } from '../projectNotificationPreferences.js';

type DiaryAutomationPrisma = Pick<PrismaClient, 'dailyDiary' | 'notification'>;

type DiaryProjectForAutomation = {
  id: string;
  name: string;
  companyId: string;
  workingHoursEnd: string | null;
  workingDays: string | null;
  settings: string | null;
};

type DiaryNotificationRecipient = {
  id: string;
  email: string;
  fullName: string | null;
};

type DiaryNotificationDeliverySummary = {
  inAppCreated: number;
  emailsSent: number;
  emailsQueued: number;
  emailsFailed: number;
};

export type DiaryAutomationJobOptions = {
  now?: Date;
  limit?: number;
  projectIds?: string[];
};

export type DiaryReminderAutomationResult = DiaryNotificationDeliverySummary & {
  projectsChecked: number;
  remindersCreated: number;
  skippedProjects: number;
  usersNotified: number;
  date: string;
};

export type DiaryAutomationDependencies = {
  prisma: DiaryAutomationPrisma;
  dayMs: number;
  diaryReminderRoles: string[];
  findActiveProjects(options: DiaryAutomationJobOptions): Promise<DiaryProjectForAutomation[]>;
  findProjectUsersByRoles(
    projectId: string,
    roles: string[],
  ): Promise<DiaryNotificationRecipient[]>;
  notifyUsers(
    users: DiaryNotificationRecipient[],
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
  ): Promise<DiaryNotificationDeliverySummary & { usersNotified: number }>;
};

export async function processDueDiaryReminders(
  options: DiaryAutomationJobOptions,
  deps: DiaryAutomationDependencies,
): Promise<DiaryReminderAutomationResult> {
  const now = options.now ?? new Date();
  const targetDate = startOfDay(now);
  const dateKey = formatDateKey(targetDate);
  const projects = await deps.findActiveProjects(options);
  const result: DiaryReminderAutomationResult = {
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
    // Respect the project-level "Daily Diary Reminders" toggle. When an admin
    // turns it off, skip reminders for that project entirely (in-app + email).
    // Absent/missing settings default to on.
    if (!isProjectNotificationEnabled(project.settings, 'dailyDiaryReminders')) {
      result.skippedProjects += 1;
      continue;
    }

    if (!isWorkingDay(project, targetDate) || !isDueForProjectTime(now, project.workingHoursEnd)) {
      result.skippedProjects += 1;
      continue;
    }

    const existingDiary = await deps.prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + deps.dayMs),
        },
      },
    });

    if (existingDiary) {
      result.skippedProjects += 1;
      continue;
    }

    const existingReminder = await deps.prisma.notification.findFirst({
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

    const users = await deps.findProjectUsersByRoles(project.id, deps.diaryReminderRoles);
    const message = `No daily diary entry found for ${project.name} on ${dateKey}. Please complete your site diary.`;
    const delivery = await deps.notifyUsers(
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

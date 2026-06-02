import type { PrismaClient } from '@prisma/client';
import { parsePositiveInteger, startOfDay } from './helpers.js';
import type { NotificationTypeWithTiming } from './preferences.js';

const DOCKET_BACKLOG_ALERT_ROLES = ['foreman', 'project_manager', 'admin'];

type BacklogAutomationPrisma = Pick<PrismaClient, 'dailyDocket' | 'notification'>;

type BacklogNotificationRecipient = {
  id: string;
  email: string;
  fullName: string | null;
};

type BacklogNotificationDeliverySummary = {
  inAppCreated: number;
  emailsSent: number;
  emailsQueued: number;
  emailsFailed: number;
};

type BacklogAutomationJobOptions = {
  now?: Date;
  limit?: number;
  projectIds?: string[];
  overdueHours?: number;
};

export type DocketBacklogAutomationResult = BacklogNotificationDeliverySummary & {
  overdueDockets: number;
  projectsWithBacklog: number;
  alertsCreated: number;
  skippedProjects: number;
  usersNotified: number;
};

export type BacklogAutomationDependencies = {
  prisma: BacklogAutomationPrisma;
  hourMs: number;
  defaultJobLimit: number;
  findProjectUsersByRoles(
    projectId: string,
    roles: string[],
  ): Promise<BacklogNotificationRecipient[]>;
  notifyUsers(
    users: BacklogNotificationRecipient[],
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
  ): Promise<BacklogNotificationDeliverySummary & { usersNotified: number }>;
};

export async function processDocketBacklogAlerts(
  options: BacklogAutomationJobOptions,
  deps: BacklogAutomationDependencies,
): Promise<DocketBacklogAutomationResult> {
  const now = options.now ?? new Date();
  const cutoffTime = new Date(
    now.getTime() - parsePositiveInteger(options.overdueHours, 48) * deps.hourMs,
  );
  const today = startOfDay(now);
  const projectIds = options.projectIds;
  const overdueDockets = await deps.prisma.dailyDocket.findMany({
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
    take: parsePositiveInteger(options.limit, deps.defaultJobLimit),
  });

  const docketsByProject = new Map<string, typeof overdueDockets>();
  for (const docket of overdueDockets) {
    const projectDockets = docketsByProject.get(docket.projectId) ?? [];
    projectDockets.push(docket);
    docketsByProject.set(docket.projectId, projectDockets);
  }

  const result: DocketBacklogAutomationResult = {
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

    const existingAlert = await deps.prisma.notification.findFirst({
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
    const users = await deps.findProjectUsersByRoles(projectId, DOCKET_BACKLOG_ALERT_ROLES);
    const inAppMessage = `${docketCount} docket(s) have been pending approval for more than 48 hours on ${project.name}: ${docketIds}${moreText}. Please review.`;
    const delivery = await deps.notifyUsers(
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

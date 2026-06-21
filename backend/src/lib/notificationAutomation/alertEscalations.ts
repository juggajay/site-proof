import type { PrismaClient } from '@prisma/client';
import { ALERT_ESCALATION_CONFIG, type AlertType } from '../notificationAlertConfig.js';
import { buildProjectEntityLink, parsePositiveInteger } from './helpers.js';
import type { NotificationTypeWithTiming } from './preferences.js';

type AlertEscalationPrisma = Pick<PrismaClient, 'notificationAlert'>;

type AlertEscalationJobOptions = {
  now?: Date;
  limit?: number;
  projectIds?: string[];
  alertIds?: string[];
};

type AlertEscalationNotificationRecipient = {
  id: string;
  email: string;
  fullName: string | null;
};

type AlertEscalationDeliverySummary = {
  inAppCreated: number;
  emailsSent: number;
  emailsQueued: number;
  emailsFailed: number;
};

export type AlertEscalationAutomationResult = AlertEscalationDeliverySummary & {
  alertsChecked: number;
  escalated: number;
  skippedAlerts: number;
  usersNotified: number;
};

export type AlertEscalationAutomationDependencies = {
  prisma: AlertEscalationPrisma;
  hourMs: number;
  defaultJobLimit: number;
  findEscalationUsers(
    projectId: string | null,
    roles: string[],
    fallbackUserId: string,
  ): Promise<AlertEscalationNotificationRecipient[]>;
  notifyUsers(
    users: AlertEscalationNotificationRecipient[],
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
  ): Promise<AlertEscalationDeliverySummary & { usersNotified: number }>;
};

function emptyAlertEscalationResult(): AlertEscalationAutomationResult {
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

function isAlertType(value: string): value is AlertType {
  return Object.prototype.hasOwnProperty.call(ALERT_ESCALATION_CONFIG, value);
}

export async function processAlertEscalations(
  options: AlertEscalationJobOptions,
  deps: AlertEscalationAutomationDependencies,
): Promise<AlertEscalationAutomationResult> {
  const now = options.now ?? new Date();
  const alertIds = options.alertIds;
  if (alertIds && alertIds.length === 0) {
    return emptyAlertEscalationResult();
  }

  const alerts = await deps.prisma.notificationAlert.findMany({
    where: {
      resolvedAt: null,
      ...(alertIds ? { id: { in: alertIds } } : {}),
      ...(options.projectIds ? { projectId: { in: options.projectIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: parsePositiveInteger(options.limit, deps.defaultJobLimit),
  });
  const result: AlertEscalationAutomationResult = {
    ...emptyAlertEscalationResult(),
    alertsChecked: alerts.length,
  };

  for (const alert of alerts) {
    if (!isAlertType(alert.type)) {
      result.skippedAlerts += 1;
      continue;
    }

    const config = ALERT_ESCALATION_CONFIG[alert.type];
    const hoursSinceCreation = (now.getTime() - alert.createdAt.getTime()) / deps.hourMs;
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

    const escalationUsers = await deps.findEscalationUsers(
      alert.projectId,
      config.escalationRoles,
      alert.assignedToId,
    );
    const escalatedToIds = escalationUsers.map((user) => user.id);
    const updateResult = await deps.prisma.notificationAlert.updateMany({
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
    const delivery = await deps.notifyUsers(
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

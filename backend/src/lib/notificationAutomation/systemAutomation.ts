import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import {
  getAlertEmailNotificationType,
  STALE_HOLD_POINT_ALERT_ROLES,
} from '../notificationAlertConfig.js';
import { buildProjectEntityLink, formatDateKey, getPreviousWorkingDay } from './helpers.js';
import type { NotificationTypeWithTiming } from './preferences.js';

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

type SystemAlertType = 'overdue_ncr' | 'stale_hold_point' | 'pending_approval' | 'overdue_test';
type SystemAlertSeverity = 'medium' | 'high' | 'critical';

type SystemAutomationPrisma = Pick<
  PrismaClient,
  'dailyDiary' | 'holdPoint' | 'nCR' | 'notification' | 'notificationAlert' | 'projectUser' | 'user'
>;

type SystemProjectForAutomation = {
  id: string;
  name: string;
  companyId: string;
  workingHoursEnd: string | null;
  workingDays: string | null;
};

type SystemNotificationRecipient = {
  id: string;
  email: string;
  fullName: string | null;
};

type SystemAutomationJobOptions = {
  now?: Date;
  limit?: number;
  projectIds?: string[];
};

export type CreatedSystemAlert = {
  type: 'overdue_ncr' | 'stale_hold_point' | 'missing_diary';
  alertId: string;
  entityId: string;
  projectName: string;
  severity: SystemAlertSeverity;
  message: string;
};

export type SystemAlertAutomationResult = {
  projectsChecked: number;
  alertsCreated: number;
  overdueNcrAlerts: number;
  staleHoldPointAlerts: number;
  missingDiaryAlerts: number;
  notificationsCreated: number;
  skippedAlerts: number;
  createdAlerts: CreatedSystemAlert[];
};

type SystemNotificationDeliverySummary = {
  inAppCreated: number;
  emailsSent: number;
  emailsQueued: number;
  emailsFailed: number;
};

export type SystemAutomationDependencies = {
  prisma: SystemAutomationPrisma;
  dayMs: number;
  hourMs: number;
  findActiveProjects(options: SystemAutomationJobOptions): Promise<SystemProjectForAutomation[]>;
  findProjectUsersByRoles(
    projectId: string,
    roles: string[],
  ): Promise<SystemNotificationRecipient[]>;
  notifyUsers(
    users: SystemNotificationRecipient[],
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
  ): Promise<SystemNotificationDeliverySummary & { usersNotified: number }>;
};

function generateAlertId(): string {
  return `alert-${randomUUID()}`;
}

async function findProjectAlertOwnerId(
  prisma: SystemAutomationPrisma,
  project: SystemProjectForAutomation,
): Promise<string | null> {
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

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

// Returns the created alert id, or null when a concurrent run already created
// the same active alert — the partial unique index on (type, entity_id) WHERE
// resolved_at IS NULL makes the race loser fail with P2002 instead of writing
// a duplicate. Callers must skip notifications when null.
async function createAlertRecord(
  prisma: SystemAutomationPrisma,
  data: {
    type: SystemAlertType;
    severity: SystemAlertSeverity;
    title: string;
    message: string;
    entityId: string;
    entityType: string;
    projectId: string;
    assignedToId: string;
    createdAt: Date;
  },
): Promise<string | null> {
  const id = generateAlertId();
  try {
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
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return null;
    }
    throw error;
  }

  return id;
}

export async function processSystemAlerts(
  options: SystemAutomationJobOptions,
  deps: SystemAutomationDependencies,
): Promise<SystemAlertAutomationResult> {
  const now = options.now ?? new Date();
  const projects = await deps.findActiveProjects(options);
  const result: SystemAlertAutomationResult = {
    projectsChecked: projects.length,
    alertsCreated: 0,
    overdueNcrAlerts: 0,
    staleHoldPointAlerts: 0,
    missingDiaryAlerts: 0,
    notificationsCreated: 0,
    skippedAlerts: 0,
    createdAlerts: [],
  };

  for (const project of projects) {
    const alertOwnerId = await findProjectAlertOwnerId(deps.prisma, project);
    const overdueNcrs = await deps.prisma.nCR.findMany({
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
      const existingAlert = await deps.prisma.notificationAlert.findFirst({
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
        ? Math.ceil((now.getTime() - ncr.dueDate.getTime()) / deps.dayMs)
        : 0;
      const severity: SystemAlertSeverity =
        daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium';
      const title = `NCR ${ncr.ncrNumber} is overdue`;
      const message = `NCR ${ncr.ncrNumber} is ${daysOverdue} day(s) overdue. ${ncr.description?.substring(0, 100) || 'No description'}`;
      const alertId = await createAlertRecord(deps.prisma, {
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
      if (alertId === null) {
        result.skippedAlerts += 1;
        continue;
      }
      await deps.prisma.notification.create({
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
      result.createdAlerts.push({
        type: 'overdue_ncr',
        alertId,
        entityId: ncr.id,
        projectName: project.name,
        severity,
        message: title,
      });
    }

    const staleThreshold = new Date(now.getTime() - deps.dayMs);
    const staleHoldPoints = await deps.prisma.holdPoint.findMany({
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
      const existingAlert = await deps.prisma.notificationAlert.findFirst({
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
        ? Math.ceil((now.getTime() - holdPoint.scheduledDate.getTime()) / deps.hourMs)
        : 0;
      const severity: SystemAlertSeverity =
        hoursStale > 48 ? 'critical' : hoursStale > 24 ? 'high' : 'medium';
      const title = `Hold Point stale: Lot ${holdPoint.lot.lotNumber}`;
      const message = `Hold Point for Lot ${holdPoint.lot.lotNumber} has been ${holdPoint.status} for ${hoursStale} hours. ${holdPoint.itpChecklistItem?.description?.substring(0, 80) || ''}`;
      const alertId = await createAlertRecord(deps.prisma, {
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
      if (alertId === null) {
        result.skippedAlerts += 1;
        continue;
      }

      const users = await deps.findProjectUsersByRoles(project.id, STALE_HOLD_POINT_ALERT_ROLES);
      if (users.length > 0) {
        await deps.prisma.notification.createMany({
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
      result.createdAlerts.push({
        type: 'stale_hold_point',
        alertId,
        entityId: holdPoint.id,
        projectName: project.name,
        severity,
        message: title,
      });
    }

    const missingDiaryDate = getPreviousWorkingDay(now, project.workingDays);
    const missingDiaryDateKey = formatDateKey(missingDiaryDate);
    const existingDiary = await deps.prisma.dailyDiary.findFirst({
      where: {
        projectId: project.id,
        date: {
          gte: missingDiaryDate,
          lt: new Date(missingDiaryDate.getTime() + deps.dayMs),
        },
      },
    });

    if (!existingDiary) {
      const missingDiaryEntityId = `diary-${project.id}-${missingDiaryDateKey}`;
      const existingMissingAlert = await deps.prisma.notificationAlert.findFirst({
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
        const alertId = await createAlertRecord(deps.prisma, {
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
        if (alertId === null) {
          result.skippedAlerts += 1;
          continue;
        }

        // M60: this is the single missing-diary alert. It both escalates (via
        // the notificationAlert record created above) AND notifies recipients
        // in-app + by email through the shared notifyUsers helper, replacing the
        // former duplicate emit in diaryAutomation.processMissingDiaryAlerts.
        const users = await deps.findProjectUsersByRoles(project.id, SYSTEM_DIARY_ALERT_ROLES);
        const linkUrl = `/projects/${project.id}/diary`;
        const delivery = await deps.notifyUsers(
          users,
          {
            projectId: project.id,
            type: 'alert_missing_diary',
            title,
            message,
            linkUrl,
            createdAt: now,
          },
          getAlertEmailNotificationType({ type: 'pending_approval', entityType: 'diary' }),
          {
            title,
            message,
            projectName: project.name,
            linkUrl,
          },
        );

        result.alertsCreated += 1;
        result.missingDiaryAlerts += 1;
        result.notificationsCreated += delivery.inAppCreated;
        result.createdAlerts.push({
          type: 'missing_diary',
          alertId,
          entityId: missingDiaryEntityId,
          projectName: project.name,
          severity: 'high',
          message: title,
        });
      }
    }
  }

  return result;
}

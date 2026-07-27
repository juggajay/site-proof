import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { STALE_HOLD_POINT_ALERT_ROLES } from '../notificationAlertConfig.js';
import { daysOverdue } from '../readiness/predicates.js';
import { buildProjectEntityLink } from './helpers.js';
import { resolveClearedSystemAlerts } from './systemAlertResolution.js';

const ALERT_OWNER_ROLE_PRIORITY = [
  'project_manager',
  'quality_manager',
  'superintendent',
  'admin',
  'owner',
  'site_engineer',
  'foreman',
];

type SystemAlertType = 'overdue_ncr' | 'stale_hold_point';
type SystemAlertSeverity = 'medium' | 'high' | 'critical';

type SystemAutomationPrisma = Pick<
  PrismaClient,
  'holdPoint' | 'nCR' | 'notification' | 'notificationAlert' | 'projectUser' | 'user'
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
  type: 'overdue_ncr' | 'stale_hold_point';
  alertId: string;
  entityId: string;
  projectName: string;
  severity: SystemAlertSeverity;
  message: string;
};

export type SystemAlertAutomationResult = {
  projectsChecked: number;
  alertsResolved: number;
  alertsCreated: number;
  overdueNcrAlerts: number;
  staleHoldPointAlerts: number;
  notificationsCreated: number;
  skippedAlerts: number;
  createdAlerts: CreatedSystemAlert[];
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

  // Resolve alerts whose condition has cleared BEFORE creating new ones, under
  // the caller's advisory lock, so a resolved-then-recurred condition writes a
  // clean new row against the partial unique index this same pass.
  const alertsResolved = await resolveClearedSystemAlerts(
    { now, projectIds: options.projectIds },
    { prisma: deps.prisma, dayMs: deps.dayMs },
  );

  const projects = await deps.findActiveProjects(options);
  const result: SystemAlertAutomationResult = {
    projectsChecked: projects.length,
    alertsResolved,
    alertsCreated: 0,
    overdueNcrAlerts: 0,
    staleHoldPointAlerts: 0,
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

      // Same helper the dashboard widget and Needs Attention use, so the alert
      // body quotes the number every other surface shows for this NCR. It floors
      // where this used to ceil: severity now crosses >3/>7 a day later, which is
      // the correction — ceil called a minute-old overdue "1 day overdue" (#1625).
      const overdueDays = daysOverdue(ncr.dueDate, now);
      const severity: SystemAlertSeverity =
        overdueDays > 7 ? 'critical' : overdueDays > 3 ? 'high' : 'medium';
      const title = `NCR ${ncr.ncrNumber} is overdue`;
      const message = `NCR ${ncr.ncrNumber} is ${overdueDays} day(s) overdue. ${ncr.description?.substring(0, 100) || 'No description'}`;
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
  }

  return result;
}

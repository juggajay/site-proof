import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { STALE_HOLD_POINT_ALERT_ROLES } from '../notificationAlertConfig.js';
import { AWAITING_RELEASE_HOLD_POINT_STATUSES, daysOverdue } from '../readiness/predicates.js';
import { logInfo } from '../serverLogger.js';
import { buildProjectEntityLink, parseProjectIdAllowlist } from './helpers.js';
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

// ---------------------------------------------------------------------------
// Wave E1 storm control (spec §4.1.3). Sized against the production inventory
// run on 2026-07-28 (spec §0.6, recorded on PR #1651): the repointed scan
// matches 2 hold points all-time and 0 within the horizon, across all projects,
// with a maximum alert-role fan-out of 4 users per project. Worst case for one
// pass at these numbers is therefore 50 alert rows + 50x4 = 200 in-app
// notification rows; the measured case is zero.
// ---------------------------------------------------------------------------

/** Per-project page size for the stale scan — previously an unbounded findMany. */
const STALE_HOLD_POINT_SCAN_TAKE = 200;

/**
 * Global cap on alerts CREATED by the stale scan in one pass, decremented
 * across projects. A per-project take multiplied by every active project is not
 * a global bound, and the runner deliberately has no project cap
 * (`notificationAutomation.ts:177-181`), so this is the bound that actually
 * holds. Deliberately smaller than the per-project take so a pass can always
 * page past hold points that already have an active alert.
 */
const STALE_HOLD_POINT_ALERTS_PER_PASS = 50;

/**
 * Only hold points scheduled within this many days of `now` are eligible. Bounds
 * the first pass after E1 deploys: without it, a hold point scheduled two years
 * ago would alert today as if it were news. Creation only — the resolver
 * (`systemAlertResolution.ts`) deliberately has NO horizon, so an alert already
 * open still closes when its condition clears, however old it gets.
 */
const STALE_HOLD_POINT_HORIZON_DAYS = 30;

/**
 * Wave E canary allowlist (spec §4.1.3, E.0 item 8c). Comma-separated project
 * ids; read once per pass. FAILS CLOSED — unset, blank or separator-only means
 * an EMPTY list, and an empty list means the stale-hold-point scan is skipped
 * for every project, so the E1 deploy is inert until Jay names projects.
 *
 * Deliberately NOT plumbed through `options.projectIds`: that option scopes the
 * whole system-alerts pass, and narrowing it here would also stop overdue-NCR
 * alerts for every project outside the canary — a shipped feature this wave
 * must not touch. It gates the stale scan and nothing else.
 */
const WAVE_E_CANARY_ENV = 'WAVE_E_STALE_ALERT_PROJECT_IDS';

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
  /**
   * Upper bound on eligible hold points this pass did NOT alert on because the
   * global per-pass cap was spent. Deliberate backpressure, never a silent
   * drop: the next hourly pass picks them up (spec §4.1.3 item 3).
   */
  staleHoldPointsDeferred: number;
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

/**
 * Mutable state the stale-hold-point scan carries ACROSS projects within one
 * pass. The alert budget is global by design: a per-project take multiplied by
 * every active project is not a bound.
 */
type StaleScanState = {
  canaryProjectIds: Set<string>;
  budget: number;
  cursor: { projectId: string; scheduledDate: Date | null; id: string } | null;
  projectsDeferred: number;
  truncatedProjects: number;
};

/**
 * The stale-hold-point half of one project's pass (Wave E1, spec §4.1.2/§4.1.3).
 * Extracted from `processSystemAlerts` when E1's bounds pushed that function
 * over the complexity threshold — behaviour-identical, just its own scope.
 */
async function createStaleHoldPointAlerts(
  project: SystemProjectForAutomation,
  alertOwnerId: string | null,
  now: Date,
  deps: SystemAutomationDependencies,
  result: SystemAlertAutomationResult,
  scan: StaleScanState,
): Promise<void> {
  // Canary gate. Scopes the stale scan only — the overdue-NCR pass runs for
  // every project, as it always has.
  if (!scan.canaryProjectIds.has(project.id)) return;

  if (scan.budget <= 0) {
    scan.projectsDeferred += 1;
    return;
  }

  const staleThreshold = new Date(now.getTime() - deps.dayMs);
  const horizonStart = new Date(now.getTime() - STALE_HOLD_POINT_HORIZON_DAYS * deps.dayMs);
  const staleHoldPoints = await deps.prisma.holdPoint.findMany({
    where: {
      lot: { projectId: project.id },
      // Wave E1 `[E-B1]`: the status the request-release paths actually write.
      // The literal this replaced (['requested','scheduled']) had no producer
      // that also sets scheduledDate, so this scan could not fire.
      status: { in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] },
      scheduledDate: { lt: staleThreshold, gte: horizonStart },
    },
    include: {
      lot: { select: { id: true, lotNumber: true } },
      itpChecklistItem: { select: { description: true } },
    },
    // Oldest first, stable. ponytail: the page includes hold points that
    // already have an active alert and will be skipped below, so a backlog
    // larger than the take could stall — the take is 4x the per-pass alert cap,
    // and the deferred count logged at the end of the pass is what would show
    // it if that ever stopped being true.
    orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
    take: STALE_HOLD_POINT_SCAN_TAKE,
  });
  if (staleHoldPoints.length === STALE_HOLD_POINT_SCAN_TAKE) {
    scan.truncatedProjects += 1;
  }

  for (const [index, holdPoint] of staleHoldPoints.entries()) {
    if (scan.budget <= 0) {
      // Upper bound, same convention as the escalation engine: counts every row
      // from the stop point on, including ones that already have an active
      // alert and would have been skipped.
      result.staleHoldPointsDeferred += staleHoldPoints.length - index;
      scan.cursor ??= {
        projectId: project.id,
        scheduledDate: holdPoint.scheduledDate,
        id: holdPoint.id,
      };
      return;
    }

    const existingAlert = await deps.prisma.notificationAlert.findFirst({
      where: {
        entityId: holdPoint.id,
        type: 'stale_hold_point',
        resolvedAt: null,
      },
    });

    if (existingAlert || !alertOwnerId) {
      result.skippedAlerts += 1;
      continue;
    }

    // Severity buckets stay in hours (never printed); the number the recipient
    // READS is the same floored day count the Needs Attention chip shows for
    // this hold point, so the email and the screen cannot disagree (#1625).
    const hoursStale = holdPoint.scheduledDate
      ? (now.getTime() - holdPoint.scheduledDate.getTime()) / deps.hourMs
      : 0;
    const daysStale = daysOverdue(holdPoint.scheduledDate, now);
    const severity: SystemAlertSeverity =
      hoursStale > 48 ? 'critical' : hoursStale > 24 ? 'high' : 'medium';
    const title = `Hold Point stale: Lot ${holdPoint.lot.lotNumber}`;
    const message = `Hold Point for Lot ${holdPoint.lot.lotNumber} has been ${holdPoint.status} for ${daysStale} day(s). ${holdPoint.itpChecklistItem?.description?.substring(0, 80) || ''}`;
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
    scan.budget -= 1;
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
    staleHoldPointsDeferred: 0,
    createdAlerts: [],
  };

  const scan: StaleScanState = {
    // Read once per pass, and always an array — see parseProjectIdAllowlist for
    // why `undefined` here would be an estate-wide storm rather than an inert
    // deploy (E.0 item 8c).
    canaryProjectIds: new Set(parseProjectIdAllowlist(process.env[WAVE_E_CANARY_ENV])),
    budget: STALE_HOLD_POINT_ALERTS_PER_PASS,
    cursor: null,
    projectsDeferred: 0,
    truncatedProjects: 0,
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

    await createStaleHoldPointAlerts(project, alertOwnerId, now, deps, result, scan);
  }

  if (
    result.staleHoldPointsDeferred > 0 ||
    scan.projectsDeferred > 0 ||
    scan.truncatedProjects > 0
  ) {
    logInfo('[Notification Automation] Stale hold-point scan bounded', {
      alertsPerPassCap: STALE_HOLD_POINT_ALERTS_PER_PASS,
      staleHoldPointAlerts: result.staleHoldPointAlerts,
      deferredUpperBound: result.staleHoldPointsDeferred,
      projectsDeferred: scan.projectsDeferred,
      truncatedProjects: scan.truncatedProjects,
      cursor: scan.cursor,
    });
  }

  return result;
}

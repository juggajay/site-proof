import type { PrismaClient } from '@prisma/client';
import {
  ALERT_ESCALATION_CONFIG,
  getAlertEmailNotificationType,
  type AlertEscalationConfig,
  type AlertType,
} from '../notificationAlertConfig.js';
import { buildProjectEntityLink } from './helpers.js';
import { logInfo } from '../serverLogger.js';
import type { NotificationTypeWithTiming } from './preferences.js';

type AlertEscalationPrisma = Pick<PrismaClient, 'notificationAlert'>;

// Types that have escalation timing configured; anything else can never escalate
// and is excluded from the scan (rather than fetched-then-skipped).
const ESCALATABLE_TYPES = Object.keys(ALERT_ESCALATION_CONFIG);

// Cursor page size for the eligible-alert scan (state reads/updates are
// uncapped — the whole backlog is paged through).
const DEFAULT_BATCH_SIZE = 500;

// Max escalate-and-notify actions per run. Pagination lets a single pass SCAN
// the entire eligible backlog, but each escalation fires an in-app notification
// plus an email to every recipient, so the volume actually SENT per run is
// bounded here. When the cap is hit the pass stops and logs how many eligible
// alerts remain; those keep escalationLevel unchanged and are picked up on the
// next hourly run — deliberate backpressure, never a silent drop. Escalation
// state update and notification are one unit (marking escalated IS the trigger
// to notify), so both are gated by this cap together; decoupling them would
// mark alerts escalated with no notification ever sent.
// ponytail: fixed 200/run; make it env-tunable only if ops ever needs to.
const DEFAULT_SEND_CAP = 200;

type AlertEscalationJobOptions = {
  now?: Date;
  batchSize?: number;
  sendCap?: number;
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
  batchSize?: number;
  sendCap?: number;
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

type EligibleAlert = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityId: string;
  entityType: string;
  projectId: string | null;
  assignedToId: string;
  createdAt: Date;
  escalationLevel: number;
};

// The single next escalation level for an aged alert, or null if it is not yet
// due (0 -> 1 after firstEscalationAfterHours, 1 -> 2 after the second; 2 is
// terminal). Pure, so the pagination loop stays flat.
function nextEscalationLevel(
  alert: EligibleAlert,
  config: AlertEscalationConfig,
  hourMs: number,
  now: Date,
): number | null {
  const hoursSinceCreation = (now.getTime() - alert.createdAt.getTime()) / hourMs;
  if (alert.escalationLevel === 0 && hoursSinceCreation >= config.firstEscalationAfterHours) {
    return 1;
  }
  if (alert.escalationLevel === 1 && hoursSinceCreation >= config.secondEscalationAfterHours) {
    return 2;
  }
  return null;
}

// Flip escalationLevel under the optimistic guard, then notify recipients.
// Returns null (no notification) when the guard loses the race — another pass
// escalated or resolved the alert first, so nothing is sent.
async function deliverEscalation(
  alert: EligibleAlert,
  config: AlertEscalationConfig,
  newLevel: number,
  now: Date,
  deps: AlertEscalationAutomationDependencies,
): Promise<(AlertEscalationDeliverySummary & { usersNotified: number }) | null> {
  const escalationUsers = await deps.findEscalationUsers(
    alert.projectId,
    config.escalationRoles,
    alert.assignedToId,
  );
  const updateResult = await deps.prisma.notificationAlert.updateMany({
    where: { id: alert.id, resolvedAt: null, escalationLevel: alert.escalationLevel },
    data: {
      escalationLevel: newLevel,
      escalatedAt: now,
      escalatedTo: escalationUsers.map((user) => user.id),
    },
  });
  if (updateResult.count === 0) {
    return null;
  }

  const linkUrl = buildProjectEntityLink(alert.entityType, alert.entityId, alert.projectId);
  const thresholdHours =
    newLevel === 1 ? config.firstEscalationAfterHours : config.secondEscalationAfterHours;
  return deps.notifyUsers(
    escalationUsers,
    {
      projectId: alert.projectId,
      type: 'alert_escalation',
      title: `ESCALATED: ${alert.title}`,
      message: `Alert has been escalated (Level ${newLevel}): ${alert.message}`,
      linkUrl,
      createdAt: now,
    },
    getAlertEmailNotificationType(alert),
    {
      title: `ESCALATED ALERT: ${alert.title}`,
      message: `This alert has been escalated to you because it was not resolved within ${thresholdHours} hours.\n\n${alert.message}`,
      linkUrl,
    },
  );
}

/**
 * Escalate active alerts that have aged past their configured thresholds.
 *
 * Bounded, paginated (forward-only cursor on id, default 500/page), and
 * idempotent. Idempotency is durable via the escalationLevel column, not the
 * old take-100 cap: an alert escalates 0 -> 1 then 1 -> 2 only, each transition
 * guarded by an optimistic updateMany (where escalationLevel = the value we
 * read). A notification is sent ONLY when that update flips the level, so a
 * re-run over an already-escalated alert reads its new level, finds no pending
 * transition, and sends nothing. Alerts at level 2 (terminal) are excluded from
 * the scan entirely.
 *
 * Processing (scanning + skip decisions) is uncapped — the whole eligible
 * backlog is paged. SENDING is capped at sendCap escalate-and-notify actions
 * per run; when reached the pass stops and logs the remaining eligible count.
 * Runs inside the same advisory-lock pass as creation/resolution.
 */
export async function processAlertEscalations(
  options: AlertEscalationJobOptions,
  deps: AlertEscalationAutomationDependencies,
): Promise<AlertEscalationAutomationResult> {
  const now = options.now ?? new Date();
  const alertIds = options.alertIds;
  if (alertIds && alertIds.length === 0) {
    return emptyAlertEscalationResult();
  }
  const projectIds = options.projectIds;
  if (projectIds && projectIds.length === 0) {
    return emptyAlertEscalationResult();
  }

  const batchSize = options.batchSize ?? deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const sendCap = options.sendCap ?? deps.sendCap ?? DEFAULT_SEND_CAP;

  const scanWhere = {
    resolvedAt: null,
    // Level 2 is terminal (no third escalation), so it can never escalate again.
    escalationLevel: { lt: 2 },
    type: { in: ESCALATABLE_TYPES },
    ...(alertIds ? { id: { in: alertIds } } : {}),
    ...(projectIds ? { projectId: { in: projectIds } } : {}),
  };

  const result = emptyAlertEscalationResult();
  let cursor: string | undefined;
  let stoppedAtId: string | undefined;

  paging: for (;;) {
    // Explicit id > cursor (not Prisma skip/cursor) so pagination is
    // unambiguous even though the pass mutates escalationLevel — the ordering
    // column here (id) is immutable, so each page reads strictly forward and
    // never revisits a row escalated earlier in the same pass.
    const page = await deps.prisma.notificationAlert.findMany({
      where: { ...scanWhere, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1]!.id;
    result.alertsChecked += page.length;

    for (const alert of page) {
      if (!isAlertType(alert.type)) {
        result.skippedAlerts += 1;
        continue;
      }

      const config = ALERT_ESCALATION_CONFIG[alert.type];
      const newLevel = nextEscalationLevel(alert, config, deps.hourMs, now);
      if (newLevel === null) {
        result.skippedAlerts += 1;
        continue;
      }

      // Send cap gates the escalate-and-notify unit: stop BEFORE mutating so the
      // alert stays eligible (escalationLevel unchanged) for the next run.
      if (result.escalated >= sendCap) {
        stoppedAtId = alert.id;
        break paging;
      }

      const delivery = await deliverEscalation(alert, config, newLevel, now, deps);
      if (delivery === null) {
        result.skippedAlerts += 1;
        continue;
      }

      result.escalated += 1;
      result.inAppCreated += delivery.inAppCreated;
      result.emailsSent += delivery.emailsSent;
      result.emailsQueued += delivery.emailsQueued;
      result.emailsFailed += delivery.emailsFailed;
      result.usersNotified += delivery.usersNotified;
    }

    if (page.length < batchSize) break;
  }

  if (stoppedAtId !== undefined) {
    // Upper bound: counts every not-yet-escalated row from the stop point on
    // (level 0/1 alerts not yet past their time threshold are included), which
    // is enough to signal how much backlog is deferred to the next run.
    const remaining = await deps.prisma.notificationAlert.count({
      where: { ...scanWhere, id: { gte: stoppedAtId } },
    });
    logInfo('[Notification Automation] Escalation send cap reached', {
      sendCap,
      escalated: result.escalated,
      remainingEligibleUpperBound: remaining,
    });
  }

  return result;
}

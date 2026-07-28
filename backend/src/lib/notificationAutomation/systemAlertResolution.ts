import type { PrismaClient } from '@prisma/client';
import { AWAITING_RELEASE_HOLD_POINT_STATUSES } from '../readiness/predicates.js';

/**
 * Auto-resolution of system alerts whose underlying condition has cleared.
 *
 * Runs at the START of the system-alerts pass, under the SAME advisory lock as
 * creation and BEFORE it, so an alert that was resolved-then-recurred creates a
 * clean new row against the partial unique index
 * (notification_alerts_active_type_entity_key, WHERE resolved_at IS NULL).
 *
 * Each resolution condition is the exact inverse of the creation query in
 * systemAutomation.ts:
 *   - overdue_ncr     created for NCRs status NOT IN (closed, closed_concession)
 *                     AND dueDate < now  -> resolve when the NCR no longer
 *                     matches (closed, due date pushed/cleared, or deleted).
 *   - stale_hold_point created for hold points awaiting an external release
 *                     decision (AWAITING_RELEASE_HOLD_POINT_STATUSES) AND
 *                     scheduledDate < now - 1 day -> resolve when it no longer
 *                     matches (released/completed, rescheduled, deleted, or
 *                     re-requested into another status). Wave E1 imports the
 *                     SHARED constant the creator uses, replacing the private
 *                     copy this file carried: creator and resolver cannot
 *                     disagree about what "awaiting release" means.
 *
 *                     Deliberately NOT horizon-scoped and NOT canary-scoped,
 *                     unlike creation: an alert that exists must always be able
 *                     to close, however old its hold point is and whether or not
 *                     its project is still on the Wave E allowlist. Resolution
 *                     is a strict shrink of what stays open — it can never storm.
 *   - pending_approval/diary (the retired missing-diary alert) is no longer
 *                     created. This pass unconditionally resolves ANY active
 *                     alert of that type so the standing prod backlog drains
 *                     silently over successive runs and never escalates again.
 *
 * Resolution is silent bookkeeping: it sets resolved_at only (the schema has no
 * resolution reason/actor column) and sends NO notifications. This same path
 * drains the standing prod backlog over successive hourly runs.
 */

const RESOLVABLE_TYPES = ['overdue_ncr', 'stale_hold_point', 'pending_approval'];
const DEFAULT_BATCH_SIZE = 500;
const NCR_OPEN_STATUS_EXCLUDE = ['closed', 'closed_concession'];

type ResolutionPrisma = Pick<PrismaClient, 'nCR' | 'holdPoint' | 'notificationAlert'>;

export type SystemAlertResolutionDependencies = {
  prisma: ResolutionPrisma;
  dayMs: number;
  batchSize?: number;
};

export type SystemAlertResolutionOptions = {
  now: Date;
  projectIds?: string[];
};

type ActiveAlertRow = {
  id: string;
  type: string;
  entityId: string;
  entityType: string;
  projectId: string | null;
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeEntityType(entityType: string): string {
  return entityType.toLowerCase().replace(/[\s-]/g, '_');
}

async function idsStillMatchingNcr(
  prisma: ResolutionPrisma,
  ncrIds: string[],
  now: Date,
): Promise<Set<string>> {
  if (ncrIds.length === 0) return new Set();
  const rows = await prisma.nCR.findMany({
    where: {
      id: { in: ncrIds },
      status: { notIn: NCR_OPEN_STATUS_EXCLUDE },
      dueDate: { lt: now },
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

async function idsStillMatchingHoldPoint(
  prisma: ResolutionPrisma,
  holdPointIds: string[],
  staleThreshold: Date,
): Promise<Set<string>> {
  if (holdPointIds.length === 0) return new Set();
  const rows = await prisma.holdPoint.findMany({
    where: {
      id: { in: holdPointIds },
      status: { in: [...AWAITING_RELEASE_HOLD_POINT_STATUSES] },
      scheduledDate: { lt: staleThreshold },
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/**
 * Resolve active system alerts whose condition has cleared. Bounded, paginated
 * (cursor on id, default 500/page), and idempotent: already-resolved rows are
 * excluded by the resolved_at IS NULL filter, and resolved_at is stamped
 * per-batch with a short updateMany (no long transaction), so a crash mid-pass
 * leaves earlier batches durably resolved and the rest for the next run.
 * Returns the number of alerts resolved.
 */
export async function resolveClearedSystemAlerts(
  options: SystemAlertResolutionOptions,
  deps: SystemAlertResolutionDependencies,
): Promise<number> {
  const { prisma, dayMs } = deps;
  const projectIds = options.projectIds;
  if (projectIds && projectIds.length === 0) return 0;

  const batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE;
  const now = options.now;
  const staleThreshold = new Date(now.getTime() - dayMs);

  let cursor: string | undefined;
  let totalResolved = 0;

  for (;;) {
    // Explicit id > cursor (rather than Prisma cursor/skip) so pagination is
    // unambiguous even though this pass mutates the resolved_at filter it
    // orders under: each page reads strictly forward by id and never revisits.
    const page: ActiveAlertRow[] = await prisma.notificationAlert.findMany({
      where: {
        resolvedAt: null,
        type: { in: RESOLVABLE_TYPES },
        ...(projectIds ? { projectId: { in: projectIds } } : {}),
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      select: { id: true, type: true, entityId: true, entityType: true, projectId: true },
      orderBy: { id: 'asc' },
      take: batchSize,
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1]!.id;

    const ncrAlerts = page.filter((alert) => alert.type === 'overdue_ncr');
    const holdPointAlerts = page.filter((alert) => alert.type === 'stale_hold_point');
    // The missing-diary alert type is retired: sweep every active
    // pending_approval/diary row unconditionally (no diary lookup, no date
    // parsing, no age gate) so the standing backlog drains and none escalate.
    const diaryAlertIds = page
      .filter(
        (alert) =>
          alert.type === 'pending_approval' && normalizeEntityType(alert.entityType) === 'diary',
      )
      .map((alert) => alert.id);

    const stillOverdueNcr = await idsStillMatchingNcr(
      prisma,
      unique(ncrAlerts.map((alert) => alert.entityId)),
      now,
    );
    const stillStaleHoldPoint = await idsStillMatchingHoldPoint(
      prisma,
      unique(holdPointAlerts.map((alert) => alert.entityId)),
      staleThreshold,
    );

    const toResolve: string[] = [];
    for (const alert of ncrAlerts) {
      if (!stillOverdueNcr.has(alert.entityId)) toResolve.push(alert.id);
    }
    for (const alert of holdPointAlerts) {
      if (!stillStaleHoldPoint.has(alert.entityId)) toResolve.push(alert.id);
    }
    toResolve.push(...diaryAlertIds);

    if (toResolve.length > 0) {
      const updated = await prisma.notificationAlert.updateMany({
        where: { id: { in: toResolve }, resolvedAt: null },
        data: { resolvedAt: now },
      });
      totalResolved += updated.count;
    }

    if (page.length < batchSize) break;
  }

  return totalResolved;
}

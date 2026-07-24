import type { PrismaClient } from '@prisma/client';

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
 *   - stale_hold_point created for hold points status IN (requested, scheduled)
 *                     AND scheduledDate < now - 1 day -> resolve when it no
 *                     longer matches (released/completed, rescheduled, deleted).
 *   - pending_approval/diary (the missing-diary alert) created when NO diary
 *                     existed for project+date -> resolve when a diary now exists.
 *
 * Resolution is silent bookkeeping: it sets resolved_at only (the schema has no
 * resolution reason/actor column) and sends NO notifications. This same path
 * drains the standing prod backlog over successive hourly runs.
 */

const RESOLVABLE_TYPES = ['overdue_ncr', 'stale_hold_point', 'pending_approval'];
const DEFAULT_BATCH_SIZE = 500;
const NCR_OPEN_STATUS_EXCLUDE = ['closed', 'closed_concession'];
const STALE_HOLD_POINT_STATUSES = ['requested', 'scheduled'];
const DIARY_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
// Missing-diary alerts older than this drain unconditionally: nobody backfills a
// diary for a long-past date, so the alert can never clear via a diary appearing
// and has no remaining action value (stale beyond action value).
const STALE_DIARY_MAX_AGE_DAYS = 30;

type ResolutionPrisma = Pick<
  PrismaClient,
  'nCR' | 'holdPoint' | 'dailyDiary' | 'notificationAlert'
>;

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

// Reconstruct the missing-diary date window from the alert's entityId. The
// creator stored entityId = `diary-${projectId}-${YYYY-MM-DD}` where the date
// key is a UTC calendar date (formatDateKey uses toISOString). Railway prod and
// the test suite both run the server in UTC, so a UTC-midnight window matches
// the range the creator checked. Returns null for legacy/unparseable ids.
function parseDiaryDateKey(alert: ActiveAlertRow): string | null {
  if (!alert.projectId) return null;
  const prefix = `diary-${alert.projectId}-`;
  if (!alert.entityId.startsWith(prefix)) return null;
  const dateKey = alert.entityId.slice(prefix.length);
  return DIARY_DATE_KEY.test(dateKey) ? dateKey : null;
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
      status: { in: STALE_HOLD_POINT_STATUSES },
      scheduledDate: { lt: staleThreshold },
    },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

// Set of `${projectId}|${dateKey}` for which a diary now exists.
async function diaryKeysThatNowExist(
  prisma: ResolutionPrisma,
  diaryAlerts: Array<{ projectId: string; dateKey: string }>,
  dayMs: number,
): Promise<Set<string>> {
  if (diaryAlerts.length === 0) return new Set();
  const seen = new Set<string>();
  const conditions = diaryAlerts
    .filter((alert) => {
      const key = `${alert.projectId}|${alert.dateKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((alert) => {
      const start = new Date(`${alert.dateKey}T00:00:00.000Z`);
      return {
        projectId: alert.projectId,
        date: { gte: start, lt: new Date(start.getTime() + dayMs) },
      };
    });

  const diaries = await prisma.dailyDiary.findMany({
    where: { OR: conditions },
    select: { projectId: true, date: true },
  });

  return new Set(
    diaries.map((diary) => `${diary.projectId}|${diary.date.toISOString().split('T')[0]}`),
  );
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
  // UTC-midnight cutoff consistent with the module's dateKey handling. A diary
  // whose date is strictly before this resolves on age alone. Boundary: exactly
  // 30 days old (== cutoff) is NOT older-than-30-days, so it stays active.
  const staleDiaryCutoff =
    new Date(`${now.toISOString().split('T')[0]}T00:00:00.000Z`).getTime() -
    STALE_DIARY_MAX_AGE_DAYS * dayMs;

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
    const diaryAlerts = page
      .filter(
        (alert) =>
          alert.type === 'pending_approval' &&
          alert.entityType.toLowerCase().replace(/[\s-]/g, '_') === 'diary',
      )
      .map((alert) => ({ alert, dateKey: parseDiaryDateKey(alert) }))
      .filter(
        (entry): entry is { alert: ActiveAlertRow; dateKey: string } => entry.dateKey !== null,
      );

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
    const existingDiaryKeys = await diaryKeysThatNowExist(
      prisma,
      diaryAlerts.map((entry) => ({ projectId: entry.alert.projectId!, dateKey: entry.dateKey })),
      dayMs,
    );

    const toResolve: string[] = [];
    for (const alert of ncrAlerts) {
      if (!stillOverdueNcr.has(alert.entityId)) toResolve.push(alert.id);
    }
    for (const alert of holdPointAlerts) {
      if (!stillStaleHoldPoint.has(alert.entityId)) toResolve.push(alert.id);
    }
    for (const entry of diaryAlerts) {
      const diaryMidnight = new Date(`${entry.dateKey}T00:00:00.000Z`).getTime();
      if (
        existingDiaryKeys.has(`${entry.alert.projectId}|${entry.dateKey}`) ||
        diaryMidnight < staleDiaryCutoff
      ) {
        toResolve.push(entry.alert.id);
      }
    }

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

// NCR analytics and role-check endpoints
//
// Wave G G5 (`docs/plans/wave-g-execution-spec-2026-07-31.md` §5) rewrote the
// analytics query plan. Three things changed and each has a reason in the spec:
//
//  1. **The breakdowns are SQL aggregations, not a JS pass over an unbounded
//     `findMany`.** §8 P4 targets p95 < 2s at 5,000 NCRs/project and names the
//     shipped implementation as one that will not meet it; the `groupBy` pattern
//     is copied from the sibling report route (`routes/reports/ncrRoutes.ts`).
//     Monthly trends and the activity hop use parameterised `$queryRaw` because
//     `date_trunc` and a join are not expressible through `groupBy`.
//  2. **Every list is capped and carries counts, not id arrays.** [GR-N4]:
//     `repeatOffenders` was uncapped and each entry carried unbounded `ncrIds`
//     and `categories`. The `drillDown` block — an id array per bucket, the same
//     unbounded shape — is gone with it. The endpoint had zero frontend
//     consumers at HEAD, so nothing was depending on the removed block; the UI
//     drills down by filtering the NCR register on the folded category instead.
//  3. **The route is office-role gated.** §7 row 7: nothing in G5 is exposed to
//     `subcontractor` / `subcontractor_admin`, and repeat-offender data about
//     one subcontractor must never be readable by another. Shipped behaviour
//     admitted any active project user, `viewer` and `foreman` included.
//
// These are unflagged on purpose (see `lib/ncrVocabulary.ts` for the full note):
// they are defect fixes on a consumer-less route, and a flag on a defect fix
// means the defect ships.
import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  NCR_QUALITY_MANAGEMENT_ROLES,
  parseNcrRouteParam,
  requireActiveProjectUser,
} from './ncrAccess.js';
import { AppError } from '../../lib/AppError.js';
import {
  buildNcrAnalyticsResponse,
  buildNcrAnalyticsRoleResponse,
} from './ncrAnalyticsResponses.js';
import {
  buildActivityBuckets,
  buildRepeatIssues,
  foldCategoryCounts,
  foldRootCauseCounts,
} from './ncrAnalyticsAggregation.js';
import {
  loadRecurringChecklistItems,
  loadRepeatOffenders,
  raisedAtRange,
  toCount,
} from './ncrAnalyticsLoaders.js';

export const ncrAnalyticsRouter = Router();

const CLOSED_STATUSES = ['closed', 'closed_concession'];

function parseOptionalDateQuery(
  value: unknown,
  fieldName: string,
  endOfDay = false,
): Date | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a date in YYYY-MM-DD format`);
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw AppError.badRequest(`${fieldName} must be a date in YYYY-MM-DD format`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  if (endOfDay) {
    parsed.setUTCHours(23, 59, 59, 999);
  }

  return parsed;
}

function validateDateRange(startDate: Date | undefined, endDate: Date | undefined): void {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw AppError.badRequest('startDate must be before or equal to endDate');
  }
}

// GET /api/ncrs/analytics/:projectId - Get NCR analytics for a project
ncrAnalyticsRouter.get(
  '/analytics/:projectId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const projectId = parseNcrRouteParam(req.params.projectId, 'projectId');
    const startDate = parseOptionalDateQuery(req.query.startDate, 'startDate');
    const endDate = parseOptionalDateQuery(req.query.endDate, 'endDate', true);
    validateDateRange(startDate, endDate);

    // Spec §7 row 7. Repeat-offender data names one subcontractor's failure rate
    // to whoever is reading; that is an office judgement, never a field or
    // portal one.
    await requireActiveProjectUser(projectId, user, 'Access denied', NCR_QUALITY_MANAGEMENT_ROLES);

    const dateFilter: Prisma.DateTimeFilter = {};
    if (startDate) {
      dateFilter.gte = startDate;
    }
    if (endDate) {
      dateFilter.lte = endDate;
    }

    const where: Prisma.NCRWhereInput = { projectId };
    if (Object.keys(dateFilter).length > 0) {
      where.raisedAt = dateFilter;
    }

    const range = raisedAtRange(startDate, endDate);

    const [
      statusGroups,
      severityGroups,
      categoryGroups,
      rootCauseGroups,
      repeatIssueGroups,
      offenderCounts,
      overdueNCRs,
      linkedToChecklistItem,
      volumeRows,
      closureRows,
      activityRows,
      itemGroups,
    ] = await Promise.all([
      prisma.nCR.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.nCR.groupBy({ by: ['severity'], where, _count: { _all: true } }),
      prisma.nCR.groupBy({ by: ['category'], where, _count: { _all: true } }),
      prisma.nCR.groupBy({ by: ['rootCauseCategory'], where, _count: { _all: true } }),
      prisma.nCR.groupBy({
        by: ['category', 'rootCauseCategory'],
        where,
        _count: { _all: true },
      }),
      prisma.nCR.groupBy({
        by: ['responsibleSubcontractorId'],
        where: { ...where, responsibleSubcontractorId: { not: null } },
        _count: { _all: true },
      }),
      prisma.nCR.count({
        where: { ...where, dueDate: { lt: new Date() }, status: { notIn: CLOSED_STATUSES } },
      }),
      prisma.nCR.count({ where: { ...where, itpChecklistItemId: { not: null } } }),
      prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
        SELECT to_char(n.raised_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, COUNT(*) AS count
        FROM ncrs n
        WHERE n.project_id = ${projectId} ${range}
        GROUP BY 1
        ORDER BY 1
      `,
      prisma.$queryRaw<Array<{ month: string; count: bigint; total_days: number }>>`
        SELECT
          to_char(n.closed_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
          COUNT(*) AS count,
          SUM(EXTRACT(EPOCH FROM (n.closed_at - n.raised_at)) / 86400.0) AS total_days
        FROM ncrs n
        WHERE n.project_id = ${projectId} AND n.closed_at IS NOT NULL ${range}
        GROUP BY 1
        ORDER BY 1
      `,
      // AT-G28: the NCR -> NCRLot -> Lot.activitySlug hop. LEFT JOINs so an NCR
      // with no lot, or a lot with a null slug, lands in the explicit
      // "not classified" bucket rather than vanishing from the chart.
      // COUNT(DISTINCT) so a two-lot NCR is one NCR in each activity it touched.
      prisma.$queryRaw<Array<{ slug: string | null; count: bigint }>>`
        SELECT l.activity_slug AS slug, COUNT(DISTINCT n.id) AS count
        FROM ncrs n
        LEFT JOIN ncr_lots nl ON nl.ncr_id = n.id
        LEFT JOIN lots l ON l.id = nl.lot_id
        WHERE n.project_id = ${projectId} ${range}
        GROUP BY 1
      `,
      prisma.nCR.groupBy({
        by: ['itpChecklistItemId', 'responsibleSubcontractorId'],
        where: { ...where, itpChecklistItemId: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const statusBreakdown: Record<string, number> = {};
    let totalNCRs = 0;
    let closedNCRs = 0;
    for (const group of statusGroups) {
      const count = group._count._all;
      statusBreakdown[group.status] = count;
      totalNCRs += count;
      if (CLOSED_STATUSES.includes(group.status)) closedNCRs += count;
    }
    const openNCRs = totalNCRs - closedNCRs;

    const severityBreakdown: Record<string, number> = { minor: 0, major: 0 };
    for (const group of severityGroups) {
      severityBreakdown[group.severity] = group._count._all;
    }

    const rootCauseChartData = foldRootCauseCounts(
      rootCauseGroups.map((group) => ({
        value: group.rootCauseCategory,
        count: group._count._all,
      })),
      totalNCRs,
    );
    const categoryChartData = foldCategoryCounts(
      categoryGroups.map((group) => ({ value: group.category, count: group._count._all })),
      totalNCRs,
    );

    const volumeTrendData = volumeRows.map((row) => ({
      month: row.month,
      count: toCount(row.count),
    }));

    let closedTotalDays = 0;
    let closedWithDates = 0;
    const closureTimeTrendData = closureRows.map((row) => {
      const count = toCount(row.count);
      const totalDays = Number(row.total_days ?? 0);
      closedTotalDays += totalDays;
      closedWithDates += count;
      return {
        month: row.month,
        avgDays: count > 0 ? Math.round((totalDays / count) * 10) / 10 : 0,
        count,
      };
    });
    const avgDaysToClose =
      closedWithDates > 0 ? Math.round((closedTotalDays / closedWithDates) * 10) / 10 : 0;

    const activityChartData = buildActivityBuckets(
      activityRows.map((row) => ({ value: row.slug, count: toCount(row.count) })),
      totalNCRs,
    );

    const repeatIssues = buildRepeatIssues(
      repeatIssueGroups.map((group) => ({
        category: group.category,
        rootCauseCategory: group.rootCauseCategory,
        count: group._count._all,
      })),
    );

    const [repeatOffenders, recurring] = await Promise.all([
      loadRepeatOffenders(projectId, where, offenderCounts),
      loadRecurringChecklistItems(projectId, range, itemGroups),
    ]);

    res.json(
      buildNcrAnalyticsResponse({
        totalNCRs,
        openNCRs,
        closedNCRs,
        overdueNCRs,
        avgDaysToClose,
        rootCauseChartData,
        categoryChartData,
        activityChartData,
        severityBreakdown,
        statusBreakdown,
        closureTimeTrendData,
        volumeTrendData,
        repeatIssues,
        repeatOffenders,
        recurringItems: recurring.items,
        // Honest coverage, not an implied 100%: how many NCRs carry the
        // checklist-item link at all, and how many of the recurring groups
        // resolved to an item with no lineage pointer (every row created before
        // G2 is its own root).
        checklistItemCoverage: {
          linked: linkedToChecklistItem,
          total: totalNCRs,
          itemsWithoutLineage: recurring.itemsWithoutLineage,
          itemsObserved: recurring.itemsObserved,
        },
      }),
    );
  }),
);

// Helper endpoint to get user's role on a project
ncrAnalyticsRouter.get(
  '/check-role/:projectId',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as AuthUser;
    const projectId = parseNcrRouteParam(req.params.projectId, 'projectId');

    const projectUser = await requireActiveProjectUser(projectId, user);

    const isQualityManager = NCR_QUALITY_MANAGEMENT_ROLES.includes(projectUser.role);

    res.json(buildNcrAnalyticsRoleResponse(projectUser.role, isQualityManager));
  }),
);

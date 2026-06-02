import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

type AuthUser = NonNullable<Express.Request['user']>;

type ReportPagination = {
  pageNum: number;
  limitNum: number;
  skip: number;
};

type GroupedCount = { _count: number } & Record<string, unknown>;

type LotStatusReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  parseReportPagination: (page: unknown, limit: unknown) => ReportPagination;
  requireReportProjectAccess: (user: AuthUser | undefined, projectId: string) => Promise<string>;
  groupedCountsToRecord: (
    groups: GroupedCount[],
    key: string,
    fallback: string,
  ) => Record<string, number>;
};

export function createLotStatusReportRouter({
  parseRequiredString,
  parseReportPagination,
  requireReportProjectAccess,
  groupedCountsToRecord,
}: LotStatusReportRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/reports/lot-status - Lot status report
  router.get(
    '/lot-status',
    asyncHandler(async (req, res) => {
      const { page = '1', limit = '100' } = req.query;
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireReportProjectAccess(req.user, projectId);

      // Pagination parameters
      const { pageNum, limitNum, skip } = parseReportPagination(page, limit);
      const where = { projectId };

      // Calculate period comparison data across the full project, not just the current page
      const today = new Date();
      const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0); // Last day of previous month

      const [total, lots, statusGroups, activityGroups, conformedThisPeriod, conformedLastPeriod] =
        await Promise.all([
          prisma.lot.count({ where }),
          prisma.lot.findMany({
            where,
            select: {
              id: true,
              lotNumber: true,
              description: true,
              status: true,
              activityType: true,
              chainageStart: true,
              chainageEnd: true,
              offset: true,
              layer: true,
              areaZone: true,
              createdAt: true,
              conformedAt: true,
            },
            orderBy: { lotNumber: 'asc' },
            skip,
            take: limitNum,
          }),
          prisma.lot.groupBy({
            by: ['status'],
            where,
            _count: true,
          }),
          prisma.lot.groupBy({
            by: ['activityType'],
            where,
            _count: true,
          }),
          prisma.lot.count({
            where: {
              ...where,
              conformedAt: { gte: startOfThisMonth },
            },
          }),
          prisma.lot.count({
            where: {
              ...where,
              conformedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
            },
          }),
        ]);

      const statusCounts = groupedCountsToRecord(statusGroups, 'status', 'not_started');
      const activityCounts = groupedCountsToRecord(activityGroups, 'activityType', 'Unknown');

      // Calculate change from previous period
      const periodChange = conformedThisPeriod - conformedLastPeriod;
      const periodChangePercent =
        conformedLastPeriod > 0
          ? ((periodChange / conformedLastPeriod) * 100).toFixed(1)
          : conformedThisPeriod > 0
            ? '+100.0'
            : '0.0';

      // Generate report summary
      const report = {
        generatedAt: new Date().toISOString(),
        projectId,
        totalLots: total,
        statusCounts,
        activityCounts,
        lots: lots.map((lot) => ({
          ...lot,
          status: lot.status || 'not_started',
        })),
        summary: {
          notStarted: statusCounts['not_started'] || 0,
          inProgress: statusCounts['in_progress'] || 0,
          awaitingTest: statusCounts['awaiting_test'] || 0,
          holdPoint: statusCounts['hold_point'] || 0,
          ncrRaised: statusCounts['ncr_raised'] || 0,
          conformed: statusCounts['conformed'] || 0,
          claimed: statusCounts['claimed'] || 0,
        },
        periodComparison: {
          conformedThisPeriod,
          conformedLastPeriod,
          periodChange,
          periodChangePercent,
          currentPeriodLabel: startOfThisMonth.toLocaleDateString('en-AU', {
            month: 'short',
            year: 'numeric',
          }),
          previousPeriodLabel: startOfLastMonth.toLocaleDateString('en-AU', {
            month: 'short',
            year: 'numeric',
          }),
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      res.json(report);
    }),
  );

  return router;
}

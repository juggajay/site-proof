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

type NcrReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  parseReportPagination: (page: unknown, limit: unknown) => ReportPagination;
  requireReportProjectAccess: (user: AuthUser | undefined, projectId: string) => Promise<string>;
  groupedCountsToRecord: (
    groups: GroupedCount[],
    key: string,
    fallback: string,
  ) => Record<string, number>;
};

export function createNcrReportRouter({
  parseRequiredString,
  parseReportPagination,
  requireReportProjectAccess,
  groupedCountsToRecord,
}: NcrReportRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/reports/ncr - NCR report
  router.get(
    '/ncr',
    asyncHandler(async (req, res) => {
      const { page = '1', limit = '100' } = req.query;
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireReportProjectAccess(req.user, projectId);

      // Pagination parameters
      const { pageNum, limitNum, skip } = parseReportPagination(page, limit);
      const where = { projectId };
      const closedStatuses = ['closed', 'closed_concession'];
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        total,
        ncrs,
        statusGroups,
        categoryGroups,
        rootCauseGroups,
        overdueCount,
        closedThisMonth,
        closedNcrs,
        ncrsWithResponsible,
      ] = await Promise.all([
        prisma.nCR.count({ where }),
        prisma.nCR.findMany({
          where,
          select: {
            id: true,
            ncrNumber: true,
            description: true,
            category: true,
            status: true,
            raisedAt: true,
            closedAt: true,
            dueDate: true,
            rootCauseCategory: true,
          },
          orderBy: { ncrNumber: 'asc' },
          skip,
          take: limitNum,
        }),
        prisma.nCR.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.nCR.groupBy({
          by: ['category'],
          where,
          _count: true,
        }),
        prisma.nCR.groupBy({
          by: ['rootCauseCategory'],
          where,
          _count: true,
        }),
        prisma.nCR.count({
          where: {
            ...where,
            dueDate: { lt: today },
            status: { notIn: closedStatuses },
          },
        }),
        prisma.nCR.count({
          where: {
            ...where,
            closedAt: { gte: startOfMonth },
            status: { in: closedStatuses },
          },
        }),
        prisma.nCR.findMany({
          where: {
            ...where,
            closedAt: { not: null },
          },
          select: {
            raisedAt: true,
            closedAt: true,
          },
        }),
        prisma.nCR.findMany({
          where,
          select: {
            id: true,
            responsibleUser: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        }),
      ]);

      const statusCounts = groupedCountsToRecord(statusGroups, 'status', 'open');
      const categoryCounts = groupedCountsToRecord(categoryGroups, 'category', 'minor');
      const rootCauseCounts = groupedCountsToRecord(
        rootCauseGroups,
        'rootCauseCategory',
        'Not specified',
      );

      // Calculate average closure time (in days)
      let averageClosureTime = 0;
      if (closedNcrs.length > 0) {
        const totalClosureTime = closedNcrs.reduce((sum, ncr) => {
          const raisedDate = new Date(ncr.raisedAt);
          const closedDate = new Date(ncr.closedAt!);
          const diffDays = Math.ceil(
            (closedDate.getTime() - raisedDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          return sum + diffDays;
        }, 0);
        averageClosureTime = Math.round(totalClosureTime / closedNcrs.length);
      }

      // Calculate responsible party counts
      const responsiblePartyCounts = ncrsWithResponsible.reduce(
        (acc: Record<string, number>, ncr) => {
          const responsible =
            ncr.responsibleUser?.fullName || ncr.responsibleUser?.email || 'Unassigned';
          acc[responsible] = (acc[responsible] || 0) + 1;
          return acc;
        },
        {},
      );

      // Calculate closure rate
      const totalClosed = (statusCounts['closed'] || 0) + (statusCounts['closed_concession'] || 0);
      const closureRate = total > 0 ? ((totalClosed / total) * 100).toFixed(1) : '0.0';

      const report = {
        generatedAt: new Date().toISOString(),
        projectId,
        totalNCRs: total,
        statusCounts,
        categoryCounts,
        rootCauseCounts,
        responsiblePartyCounts,
        overdueCount,
        closedThisMonth,
        averageClosureTime,
        closureRate,
        ncrs,
        summary: {
          open: statusCounts['open'] || 0,
          investigating: statusCounts['investigating'] || 0,
          rectification: statusCounts['rectification'] || 0,
          verification: statusCounts['verification'] || 0,
          closed: statusCounts['closed'] || 0,
          closedConcession: statusCounts['closed_concession'] || 0,
          minor: categoryCounts['minor'] || 0,
          major: categoryCounts['major'] || 0,
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

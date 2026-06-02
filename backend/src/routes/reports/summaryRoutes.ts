import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

type AuthUser = NonNullable<Express.Request['user']>;

type SummaryReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  requireReportProjectAccess: (user: AuthUser | undefined, projectId: string) => Promise<string>;
};

export function createSummaryReportRouter({
  parseRequiredString,
  requireReportProjectAccess,
}: SummaryReportRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/reports/summary - Dashboard summary report
  router.get(
    '/summary',
    asyncHandler(async (req, res) => {
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireReportProjectAccess(req.user, projectId);

      // Get lot counts by status
      const lotCounts = await prisma.lot.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
      });

      const lotStatusMap = lotCounts.reduce((acc: Record<string, number>, item) => {
        acc[item.status || 'not_started'] = item._count;
        return acc;
      }, {});

      const totalLots = lotCounts.reduce((sum, item) => sum + item._count, 0);

      // Get NCR counts by status
      const ncrCounts = await prisma.nCR.groupBy({
        by: ['status'],
        where: { projectId },
        _count: true,
      });

      const ncrStatusMap = ncrCounts.reduce((acc: Record<string, number>, item) => {
        acc[item.status || 'open'] = item._count;
        return acc;
      }, {});

      const totalNCRs = ncrCounts.reduce((sum, item) => sum + item._count, 0);
      const openNCRs =
        (ncrStatusMap['open'] || 0) +
        (ncrStatusMap['investigating'] || 0) +
        (ncrStatusMap['rectification'] || 0) +
        (ncrStatusMap['verification'] || 0);

      // Get test result counts
      const testCounts = await prisma.testResult.groupBy({
        by: ['passFail'],
        where: { projectId },
        _count: true,
      });

      const testResultMap = testCounts.reduce((acc: Record<string, number>, item) => {
        acc[item.passFail || 'pending'] = item._count;
        return acc;
      }, {});

      const totalTests = testCounts.reduce((sum, item) => sum + item._count, 0);

      // Get hold point counts
      const holdPointCounts = await prisma.holdPoint.groupBy({
        by: ['status'],
        where: {
          lot: {
            projectId,
          },
        },
        _count: true,
      });

      const holdPointStatusMap = holdPointCounts.reduce((acc: Record<string, number>, item) => {
        acc[item.status || 'pending'] = item._count;
        return acc;
      }, {});

      const totalHoldPoints = holdPointCounts.reduce((sum, item) => sum + item._count, 0);

      const summary = {
        generatedAt: new Date().toISOString(),
        projectId,
        lots: {
          total: totalLots,
          notStarted: lotStatusMap['not_started'] || 0,
          inProgress: lotStatusMap['in_progress'] || 0,
          awaitingTest: lotStatusMap['awaiting_test'] || 0,
          holdPoint: lotStatusMap['hold_point'] || 0,
          ncrRaised: lotStatusMap['ncr_raised'] || 0,
          conformed: lotStatusMap['conformed'] || 0,
          claimed: lotStatusMap['claimed'] || 0,
          conformedPercent:
            totalLots > 0
              ? (((lotStatusMap['conformed'] || 0) / totalLots) * 100).toFixed(1)
              : '0.0',
        },
        ncrs: {
          total: totalNCRs,
          open: openNCRs,
          closed: (ncrStatusMap['closed'] || 0) + (ncrStatusMap['closed_concession'] || 0),
        },
        tests: {
          total: totalTests,
          pass: testResultMap['pass'] || 0,
          fail: testResultMap['fail'] || 0,
          pending: testResultMap['pending'] || 0,
          passRate:
            totalTests > 0 ? (((testResultMap['pass'] || 0) / totalTests) * 100).toFixed(1) : '0.0',
        },
        holdPoints: {
          total: totalHoldPoints,
          pending: holdPointStatusMap['pending'] || 0,
          notified: holdPointStatusMap['notified'] || 0,
          released: holdPointStatusMap['released'] || 0,
        },
      };

      res.json(summary);
    }),
  );

  return router;
}

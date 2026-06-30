import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

type AuthUser = NonNullable<Express.Request['user']>;

type ParsedDateQuery = {
  raw: string;
  date: Date;
};

type ReportPagination = {
  pageNum: number;
  limitNum: number;
  skip: number;
};

type GroupedCount = { _count: number } & Record<string, unknown>;

type TestReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  parseReportPagination: (page: unknown, limit: unknown) => ReportPagination;
  parseOptionalDateQuery: (
    value: unknown,
    fieldName: string,
    endOfDay?: boolean,
    timeZone?: string,
  ) => ParsedDateQuery | undefined;
  parseOptionalCommaSeparatedQuery: (value: unknown, fieldName: string) => string[];
  validateDateRange: (
    startDate: ParsedDateQuery | undefined,
    endDate: ParsedDateQuery | undefined,
  ) => void;
  requireReportProjectAccess: (user: AuthUser | undefined, projectId: string) => Promise<string>;
  resolveReportProjectTimeZone: (projectId: string) => Promise<string>;
  groupedCountsToRecord: (
    groups: GroupedCount[],
    key: string,
    fallback: string,
  ) => Record<string, number>;
};

export function createTestReportRouter({
  parseRequiredString,
  parseReportPagination,
  parseOptionalDateQuery,
  parseOptionalCommaSeparatedQuery,
  validateDateRange,
  requireReportProjectAccess,
  resolveReportProjectTimeZone,
  groupedCountsToRecord,
}: TestReportRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/reports/test - Test results report (Feature #208)
  router.get(
    '/test',
    asyncHandler(async (req, res) => {
      const { startDate, endDate, testTypes, lotIds, page = '1', limit = '100' } = req.query;
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireReportProjectAccess(req.user, projectId);
      const projectTimeZone = await resolveReportProjectTimeZone(projectId);

      // Pagination parameters
      const { pageNum, limitNum, skip } = parseReportPagination(page, limit);

      // Build where clause with optional filters
      const whereClause: Prisma.TestResultWhereInput = { projectId };

      // Filter by date range (using sample date)
      const parsedStartDate = parseOptionalDateQuery(
        startDate,
        'startDate',
        false,
        projectTimeZone,
      );
      const parsedEndDate = parseOptionalDateQuery(endDate, 'endDate', true, projectTimeZone);
      validateDateRange(parsedStartDate, parsedEndDate);
      if (parsedStartDate || parsedEndDate) {
        const sampleDate: Prisma.DateTimeNullableFilter = {};
        if (parsedStartDate) {
          sampleDate.gte = parsedStartDate.date;
        }
        if (parsedEndDate) {
          sampleDate.lte = parsedEndDate.date;
        }
        whereClause.sampleDate = sampleDate;
      }

      // Filter by test types
      const types = parseOptionalCommaSeparatedQuery(testTypes, 'testTypes');
      if (types.length > 0) {
        whereClause.testType = { in: types };
      }

      // Filter by lot IDs
      const lots = parseOptionalCommaSeparatedQuery(lotIds, 'lotIds');
      if (lots.length > 0) {
        whereClause.lotId = { in: lots };
      }

      const [total, tests, passFailGroups, testTypeGroups, statusGroups] = await Promise.all([
        prisma.testResult.count({ where: whereClause }),
        prisma.testResult.findMany({
          where: whereClause,
          select: {
            id: true,
            testRequestNumber: true,
            testType: true,
            laboratoryName: true,
            laboratoryReportNumber: true,
            sampleDate: true,
            resultDate: true,
            resultValue: true,
            resultUnit: true,
            specificationMin: true,
            specificationMax: true,
            passFail: true,
            status: true,
            lotId: true,
          },
          orderBy: { sampleDate: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.testResult.groupBy({
          by: ['passFail'],
          where: whereClause,
          _count: true,
        }),
        prisma.testResult.groupBy({
          by: ['testType'],
          where: whereClause,
          _count: true,
        }),
        prisma.testResult.groupBy({
          by: ['status'],
          where: whereClause,
          _count: true,
        }),
      ]);

      const passFailCounts = groupedCountsToRecord(passFailGroups, 'passFail', 'pending');
      const testTypeCounts = groupedCountsToRecord(testTypeGroups, 'testType', 'Unknown');
      const statusCounts = groupedCountsToRecord(statusGroups, 'status', 'requested');

      const report = {
        generatedAt: new Date().toISOString(),
        projectId,
        totalTests: total,
        passFailCounts,
        testTypeCounts,
        statusCounts,
        tests,
        summary: {
          pass: passFailCounts['pass'] || 0,
          fail: passFailCounts['fail'] || 0,
          pending: passFailCounts['pending'] || 0,
          passRate: total > 0 ? (((passFailCounts['pass'] || 0) / total) * 100).toFixed(1) : '0.0',
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

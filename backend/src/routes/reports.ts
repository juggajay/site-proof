import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  SCHEDULED_REPORT_FREQUENCIES,
  SCHEDULED_REPORT_TYPES,
  MAX_SCHEDULED_REPORT_RECIPIENTS,
  MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH,
  MAX_SCHEDULED_REPORTS_PER_PROJECT,
  calculateNextScheduledReportRunAt,
} from '../lib/scheduledReports.js';

export const reportsRouter = Router();

// Apply authentication middleware to all report routes
reportsRouter.use(requireAuth);

const SUBCONTRACTOR_REPORT_ROLES = ['subcontractor', 'subcontractor_admin'];
const CLAIM_REPORT_ROLES = ['owner', 'admin', 'project_manager'];
const SCHEDULED_REPORT_MANAGER_ROLES = CLAIM_REPORT_ROLES;
const SCHEDULED_REPORT_TIERS = new Set(['professional', 'enterprise', 'unlimited']);
const CLAIM_REPORT_STATUSES = [
  'draft',
  'submitted',
  'certified',
  'disputed',
  'paid',
  'partially_paid',
] as const;
const DEFAULT_REPORT_PAGE_SIZE = 100;
const MAX_REPORT_PAGE_SIZE = 500;
const MAX_REPORT_ID_LENGTH = 128;
const MAX_REPORT_QUERY_LENGTH = 2000;
const MAX_REPORT_DATE_QUERY_LENGTH = 64;
const DIARY_REPORT_SECTIONS = ['weather', 'personnel', 'plant', 'activities', 'delays'] as const;
const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

const scheduledReportTypeSchema = z.enum(SCHEDULED_REPORT_TYPES);
const scheduledReportFrequencySchema = z.enum(SCHEDULED_REPORT_FREQUENCIES);
const scheduledReportEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
const scheduledReportTimeOfDaySchema = z
  .string()
  .max(5)
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const diaryReportSectionSchema = z.enum(DIARY_REPORT_SECTIONS);

type ScheduledReportFrequency = z.infer<typeof scheduledReportFrequencySchema>;
type ScheduledReportType = z.infer<typeof scheduledReportTypeSchema>;
type ParsedDateQuery = {
  raw: string;
  date: Date;
};

type AuthUser = NonNullable<Express.Request['user']>;

async function getEffectiveProjectRole(user: AuthUser, projectId: string): Promise<string | null> {
  if (user.roleInCompany === 'owner' || user.roleInCompany === 'admin') {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });

    if (project?.companyId === user.companyId) {
      return user.roleInCompany;
    }
  }

  const projectUser = await prisma.projectUser.findFirst({
    where: {
      projectId,
      userId: user.id,
      status: 'active',
    },
    select: { role: true },
  });

  return projectUser?.role ?? null;
}

async function requireReportProjectAccess(
  user: AuthUser | undefined,
  projectId: string,
): Promise<string> {
  if (!user) {
    throw AppError.unauthorized('User not found');
  }

  if (SUBCONTRACTOR_REPORT_ROLES.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Internal report access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || SUBCONTRACTOR_REPORT_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Access denied');
  }

  return effectiveRole;
}

async function requireClaimsReportAccess(
  user: AuthUser | undefined,
  projectId: string,
): Promise<void> {
  const effectiveRole = await requireReportProjectAccess(user, projectId);

  if (!CLAIM_REPORT_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Commercial report access required');
  }
}

async function requireScheduledReportAccess(
  user: AuthUser | undefined,
  projectId: string,
): Promise<void> {
  const effectiveRole = await requireReportProjectAccess(user, projectId);

  if (!SCHEDULED_REPORT_MANAGER_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Report schedule management access required');
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      company: {
        select: { subscriptionTier: true },
      },
    },
  });
  const tier = project?.company.subscriptionTier || 'basic';

  if (!SCHEDULED_REPORT_TIERS.has(tier)) {
    throw AppError.forbidden('Scheduled reports require a Professional or Enterprise subscription');
  }
}

function groupedCountsToRecord<T extends { _count: number }, K extends keyof T>(
  groups: T[],
  key: K,
  fallback: string,
): Record<string, number> {
  return groups.reduce((acc: Record<string, number>, group) => {
    const value = group[key];
    const name = typeof value === 'string' && value.length > 0 ? value : fallback;
    acc[name] = group._count;
    return acc;
  }, {});
}

function parsePositiveIntegerQuery(
  value: unknown,
  fieldName: string,
  defaultValue: number,
): number {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  const rawValue =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d+$/.test(rawValue)) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  const parsed = Number(rawValue);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw AppError.badRequest(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

function parseReportPagination(
  page: unknown,
  limit: unknown,
): { pageNum: number; limitNum: number; skip: number } {
  const pageNum = parsePositiveIntegerQuery(page, 'page', 1);
  const requestedLimit = parsePositiveIntegerQuery(limit, 'limit', DEFAULT_REPORT_PAGE_SIZE);
  const limitNum = Math.min(requestedLimit, MAX_REPORT_PAGE_SIZE);
  const skip = (pageNum - 1) * limitNum;

  if (!Number.isSafeInteger(skip)) {
    throw AppError.badRequest('page is too large');
  }

  return { pageNum, limitNum, skip };
}

function parseOptionalStringQuery(
  value: unknown,
  fieldName: string,
  maxLength = MAX_REPORT_QUERY_LENGTH,
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value) || typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOptionalCommaSeparatedQuery(value: unknown, fieldName: string): string[] {
  const rawValue = parseOptionalStringQuery(value, fieldName);
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalDateQuery(
  value: unknown,
  fieldName: string,
  endOfDay = false,
): ParsedDateQuery | undefined {
  const rawValue = parseOptionalStringQuery(value, fieldName, MAX_REPORT_DATE_QUERY_LENGTH);
  if (!rawValue) {
    return undefined;
  }

  const dateComponentMatch = DATE_COMPONENT_QUERY_PATTERN.exec(rawValue);
  if (dateComponentMatch) {
    const [, year, month, day] = dateComponentMatch;
    const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      dateComponent.getUTCFullYear() !== Number(year) ||
      dateComponent.getUTCMonth() !== Number(month) - 1 ||
      dateComponent.getUTCDate() !== Number(day)
    ) {
      throw AppError.badRequest(`${fieldName} must be a valid date`);
    }
  }

  const date = new Date(rawValue);
  if (!Number.isFinite(date.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }

  return { raw: rawValue, date };
}

function validateDateRange(
  startDate: ParsedDateQuery | undefined,
  endDate: ParsedDateQuery | undefined,
): void {
  if (startDate && endDate && startDate.date > endDate.date) {
    throw AppError.badRequest('startDate must be on or before endDate');
  }
}

function parseDiaryReportSections(value: unknown): string[] {
  const sections = parseOptionalCommaSeparatedQuery(value, 'sections');
  if (sections.length === 0) {
    return [...DIARY_REPORT_SECTIONS];
  }

  const selectedSections: string[] = [];
  for (const section of sections) {
    const result = diaryReportSectionSchema.safeParse(section);
    if (!result.success) {
      throw AppError.badRequest(`sections must contain only: ${DIARY_REPORT_SECTIONS.join(', ')}`);
    }

    if (!selectedSections.includes(result.data)) {
      selectedSections.push(result.data);
    }
  }

  return selectedSections;
}

function parseClaimReportStatuses(value: unknown): string[] {
  const statuses = parseOptionalCommaSeparatedQuery(value, 'status');
  if (statuses.length === 0) {
    return [];
  }

  const invalidStatuses = statuses.filter(
    (status) => !CLAIM_REPORT_STATUSES.includes(status as (typeof CLAIM_REPORT_STATUSES)[number]),
  );
  if (invalidStatuses.length > 0) {
    throw AppError.badRequest(`status must be one of: ${CLAIM_REPORT_STATUSES.join(', ')}`);
  }

  return [...new Set(statuses)];
}

// GET /api/reports/lot-status - Lot status report
reportsRouter.get(
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

// GET /api/reports/ncr - NCR report
reportsRouter.get(
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

// GET /api/reports/test - Test results report (Feature #208)
reportsRouter.get(
  '/test',
  asyncHandler(async (req, res) => {
    const { startDate, endDate, testTypes, lotIds, page = '1', limit = '100' } = req.query;
    const projectId = parseRequiredString(req.query.projectId, 'projectId');

    await requireReportProjectAccess(req.user, projectId);

    // Pagination parameters
    const { pageNum, limitNum, skip } = parseReportPagination(page, limit);

    // Build where clause with optional filters
    const whereClause: Prisma.TestResultWhereInput = { projectId };

    // Filter by date range (using sample date)
    const parsedStartDate = parseOptionalDateQuery(startDate, 'startDate');
    const parsedEndDate = parseOptionalDateQuery(endDate, 'endDate', true);
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

// GET /api/reports/diary - Diary report with section selection
reportsRouter.get(
  '/diary',
  asyncHandler(async (req, res) => {
    const { startDate, endDate, sections, page = '1', limit = '100' } = req.query;
    const projectId = parseRequiredString(req.query.projectId, 'projectId');

    await requireReportProjectAccess(req.user, projectId);

    // Pagination parameters
    const { pageNum, limitNum, skip } = parseReportPagination(page, limit);

    // Parse sections parameter (comma-separated) - default to all sections
    const selectedSections = parseDiaryReportSections(sections);

    // Build date filter
    const parsedStartDate = parseOptionalDateQuery(startDate, 'startDate');
    const parsedEndDate = parseOptionalDateQuery(endDate, 'endDate');
    validateDateRange(parsedStartDate, parsedEndDate);
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (parsedStartDate) {
      dateFilter.gte = parsedStartDate.date;
    }
    if (parsedEndDate) {
      dateFilter.lte = parsedEndDate.date;
    }

    // Build where clause
    const whereClause = {
      projectId,
      ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
    };

    // Get total count for pagination
    const total = await prisma.dailyDiary.count({ where: whereClause });

    // Get paginated diaries with selected sections
    const diaries = await prisma.dailyDiary.findMany({
      where: whereClause,
      include: {
        personnel: selectedSections.includes('personnel'),
        plant: selectedSections.includes('plant'),
        activities: selectedSections.includes('activities')
          ? { include: { lot: { select: { id: true, lotNumber: true } } } }
          : undefined,
        delays: selectedSections.includes('delays'),
        submittedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { date: 'desc' },
      skip,
      take: limitNum,
    });

    // Calculate summary statistics (from paginated results)
    const submittedCount = diaries.filter((d) => d.status === 'submitted').length;
    const draftCount = diaries.filter((d) => d.status === 'draft').length;

    // Weather summary (if section selected)
    let weatherSummary: Record<string, number> = {};
    if (selectedSections.includes('weather')) {
      weatherSummary = diaries.reduce((acc: Record<string, number>, diary) => {
        const condition = diary.weatherConditions || 'Not recorded';
        acc[condition] = (acc[condition] || 0) + 1;
        return acc;
      }, {});
    }

    // Personnel summary (if section selected)
    const personnelSummary = {
      totalPersonnel: 0,
      totalHours: 0,
      byCompany: {} as Record<string, { count: number; hours: number }>,
    };
    if (selectedSections.includes('personnel')) {
      for (const diary of diaries) {
        if (diary.personnel) {
          for (const person of diary.personnel) {
            personnelSummary.totalPersonnel++;
            const hours = person.hours ? parseFloat(person.hours.toString()) : 0;
            personnelSummary.totalHours += hours;

            const company = person.company || 'Unspecified';
            if (!personnelSummary.byCompany[company]) {
              personnelSummary.byCompany[company] = { count: 0, hours: 0 };
            }
            personnelSummary.byCompany[company].count++;
            personnelSummary.byCompany[company].hours += hours;
          }
        }
      }
    }

    // Plant summary (if section selected)
    const plantSummary = {
      totalPlant: 0,
      totalHours: 0,
      byCompany: {} as Record<string, { count: number; hours: number }>,
    };
    if (selectedSections.includes('plant')) {
      for (const diary of diaries) {
        if (diary.plant) {
          for (const item of diary.plant) {
            plantSummary.totalPlant++;
            const hours = item.hoursOperated ? parseFloat(item.hoursOperated.toString()) : 0;
            plantSummary.totalHours += hours;

            const company = item.company || 'Unspecified';
            if (!plantSummary.byCompany[company]) {
              plantSummary.byCompany[company] = { count: 0, hours: 0 };
            }
            plantSummary.byCompany[company].count++;
            plantSummary.byCompany[company].hours += hours;
          }
        }
      }
    }

    // Activities summary (if section selected)
    const activitiesSummary = { totalActivities: 0, byLot: {} as Record<string, number> };
    if (selectedSections.includes('activities')) {
      for (const diary of diaries) {
        if (diary.activities) {
          for (const activity of diary.activities) {
            activitiesSummary.totalActivities++;
            const lotNumber =
              (activity as { lot?: { lotNumber: string } }).lot?.lotNumber || 'No Lot';
            activitiesSummary.byLot[lotNumber] = (activitiesSummary.byLot[lotNumber] || 0) + 1;
          }
        }
      }
    }

    // Delays summary (if section selected)
    const delaysSummary = {
      totalDelays: 0,
      totalHours: 0,
      byType: {} as Record<string, { count: number; hours: number }>,
    };
    if (selectedSections.includes('delays')) {
      for (const diary of diaries) {
        if (diary.delays) {
          for (const delay of diary.delays) {
            delaysSummary.totalDelays++;
            const hours = delay.durationHours ? parseFloat(delay.durationHours.toString()) : 0;
            delaysSummary.totalHours += hours;

            const delayType = delay.delayType || 'Other';
            if (!delaysSummary.byType[delayType]) {
              delaysSummary.byType[delayType] = { count: 0, hours: 0 };
            }
            delaysSummary.byType[delayType].count++;
            delaysSummary.byType[delayType].hours += hours;
          }
        }
      }
    }

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      dateRange: {
        startDate: parsedStartDate?.raw ?? null,
        endDate: parsedEndDate?.raw ?? null,
      },
      selectedSections,
      totalDiaries: total,
      submittedCount,
      draftCount,
      diaries: diaries.map((diary) => ({
        id: diary.id,
        date: diary.date,
        status: diary.status,
        isLate: diary.isLate,
        submittedBy: diary.submittedBy,
        submittedAt: diary.submittedAt,
        ...(selectedSections.includes('weather')
          ? {
              weatherConditions: diary.weatherConditions,
              temperatureMin: diary.temperatureMin,
              temperatureMax: diary.temperatureMax,
              rainfallMm: diary.rainfallMm,
              weatherNotes: diary.weatherNotes,
              generalNotes: diary.generalNotes,
            }
          : {}),
        ...(selectedSections.includes('personnel') ? { personnel: diary.personnel } : {}),
        ...(selectedSections.includes('plant') ? { plant: diary.plant } : {}),
        ...(selectedSections.includes('activities') ? { activities: diary.activities } : {}),
        ...(selectedSections.includes('delays') ? { delays: diary.delays } : {}),
      })),
      summary: {
        ...(selectedSections.includes('weather') ? { weather: weatherSummary } : {}),
        ...(selectedSections.includes('personnel') ? { personnel: personnelSummary } : {}),
        ...(selectedSections.includes('plant') ? { plant: plantSummary } : {}),
        ...(selectedSections.includes('activities') ? { activities: activitiesSummary } : {}),
        ...(selectedSections.includes('delays') ? { delays: delaysSummary } : {}),
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

// GET /api/reports/summary - Dashboard summary report
reportsRouter.get(
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
          totalLots > 0 ? (((lotStatusMap['conformed'] || 0) / totalLots) * 100).toFixed(1) : '0.0',
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

// Feature #287: GET /api/reports/claims - Claim history report
reportsRouter.get(
  '/claims',
  asyncHandler(async (req, res) => {
    const { startDate, endDate, status } = req.query;
    const projectId = parseRequiredString(req.query.projectId, 'projectId');

    await requireClaimsReportAccess(req.user, projectId);

    // Build where clause with optional filters
    const whereClause: Prisma.ProgressClaimWhereInput = { projectId };

    // Filter by date range (using claimPeriodEnd)
    const parsedStartDate = parseOptionalDateQuery(startDate, 'startDate');
    const parsedEndDate = parseOptionalDateQuery(endDate, 'endDate', true);
    validateDateRange(parsedStartDate, parsedEndDate);
    if (parsedStartDate || parsedEndDate) {
      const claimPeriodEnd: Prisma.DateTimeFilter = {};
      if (parsedStartDate) {
        claimPeriodEnd.gte = parsedStartDate.date;
      }
      if (parsedEndDate) {
        claimPeriodEnd.lte = parsedEndDate.date;
      }
      whereClause.claimPeriodEnd = claimPeriodEnd;
    }

    // Filter by status
    const statuses = parseClaimReportStatuses(status);
    if (statuses.length > 0) {
      whereClause.status = { in: statuses };
    }

    // Get all claims for the project
    const claims = await prisma.progressClaim.findMany({
      where: whereClause,
      include: {
        claimedLots: {
          include: {
            lot: {
              select: { id: true, lotNumber: true, description: true, activityType: true },
            },
          },
        },
        preparedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { claimNumber: 'desc' },
    });

    // Calculate status counts
    const statusCounts = claims.reduce((acc: Record<string, number>, claim) => {
      const claimStatus = claim.status || 'draft';
      acc[claimStatus] = (acc[claimStatus] || 0) + 1;
      return acc;
    }, {});

    // Calculate financial summary
    let totalClaimed = 0;
    let totalCertified = 0;
    let totalPaid = 0;
    let totalLots = 0;

    for (const claim of claims) {
      totalClaimed += claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0;
      totalCertified += claim.certifiedAmount ? Number(claim.certifiedAmount) : 0;
      totalPaid += claim.paidAmount ? Number(claim.paidAmount) : 0;
      totalLots += claim.claimedLots.length;
    }

    const outstanding = totalCertified - totalPaid;
    const certificationRate =
      totalClaimed > 0 ? ((totalCertified / totalClaimed) * 100).toFixed(1) : '0.0';
    const collectionRate =
      totalCertified > 0 ? ((totalPaid / totalCertified) * 100).toFixed(1) : '0.0';

    // Calculate monthly breakdown
    const monthlyData: Record<
      string,
      { claimed: number; certified: number; paid: number; count: number }
    > = {};
    for (const claim of claims) {
      const monthKey = claim.claimPeriodEnd.toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { claimed: 0, certified: 0, paid: 0, count: 0 };
      }
      monthlyData[monthKey].claimed += claim.totalClaimedAmount
        ? Number(claim.totalClaimedAmount)
        : 0;
      monthlyData[monthKey].certified += claim.certifiedAmount ? Number(claim.certifiedAmount) : 0;
      monthlyData[monthKey].paid += claim.paidAmount ? Number(claim.paidAmount) : 0;
      monthlyData[monthKey].count++;
    }

    // Convert monthly data to sorted array
    const monthlyBreakdown = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        ...data,
        variance: data.claimed - data.certified,
      }));

    // Transform claims for export
    const claimsData = claims.map((claim) => ({
      id: claim.id,
      claimNumber: claim.claimNumber,
      periodStart: claim.claimPeriodStart.toISOString().split('T')[0],
      periodEnd: claim.claimPeriodEnd.toISOString().split('T')[0],
      status: claim.status,
      totalClaimedAmount: claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0,
      certifiedAmount: claim.certifiedAmount ? Number(claim.certifiedAmount) : null,
      paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
      variance:
        claim.certifiedAmount && claim.totalClaimedAmount
          ? Number(claim.totalClaimedAmount) - Number(claim.certifiedAmount)
          : null,
      outstanding:
        claim.certifiedAmount && claim.paidAmount
          ? Number(claim.certifiedAmount) - Number(claim.paidAmount)
          : claim.certifiedAmount
            ? Number(claim.certifiedAmount)
            : null,
      submittedAt: claim.submittedAt?.toISOString().split('T')[0] || null,
      certifiedAt: claim.certifiedAt?.toISOString().split('T')[0] || null,
      paidAt: claim.paidAt?.toISOString().split('T')[0] || null,
      paymentReference: claim.paymentReference || null,
      lotCount: claim.claimedLots.length,
      lots: claim.claimedLots.map((cl) => ({
        lotNumber: cl.lot.lotNumber,
        description: cl.lot.description,
        activityType: cl.lot.activityType,
        amountClaimed: cl.amountClaimed ? Number(cl.amountClaimed) : 0,
      })),
      preparedBy: claim.preparedBy
        ? {
            name: claim.preparedBy.fullName || claim.preparedBy.email,
            email: claim.preparedBy.email,
          }
        : null,
      preparedAt: claim.preparedAt?.toISOString().split('T')[0] || null,
    }));

    const report = {
      generatedAt: new Date().toISOString(),
      projectId,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      totalClaims: claims.length,
      statusCounts,
      financialSummary: {
        totalClaimed,
        totalCertified,
        totalPaid,
        outstanding,
        certificationRate,
        collectionRate,
        totalLots,
      },
      monthlyBreakdown,
      claims: claimsData,
      // Excel-friendly flat format for export
      exportData: claimsData.map((claim) => ({
        'Claim #': claim.claimNumber,
        'Period Start': claim.periodStart,
        'Period End': claim.periodEnd,
        Status: claim.status,
        'Claimed Amount': claim.totalClaimedAmount,
        'Certified Amount': claim.certifiedAmount,
        'Paid Amount': claim.paidAmount,
        Variance: claim.variance,
        Outstanding: claim.outstanding,
        'Submitted Date': claim.submittedAt,
        'Certified Date': claim.certifiedAt,
        'Paid Date': claim.paidAt,
        'Payment Reference': claim.paymentReference,
        'Lot Count': claim.lotCount,
        'Prepared By': claim.preparedBy?.name,
      })),
    };

    res.json(report);
  }),
);

// ============================================================================
// Scheduled Reports API
// ============================================================================

function parseRequiredString(
  value: unknown,
  fieldName: string,
  maxLength = MAX_REPORT_ID_LENGTH,
): string {
  const parsedValue = parseOptionalStringQuery(value, fieldName, maxLength);
  if (!parsedValue) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  return parsedValue;
}

function parseScheduleRouteId(value: unknown): string {
  return parseRequiredString(value, 'id', MAX_REPORT_ID_LENGTH);
}

function parseScheduledReportType(value: unknown): ScheduledReportType {
  const result = scheduledReportTypeSchema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest('reportType must be lot-status, ncr, test, or diary');
  }

  return result.data;
}

function parseScheduledReportFrequency(value: unknown): ScheduledReportFrequency {
  const result = scheduledReportFrequencySchema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest('frequency must be daily, weekly, or monthly');
  }

  return result.data;
}

function parseScheduleInteger(value: unknown, fieldName: string, min: number, max: number): number {
  const parsedValue =
    typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : value;

  if (
    typeof parsedValue !== 'number' ||
    !Number.isInteger(parsedValue) ||
    parsedValue < min ||
    parsedValue > max
  ) {
    throw AppError.badRequest(`${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsedValue;
}

function parseTimeOfDay(value: unknown): string {
  const candidate = value === undefined || value === null || value === '' ? '09:00' : value;
  const result = scheduledReportTimeOfDaySchema.safeParse(candidate);
  if (!result.success) {
    throw AppError.badRequest('timeOfDay must use HH:mm format');
  }

  return result.data;
}

function normalizeScheduledReportRecipients(value: unknown): string {
  let rawRecipients: string[];

  if (typeof value === 'string') {
    if (value.length > MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH) {
      throw AppError.badRequest('recipients is too long');
    }

    rawRecipients = value.split(/[,;\n]/);
  } else if (Array.isArray(value)) {
    if (value.length > MAX_SCHEDULED_REPORT_RECIPIENTS) {
      throw AppError.badRequest(
        `recipients cannot include more than ${MAX_SCHEDULED_REPORT_RECIPIENTS} entries`,
      );
    }

    rawRecipients = value.flatMap((recipient) => {
      if (typeof recipient !== 'string') {
        throw AppError.badRequest('recipients must be a string or an array of email addresses');
      }

      if (recipient.length > MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH) {
        throw AppError.badRequest('recipients is too long');
      }

      return recipient.split(/[,;\n]/);
    });
  } else {
    throw AppError.badRequest('recipients must be a string or an array of email addresses');
  }

  const trimmedRecipients = rawRecipients.map((recipient) => recipient.trim()).filter(Boolean);

  if (trimmedRecipients.length === 0) {
    throw AppError.badRequest('recipients must include at least one email address');
  }

  const normalizedRecipients: string[] = [];
  for (const recipient of trimmedRecipients) {
    const result = scheduledReportEmailSchema.safeParse(recipient);
    if (!result.success) {
      throw AppError.badRequest('recipients must contain valid email addresses');
    }

    normalizedRecipients.push(result.data);
  }

  const uniqueRecipients = Array.from(new Set(normalizedRecipients));
  if (uniqueRecipients.length > MAX_SCHEDULED_REPORT_RECIPIENTS) {
    throw AppError.badRequest(
      `recipients cannot include more than ${MAX_SCHEDULED_REPORT_RECIPIENTS} email addresses`,
    );
  }

  return uniqueRecipients.join(',');
}

function normalizeScheduleTiming(input: {
  frequency: ScheduledReportFrequency;
  dayOfWeek: unknown;
  dayOfMonth: unknown;
  timeOfDay: unknown;
}): {
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
} {
  const timeOfDay = parseTimeOfDay(input.timeOfDay);
  const dayOfWeek =
    input.frequency === 'weekly'
      ? input.dayOfWeek === undefined || input.dayOfWeek === null || input.dayOfWeek === ''
        ? 1
        : parseScheduleInteger(input.dayOfWeek, 'dayOfWeek', 0, 6)
      : null;
  const dayOfMonth =
    input.frequency === 'monthly'
      ? input.dayOfMonth === undefined || input.dayOfMonth === null || input.dayOfMonth === ''
        ? 1
        : parseScheduleInteger(input.dayOfMonth, 'dayOfMonth', 1, 31)
      : null;

  return {
    dayOfWeek,
    dayOfMonth,
    timeOfDay,
  };
}

function parseScheduleIsActive(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw AppError.badRequest('isActive must be a boolean');
  }

  return value;
}

// GET /api/reports/schedules - List scheduled reports for a project
reportsRouter.get(
  '/schedules',
  asyncHandler(async (req, res) => {
    const projectId = parseRequiredString(req.query.projectId, 'projectId');

    await requireScheduledReportAccess(req.user, projectId);

    const schedules = await prisma.scheduledReport.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: MAX_SCHEDULED_REPORTS_PER_PROJECT,
    });

    res.json({ schedules, maxSchedules: MAX_SCHEDULED_REPORTS_PER_PROJECT });
  }),
);

// POST /api/reports/schedules - Create a new scheduled report
reportsRouter.post(
  '/schedules',
  asyncHandler(async (req, res) => {
    const { reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients } = req.body;
    const projectId = parseRequiredString(req.body.projectId, 'projectId');
    const userId = req.user?.id;

    if (reportType === undefined || frequency === undefined || recipients === undefined) {
      throw AppError.badRequest('projectId, reportType, frequency, and recipients are required');
    }
    await requireScheduledReportAccess(req.user, projectId);

    const normalizedReportType = parseScheduledReportType(reportType);
    const normalizedFrequency = parseScheduledReportFrequency(frequency);
    const normalizedRecipients = normalizeScheduledReportRecipients(recipients);
    const scheduleTiming = normalizeScheduleTiming({
      frequency: normalizedFrequency,
      dayOfWeek,
      dayOfMonth,
      timeOfDay,
    });
    const existingScheduleCount = await prisma.scheduledReport.count({ where: { projectId } });
    if (existingScheduleCount >= MAX_SCHEDULED_REPORTS_PER_PROJECT) {
      throw AppError.badRequest(
        `Projects cannot have more than ${MAX_SCHEDULED_REPORTS_PER_PROJECT} scheduled reports`,
      );
    }

    // Calculate next run time
    const nextRunAt = calculateNextScheduledReportRunAt(
      normalizedFrequency,
      scheduleTiming.dayOfWeek,
      scheduleTiming.dayOfMonth,
      scheduleTiming.timeOfDay,
    );

    const schedule = await prisma.scheduledReport.create({
      data: {
        projectId,
        reportType: normalizedReportType,
        frequency: normalizedFrequency,
        dayOfWeek: scheduleTiming.dayOfWeek,
        dayOfMonth: scheduleTiming.dayOfMonth,
        timeOfDay: scheduleTiming.timeOfDay,
        recipients: normalizedRecipients,
        nextRunAt,
        createdById: userId,
        isActive: true,
      },
    });

    res.status(201).json({ schedule });
  }),
);

// PUT /api/reports/schedules/:id - Update a scheduled report
reportsRouter.put(
  '/schedules/:id',
  asyncHandler(async (req, res) => {
    const id = parseScheduleRouteId(req.params.id);
    const { reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients, isActive } =
      req.body;

    // Check if schedule exists
    const existing = await prisma.scheduledReport.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Scheduled report');
    }
    await requireScheduledReportAccess(req.user, existing.projectId);

    const updateData: Prisma.ScheduledReportUpdateInput = {};

    if (reportType !== undefined) {
      updateData.reportType = parseScheduledReportType(reportType);
    }

    if (recipients !== undefined) {
      updateData.recipients = normalizeScheduledReportRecipients(recipients);
    }

    if (isActive !== undefined) {
      updateData.isActive = parseScheduleIsActive(isActive);
    }

    if (
      frequency !== undefined ||
      dayOfWeek !== undefined ||
      dayOfMonth !== undefined ||
      timeOfDay !== undefined
    ) {
      const normalizedFrequency =
        frequency === undefined
          ? parseScheduledReportFrequency(existing.frequency)
          : parseScheduledReportFrequency(frequency);
      const scheduleTiming = normalizeScheduleTiming({
        frequency: normalizedFrequency,
        dayOfWeek: dayOfWeek === undefined ? existing.dayOfWeek : dayOfWeek,
        dayOfMonth: dayOfMonth === undefined ? existing.dayOfMonth : dayOfMonth,
        timeOfDay: timeOfDay === undefined ? existing.timeOfDay : timeOfDay,
      });

      updateData.frequency = normalizedFrequency;
      updateData.dayOfWeek = scheduleTiming.dayOfWeek;
      updateData.dayOfMonth = scheduleTiming.dayOfMonth;
      updateData.timeOfDay = scheduleTiming.timeOfDay;
      updateData.nextRunAt = calculateNextScheduledReportRunAt(
        normalizedFrequency,
        scheduleTiming.dayOfWeek,
        scheduleTiming.dayOfMonth,
        scheduleTiming.timeOfDay,
      );
    }

    const schedule = await prisma.scheduledReport.update({
      where: { id },
      data: updateData,
    });

    res.json({ schedule });
  }),
);

// DELETE /api/reports/schedules/:id - Delete a scheduled report
reportsRouter.delete(
  '/schedules/:id',
  asyncHandler(async (req, res) => {
    const id = parseScheduleRouteId(req.params.id);

    // Check if schedule exists
    const existing = await prisma.scheduledReport.findUnique({
      where: { id },
    });

    if (!existing) {
      throw AppError.notFound('Scheduled report');
    }
    await requireScheduledReportAccess(req.user, existing.projectId);

    await prisma.scheduledReport.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Scheduled report deleted' });
  }),
);

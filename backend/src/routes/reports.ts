import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getEffectiveProjectRole } from '../lib/projectAccess.js';
import { createClaimReportRouter } from './reports/claimRoutes.js';
import { createLotStatusReportRouter } from './reports/lotStatusRoutes.js';
import { createNcrReportRouter } from './reports/ncrRoutes.js';
import { createScheduledReportRouter } from './reports/scheduleRoutes.js';
import { createTestReportRouter } from './reports/testRoutes.js';

export const reportsRouter = Router();

// Apply authentication middleware to all report routes
reportsRouter.use(requireAuth);

const SUBCONTRACTOR_REPORT_ROLES = ['subcontractor', 'subcontractor_admin'];
const CLAIM_REPORT_ROLES = ['owner', 'admin', 'project_manager'];
const SCHEDULED_REPORT_MANAGER_ROLES = CLAIM_REPORT_ROLES;
const SCHEDULED_REPORT_TIERS = new Set(['professional', 'enterprise', 'unlimited']);
const DEFAULT_REPORT_PAGE_SIZE = 100;
const MAX_REPORT_PAGE_SIZE = 500;
const MAX_REPORT_ID_LENGTH = 128;
const MAX_REPORT_QUERY_LENGTH = 2000;
const MAX_REPORT_DATE_QUERY_LENGTH = 64;
const DIARY_REPORT_SECTIONS = ['weather', 'personnel', 'plant', 'activities', 'delays'] as const;
const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;

const diaryReportSectionSchema = z.enum(DIARY_REPORT_SECTIONS);

type ParsedDateQuery = {
  raw: string;
  date: Date;
};

type AuthUser = NonNullable<Express.Request['user']>;

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

reportsRouter.use(
  createLotStatusReportRouter({
    parseRequiredString,
    parseReportPagination,
    requireReportProjectAccess,
    groupedCountsToRecord,
  }),
);

reportsRouter.use(
  createNcrReportRouter({
    parseRequiredString,
    parseReportPagination,
    requireReportProjectAccess,
    groupedCountsToRecord,
  }),
);

reportsRouter.use(
  createTestReportRouter({
    parseRequiredString,
    parseReportPagination,
    parseOptionalDateQuery,
    parseOptionalCommaSeparatedQuery,
    validateDateRange,
    requireReportProjectAccess,
    groupedCountsToRecord,
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

reportsRouter.use(
  createClaimReportRouter({
    parseRequiredString,
    parseOptionalDateQuery,
    parseOptionalCommaSeparatedQuery,
    validateDateRange,
    requireClaimsReportAccess,
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

reportsRouter.use(
  createScheduledReportRouter({
    parseRequiredString,
    requireScheduledReportAccess,
  }),
);

import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const DIARY_REPORT_SECTIONS = ['weather', 'personnel', 'plant', 'activities', 'delays'] as const;

const diaryReportSectionSchema = z.enum(DIARY_REPORT_SECTIONS);

type ParsedDateQuery = {
  raw: string;
  date: Date;
};

type AuthUser = NonNullable<Express.Request['user']>;

type ReportPagination = {
  pageNum: number;
  limitNum: number;
  skip: number;
};

type DiaryReportRouterDependencies = {
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
};

type CompanyHoursSummary = {
  totalPersonnel?: number;
  totalPlant?: number;
  totalHours: number;
  byCompany: Record<string, { count: number; hours: number }>;
};

type ActivitiesSummary = {
  totalActivities: number;
  byLot: Record<string, number>;
};

type DelaysSummary = {
  totalDelays: number;
  totalHours: number;
  byType: Record<string, { count: number; hours: number }>;
};

function decimalToNumber(
  value: { toString(): string } | number | string | null | undefined,
): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value.toString());
  return Number.isFinite(numeric) ? numeric : 0;
}

async function buildDiaryStatusCounts(whereClause: Prisma.DailyDiaryWhereInput) {
  const groups = await prisma.dailyDiary.groupBy({
    by: ['status'],
    where: whereClause,
    _count: true,
  });

  const counts = new Map(groups.map((group) => [group.status, group._count]));
  return {
    submittedCount: counts.get('submitted') ?? 0,
    draftCount: counts.get('draft') ?? 0,
  };
}

async function buildWeatherSummary(
  whereClause: Prisma.DailyDiaryWhereInput,
): Promise<Record<string, number>> {
  const groups = await prisma.dailyDiary.groupBy({
    by: ['weatherConditions'],
    where: whereClause,
    _count: true,
  });

  return groups.reduce((acc: Record<string, number>, group) => {
    const condition = group.weatherConditions || 'Not recorded';
    acc[condition] = (acc[condition] || 0) + group._count;
    return acc;
  }, {});
}

async function buildPersonnelSummary(
  diaryWhere: Prisma.DailyDiaryWhereInput,
): Promise<CompanyHoursSummary> {
  const where: Prisma.DiaryPersonnelWhereInput = { diary: { is: diaryWhere } };
  const [total, byCompany] = await Promise.all([
    prisma.diaryPersonnel.aggregate({
      where,
      _count: true,
      _sum: { hours: true },
    }),
    prisma.diaryPersonnel.groupBy({
      by: ['company'],
      where,
      _count: true,
      _sum: { hours: true },
    }),
  ]);

  return {
    totalPersonnel: total._count,
    totalHours: decimalToNumber(total._sum.hours),
    byCompany: byCompany.reduce((acc: Record<string, { count: number; hours: number }>, group) => {
      const company = group.company || 'Unspecified';
      acc[company] = {
        count: group._count,
        hours: decimalToNumber(group._sum.hours),
      };
      return acc;
    }, {}),
  };
}

async function buildPlantSummary(
  diaryWhere: Prisma.DailyDiaryWhereInput,
): Promise<CompanyHoursSummary> {
  const where: Prisma.DiaryPlantWhereInput = { diary: { is: diaryWhere } };
  const [total, byCompany] = await Promise.all([
    prisma.diaryPlant.aggregate({
      where,
      _count: true,
      _sum: { hoursOperated: true },
    }),
    prisma.diaryPlant.groupBy({
      by: ['company'],
      where,
      _count: true,
      _sum: { hoursOperated: true },
    }),
  ]);

  return {
    totalPlant: total._count,
    totalHours: decimalToNumber(total._sum.hoursOperated),
    byCompany: byCompany.reduce((acc: Record<string, { count: number; hours: number }>, group) => {
      const company = group.company || 'Unspecified';
      acc[company] = {
        count: group._count,
        hours: decimalToNumber(group._sum.hoursOperated),
      };
      return acc;
    }, {}),
  };
}

async function buildActivitiesSummary(
  diaryWhere: Prisma.DailyDiaryWhereInput,
): Promise<ActivitiesSummary> {
  const where: Prisma.DiaryActivityWhereInput = { diary: { is: diaryWhere } };
  const [totalActivities, byLot] = await Promise.all([
    prisma.diaryActivity.count({ where }),
    prisma.diaryActivity.groupBy({
      by: ['lotId'],
      where,
      _count: true,
    }),
  ]);

  const lotIds = byLot
    .map((group) => group.lotId)
    .filter((lotId): lotId is string => Boolean(lotId));
  const lots =
    lotIds.length > 0
      ? await prisma.lot.findMany({
          where: { id: { in: lotIds } },
          select: { id: true, lotNumber: true },
        })
      : [];
  const lotNumberById = new Map(lots.map((lot) => [lot.id, lot.lotNumber]));

  return {
    totalActivities,
    byLot: byLot.reduce((acc: Record<string, number>, group) => {
      const lotNumber = group.lotId ? lotNumberById.get(group.lotId) || 'No Lot' : 'No Lot';
      acc[lotNumber] = (acc[lotNumber] || 0) + group._count;
      return acc;
    }, {}),
  };
}

async function buildDelaysSummary(diaryWhere: Prisma.DailyDiaryWhereInput): Promise<DelaysSummary> {
  const where: Prisma.DiaryDelayWhereInput = { diary: { is: diaryWhere } };
  const [total, byType] = await Promise.all([
    prisma.diaryDelay.aggregate({
      where,
      _count: true,
      _sum: { durationHours: true },
    }),
    prisma.diaryDelay.groupBy({
      by: ['delayType'],
      where,
      _count: true,
      _sum: { durationHours: true },
    }),
  ]);

  return {
    totalDelays: total._count,
    totalHours: decimalToNumber(total._sum.durationHours),
    byType: byType.reduce((acc: Record<string, { count: number; hours: number }>, group) => {
      const delayType = group.delayType || 'Other';
      acc[delayType] = {
        count: group._count,
        hours: decimalToNumber(group._sum.durationHours),
      };
      return acc;
    }, {}),
  };
}

function parseDiaryReportSections(
  value: unknown,
  parseOptionalCommaSeparatedQuery: (value: unknown, fieldName: string) => string[],
): string[] {
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

export function createDiaryReportRouter({
  parseRequiredString,
  parseReportPagination,
  parseOptionalDateQuery,
  parseOptionalCommaSeparatedQuery,
  validateDateRange,
  requireReportProjectAccess,
  resolveReportProjectTimeZone,
}: DiaryReportRouterDependencies): Router {
  const router = Router();

  router.use(requireAuth);

  // GET /api/reports/diary - Diary report with section selection
  router.get(
    '/diary',
    asyncHandler(async (req, res) => {
      const { startDate, endDate, sections, page = '1', limit = '100' } = req.query;
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireReportProjectAccess(req.user, projectId);
      const projectTimeZone = await resolveReportProjectTimeZone(projectId);

      // Pagination parameters
      const { pageNum, limitNum, skip } = parseReportPagination(page, limit);

      // Parse sections parameter (comma-separated) - default to all sections
      const selectedSections = parseDiaryReportSections(sections, parseOptionalCommaSeparatedQuery);

      // Build date filter. endDate is parsed to end-of-day (23:59:59.999) so a
      // diary saved later on the end date is still included — matching the test
      // and claim reports (M70).
      const parsedStartDate = parseOptionalDateQuery(
        startDate,
        'startDate',
        false,
        projectTimeZone,
      );
      const parsedEndDate = parseOptionalDateQuery(endDate, 'endDate', true, projectTimeZone);
      validateDateRange(parsedStartDate, parsedEndDate);
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (parsedStartDate) {
        dateFilter.gte = parsedStartDate.date;
      }
      if (parsedEndDate) {
        dateFilter.lte = parsedEndDate.date;
      }

      // Build where clause
      const whereClause: Prisma.DailyDiaryWhereInput = {
        projectId,
        ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
      };

      const diaryInclude: Prisma.DailyDiaryInclude = {
        personnel: selectedSections.includes('personnel'),
        plant: selectedSections.includes('plant'),
        activities: selectedSections.includes('activities')
          ? { include: { lot: { select: { id: true, lotNumber: true } } } }
          : undefined,
        delays: selectedSections.includes('delays'),
        submittedBy: {
          select: { id: true, fullName: true, email: true },
        },
      };

      const [total, diaries, statusCounts] = await Promise.all([
        prisma.dailyDiary.count({ where: whereClause }),
        prisma.dailyDiary.findMany({
          where: whereClause,
          include: diaryInclude,
          orderBy: { date: 'desc' },
          skip,
          take: limitNum,
        }),
        buildDiaryStatusCounts(whereClause),
      ]);

      const [weatherSummary, personnelSummary, plantSummary, activitiesSummary, delaysSummary] =
        await Promise.all([
          selectedSections.includes('weather') ? buildWeatherSummary(whereClause) : undefined,
          selectedSections.includes('personnel') ? buildPersonnelSummary(whereClause) : undefined,
          selectedSections.includes('plant') ? buildPlantSummary(whereClause) : undefined,
          selectedSections.includes('activities') ? buildActivitiesSummary(whereClause) : undefined,
          selectedSections.includes('delays') ? buildDelaysSummary(whereClause) : undefined,
        ]);

      const report = {
        generatedAt: new Date().toISOString(),
        projectId,
        dateRange: {
          startDate: parsedStartDate?.raw ?? null,
          endDate: parsedEndDate?.raw ?? null,
        },
        selectedSections,
        totalDiaries: total,
        submittedCount: statusCounts.submittedCount,
        draftCount: statusCounts.draftCount,
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

  return router;
}

import { Router } from 'express';
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
  ) => ParsedDateQuery | undefined;
  parseOptionalCommaSeparatedQuery: (value: unknown, fieldName: string) => string[];
  validateDateRange: (
    startDate: ParsedDateQuery | undefined,
    endDate: ParsedDateQuery | undefined,
  ) => void;
  requireReportProjectAccess: (user: AuthUser | undefined, projectId: string) => Promise<string>;
};

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

      // Pagination parameters
      const { pageNum, limitNum, skip } = parseReportPagination(page, limit);

      // Parse sections parameter (comma-separated) - default to all sections
      const selectedSections = parseDiaryReportSections(sections, parseOptionalCommaSeparatedQuery);

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

  return router;
}

import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  buildCostTrendResponse,
  buildDashboardStatsResponse,
  buildEmptyCostTrendResponse,
  buildEmptyDashboardStatsResponse,
} from './dashboardResponses.js';
import {
  COMMERCIAL_DASHBOARD_ROLES,
  COMPANY_ADMIN_ROLES,
  SUBCONTRACTOR_DASHBOARD_ROLES,
  FOREMAN_DASHBOARD_ROLES,
  getDashboardProjectAccess,
  requireDashboardRoleIfProjectMember,
} from './dashboard/access.js';
import { portfolioDashboardRouter } from './dashboard/portfolio.js';
import { dashboardRoleDashboardsRouter } from './dashboard/roleDashboards.js';

// Type definitions for dashboard work items
interface ForemanWorkItem {
  id: string;
  type: 'hold_point' | 'itp_item' | 'inspection';
  title: string;
  subtitle: string;
  urgency?: 'blocking' | 'due_today' | 'upcoming';
  link: string;
  metadata: {
    lotNumber: string;
    lotId: string;
    status?: string;
    itpName?: string;
  };
}

export const dashboardRouter = Router();

// Apply authentication middleware to all dashboard routes
dashboardRouter.use(requireAuth);

const DATE_COMPONENT_QUERY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/;
const DASHBOARD_ROUTE_PARAM_MAX_LENGTH = 120;
const LOT_STATUS_KEYS = [
  'not_started',
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
  'completed',
  'conformed',
  'claimed',
] as const;

type LotStatusKey = (typeof LOT_STATUS_KEYS)[number];
type LotStatusCounts = Record<LotStatusKey, number>;
type DashboardDateRange = {
  start?: Date;
  endInclusive?: Date;
  endExclusive?: Date;
};

function createEmptyLotStatusCounts(): LotStatusCounts {
  return Object.fromEntries(LOT_STATUS_KEYS.map((status) => [status, 0])) as LotStatusCounts;
}

function parseDashboardRouteParam(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a single value`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} is required`);
  }

  if (normalized.length > DASHBOARD_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function parseOptionalDashboardDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  const dateComponentMatch = DATE_COMPONENT_QUERY_PATTERN.exec(normalized);
  if (dateComponentMatch) {
    const [, year, month, day] = dateComponentMatch;
    const dateComponent = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      dateComponent.getUTCFullYear() !== Number(year) ||
      dateComponent.getUTCMonth() !== Number(month) - 1 ||
      dateComponent.getUTCDate() !== Number(day)
    ) {
      throw AppError.badRequest(`Invalid ${field} date`);
    }
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(`Invalid ${field} date`);
  }

  return date;
}

function parseOptionalDashboardString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest(`${field} must not be empty`);
  }

  if (normalized.length > 120) {
    throw AppError.badRequest(`${field} is too long`);
  }

  return normalized;
}

function parseDashboardDays(value: unknown): number {
  if (value === undefined) return 30;
  if (typeof value !== 'string') {
    throw AppError.badRequest('days must be a string');
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw AppError.badRequest('days must be between 1 and 365');
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw AppError.badRequest('days must be between 1 and 365');
  }

  return parsed;
}

function isDateOnlyDashboardValue(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function parseDashboardDateRange(
  startDateValue: unknown,
  endDateValue: unknown,
): DashboardDateRange {
  const start = parseOptionalDashboardDate(startDateValue, 'startDate');
  const parsedEnd = parseOptionalDashboardDate(endDateValue, 'endDate');
  let endInclusive: Date | undefined;
  let endExclusive: Date | undefined;

  if (parsedEnd) {
    if (isDateOnlyDashboardValue(endDateValue)) {
      endExclusive = new Date(parsedEnd);
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    } else {
      endInclusive = parsedEnd;
    }
  }

  if (start && endExclusive && start >= endExclusive) {
    throw AppError.badRequest('startDate must be on or before endDate');
  }

  if (start && endInclusive && start > endInclusive) {
    throw AppError.badRequest('startDate must be on or before endDate');
  }

  return { start, endInclusive, endExclusive };
}

function buildDashboardDateFilter(range: DashboardDateRange): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};

  if (range.start) {
    filter.gte = range.start;
  }
  if (range.endExclusive) {
    filter.lt = range.endExclusive;
  } else if (range.endInclusive) {
    filter.lte = range.endInclusive;
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}

// GET /api/dashboard/stats - Get dashboard statistics including attention items
dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    const dashboardDateRange = parseDashboardDateRange(req.query.startDate, req.query.endDate);
    const createdAtDateFilter = buildDashboardDateFilter(dashboardDateRange);
    const updatedAtDateFilter = buildDashboardDateFilter(dashboardDateRange);

    // Get all projects the user has access to
    const projectAccess = await getDashboardProjectAccess(req.user!);

    const projectIds = projectAccess.map((pa) => pa.projectId);

    // If no projects, return empty stats
    if (projectIds.length === 0) {
      return res.json(buildEmptyDashboardStatsResponse(createEmptyLotStatusCounts()));
    }

    // Calculate date thresholds
    const today = new Date();
    const staleHPThreshold = new Date(today);
    staleHPThreshold.setDate(staleHPThreshold.getDate() - 7); // Hold points older than 7 days without activity

    const [
      projects,
      totalLots,
      lotStatusGroups,
      openHoldPoints,
      openNCRs,
      overdueNCRs,
      staleHoldPoints,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          id: { in: projectIds },
        },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
        },
      }),
      prisma.lot.count({
        where: {
          projectId: { in: projectIds },
        },
      }),
      prisma.lot.groupBy({
        by: ['status'],
        where: {
          projectId: { in: projectIds },
        },
        _count: {
          _all: true,
        },
      }),
      prisma.holdPoint.count({
        where: {
          lot: { projectId: { in: projectIds } },
          status: { in: ['pending', 'scheduled', 'requested'] },
          ...(createdAtDateFilter && { createdAt: createdAtDateFilter }),
        },
      }),
      prisma.nCR.count({
        where: {
          projectId: { in: projectIds },
          status: { notIn: ['closed', 'closed_concession'] },
          ...(createdAtDateFilter && { createdAt: createdAtDateFilter }),
        },
      }),
      prisma.nCR.findMany({
        where: {
          projectId: { in: projectIds },
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { lt: today },
          ...(createdAtDateFilter && { createdAt: createdAtDateFilter }),
        },
        select: {
          id: true,
          ncrNumber: true,
          description: true,
          status: true,
          dueDate: true,
          category: true,
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      prisma.holdPoint.findMany({
        where: {
          lot: { projectId: { in: projectIds } },
          status: { in: ['pending', 'scheduled', 'requested'] },
          AND: [
            { createdAt: { lt: staleHPThreshold } },
            ...(createdAtDateFilter ? [{ createdAt: createdAtDateFilter }] : []),
          ],
        },
        select: {
          id: true,
          description: true,
          status: true,
          scheduledDate: true,
          createdAt: true,
          lot: {
            select: {
              id: true,
              lotNumber: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  projectNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
    ]);

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'active').length;
    const lotStatusCounts = createEmptyLotStatusCounts();
    for (const group of lotStatusGroups) {
      if (LOT_STATUS_KEYS.includes(group.status as LotStatusKey)) {
        lotStatusCounts[group.status as LotStatusKey] = group._count._all;
      }
    }

    // Format attention items
    const formattedOverdueNCRs = overdueNCRs.map((ncr) => ({
      id: ncr.id,
      type: 'ncr' as const,
      title: `NCR ${ncr.ncrNumber}`,
      description: ncr.description?.substring(0, 100) || 'No description',
      status: ncr.status,
      category: ncr.category,
      dueDate: ncr.dueDate?.toISOString(),
      daysOverdue: ncr.dueDate
        ? Math.ceil((today.getTime() - new Date(ncr.dueDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0,
      project: {
        id: ncr.project.id,
        name: ncr.project.name,
        projectNumber: ncr.project.projectNumber,
      },
      link: `/projects/${ncr.project.id}/ncr?ncrId=${ncr.id}`,
    }));

    const formattedStaleHPs = staleHoldPoints.map((hp) => ({
      id: hp.id,
      type: 'holdpoint' as const,
      title: hp.description || 'Hold Point',
      description: hp.lot ? `Lot ${hp.lot.lotNumber}` : 'No lot assigned',
      status: hp.status,
      scheduledDate: hp.scheduledDate?.toISOString(),
      createdAt: hp.createdAt.toISOString(),
      daysStale: Math.ceil(
        (today.getTime() - new Date(hp.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
      project: hp.lot?.project
        ? {
            id: hp.lot.project.id,
            name: hp.lot.project.name,
            projectNumber: hp.lot.project.projectNumber,
          }
        : { id: '', name: 'Unknown', projectNumber: '' },
      lotId: hp.lot?.id,
      link: hp.lot?.project ? `/projects/${hp.lot.project.id}/holdpoints` : '/projects',
    }));

    const [recentNCRs, recentLots] = await Promise.all([
      prisma.nCR.findMany({
        where: {
          projectId: { in: projectIds },
          ...(updatedAtDateFilter && { updatedAt: updatedAtDateFilter }),
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          ncrNumber: true,
          status: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
      }),
      prisma.lot.findMany({
        where: {
          projectId: { in: projectIds },
          ...(updatedAtDateFilter && { updatedAt: updatedAtDateFilter }),
        },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          lotNumber: true,
          status: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    const recentActivities = [
      ...recentNCRs.map((ncr) => ({
        id: `ncr-${ncr.id}`,
        type: 'ncr' as const,
        description: `NCR ${ncr.ncrNumber} status: ${ncr.status}`,
        timestamp: ncr.updatedAt.toISOString(),
        link: `/projects/${ncr.project.id}/ncr?ncrId=${ncr.id}`,
      })),
      ...recentLots.map((lot) => ({
        id: `lot-${lot.id}`,
        type: 'lot' as const,
        description: `Lot ${lot.lotNumber} status: ${lot.status}`,
        timestamp: lot.updatedAt.toISOString(),
        link: `/projects/${lot.project.id}/lots/${lot.id}`,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);

    res.json(
      buildDashboardStatsResponse({
        totalProjects,
        activeProjects,
        totalLots,
        lotStatusCounts,
        openHoldPoints,
        openNCRs,
        overdueNCRs: formattedOverdueNCRs,
        staleHoldPoints: formattedStaleHPs,
        recentActivities,
      }),
    );
  }),
);

// Portfolio / commercial dashboard read routes (cash flow, critical NCRs,
// projects at risk) live in ./dashboard/portfolio.ts and are mounted here, after
// the route-wide requireAuth above, so the child router inherits authentication
// (see parentProtectedRoutePrefixes in routeAuthCoverage.test.ts).
dashboardRouter.use(portfolioDashboardRouter);

// Feature #275: GET /api/dashboard/cost-trend - Get daily cost trend chart data
// Shows daily costs with labour vs plant split, filterable by subcontractor
dashboardRouter.get(
  '/cost-trend',
  asyncHandler(async (req, res) => {
    const { projectId, subcontractorId, startDate, endDate, days } = req.query;
    const userId = req.user?.userId || req.user?.id;
    const requestedProjectId = parseOptionalDashboardString(projectId, 'projectId');
    const requestedSubcontractorId = parseOptionalDashboardString(
      subcontractorId,
      'subcontractorId',
    );

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get commercially accessible projects
    const projectAccess = await getDashboardProjectAccess(req.user!);
    const accessibleProjectIds = projectAccess
      .filter((pa) => COMMERCIAL_DASHBOARD_ROLES.has(pa.role))
      .map((pa) => pa.projectId);

    // Determine which project(s) to query
    let targetProjectIds: string[] = [];
    if (requestedProjectId) {
      const requestedProjectAccess = projectAccess.find(
        (pa) => pa.projectId === requestedProjectId,
      );
      if (!requestedProjectAccess) {
        throw AppError.forbidden('Access denied to project');
      }
      if (!COMMERCIAL_DASHBOARD_ROLES.has(requestedProjectAccess.role)) {
        throw AppError.forbidden('You do not have permission to view cost trends');
      }
      targetProjectIds = [requestedProjectId];
    } else {
      requireDashboardRoleIfProjectMember(
        projectAccess,
        COMMERCIAL_DASHBOARD_ROLES,
        'You do not have permission to view cost trends',
      );
      targetProjectIds = accessibleProjectIds;
    }

    if (targetProjectIds.length === 0) {
      return res.json(buildEmptyCostTrendResponse());
    }

    // Calculate date range
    const daysToFetch = parseDashboardDays(days);
    const end = parseOptionalDashboardDate(endDate, 'endDate') ?? new Date();
    const start =
      parseOptionalDashboardDate(startDate, 'startDate') ??
      new Date(end.getTime() - daysToFetch * 24 * 60 * 60 * 1000);

    if (start > end) {
      throw AppError.badRequest('startDate must be on or before endDate');
    }

    // Build docket filter
    const docketWhere: Prisma.DailyDocketWhereInput = {
      projectId: { in: targetProjectIds },
      date: {
        gte: start,
        lte: end,
      },
      status: { in: ['approved', 'pending_approval'] }, // Only approved or pending dockets
      ...(requestedSubcontractorId && { subcontractorCompanyId: requestedSubcontractorId }),
    };

    // Aggregate costs in the database so large date ranges do not hydrate every docket row.
    const docketCostGroups = await prisma.dailyDocket.groupBy({
      by: ['date', 'subcontractorCompanyId'],
      where: docketWhere,
      _sum: {
        totalLabourSubmitted: true,
        totalPlantSubmitted: true,
      },
      orderBy: { date: 'asc' },
    });

    const subcontractorIds = Array.from(
      new Set(
        docketCostGroups
          .map((group) => group.subcontractorCompanyId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const subcontractorNames = new Map(
      (subcontractorIds.length > 0
        ? await prisma.subcontractorCompany.findMany({
            where: { id: { in: subcontractorIds } },
            select: { id: true, companyName: true },
          })
        : []
      ).map((subcontractor) => [subcontractor.id, subcontractor.companyName]),
    );

    // Aggregate by date
    const dailyMap = new Map<
      string,
      { date: string; labour: number; plant: number; combined: number }
    >();
    const subcontractorTotals = new Map<
      string,
      { id: string; name: string; labour: number; plant: number }
    >();

    for (const group of docketCostGroups) {
      const dateKey = group.date.toISOString().split('T')[0];
      const labour = Number(group._sum.totalLabourSubmitted || 0);
      const plant = Number(group._sum.totalPlantSubmitted || 0);

      // Aggregate by date
      const existing = dailyMap.get(dateKey) || { date: dateKey, labour: 0, plant: 0, combined: 0 };
      existing.labour += labour;
      existing.plant += plant;
      existing.combined += labour + plant;
      dailyMap.set(dateKey, existing);

      // Track subcontractor totals
      if (group.subcontractorCompanyId) {
        const subKey = group.subcontractorCompanyId;
        const subExisting = subcontractorTotals.get(subKey) || {
          id: subKey,
          name: subcontractorNames.get(subKey) || 'Unknown subcontractor',
          labour: 0,
          plant: 0,
        };
        subExisting.labour += labour;
        subExisting.plant += plant;
        subcontractorTotals.set(subKey, subExisting);
      }
    }

    // Convert to sorted array
    const dailyCosts = Array.from(dailyMap.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Calculate totals
    const totals = dailyCosts.reduce(
      (acc, day) => ({
        labour: acc.labour + day.labour,
        plant: acc.plant + day.plant,
        combined: acc.combined + day.combined,
      }),
      { labour: 0, plant: 0, combined: 0 },
    );

    // Calculate running average (average daily cost)
    const runningAverage = dailyCosts.length > 0 ? totals.combined / dailyCosts.length : 0;

    // Add cumulative and running average to each day
    let cumulative = 0;
    let runningSum = 0;
    const dailyCostsWithTrend = dailyCosts.map((day, index) => {
      cumulative += day.combined;
      runningSum += day.combined;
      const dayRunningAverage = runningSum / (index + 1);
      return {
        ...day,
        cumulative,
        runningAverage: Math.round(dayRunningAverage * 100) / 100,
      };
    });

    // Format subcontractor breakdown
    const subcontractors = Array.from(subcontractorTotals.values()).sort(
      (a, b) => b.labour + b.plant - (a.labour + a.plant),
    ); // Sort by total cost descending

    res.json(
      buildCostTrendResponse({
        dailyCosts: dailyCostsWithTrend,
        totals,
        runningAverage,
        subcontractors,
        start,
        end,
      }),
    );
  }),
);

// Role-specific dashboard read routes (foreman, quality-manager, project-manager)
// live in ./dashboard/roleDashboards.ts and are mounted here, after the route-wide
// requireAuth above (and after the portfolio routes), so the child router inherits
// authentication. See parentProtectedRoutePrefixes in routeAuthCoverage.test.ts.
dashboardRouter.use(dashboardRoleDashboardsRouter);

// GET /api/projects/:projectId/foreman/today - Unified "Today" worklist for foreman
// Shows everything requiring attention: hold points, ITP items, inspections
// Categorized by urgency: blocking (past due), due_today, upcoming (next 48h)
dashboardRouter.get(
  '/projects/:projectId/foreman/today',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;
    const projectId = parseDashboardRouteParam(req.params.projectId, 'projectId');

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    const user = req.user!;
    if (SUBCONTRACTOR_DASHBOARD_ROLES.has(user.roleInCompany || '')) {
      throw AppError.forbidden('You do not have permission to view the foreman worklist');
    }

    const projectAccess = await prisma.projectUser.findFirst({
      where: { userId, projectId, status: 'active' },
    });

    const companyAccess =
      COMPANY_ADMIN_ROLES.has(user.roleInCompany || '') && user.companyId
        ? await prisma.project.findFirst({
            where: {
              id: projectId,
              companyId: user.companyId,
            },
            select: { id: true },
          })
        : null;

    if (!companyAccess && projectAccess && !FOREMAN_DASHBOARD_ROLES.has(projectAccess.role)) {
      throw AppError.forbidden('You do not have permission to view the foreman worklist');
    }

    if (!projectAccess && !companyAccess) {
      throw AppError.forbidden('You do not have access to this project');
    }

    // Calculate date boundaries
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Arrays to hold categorized items
    const blocking: ForemanWorkItem[] = [];
    const dueToday: ForemanWorkItem[] = [];
    const upcoming: ForemanWorkItem[] = [];

    // 1. Get Hold Points
    // Blocking: scheduled date is in the past and still pending
    // Due Today: scheduled for today
    // Upcoming: scheduled for tomorrow or day after
    const holdPoints = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId },
        status: { in: ['pending', 'scheduled', 'requested'] },
      },
      include: {
        lot: {
          select: {
            id: true,
            lotNumber: true,
            projectId: true,
          },
        },
        itpChecklistItem: {
          select: {
            description: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    for (const hp of holdPoints) {
      const item = {
        id: hp.id,
        type: 'hold_point' as const,
        title: hp.description || hp.itpChecklistItem?.description || 'Hold Point',
        subtitle: `Status: ${hp.status.replace('_', ' ')}`,
        link: `/projects/${projectId}/lots/${hp.lot.id}?tab=holdpoints&hp=${hp.id}`,
        metadata: {
          lotNumber: hp.lot.lotNumber,
          lotId: hp.lot.id,
          status: hp.status,
        },
      };

      const scheduledDate = hp.scheduledDate ? new Date(hp.scheduledDate) : null;

      if (!scheduledDate) {
        // No scheduled date - treat as due today (needs attention)
        dueToday.push({ ...item, urgency: 'due_today' });
      } else if (scheduledDate < today) {
        // Past due - blocking
        blocking.push({ ...item, urgency: 'blocking' });
      } else if (scheduledDate >= today && scheduledDate < tomorrow) {
        // Due today
        dueToday.push({ ...item, urgency: 'due_today' });
      } else if (scheduledDate >= tomorrow && scheduledDate < dayAfterTomorrow) {
        // Upcoming (tomorrow)
        upcoming.push({ ...item, urgency: 'upcoming' });
      }
      // Items further out are not shown
    }

    // 2. Get ITP Checklist Items that need completion
    // These are items where the ITP is assigned to a lot but the item hasn't been completed
    const itpCompletions = await prisma.iTPCompletion.findMany({
      where: {
        itpInstance: {
          lot: { projectId },
        },
        status: { in: ['pending', 'in_progress'] },
      },
      include: {
        checklistItem: {
          select: {
            id: true,
            description: true,
            pointType: true,
            sequenceNumber: true,
          },
        },
        itpInstance: {
          include: {
            lot: {
              select: {
                id: true,
                lotNumber: true,
              },
            },
            template: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        checklistItem: { sequenceNumber: 'asc' },
      },
      take: 50, // Limit to prevent overload
    });

    for (const completion of itpCompletions) {
      // Skip hold points - they're handled above
      if (completion.checklistItem.pointType === 'hold_point') continue;

      const item = {
        id: completion.id,
        type: 'itp_item' as const,
        title: completion.checklistItem.description,
        subtitle: completion.itpInstance.template?.name || 'ITP Item',
        link: `/projects/${projectId}/lots/${completion.itpInstance.lot?.id}?tab=itp`,
        metadata: {
          lotNumber: completion.itpInstance.lot?.lotNumber,
          lotId: completion.itpInstance.lot?.id,
          itpName: completion.itpInstance.template?.name,
          status: completion.status,
        },
      };

      // ITP items without specific due dates go to "due today" as they need ongoing attention
      // Witness points are less urgent than hold points
      if (completion.checklistItem.pointType === 'witness_point') {
        dueToday.push({ ...item, urgency: 'due_today' });
      } else {
        // Regular checklist items - upcoming
        upcoming.push({ ...item, urgency: 'upcoming' });
      }
    }

    // 3. Get pending verifications (ITP items completed by subbie, awaiting HC verification)
    const pendingVerifications = await prisma.iTPCompletion.findMany({
      where: {
        itpInstance: {
          lot: { projectId },
        },
        status: 'completed',
        verificationStatus: 'pending_verification',
      },
      include: {
        checklistItem: {
          select: {
            description: true,
          },
        },
        itpInstance: {
          include: {
            lot: {
              select: {
                id: true,
                lotNumber: true,
              },
            },
          },
        },
      },
      take: 20,
    });

    for (const verification of pendingVerifications) {
      dueToday.push({
        id: `verify-${verification.id}`,
        type: 'inspection' as const,
        title: `Verify: ${verification.checklistItem.description}`,
        subtitle: 'Awaiting your verification',
        urgency: 'due_today',
        link: `/projects/${projectId}/lots/${verification.itpInstance.lot?.id}?tab=itp`,
        metadata: {
          lotNumber: verification.itpInstance.lot?.lotNumber,
          lotId: verification.itpInstance.lot?.id,
        },
      });
    }

    // Calculate summary
    const summary = {
      totalBlocking: blocking.length,
      totalDueToday: dueToday.length,
      totalUpcoming: upcoming.length,
    };

    res.json({
      blocking,
      dueToday,
      upcoming,
      summary,
    });
  }),
);

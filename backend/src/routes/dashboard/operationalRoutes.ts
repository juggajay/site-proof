import { Router } from 'express';
import { type Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildCostTrendResponse, buildEmptyCostTrendResponse } from '../dashboardResponses.js';
import {
  COMMERCIAL_DASHBOARD_ROLES,
  COMPANY_ADMIN_ROLES,
  SUBCONTRACTOR_DASHBOARD_ROLES,
  FOREMAN_DASHBOARD_ROLES,
  getDashboardProjectAccess,
  requireDashboardRoleIfProjectMember,
} from './access.js';
import {
  parseDashboardDays,
  parseDashboardRouteParam,
  parseOptionalDashboardDate,
  parseOptionalDashboardString,
} from './operationalQuery.js';
import { dashboardStatsRouter } from './statsRoute.js';

// =============================================================================
// Operational dashboard routes, moved verbatim from dashboard.ts:
//   GET /stats                              - portfolio-wide dashboard statistics
//   GET /cost-trend                         - daily labour/plant cost trend
//   GET /projects/:projectId/foreman/today  - foreman "today" worklist
// Mounted by dashboard.ts after its route-wide requireAuth, so these inherit
// authentication without re-declaring it (see parentProtectedRoutePrefixes in
// routeAuthCoverage.test.ts). Behavior-preserving: identical access checks,
// Prisma queries, date/param parsing, sort order, and response shapes. The local
// query/param helpers travel with these routes because they had no other callers.
// =============================================================================

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

export const dashboardOperationalRouter = Router();

dashboardOperationalRouter.use(dashboardStatsRouter);

// Feature #275: GET /api/dashboard/cost-trend - Get daily cost trend chart data
// Shows daily costs with labour vs plant split, filterable by subcontractor
dashboardOperationalRouter.get(
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

// GET /api/projects/:projectId/foreman/today - Unified "Today" worklist for foreman
// Shows everything requiring attention: hold points, ITP items, inspections
// Categorized by urgency: blocking (past due), due_today, upcoming (next 48h)
dashboardOperationalRouter.get(
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

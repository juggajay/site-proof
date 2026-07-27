import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  daysOverdue,
  OVERDUE_HOLD_POINT_STATUSES,
  STAGNANT_HOLD_POINT_STATUSES,
} from '../../lib/readiness/predicates.js';
import {
  buildDashboardStatsResponse,
  buildEmptyDashboardStatsResponse,
} from '../dashboardResponses.js';
import { getDashboardProjectAccess } from './access.js';
import {
  toHoldPointAssignment,
  toNcrAssignment,
  type AssignmentViewer,
} from './actionAssignments.js';
import {
  buildDashboardDateFilter,
  createEmptyLotStatusCounts,
  LOT_STATUS_KEYS,
  type LotStatusKey,
  parseDashboardDateRange,
} from './operationalQuery.js';

export const dashboardStatsRouter = Router();

/** The cap both attention feeds have always had (`take: 10`). Phase 1 stays capped. */
const ATTENTION_FEED_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

// GET /api/dashboard/stats - Get dashboard statistics including attention items
dashboardStatsRouter.get(
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
    // A4R-B4: `holdPointOverdue` (predicates.ts:105-112) is scheduledDate past by
    // more than one day. Mirrored exactly so every extra row this widening pulls
    // in satisfies the predicate the adapter re-evaluates.
    const overdueHPThreshold = new Date(today.getTime() - DAY_MS);

    // Overdue-NCR feed: one `where`, shared by the capped page and its real count.
    const overdueNcrWhere = {
      projectId: { in: projectIds },
      status: { notIn: ['closed', 'closed_concession'] },
      dueDate: { lt: today },
    };

    // A4R-B4: the hold-point fetch is WIDENED with an additive OR branch so a hold
    // point overdue by its scheduled date but younger than 7 days is no longer
    // missed. The extra rows flow ONLY into `actionAssignments` — the legacy
    // `attentionItems.staleHoldPoints` below re-filters to exactly the stagnant
    // set, so the widget and the dashboard PDF do not move.
    const attentionHoldPointWhere = {
      lot: { projectId: { in: projectIds } },
      OR: [
        {
          status: { in: [...STAGNANT_HOLD_POINT_STATUSES] },
          createdAt: { lt: staleHPThreshold },
        },
        {
          status: { in: [...OVERDUE_HOLD_POINT_STATUSES] },
          scheduledDate: { lt: overdueHPThreshold },
        },
      ],
    };

    const [
      projects,
      totalLots,
      lotStatusGroups,
      openHoldPoints,
      openNCRs,
      overdueNCRs,
      overdueNCRTotal,
      attentionHoldPoints,
      attentionHoldPointTotal,
      controlLineCount,
      planSheetCount,
      lotsWithItpCount,
      otherTeammates,
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
        // Open-NCR count reflects ALL current compliance debt, independent of the
        // dashboard date-range window. Filtering by createdAt here would hide the
        // oldest open NCRs and make a manager believe compliance debt is handled.
        where: {
          projectId: { in: projectIds },
          status: { notIn: ['closed', 'closed_concession'] },
        },
      }),
      prisma.nCR.findMany({
        // Overdue-NCR attention items must surface the most-overdue NCRs regardless
        // of the date-range window — the date filter previously hid the oldest
        // (and most urgent) overdue NCRs from the very panel meant to surface them.
        where: overdueNcrWhere,
        select: {
          id: true,
          ncrNumber: true,
          description: true,
          status: true,
          dueDate: true,
          category: true,
          // A4 P1.1 ball-in-court only; the legacy formatting below ignores them.
          responsibleUserId: true,
          responsibleSubcontractorId: true,
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: ATTENTION_FEED_LIMIT,
      }),
      prisma.nCR.count({ where: overdueNcrWhere }),
      prisma.holdPoint.findMany({
        // Stale hold points are, by definition, older than the staleHPThreshold
        // (7 days). Layering the dashboard date-range window on top is doubly
        // contradictory and hid the longest-stale hold points from the attention
        // panel, so it must reflect ALL stale hold points regardless of the window.
        where: attentionHoldPointWhere,
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
        // Every row the additive OR branch adds is NEWER than staleHPThreshold (a
        // requested/scheduled hold point older than that is already stagnant), so
        // under `createdAt asc` the stagnant rows always sort FIRST. Taking double
        // the cap therefore still contains the exact stagnant page the legacy
        // `take: 10` returned, while leaving room for the overdue rows.
        take: ATTENTION_FEED_LIMIT * 2,
      }),
      prisma.holdPoint.count({ where: attentionHoldPointWhere }),
      // Setup-checklist progress counts (company-level, date-range independent):
      // these drive first-run onboarding ticks, not the windowed KPI metrics.
      prisma.controlLine.count({ where: { projectId: { in: projectIds } } }),
      prisma.planSheet.count({ where: { projectId: { in: projectIds } } }),
      prisma.iTPInstance.count({ where: { lot: { projectId: { in: projectIds } } } }),
      prisma.projectUser.findMany({
        where: { projectId: { in: projectIds }, userId: { not: userId } },
        distinct: ['userId'],
        select: { userId: true },
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
      daysOverdue: daysOverdue(ncr.dueDate, today),
      project: {
        id: ncr.project.id,
        name: ncr.project.name,
        projectNumber: ncr.project.projectNumber,
      },
      link: `/projects/${ncr.project.id}/ncr?ncr=${ncr.id}`,
    }));

    // The legacy widget/PDF set: EXACTLY the stagnant rows the un-widened query
    // returned, compared against the same threshold object the query used (not
    // `holdPointStagnant`, whose `now - 7 * DAY_MS` can differ from this
    // `setDate(-7)` by an hour across a DST boundary).
    const isStagnantAttentionRow = (hp: { status: string; createdAt: Date }) =>
      (STAGNANT_HOLD_POINT_STATUSES as readonly string[]).includes(hp.status) &&
      hp.createdAt < staleHPThreshold;

    const staleHoldPoints = attentionHoldPoints
      .filter(isStagnantAttentionRow)
      .slice(0, ATTENTION_FEED_LIMIT);

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
        link: `/projects/${ncr.project.id}/ncr?ncr=${ncr.id}`,
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

    // A4 P1.1 — additive. Nothing above this line reads it.
    const viewer: AssignmentViewer = {
      userId,
      roleByProject: new Map(projectAccess.map((pa) => [pa.projectId, pa.role])),
      fallbackRole: req.user!.roleInCompany,
    };
    // ponytail: capped, not paginated (P2 owns paging). The stagnant page comes
    // first because it is the page the widget already shows; the additive
    // scheduled-date-overdue rows follow. Ceiling: with ≥ 2 × the cap stagnant
    // rows, no overdue row is fetched at all — `totalCount` still counts them.
    const actionAssignments = {
      items: [
        ...overdueNCRs.map((ncr) => toNcrAssignment(ncr, viewer, today)),
        ...[
          ...staleHoldPoints,
          ...attentionHoldPoints.filter((hp) => !isStagnantAttentionRow(hp)),
        ].map((hp) => toHoldPointAssignment(hp, viewer, today)),
      ],
      totalCount: overdueNCRTotal + attentionHoldPointTotal,
    };

    res.json(
      buildDashboardStatsResponse({
        actionAssignments,
        totalProjects,
        activeProjects,
        totalLots,
        lotStatusCounts,
        openHoldPoints,
        openNCRs,
        overdueNCRs: formattedOverdueNCRs,
        staleHoldPoints: formattedStaleHPs,
        recentActivities,
        setupProgress: {
          controlLines: controlLineCount,
          planSheets: planSheetCount,
          lotsWithItp: lotsWithItpCount,
          teamMembers: otherTeammates.length,
        },
      }),
    );
  }),
);

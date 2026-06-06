import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  buildDashboardStatsResponse,
  buildEmptyDashboardStatsResponse,
} from '../dashboardResponses.js';
import { getDashboardProjectAccess } from './access.js';
import {
  buildDashboardDateFilter,
  createEmptyLotStatusCounts,
  LOT_STATUS_KEYS,
  type LotStatusKey,
  parseDashboardDateRange,
} from './operationalQuery.js';

export const dashboardStatsRouter = Router();

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

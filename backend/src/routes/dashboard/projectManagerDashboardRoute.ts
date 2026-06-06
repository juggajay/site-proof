import { Router } from 'express';

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  COMMERCIAL_DASHBOARD_ROLES,
  getDashboardProjectAccess,
  requireDashboardRoleIfProjectMember,
} from './access.js';
import {
  buildEmptyProjectManagerDashboardResponse,
  buildProjectManagerDashboardResponse,
} from './roleDashboardResponses.js';

export const projectManagerDashboardRouter = Router();

// Feature #294: GET /api/dashboard/project-manager - Dashboard for PM role
// Shows lot progress, NCRs, HP pipeline, claims, cost tracking, attention items
projectManagerDashboardRouter.get(
  '/project-manager',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get project-manager-dashboard eligible projects
    const projectAccess = await getDashboardProjectAccess(req.user!);

    requireDashboardRoleIfProjectMember(
      projectAccess,
      COMMERCIAL_DASHBOARD_ROLES,
      'You do not have permission to view the project manager dashboard',
    );

    const eligibleProjectAccess = projectAccess.filter((pa) =>
      COMMERCIAL_DASHBOARD_ROLES.has(pa.role),
    );

    const activeProjects = eligibleProjectAccess
      .filter((pa) => pa.project.status === 'active')
      .map((pa) => pa.project);

    const primaryProject = activeProjects[0] || eligibleProjectAccess[0]?.project || null;
    const projectId = primaryProject?.id;

    if (!projectId || !primaryProject) {
      return res.json(buildEmptyProjectManagerDashboardResponse());
    }

    // 1. Lot Progress
    const lotStats = await prisma.lot.groupBy({
      by: ['status'],
      where: { projectId },
      _count: true,
    });

    const lotProgress = {
      total: 0,
      notStarted: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
      progressPercentage: 0,
    };

    lotStats.forEach((stat) => {
      lotProgress.total += stat._count;
      switch (stat.status) {
        case 'not_started':
          lotProgress.notStarted = stat._count;
          break;
        case 'in_progress':
          lotProgress.inProgress = stat._count;
          break;
        case 'on_hold':
          lotProgress.onHold = stat._count;
          break;
        case 'completed':
        case 'conformed':
          lotProgress.completed += stat._count;
          break;
      }
    });

    lotProgress.progressPercentage =
      lotProgress.total > 0 ? (lotProgress.completed / lotProgress.total) * 100 : 0;

    // Run all independent queries in parallel for performance
    const today = new Date();
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      majorNCRs,
      minorNCRs,
      overdueNCRs,
      recentNCRs,
      hpPending,
      hpScheduled,
      hpRequested,
      hpReleased,
      hpThisWeek,
      upcomingHPs,
      claims,
      recentClaims,
      project,
      dockets,
      overdueNCRList,
      majorNCRList,
    ] = await Promise.all([
      // 2. NCR counts
      prisma.nCR.count({
        where: { projectId, category: 'major', status: { notIn: ['closed', 'closed_concession'] } },
      }),
      prisma.nCR.count({
        where: { projectId, category: 'minor', status: { notIn: ['closed', 'closed_concession'] } },
      }),
      prisma.nCR.count({
        where: {
          projectId,
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { lt: today },
        },
      }),
      prisma.nCR.findMany({
        where: { projectId, status: { notIn: ['closed', 'closed_concession'] } },
        select: {
          id: true,
          ncrNumber: true,
          description: true,
          category: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 3. HP Pipeline
      prisma.holdPoint.count({ where: { lot: { projectId }, status: 'pending' } }),
      prisma.holdPoint.count({ where: { lot: { projectId }, status: 'scheduled' } }),
      prisma.holdPoint.count({ where: { lot: { projectId }, status: 'requested' } }),
      prisma.holdPoint.count({ where: { lot: { projectId }, status: 'released' } }),
      prisma.holdPoint.count({
        where: {
          lot: { projectId },
          status: { in: ['scheduled', 'requested'] },
          scheduledDate: { gte: today, lte: oneWeekFromNow },
        },
      }),
      prisma.holdPoint.findMany({
        where: { lot: { projectId }, status: { in: ['pending', 'scheduled', 'requested'] } },
        include: { lot: { select: { lotNumber: true, id: true, projectId: true } } },
        orderBy: { scheduledDate: 'asc' },
        take: 5,
      }),
      // 4. Claims
      prisma.progressClaim.findMany({
        where: { projectId },
        select: {
          id: true,
          claimNumber: true,
          totalClaimedAmount: true,
          certifiedAmount: true,
          paidAmount: true,
          status: true,
        },
      }),
      prisma.progressClaim.findMany({
        where: { projectId },
        select: { id: true, claimNumber: true, totalClaimedAmount: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 5. Cost Tracking
      prisma.project.findUnique({ where: { id: projectId }, select: { contractValue: true } }),
      prisma.dailyDocket.findMany({
        where: { projectId, status: 'approved' },
        select: { totalLabourSubmitted: true, totalPlantSubmitted: true },
      }),
      // 6. Attention Items
      prisma.nCR.findMany({
        where: {
          projectId,
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { lt: today },
        },
        select: { id: true, ncrNumber: true, description: true },
        take: 3,
      }),
      prisma.nCR.findMany({
        where: {
          projectId,
          category: 'major',
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { gte: today },
        },
        select: { id: true, ncrNumber: true, description: true },
        take: 2,
      }),
    ]);

    res.json(
      buildProjectManagerDashboardResponse({
        projectId,
        lotStats,
        majorNCRs,
        minorNCRs,
        overdueNCRs,
        recentNCRs,
        hpPending,
        hpScheduled,
        hpRequested,
        hpReleased,
        hpThisWeek,
        upcomingHPs,
        claims,
        recentClaims,
        project,
        dockets,
        overdueNCRList,
        majorNCRList,
        primaryProject,
      }),
    );
  }),
);

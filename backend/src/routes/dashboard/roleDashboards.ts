import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  COMMERCIAL_DASHBOARD_ROLES,
  FOREMAN_DASHBOARD_ROLES,
  QUALITY_DASHBOARD_ROLES,
  getDashboardProjectAccess,
  requireDashboardRoleIfProjectMember,
} from './access.js';
import {
  buildEmptyForemanDashboardResponse,
  buildForemanDashboardResponse,
  buildEmptyQualityManagerDashboardResponse,
  buildQualityManagerDashboardResponse,
} from '../dashboardResponses.js';

// =============================================================================
// Role-specific dashboard read routes, moved verbatim from dashboard.ts:
//   GET /foreman, /quality-manager, /project-manager
// Mounted by dashboard.ts after its route-wide requireAuth (and after the
// portfolio routes), so these inherit authentication without re-declaring it
// (see parentProtectedRoutePrefixes in routeAuthCoverage.test.ts).
// Behavior-preserving: identical role gates, Prisma queries, empty-state
// responses, response shapes, and links.
// =============================================================================

export const dashboardRoleDashboardsRouter = Router();

// Feature #292: GET /api/dashboard/foreman - Simplified dashboard for foreman role
// Shows today's diary status, pending dockets, inspections due today, and weather
dashboardRoleDashboardsRouter.get(
  '/foreman',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get foreman-dashboard eligible projects
    const projectAccess = await getDashboardProjectAccess(req.user!);

    requireDashboardRoleIfProjectMember(
      projectAccess,
      FOREMAN_DASHBOARD_ROLES,
      'You do not have permission to view the foreman dashboard',
    );

    const eligibleProjectAccess = projectAccess.filter((pa) =>
      FOREMAN_DASHBOARD_ROLES.has(pa.role),
    );

    const activeProjects = eligibleProjectAccess
      .filter((pa) => pa.project.status === 'active')
      .map((pa) => pa.project);

    // Use the most recently updated active project, or first project if none active
    const primaryProject = activeProjects[0] || eligibleProjectAccess[0]?.project || null;
    const projectId = primaryProject?.id;

    // Return empty data if no project access
    if (!projectId) {
      return res.json(buildEmptyForemanDashboardResponse());
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Today's Diary Status
    const todayDiary = await prisma.dailyDiary.findFirst({
      where: {
        projectId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        id: true,
        status: true,
        weatherConditions: true,
        temperatureMin: true,
        temperatureMax: true,
        rainfallMm: true,
      },
    });

    // 2. Pending Dockets
    const pendingDockets = await prisma.dailyDocket.findMany({
      where: {
        projectId,
        status: 'pending_approval',
      },
      select: {
        totalLabourSubmitted: true,
        totalPlantSubmitted: true,
      },
    });

    const docketStats = {
      count: pendingDockets.length,
      totalLabourHours: pendingDockets.reduce(
        (sum, d) => sum + Number(d.totalLabourSubmitted || 0),
        0,
      ),
      totalPlantHours: pendingDockets.reduce(
        (sum, d) => sum + Number(d.totalPlantSubmitted || 0),
        0,
      ),
    };

    // 3. Inspections Due Today (Hold Points + ITPs that are scheduled for today)
    const holdPointsDueToday = await prisma.holdPoint.findMany({
      where: {
        lot: { projectId },
        status: { in: ['scheduled', 'requested'] },
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        lot: { select: { lotNumber: true, id: true, projectId: true } },
      },
      take: 10,
    });

    // Also check ITP completions due today
    const itpsDueToday = await prisma.iTPChecklistItem.findMany({
      where: {
        template: {
          itpInstances: {
            some: {
              lot: { projectId },
            },
          },
        },
      },
      include: {
        template: {
          include: {
            itpInstances: {
              where: {
                lot: { projectId },
              },
              include: {
                lot: { select: { lotNumber: true, id: true, projectId: true } },
              },
              take: 1,
            },
          },
        },
      },
      take: 10,
    });

    const inspectionItems = [
      ...holdPointsDueToday.map((hp) => ({
        id: hp.id,
        type: 'Hold Point',
        description: hp.description || 'Hold Point',
        lotNumber: hp.lot.lotNumber,
        link: `/projects/${hp.lot.projectId}/lots/${hp.lot.id}/holdpoints?hp=${hp.id}`,
      })),
      ...itpsDueToday.map((item) => ({
        id: item.id,
        type: 'ITP',
        description: item.description,
        lotNumber: item.template?.itpInstances?.[0]?.lot?.lotNumber || 'Unknown',
        link: `/projects/${projectId}/itp`,
      })),
    ];

    // 4. Weather from today's diary
    let weather = {
      conditions: null as string | null,
      temperatureMin: null as number | null,
      temperatureMax: null as number | null,
      rainfallMm: null as number | null,
    };

    if (todayDiary) {
      weather = {
        conditions: todayDiary.weatherConditions,
        temperatureMin: todayDiary.temperatureMin ? Number(todayDiary.temperatureMin) : null,
        temperatureMax: todayDiary.temperatureMax ? Number(todayDiary.temperatureMax) : null,
        rainfallMm: todayDiary.rainfallMm ? Number(todayDiary.rainfallMm) : null,
      };
    }

    res.json(
      buildForemanDashboardResponse({
        todayDiary,
        pendingDockets: docketStats,
        inspectionItems,
        weather,
        project: primaryProject,
      }),
    );
  }),
);

// Feature #293: GET /api/dashboard/quality-manager - Dashboard for QM role
// Shows conformance rate, NCRs by category, pending verifications, HP release rate, ITP trends, audit readiness
dashboardRoleDashboardsRouter.get(
  '/quality-manager',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get quality-dashboard eligible projects
    const projectAccess = await getDashboardProjectAccess(req.user!);

    requireDashboardRoleIfProjectMember(
      projectAccess,
      QUALITY_DASHBOARD_ROLES,
      'You do not have permission to view the quality manager dashboard',
    );

    const eligibleProjectAccess = projectAccess.filter((pa) =>
      QUALITY_DASHBOARD_ROLES.has(pa.role),
    );

    const activeProjects = eligibleProjectAccess
      .filter((pa) => pa.project.status === 'active')
      .map((pa) => pa.project);

    const primaryProject = activeProjects[0] || eligibleProjectAccess[0]?.project || null;
    const projectId = primaryProject?.id;

    if (!projectId) {
      return res.json(buildEmptyQualityManagerDashboardResponse());
    }

    // Run all independent queries in parallel for performance
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalLots,
      nonConformingLots,
      majorNCRs,
      minorNCRs,
      observationNCRs,
      openNCRs,
      pendingVerifications,
      releasedHPs,
      pendingHPs,
      recentReleased,
      completedThisWeek,
      completedLastWeek,
      totalITPItems,
      completedITPItems,
    ] = await Promise.all([
      // 1. Lot Conformance
      prisma.lot.count({ where: { projectId } }),
      prisma.lot.count({
        where: {
          projectId,
          ncrLots: { some: { ncr: { status: { notIn: ['closed', 'closed_concession'] } } } },
        },
      }),
      // 2. NCRs by Category
      prisma.nCR.count({
        where: { projectId, category: 'major', status: { notIn: ['closed', 'closed_concession'] } },
      }),
      prisma.nCR.count({
        where: { projectId, category: 'minor', status: { notIn: ['closed', 'closed_concession'] } },
      }),
      prisma.nCR.count({
        where: {
          projectId,
          category: 'observation',
          status: { notIn: ['closed', 'closed_concession'] },
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
          dueDate: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // 3. Pending Verifications
      prisma.iTPCompletion.findMany({
        where: { verificationStatus: 'pending_verification', itpInstance: { lot: { projectId } } },
        include: {
          checklistItem: { select: { description: true } },
          itpInstance: { include: { lot: { select: { lotNumber: true, id: true } } } },
        },
        take: 20,
      }),
      // 4. Hold Point Metrics
      prisma.holdPoint.count({ where: { lot: { projectId }, status: 'released' } }),
      prisma.holdPoint.count({
        where: { lot: { projectId }, status: { in: ['pending', 'scheduled', 'requested'] } },
      }),
      prisma.holdPoint.findMany({
        where: { lot: { projectId }, status: 'released', releasedAt: { not: null } },
        select: { createdAt: true, releasedAt: true },
        take: 20,
        orderBy: { releasedAt: 'desc' },
      }),
      // 5. ITP Completion Trends
      prisma.iTPCompletion.count({
        where: { itpInstance: { lot: { projectId } }, completedAt: { gte: oneWeekAgo } },
      }),
      prisma.iTPCompletion.count({
        where: {
          itpInstance: { lot: { projectId } },
          completedAt: { gte: twoWeeksAgo, lt: oneWeekAgo },
        },
      }),
      prisma.iTPChecklistItem.count({
        where: { template: { itpInstances: { some: { lot: { projectId } } } } },
      }),
      prisma.iTPCompletion.count({
        where: { itpInstance: { lot: { projectId } }, verificationStatus: 'verified' },
      }),
    ]);

    // Derive computed values
    const conformingLots = totalLots - nonConformingLots;
    const conformanceRate = totalLots > 0 ? (conformingLots / totalLots) * 100 : 100;

    const formattedNCRs = openNCRs.map((ncr) => ({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      description: ncr.description,
      category: ncr.category,
      status: ncr.status,
      dueDate: ncr.dueDate?.toISOString() || null,
      daysOpen: Math.floor((Date.now() - ncr.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
    }));

    const pendingVerificationItems = pendingVerifications.map((pv) => ({
      id: pv.id,
      description: pv.checklistItem.description,
      lotNumber: pv.itpInstance.lot?.lotNumber || 'Unknown',
      link: `/projects/${projectId}/lots/${pv.itpInstance.lot?.id}/itp`,
    }));

    const totalHPs = releasedHPs + pendingHPs;
    const releaseRate = totalHPs > 0 ? (releasedHPs / totalHPs) * 100 : 100;

    let avgTimeToRelease = 0;
    if (recentReleased.length > 0) {
      const totalHours = recentReleased.reduce((sum, hp) => {
        if (hp.releasedAt) {
          return sum + (hp.releasedAt.getTime() - hp.createdAt.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgTimeToRelease = Math.round(totalHours / recentReleased.length);
    }

    const itpCompletionRate = totalITPItems > 0 ? (completedITPItems / totalITPItems) * 100 : 100;
    const trend =
      completedThisWeek > completedLastWeek
        ? 'up'
        : completedThisWeek < completedLastWeek
          ? 'down'
          : 'stable';

    // 6. Audit Readiness Score
    const auditIssues: string[] = [];
    let auditScore = 100;

    // Check for major NCRs
    if (majorNCRs > 0) {
      auditIssues.push(`${majorNCRs} major NCR(s) open`);
      auditScore -= majorNCRs * 10;
    }

    // Check for pending verifications
    if (pendingVerifications.length > 5) {
      auditIssues.push(`${pendingVerifications.length} ITP items pending verification`);
      auditScore -= 15;
    }

    // Check for low conformance rate
    if (conformanceRate < 90) {
      auditIssues.push('Lot conformance rate below 90%');
      auditScore -= 15;
    }

    // Check for pending hold points
    if (pendingHPs > 10) {
      auditIssues.push(`${pendingHPs} hold points pending release`);
      auditScore -= 10;
    }

    // Check for low ITP completion
    if (itpCompletionRate < 80) {
      auditIssues.push('ITP completion rate below 80%');
      auditScore -= 10;
    }

    auditScore = Math.max(0, auditScore);
    const auditStatus =
      auditScore >= 80 ? 'ready' : auditScore >= 50 ? 'needs_attention' : 'not_ready';

    res.json(
      buildQualityManagerDashboardResponse({
        totalLots,
        conformingLots,
        nonConformingLots,
        conformanceRate,
        majorNCRs,
        minorNCRs,
        observationNCRs,
        openNCRs: formattedNCRs,
        pendingVerificationItems,
        releasedHPs,
        pendingHPs,
        releaseRate,
        avgTimeToRelease,
        completedThisWeek,
        completedLastWeek,
        trend,
        itpCompletionRate,
        auditScore,
        auditStatus,
        auditIssues,
        project: primaryProject,
      }),
    );
  }),
);

// Feature #294: GET /api/dashboard/project-manager - Dashboard for PM role
// Shows lot progress, NCRs, HP pipeline, claims, cost tracking, attention items
dashboardRoleDashboardsRouter.get(
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

    // Default empty response
    const emptyResponse = {
      lotProgress: {
        total: 0,
        notStarted: 0,
        inProgress: 0,
        onHold: 0,
        completed: 0,
        progressPercentage: 0,
      },
      openNCRs: { total: 0, major: 0, minor: 0, overdue: 0, items: [] },
      holdPointPipeline: {
        pending: 0,
        scheduled: 0,
        requested: 0,
        released: 0,
        thisWeek: 0,
        items: [],
      },
      claimStatus: {
        totalClaimed: 0,
        totalCertified: 0,
        totalPaid: 0,
        outstanding: 0,
        pendingClaims: 0,
        recentClaims: [],
      },
      costTracking: {
        budgetTotal: 0,
        actualSpend: 0,
        variance: 0,
        variancePercentage: 0,
        labourCost: 0,
        plantCost: 0,
        trend: 'on_track' as const,
      },
      attentionItems: [],
      project: null,
    };

    if (!projectId) {
      return res.json(emptyResponse);
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

    // Derive claims totals
    let totalClaimed = 0;
    let totalCertified = 0;
    let totalPaid = 0;
    let pendingClaims = 0;

    claims.forEach((claim) => {
      totalClaimed += Number(claim.totalClaimedAmount || 0);
      totalCertified += Number(claim.certifiedAmount || 0);
      totalPaid += Number(claim.paidAmount || 0);
      if (claim.status === 'submitted' || claim.status === 'pending') {
        pendingClaims++;
      }
    });

    // Derive cost tracking
    let labourCost = 0;
    let plantCost = 0;
    dockets.forEach((d) => {
      labourCost += Number(d.totalLabourSubmitted || 0);
      plantCost += Number(d.totalPlantSubmitted || 0);
    });

    const budgetTotal = Number(project?.contractValue || 0);
    const actualSpend = labourCost + plantCost;
    const variance = actualSpend - budgetTotal;
    const variancePercentage = budgetTotal > 0 ? (variance / budgetTotal) * 100 : 0;
    const trend = variancePercentage < -5 ? 'under' : variancePercentage > 5 ? 'over' : 'on_track';

    // Build attention items
    const attentionItems: Array<{
      id: string;
      type: 'ncr' | 'holdpoint' | 'claim' | 'diary';
      title: string;
      description: string;
      urgency: 'critical' | 'warning' | 'info';
      link: string;
    }> = [];

    overdueNCRList.forEach((ncr) => {
      attentionItems.push({
        id: `ncr-${ncr.id}`,
        type: 'ncr',
        title: `NCR ${ncr.ncrNumber} overdue`,
        description: ncr.description,
        urgency: 'critical',
        link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
      });
    });

    majorNCRList.forEach((ncr) => {
      attentionItems.push({
        id: `ncr-major-${ncr.id}`,
        type: 'ncr',
        title: `Major NCR: ${ncr.ncrNumber}`,
        description: ncr.description,
        urgency: 'warning',
        link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
      });
    });

    res.json({
      lotProgress,
      openNCRs: {
        total: majorNCRs + minorNCRs,
        major: majorNCRs,
        minor: minorNCRs,
        overdue: overdueNCRs,
        items: recentNCRs.map((ncr) => ({
          id: ncr.id,
          ncrNumber: ncr.ncrNumber,
          description: ncr.description,
          category: ncr.category,
          status: ncr.status,
          daysOpen: Math.floor((Date.now() - ncr.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
        })),
      },
      holdPointPipeline: {
        pending: hpPending,
        scheduled: hpScheduled,
        requested: hpRequested,
        released: hpReleased,
        thisWeek: hpThisWeek,
        items: upcomingHPs.map((hp) => ({
          id: hp.id,
          description: hp.description || 'Hold Point',
          lotNumber: hp.lot.lotNumber,
          status: hp.status,
          scheduledDate: hp.scheduledDate?.toISOString() || null,
          link: `/projects/${hp.lot.projectId}/lots/${hp.lot.id}/holdpoints?hp=${hp.id}`,
        })),
      },
      claimStatus: {
        totalClaimed,
        totalCertified,
        totalPaid,
        outstanding: totalCertified - totalPaid,
        pendingClaims,
        recentClaims: recentClaims.map((c) => ({
          id: c.id,
          claimNumber: c.claimNumber,
          amount: Number(c.totalClaimedAmount || 0),
          status: c.status,
          link: `/projects/${projectId}/claims/${c.id}`,
        })),
      },
      costTracking: {
        budgetTotal,
        actualSpend,
        variance,
        variancePercentage: Math.round(variancePercentage * 10) / 10,
        labourCost,
        plantCost,
        trend,
      },
      attentionItems,
      project: primaryProject,
    });
  }),
);

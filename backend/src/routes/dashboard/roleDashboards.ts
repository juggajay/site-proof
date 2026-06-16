import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
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
import { projectManagerDashboardRouter } from './projectManagerDashboardRoute.js';

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

type PendingDocketHoursSource = {
  totalLabourSubmitted?: unknown;
  totalPlantSubmitted?: unknown;
  labourEntries: Array<{ submittedHours: unknown }>;
  plantEntries: Array<{ hoursOperated: unknown }>;
};

export function calculatePendingDocketStats(pendingDockets: PendingDocketHoursSource[]) {
  return {
    count: pendingDockets.length,
    totalLabourHours: pendingDockets.reduce(
      (sum, docket) =>
        sum +
        docket.labourEntries.reduce(
          (entrySum, entry) => entrySum + (Number(entry.submittedHours) || 0),
          0,
        ),
      0,
    ),
    totalPlantHours: pendingDockets.reduce(
      (sum, docket) =>
        sum +
        docket.plantEntries.reduce(
          (entrySum, entry) => entrySum + (Number(entry.hoursOperated) || 0),
          0,
        ),
      0,
    ),
  };
}

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

    // 1. Today's diary, 2. pending dockets and 3. inspections due today are
    // independent reads - run them together instead of sequentially.
    const [todayDiary, pendingDockets, holdPointsDueToday, itpsDueToday] = await Promise.all([
      // 1. Today's Diary Status
      prisma.dailyDiary.findFirst({
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
      }),
      // 2. Pending Dockets
      prisma.dailyDocket.findMany({
        where: {
          projectId,
          status: 'pending_approval',
        },
        select: {
          labourEntries: {
            select: {
              submittedHours: true,
            },
          },
          plantEntries: {
            select: {
              hoursOperated: true,
            },
          },
        },
      }),
      // 3. Inspections Due Today (Hold Points + ITPs that are scheduled for today)
      prisma.holdPoint.findMany({
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
      }),
      // Also check ITP completions due today
      prisma.iTPChecklistItem.findMany({
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
      }),
    ]);

    const docketStats = calculatePendingDocketStats(pendingDockets);

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

dashboardRoleDashboardsRouter.use(projectManagerDashboardRouter);

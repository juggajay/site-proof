import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  COMMERCIAL_DASHBOARD_ROLES,
  getDashboardProjectAccess,
  requireDashboardRoleIfProjectMember,
} from './access.js';
import {
  buildPortfolioCashFlowResponse,
  buildPortfolioNcrsResponse,
  buildProjectsAtRiskResponse,
} from '../dashboardResponses.js';

// =============================================================================
// Portfolio / commercial dashboard read routes, moved verbatim from dashboard.ts
// (GET /portfolio-cashflow, /portfolio-ncrs, /portfolio-risks). Mounted by
// dashboard.ts after its route-wide requireAuth, so these inherit authentication
// without re-declaring it (see parentProtectedRoutePrefixes in
// routeAuthCoverage.test.ts). Behavior-preserving: identical access checks,
// Prisma queries, risk-indicator logic, sort order, and response shapes.
// =============================================================================

export const portfolioDashboardRouter = Router();

// GET /api/dashboard/portfolio-cashflow - Get portfolio-wide cash flow summary
portfolioDashboardRouter.get(
  '/portfolio-cashflow',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get all commercial projects the user has access to
    const projectAccess = await getDashboardProjectAccess(req.user!);

    requireDashboardRoleIfProjectMember(
      projectAccess,
      COMMERCIAL_DASHBOARD_ROLES,
      'You do not have permission to view portfolio cash flow',
    );

    const projectIds = projectAccess
      .filter((pa) => COMMERCIAL_DASHBOARD_ROLES.has(pa.role))
      .map((pa) => pa.projectId);

    // If no projects, return empty cash flow
    if (projectIds.length === 0) {
      return res.json(buildPortfolioCashFlowResponse(0, 0, 0));
    }

    // Get all progress claims for accessible projects
    const claims = await prisma.progressClaim.findMany({
      where: { projectId: { in: projectIds } },
      select: {
        totalClaimedAmount: true,
        certifiedAmount: true,
        paidAmount: true,
        status: true,
      },
    });

    // Calculate totals across all claims
    let totalClaimed = 0;
    let totalCertified = 0;
    let totalPaid = 0;

    for (const claim of claims) {
      totalClaimed += claim.totalClaimedAmount ? Number(claim.totalClaimedAmount) : 0;
      totalCertified += claim.certifiedAmount ? Number(claim.certifiedAmount) : 0;
      totalPaid += claim.paidAmount ? Number(claim.paidAmount) : 0;
    }

    res.json(buildPortfolioCashFlowResponse(totalClaimed, totalCertified, totalPaid));
  }),
);

// GET /api/dashboard/portfolio-ncrs - Get critical NCRs across all projects
portfolioDashboardRouter.get(
  '/portfolio-ncrs',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get all projects the user has access to
    const projectAccess = await getDashboardProjectAccess(req.user!);

    const projectIds = projectAccess.map((pa) => pa.projectId);

    // If no projects, return empty list
    if (projectIds.length === 0) {
      return res.json(buildPortfolioNcrsResponse([]));
    }

    // Get major NCRs (critical) that are not closed
    const criticalNCRs = await prisma.nCR.findMany({
      where: {
        projectId: { in: projectIds },
        category: 'major',
        status: { notIn: ['closed', 'closed_concession'] },
      },
      select: {
        id: true,
        ncrNumber: true,
        description: true,
        category: true,
        status: true,
        dueDate: true,
        createdAt: true,
        project: {
          select: {
            id: true,
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    });

    const today = new Date();
    const formattedNCRs = criticalNCRs.map((ncr) => ({
      id: ncr.id,
      ncrNumber: ncr.ncrNumber,
      description: ncr.description?.substring(0, 100) || 'No description',
      category: ncr.category,
      status: ncr.status,
      dueDate: ncr.dueDate?.toISOString(),
      isOverdue: ncr.dueDate ? new Date(ncr.dueDate) < today : false,
      daysUntilDue: ncr.dueDate
        ? Math.ceil((new Date(ncr.dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      project: {
        id: ncr.project.id,
        name: ncr.project.name,
        projectNumber: ncr.project.projectNumber,
      },
      link: `/projects/${ncr.project.id}/ncr?ncr=${ncr.id}`,
    }));

    res.json(buildPortfolioNcrsResponse(formattedNCRs));
  }),
);

// GET /api/dashboard/portfolio-risks - Get projects at risk with risk indicators
portfolioDashboardRouter.get(
  '/portfolio-risks',
  asyncHandler(async (req, res) => {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      throw AppError.unauthorized('User not found');
    }

    // Get all projects the user has access to
    const projectAccess = await getDashboardProjectAccess(req.user!);

    const projectIds = projectAccess.map((pa) => pa.projectId);

    if (projectIds.length === 0) {
      return res.json(buildProjectsAtRiskResponse([]));
    }

    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all active projects with their risk indicators
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        status: 'active',
      },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        targetCompletion: true,
        status: true,
      },
    });

    const activeProjectIds = projects.map((p) => p.id);

    // Batch queries for all risk indicators - eliminates N+1 pattern
    const [majorNCRsByProject, overdueNCRsByProject, staleHPsByProject] = await Promise.all([
      // Major NCRs grouped by project
      prisma.nCR.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: activeProjectIds },
          category: 'major',
          status: { notIn: ['closed', 'closed_concession'] },
        },
        _count: true,
      }),
      // Overdue NCRs grouped by project
      prisma.nCR.groupBy({
        by: ['projectId'],
        where: {
          projectId: { in: activeProjectIds },
          status: { notIn: ['closed', 'closed_concession'] },
          dueDate: { lt: today },
        },
        _count: true,
      }),
      // Stale hold points - use raw query for efficient grouping via lot join
      activeProjectIds.length > 0
        ? prisma.$queryRaw<Array<{ projectId: string; count: bigint }>>`
        SELECT l."project_id" as "projectId", COUNT(hp.id) as count
        FROM hold_points hp
        JOIN lots l ON hp."lot_id" = l.id
        WHERE l."project_id" IN (${Prisma.join(activeProjectIds)})
          AND hp.status IN ('pending', 'scheduled', 'requested')
          AND hp."created_at" < ${sevenDaysAgo}
        GROUP BY l."project_id"
      `
        : Promise.resolve([]),
    ]);

    // Convert to Maps for O(1) lookup
    const majorNCRMap = new Map(majorNCRsByProject.map((r) => [r.projectId, r._count]));
    const overdueNCRMap = new Map(overdueNCRsByProject.map((r) => [r.projectId, r._count]));
    const staleHPMap = new Map(staleHPsByProject.map((r) => [r.projectId, Number(r.count)]));

    const projectsAtRisk = [];

    for (const project of projects) {
      const riskIndicators = [];

      // Check for timeline risk (due within 30 days)
      if (project.targetCompletion) {
        const targetDate = new Date(project.targetCompletion);
        const daysUntilTarget = Math.ceil(
          (targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysUntilTarget <= 30 && daysUntilTarget > 0) {
          riskIndicators.push({
            type: 'timeline',
            severity: 'warning',
            message: `Target completion in ${daysUntilTarget} days`,
            explanation: 'Project is approaching its target completion date',
          });
        } else if (daysUntilTarget <= 0) {
          riskIndicators.push({
            type: 'timeline',
            severity: 'critical',
            message: `Overdue by ${Math.abs(daysUntilTarget)} days`,
            explanation: 'Project has exceeded its target completion date',
          });
        }
      }

      // Check for major open NCRs (from pre-computed map)
      const majorNCRCount = majorNCRMap.get(project.id) || 0;
      if (majorNCRCount > 0) {
        riskIndicators.push({
          type: 'ncr',
          severity: majorNCRCount >= 3 ? 'critical' : 'warning',
          message: `${majorNCRCount} open major NCR${majorNCRCount > 1 ? 's' : ''}`,
          explanation: 'Major non-conformances require attention and may impact project delivery',
        });
      }

      // Check for overdue NCRs (from pre-computed map)
      const overdueNCRCount = overdueNCRMap.get(project.id) || 0;
      if (overdueNCRCount > 0) {
        riskIndicators.push({
          type: 'overdue_ncr',
          severity: 'critical',
          message: `${overdueNCRCount} overdue NCR${overdueNCRCount > 1 ? 's' : ''}`,
          explanation: 'NCRs have exceeded their due date and require immediate action',
        });
      }

      // Check for stale hold points (from pre-computed map)
      const staleHPCount = staleHPMap.get(project.id) || 0;
      if (staleHPCount > 0) {
        riskIndicators.push({
          type: 'holdpoint',
          severity: 'warning',
          message: `${staleHPCount} stale hold point${staleHPCount > 1 ? 's' : ''}`,
          explanation: 'Hold points have been pending for more than 7 days without progress',
        });
      }

      // Only include projects that have risk indicators
      if (riskIndicators.length > 0) {
        // Sort by severity (critical first)
        riskIndicators.sort((a, b) => {
          const severityOrder = { critical: 0, warning: 1 };
          return (
            severityOrder[a.severity as keyof typeof severityOrder] -
            severityOrder[b.severity as keyof typeof severityOrder]
          );
        });

        projectsAtRisk.push({
          id: project.id,
          name: project.name,
          projectNumber: project.projectNumber,
          riskIndicators,
          riskLevel: riskIndicators.some((r) => r.severity === 'critical') ? 'critical' : 'warning',
          link: `/projects/${project.id}/ncr`,
        });
      }
    }

    // Sort by risk level (critical first)
    projectsAtRisk.sort((a, b) => {
      const levelOrder = { critical: 0, warning: 1 };
      return (
        levelOrder[a.riskLevel as keyof typeof levelOrder] -
        levelOrder[b.riskLevel as keyof typeof levelOrder]
      );
    });

    res.json(buildProjectsAtRiskResponse(projectsAtRisk));
  }),
);

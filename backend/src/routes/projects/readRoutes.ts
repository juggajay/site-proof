import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { buildProjectCostsResponse } from './costResponses.js';
import { buildProjectDetailResponse, buildProjectListResponse } from './listDetailResponses.js';
import { buildProjectOverviewResponse } from './overviewResponses.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type ProjectReadRouterDependencies = {
  isBlockedSubcontractorStatus: (status: string | null | undefined) => boolean;
  isCompanyAdmin: (user: AuthenticatedUser) => boolean;
  isSubcontractorUser: (user: AuthenticatedUser) => boolean;
  parseProjectRouteParam: (value: unknown, fieldName: string) => string;
};

const PROJECT_COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager'];

export function createProjectReadRouter({
  isBlockedSubcontractorStatus,
  isCompanyAdmin,
  isSubcontractorUser,
  parseProjectRouteParam,
}: ProjectReadRouterDependencies) {
  const projectReadRouter = Router();

  projectReadRouter.use(requireAuth);

  // GET /api/projects - List all projects accessible to the user
  projectReadRouter.get(
    '/',
    asyncHandler(async (req, res) => {
      const user = req.user!;
      const isSubcontractor = isSubcontractorUser(user);

      // Get projects the user has access to via ProjectUser table
      const projectUsers = isSubcontractor
        ? []
        : await prisma.projectUser.findMany({
            where: { userId: user.id, status: 'active' },
            select: { projectId: true },
          });
      const projectIds = projectUsers.map((pu) => pu.projectId);

      // Also include projects from user's company for company admins/owners
      const hasCompanyAdminRole = isCompanyAdmin(user);

      // For subcontractor users, get projects via SubcontractorUser -> SubcontractorCompany
      let subcontractorProjectIds: string[] = [];

      if (isSubcontractor) {
        // Get linked subcontractor companies, excluding suspended/removed project links.
        const subcontractorUsers = await prisma.subcontractorUser.findMany({
          where: { userId: user.id },
          include: {
            subcontractorCompany: {
              select: { projectId: true, status: true },
            },
          },
        });

        subcontractorProjectIds = Array.from(
          new Set(
            subcontractorUsers
              .map((link) => link.subcontractorCompany)
              .filter((company) => company && !isBlockedSubcontractorStatus(company.status))
              .map((company) => company!.projectId),
          ),
        );
      }

      const projects = await prisma.project.findMany({
        where: {
          OR: [
            { id: { in: projectIds } },
            { id: { in: subcontractorProjectIds } },
            ...(hasCompanyAdminRole && user.companyId ? [{ companyId: user.companyId }] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
          startDate: true,
          targetCompletion: true,
          contractValue: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(buildProjectListResponse(projects, isSubcontractor));
    }),
  );

  // GET /api/projects/:id - Get a single project
  projectReadRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;
      const isSubcontractor = isSubcontractorUser(user);

      // Check access - user must have access to the project
      const projectUser = isSubcontractor
        ? null
        : await prisma.projectUser.findFirst({
            where: {
              projectId: id,
              userId: user.id,
              status: 'active',
            },
          });

      // Check subcontractor access
      let hasSubcontractorAccess = false;
      let subcontractorSuspended = false;

      if (isSubcontractor) {
        const subcontractorProjectLinks = await prisma.subcontractorUser.findMany({
          where: {
            userId: user.id,
            subcontractorCompany: { projectId: id },
          },
          select: {
            subcontractorCompany: {
              select: { status: true },
            },
          },
        });

        hasSubcontractorAccess = subcontractorProjectLinks.some(
          (link) => !isBlockedSubcontractorStatus(link.subcontractorCompany.status),
        );
        subcontractorSuspended = subcontractorProjectLinks.length > 0 && !hasSubcontractorAccess;
      }

      // Also allow company admins/owners to access company projects
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          clientName: true,
          status: true,
          state: true,
          specificationSet: true,
          startDate: true,
          targetCompletion: true,
          contractValue: true,
          companyId: true,
          lotPrefix: true,
          lotStartingNumber: true,
          ncrPrefix: true,
          ncrStartingNumber: true,
          workingHoursStart: true,
          workingHoursEnd: true,
          workingDays: true,
          chainageStart: true,
          chainageEnd: true,
          settings: true, // Feature #697 - HP recipients stored in JSON settings
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      // Check if user has access via ProjectUser, subcontractor, or is company admin/owner
      const isCompanyAdmin = user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
      const isCompanyProject = project.companyId === user.companyId;

      // Provide specific error message for suspended subcontractors
      if (isSubcontractor && subcontractorSuspended) {
        throw AppError.forbidden(
          'Your company has been suspended from this project. Please contact the project manager.',
        );
      }

      if (!projectUser && !hasSubcontractorAccess && !(isCompanyAdmin && isCompanyProject)) {
        throw AppError.forbidden('Access denied to this project');
      }

      // Hide contract value from subcontractors (commercial isolation)
      if (isSubcontractor) {
        project.contractValue = null;
        project.settings = null;
        project.workingHoursStart = null;
        project.workingHoursEnd = null;
        project.workingDays = null;
      }

      res.json(buildProjectDetailResponse(project));
    }),
  );

  // GET /api/projects/:id/dashboard - Get project dashboard data with stats
  projectReadRouter.get(
    '/:id/dashboard',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;

      if (isSubcontractorUser(user)) {
        throw AppError.forbidden('Access denied to this project');
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          projectNumber: true,
          clientName: true,
          status: true,
          state: true,
          companyId: true,
        },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      const projectUser = await prisma.projectUser.findFirst({
        where: { projectId, userId: user.id, status: 'active' },
      });
      const companyAdmin = isCompanyAdmin(user);
      const isCompanyProject = project.companyId === user.companyId;

      if (!projectUser && !(companyAdmin && isCompanyProject)) {
        throw AppError.forbidden('Access denied to this project');
      }

      // Get today's date range for diary status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const staleHPThreshold = new Date(today);
      staleHPThreshold.setDate(staleHPThreshold.getDate() - 7);

      // Gather all stats in parallel
      const [
        lotsStats,
        ncrStats,
        ncrByCategory,
        holdPointStats,
        itpStats,
        docketStats,
        testCount,
        documentCount,
        todayDiary,
        recentActivity,
        overdueNCRs,
        staleHoldPoints,
      ] = await Promise.all([
        // Lots stats - full breakdown
        prisma.lot.groupBy({
          by: ['status'],
          where: { projectId },
          _count: true,
        }),
        // NCR stats
        Promise.all([
          prisma.nCR.count({
            where: { projectId, status: { notIn: ['closed', 'closed_concession'] } },
          }),
          prisma.nCR.count({ where: { projectId } }),
          prisma.nCR.count({
            where: {
              projectId,
              status: { notIn: ['closed', 'closed_concession'] },
              dueDate: { lt: today },
            },
          }),
        ]),
        // NCR breakdown by category
        Promise.all([
          prisma.nCR.count({
            where: {
              projectId,
              category: 'major',
              status: { notIn: ['closed', 'closed_concession'] },
            },
          }),
          prisma.nCR.count({
            where: {
              projectId,
              category: 'minor',
              status: { notIn: ['closed', 'closed_concession'] },
            },
          }),
          prisma.nCR.count({
            where: {
              projectId,
              category: 'observation',
              status: { notIn: ['closed', 'closed_concession'] },
            },
          }),
        ]),
        // Hold point stats
        Promise.all([
          prisma.holdPoint.count({
            where: { lot: { projectId }, status: { in: ['pending', 'scheduled', 'requested'] } },
          }),
          prisma.holdPoint.count({ where: { lot: { projectId }, status: 'released' } }),
        ]),
        // ITP stats
        Promise.all([
          prisma.iTPInstance.count({
            where: { lot: { projectId }, status: { in: ['not_started', 'in_progress'] } },
          }),
          prisma.iTPInstance.count({ where: { lot: { projectId }, status: 'completed' } }),
        ]),
        // Docket stats
        prisma.dailyDocket.count({ where: { projectId, status: 'pending_approval' } }),
        // Test results count
        prisma.testResult.count({ where: { lot: { projectId } } }),
        // Documents count
        prisma.document.count({ where: { projectId } }),
        // Today's diary
        prisma.dailyDiary.findFirst({
          where: { projectId, date: { gte: today, lt: tomorrow } },
          select: { status: true },
        }),
        // Recent activity (NCRs, lots, hold points, dockets, diary)
        Promise.all([
          prisma.nCR.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            take: 4,
            select: { id: true, ncrNumber: true, status: true, category: true, updatedAt: true },
          }),
          prisma.lot.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            take: 4,
            select: { id: true, lotNumber: true, status: true, updatedAt: true },
          }),
          prisma.holdPoint.findMany({
            where: { lot: { projectId } },
            orderBy: { updatedAt: 'desc' },
            take: 3,
            select: {
              id: true,
              status: true,
              description: true,
              updatedAt: true,
              lot: { select: { lotNumber: true, id: true } },
            },
          }),
          prisma.dailyDocket.findMany({
            where: { projectId },
            orderBy: { updatedAt: 'desc' },
            take: 3,
            include: { subcontractorCompany: { select: { companyName: true } } },
          }),
        ]),
        // Attention: overdue NCRs
        prisma.nCR.findMany({
          where: {
            projectId,
            status: { notIn: ['closed', 'closed_concession'] },
            dueDate: { lt: today },
          },
          select: {
            id: true,
            ncrNumber: true,
            description: true,
            category: true,
            status: true,
            dueDate: true,
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),
        // Attention: stale hold points
        prisma.holdPoint.findMany({
          where: {
            lot: { projectId },
            status: { in: ['pending', 'scheduled', 'requested'] },
            createdAt: { lt: staleHPThreshold },
          },
          select: {
            id: true,
            description: true,
            status: true,
            createdAt: true,
            lot: { select: { id: true, lotNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
          take: 5,
        }),
      ]);

      // Process lots stats - full breakdown
      let lotsTotal = 0;
      let lotsCompleted = 0;
      let lotsInProgress = 0;
      let lotsNotStarted = 0;
      let lotsOnHold = 0;
      lotsStats.forEach((stat) => {
        lotsTotal += stat._count;
        if (stat.status === 'completed' || stat.status === 'conformed') {
          lotsCompleted += stat._count;
        } else if (stat.status === 'in_progress') {
          lotsInProgress += stat._count;
        } else if (stat.status === 'not_started') {
          lotsNotStarted += stat._count;
        } else if (stat.status === 'on_hold') {
          lotsOnHold += stat._count;
        }
      });
      const lotsProgressPct = lotsTotal > 0 ? Math.round((lotsCompleted / lotsTotal) * 100) : 0;

      // Format recent activity
      const [recentNCRs, recentLots, recentHPs, recentDockets] = recentActivity;
      const formattedActivity = [
        ...recentNCRs.map((ncr) => ({
          id: `ncr-${ncr.id}`,
          type: 'ncr' as const,
          description: `NCR ${ncr.ncrNumber} — ${ncr.status.replace(/_/g, ' ')}`,
          timestamp: ncr.updatedAt.toISOString(),
          link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
        })),
        ...recentLots.map((lot) => ({
          id: `lot-${lot.id}`,
          type: 'lot' as const,
          description: `Lot ${lot.lotNumber} — ${lot.status.replace(/_/g, ' ')}`,
          timestamp: lot.updatedAt.toISOString(),
          link: `/projects/${projectId}/lots/${lot.id}`,
        })),
        ...recentHPs.map((hp) => ({
          id: `hp-${hp.id}`,
          type: 'holdpoint' as const,
          description: `Hold point ${hp.status.replace(/_/g, ' ')} — Lot ${hp.lot?.lotNumber || 'Unknown'}`,
          timestamp: hp.updatedAt.toISOString(),
          link: hp.lot ? `/projects/${projectId}/lots/${hp.lot.id}` : undefined,
        })),
        ...recentDockets.map((d) => ({
          id: `docket-${d.id}`,
          type: 'docket' as const,
          description: `Docket ${d.status.replace(/_/g, ' ')}${d.subcontractorCompany ? ` — ${d.subcontractorCompany.companyName}` : ''}`,
          timestamp: d.updatedAt.toISOString(),
          link: `/projects/${projectId}/dockets`,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Format attention items
      const attentionItems = [
        ...overdueNCRs.map((ncr) => ({
          id: `ncr-${ncr.id}`,
          type: 'ncr' as const,
          title: `NCR ${ncr.ncrNumber} overdue`,
          description: ncr.description?.substring(0, 80) || 'No description',
          urgency: (ncr.category === 'major' ? 'critical' : 'warning') as 'critical' | 'warning',
          daysOverdue: ncr.dueDate
            ? Math.ceil((today.getTime() - new Date(ncr.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          link: `/projects/${projectId}/ncr?ncrId=${ncr.id}`,
        })),
        ...staleHoldPoints.map((hp) => ({
          id: `hp-${hp.id}`,
          type: 'holdpoint' as const,
          title: `Hold point stale — Lot ${hp.lot?.lotNumber || 'Unknown'}`,
          description: hp.description?.substring(0, 80) || 'Pending for over 7 days',
          urgency: 'warning' as const,
          daysOverdue: Math.ceil(
            (today.getTime() - new Date(hp.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          ),
          link: hp.lot
            ? `/projects/${projectId}/lots/${hp.lot.id}`
            : `/projects/${projectId}/hold-points`,
        })),
      ];

      res.json(
        buildProjectOverviewResponse({
          project,
          lotsTotal,
          lotsCompleted,
          lotsInProgress,
          lotsNotStarted,
          lotsOnHold,
          lotsProgressPct,
          ncrStats,
          ncrByCategory,
          holdPointStats,
          itpStats,
          docketStats,
          testCount,
          documentCount,
          todayDiaryStatus: todayDiary?.status || null,
          attentionItems,
          recentActivity: formattedActivity,
        }),
      );
    }),
  );

  // GET /api/projects/:id/costs - Get project cost breakdown
  // Returns summary, by-subcontractor, and by-lot cost data
  projectReadRouter.get(
    '/:id/costs',
    asyncHandler(async (req, res) => {
      const projectId = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;

      // Get the project to check ownership and get budget
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, companyId: true, contractValue: true },
      });

      if (!project) {
        throw AppError.notFound('Project');
      }

      const projectUser = await prisma.projectUser.findFirst({
        where: { projectId, userId: user.id, status: 'active' },
      });
      const companyAdmin = isCompanyAdmin(user);
      const isCompanyProject = project.companyId === user.companyId;

      // Check subcontractor access - they should not see cost details
      const isSubcontractor =
        user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin';
      if (isSubcontractor) {
        throw AppError.forbidden('Access denied. Subcontractors cannot view project costs.');
      }

      if (!projectUser && !(companyAdmin && isCompanyProject)) {
        throw AppError.forbidden('Access denied to this project');
      }

      const effectiveRole =
        companyAdmin && isCompanyProject ? user.roleInCompany : projectUser?.role;
      if (!effectiveRole || !PROJECT_COMMERCIAL_ROLES.includes(effectiveRole)) {
        throw AppError.forbidden('You do not have permission to view project costs');
      }

      // Get all approved dockets with their subcontractor info
      const dockets = await prisma.dailyDocket.findMany({
        where: {
          projectId,
          status: 'approved',
        },
        include: {
          subcontractorCompany: {
            select: { id: true, companyName: true },
          },
        },
      });

      // Get pending docket count
      const pendingDocketCount = await prisma.dailyDocket.count({
        where: {
          projectId,
          status: 'pending_approval',
        },
      });

      // Calculate totals
      let totalLabourCost = 0;
      let totalPlantCost = 0;

      // Track by subcontractor
      const subcontractorMap = new Map<
        string,
        {
          id: string;
          companyName: string;
          labourCost: number;
          plantCost: number;
          totalCost: number;
          approvedDockets: number;
        }
      >();

      for (const docket of dockets) {
        const labour = Number(docket.totalLabourSubmitted || 0);
        const plant = Number(docket.totalPlantSubmitted || 0);

        totalLabourCost += labour;
        totalPlantCost += plant;

        // Aggregate by subcontractor
        const subId = docket.subcontractorCompanyId;
        const existing = subcontractorMap.get(subId) || {
          id: subId,
          companyName: docket.subcontractorCompany?.companyName || 'Unknown',
          labourCost: 0,
          plantCost: 0,
          totalCost: 0,
          approvedDockets: 0,
        };
        existing.labourCost += labour;
        existing.plantCost += plant;
        existing.totalCost += labour + plant;
        existing.approvedDockets += 1;
        subcontractorMap.set(subId, existing);
      }

      const totalCost = totalLabourCost + totalPlantCost;
      const budgetTotal = Number(project.contractValue || 0);
      const budgetVariance = budgetTotal - totalCost; // Positive = under budget

      // Get lots with their budget amounts
      const lots = await prisma.lot.findMany({
        where: { projectId },
        select: {
          id: true,
          lotNumber: true,
          activityType: true,
          budgetAmount: true,
        },
        orderBy: { lotNumber: 'asc' },
      });

      // Get cost allocations per lot from docket entries
      // Labour allocations
      const labourLotAllocations = await prisma.docketLabourLot.findMany({
        where: {
          docketLabour: {
            docket: {
              projectId,
              status: 'approved',
            },
          },
        },
        include: {
          docketLabour: {
            select: { submittedCost: true },
          },
        },
      });

      // Plant allocations
      const plantLotAllocations = await prisma.docketPlantLot.findMany({
        where: {
          docketPlant: {
            docket: {
              projectId,
              status: 'approved',
            },
          },
        },
        include: {
          docketPlant: {
            select: { submittedCost: true },
          },
        },
      });

      // Calculate cost per lot
      const lotCostMap = new Map<string, number>();

      // Add labour costs
      for (const alloc of labourLotAllocations) {
        const cost = Number(alloc.docketLabour?.submittedCost || 0);
        const existing = lotCostMap.get(alloc.lotId) || 0;
        lotCostMap.set(alloc.lotId, existing + cost);
      }

      // Add plant costs
      for (const alloc of plantLotAllocations) {
        const cost = Number(alloc.docketPlant?.submittedCost || 0);
        const existing = lotCostMap.get(alloc.lotId) || 0;
        lotCostMap.set(alloc.lotId, existing + cost);
      }

      // Build lot costs array
      const lotCosts = lots.map((lot) => {
        const budgetAmount = Number(lot.budgetAmount || 0);
        const actualCost = lotCostMap.get(lot.id) || 0;
        return {
          id: lot.id,
          lotNumber: lot.lotNumber,
          activity: lot.activityType,
          budgetAmount,
          actualCost,
          variance: budgetAmount - actualCost, // Positive = under budget
        };
      });

      // Build subcontractor costs array
      const subcontractorCosts = Array.from(subcontractorMap.values()).sort(
        (a, b) => b.totalCost - a.totalCost,
      ); // Sort by total cost descending

      res.json(
        buildProjectCostsResponse({
          totalLabourCost,
          totalPlantCost,
          totalCost,
          budgetTotal,
          budgetVariance,
          approvedDockets: dockets.length,
          pendingDockets: pendingDocketCount,
          subcontractorCosts,
          lotCosts,
        }),
      );
    }),
  );

  return projectReadRouter;
}

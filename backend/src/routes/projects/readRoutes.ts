import { Router, type Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { isStandaloneSubcontractorPortalIdentity } from '../../lib/projectAccess.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { buildProjectCostsResponse } from './costResponses.js';
import { buildProjectDetailResponse, buildProjectListResponse } from './listDetailResponses.js';
import { createProjectOverviewRouter } from './projectOverviewRoute.js';

type AuthenticatedUser = NonNullable<Request['user']>;

type ProjectReadRouterDependencies = {
  isBlockedSubcontractorStatus: (status: string | null | undefined) => boolean;
  isCompanyAdmin: (user: AuthenticatedUser) => boolean;
  isSubcontractorUser: (user: AuthenticatedUser) => boolean;
  parseProjectRouteParam: (value: unknown, fieldName: string) => string;
};

const PROJECT_COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager'];

function canViewProjectContractValue(role: string | null | undefined): boolean {
  return Boolean(role && PROJECT_COMMERCIAL_ROLES.includes(role));
}

async function getSubcontractorProjectAccess(
  userId: string,
  projectId: string,
  isBlockedSubcontractorStatus: (status: string | null | undefined) => boolean,
) {
  const subcontractorProjectLinks = await prisma.subcontractorUser.findMany({
    where: {
      userId,
      subcontractorCompany: { projectId },
    },
    select: {
      subcontractorCompany: {
        select: { status: true },
      },
    },
  });

  const hasSubcontractorAccess = subcontractorProjectLinks.some(
    (link) => !isBlockedSubcontractorStatus(link.subcontractorCompany.status),
  );

  return {
    hasSubcontractorAccess,
    subcontractorSuspended: subcontractorProjectLinks.length > 0 && !hasSubcontractorAccess,
  };
}

function getProjectDetailRole({
  hasCompanyAdminAccess,
  hasSubcontractorAccess,
  isSubcontractor,
  projectUserRole,
  userRoleInCompany,
}: {
  hasCompanyAdminAccess: boolean;
  hasSubcontractorAccess: boolean;
  isSubcontractor: boolean;
  projectUserRole?: string | null;
  userRoleInCompany?: string | null;
}) {
  if (hasCompanyAdminAccess) {
    return userRoleInCompany ?? null;
  }

  if (projectUserRole) {
    return projectUserRole;
  }

  if (isSubcontractor && hasSubcontractorAccess) {
    return userRoleInCompany ?? null;
  }

  return null;
}

function maskProjectDetailForCurrentUser<
  T extends {
    contractValue: unknown;
    settings: unknown;
    workingHoursStart: unknown;
    workingHoursEnd: unknown;
    workingDays: unknown;
  },
>(project: T, { isSubcontractor, role }: { isSubcontractor: boolean; role: string | null }) {
  const visibleProject = { ...project };

  if (!canViewProjectContractValue(role)) {
    visibleProject.contractValue = null as T['contractValue'];
  }

  if (isSubcontractor) {
    visibleProject.settings = null as T['settings'];
    visibleProject.workingHoursStart = null as T['workingHoursStart'];
    visibleProject.workingHoursEnd = null as T['workingHoursEnd'];
    visibleProject.workingDays = null as T['workingDays'];
  }

  return visibleProject;
}

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
      const isStandaloneSubcontractor = isStandaloneSubcontractorPortalIdentity(user);

      // Get projects the user has access to via ProjectUser table
      const projectUsers = isSubcontractor
        ? []
        : await prisma.projectUser.findMany({
            where: { userId: user.id, status: 'active' },
            select: { projectId: true, role: true },
          });
      const projectIds = projectUsers.map((pu) => pu.projectId);

      // Also include projects from user's company for company admins/owners
      const hasCompanyAdminRole = isCompanyAdmin(user);

      // For subcontractor users, get projects via SubcontractorUser -> SubcontractorCompany
      let subcontractorProjectIds: string[] = [];

      if (isStandaloneSubcontractor) {
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
          companyId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const projectRoleById = new Map(projectUsers.map((pu) => [pu.projectId, pu.role]));
      const sanitizedProjects = projects.map(({ companyId: projectCompanyId, ...project }) => {
        const effectiveRole =
          hasCompanyAdminRole && user.companyId && projectCompanyId === user.companyId
            ? user.roleInCompany
            : projectRoleById.get(project.id);

        return canViewProjectContractValue(effectiveRole)
          ? project
          : { ...project, contractValue: null };
      });

      res.json(buildProjectListResponse(sanitizedProjects, isStandaloneSubcontractor));
    }),
  );

  // GET /api/projects/:id - Get a single project
  projectReadRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = parseProjectRouteParam(req.params.id, 'id');
      const user = req.user!;
      const isSubcontractor = isSubcontractorUser(user);
      const isStandaloneSubcontractor = isStandaloneSubcontractorPortalIdentity(user);

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

      const { hasSubcontractorAccess, subcontractorSuspended } = isStandaloneSubcontractor
        ? await getSubcontractorProjectAccess(user.id, id, isBlockedSubcontractorStatus)
        : { hasSubcontractorAccess: false, subcontractorSuspended: false };

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
      const hasCompanyAdminAccess = isCompanyAdmin && isCompanyProject;

      // Provide specific error message for suspended subcontractors
      if (isStandaloneSubcontractor && subcontractorSuspended) {
        throw AppError.forbidden(
          'Your company has been suspended from this project. Please contact the project manager.',
        );
      }

      if (!projectUser && !hasSubcontractorAccess && !hasCompanyAdminAccess) {
        throw AppError.forbidden('Access denied to this project');
      }

      const effectiveRole = getProjectDetailRole({
        hasCompanyAdminAccess,
        hasSubcontractorAccess,
        isSubcontractor: isStandaloneSubcontractor,
        projectUserRole: projectUser?.role,
        userRoleInCompany: user.roleInCompany,
      });
      const visibleProject = maskProjectDetailForCurrentUser(project, {
        isSubcontractor: isStandaloneSubcontractor,
        role: effectiveRole,
      });

      res.json(buildProjectDetailResponse({ ...visibleProject, currentUserRole: effectiveRole }));
    }),
  );

  projectReadRouter.use(
    createProjectOverviewRouter({
      isCompanyAdmin,
      isSubcontractorUser,
      parseProjectRouteParam,
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

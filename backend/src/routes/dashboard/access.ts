import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';

// =============================================================================
// Dashboard access control: shared role sets, the request-user / project-access
// types, and the project-access lookup + role guard used across the dashboard
// routes (stats, portfolio, cost-trend, foreman, quality-manager,
// project-manager). Extracted verbatim from dashboard.ts so the child route
// modules (e.g. ./portfolio.ts) can reuse them without a circular import.
// Behavior-preserving: identical role membership, Prisma queries, company-admin
// project expansion, and the same AppError.forbidden message.
// =============================================================================

export const COMMERCIAL_DASHBOARD_ROLES = new Set(['owner', 'admin', 'project_manager']);
export const COMPANY_ADMIN_ROLES = new Set(['owner', 'admin']);
export const SUBCONTRACTOR_DASHBOARD_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
export const FOREMAN_DASHBOARD_ROLES = new Set([
  'owner',
  'admin',
  'project_manager',
  'site_manager',
  'foreman',
]);
export const QUALITY_DASHBOARD_ROLES = new Set([
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
]);

export type AuthUser = NonNullable<Express.Request['user']>;
export type DashboardProject = {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
};
export type DashboardProjectAccess = {
  projectId: string;
  role: string;
  project: DashboardProject;
};

export async function getDashboardProjectAccess(user: AuthUser): Promise<DashboardProjectAccess[]> {
  if (SUBCONTRACTOR_DASHBOARD_ROLES.has(user.roleInCompany || '')) {
    return [];
  }

  const projectAccess = await prisma.projectUser.findMany({
    where: { userId: user.id, status: 'active' },
    select: {
      projectId: true,
      role: true,
      project: {
        select: {
          id: true,
          name: true,
          projectNumber: true,
          status: true,
        },
      },
    },
    orderBy: { project: { updatedAt: 'desc' } },
  });

  const accessByProject = new Map<string, DashboardProjectAccess>();
  for (const access of projectAccess) {
    accessByProject.set(access.projectId, access);
  }

  if (COMPANY_ADMIN_ROLES.has(user.roleInCompany || '') && user.companyId) {
    const companyProjects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: {
        id: true,
        name: true,
        projectNumber: true,
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    for (const project of companyProjects) {
      accessByProject.set(project.id, {
        projectId: project.id,
        role: user.roleInCompany!,
        project,
      });
    }
  }

  return Array.from(accessByProject.values());
}

function hasAnyProjectAccess(
  projectAccess: Array<{ role: string }>,
  allowedRoles: Set<string>,
): boolean {
  return projectAccess.some((pa) => allowedRoles.has(pa.role));
}

export function requireDashboardRoleIfProjectMember(
  projectAccess: Array<{ role: string }>,
  allowedRoles: Set<string>,
  message: string,
) {
  if (projectAccess.length > 0 && !hasAnyProjectAccess(projectAccess, allowedRoles)) {
    throw AppError.forbidden(message);
  }
}

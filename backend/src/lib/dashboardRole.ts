import { prisma } from './prisma.js';

export type DashboardRole =
  | 'project_manager'
  | 'quality_manager'
  | 'foreman'
  | 'site_engineer'
  | 'viewer';

const COMPANY_ROLE_TO_DASHBOARD_ROLE: Partial<Record<string, DashboardRole>> = {
  project_manager: 'project_manager',
  quality_manager: 'quality_manager',
  site_manager: 'foreman',
  foreman: 'foreman',
};

const PROJECT_ROLE_PRIORITY: Array<{ role: string; dashboardRole: DashboardRole }> = [
  { role: 'project_manager', dashboardRole: 'project_manager' },
  { role: 'quality_manager', dashboardRole: 'quality_manager' },
  { role: 'site_manager', dashboardRole: 'foreman' },
  { role: 'foreman', dashboardRole: 'foreman' },
  { role: 'site_engineer', dashboardRole: 'site_engineer' },
  { role: 'viewer', dashboardRole: 'viewer' },
];

const PROJECT_MEMBERSHIP_DASHBOARD_FALLBACK_ROLES = new Set(['member', 'viewer', 'site_engineer']);

export async function resolveDashboardRoleForUser({
  userId,
  roleInCompany,
}: {
  userId: string;
  roleInCompany?: string | null;
}): Promise<DashboardRole | null> {
  const companyDashboardRole = roleInCompany
    ? COMPANY_ROLE_TO_DASHBOARD_ROLE[roleInCompany]
    : undefined;
  if (companyDashboardRole) {
    return companyDashboardRole;
  }

  if (roleInCompany && !PROJECT_MEMBERSHIP_DASHBOARD_FALLBACK_ROLES.has(roleInCompany)) {
    return null;
  }

  const memberships = await prisma.projectUser.findMany({
    where: {
      userId,
      status: 'active',
      role: { in: PROJECT_ROLE_PRIORITY.map((entry) => entry.role) },
    },
    select: { role: true },
  });

  const roles = new Set(memberships.map((membership) => membership.role));
  const highestPriorityRole = PROJECT_ROLE_PRIORITY.find((entry) => roles.has(entry.role));

  return highestPriorityRole?.dashboardRole ?? null;
}

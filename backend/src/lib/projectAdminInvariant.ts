import { AppError } from './AppError.js';
import { prisma } from './prisma.js';

export const PROJECT_ADMIN_ROLES = ['admin', 'project_manager'];

export async function assertCanRemoveUserFromProjectAdminRoles(
  userId: string,
  options: {
    companyId?: string | null;
    actionDescription?: string;
    subjectDescription?: string;
  } = {},
): Promise<void> {
  const adminMemberships = await prisma.projectUser.findMany({
    where: {
      userId,
      status: 'active',
      role: { in: PROJECT_ADMIN_ROLES },
      ...(options.companyId ? { project: { companyId: options.companyId } } : {}),
    },
    select: {
      projectId: true,
      project: {
        select: { name: true },
      },
    },
  });

  if (adminMemberships.length === 0) {
    return;
  }

  const projectIds = adminMemberships.map((membership) => membership.projectId);
  const adminCounts = await prisma.projectUser.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
      status: 'active',
      role: { in: PROJECT_ADMIN_ROLES },
    },
    _count: true,
  });

  const adminCountByProject = new Map(adminCounts.map((count) => [count.projectId, count._count]));
  const orphanedProjects = adminMemberships.filter(
    (membership) => (adminCountByProject.get(membership.projectId) || 0) <= 1,
  );

  if (orphanedProjects.length > 0) {
    const projectNames = orphanedProjects
      .slice(0, 3)
      .map((membership) => membership.project.name)
      .join(', ');
    const actionDescription = options.actionDescription || 'remove account';
    const subjectDescription = options.subjectDescription || 'it is';
    throw AppError.badRequest(
      `Cannot ${actionDescription} while ${subjectDescription} the only active project admin or project manager on ${projectNames}`,
    );
  }
}

import type { Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import { isStandaloneSubcontractorPortalIdentity } from '../../lib/projectAccess.js';

type AuthenticatedUser = NonNullable<Request['user']>;

const TEMPLATE_MANAGER_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
];

function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return user.roleInCompany === 'admin' || user.roleInCompany === 'owner';
}

export async function requireProjectTemplateAccess(
  projectId: string,
  user: AuthenticatedUser,
  manage = false,
) {
  const isSubcontractor = isStandaloneSubcontractorPortalIdentity(user);
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, companyId: true, name: true, projectNumber: true },
    }),
    isSubcontractor
      ? null
      : prisma.projectUser.findFirst({
          where: { projectId, userId: user.id, status: 'active' },
          select: { id: true, role: true },
        }),
  ]);

  if (!project) {
    throw AppError.notFound('Project');
  }

  const hasCompanyAdminAccess =
    !isSubcontractor && isCompanyAdmin(user) && project.companyId === user.companyId;
  const hasProjectAccess = Boolean(projectUser) || hasCompanyAdminAccess;

  if (!hasProjectAccess) {
    throw AppError.forbidden('Access denied to this project');
  }

  if (manage) {
    const canManage =
      hasCompanyAdminAccess || TEMPLATE_MANAGER_ROLES.includes(projectUser?.role || '');
    if (!canManage) {
      throw AppError.forbidden(
        'Only project managers or quality managers can manage ITP templates',
      );
    }
  }

  return { project, projectUser };
}

export async function getReadableProjects(user: AuthenticatedUser) {
  if (isStandaloneSubcontractorPortalIdentity(user)) {
    return [];
  }

  const userProjects = await prisma.projectUser.findMany({
    where: { userId: user.id, status: 'active' },
    include: {
      project: {
        select: { id: true, name: true, projectNumber: true },
      },
    },
  });

  const projectsById = new Map(userProjects.map((pu) => [pu.project.id, pu.project]));

  if (isCompanyAdmin(user) && user.companyId) {
    const companyProjects = await prisma.project.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true, projectNumber: true },
    });

    for (const project of companyProjects) {
      projectsById.set(project.id, project);
    }
  }

  return Array.from(projectsById.values());
}

export async function requireTemplateProjectAccess(
  templateId: string,
  user: AuthenticatedUser,
  manage = false,
) {
  const template = await prisma.iTPTemplate.findUnique({
    where: { id: templateId },
    select: { projectId: true },
  });

  if (!template) {
    throw AppError.notFound('Template not found');
  }

  if (!template.projectId) {
    if (manage) {
      throw AppError.forbidden('Global templates cannot be modified from this endpoint');
    }
    return template;
  }

  await requireProjectTemplateAccess(template.projectId, user, manage);
  return template;
}

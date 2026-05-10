import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/AppError.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  requireSubcontractorPortalModuleAccess,
} from '../../../lib/projectAccess.js';
import type { AuthUser } from '../../../lib/auth.js';

export const ITP_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
  'subcontractor_admin',
  'subcontractor',
];

export const ITP_MANAGE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
];

export const ITP_VERIFY_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'superintendent',
];

const ITP_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

export function isItpSubcontractorUser(user: AuthUser): boolean {
  return ITP_SUBCONTRACTOR_ROLES.has(user.role);
}

async function getEffectiveItpProjectRole(
  user: AuthUser,
  projectId: string,
): Promise<string | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { roleInCompany: true, companyId: true },
  });

  if (!dbUser) {
    return null;
  }
  const isSubcontractor = isItpSubcontractorUser(user);

  if (!isSubcontractor && (dbUser.roleInCompany === 'owner' || dbUser.roleInCompany === 'admin')) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });

    if (project?.companyId === dbUser.companyId) {
      return dbUser.roleInCompany;
    }
  }

  const projectUser = isSubcontractor
    ? null
    : await prisma.projectUser.findFirst({
        where: {
          projectId,
          userId: user.userId,
          status: 'active',
        },
        select: { role: true },
      });

  if (projectUser) {
    return projectUser.role;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { role: true },
  });

  return subcontractorUser ? dbUser.roleInCompany : null;
}

export async function requireItpProjectAccess(user: AuthUser, projectId: string): Promise<void> {
  if (!(await checkProjectAccess(user.userId, projectId))) {
    throw AppError.forbidden('Access denied');
  }

  await requireSubcontractorPortalModuleAccess({
    userId: user.userId,
    role: user.role,
    projectId,
    module: 'itps',
  });
}

export async function getAssignedItpSubcontractorLotIds(
  user: AuthUser,
  projectId: string,
): Promise<string[] | null> {
  if (!isItpSubcontractorUser(user)) {
    return null;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  if (!subcontractorUser) {
    return [];
  }

  const [assignments, legacyLots] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active',
      },
      select: { lotId: true },
    }),
    prisma.lot.findMany({
      where: {
        projectId,
        assignedSubcontractorId: subcontractorUser.subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return [
    ...new Set([
      ...assignments.map((assignment) => assignment.lotId),
      ...legacyLots.map((lot) => lot.id),
    ]),
  ];
}

export async function requireItpLotAccess(
  user: AuthUser,
  projectId: string,
  lotId: string,
  message = 'Access denied',
): Promise<void> {
  await requireItpProjectAccess(user, projectId);

  const assignedLotIds = await getAssignedItpSubcontractorLotIds(user, projectId);
  if (assignedLotIds !== null && !assignedLotIds.includes(lotId)) {
    throw AppError.forbidden(message);
  }
}

export async function requireItpProjectRole(
  user: AuthUser,
  projectId: string,
  allowedRoles: string[],
  message: string,
): Promise<string> {
  await requireItpProjectAccess(user, projectId);

  const effectiveRole = await getEffectiveItpProjectRole(user, projectId);
  if (!effectiveRole || !allowedRoles.includes(effectiveRole)) {
    throw AppError.forbidden(message);
  }

  return effectiveRole;
}

export async function requireItpLotRole(
  user: AuthUser,
  projectId: string,
  lotId: string,
  allowedRoles: string[],
  message: string,
): Promise<string> {
  const role = await requireItpProjectRole(user, projectId, allowedRoles, message);

  const assignedLotIds = await getAssignedItpSubcontractorLotIds(user, projectId);
  if (assignedLotIds !== null && !assignedLotIds.includes(lotId)) {
    throw AppError.forbidden(message);
  }

  return role;
}

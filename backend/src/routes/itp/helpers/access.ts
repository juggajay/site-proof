import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/AppError.js';
import {
  activeSubcontractorCompanyWhere,
  assertProjectAllowsWrite,
  checkProjectAccess,
  isStandaloneSubcontractorPortalIdentity,
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

export function isItpSubcontractorUser(user: AuthUser): boolean {
  return isStandaloneSubcontractorPortalIdentity({
    companyId: user.companyId,
    roleInCompany: user.role,
  });
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

  const subcontractorUsers = await prisma.subcontractorUser.findMany({
    where: {
      userId: user.userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  const subcontractorCompanyIds = subcontractorUsers.map((link) => link.subcontractorCompanyId);
  if (subcontractorCompanyIds.length === 0) {
    return [];
  }

  const [assignments, legacyLots] = await Promise.all([
    prisma.lotSubcontractorAssignment.findMany({
      where: {
        projectId,
        subcontractorCompanyId: { in: subcontractorCompanyIds },
        status: 'active',
      },
      select: { lotId: true },
    }),
    prisma.lot.findMany({
      where: {
        projectId,
        assignedSubcontractorId: { in: subcontractorCompanyIds },
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

  await assertProjectAllowsWrite(projectId);

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

export async function requireItpSubcontractorCompletionPermission(
  user: AuthUser,
  projectId: string,
  lotId: string,
  message = 'Not authorized to complete ITP items on this lot',
): Promise<{
  itpRequiresVerification: boolean;
  subcontractorCompany: { id: string; companyName: string };
} | null> {
  if (!isItpSubcontractorUser(user)) {
    return null;
  }

  const assignments = await prisma.lotSubcontractorAssignment.findMany({
    where: {
      projectId,
      lotId,
      status: 'active',
      canCompleteITP: true,
      subcontractorCompany: activeSubcontractorCompanyWhere({
        projectId,
        users: { some: { userId: user.userId } },
      }),
    },
    select: {
      itpRequiresVerification: true,
      subcontractorCompany: {
        select: { id: true, companyName: true },
      },
    },
  });

  if (assignments.length === 0) {
    throw AppError.forbidden(message);
  }

  await assertProjectAllowsWrite(projectId);

  if (assignments.length === 1) {
    return assignments[0];
  }

  return {
    itpRequiresVerification: assignments.some((assignment) => assignment.itpRequiresVerification),
    subcontractorCompany: {
      id: assignments.map((assignment) => assignment.subcontractorCompany.id).join(','),
      companyName: 'Multiple subcontractors',
    },
  };
}

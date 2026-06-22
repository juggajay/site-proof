import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { ROLE_GROUPS, hasRoleInGroup } from '../../lib/roles.js';
import {
  activeSubcontractorCompanyWhere,
  getEffectiveProjectRole,
  isStandaloneSubcontractorPortalIdentity,
  requireProjectRoleExcludingSubcontractors as requireProjectRole,
  requireSubcontractorPortalModuleAccess,
  type SubcontractorPortalAccessKey,
} from '../../lib/projectAccess.js';

export type AuthenticatedUser = NonNullable<Request['user']>;

function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return isStandaloneSubcontractorPortalIdentity(user);
}

function canViewLotBudget(role: string | null): boolean {
  return role !== null && hasRoleInGroup(role, ROLE_GROUPS.COMMERCIAL);
}

async function requireSubcontractorLotPortalModules(
  user: AuthenticatedUser,
  projectId: string,
  modules: SubcontractorPortalAccessKey[] = [],
): Promise<void> {
  const modulesToEnforce = [...new Set<SubcontractorPortalAccessKey>(['lots', ...modules])];

  for (const module of modulesToEnforce) {
    await requireSubcontractorPortalModuleAccess({
      userId: user.id,
      role: user.roleInCompany,
      projectId,
      module,
    });
  }
}

async function getProjectSubcontractorCompanyId(
  userId: string,
  projectId: string,
): Promise<string | null> {
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  return subcontractorUser?.subcontractorCompanyId ?? null;
}

async function hasAssignedSubcontractorLotAccess(
  user: AuthenticatedUser,
  projectId: string,
  lotId: string,
): Promise<boolean> {
  if (!isSubcontractorUser(user)) {
    return true;
  }

  const subcontractorCompanyId = await getProjectSubcontractorCompanyId(user.id, projectId);
  if (!subcontractorCompanyId) {
    return false;
  }

  const [assignment, legacyLot] = await Promise.all([
    prisma.lotSubcontractorAssignment.findFirst({
      where: {
        projectId,
        lotId,
        subcontractorCompanyId,
        status: 'active',
      },
      select: { id: true },
    }),
    prisma.lot.findFirst({
      where: {
        id: lotId,
        projectId,
        assignedSubcontractorId: subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return Boolean(assignment || legacyLot);
}

async function requireLotReadAccess(
  lot: { id: string; projectId: string },
  user: AuthenticatedUser,
  message = 'You do not have access to this lot',
): Promise<void> {
  if (isSubcontractorUser(user)) {
    if (!(await hasAssignedSubcontractorLotAccess(user, lot.projectId, lot.id))) {
      throw AppError.forbidden(message);
    }
    return;
  }

  const role = await getEffectiveProjectRole(user, lot.projectId, {
    excludeSubcontractorProjectMemberships: true,
    throwIfProjectMissing: true,
  });
  if (!role) {
    throw AppError.forbidden(message);
  }
}

export {
  isSubcontractorUser,
  canViewLotBudget,
  requireSubcontractorLotPortalModules,
  requireProjectRole,
  getProjectSubcontractorCompanyId,
  hasAssignedSubcontractorLotAccess,
  requireLotReadAccess,
};

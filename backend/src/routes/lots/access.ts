import type { Request } from 'express';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import { ROLE_GROUPS, hasRoleInGroup } from '../../lib/roles.js';
import {
  getActiveSubcontractorPortalCompanyLinksForProject,
  getEffectiveProjectRole,
  hasPortalModuleEnabled,
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
  return (await getProjectSubcontractorCompanyIds(userId, projectId))[0] ?? null;
}

async function getProjectSubcontractorCompanyIds(
  userId: string,
  projectId: string,
  modules: SubcontractorPortalAccessKey[] = ['lots'],
  requestedSubcontractorCompanyId?: string | null,
): Promise<string[]> {
  const links = await getActiveSubcontractorPortalCompanyLinksForProject({ userId, projectId });
  const accessibleIds = [
    ...new Set(
      links
        .filter((link) =>
          modules.every((module) =>
            hasPortalModuleEnabled(link.subcontractorCompany.portalAccess, module),
          ),
        )
        .map((link) => link.subcontractorCompanyId),
    ),
  ];

  if (!requestedSubcontractorCompanyId) {
    return accessibleIds;
  }

  if (!accessibleIds.includes(requestedSubcontractorCompanyId)) {
    throw AppError.forbidden('Access denied');
  }

  return [requestedSubcontractorCompanyId];
}

async function hasAssignedSubcontractorLotAccess(
  user: AuthenticatedUser,
  projectId: string,
  lotId: string,
  modules: SubcontractorPortalAccessKey[] = ['lots'],
): Promise<boolean> {
  if (!isSubcontractorUser(user)) {
    return true;
  }

  const subcontractorCompanyIds = await getProjectSubcontractorCompanyIds(
    user.id,
    projectId,
    modules,
  );
  if (subcontractorCompanyIds.length === 0) {
    return false;
  }

  const [assignment, legacyLot] = await Promise.all([
    prisma.lotSubcontractorAssignment.findFirst({
      where: {
        projectId,
        lotId,
        subcontractorCompanyId: { in: subcontractorCompanyIds },
        status: 'active',
      },
      select: { id: true },
    }),
    prisma.lot.findFirst({
      where: {
        id: lotId,
        projectId,
        assignedSubcontractorId: { in: subcontractorCompanyIds },
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
  modules: SubcontractorPortalAccessKey[] = ['lots'],
): Promise<void> {
  if (isSubcontractorUser(user)) {
    if (!(await hasAssignedSubcontractorLotAccess(user, lot.projectId, lot.id, modules))) {
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
  getProjectSubcontractorCompanyIds,
  hasAssignedSubcontractorLotAccess,
  requireLotReadAccess,
};

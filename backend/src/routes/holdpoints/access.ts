import type { Request } from 'express';
import { AppError } from '../../lib/AppError.js';
import { prisma } from '../../lib/prisma.js';
import {
  activeSubcontractorCompanyWhere,
  checkProjectAccess,
  getEffectiveProjectRole,
  isSubcontractorPortalRole,
  requireInternalProjectAccess,
  requireProjectRoleExcludingSubcontractors as requireProjectRole,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';

export { requireProjectRole };

// =============================================================================
// Hold point access-control helpers: subcontractor detection, project/lot/hold
// point read-access guards, release-eligibility and role checks. Extracted
// verbatim from holdpoints.ts to preserve exact role sets, AppError messages,
// portal-module enforcement, assigned-lot checks, and project-missing behavior.
// =============================================================================

export type AuthenticatedUser = NonNullable<Request['user']>;
export type LotAccessTarget = { id: string; projectId: string };
export type HoldPointAccessTarget = { lot: LotAccessTarget };

export const HP_REQUEST_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'site_manager',
  'site_engineer',
  'foreman',
  'quality_manager',
];

export function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return isSubcontractorPortalRole(user.roleInCompany);
}

export async function requireProjectReadAccess(
  projectId: string,
  user: AuthenticatedUser,
  message = 'You do not have access to this project',
) {
  const hasAccess = await checkProjectAccess(user.id, projectId);
  if (!hasAccess) {
    throw AppError.forbidden(message);
  }
}

export async function requireHoldPointsPortalAccess(projectId: string, user: AuthenticatedUser) {
  await requireSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: 'holdPoints',
  });
}

export async function requireInternalProjectReadAccess(
  projectId: string,
  user: AuthenticatedUser,
  message = 'You do not have access to this project',
) {
  await requireInternalProjectAccess(user, projectId, message);
}

export async function canRequestHoldPointRelease(
  projectId: string,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (isSubcontractorUser(user)) {
    return false;
  }

  const role = await getEffectiveProjectRole(user, projectId, {
    excludeSubcontractorProjectMemberships: true,
    throwIfProjectMissing: true,
  });
  return Boolean(role && HP_REQUEST_ROLES.includes(role));
}

export async function hasAssignedSubcontractorLotAccess(
  projectId: string,
  lotId: string,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (!isSubcontractorUser(user)) {
    return true;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.id,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  if (!subcontractorUser) {
    return false;
  }

  const [assignment, legacyLot] = await Promise.all([
    prisma.lotSubcontractorAssignment.findFirst({
      where: {
        projectId,
        lotId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active',
      },
      select: { id: true },
    }),
    prisma.lot.findFirst({
      where: {
        id: lotId,
        projectId,
        assignedSubcontractorId: subcontractorUser.subcontractorCompanyId,
      },
      select: { id: true },
    }),
  ]);

  return Boolean(assignment || legacyLot);
}

export async function requireLotReadAccess(
  lot: LotAccessTarget,
  user: AuthenticatedUser,
  message = 'You do not have access to this lot',
) {
  await requireProjectReadAccess(lot.projectId, user, message);
  await requireHoldPointsPortalAccess(lot.projectId, user);

  if (!(await hasAssignedSubcontractorLotAccess(lot.projectId, lot.id, user))) {
    throw AppError.forbidden(message);
  }
}

export async function requireHoldPointReadAccess(
  holdPoint: HoldPointAccessTarget,
  user: AuthenticatedUser,
  message = 'You do not have access to this hold point',
) {
  await requireLotReadAccess(holdPoint.lot, user, message);
}

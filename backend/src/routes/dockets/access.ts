import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import {
  activeSubcontractorCompanyWhere,
  assertProjectAllowsWrite,
  checkProjectAccess,
  getEffectiveProjectRole,
  isCompanyAdminRole,
  isStandaloneSubcontractorPortalIdentity,
  isSubcontractorPortalRole,
} from '../../lib/projectAccess.js';

// =============================================================================
// Docket access control: role sets, request-user/resource types, and the
// project/docket/subcontractor access guards. Extracted verbatim from
// dockets.ts to keep the multi-tenant trust boundary identical
// (behavior-preserving) — same roles, AppError messages, subcontractor-company
// scoping, assigned-lot enforcement, and editable docket statuses.
// =============================================================================

// Roles that can approve dockets
export const DOCKET_APPROVERS = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'];
export const DOCKET_ENTRY_EDIT_STATUSES = new Set(['draft', 'queried', 'rejected']);

export type AuthUser = NonNullable<Express.Request['user']>;
export type DocketAccess = {
  projectId: string;
  subcontractorCompanyId: string;
};
export type DocketProjectReadScope = {
  subcontractorCompanyId?: string;
};

export function isSubcontractorUser(user: AuthUser): boolean {
  return isStandaloneSubcontractorPortalIdentity(user);
}

export function isDocketEntryEditable(status: string): boolean {
  return DOCKET_ENTRY_EDIT_STATUSES.has(status);
}

export function requireApprovedDocketResource(
  status: string,
  resourceName: 'Employee' | 'Plant',
): void {
  if (status !== 'approved') {
    throw AppError.badRequest(`${resourceName} must be approved before it can be used on a docket`);
  }
}

export async function hasLinkedSubcontractorCompany(
  userId: string,
  subcontractorCompanyId: string,
): Promise<boolean> {
  const count = await prisma.subcontractorUser.count({
    where: {
      userId,
      subcontractorCompanyId,
      subcontractorCompany: activeSubcontractorCompanyWhere(),
    },
  });
  return count > 0;
}

export async function getLinkedSubcontractorCompanyIdForProject(
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

export async function requireProjectReadAccess(
  user: AuthUser,
  projectId: string,
): Promise<DocketProjectReadScope> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { companyId: true },
  });

  if (!project) {
    throw AppError.forbidden('Access denied');
  }

  const hasSubcontractorRole = isSubcontractorPortalRole(user.roleInCompany);
  const isStandaloneSubcontractor = isSubcontractorUser(user);

  if (
    !hasSubcontractorRole &&
    isCompanyAdminRole(user.roleInCompany) &&
    project.companyId === user.companyId
  ) {
    return {};
  }

  if (!hasSubcontractorRole) {
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id,
        status: 'active',
      },
      select: { id: true },
    });

    if (projectUser) {
      return {};
    }
  }

  if (isStandaloneSubcontractor || !hasSubcontractorRole) {
    const subcontractorCompanyId = await getLinkedSubcontractorCompanyIdForProject(
      user.id,
      projectId,
    );
    if (subcontractorCompanyId) {
      return { subcontractorCompanyId };
    }
  } else if (hasSubcontractorRole) {
    throw AppError.forbidden('Access denied');
  }

  if (!(await checkProjectAccess(user.id, projectId))) {
    throw AppError.forbidden('Access denied');
  }

  return {};
}

export async function requireDocketApproverAccess(
  user: AuthUser,
  projectId: string,
): Promise<void> {
  const role = await getEffectiveProjectRole(user, projectId, {
    excludeSubcontractorProjectMemberships: true,
    throwIfProjectMissing: true,
  });
  if (!role || !DOCKET_APPROVERS.includes(role)) {
    throw AppError.forbidden('You do not have permission to perform this action.');
  }

  await assertProjectAllowsWrite(projectId);
}

export async function requireDocketReadAccess(user: AuthUser, docket: DocketAccess): Promise<void> {
  if (isSubcontractorPortalRole(user.roleInCompany) && !isSubcontractorUser(user)) {
    throw AppError.forbidden('Access denied');
  }

  if (isSubcontractorUser(user)) {
    if (!(await hasLinkedSubcontractorCompany(user.id, docket.subcontractorCompanyId))) {
      throw AppError.forbidden('Access denied');
    }
    return;
  }

  const scope = await requireProjectReadAccess(user, docket.projectId);
  if (
    scope.subcontractorCompanyId &&
    scope.subcontractorCompanyId !== docket.subcontractorCompanyId
  ) {
    throw AppError.forbidden('Access denied');
  }
}

export async function requireDocketSubcontractorAccess(
  user: AuthUser,
  docket: DocketAccess,
): Promise<void> {
  if (
    !isSubcontractorUser(user) ||
    !(await hasLinkedSubcontractorCompany(user.id, docket.subcontractorCompanyId))
  ) {
    throw AppError.forbidden('Only the linked subcontractor can modify this docket');
  }

  await assertProjectAllowsWrite(docket.projectId);
}

export async function requireLotAllocationsInProject(
  projectId: string,
  subcontractorCompanyId: string,
  lotAllocations?: Array<{ lotId: string }>,
): Promise<void> {
  const lotIds = [...new Set(lotAllocations?.map((alloc) => alloc.lotId) ?? [])];
  if (lotIds.length === 0) return;

  const lotCount = await prisma.lot.count({
    where: {
      id: { in: lotIds },
      projectId,
    },
  });

  if (lotCount !== lotIds.length) {
    throw AppError.badRequest('All lot allocations must belong to the docket project');
  }

  const assignedLotCount = await prisma.lot.count({
    where: {
      id: { in: lotIds },
      projectId,
      OR: [
        { assignedSubcontractorId: subcontractorCompanyId },
        {
          subcontractorAssignments: {
            some: {
              projectId,
              subcontractorCompanyId,
              status: 'active',
            },
          },
        },
      ],
    },
  });

  if (assignedLotCount !== lotIds.length) {
    throw AppError.forbidden('Docket lot allocations are limited to lots assigned to your company');
  }
}

import { prisma } from '../../lib/prisma.js';
import { type AuthUser } from '../../lib/auth.js';
import { AppError } from '../../lib/AppError.js';
import {
  activeSubcontractorCompanyWhere,
  hasSubcontractorPortalModuleAccess,
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';

type ProjectRoleAccess = {
  id: string;
  role: string;
};

type NcrReadAccessRecord = {
  projectId: string;
  responsibleUserId: string | null;
  responsibleSubcontractorId: string | null;
  ncrLots?: Array<{ lotId: string }>;
};

const COMPANY_PROJECT_ROLES = new Set(['owner', 'admin']);
const SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const MAX_NCR_ROUTE_PARAM_LENGTH = 120;

export function parseNcrRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_NCR_ROUTE_PARAM_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

async function getCompanyRoleProjectAccess(
  projectId: string,
  userId: string,
): Promise<ProjectRoleAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, roleInCompany: true },
  });

  if (!user?.companyId || !COMPANY_PROJECT_ROLES.has(user.roleInCompany)) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: user.companyId },
    select: { id: true },
  });

  return project ? { id: `company-role:${user.roleInCompany}`, role: user.roleInCompany } : null;
}

export async function requireActiveProjectUser(
  projectId: string,
  user: AuthUser,
  message = 'Access denied',
  roles?: string[],
) {
  const companyRoleAccess = await getCompanyRoleProjectAccess(projectId, user.userId);
  if (companyRoleAccess && (!roles || roles.includes(companyRoleAccess.role))) {
    return companyRoleAccess;
  }

  const userDetails = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { roleInCompany: true },
  });
  const isSubcontractor = SUBCONTRACTOR_ROLES.has(userDetails?.roleInCompany || '');
  if (isSubcontractor) {
    await requireSubcontractorPortalModuleAccess({
      userId: user.userId,
      role: userDetails?.roleInCompany,
      projectId,
      module: 'ncrs',
    });
    throw AppError.forbidden(message);
  }

  const projectUser = await prisma.projectUser.findFirst({
    where: {
      projectId,
      userId: user.userId,
      status: 'active',
      ...(roles ? { role: { in: roles } } : {}),
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!projectUser) {
    throw AppError.forbidden(message);
  }

  return projectUser;
}

export async function canReadNcr(ncr: NcrReadAccessRecord, user: AuthUser): Promise<boolean> {
  const userDetails = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { roleInCompany: true },
  });

  const isSubcontractor = SUBCONTRACTOR_ROLES.has(userDetails?.roleInCompany || '');
  if (!isSubcontractor) {
    if (await getCompanyRoleProjectAccess(ncr.projectId, user.userId)) {
      return true;
    }

    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId: ncr.projectId,
        userId: user.userId,
        status: 'active',
      },
      select: { id: true },
    });

    return Boolean(projectUser);
  }

  if (
    !(await hasSubcontractorPortalModuleAccess({
      userId: user.userId,
      role: userDetails?.roleInCompany,
      projectId: ncr.projectId,
      module: 'ncrs',
    }))
  ) {
    return false;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId: ncr.projectId }),
    },
    select: { subcontractorCompanyId: true },
  });

  if (!subcontractorUser) {
    return false;
  }

  if (
    ncr.responsibleUserId === user.userId ||
    ncr.responsibleSubcontractorId === subcontractorUser.subcontractorCompanyId
  ) {
    return true;
  }

  const ncrLotIds = ncr.ncrLots?.map((ncrLot) => ncrLot.lotId) || [];
  if (ncrLotIds.length === 0) {
    return false;
  }

  const assignment = await prisma.lotSubcontractorAssignment.findFirst({
    where: {
      projectId: ncr.projectId,
      subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
      status: 'active',
      lotId: { in: ncrLotIds },
    },
    select: { id: true },
  });

  if (assignment) {
    return true;
  }

  const legacyLot = await prisma.lot.findFirst({
    where: {
      projectId: ncr.projectId,
      assignedSubcontractorId: subcontractorUser.subcontractorCompanyId,
      id: { in: ncrLotIds },
    },
    select: { id: true },
  });

  return Boolean(legacyLot);
}

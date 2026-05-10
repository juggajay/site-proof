import { prisma } from './prisma.js';
import type { Prisma } from '@prisma/client';
import { AppError } from './AppError.js';

export const BLOCKED_SUBCONTRACTOR_STATUSES = ['suspended', 'removed'];

export type SubcontractorPortalAccessKey =
  | 'lots'
  | 'itps'
  | 'holdPoints'
  | 'testResults'
  | 'ncrs'
  | 'documents';

type PortalAccessRecord = Record<SubcontractorPortalAccessKey, boolean>;

const SUBCONTRACTOR_PORTAL_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const PORTAL_ACCESS_LABELS: Record<SubcontractorPortalAccessKey, string> = {
  lots: 'Assigned work',
  itps: 'ITPs',
  holdPoints: 'Hold points',
  testResults: 'Test results',
  ncrs: 'NCRs',
  documents: 'Documents',
};

export const DEFAULT_SUBCONTRACTOR_PORTAL_ACCESS: PortalAccessRecord = {
  lots: true,
  itps: false,
  holdPoints: false,
  testResults: false,
  ncrs: false,
  documents: false,
};

export function activeSubcontractorCompanyWhere(
  where: Prisma.SubcontractorCompanyWhereInput = {},
): Prisma.SubcontractorCompanyWhereInput {
  const activeStatusWhere: Prisma.SubcontractorCompanyWhereInput = {
    status: { notIn: BLOCKED_SUBCONTRACTOR_STATUSES },
  };

  if (Object.keys(where).length === 0) {
    return activeStatusWhere;
  }

  return {
    AND: [where, activeStatusWhere],
  };
}

function isPortalAccessKey(value: string): value is SubcontractorPortalAccessKey {
  return value in DEFAULT_SUBCONTRACTOR_PORTAL_ACCESS;
}

function readPortalAccess(value: Prisma.JsonValue | null | undefined): PortalAccessRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_SUBCONTRACTOR_PORTAL_ACCESS;
  }

  const access = { ...DEFAULT_SUBCONTRACTOR_PORTAL_ACCESS };
  for (const [key, enabled] of Object.entries(value)) {
    if (isPortalAccessKey(key) && typeof enabled === 'boolean') {
      access[key] = enabled;
    }
  }

  return access;
}

export function isSubcontractorPortalRole(role: string | null | undefined): boolean {
  return SUBCONTRACTOR_PORTAL_ROLES.has(role || '');
}

export function hasPortalModuleEnabled(
  portalAccess: Prisma.JsonValue | null | undefined,
  module: SubcontractorPortalAccessKey,
): boolean {
  return readPortalAccess(portalAccess)[module];
}

export async function hasSubcontractorPortalModuleAccess({
  userId,
  role,
  projectId,
  module,
}: {
  userId: string;
  role: string | null | undefined;
  projectId: string;
  module: SubcontractorPortalAccessKey;
}): Promise<boolean> {
  if (!isSubcontractorPortalRole(role)) {
    return true;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: {
      subcontractorCompany: {
        select: { portalAccess: true },
      },
    },
  });

  if (!subcontractorUser) {
    return false;
  }

  return hasPortalModuleEnabled(subcontractorUser.subcontractorCompany.portalAccess, module);
}

export async function requireSubcontractorPortalModuleAccess(args: {
  userId: string;
  role: string | null | undefined;
  projectId: string;
  module: SubcontractorPortalAccessKey;
}): Promise<void> {
  if (!(await hasSubcontractorPortalModuleAccess(args))) {
    throw AppError.forbidden(
      `${PORTAL_ACCESS_LABELS[args.module]} portal access is not enabled for this subcontractor`,
    );
  }
}

/**
 * Check if a user has access to a project.
 * - Admin/owner users can access any project in their company.
 * - Other users need an active ProjectUser record.
 * - Subcontractor users get access via SubcontractorUser + an active project link.
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;
  const isSubcontractor = isSubcontractorPortalRole(user.roleInCompany);

  // Admin/owner users can access all projects in their company
  if (!isSubcontractor && (user.roleInCompany === 'admin' || user.roleInCompany === 'owner')) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.companyId === user.companyId) {
      return true;
    }
  }

  // Check explicit active project membership
  if (!isSubcontractor) {
    const projectUser = await prisma.projectUser.findFirst({
      where: {
        projectId,
        userId,
        status: 'active',
      },
    });
    if (projectUser) return true;
  }

  // Check subcontractor access
  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
    },
    select: { id: true },
  });

  return Boolean(subcontractorUser);
}

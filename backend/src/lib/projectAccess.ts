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
  itps: true,
  holdPoints: true,
  testResults: true,
  ncrs: false,
  documents: true,
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

export function isCompanyAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'owner';
}

export function isStandaloneSubcontractorPortalIdentity(user: {
  companyId?: string | null;
  roleInCompany?: string | null;
}): boolean {
  return !user.companyId && isSubcontractorPortalRole(user.roleInCompany);
}

type EffectiveProjectRoleUser = {
  id: string;
  companyId?: string | null;
  roleInCompany?: string | null;
};

type EffectiveProjectRoleClient = Pick<typeof prisma, 'project' | 'projectUser'>;
type ProjectStatusWriteClient = Pick<typeof prisma, 'project'>;
type ProjectRoleCollection = ReadonlySet<string> | readonly string[];

export const ARCHIVED_PROJECT_READ_ONLY_MESSAGE =
  'Archived projects are read-only. Reactivate the project before making changes.';

export function assertProjectStatusAllowsWrite(project: { status?: string | null }): void {
  if (project.status === 'archived') {
    throw AppError.conflict(ARCHIVED_PROJECT_READ_ONLY_MESSAGE);
  }
}

export async function assertProjectAllowsWrite(
  projectId: string,
  client: ProjectStatusWriteClient = prisma,
): Promise<void> {
  const project = await client.project.findUnique({
    where: { id: projectId },
    select: { status: true },
  });

  if (!project) {
    throw AppError.notFound('Project');
  }

  assertProjectStatusAllowsWrite(project);
}

export async function getEffectiveProjectRole(
  user: EffectiveProjectRoleUser,
  projectId: string,
  {
    client = prisma,
    excludeSubcontractorProjectMemberships = false,
    throwIfProjectMissing = false,
  }: {
    client?: EffectiveProjectRoleClient;
    excludeSubcontractorProjectMemberships?: boolean;
    throwIfProjectMissing?: boolean;
  } = {},
): Promise<string | null> {
  const isSubcontractor = isSubcontractorPortalRole(user.roleInCompany);
  const canUseProjectMembership = !(excludeSubcontractorProjectMemberships && isSubcontractor);
  const [project, projectUser] = await Promise.all([
    client.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    }),
    canUseProjectMembership
      ? client.projectUser.findFirst({
          where: {
            projectId,
            userId: user.id,
            status: 'active',
          },
          select: { role: true },
        })
      : Promise.resolve(null),
  ]);

  if (!project) {
    if (throwIfProjectMissing) {
      throw AppError.notFound('Project');
    }

    return projectUser?.role ?? null;
  }

  if (
    canUseProjectMembership &&
    isCompanyAdminRole(user.roleInCompany) &&
    project.companyId === user.companyId
  ) {
    return user.roleInCompany ?? null;
  }

  return projectUser?.role ?? null;
}

function isProjectRoleArray(roles: ProjectRoleCollection): roles is readonly string[] {
  return Array.isArray(roles);
}

function projectRoleCollectionIncludes(roles: ProjectRoleCollection, role: string): boolean {
  return isProjectRoleArray(roles) ? roles.includes(role) : roles.has(role);
}

export async function requireEffectiveProjectRole(
  user: EffectiveProjectRoleUser,
  projectId: string,
  allowedRoles: ProjectRoleCollection,
  message: string,
  {
    client = prisma,
    excludeSubcontractorProjectMemberships = false,
    requireWritable = false,
  }: {
    client?: EffectiveProjectRoleClient;
    excludeSubcontractorProjectMemberships?: boolean;
    requireWritable?: boolean;
  } = {},
): Promise<string> {
  const role = await getEffectiveProjectRole(user, projectId, {
    client,
    excludeSubcontractorProjectMemberships,
    throwIfProjectMissing: true,
  });

  if (!role || !projectRoleCollectionIncludes(allowedRoles, role)) {
    throw AppError.forbidden(message);
  }

  if (requireWritable) {
    await assertProjectAllowsWrite(projectId, client);
  }

  return role;
}

export async function requireInternalProjectAccess(
  user: EffectiveProjectRoleUser,
  projectId: string,
  message = 'You do not have access to this project',
): Promise<string> {
  if (isSubcontractorPortalRole(user.roleInCompany)) {
    throw AppError.forbidden(message);
  }

  const role = await getEffectiveProjectRole(user, projectId, {
    excludeSubcontractorProjectMemberships: true,
    throwIfProjectMissing: true,
  });

  if (!role || isSubcontractorPortalRole(role)) {
    throw AppError.forbidden(message);
  }

  return role;
}

export async function requireProjectRoleExcludingSubcontractors(
  projectId: string,
  user: EffectiveProjectRoleUser,
  allowedRoles: ProjectRoleCollection,
  message: string,
  options: { requireWritable?: boolean } = {},
): Promise<string> {
  return requireEffectiveProjectRole(user, projectId, allowedRoles, message, {
    excludeSubcontractorProjectMemberships: true,
    requireWritable: options.requireWritable,
  });
}

export async function hasActiveSubcontractorPortalIdentity(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, roleInCompany: true },
  });

  if (!user || !isStandaloneSubcontractorPortalIdentity(user)) {
    return false;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId,
      subcontractorCompany: activeSubcontractorCompanyWhere(),
    },
    select: { id: true },
  });

  return Boolean(subcontractorUser);
}

export function hasPortalModuleEnabled(
  portalAccess: Prisma.JsonValue | null | undefined,
  module: SubcontractorPortalAccessKey,
): boolean {
  return readPortalAccess(portalAccess)[module];
}

export function getSubcontractorPortalModuleAccessDeniedMessage(
  module: SubcontractorPortalAccessKey,
): string {
  return `${PORTAL_ACCESS_LABELS[module]} portal access is not enabled for this subcontractor`;
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, roleInCompany: true },
  });

  if (!user || !isStandaloneSubcontractorPortalIdentity(user)) {
    return false;
  }

  const subcontractorUsers = await prisma.subcontractorUser.findMany({
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

  return subcontractorUsers.some((subcontractorUser) =>
    hasPortalModuleEnabled(subcontractorUser.subcontractorCompany.portalAccess, module),
  );
}

export async function requireSubcontractorPortalModuleAccess(args: {
  userId: string;
  role: string | null | undefined;
  projectId: string;
  module: SubcontractorPortalAccessKey;
}): Promise<void> {
  if (!(await hasSubcontractorPortalModuleAccess(args))) {
    throw AppError.forbidden(getSubcontractorPortalModuleAccessDeniedMessage(args.module));
  }
}

/**
 * Ensure a subcontractor company can see NCRs in their portal.
 *
 * The `ncrs` portal module is opt-in and defaults OFF (unlike the other
 * modules), because an NCR is a non-conformance against the subcontractor's own
 * work. But assigning an NCR to a subcontractor IS the head contractor's intent
 * to share it — so the first time one is assigned we auto-enable their NCR
 * portal access (preserving every other module flag). Without this the assigned
 * subcontractor silently can't see the NCR.
 *
 * Idempotent: a no-op (no write) when the module is already enabled or the
 * company no longer exists. Returns true only when access was newly enabled, so
 * the caller can audit-log the permission change.
 */
export async function ensureSubcontractorNcrPortalAccess(
  subcontractorCompanyId: string,
): Promise<boolean> {
  const company = await prisma.subcontractorCompany.findUnique({
    where: { id: subcontractorCompanyId },
    select: { portalAccess: true },
  });

  if (!company) {
    return false;
  }

  const access = readPortalAccess(company.portalAccess);
  if (access.ncrs) {
    return false;
  }

  await prisma.subcontractorCompany.update({
    where: { id: subcontractorCompanyId },
    data: { portalAccess: { ...access, ncrs: true } },
  });

  return true;
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
  const isStandaloneSubcontractor = isStandaloneSubcontractorPortalIdentity(user);

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
  if (isStandaloneSubcontractor) {
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: {
        userId,
        subcontractorCompany: activeSubcontractorCompanyWhere({ projectId }),
      },
      select: { id: true },
    });

    return Boolean(subcontractorUser);
  }

  return false;
}

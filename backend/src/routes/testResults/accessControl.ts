import type { Request } from 'express';
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
  requireSubcontractorPortalModuleAccess,
} from '../../lib/projectAccess.js';

/**
 * Test-result access-control helpers, extracted verbatim from
 * backend/src/routes/testResults.ts (testResults refactor map — final slice).
 *
 * This module is the multi-tenant trust boundary for the test-results routes:
 * the role-policy arrays (who may create / verify / delete) plus every
 * require* / get* helper that gates project read access, subcontractor-portal
 * module access, subbie lot-scoping, and per-verb project roles. Behaviour is
 * identical to the inline version — same Prisma queries, same
 * AppError.forbidden / AppError.badRequest messages, same tenant scoping — so
 * the HTTP 403 / 400 responses are unchanged. The route handlers still own all
 * DB fetch + response logic; they call these.
 */

// Roles that can create/edit test results
export const TEST_CREATORS = [
  'owner',
  'admin',
  'project_manager',
  'site_engineer',
  'quality_manager',
  'foreman',
];
// Roles that can verify test results
export const TEST_VERIFIERS = ['owner', 'admin', 'project_manager', 'quality_manager'];
// Roles that can delete test results
export const TEST_DELETERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

export type AuthenticatedUser = NonNullable<Request['user']>;
export type TestResultAccessTarget = { projectId: string; lotId?: string | null };

export function isCompanyAdmin(user: AuthenticatedUser): boolean {
  return isCompanyAdminRole(user.roleInCompany);
}

export function isSubcontractorUser(user: AuthenticatedUser): boolean {
  return isStandaloneSubcontractorPortalIdentity(user);
}

export async function getReadableProjectIds(user: AuthenticatedUser): Promise<string[]> {
  if (isSubcontractorPortalRole(user.roleInCompany) && !isSubcontractorUser(user)) {
    return [];
  }

  const isSubcontractor = isSubcontractorUser(user);
  const [projectUsers, companyProjects, subcontractorCompanies] = await Promise.all([
    isSubcontractor
      ? Promise.resolve([])
      : prisma.projectUser.findMany({
          where: { userId: user.id, status: 'active' },
          select: { projectId: true },
        }),
    !isSubcontractor && isCompanyAdmin(user) && user.companyId
      ? prisma.project.findMany({
          where: { companyId: user.companyId },
          select: { id: true },
        })
      : Promise.resolve([]),
    isSubcontractor
      ? prisma.subcontractorCompany.findMany({
          where: activeSubcontractorCompanyWhere({ users: { some: { userId: user.id } } }),
          select: { projectId: true },
        })
      : Promise.resolve([]),
  ]);

  return [
    ...new Set([
      ...projectUsers.map((projectUser) => projectUser.projectId),
      ...companyProjects.map((project) => project.id),
      ...subcontractorCompanies.map((subcontractorCompany) => subcontractorCompany.projectId),
    ]),
  ];
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

export async function requireTestResultsPortalAccess(projectId: string, user: AuthenticatedUser) {
  await requireSubcontractorPortalModuleAccess({
    userId: user.id,
    role: user.roleInCompany,
    projectId,
    module: 'testResults',
  });
}

export async function getAssignedSubcontractorLotIds(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string[] | null> {
  if (!isSubcontractorUser(user)) {
    return null;
  }

  const subcontractorUser = await prisma.subcontractorUser.findFirst({
    where: {
      userId: user.id,
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

export async function hasAssignedSubcontractorLotAccess(
  projectId: string,
  lotId: string | null | undefined,
  user: AuthenticatedUser,
): Promise<boolean> {
  if (!lotId) {
    return !isSubcontractorUser(user);
  }

  const assignedLotIds = await getAssignedSubcontractorLotIds(projectId, user);
  return assignedLotIds === null || assignedLotIds.includes(lotId);
}

export async function requireTestResultReadAccess(
  testResult: TestResultAccessTarget,
  user: AuthenticatedUser,
  message = 'You do not have access to this test result',
) {
  await requireProjectReadAccess(testResult.projectId, user, message);
  await requireTestResultsPortalAccess(testResult.projectId, user);

  if (!(await hasAssignedSubcontractorLotAccess(testResult.projectId, testResult.lotId, user))) {
    throw AppError.forbidden(message);
  }
}

export async function requireTestProjectRole(
  projectId: string,
  user: AuthenticatedUser,
  allowedRoles: string[],
  message: string,
): Promise<string> {
  const role = await getEffectiveProjectRole(user, projectId, {
    excludeSubcontractorProjectMemberships: true,
    throwIfProjectMissing: true,
  });

  if (!role || !allowedRoles.includes(role)) {
    throw AppError.forbidden(message);
  }

  await assertProjectAllowsWrite(projectId);

  return role;
}

export async function requireLotInProject(lotId: string, projectId: string) {
  const lot = await prisma.lot.findFirst({
    where: { id: lotId, projectId },
    select: { id: true },
  });

  if (!lot) {
    throw AppError.badRequest('Lot not found or does not belong to this project');
  }
}

import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/AppError.js';
import {
  getEffectiveProjectRole,
  hasSubcontractorPortalModuleAccess,
  isStandaloneSubcontractorPortalIdentity,
} from '../../lib/projectAccess.js';
import { getSubcontractorAlertPortalTarget } from './links.js';

// =============================================================================
// Notification access control: admin/subcontractor role checks, the
// non-production diagnostics guard, project read/admin access guards, alert
// receivability, the manageable/accessible active-project resolvers, and the
// alert access/resolve guards. Extracted verbatim from notifications.ts to keep
// the multi-tenant trust boundary identical (behavior-preserving) — same role
// lists, AppError messages, subcontractor portal module checks, project access
// behavior, alert access behavior, and return shapes.
// =============================================================================

export type AuthUser = NonNullable<Express.Request['user']>;

// Minimal structural shape of an alert needed by the alert access guards. The
// full Alert interface (and alert creation/update logic) stays in
// notifications.ts; these guards only read assignedTo/escalatedTo/projectId.
export type AlertAccessTarget = {
  assignedTo: string;
  escalatedTo?: string[];
  projectId?: string;
};

export const NOTIFICATION_ADMIN_ROLES = ['owner', 'admin', 'project_manager'];
const SUBCONTRACTOR_NOTIFICATION_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

export function requireNotificationAdmin(user: AuthUser): void {
  if (!NOTIFICATION_ADMIN_ROLES.includes(user.roleInCompany)) {
    throw AppError.forbidden('Notification administration access required');
  }
}

export function requireNonProductionDiagnostics(): void {
  if (process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('Not available in production');
  }
}

export function isSubcontractorRole(role: string | null | undefined): boolean {
  return SUBCONTRACTOR_NOTIFICATION_ROLES.has(role || '');
}

export async function requireProjectReadAccess(user: AuthUser, projectId: string): Promise<string> {
  if (isSubcontractorRole(user.roleInCompany)) {
    throw AppError.forbidden('Internal notification access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || isSubcontractorRole(effectiveRole)) {
    throw AppError.forbidden('Access denied');
  }

  return effectiveRole;
}

export async function requireProjectNotificationAdminAccess(
  user: AuthUser,
  projectId: string,
): Promise<string> {
  if (isSubcontractorRole(user.roleInCompany)) {
    throw AppError.forbidden('Notification administration access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || !NOTIFICATION_ADMIN_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Notification administration access required');
  }

  return effectiveRole;
}

export async function canReceiveProjectAlert(
  userId: string,
  projectId: string,
  entityType: string,
): Promise<boolean> {
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { companyId: true, roleInCompany: true },
  });

  if (!targetUser) {
    return false;
  }

  if (isSubcontractorRole(targetUser.roleInCompany)) {
    if (!isStandaloneSubcontractorPortalIdentity(targetUser)) {
      return false;
    }

    const portalTarget = getSubcontractorAlertPortalTarget(entityType);
    if (!portalTarget) {
      return false;
    }

    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: {
        userId,
        subcontractorCompany: {
          projectId,
          status: 'approved',
        },
      },
      select: { id: true },
    });

    if (!subcontractorUser) {
      return false;
    }

    if (portalTarget === 'dockets') {
      return true;
    }

    return hasSubcontractorPortalModuleAccess({
      userId,
      role: targetUser.roleInCompany,
      projectId,
      module: portalTarget,
    });
  }

  if (targetUser.roleInCompany === 'owner' || targetUser.roleInCompany === 'admin') {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });

    if (project?.companyId === targetUser.companyId) {
      return true;
    }
  }

  const projectUser = await prisma.projectUser.findFirst({
    where: {
      projectId,
      userId,
      status: 'active',
    },
    select: { id: true },
  });

  if (projectUser) {
    return true;
  }

  return false;
}

export async function getManageableActiveProjectIds(
  user: AuthUser,
  specificProjectId?: string,
): Promise<string[]> {
  if (specificProjectId) {
    await requireProjectNotificationAdminAccess(user, specificProjectId);
    const project = await prisma.project.findFirst({
      where: { id: specificProjectId, status: 'active' },
      select: { id: true },
    });
    return project ? [project.id] : [];
  }

  if (isSubcontractorRole(user.roleInCompany)) {
    throw AppError.forbidden('Notification administration access required');
  }

  if ((user.roleInCompany === 'owner' || user.roleInCompany === 'admin') && user.companyId) {
    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }

  const projectUsers = await prisma.projectUser.findMany({
    where: {
      userId: user.id,
      status: 'active',
      role: { in: NOTIFICATION_ADMIN_ROLES },
      project: { status: 'active' },
    },
    select: { projectId: true },
  });

  if (projectUsers.length === 0) {
    throw AppError.forbidden('Notification administration access required');
  }

  return projectUsers.map((projectUser) => projectUser.projectId);
}

export async function getAccessibleActiveProjectIds(
  user: AuthUser,
  specificProjectId?: string,
): Promise<string[]> {
  if (specificProjectId) {
    await requireProjectReadAccess(user, specificProjectId);
    const project = await prisma.project.findFirst({
      where: { id: specificProjectId, status: 'active' },
      select: { id: true },
    });
    return project ? [project.id] : [];
  }

  if (isSubcontractorRole(user.roleInCompany)) {
    return [];
  }

  if ((user.roleInCompany === 'owner' || user.roleInCompany === 'admin') && user.companyId) {
    const projects = await prisma.project.findMany({
      where: { companyId: user.companyId, status: 'active' },
      select: { id: true },
    });
    return projects.map((project) => project.id);
  }

  const projectUsers = await prisma.projectUser.findMany({
    where: {
      userId: user.id,
      status: 'active',
      project: { status: 'active' },
    },
    select: { projectId: true },
  });

  return projectUsers.map((projectUser) => projectUser.projectId);
}

export async function requireAlertAccess(user: AuthUser, alert: AlertAccessTarget): Promise<void> {
  if (alert.assignedTo === user.id || alert.escalatedTo?.includes(user.id)) {
    return;
  }

  if (alert.projectId) {
    await requireProjectReadAccess(user, alert.projectId);
    return;
  }

  throw AppError.forbidden('Access denied');
}

export async function requireAlertResolveAccess(
  user: AuthUser,
  alert: AlertAccessTarget,
): Promise<void> {
  if (alert.assignedTo === user.id || alert.escalatedTo?.includes(user.id)) {
    return;
  }

  if (alert.projectId) {
    await requireProjectNotificationAdminAccess(user, alert.projectId);
    return;
  }

  throw AppError.forbidden('Alert resolution access required');
}

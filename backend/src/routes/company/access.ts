import { AppError } from '../../lib/AppError.js';
export { requireBrowserSession } from '../../middleware/browserSession.js';

export const COMPANY_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

export function requireCompanyAdmin(user: NonNullable<Express.Request['user']>): string {
  if (!user.companyId) {
    throw AppError.notFound('Company');
  }

  const allowedRoles = ['owner', 'admin'];
  if (!allowedRoles.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Only company owners and admins can update company settings');
  }

  return user.companyId;
}

export function isSubcontractorCompanyRole(user: NonNullable<Express.Request['user']>): boolean {
  return COMPANY_SUBCONTRACTOR_ROLES.has(user.roleInCompany || '');
}

const COMPANY_OWNER_MANAGED_ROLES = new Set(['owner', 'admin']);

/**
 * Enforce the company member-management role-rank rule: only the owner may
 * manage (change the role of, or remove) another admin or owner, and only the
 * owner may grant the `admin` role. A non-owner admin may manage members below
 * the admin tier but cannot demote/remove peer admins or mint new admins. The
 * owner is unrestricted here — owner-target moves are gated separately by the
 * transfer-ownership flow.
 */
export function assertActorMayManageCompanyMemberRole(params: {
  actorRole: string | null | undefined;
  targetCurrentRole: string | null | undefined;
  targetNewRole?: string | null;
}): void {
  if (params.actorRole === 'owner') {
    return;
  }

  if (params.targetCurrentRole && COMPANY_OWNER_MANAGED_ROLES.has(params.targetCurrentRole)) {
    throw AppError.forbidden('Only the company owner can manage other administrators');
  }

  if (params.targetNewRole === 'admin') {
    throw AppError.forbidden('Only the company owner can grant the admin role');
  }
}

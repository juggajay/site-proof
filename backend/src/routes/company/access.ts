import type { Request } from 'express';

import { AppError } from '../../lib/AppError.js';

export const COMPANY_SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

export function requireBrowserSession(req: Request, action: string): void {
  if (req.apiKey) {
    throw AppError.forbidden(`${action} requires an authenticated browser session`);
  }
}

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

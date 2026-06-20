import type { UserRole } from './types';

const NCR_CLOSE_ROLES = new Set([
  'owner',
  'admin',
  'project_manager',
  'site_manager',
  'quality_manager',
]);

export function canManageNcrClosure(userRole: UserRole | null): boolean {
  return Boolean(userRole && (userRole.isQualityManager || NCR_CLOSE_ROLES.has(userRole.role)));
}

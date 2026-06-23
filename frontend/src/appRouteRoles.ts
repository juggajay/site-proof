export const ADMIN_ROLES = ['owner', 'admin', 'project_manager'];
// Audit-log page roles: ADMIN_ROLES plus quality_manager, who can self-serve
// audit investigations scoped to their own projects (M75). The backend
// (auditLog.ts) enforces the project scoping.
export const AUDIT_LOG_PAGE_ROLES = [...ADMIN_ROLES, 'quality_manager'];
export const COMPANY_ADMIN_ROLES = ['owner', 'admin'];
export const COMMERCIAL_ROLES = ['owner', 'admin', 'project_manager'];
export const MANAGEMENT_ROLES = ['owner', 'admin', 'project_manager', 'site_manager'];
export const LOT_EDITOR_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_engineer',
];
export const SUBCONTRACTOR_ROLES = ['subcontractor', 'subcontractor_admin'];

export const INTERNAL_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'site_manager',
  'quality_manager',
  'site_engineer',
  'foreman',
];

export const REPORT_ROLES = [...INTERNAL_ROLES, 'viewer'];
export const PROJECT_WORKSPACE_ROLES = [...INTERNAL_ROLES, 'viewer'];

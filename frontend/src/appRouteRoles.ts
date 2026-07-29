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

// Wave D `D1c.3` — mirrors the backend's route-local `HANDOVER_EXPORT_REQUESTERS`
// (`backend/src/routes/handoverExports/access.ts:27`) exactly, and for the same
// reason it is a literal list there rather than a hierarchy check: the set that
// may spend the most expensive operation the product performs must not widen by
// accident when a role is inserted into ROLE_HIERARCHY.
export const HANDOVER_EXPORT_ROLES = ['owner', 'admin', 'project_manager', 'quality_manager'];

export const REPORT_ROLES = [...INTERNAL_ROLES, 'viewer'];
export const PROJECT_WORKSPACE_ROLES = [...INTERNAL_ROLES, 'viewer'];

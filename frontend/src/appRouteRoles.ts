export const ADMIN_ROLES = ['owner', 'admin', 'project_manager'];
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

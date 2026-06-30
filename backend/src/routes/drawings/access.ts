import { AppError } from '../../lib/AppError.js';
import { assertProjectAllowsWrite, getEffectiveProjectRole } from '../../lib/projectAccess.js';

const DRAWING_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
];
const SUBCONTRACTOR_DRAWING_ROLES = ['subcontractor_admin', 'subcontractor'];

type AuthUser = NonNullable<Express.Request['user']>;

export async function requireDrawingReadAccess(user: AuthUser, projectId: string): Promise<string> {
  if (SUBCONTRACTOR_DRAWING_ROLES.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Internal drawing access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || SUBCONTRACTOR_DRAWING_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Access denied');
  }

  return effectiveRole;
}

export async function requireDrawingWriteAccess(user: AuthUser, projectId: string): Promise<void> {
  const effectiveRole = await requireDrawingReadAccess(user, projectId);

  if (!DRAWING_WRITE_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Drawing write access required');
  }

  await assertProjectAllowsWrite(projectId);
}

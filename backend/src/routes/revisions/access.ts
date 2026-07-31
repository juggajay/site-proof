/**
 * Wave G G1 permission matrix (spec §1.4).
 *
 * Issue rights are PER CLASS, and each set matches a shipped precedent rather
 * than a new invention:
 *
 *  - `drawing` keeps `DRAWING_WRITE_ROLES` (`../drawings/access.ts:4-13`,
 *    seven roles including foreman). Superseding a drawing is a
 *    foreman-permitted action in shipped code today, and narrowing it under a
 *    governance feature would be an unrequested product change.
 *  - `itp_template` and the three Document-backed classes take
 *    `TEMPLATE_MANAGER_ROLES` (`../itp/templateAccess.ts:9-15`).
 *
 * The Document-backed classes deliberately do NOT copy `DOCUMENT_WRITE_ROLES`
 * (`../documents/access.ts:39-49`): that set includes `subcontractor_admin` and
 * `subcontractor` because it is an evidence-UPLOAD gate. Issuing a revision of a
 * specification is not uploading evidence, and nothing in G1 is exposed to
 * subcontractors.
 *
 * `ROLE_GROUPS.QUALITY` (`../../lib/roles.ts:78`) is deliberately unused here —
 * neither the drawings gate nor the template gate uses it either, and unifying
 * the three is its own PR with its own regression surface.
 */

import { AppError } from '../../lib/AppError.js';
import { assertProjectAllowsWrite, getEffectiveProjectRole } from '../../lib/projectAccess.js';
import { TEMPLATE_MANAGER_ROLES } from '../itp/templateAccess.js';
import type { GovernedEntityType } from '../../lib/revisionGovernance.js';

type AuthUser = NonNullable<Express.Request['user']>;

const SUBCONTRACTOR_ROLES = ['subcontractor_admin', 'subcontractor'];

/** `DRAWING_WRITE_ROLES`, reproduced because that module does not export it. */
const DRAWING_ISSUE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
];

/** Who may acknowledge a revision addressed to them (spec §1.4). */
const ACKNOWLEDGE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'foreman',
  'site_engineer',
];

/** Who may link/unlink a lot's governing revision (spec §1.4 — no foreman). */
const LINK_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
];

function issueRolesFor(entityType: GovernedEntityType): string[] {
  return entityType === 'drawing' ? DRAWING_ISSUE_ROLES : [...TEMPLATE_MANAGER_ROLES];
}

/**
 * Read access: every internal project role, including `viewer`. Subcontractors
 * are excluded outright — nothing in G1 is exposed to them.
 *
 * Returns the effective role so callers can gate a write on it without a second
 * round trip.
 */
export async function requireRevisionReadAccess(
  user: AuthUser,
  projectId: string,
): Promise<string> {
  if (SUBCONTRACTOR_ROLES.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Internal project access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || SUBCONTRACTOR_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Access denied');
  }

  return effectiveRole;
}

export async function requireRevisionIssueAccess(
  user: AuthUser,
  projectId: string,
  entityType: GovernedEntityType,
): Promise<void> {
  const effectiveRole = await requireRevisionReadAccess(user, projectId);
  if (!issueRolesFor(entityType).includes(effectiveRole)) {
    throw AppError.forbidden('Revision issue access required');
  }
  await assertProjectAllowsWrite(projectId);
}

export async function requireAcknowledgeAccess(user: AuthUser, projectId: string): Promise<void> {
  const effectiveRole = await requireRevisionReadAccess(user, projectId);
  if (!ACKNOWLEDGE_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Acknowledgement access required');
  }
  await assertProjectAllowsWrite(projectId);
}

export async function requireGoverningRevisionLinkAccess(
  user: AuthUser,
  projectId: string,
): Promise<void> {
  const effectiveRole = await requireRevisionReadAccess(user, projectId);
  if (!LINK_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Governing-revision link access required');
  }
  await assertProjectAllowsWrite(projectId);
}

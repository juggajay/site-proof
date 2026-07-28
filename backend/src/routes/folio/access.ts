// Wave D `D1b` — folio access control
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9 permission
// matrix, §10.1; threat model T-1, T-4). **AT-132**, **AT-152**.

import type { Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { requireInternalProjectAccess } from '../../lib/projectAccess.js';

export type AuthenticatedUser = NonNullable<Request['user']>;

/**
 * Who may issue a folio (§9): `owner`, `admin`, `project_manager`,
 * `quality_manager`.
 *
 * A ROUTE-LOCAL CONST in the `TEST_VERIFIERS` shape
 * (`routes/testResults/accessControl.ts:41`), which is the repo's convention,
 * and NOT a hierarchy check. `canApproveItems` (`roles.ts:66`) resolves to the
 * same four roles today and drifts the moment a role is inserted into
 * `ROLE_HIERARCHY` — a folio issuer set that silently widens when somebody
 * adds a role is exactly the trail T-1 is about.
 */
export const FOLIO_ISSUERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

/**
 * Read access to a project's folio surface.
 *
 * §10.1 declines to unify the four `requireProjectReadAccess` copies, and T-4
 * names the hazard in writing a fifth: two of the four are `(projectId, user)`
 * and two are `(user, projectId)`, so a copy written by pattern-matching
 * against the wrong neighbour transposes its arguments.
 *
 * This surface writes NO fifth copy. It calls the shared
 * `requireInternalProjectAccess` (`lib/projectAccess.ts:212`) that
 * `holdpoints/access.ts` and `dockets/access.ts` already delegate their role
 * resolution to. That is a smaller change than a fifth copy, it removes the
 * argument-order hazard rather than living with it, and it brings the property
 * §9's last row requires for free: **subcontractor roles are hard-rejected**,
 * because handover is not their workflow at all.
 */
export async function requireFolioProjectAccess(
  projectId: string,
  user: AuthenticatedUser,
  message = 'You do not have access to this project',
): Promise<string> {
  return requireInternalProjectAccess(user, projectId, message);
}

/** Read access plus membership of {@link FOLIO_ISSUERS}. */
export async function requireFolioIssuerAccess(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string> {
  const role = await requireFolioProjectAccess(projectId, user);
  if (!FOLIO_ISSUERS.includes(role)) {
    throw AppError.forbidden(
      'Only owners, admins, project managers and quality managers can issue a folio',
    );
  }
  return role;
}

/**
 * T-4's second hop, in one place.
 *
 * "The route authorises the LOT, then loads the SNAPSHOT by its own id without
 * re-checking that the snapshot belongs to that lot and that project." Every
 * folio route loads its row by id and then passes it through here, so a
 * project-A snapshot id presented on a project-B lot by a user who legitimately
 * holds B is a 404 rather than a compilation of somebody else's evidence.
 */
export function assertBelongsToLot(
  row: { projectId: string; lotId: string } | null,
  lot: { id: string; projectId: string },
  entity: string,
): void {
  if (!row || row.lotId !== lot.id || row.projectId !== lot.projectId) {
    throw AppError.notFound(entity);
  }
}

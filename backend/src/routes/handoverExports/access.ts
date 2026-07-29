// Wave D `D1c.1` — handover export access control
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §9 permission
// matrix, §10.1; `[DH-k]`). **AT-132**.
//
// `[DH-k]`: there is NO paywall here. J9 makes archive generation a paid
// add-on, and `D1c.1` builds the job schema and the ledger — no billing check,
// no entitlement column, no price. Until billing exists, generation is governed
// by the ordinary project-role guard below. A paywall half-built is worse than
// none, because it reads as enforced.

import type { Request } from 'express';

import { AppError } from '../../lib/AppError.js';
import { requireInternalProjectAccess } from '../../lib/projectAccess.js';

export type AuthenticatedUser = NonNullable<Request['user']>;

/**
 * §9: "Request a handover export — `owner`, `admin`, `project_manager`,
 * `quality_manager`."
 *
 * A ROUTE-LOCAL CONST, the same shape and for the same reason as
 * `FOLIO_ISSUERS` (`routes/folio/access.ts:23`): a hierarchy check drifts the
 * moment a role is inserted into `ROLE_HIERARCHY`, and the set that may spend
 * the most expensive operation the product performs must not widen by accident.
 */
export const HANDOVER_EXPORT_REQUESTERS = ['owner', 'admin', 'project_manager', 'quality_manager'];

/**
 * Read access to a project's handover surface.
 *
 * Delegates to the shared `requireInternalProjectAccess` rather than writing a
 * fifth `requireProjectReadAccess` copy (§10.1 declines to unify the four that
 * exist; it does not ask for a fifth). That brings §9's last row for free:
 * **subcontractor roles are hard-rejected** — handover is not their workflow at
 * all, which is not a scoping question.
 */
export async function requireHandoverProjectAccess(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string> {
  return requireInternalProjectAccess(user, projectId, 'You do not have access to this project');
}

/** Read access plus membership of {@link HANDOVER_EXPORT_REQUESTERS}. */
export async function requireHandoverRequesterAccess(
  projectId: string,
  user: AuthenticatedUser,
): Promise<string> {
  const role = await requireHandoverProjectAccess(projectId, user);
  if (!HANDOVER_EXPORT_REQUESTERS.includes(role)) {
    throw AppError.forbidden(
      'Only owners, admins, project managers and quality managers can request a handover export',
    );
  }
  return role;
}

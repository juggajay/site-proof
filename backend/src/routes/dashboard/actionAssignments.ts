// A4 P1.1 — the thin `ActionAssignment` adapter over the two signals the
// dashboard stats payload already carries: overdue NCRs and the hold points the
// attention widget surfaces (design spec
// docs/plans/a4-my-work-design-2026-07-26.md §9 P1.1, §5.2 Class-A rows).
//
// Pure: no Prisma client, no I/O — it takes the rows `statsRoute` already
// fetches. `needsAction` is set ONLY via `deriveNeedsAction`
// (`contracts/actionAssignment.ts:85-93`), never by hand, and `reasonCode`
// comes from the closed vocabulary in `contracts/reasonCodes.ts`.

import {
  deriveNeedsAction,
  type ActionAssignee,
  type ActionAssignment,
  type ActionAssignmentStatus,
  type PrimaryAction,
} from '../../lib/readiness/contracts/actionAssignment.js';
import { holdPointOverdue, ncrOverdue } from '../../lib/readiness/predicates.js';
import { ROLES, type Role } from '../../lib/roles.js';

/** Spec §5.2 Class A: `ncr_overdue` → "Review NCR". */
const NCR_REVIEW_ROLES: Role[] = [ROLES.OWNER, ROLES.ADMIN, ROLES.QUALITY_MANAGER];

/** Spec §5.2 Class A: `hold_point_overdue` and `unreleased_hold_points` share a role set. */
const HOLD_POINT_ROLES: Role[] = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.PROJECT_MANAGER,
  ROLES.QUALITY_MANAGER,
];

export interface AssignmentViewer {
  /** `User.id` — compared against a row's responsible user. */
  userId: string;
  /** Canonical project role per projectId (the dashboard's own project access). */
  roleByProject: Map<string, string>;
  /** Company role, used when a row's project has no project-scoped access row. */
  fallbackRole: string;
}

export interface OverdueNcrRow {
  id: string;
  ncrNumber: string;
  status: string;
  dueDate: Date | null;
  responsibleUserId: string | null;
  responsibleSubcontractorId: string | null;
  project: { id: string };
}

export interface AttentionHoldPointRow {
  id: string;
  description: string | null;
  status: string;
  scheduledDate: Date | null;
  lot: { lotNumber: string; project: { id: string } };
}

/**
 * Ball-in-court is EXPLICITLY relative to the viewer (`actionAssignment.ts:9-13`),
 * so an item the viewer's role cannot execute is genuinely in somebody else's
 * court. Phase 1 therefore only ever produces two of the three statuses; the
 * "your court — needs another role" group stays empty, which spec §9 mandates
 * ("with only two reason codes there is nothing honest to put in it").
 *
 * A `role` assignee is held by the viewer only when it names the viewer's OWN
 * project role. Treating every `role` assignee as the viewer's (the shipped
 * behaviour until the 2026-07-28 review's M8) put one QUALITY_MANAGER hold point
 * in "Needs you" for owner + admin + project_manager + quality_manager at once —
 * four people each told the ball was in their court. Those roles still SEE the
 * row; it lands in "Waiting on others", which is where a thing somebody else
 * owns belongs. `executableByRoles` answers "may act", never "owns".
 */
function resolveStatus(
  assignee: ActionAssignee,
  primaryAction: PrimaryAction,
  viewer: AssignmentViewer,
  viewerRole: string,
): ActionAssignmentStatus {
  const heldByViewer =
    assignee.kind === 'user'
      ? assignee.id === viewer.userId
      : assignee.kind === 'role'
        ? assignee.role === viewerRole
        : false;
  return heldByViewer && primaryAction.executableByRoles.includes(viewerRole as Role)
    ? 'waiting_on_me'
    : 'waiting_on_others';
}

function viewerRoleFor(viewer: AssignmentViewer, projectId: string): string {
  return viewer.roleByProject.get(projectId) ?? viewer.fallbackRole;
}

export function toNcrAssignment(
  ncr: OverdueNcrRow,
  viewer: AssignmentViewer,
  now: Date,
): ActionAssignment {
  const projectId = ncr.project.id;
  const viewerRole = viewerRoleFor(viewer, projectId);
  const assignee: ActionAssignee = ncr.responsibleUserId
    ? { kind: 'user', id: ncr.responsibleUserId }
    : ncr.responsibleSubcontractorId
      ? { kind: 'company', id: ncr.responsibleSubcontractorId }
      : { kind: 'role', role: ROLES.QUALITY_MANAGER };
  const primaryAction: PrimaryAction = {
    label: 'Review NCR',
    href: `/projects/${projectId}/ncr?ncr=${ncr.id}`,
    executableByRoles: NCR_REVIEW_ROLES,
  };
  const status = resolveStatus(assignee, primaryAction, viewer, viewerRole);
  return {
    subjectType: 'ncr',
    subjectId: ncr.id,
    title: `NCR ${ncr.ncrNumber}`,
    status,
    needsAction: deriveNeedsAction({ status, primaryAction }, viewerRole),
    isOverdue: ncrOverdue(ncr, now),
    dueAt: ncr.dueDate?.toISOString(),
    assignee,
    severity: 'blocker',
    reasonCode: 'ncr_overdue',
    primaryAction,
  };
}

/**
 * Hold points reach this feed two ways (see `statsRoute`): the dashboard's
 * aging/"stagnant" set, and — additively, A4R-B4 — the scheduled-date overdue
 * set. `isOverdue` follows D2's scheduled-date semantics via `holdPointOverdue`,
 * and the `reasonCode` follows it: only a row that IS past its committed date
 * gets `hold_point_overdue` (that code's provenance is date-passed by
 * definition, `reasonCodes.ts:79-84`). An aging-but-not-yet-due row is exactly
 * what `unreleased_hold_points` means, so it carries that Class-A code instead.
 *
 * ponytail: `assignee` is a role for every hold-point row because the table has
 * no assignee column. P2.2 populates the other four kinds.
 */
export function toHoldPointAssignment(
  holdPoint: AttentionHoldPointRow,
  viewer: AssignmentViewer,
  now: Date,
): ActionAssignment {
  const projectId = holdPoint.lot.project.id;
  const viewerRole = viewerRoleFor(viewer, projectId);
  const overdue = holdPointOverdue(holdPoint, now);
  const assignee: ActionAssignee = { kind: 'role', role: ROLES.QUALITY_MANAGER };
  const primaryAction: PrimaryAction = {
    label: overdue ? 'Review hold point' : 'Release hold point',
    href: `/projects/${projectId}/hold-points`,
    executableByRoles: HOLD_POINT_ROLES,
  };
  const status = resolveStatus(assignee, primaryAction, viewer, viewerRole);
  // The lot number is the ONLY thing that tells five "Subgrade proof roll" rows
  // apart — the dashboard PDF has always printed it (`statsRoute` puts the same
  // `Lot ${lotNumber}` in the widget row's `description`).
  const title = [
    holdPoint.description || 'Hold Point',
    holdPoint.lot.lotNumber && `Lot ${holdPoint.lot.lotNumber}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    subjectType: 'hold_point',
    subjectId: holdPoint.id,
    title,
    status,
    needsAction: deriveNeedsAction({ status, primaryAction }, viewerRole),
    isOverdue: overdue,
    dueAt: holdPoint.scheduledDate?.toISOString(),
    assignee,
    severity: overdue ? 'blocker' : 'warning',
    reasonCode: overdue ? 'hold_point_overdue' : 'unreleased_hold_points',
    primaryAction,
  };
}

export interface BallInCourtGroups {
  needsYou: ActionAssignment[];
  needsAnotherRole: ActionAssignment[];
  waitingOnOthers: ActionAssignment[];
}

/**
 * Spec §4.1 — THE grouping axis. Ball-in-court is the ONLY axis that groups, it
 * partitions every non-`done` assignment, and `isOverdue` is deliberately absent
 * from it: overdue is a lens (§4.2 rule 3), never a group and never a promotion
 * out of `waiting_on_others`. Lives next to the producer so the invariant is
 * pinned by `actionAssignments.test.ts` (P1.5).
 */
export function groupByBallInCourt(assignments: ActionAssignment[]): BallInCourtGroups {
  return {
    needsYou: assignments.filter((a) => a.status === 'waiting_on_me' && a.needsAction),
    needsAnotherRole: assignments.filter((a) => a.status === 'waiting_on_me' && !a.needsAction),
    waitingOnOthers: assignments.filter((a) => a.status === 'waiting_on_others'),
  };
}

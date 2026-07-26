// F0.3 consumer contract — ActionAssignment (the "My Work" future consumer).
//
// This is the load-bearing contract of F0.3: the shape A4's "My Work" UI will
// consume, pinned now so the eventual implementation cannot drift. Shape and
// invariants are normative from execution spec §2 (ActionAssignment row, tagged
// `[R2-6]` shape + `[R3-small]` invariants).
//
// Invariants (spec §2, verbatim intent):
//  - `status` is EXHAUSTIVE and MUTUALLY EXCLUSIVE ball-in-court relative to the
//    viewer: exactly one of 'waiting_on_me' | 'waiting_on_others' | 'done'.
//  - `needs_action` is NOT a status (that was the Rev 2 overlap). `needsAction`
//    is DERIVED: true iff `status === 'waiting_on_me'` AND `primaryAction` is
//    executable by the viewer's role. See {@link deriveNeedsAction}.
//  - `isOverdue` is ORTHOGONAL to `status` — an overdue item can be waiting on me
//    or on others (or, in principle, done-but-was-late).
//  - `assignee.kind` is one of 'user' | 'role' | 'company' | 'external' |
//    'system' ('company' = e.g. a subcontractor firm; 'system' = automation).
//  - `reasonCode` is a stable machine-readable string from the predicate item
//    codes (see ./reasonCodes.ts) — never invented per consumer.

import type { EvidenceReadinessSeverity } from '../../evidenceReadiness/core.js';
import type { Role } from '../../roles.js';
import type { ReadinessReasonCode } from './reasonCodes.js';

/** Exhaustive, mutually-exclusive ball-in-court status relative to the viewer. */
export const ACTION_ASSIGNMENT_STATUSES = ['waiting_on_me', 'waiting_on_others', 'done'] as const;
export type ActionAssignmentStatus = (typeof ACTION_ASSIGNMENT_STATUSES)[number];

/** Assignee kinds. `company` = a firm (e.g. subcontractor); `system` = automation. */
export const ASSIGNEE_KINDS = ['user', 'role', 'company', 'external', 'system'] as const;
export type AssigneeKind = (typeof ASSIGNEE_KINDS)[number];

export interface ActionAssignee {
  kind: AssigneeKind;
  /** Present for `user` (userId) / `company` (companyId) / `external` (token row id). */
  id?: string;
  /** Present for `role` (canonical role name) — and optionally to hint a user's role. */
  role?: string;
}

/**
 * The single action a viewer would take to advance the item. `executableByRoles`
 * is the canonical-role gate the `needsAction` derivation consults — it is the
 * contract's way of saying "who can actually action this", not a UI hint.
 */
export interface PrimaryAction {
  label: string;
  href?: string;
  /** Canonical role names (backend/src/lib/roles.ts) permitted to execute this action. */
  executableByRoles: Role[];
}

/**
 * One row in "My Work". `needsAction` is stored on the DTO for the client's
 * convenience but is DERIVED, not authored — a producer MUST set it via
 * {@link deriveNeedsAction} so it cannot contradict `status`/`primaryAction`.
 */
export interface ActionAssignment {
  /** e.g. 'lot' | 'hold_point' | 'ncr' | 'claim' | 'test' — free string, matches AuditLog.entityType convention. */
  subjectType: string;
  subjectId: string;
  title: string;
  status: ActionAssignmentStatus;
  /** DERIVED — see {@link deriveNeedsAction}. Not a status. */
  needsAction: boolean;
  /** Orthogonal to `status`. */
  isOverdue: boolean;
  /** ISO 8601 timestamp. */
  dueAt?: string;
  assignee: ActionAssignee;
  // ponytail: severity reuses the engine's readiness vocabulary (blocker|warning|
  // support) since reasonCode is sourced from engine items that already carry it.
  // Mapping NCR minor/major onto this is a consumer concern — spec §13 open.
  severity: EvidenceReadinessSeverity;
  reasonCode: ReadinessReasonCode;
  primaryAction: PrimaryAction;
}

/**
 * THE derivation. `needsAction` is true iff the ball is in the viewer's court
 * (`status === 'waiting_on_me'`) AND the viewer's role can actually execute the
 * primary action. Deliberately ignores `isOverdue` (orthogonal) and never keys
 * off a "needs_action" status (there is none).
 */
export function deriveNeedsAction(
  assignment: Pick<ActionAssignment, 'status' | 'primaryAction'>,
  viewerRole: string,
): boolean {
  return (
    assignment.status === 'waiting_on_me' &&
    assignment.primaryAction.executableByRoles.includes(viewerRole as Role)
  );
}

/**
 * My Work is a per-viewer list of ActionAssignments. The eventual A4 storage
 * (spec §2: "Contract only — A4 builds storage if measured necessary") narrows
 * to this view; nothing beyond it is decided in F0.
 */
export interface MyWorkView {
  viewerRole: Role;
  assignments: ActionAssignment[];
}

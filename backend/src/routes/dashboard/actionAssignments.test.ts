// A4 P1.5 — "the one runnable check": the §4.1 grouping invariant, next to the
// producer. The fixture that matters most is the last one: an assignment that is
// BOTH overdue and waiting on somebody else must land in *Waiting on others*.
// `isOverdue` is a lens (§4.2 rule 3), never a group and never a promotion.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import type { ActionAssignment } from '../../lib/readiness/contracts/actionAssignment.js';
import { daysOverdue } from '../../lib/readiness/predicates.js';
import {
  groupByBallInCourt,
  toHoldPointAssignment,
  toNcrAssignment,
  type AssignmentViewer,
} from './actionAssignments.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const NOW = new Date('2026-07-27T00:00:00.000Z');
const PROJECT_ID = 'project-1';
const VIEWER_ID = 'viewer-1';
const OTHER_USER_ID = 'other-1';

function viewerWithRole(role: string): AssignmentViewer {
  return {
    userId: VIEWER_ID,
    roleByProject: new Map([[PROJECT_ID, role]]),
    fallbackRole: 'member',
  };
}

function overdueNcr(overrides: Partial<Parameters<typeof toNcrAssignment>[0]> = {}) {
  return {
    id: 'ncr-1',
    ncrNumber: 'NCR-001',
    status: 'open',
    dueDate: new Date('2026-07-20T00:00:00.000Z'),
    responsibleUserId: null,
    responsibleSubcontractorId: null,
    project: { id: PROJECT_ID },
    ...overrides,
  };
}

function holdPoint(overrides: Partial<Parameters<typeof toHoldPointAssignment>[0]> = {}) {
  return {
    id: 'hp-1',
    description: 'Subgrade proof roll',
    status: 'scheduled',
    scheduledDate: null as Date | null,
    lot: { lotNumber: 'LOT-014', project: { id: PROJECT_ID } },
    ...overrides,
  };
}

describe('A4 P1.1 ActionAssignment adapter', () => {
  it('sets needsAction from the derivation, not by hand', () => {
    const canAct = toNcrAssignment(overdueNcr(), viewerWithRole('quality_manager'), NOW);
    expect(canAct).toMatchObject({
      subjectType: 'ncr',
      status: 'waiting_on_me',
      needsAction: true,
      isOverdue: true,
      reasonCode: 'ncr_overdue',
    });
    expect(canAct.primaryAction.label).toBe('Review NCR');

    // Same row, a viewer whose role cannot execute the action: the ball is not
    // in their court, so no button and no false claim of ownership.
    const cannotAct = toNcrAssignment(overdueNcr(), viewerWithRole('foreman'), NOW);
    expect(cannotAct.status).toBe('waiting_on_others');
    expect(cannotAct.needsAction).toBe(false);
  });

  it('keys reasonCode and isOverdue off the same hold-point predicate', () => {
    // Past its committed date (holdPointOverdue: scheduledDate < now - 1 day).
    const overdue = toHoldPointAssignment(
      holdPoint({ scheduledDate: new Date('2026-07-20T00:00:00.000Z') }),
      viewerWithRole('quality_manager'),
      NOW,
    );
    expect(overdue).toMatchObject({
      subjectType: 'hold_point',
      reasonCode: 'hold_point_overdue',
      isOverdue: true,
      severity: 'blocker',
    });
    expect(overdue.primaryAction.label).toBe('Review hold point');

    // Aging but never scheduled — the widget's stagnant row. It is NOT overdue by
    // the D2 (scheduled-date) definition, so it must not carry the overdue code.
    const stagnant = toHoldPointAssignment(
      holdPoint({ id: 'hp-2', status: 'pending' }),
      viewerWithRole('quality_manager'),
      NOW,
    );
    expect(stagnant).toMatchObject({
      reasonCode: 'unreleased_hold_points',
      isOverdue: false,
      severity: 'warning',
    });
  });
});

// M8 (review 2026-07-28) — a `kind: 'role'` assignee was treated as
// unconditionally held by the viewer, so ONE QUALITY_MANAGER hold point sat in
// "Needs you" for owner + admin + project_manager + quality_manager at once:
// four people each told the ball was in their court.
describe('M8 — a role assignee is only the viewer when the role matches', () => {
  const roleHoldPoint = holdPoint({ status: 'pending' });

  it('puts the role-assigned hold point in Needs you for the named role only', () => {
    const qm = toHoldPointAssignment(roleHoldPoint, viewerWithRole('quality_manager'), NOW);
    expect(qm.assignee).toEqual({ kind: 'role', role: 'quality_manager' });
    expect(qm.status).toBe('waiting_on_me');
    expect(qm.needsAction).toBe(true);
  });

  it.each(['owner', 'admin', 'project_manager'])(
    'leaves the same hold point in Waiting on others for %s, who can act but does not hold it',
    (role) => {
      const assignment = toHoldPointAssignment(roleHoldPoint, viewerWithRole(role), NOW);
      // These roles ARE in executableByRoles — the old code therefore claimed
      // ownership for all of them. Ball-in-court is not "may act".
      expect(assignment.primaryAction.executableByRoles).toContain(role);
      expect(assignment.status).toBe('waiting_on_others');
      expect(assignment.needsAction).toBe(false);
      expect(groupByBallInCourt([assignment]).needsYou).toHaveLength(0);
    },
  );

  it('applies the same rule to an unassigned NCR (role fallback)', () => {
    const unassigned = overdueNcr();
    expect(toNcrAssignment(unassigned, viewerWithRole('quality_manager'), NOW).status).toBe(
      'waiting_on_me',
    );
    // owner can review NCRs, but this one is the QM's ball.
    const owner = toNcrAssignment(unassigned, viewerWithRole('owner'), NOW);
    expect(owner.status).toBe('waiting_on_others');
    expect(owner.needsAction).toBe(false);
  });

  it('still keeps a user-assigned row keyed to that user', () => {
    const mine = toNcrAssignment(
      overdueNcr({ responsibleUserId: VIEWER_ID }),
      viewerWithRole('quality_manager'),
      NOW,
    );
    expect(mine.status).toBe('waiting_on_me');
    const theirs = toNcrAssignment(
      overdueNcr({ responsibleUserId: OTHER_USER_ID }),
      viewerWithRole('quality_manager'),
      NOW,
    );
    expect(theirs.status).toBe('waiting_on_others');
  });
});

// M8 — five "Subgrade proof roll" hold points rendered as five identical rows.
// The dashboard PDF prints the lot number; the screen must too.
describe('M8 — hold-point rows carry their lot number', () => {
  it('puts the lot number in the assignment title', () => {
    const assignment = toHoldPointAssignment(
      holdPoint({ lot: { lotNumber: 'LOT-014', project: { id: PROJECT_ID } } }),
      viewerWithRole('quality_manager'),
      NOW,
    );
    expect(assignment.title).toBe('Subgrade proof roll · Lot LOT-014');
  });

  it('falls back to the description alone when the lot has no number', () => {
    const assignment = toHoldPointAssignment(
      holdPoint({ lot: { lotNumber: '', project: { id: PROJECT_ID } } }),
      viewerWithRole('quality_manager'),
      NOW,
    );
    expect(assignment.title).toBe('Subgrade proof roll');
  });
});

describe('A4 §4.1 grouping invariant', () => {
  const viewer = viewerWithRole('quality_manager');

  const needsYou = toNcrAssignment(overdueNcr(), viewer, NOW);
  const needsAnotherRole = toNcrAssignment(
    overdueNcr({ id: 'ncr-2' }),
    viewerWithRole('foreman'),
    NOW,
  );
  // THE mandated fixture: overdue AND owned by somebody else.
  const overdueWaitingOnOthers = toNcrAssignment(
    overdueNcr({ id: 'ncr-3', responsibleUserId: OTHER_USER_ID }),
    viewer,
    NOW,
  );

  it('puts an overdue item that is waiting on others in Waiting on others, not an Overdue group', () => {
    expect(overdueWaitingOnOthers.isOverdue).toBe(true);
    expect(overdueWaitingOnOthers.status).toBe('waiting_on_others');

    const groups = groupByBallInCourt([overdueWaitingOnOthers]);
    expect(groups.waitingOnOthers).toEqual([overdueWaitingOnOthers]);
    expect(groups.needsYou).toHaveLength(0);
    expect(groups.needsAnotherRole).toHaveLength(0);
    // No group is keyed off isOverdue — the only axis is ball-in-court.
    expect(Object.keys(groups)).toEqual(['needsYou', 'needsAnotherRole', 'waitingOnOthers']);
  });

  it('partitions every open assignment exactly once and excludes done', () => {
    // `needsAnotherRole` is produced by hand here because the phase-1 adapter
    // deliberately never emits `waiting_on_me` + `needsAction: false` (spec §9).
    const yourCourtOtherRole: ActionAssignment = {
      ...needsAnotherRole,
      status: 'waiting_on_me',
      needsAction: false,
    };
    const done: ActionAssignment = { ...needsYou, status: 'done', needsAction: false };
    const open = [needsYou, yourCourtOtherRole, overdueWaitingOnOthers];

    const groups = groupByBallInCourt([...open, done]);

    expect(groups.needsYou).toEqual([needsYou]);
    expect(groups.needsAnotherRole).toEqual([yourCourtOtherRole]);
    expect(groups.waitingOnOthers).toEqual([overdueWaitingOnOthers]);
    expect(
      groups.needsYou.length + groups.needsAnotherRole.length + groups.waitingOnOthers.length,
    ).toBe(open.length);
  });
});

/**
 * The "42 vs 41" regression: the SAME overdue NCR read "42 days overdue" on the
 * dashboard attention widget and "41 days overdue" on /dashboard/needs-attention,
 * because the widget ceil'd and the screen floor'd the same `dueDate`.
 *
 * The two surfaces reach the user by different routes — the widget renders a
 * backend-computed `daysOverdue`, the screen derives its chip from the adapter's
 * `dueAt` client-side — so this feeds ONE fixture through BOTH and asserts the
 * ages agree. `needsAttentionAge` is character-for-character the frontend's
 * expression (`NeedsAttentionPage.tsx` `timeChip`); if either side drifts, this
 * fails.
 */
describe('overdue age is one number across both surfaces', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  /** Verbatim `NeedsAttentionPage.tsx` `timeChip`: the Needs Attention path. */
  const needsAttentionAge = (dueAt: string, now: Date) =>
    Math.floor((now.getTime() - Date.parse(dueAt)) / DAY_MS);

  it('gives the widget and Needs Attention the same age for one NCR', () => {
    const ncr = overdueNcr({ dueDate: new Date(NOW.getTime() - 41 * DAY_MS - 30 * 60 * 1000) });

    // Path 1 — the attention widget's `daysOverdue` (statsRoute).
    const widgetAge = daysOverdue(ncr.dueDate, NOW);
    // Path 2 — the adapter's `dueAt`, aged the way the screen ages it.
    const { dueAt } = toNcrAssignment(ncr, viewerWithRole('quality_manager'), NOW);
    const screenAge = needsAttentionAge(dueAt!, NOW);

    expect(widgetAge).toBe(screenAge);
    // Full days elapsed, not rounded up: 41d30m is 41 days overdue, not 42.
    expect(widgetAge).toBe(41);
  });

  it('counts full days elapsed at the 24h boundary', () => {
    const exactly = new Date(NOW.getTime() - 3 * DAY_MS);
    const justPast = new Date(NOW.getTime() - 3 * DAY_MS - 60 * 1000);

    expect(daysOverdue(exactly, NOW)).toBe(3);
    // The ceil bug's signature: a minute past three days is still three days,
    // not four.
    expect(daysOverdue(justPast, NOW)).toBe(3);

    for (const dueDate of [exactly, justPast]) {
      const { dueAt } = toNcrAssignment(overdueNcr({ dueDate }), viewerWithRole('admin'), NOW);
      expect(needsAttentionAge(dueAt!, NOW)).toBe(daysOverdue(dueDate, NOW));
    }
  });

  it('reports 0 rather than 1 for an NCR that just went overdue', () => {
    // Due dates are midnight-anchored and the feed query is `dueDate < now`, so
    // an NCR due TODAY is already listed. `ceil` called that "1 day overdue"
    // before it was a day late; `floor` says 0 and the UI renders "Overdue".
    expect(daysOverdue(new Date(NOW.getTime() - 60 * 1000), NOW)).toBe(0);
    expect(daysOverdue(null, NOW)).toBe(0);
    // Never negative for a row that is not yet due.
    expect(daysOverdue(new Date(NOW.getTime() + 5 * DAY_MS), NOW)).toBe(0);
  });
});

/**
 * M8 (fable deep review 2026-07-28) — the adapter emitted
 * `/projects/:projectId/holdpoints`; `App.tsx` registers
 * `/projects/:projectId/hold-points`, and React Router has no redirect for the
 * unhyphenated form, so every hold-point row on the new My Work / Needs
 * Attention surfaces landed on `NotFoundPage`.
 *
 * Pinned BY CITATION against App.tsx, the way `conformanceCopy.test.ts` pins
 * frontend copy: there is no shared package between `frontend/` and `backend/`,
 * and building one for one path string is not warranted. This assertion is the
 * tripwire if either side moves.
 */
describe('M8 — the hold-point primary action resolves to a registered route', () => {
  const APP_TSX = readFileSync(path.join(REPO_ROOT, 'frontend/src/App.tsx'), 'utf8');
  const REGISTERED_PATHS = [...APP_TSX.matchAll(/<Route\s[^>]*?path="([^"]+)"/gs)]
    .map((m) => m[1]!)
    // The `*` catch-all renders NotFoundPage — matching it is exactly the bug.
    .filter((routePath) => routePath.startsWith('/'));

  function isRegisteredRoute(href: string): boolean {
    const pathname = href.split('?')[0]!;
    return REGISTERED_PATHS.some((routePath) =>
      new RegExp(`^${routePath.replace(/:[A-Za-z0-9_]+/g, '[^/]+')}$`).test(pathname),
    );
  }

  it('reads App.tsx and finds the hold-points route', () => {
    // Guards the guard: a regex that matched nothing would pass everything.
    expect(REGISTERED_PATHS).toContain('/projects/:projectId/hold-points');
  });

  it('points at /hold-points, which App.tsx registers', () => {
    const { primaryAction } = toHoldPointAssignment(
      holdPoint(),
      viewerWithRole('quality_manager'),
      NOW,
    );

    expect(primaryAction.href).toBe(`/projects/${PROJECT_ID}/hold-points`);
    expect(isRegisteredRoute(primaryAction.href!)).toBe(true);
    // The shape that shipped: no route matches it, so it rendered NotFoundPage.
    expect(isRegisteredRoute(`/projects/${PROJECT_ID}/holdpoints`)).toBe(false);
  });
});

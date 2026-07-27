// A4 P1.5 — "the one runnable check": the §4.1 grouping invariant, next to the
// producer. The fixture that matters most is the last one: an assignment that is
// BOTH overdue and waiting on somebody else must land in *Waiting on others*.
// `isOverdue` is a lens (§4.2 rule 3), never a group and never a promotion.

import { describe, it, expect } from 'vitest';

import type { ActionAssignment } from '../../lib/readiness/contracts/actionAssignment.js';
import {
  groupByBallInCourt,
  toHoldPointAssignment,
  toNcrAssignment,
  type AssignmentViewer,
} from './actionAssignments.js';

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
    lot: { project: { id: PROJECT_ID } },
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

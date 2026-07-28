// F0.3 consumer contract tests — executable specification for the four future
// readiness consumers. These tests PIN the invariants (execution spec §2, §4) so
// a later implementation cannot drift the shapes.

import { describe, expect, it } from 'vitest';
import * as predicates from '../predicates.js';
import {
  ACTION_ASSIGNMENT_STATUSES,
  ASSIGNEE_KINDS,
  deriveNeedsAction,
  type ActionAssignment,
  type MyWorkView,
} from './actionAssignment.js';
import {
  READINESS_REASON_CODES,
  REASON_CODE_PROVENANCE,
  isReadinessReasonCode,
  type ReadinessReasonCode,
} from './reasonCodes.js';
import type {
  HandoverReadinessVerdict,
  HandoverReasonCode,
  HoldPointPackageVerdict,
  HoldPointReasonCode,
  TestReasonCode,
  TestSufficiencyVerdict,
} from './futureConsumers.js';

// Base fixture — a valid "waiting on me" lot conformance action.
function assignment(overrides: Partial<ActionAssignment> = {}): ActionAssignment {
  return {
    subjectType: 'lot',
    subjectId: 'lot-1',
    title: 'ITP not complete',
    status: 'waiting_on_me',
    needsAction: false,
    isOverdue: false,
    assignee: { kind: 'user', id: 'user-1' },
    severity: 'blocker',
    reasonCode: 'itp_incomplete',
    primaryAction: { label: 'Complete ITP', executableByRoles: ['site_engineer', 'foreman'] },
    ...overrides,
  };
}

describe('reasonCode vocabulary (spec §2/§4)', () => {
  it('is the closed set the engine emits — no duplicates', () => {
    const set = new Set(READINESS_REASON_CODES);
    expect(set.size).toBe(READINESS_REASON_CODES.length);
  });

  it('every code has provenance', () => {
    for (const code of READINESS_REASON_CODES) {
      expect(REASON_CODE_PROVENANCE[code]).toBeDefined();
      expect(REASON_CODE_PROVENANCE[code].source).toBeTruthy();
    }
  });

  it('every provenance predicate is a real export of the predicate library (never invented)', () => {
    const exported = new Set(Object.keys(predicates));
    for (const code of READINESS_REASON_CODES) {
      const { predicate } = REASON_CODE_PROVENANCE[code];
      if (predicate === 'engine') continue; // engine-owned (bucket-state / count item)
      expect(exported.has(predicate)).toBe(true);
    }
  });

  it('the overdue codes cite the scheduled-date / due-date predicates, not the aging ones (A4 D2)', () => {
    // `hold_point_overdue` comes from the alert typed `stale_hold_point`, whose
    // query is the OVERDUE definition. Pinning the predicate name stops a later
    // change quietly re-pointing it at holdPointStagnant (createdAt, 7d).
    //
    // Wave E1 moved it from `holdPointOverdue` to `holdPointAwaitingRelease`:
    // the alert engine's query is now keyed on the status the request-release
    // paths actually write. Still scheduled-date semantics, still not the aging
    // predicate — the D2 decision is unchanged, the status set is what moved.
    expect(REASON_CODE_PROVENANCE.hold_point_overdue.predicate).toBe('holdPointAwaitingRelease');
    expect(REASON_CODE_PROVENANCE.ncr_overdue.predicate).toBe('ncrOverdue');
  });

  it('isReadinessReasonCode accepts vocabulary members and rejects invented codes', () => {
    expect(isReadinessReasonCode('itp_incomplete')).toBe(true);
    expect(isReadinessReasonCode('totally_made_up')).toBe(false);
  });
});

describe('ActionAssignment invariants (spec §2 [R2-6]/[R3-small])', () => {
  it('status is exhaustive and mutually exclusive (exactly three, no needs_action status)', () => {
    expect([...ACTION_ASSIGNMENT_STATUSES]).toEqual(['waiting_on_me', 'waiting_on_others', 'done']);
    expect(ACTION_ASSIGNMENT_STATUSES).not.toContain('needs_action');
  });

  it('needsAction is DERIVED: true iff waiting_on_me AND primaryAction executable by viewer role', () => {
    const a = assignment({ primaryAction: { label: 'x', executableByRoles: ['quality_manager'] } });
    expect(deriveNeedsAction(a, 'quality_manager')).toBe(true); // ball in court + can act
    expect(deriveNeedsAction(a, 'viewer')).toBe(false); // ball in court but cannot act
    expect(deriveNeedsAction({ ...a, status: 'waiting_on_others' }, 'quality_manager')).toBe(false);
    expect(deriveNeedsAction({ ...a, status: 'done' }, 'quality_manager')).toBe(false);
  });

  it('needsAction ignores isOverdue — the two are orthogonal', () => {
    const pa = { label: 'x', executableByRoles: ['foreman' as const] };
    const overdue = assignment({ isOverdue: true, primaryAction: pa });
    const notOverdue = assignment({ isOverdue: false, primaryAction: pa });
    expect(deriveNeedsAction(overdue, 'foreman')).toBe(deriveNeedsAction(notOverdue, 'foreman'));
  });

  it('isOverdue is orthogonal to status — valid in every combination', () => {
    for (const status of ACTION_ASSIGNMENT_STATUSES) {
      for (const isOverdue of [true, false]) {
        const a = assignment({ status, isOverdue });
        expect(a.status).toBe(status);
        expect(a.isOverdue).toBe(isOverdue);
      }
    }
  });

  it('assignee.kind is exhaustive (user | role | company | external | system)', () => {
    expect([...ASSIGNEE_KINDS]).toEqual(['user', 'role', 'company', 'external', 'system']);
    for (const kind of ASSIGNEE_KINDS) {
      expect(assignment({ assignee: { kind } }).assignee.kind).toBe(kind);
    }
  });

  it('reasonCode is always a vocabulary member', () => {
    expect(isReadinessReasonCode(assignment().reasonCode)).toBe(true);
  });
});

describe('MyWork view', () => {
  it('is a per-viewer list of assignments whose needsAction agrees with the derivation', () => {
    const viewerRole = 'quality_manager';
    const raw = [
      assignment({
        status: 'waiting_on_me',
        primaryAction: { label: 'approve', executableByRoles: ['quality_manager'] },
      }),
      assignment({
        subjectId: 'lot-2',
        status: 'waiting_on_others',
        primaryAction: { label: 'approve', executableByRoles: ['quality_manager'] },
      }),
    ];
    const view: MyWorkView = {
      viewerRole,
      assignments: raw.map((a) => ({ ...a, needsAction: deriveNeedsAction(a, viewerRole) })),
    };
    expect(view.assignments.map((a) => a.needsAction)).toEqual([true, false]);
  });
});

describe('future consumer verdicts — reasonCodes stay within the vocabulary', () => {
  it('test sufficiency', () => {
    const codes: TestReasonCode[] = ['no_passing_verified_test', 'pending_tests', 'passing_tests'];
    const v: TestSufficiencyVerdict = {
      subjectType: 'lot',
      subjectId: 'lot-1',
      sufficient: false,
      reasonCodes: codes,
    };
    for (const c of v.reasonCodes) expect(isReadinessReasonCode(c)).toBe(true);
  });

  it('hold-point package', () => {
    const codes: HoldPointReasonCode[] = ['unreleased_hold_points', 'released_hold_points'];
    const v: HoldPointPackageVerdict = {
      subjectType: 'release_batch',
      subjectId: 'batch-1',
      released: false,
      reasonCodes: codes,
    };
    for (const c of v.reasonCodes) expect(isReadinessReasonCode(c)).toBe(true);
  });

  it('handover readiness', () => {
    const codes: HandoverReasonCode[] = ['itp_incomplete', 'open_major_ncrs', 'not_conformed'];
    const v: HandoverReadinessVerdict = {
      subjectType: 'lot',
      subjectId: 'lot-1',
      ready: false,
      reasonCodes: codes,
    };
    for (const c of v.reasonCodes) expect(isReadinessReasonCode(c)).toBe(true);
  });

  it('subset code unions cannot reference a non-vocabulary code (compile-time Extract guard)', () => {
    // If a subset union above listed a string not in the vocabulary, Extract<>
    // would resolve it to `never` and the fixtures above would fail to compile.
    // This runtime line documents that guard.
    const all: ReadinessReasonCode[] = [...READINESS_REASON_CODES];
    expect(all.length).toBeGreaterThan(0);
  });
});

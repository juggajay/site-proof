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
  HANDOVER_BLOCKING_REASON_CODES,
  READINESS_REASON_CODES,
  REASON_CODE_PROVENANCE,
  isReadinessReasonCode,
  type ReadinessReasonCode,
} from './reasonCodes.js';
import type {
  CloseoutReadinessResponse,
  HandoverReadinessVerdict,
  HandoverReasonCode,
  HoldPointPackageVerdict,
  HoldPointReasonCode,
  LotCloseoutReadinessSnapshot,
  TestReasonCode,
  TestSufficiencyVerdict,
} from './futureConsumers.js';
// AT-138 runs the SHIPPED emitters. A test-only edge: the contracts themselves
// still hold no runtime import of the engine (futureConsumers.ts header).
import {
  buildClaimEvidenceReviewFromInputs,
  buildLotReadinessFromInputs,
  type LotReadinessInput,
} from '../../evidenceReadiness.js';
import type { EvidenceReadinessItem } from '../../evidenceReadiness/core.js';

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

  it('the handover verdict carries every registered handover code (derived union, not a hand-list)', () => {
    // Before D1a-respec this array would not have compiled as
    // `HandoverReasonCode[]`: `insufficient_test_count` was absent from the
    // hand-listed `Extract<>`. `[DR-B2]`'s named defect, asserted.
    const codes: HandoverReasonCode[] = [...HANDOVER_BLOCKING_REASON_CODES];
    for (const c of codes) expect(isReadinessReasonCode(c)).toBe(true);
    expect(codes).toContain('insufficient_test_count');
  });

  it('subset code unions cannot reference a non-vocabulary code (compile-time Extract guard)', () => {
    // If a subset union above listed a string not in the vocabulary, Extract<>
    // would resolve it to `never` and the fixtures above would fail to compile.
    // This runtime line documents that guard.
    const all: ReadinessReasonCode[] = [...READINESS_REASON_CODES];
    expect(all.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AT-138 — the handover registry cannot drift from the emitters.
// Wave D `D1a-respec`, spec §4.1.1 / §14. `[DR2-B2]`.
//
// Rev 2 asserted a set equation between a runtime set and a TypeScript union,
// which nothing can evaluate. This runs the SHIPPED emitters over a fixture
// battery covering every hard-blocker branch and compares real sets.
// ---------------------------------------------------------------------------

/**
 * Hard blockers the shipped emitters produce that are deliberately OUT of the
 * quality-closeout scope (spec §4.2 / `[DR-A1]`: D1a is a QUALITY verdict). This
 * is a CLASSIFICATION, not a second vocabulary — every hard blocker must land in
 * exactly one of these two lists or AT-138(b) fails, which is the whole point.
 */
const COMMERCIAL_HARD_BLOCKERS_OUT_OF_SCOPE = [
  'already_claimed',
  'missing_budget',
  'conformance_no_longer_current',
] as const satisfies readonly ReadinessReasonCode[];

function readinessInput(overrides: Partial<LotReadinessInput> = {}): LotReadinessInput {
  return {
    lot: {
      id: 'lot-1',
      lotNumber: 'LOT-001',
      status: 'not_started',
      budgetAmount: null,
      claimedInId: null,
    },
    canViewCommercial: true,
    conformStatus: {
      canConform: false,
      blockingReasons: [],
      prerequisites: {
        itpAssigned: false,
        itpCompleted: false,
        itpCompletedCount: 0,
        itpTotalCount: 0,
        itpIncompleteItems: [],
        testRequired: false,
        hasPassingTest: false,
        testResults: [],
        noOpenNcrs: true,
        openNcrs: [],
      },
    },
    evidenceCounts: {
      unreleasedHoldPoints: 0,
      releasedHoldPoints: 0,
      approvedDockets: 0,
      diaryEntries: 0,
      documents: 0,
      photos: 0,
      pendingTests: 0,
    },
    ...overrides,
  };
}

/** Every branch that can emit a `severity: 'blocker'` item, exercised. */
function emitBatteryItems(): EvidenceReadinessItem[] {
  const base = readinessInput();
  const inputs: LotReadinessInput[] = [
    // 1. No ITP, unreleased hold points, not conformed.
    readinessInput({ evidenceCounts: { ...base.evidenceCounts, unreleasedHoldPoints: 3 } }),
    // 2. Every remaining conformance blocker at once.
    readinessInput({
      conformStatus: {
        canConform: false,
        blockingReasons: [],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: false,
          itpCompletedCount: 1,
          itpTotalCount: 3,
          itpIncompleteItems: [{ id: 'ci-1', description: 'Compaction', pointType: 'test' }],
          testRequired: true,
          hasPassingTest: false,
          testResults: [],
          noOpenNcrs: false,
          openNcrs: [{ id: 'ncr-1', ncrNumber: 'NCR-1', description: 'x', status: 'open' }],
          noNaHoldPointBypass: false,
          naHoldPointBlockerCount: 2,
          sufficiencyBlocks: true,
        },
      },
    }),
    // 3. Fully claimed — the commercial short circuit.
    readinessInput({ lot: { ...base.lot, status: 'claimed', claimedInId: 'claim-1' } }),
    // 4. Conformed with no budget.
    readinessInput({
      lot: { ...base.lot, status: 'conformed' },
      conformStatus: {
        canConform: true,
        blockingReasons: [],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: true,
          itpCompletedCount: 1,
          itpTotalCount: 1,
          itpIncompleteItems: [],
          testRequired: false,
          hasPassingTest: true,
          testResults: [],
          noOpenNcrs: true,
          openNcrs: [],
        },
      },
    }),
    // 5. Conformed, then an NCR opened — the post-conformance regression.
    readinessInput({
      lot: { ...base.lot, status: 'conformed', budgetAmount: 1000 },
      conformStatus: {
        canConform: false,
        blockingReasons: [],
        prerequisites: {
          itpAssigned: true,
          itpCompleted: true,
          itpCompletedCount: 1,
          itpTotalCount: 1,
          itpIncompleteItems: [],
          testRequired: false,
          hasPassingTest: true,
          testResults: [],
          noOpenNcrs: false,
          openNcrs: [{ id: 'ncr-2', ncrNumber: 'NCR-2', description: 'y', status: 'open' }],
        },
      },
    }),
  ];

  const items = inputs.flatMap((input) => {
    const readiness = buildLotReadinessFromInputs(input);
    return [
      ...readiness.conformance.blockers,
      ...readiness.conformance.warnings,
      ...readiness.conformance.support,
      ...readiness.claim.blockers,
      ...readiness.claim.warnings,
      ...readiness.claim.support,
    ];
  });

  // The claim-evidence review surface — the sole emitter of `open_major_ncrs`.
  const review = buildClaimEvidenceReviewFromInputs({
    claim: {
      id: 'claim-1',
      claimNumber: 1,
      totalClaimedAmount: 1000,
      claimedLots: [
        {
          amountClaimed: 1000,
          lot: {
            id: 'lot-review',
            lotNumber: 'LOT-REVIEW',
            activityType: 'Earthworks',
            testResults: [],
            ncrLots: [{ ncr: { id: 'ncr-3', status: 'open', severity: 'major' } }],
            documents: [],
            itpInstance: null,
            holdPoints: [{ id: 'hp-1', status: 'pending' }],
          },
        },
      ],
    },
  });

  return [
    ...items,
    ...review.lots.flatMap((lot) => [
      ...lot.claim.blockers,
      ...lot.claim.warnings,
      ...lot.claim.support,
    ]),
  ];
}

describe('AT-138 — HANDOVER_BLOCKING_REASON_CODES cannot drift [DH-B5]', () => {
  const battery = emitBatteryItems();
  const emittedBlockerCodes = new Set(
    battery.filter((i) => i.severity === 'blocker').map((i) => i.code),
  );
  const emittedHardBlockerCodes = new Set(
    battery.filter((i) => i.severity === 'blocker' && i.blocksAction).map((i) => i.code),
  );

  it('(a) is a subset of the shipped registry — never a second vocabulary', () => {
    for (const code of HANDOVER_BLOCKING_REASON_CODES) {
      expect(READINESS_REASON_CODES).toContain(code);
    }
    expect(new Set(HANDOVER_BLOCKING_REASON_CODES).size).toBe(
      HANDOVER_BLOCKING_REASON_CODES.length,
    );
  });

  it('(b) every hard blocker a shipped emitter produces is classified — in scope or out', () => {
    // PROOF OF CATCH. A new `severity: 'blocker'` ∧ `blocksAction: true` code
    // that nobody registers fails here, named. Landing in neither list is the
    // silent divergence `[DH-B5]` exists to forbid.
    const classified = new Set<string>([
      ...HANDOVER_BLOCKING_REASON_CODES,
      ...COMMERCIAL_HARD_BLOCKERS_OUT_OF_SCOPE,
    ]);
    const unclassified = [...emittedHardBlockerCodes].filter((code) => !classified.has(code));
    expect(unclassified).toEqual([]);

    // The battery is only evidence if it actually fires: six conformance hard
    // blockers, `not_conformed`, and the three commercial ones.
    expect([...emittedHardBlockerCodes].sort()).toEqual([
      'already_claimed',
      'conformance_no_longer_current',
      'insufficient_test_count',
      'itp_incomplete',
      'missing_budget',
      'na_hold_point_not_released',
      'no_itp_assigned',
      'no_passing_verified_test',
      'not_conformed',
      'open_ncrs',
    ]);
  });

  it('(c) every registered handover code is really emitted by a shipped emitter', () => {
    // The other direction: no phantom code sits in the registry unemitted. Note
    // `open_major_ncrs` and `unreleased_hold_points` ship `blocksAction: false`
    // on their advisory surfaces, which is why this compares against
    // `severity: 'blocker'` and reasonCodes.ts records the divergence.
    const unemitted = HANDOVER_BLOCKING_REASON_CODES.filter(
      (code) => !emittedBlockerCodes.has(code),
    );
    expect(unemitted).toEqual([]);
  });

  it("(d) the C1 blocking sufficiency code is in the set — `[DR-B2]`'s named omission", () => {
    expect(emittedHardBlockerCodes.has('insufficient_test_count')).toBe(true);
    expect([...HANDOVER_BLOCKING_REASON_CODES]).toContain('insufficient_test_count');
  });
});

describe('D1a input snapshot + response envelope (spec §4.1.2–4.1.4)', () => {
  it('the snapshot carries the four inputs the conformance batch does NOT supply', () => {
    // A compile fixture, like the three verdict fixtures above. `[DR-B2]`: D1a
    // is not a mapper over `checkConformancePrerequisitesBatch`, which fetches
    // neither NCR severity nor the normal hold-point count.
    const snapshot: LotCloseoutReadinessSnapshot = {
      lotId: 'lot-1',
      lotNumber: 'LOT-001',
      status: 'in_progress',
      chainageStart: null,
      chainageEnd: null,
      activitySlug: null,
      prerequisites: readinessInput().conformStatus.prerequisites,
      openMajorNcrCount: 1,
      unreleasedHoldPoints: 2,
      sufficiency: null,
    };
    expect(snapshot.openMajorNcrCount).toBe(1);
    expect(snapshot.unreleasedHoldPoints).toBe(2);
  });

  it('the response reports what a filter could not place, rather than hiding it (AT-139)', () => {
    const response: CloseoutReadinessResponse = {
      verdicts: [
        { subjectType: 'lot', subjectId: 'lot-1', ready: false, reasonCodes: ['open_ncrs'] },
        { subjectType: 'project', subjectId: 'proj-1', ready: false, reasonCodes: ['open_ncrs'] },
      ],
      unplacedLots: 3,
      unclassifiedLots: 4,
    };
    expect(response.verdicts.filter((v) => v.subjectType === 'project')).toHaveLength(1);
    expect(response.unplacedLots + response.unclassifiedLots).toBe(7);
  });
});

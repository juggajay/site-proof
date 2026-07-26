// F0.4b PR 0 — the requirement-set payload vocabulary, pinned.
//
// Three things these tests exist to stop:
//  1. an invented reason code (every set's vocabulary must be a subset of the
//     closed F0.3 set in `contracts/reasonCodes.ts`),
//  2. a payload that outgrows `recordDecision`'s size budgets — the member row's
//     1 KB and the aggregate's 64 KB, asserted against the real constants,
//  3. a reader that forgets to dispatch on `resultSchemaVersion`.

import { describe, expect, it } from 'vitest';

import {
  READINESS_REASON_CODES,
  isReadinessReasonCode,
  type ReadinessReasonCode,
} from '../contracts/reasonCodes.js';
import {
  MEMBER_RESULT_MAX_BYTES,
  RESULT_MAX_BYTES,
  type DecisionSnapshotInput,
} from '../recordDecision.js';
import {
  CLAIM_MEMBER_REASON_CODES,
  CLAIM_MEMBER_REQUIREMENT_SET,
  CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
  buildClaimMemberResultV1,
  decodeClaimMemberResult,
  type ClaimMemberResultV1,
} from './claimMember.v1.js';
import {
  CLAIM_READINESS_REQUIREMENT_SET,
  CLAIM_READINESS_RESULT_SCHEMA_VERSION,
  buildClaimReadinessResultV1,
  decodeClaimReadinessResult,
} from './claimReadiness.v1.js';
import {
  HOLD_POINT_RELEASE_REASON_CODES,
  HOLD_POINT_RELEASE_REQUIREMENT_SET,
  HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION,
  buildHoldPointReleaseResultV1,
  decodeHoldPointReleaseResult,
} from './holdPointRelease.v1.js';
import {
  LOT_CONFORMANCE_REASON_CODES,
  LOT_CONFORMANCE_REQUIREMENT_SET,
  LOT_CONFORMANCE_RESULT_SCHEMA_VERSION,
  buildLotConformanceResultV1,
  decodeLotConformanceResult,
} from './lotConformance.v1.js';
import {
  NCR_CLOSURE_REASON_CODES,
  NCR_CLOSURE_REQUIREMENT_SET,
  NCR_CLOSURE_RESULT_SCHEMA_VERSION,
  buildNcrClosureResultV1,
  decodeNcrClosureResult,
} from './ncrClosure.v1.js';
import { REASON_TEXT_MAX_CHARS, blockingReasonCodes, decodeAtVersion1 } from './shared.js';

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');

const SETS = [
  {
    name: LOT_CONFORMANCE_REQUIREMENT_SET,
    version: LOT_CONFORMANCE_RESULT_SCHEMA_VERSION,
    codes: LOT_CONFORMANCE_REASON_CODES,
    decode: decodeLotConformanceResult,
  },
  {
    name: HOLD_POINT_RELEASE_REQUIREMENT_SET,
    version: HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION,
    codes: HOLD_POINT_RELEASE_REASON_CODES,
    decode: decodeHoldPointReleaseResult,
  },
  {
    name: NCR_CLOSURE_REQUIREMENT_SET,
    version: NCR_CLOSURE_RESULT_SCHEMA_VERSION,
    codes: NCR_CLOSURE_REASON_CODES,
    decode: decodeNcrClosureResult,
  },
  {
    name: CLAIM_READINESS_REQUIREMENT_SET,
    version: CLAIM_READINESS_RESULT_SCHEMA_VERSION,
    codes: CLAIM_MEMBER_REASON_CODES,
    decode: decodeClaimReadinessResult,
  },
  {
    name: CLAIM_MEMBER_REQUIREMENT_SET,
    version: CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
    codes: CLAIM_MEMBER_REASON_CODES,
    decode: decodeClaimMemberResult,
  },
] as const;

describe('requirement sets — naming and versioning', () => {
  it('names the five sets `<snake_case>.v<n>` and starts every payload at version 1', () => {
    expect(SETS.map((set) => set.name)).toEqual([
      'lot_conformance.v1',
      'hold_point_release.v1',
      'ncr_closure.v1',
      'claim_readiness.v1',
      'claim_member.v1',
    ]);
    for (const set of SETS) {
      expect(set.name).toMatch(/^[a-z_]+\.v\d+$/);
      expect(set.name.endsWith(`.v${set.version}`)).toBe(true);
      expect(set.version).toBe(1);
    }
  });

  it('never invents a reason code — every set narrows the closed F0.3 vocabulary', () => {
    for (const set of SETS) {
      for (const code of set.codes) {
        expect(isReadinessReasonCode(code)).toBe(true);
        expect(READINESS_REASON_CODES).toContain(code);
      }
      expect(new Set(set.codes).size).toBe(set.codes.length);
    }
  });
});

describe('blockingReasonCodes (shared)', () => {
  const allowed = LOT_CONFORMANCE_REASON_CODES;

  it('keeps only blocking, in-vocabulary, in-set codes — deduped and sorted', () => {
    expect(
      blockingReasonCodes(
        [
          { code: 'open_ncrs', blocksAction: true },
          { code: 'itp_incomplete', blocksAction: true },
          { code: 'itp_incomplete', blocksAction: true },
          { code: 'conformance_prerequisites_met', blocksAction: false },
          { code: 'missing_budget', blocksAction: true }, // real code, other set
          { code: 'totally_made_up', blocksAction: true }, // not in the vocabulary
        ],
        allowed,
      ),
    ).toEqual(['itp_incomplete', 'open_ncrs']);
  });

  it('treats an item with no blocksAction flag as blocking', () => {
    expect(blockingReasonCodes([{ code: 'open_ncrs' }], allowed)).toEqual(['open_ncrs']);
  });

  it('is order-insensitive — engine item order cannot change a stored payload', () => {
    const a = [{ code: 'open_ncrs' }, { code: 'no_itp_assigned' }];
    expect(blockingReasonCodes(a, allowed)).toEqual(blockingReasonCodes([...a].reverse(), allowed));
  });
});

describe('lot_conformance.v1', () => {
  it('records a clean conform as conformable with no blockers', () => {
    expect(
      buildLotConformanceResultV1({
        canConform: true,
        items: [{ code: 'conformance_prerequisites_met', blocksAction: false }],
      }),
    ).toEqual({ conformable: true, overridden: false, blockingReasonCodes: [] });
  });

  it('records a force-conform with its blockers and truncated provenance', () => {
    const result = buildLotConformanceResultV1({
      canConform: false,
      items: [
        { code: 'open_ncrs', blocksAction: true },
        { code: 'itp_incomplete', blocksAction: true },
      ],
      overridden: true,
      reason: 'x'.repeat(REASON_TEXT_MAX_CHARS + 200),
    });

    expect(result.conformable).toBe(false);
    expect(result.overridden).toBe(true);
    expect(result.blockingReasonCodes).toEqual(['itp_incomplete', 'open_ncrs']);
    expect(result.reason).toHaveLength(REASON_TEXT_MAX_CHARS);
    expect(result.reason?.endsWith('…')).toBe(true);
  });

  it('omits the reason key entirely when there is no provenance text', () => {
    expect(
      buildLotConformanceResultV1({ canConform: true, items: [], reason: '   ' }),
    ).not.toHaveProperty('reason');
  });
});

describe('hold_point_release.v1', () => {
  it('reuses the F0.3 hold-point verdict shape and carries batch correlation', () => {
    expect(
      buildHoldPointReleaseResultV1({
        released: true,
        items: [{ code: 'missing_hold_point_recipients', blocksAction: true }],
        batchId: 'batch-1',
        batchSize: 12,
      }),
    ).toEqual({
      released: true,
      reasonCodes: ['missing_hold_point_recipients'],
      batchId: 'batch-1',
      batchSize: 12,
    });
  });

  it('omits batch fields for a single release', () => {
    const result = buildHoldPointReleaseResultV1({ released: true, items: [] });
    expect(result).toEqual({ released: true, reasonCodes: [] });
  });
});

describe('ncr_closure.v1', () => {
  it('records a concession closure with the cascade count, not lot ids', () => {
    const result = buildNcrClosureResultV1({
      closed: true,
      byConcession: true,
      serious: true,
      affectedLotCount: 3,
      items: [{ code: 'open_major_ncrs', blocksAction: true }],
      reason: 'Accepted by superintendent',
    });

    expect(result).toEqual({
      closed: true,
      byConcession: true,
      serious: true,
      blockingReasonCodes: ['open_major_ncrs'],
      affectedLotCount: 3,
      reason: 'Accepted by superintendent',
    });
    expect(JSON.stringify(result)).not.toMatch(/Ids|ids"/);
  });

  it('defaults byConcession to false and blockers to empty', () => {
    expect(buildNcrClosureResultV1({ closed: true, serious: false, affectedLotCount: 0 })).toEqual({
      closed: true,
      byConcession: false,
      serious: false,
      blockingReasonCodes: [],
      affectedLotCount: 0,
    });
  });
});

describe('claim_member.v1', () => {
  it('is ready only when nothing blocked, and rounds money to cents', () => {
    expect(
      buildClaimMemberResultV1({
        memberType: 'lot',
        items: [],
        claimedValue: 1234.5678,
        claimedPercentage: 33.333333,
      }),
    ).toEqual({
      memberType: 'lot',
      ready: true,
      blockingReasonCodes: [],
      claimedValue: 1234.57,
      claimedPercentage: 33.33,
    });
  });

  it('is blocked when any in-set code blocks', () => {
    const result = buildClaimMemberResultV1({
      memberType: 'variation',
      items: [{ code: 'not_conformed', blocksAction: true }],
      claimedValue: 0,
    });
    expect(result.ready).toBe(false);
    expect(result.blockingReasonCodes).toEqual(['not_conformed']);
    expect(result).not.toHaveProperty('claimedPercentage');
  });

  // BUDGET (spec §3 [R3-3]): recordDecision rejects the whole decision above
  // this. Built from the worst case the type permits — every code at once.
  it('stays inside MEMBER_RESULT_MAX_BYTES at its maximum possible size', () => {
    const worstCase = buildClaimMemberResultV1({
      memberType: 'lot',
      items: CLAIM_MEMBER_REASON_CODES.map((code) => ({ code, blocksAction: true })),
      claimedValue: 999_999_999.99,
      claimedPercentage: 100,
    });

    expect(worstCase.blockingReasonCodes).toHaveLength(CLAIM_MEMBER_REASON_CODES.length);
    expect(bytes(worstCase)).toBeLessThanOrEqual(MEMBER_RESULT_MAX_BYTES);
  });
});

describe('claim_readiness.v1 (aggregate)', () => {
  function members(count: number, blocked = 0): ClaimMemberResultV1[] {
    return Array.from({ length: count }, (_unused, index) =>
      buildClaimMemberResultV1({
        memberType: index % 5 === 0 ? 'variation' : 'lot',
        items:
          index < blocked
            ? CLAIM_MEMBER_REASON_CODES.map((code) => ({ code, blocksAction: true }))
            : [],
        // 10 x 100.01 sums to 1000.0999999999999 in binary floating point —
        // the noise the aggregate's rounding exists to keep out of evidence.
        claimedValue: 100.01,
      }),
    );
  }

  it('derives counts, totals and per-code counts from the member verdicts', () => {
    const result = buildClaimReadinessResultV1(members(10, 4));

    expect(result.memberCounts).toEqual({
      total: 10,
      lots: 8,
      variations: 2,
      ready: 6,
      blocked: 4,
    });
    expect(result.totalClaimedValue).toBe(1000.1);
    expect(result.blockingReasonCounts.not_conformed).toBe(4);
    expect(Object.keys(result.blockingReasonCounts)).toHaveLength(CLAIM_MEMBER_REASON_CODES.length);
  });

  it('is empty-safe', () => {
    expect(buildClaimReadinessResultV1([])).toEqual({
      memberCounts: { total: 0, lots: 0, variations: 0, ready: 0, blocked: 0 },
      totalClaimedValue: 0,
      blockingReasonCounts: {},
    });
  });

  // BUDGET (spec §3 [R3-3]): the aggregate is counts/totals ONLY. At the
  // benchmarked 5,000-member ceiling it must stay inside RESULT_MAX_BYTES —
  // which it only can because it never lists member ids.
  it('stays inside RESULT_MAX_BYTES for a 5,000-member claim and lists no member ids', () => {
    const memberList = members(5_000, 5_000);
    const aggregate = buildClaimReadinessResultV1(memberList);

    expect(aggregate.memberCounts.total).toBe(5_000);
    expect(bytes(aggregate)).toBeLessThanOrEqual(RESULT_MAX_BYTES);

    // Size is a function of the VOCABULARY, not of member count: 5,000 members
    // and 10 members serialize to within a few bytes of each other.
    const serialized = JSON.stringify(aggregate);
    expect(serialized).not.toContain('[');
    expect(bytes(aggregate)).toBeLessThan(1_024);
  });
});

describe('resultSchemaVersion dispatch (spec §12)', () => {
  it('passes a v1 row through every set decoder', () => {
    for (const set of SETS) {
      expect(set.decode({ resultSchemaVersion: 1, result: { marker: set.name } })).toEqual({
        marker: set.name,
      });
    }
  });

  it('refuses an unknown version by name instead of silently mis-decoding', () => {
    for (const set of SETS) {
      expect(() => set.decode({ resultSchemaVersion: 2, result: {} })).toThrow(set.name);
      expect(() => set.decode({ resultSchemaVersion: 2, result: {} })).toThrow(
        /resultSchemaVersion 2/,
      );
    }
  });

  it('shared decodeAtVersion1 is the single dispatch point', () => {
    expect(
      decodeAtVersion1<{ a: number }>({ resultSchemaVersion: 1, result: { a: 1 } }, 's'),
    ).toEqual({ a: 1 });
    expect(() => decodeAtVersion1({ resultSchemaVersion: 0, result: {} }, 's')).toThrow();
  });
});

describe('storability in a snapshot row', () => {
  // Compile-time pin: every payload is assignable to `DecisionSnapshotInput.result`
  // as-is. If one of the `*ResultV1` types ever goes back to being an `interface`
  // this stops compiling — and F0.4b PRs 1–5 would have needed casts to store it.
  it('every payload can be handed straight to recordDecision', () => {
    const rows: DecisionSnapshotInput[] = [
      {
        entityType: 'lot',
        entityId: 'lot-1',
        requirementSet: LOT_CONFORMANCE_REQUIREMENT_SET,
        resultSchemaVersion: LOT_CONFORMANCE_RESULT_SCHEMA_VERSION,
        result: buildLotConformanceResultV1({ canConform: true, items: [] }),
      },
      {
        entityType: 'hold_point',
        entityId: 'hp-1',
        requirementSet: HOLD_POINT_RELEASE_REQUIREMENT_SET,
        resultSchemaVersion: HOLD_POINT_RELEASE_RESULT_SCHEMA_VERSION,
        result: buildHoldPointReleaseResultV1({ released: true, items: [] }),
      },
      {
        entityType: 'ncr',
        entityId: 'ncr-1',
        requirementSet: NCR_CLOSURE_REQUIREMENT_SET,
        resultSchemaVersion: NCR_CLOSURE_RESULT_SCHEMA_VERSION,
        result: buildNcrClosureResultV1({ closed: true, serious: false, affectedLotCount: 0 }),
      },
      {
        entityType: 'claim',
        entityId: 'claim-1',
        requirementSet: CLAIM_READINESS_REQUIREMENT_SET,
        resultSchemaVersion: CLAIM_READINESS_RESULT_SCHEMA_VERSION,
        result: buildClaimReadinessResultV1([]),
      },
      {
        entityType: 'claim_lot',
        entityId: 'claimed-lot-1',
        requirementSet: CLAIM_MEMBER_REQUIREMENT_SET,
        resultSchemaVersion: CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
        result: buildClaimMemberResultV1({ memberType: 'lot', claimedValue: 1 }),
      },
    ];

    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const limit = row.entityType.startsWith('claim_')
        ? MEMBER_RESULT_MAX_BYTES
        : RESULT_MAX_BYTES;
      expect(bytes(row.result)).toBeLessThanOrEqual(limit);
    }
  });
});

describe('reason-code coverage across the sets', () => {
  it('every blocking code the five sets speak is a member of the closed vocabulary', () => {
    const union = new Set<ReadinessReasonCode>();
    for (const set of SETS) for (const code of set.codes) union.add(code);
    for (const code of union) expect(READINESS_REASON_CODES).toContain(code);
    expect(union.size).toBeGreaterThan(0);
  });
});

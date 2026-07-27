// Wave C1 acceptance tests AT-5 … AT-8 — the frequency-regime state machine
// (spec §3.4). No DB: C1.0 lands BEFORE the migration that adds
// `Lot.activitySlug`, so there is no column to query yet. The two-mode query
// contract is asserted on the built query object, and the semantics are asserted
// through a fake stream store that implements the ordering, cursor and take
// semantics Prisma would. C1.1 must add the DB-backed pin when the migration
// lands (see PR body).

import { describe, expect, it } from 'vitest';
import {
  buildRegimeStreamQuery,
  deriveRegime,
  resolveRegimeForRule,
  serializeStreamKey,
  streamEntryConforming,
  type RegimeStreamEntry,
  type RegimeStreamFetcher,
  type RegimeStreamKey,
  type RegimeStreamQuery,
} from './regime.js';
import { createCategoryResolver, ruleCategoryOf } from './testCategories.js';
import type { FrequencyRule, RulesetProvenance } from './types.js';

// F1.2: `streamEntryConforming` takes a RESOLVED CATEGORY and a resolver, not a
// raw rule test type [F1C-B1]. This helper keeps the existing assertions reading
// the same way while routing through the real seam.
const conforming = (entry: RegimeStreamEntry, ruleTestType: string): boolean => {
  const resolve = createCategoryResolver();
  return streamEntryConforming(entry, ruleCategoryOf(resolve, ruleTestType), resolve);
};

const PROVENANCE: RulesetProvenance = {
  authority: 'SyntheticAuthority',
  document: 'Synthetic Section 1',
  clause: 'Table 1.1',
  edition: '2026 edition',
  pdfPage: 1,
  sourceUrl: 'https://example.invalid/spec',
  evidenceGrade: 'A',
  checkedOn: '2026-07-26',
  revalidateBy: '2099-01-01',
};

const N = 3;

// A SYNTHETIC CONFIRMED rule. No shipped pack declares a `reduced` limb
// [C1R-B8] — the appendix supplies the 204.14(c) trigger and no reduced count —
// so the regime machinery can only be exercised synthetically. It is built and
// tested so it is ready the moment a confirmed edition supplies figures.
function reducibleRule(overrides: Partial<FrequencyRule> = {}): FrequencyRule {
  return {
    id: 'synthetic.v1/compaction',
    label: 'Minimum compaction tests per lot',
    testType: 'compaction',
    appliesTo: { activitySlugs: ['earthworks_general'] },
    minCountByScale: { A: 6 },
    reduced: {
      minCountByScale: { A: 3 },
      consecutiveConformingLots: N,
      escalationShape: 'reset_on_any_failure',
    },
    provenance: PROVENANCE,
    ...overrides,
  };
}

const KEY: RegimeStreamKey = {
  projectId: 'project-1',
  rulesetId: 'synthetic.v1',
  ruleId: 'synthetic.v1/compaction',
  activitySlug: 'earthworks_general',
  layerBucket: '*',
};

// ---------------------------------------------------------------------------
// The fake stream store. It implements exactly what §3.4.3's query asks for:
// the projectId + conformed + OR-branch filter, the DESC total order, the
// compound cursor with skip, and take.
// ---------------------------------------------------------------------------

interface FakeLot extends RegimeStreamEntry {
  projectId: string;
  createdAt: Date;
  layer: string | null;
}

/**
 * D14 §6.4.1 `[D14X-4]`. This default was `testResults: []` — an entry that
 * conformed with NO attributable test at all — and it was used at the threshold
 * assertions below to prove a streak. That PINNED THE DEFECT AS CORRECT: three
 * untested lots earned "Eligible to request reduced test frequency", against
 * `[C1C-6]`'s own first-test-conformance ruling. The fixture is CORRECTED here
 * rather than supplemented — a conforming entry is one that was tested and
 * passed.
 */
const PASSED: RegimeStreamEntry['testResults'][number] = {
  testType: 'compaction',
  passFail: 'pass',
  status: 'verified',
};

function lot(index: number, overrides: Partial<FakeLot> = {}): FakeLot {
  const at = new Date(Date.UTC(2026, 0, index + 1));
  return {
    id: `lot-${index}`,
    projectId: 'project-1',
    activitySlug: 'earthworks_general',
    layer: null,
    conformedAt: at,
    createdAt: at,
    conformanceOverriddenAt: null,
    testResults: [PASSED],
    ...overrides,
  };
}

/** A conformed lot whose attributable test failed AND was verified. */
function failedLot(index: number, overrides: Partial<FakeLot> = {}): FakeLot {
  return lot(index, {
    testResults: [{ testType: 'compaction', passFail: 'fail', status: 'verified' }],
    ...overrides,
  });
}

function time(value: Date | string | null): number {
  return value === null ? 0 : new Date(value).getTime();
}

function fakeFetcher(lots: readonly FakeLot[]): RegimeStreamFetcher {
  return async (query: RegimeStreamQuery) => {
    const matchesBranch = (branch: RegimeStreamQuery['where']['OR'][number], row: FakeLot) => {
      if (branch.activitySlug === null) return row.activitySlug === null;
      if (row.activitySlug !== branch.activitySlug) return false;
      const layerOr = (branch as { OR?: { layer: { equals: string } }[] }).OR;
      if (!layerOr) return true;
      return layerOr.some(
        (clause) => (row.layer || '').toLowerCase() === clause.layer.equals.toLowerCase(),
      );
    };
    const matched = lots
      .filter(
        (row) =>
          row.projectId === query.where.projectId &&
          row.conformedAt !== null &&
          query.where.OR.some((branch) => matchesBranch(branch, row)),
      )
      // The DESC total order: conformedAt, then createdAt, then id.
      .sort(
        (a, b) =>
          time(b.conformedAt) - time(a.conformedAt) ||
          b.createdAt.getTime() - a.createdAt.getTime() ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      );
    let start = 0;
    if (query.cursor) {
      const index = matched.findIndex((row) => row.id === query.cursor?.id);
      if (index === -1) return [];
      start = index + (query.skip ?? 0);
    }
    return matched.slice(start, start + query.take);
  };
}

/** The common case: resolve the regime for an UNCONFORMED subject over `stream`. */
function regimeForNewLot(stream: readonly FakeLot[], rule: FrequencyRule = reducibleRule()) {
  return resolveRegimeForRule(fakeFetcher(stream), rule, KEY, {
    id: 'subject',
    conformedAt: null,
  });
}

describe('AT-5 regime query, UNCONFORMED subject: no cursor, take N, most-recent-N', () => {
  const query = buildRegimeStreamQuery(KEY, { id: 'lot-99', conformedAt: null }, N);

  it('issues no cursor and takes exactly N', () => {
    expect(query.cursor).toBeUndefined();
    expect(query.skip).toBeUndefined();
    expect(query.take).toBe(N);
  });

  it('orders by the FULL total order (descending), so ties never reorder', () => {
    expect(query.orderBy).toEqual([{ conformedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('scopes to the project and to conformed lots only — tenant isolation is in the where', () => {
    expect(query.where.projectId).toBe('project-1');
    expect(query.where.conformedAt).toEqual({ not: null });
  });

  it('earns `reduced` off the most recent N conforming lots', async () => {
    const resolvedRegime = await regimeForNewLot([failedLot(0), lot(1), lot(2), lot(3)]);
    expect(resolvedRegime?.regime).toBe('reduced');
    expect(resolvedRegime?.basisLotIds).toEqual(['lot-1', 'lot-2', 'lot-3']);
    expect(resolvedRegime?.streamKey).toBe(serializeStreamKey(KEY));
  });
});

describe('AT-6 regime query, CONFORMED subject: strictly-before compound cursor', () => {
  it('uses cursor + skip 1 over the total order, not an `lt` on conformedAt', () => {
    const query = buildRegimeStreamQuery(KEY, { id: 'lot-5', conformedAt: new Date() }, N);
    expect(query.cursor).toEqual({ id: 'lot-5' });
    expect(query.skip).toBe(1);
    expect(query.take).toBe(N);
    // A simple `lt` would appear as a conformedAt range filter; there is none.
    expect(query.where.conformedAt).toEqual({ not: null });
  });

  it('a conformed subject gets the N PRECEDING it, not the N most recent — different regimes', async () => {
    // Stream order: lot-0 ok, lot-1 FAILED, lot-2 ok, lot-3 ok, lot-4 ok, lot-5 ok.
    // "Most recent 3" = lot-3..lot-5  => all conforming  => reduced.
    // "3 preceding lot-3"  = lot-0..lot-2 => contains the failure => full.
    const stream = [lot(0), failedLot(1), lot(2), lot(3), lot(4), lot(5)];
    const rule = reducibleRule();
    const fetch = fakeFetcher(stream);

    const asMostRecent = await resolveRegimeForRule(fetch, rule, KEY, {
      id: 'subject-new',
      conformedAt: null,
    });
    const asConformed = await resolveRegimeForRule(fetch, rule, KEY, {
      id: 'lot-3',
      conformedAt: stream[3].conformedAt,
    });

    expect(asMostRecent?.regime).toBe('reduced');
    expect(asConformed?.regime).toBe('full');
    expect(asMostRecent?.regime).not.toBe(asConformed?.regime);
  });

  it('resolves correctly when two lots share a conformedAt (the `lt` bug the cursor avoids)', async () => {
    const shared = new Date(Date.UTC(2026, 0, 10));
    const stream = [
      lot(0, { conformedAt: shared, createdAt: new Date(Date.UTC(2026, 0, 1)) }),
      failedLot(1, { conformedAt: shared, createdAt: new Date(Date.UTC(2026, 0, 2)) }),
      lot(2, { conformedAt: shared, createdAt: new Date(Date.UTC(2026, 0, 3)) }),
      lot(3, { conformedAt: shared, createdAt: new Date(Date.UTC(2026, 0, 4)) }),
    ];
    // The window before lot-3 is lot-0..lot-2, which contains the failure. An
    // `lt` on conformedAt would have returned NOTHING here (all timestamps equal).
    const resolvedRegime = await resolveRegimeForRule(fakeFetcher(stream), reducibleRule(), KEY, {
      id: 'lot-3',
      conformedAt: shared,
    });
    expect(resolvedRegime?.regime).toBe('full');
  });

  it('THE LENGTH GUARD: a stream with fewer than N entries is `full`, never `reduced`', async () => {
    for (const size of [0, 1, 2]) {
      const resolvedRegime = await regimeForNewLot(Array.from({ length: size }, (_, i) => lot(i)));
      expect(resolvedRegime?.regime).toBe('full');
      expect(resolvedRegime?.basisLotIds).toEqual([]);
    }
    // …and exactly N conforming entries DOES earn it, so the guard is a floor,
    // not an off-by-one.
    const atFloor = await regimeForNewLot([lot(0), lot(1), lot(2)]);
    expect(atFloor?.regime).toBe('reduced');
  });

  it('an unclassified (NULL activitySlug) lot in the window blocks `reduced` (§16 D7)', async () => {
    const resolvedRegime = await regimeForNewLot([
      lot(0),
      lot(1, { activitySlug: null }),
      lot(2),
      lot(3),
    ]);
    expect(resolvedRegime?.regime).toBe('full');
  });

  it('issues no query at all for a rule with no reduced limb', async () => {
    let calls = 0;
    const counting: RegimeStreamFetcher = async (query) => {
      calls += 1;
      return fakeFetcher([])(query);
    };
    const plain = reducibleRule({ reduced: undefined });
    expect(
      await resolveRegimeForRule(counting, plain, KEY, { id: 'subject', conformedAt: null }),
    ).toBeNull();
    expect(calls).toBe(0);
  });
});

describe('AT-7 property: bounded lookback === fold over the FULL history', () => {
  /**
   * INDEPENDENT reference implementation of the 204.14(c) state machine over the
   * whole history. It implements the LENGTH GUARD ITSELF — credit starts at 0
   * and must REACH n, so a history shorter than n can never reach 'reduced'.
   * That independence is the point: a reference that shared `deriveRegime`'s
   * guard would prove nothing about the guard [C1R-B7].
   */
  function referenceRegime(history: readonly boolean[], n: number): 'full' | 'reduced' {
    let credit = 0;
    let regime: 'full' | 'reduced' = 'full';
    for (const conforming of history) {
      if (conforming) {
        credit += 1;
        if (credit >= n) regime = 'reduced';
      } else {
        credit = 0;
        regime = 'full';
      }
    }
    return regime;
  }

  // Deterministic generator — no new dependency, reproducible failures.
  function* sequences(count: number, maxLength: number): Generator<boolean[]> {
    let seed = 0x2f6e2b1;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < count; i += 1) {
      const length = Math.floor(next() * (maxLength + 1));
      yield Array.from({ length }, () => next() > 0.3);
    }
  }

  it('agrees on every generated conform/fail sequence, at N = 1..4', async () => {
    for (const n of [1, 2, 3, 4]) {
      const rule = reducibleRule({
        reduced: {
          minCountByScale: { A: 3 },
          consecutiveConformingLots: n,
          escalationShape: 'reset_on_any_failure',
        },
      });
      for (const history of sequences(60, 8)) {
        const stream = history.map((conforming, index) =>
          conforming ? lot(index) : failedLot(index),
        );
        const resolvedRegime = await regimeForNewLot(stream, rule);
        expect(resolvedRegime?.regime, `n=${n} history=${history.join('')}`).toBe(
          referenceRegime(history, n),
        );
      }
    }
  });
});

describe('AT-8 regime asymmetries (§3.4.2)', () => {
  it('a FORCE-CONFORMED lot is non-conforming — an override is a decision, not evidence', async () => {
    const resolvedRegime = await regimeForNewLot([
      lot(0),
      lot(1, { conformanceOverriddenAt: new Date() }),
      lot(2),
      lot(3),
    ]);
    // The window lot-1..lot-3 contains the override.
    expect(resolvedRegime?.regime).toBe('full');
  });

  it('an UNVERIFIED failing test does NOT reset the stream; a VERIFIED one does [C1R-B8]', () => {
    const rule = reducibleRule();
    // The entry passed a real test AND carries unverified failures beside it —
    // the asymmetry under test is that the unverified failures do not reset it.
    const unverified: RegimeStreamEntry = lot(1, {
      testResults: [
        PASSED,
        { testType: 'compaction', passFail: 'fail', status: 'entered' },
        { testType: 'compaction', passFail: 'fail', status: 'rejected' },
      ],
    });
    expect(conforming(unverified, rule.testType)).toBe(true);
    expect(conforming(failedLot(1), rule.testType)).toBe(false);
  });

  it('only failures ATTRIBUTABLE to the rule reset it — via own type or linked item', () => {
    const rule = reducibleRule();
    const otherTestType = lot(1, {
      testResults: [PASSED, { testType: 'cbr', passFail: 'fail', status: 'verified' }],
    });
    expect(conforming(otherTestType, rule.testType)).toBe(true);

    const linkedItem = lot(1, {
      testResults: [
        PASSED,
        {
          testType: 'unlabelled',
          passFail: 'fail',
          status: 'verified',
          itpChecklistItem: { testType: 'Compaction' },
        },
      ],
    });
    expect(conforming(linkedItem, rule.testType)).toBe(false);
  });

  it('an unsupported escalationShape THROWS rather than being mis-evaluated', () => {
    const bad = reducibleRule({
      reduced: {
        minCountByScale: { A: 3 },
        consecutiveConformingLots: N,
        escalationShape: 'rolling_window' as never,
      },
    });
    expect(() => deriveRegime(bad, KEY, [lot(0), lot(1), lot(2)])).toThrow(
      /Unsupported sufficiency escalationShape/,
    );
  });
});

// D14 §6.4.1 `[D14X-4]`, AT-49a. The regime is the ONE place C1 lets evidence
// reduce a future requirement, and until D14.1 an entry conformed as long as
// nothing attributable had FAILED — vacuously true for a lot with no tests at
// all. Three untested conformed lots earned "Eligible to request reduced test
// frequency". The failure direction is UNDER-TESTING.
describe('AT-49a zero tests is not conformance (§6.4.1)', () => {
  const rule = reducibleRule();
  const untested = (index: number) => lot(index, { testResults: [] });

  it('three conformed lots with NO attributable test earn nothing', async () => {
    const resolvedRegime = await regimeForNewLot([untested(0), untested(1), untested(2)], rule);
    expect(resolvedRegime?.regime).toBe('full');
    expect(resolvedRegime?.eligible).toBe(false);
    expect(resolvedRegime?.basisLotIds).toEqual([]);
  });

  it('three lots each with one attributable VERIFIED PASSING result do earn it', async () => {
    const resolvedRegime = await regimeForNewLot([lot(0), lot(1), lot(2)], rule);
    expect(resolvedRegime?.eligible).toBe(true);
  });

  it('an UNVERIFIED pass is not evidence — verification is the terminal state', () => {
    const entry = lot(1, {
      testResults: [{ testType: 'compaction', passFail: 'pass', status: 'entered' }],
    });
    expect(conforming(entry, rule.testType)).toBe(false);
  });

  it('a passing result attributing to a DIFFERENT rule does not conform this one', () => {
    const entry = lot(1, {
      testResults: [{ testType: 'cbr', passFail: 'pass', status: 'verified' }],
    });
    expect(conforming(entry, rule.testType)).toBe(false);
  });

  it('failed first, passed on retest: NOT conformance on first testing', () => {
    const entry = lot(1, {
      testResults: [
        { testType: 'compaction', passFail: 'fail', status: 'verified' },
        { testType: 'compaction', passFail: 'pass', status: 'verified' },
      ],
    });
    expect(conforming(entry, rule.testType)).toBe(false);
  });
});

describe('regime stream key + layer filter', () => {
  it('serializes the five-part key (§3.4.2) — no subcontractor, no material source', () => {
    expect(serializeStreamKey(KEY)).toBe(
      'project-1|synthetic.v1|synthetic.v1/compaction|earthworks_general|*',
    );
  });

  it('adds a case-insensitive layer clause only for a layer-discriminated rule', () => {
    const agnostic = buildRegimeStreamQuery(KEY, { id: 'x', conformedAt: null }, N);
    expect(agnostic.where.OR).toEqual([
      { activitySlug: 'earthworks_general' },
      { activitySlug: null },
    ]);

    const discriminated = buildRegimeStreamQuery(KEY, { id: 'x', conformedAt: null }, N, [
      'subgrade',
    ]);
    expect(discriminated.where.OR).toEqual([
      {
        activitySlug: 'earthworks_general',
        OR: [{ layer: { equals: 'subgrade', mode: 'insensitive' } }],
      },
      { activitySlug: null },
    ]);
  });

  it('keeps the layer stream separate in the fake store, matching case-insensitively', async () => {
    const stream = [
      lot(0, { layer: 'Subgrade' }),
      lot(1, { layer: 'base' }),
      lot(2, { layer: 'SUBGRADE' }),
      lot(3, { layer: 'subgrade' }),
    ];
    const rule = reducibleRule({
      appliesTo: { activitySlugs: ['earthworks_general'], layerAliases: ['subgrade'] },
    });
    const resolvedRegime = await resolveRegimeForRule(
      fakeFetcher(stream),
      rule,
      { ...KEY, layerBucket: 'subgrade' },
      { id: 'subject', conformedAt: null },
    );
    expect(resolvedRegime?.regime).toBe('reduced');
    expect(resolvedRegime?.basisLotIds).toEqual(['lot-0', 'lot-2', 'lot-3']);
  });
});

// Wave C1 — per-path input resolution (spec §4.1.1, §5.1.1, §16 D5/D6).
// No DB: `resolveSufficiency` takes a plain fetched-lot shape and an injected
// stream reader, so the whole resolver is testable without the C1.1 migration.

import { describe, expect, it } from 'vitest';
import {
  resolveSufficiency,
  resolveSufficiencyBatch,
  toSufficiencyMode,
  type SufficiencyLotInput,
} from './resolve.js';
import type { RegimeStreamEntry, RegimeStreamFetcher, RegimeStreamQuery } from './regime.js';

function lotInput(overrides: Partial<SufficiencyLotInput> = {}): SufficiencyLotInput {
  return {
    id: 'lot-1',
    projectId: 'project-1',
    activitySlug: 'earthworks_general',
    layer: null,
    areaZone: null,
    testScale: null,
    quantityValue: null,
    quantityUnit: null,
    conformedAt: null,
    project: { state: 'VIC', specificationSet: 'VicRoads', testSufficiencyMode: 'warn' },
    ...overrides,
  };
}

const NOW = new Date('2026-07-26T00:00:00.000Z');

describe('mode narrowing', () => {
  it('accepts the three modes and falls back to `warn`, NEVER `block`, on anything else', () => {
    expect(toSufficiencyMode('off')).toBe('off');
    expect(toSufficiencyMode('warn')).toBe('warn');
    expect(toSufficiencyMode('BLOCK')).toBe('block');
    for (const junk of [null, undefined, '', 'blocking', 'strict']) {
      expect(toSufficiencyMode(junk)).toBe('warn');
    }
  });
});

describe('resolveSufficiency', () => {
  it('resolves the VIC pack and its matching rule', async () => {
    const resolved = await resolveSufficiency(lotInput(), null, NOW);
    expect(resolved.ruleset?.id).toBe('vicroads-204.v1');
    expect(resolved.rules.map((rule) => rule.id)).toEqual(['vicroads-204.v1/compaction-density']);
    expect(resolved.activityCanonical).toBe(true);
  });

  it('resolves nothing for a project with no pack — unknown, never insufficient', async () => {
    const resolved = await resolveSufficiency(
      lotInput({
        project: { state: 'QLD', specificationSet: 'MRTS', testSufficiencyMode: 'warn' },
      }),
      null,
      NOW,
    );
    expect(resolved.ruleset).toBeNull();
    expect(resolved.rules).toEqual([]);
  });

  it('marks a NULL activitySlug as non-canonical and matches no rule', async () => {
    const resolved = await resolveSufficiency(lotInput({ activitySlug: null }), null, NOW);
    expect(resolved.activityCanonical).toBe(false);
    expect(resolved.rules).toEqual([]);
  });

  it('scale: the lot value wins, the ruleset default fills in, an explicit value is NEVER coerced', async () => {
    expect((await resolveSufficiency(lotInput({ testScale: 'B' }), null, NOW)).scale).toEqual({
      value: 'B',
      source: 'lot',
    });
    // vicroads-204.v1 now declares defaultScale 'A' — confirmed verbatim from
    // clause 204.13 ("Where the compaction scale has not been specified,
    // Compaction Scale A shall apply"), so VIC lots evaluate with no data entry.
    expect((await resolveSufficiency(lotInput(), null, NOW)).scale).toEqual({
      value: 'A',
      source: 'ruleset_default',
    });
    // An unrecognised explicit scale stays as given — the evaluator reports
    // `scale_not_recognised` instead of silently substituting the default.
    const unrecognised = await resolveSufficiency(lotInput({ testScale: 'Z' }), null, NOW);
    expect(unrecognised.scale).toEqual({ value: 'Z', source: 'lot' });
    // No pack, no default: an NSW project resolves nothing at all since
    // tfnsw-r44 was deregistered [C1C-9].
    const nsw = await resolveSufficiency(
      lotInput({ project: { state: 'NSW', specificationSet: 'rms', testSufficiencyMode: 'warn' } }),
      null,
      NOW,
    );
    expect(nsw.ruleset).toBeNull();
    expect(nsw.scale).toEqual({ value: null, source: 'none' });
  });

  it('quantity: the lot value wins; geometry area is a READ-TIME m2 fallback, summed', async () => {
    const fromLot = await resolveSufficiency(
      lotInput({ quantityValue: '1200.5', quantityUnit: 'M3', geometries: [{ areaM2: 999 }] }),
      null,
      NOW,
    );
    expect(fromLot.quantity).toEqual({ value: 1200.5, unit: 'm3', source: 'lot' });

    const fromGeometry = await resolveSufficiency(
      lotInput({ geometries: [{ areaM2: 400 }, { areaM2: '350.25' }, { areaM2: null }] }),
      null,
      NOW,
    );
    expect(fromGeometry.quantity).toEqual({ value: 750.25, unit: 'm2', source: 'geometry' });

    const none = await resolveSufficiency(lotInput({ geometries: [] }), null, NOW);
    expect(none.quantity).toEqual({ value: null, unit: null, source: 'none' });
  });

  it('ignores a quantity with no unit, a non-positive value or a junk unit', async () => {
    for (const input of [
      { quantityValue: 500, quantityUnit: null },
      { quantityValue: 0, quantityUnit: 'm2' },
      { quantityValue: -5, quantityUnit: 'm2' },
      { quantityValue: 500, quantityUnit: 'acres' },
      { quantityValue: 'not-a-number', quantityUnit: 'm2' },
    ]) {
      const resolved = await resolveSufficiency(lotInput(input), null, NOW);
      expect(resolved.quantity.source, JSON.stringify(input)).toBe('none');
    }
  });

  it('issues AT MOST ONE regime query per regime-bearing rule, and ZERO otherwise (§12)', async () => {
    let calls = 0;
    const counting: RegimeStreamFetcher = async () => {
      calls += 1;
      return [];
    };

    // vicroads-204's compaction rule declares `reducedFrequencyEligibility`
    // [C1C-6], so it IS regime-bearing: one query, one stream.
    const vic = await resolveSufficiency(lotInput(), counting, NOW);
    expect(calls).toBe(1);
    expect(vic.regimeByRuleId.size).toBe(1);
    // An empty stream is BELOW the length guard, so the streak is not met and
    // nothing is claimed — `full`, not eligible.
    expect(vic.regimeByRuleId.get('vicroads-204.v1/compaction-density')).toMatchObject({
      regime: 'full',
      eligible: false,
    });

    // §12's "0 ADDITIONAL queries when no ruleset resolves" — true for every
    // national-baseline spec set, and now for NSW too [C1C-9].
    for (const project of [
      { state: 'QLD', specificationSet: 'austroads', testSufficiencyMode: 'warn' },
      { state: 'NSW', specificationSet: 'rms', testSufficiencyMode: 'warn' },
    ]) {
      calls = 0;
      const resolved = await resolveSufficiency(lotInput({ project }), counting, NOW);
      expect(calls, project.state).toBe(0);
      expect(resolved.regimeByRuleId.size).toBe(0);
    }
  });

  it('passing NO fetcher issues no history read and leaves every regime at `full` (§3.4.3)', async () => {
    // The option the conform DECISION path takes, so the frequency-stream read
    // can never land inside the serializable transaction [C1R-B7].
    const resolved = await resolveSufficiency(lotInput(), null, NOW);
    expect(resolved.regimeByRuleId.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wave C1.2 — the grouped batch (spec §11 C1.2, §12).
// ---------------------------------------------------------------------------

const RULE_ID = 'vicroads-204.v1/compaction-density';

/** A conformed stream entry with no failing test — a CONFORMING entry. */
function streamEntry(id: string, conformedAt: string): RegimeStreamEntry {
  return {
    id,
    activitySlug: 'earthworks_general',
    conformedAt: new Date(conformedAt),
    conformanceOverriddenAt: null,
    testResults: [{ testType: 'compaction', passFail: 'pass', status: 'verified' }],
  };
}

describe('resolveSufficiencyBatch', () => {
  it('issues ONE query per stream for N lots — never one per member (§12)', async () => {
    const queries: RegimeStreamQuery[] = [];
    const counting: RegimeStreamFetcher = async (query) => {
      queries.push(query);
      return [];
    };

    // 50 lots, all in the SAME project/activity/layer stream. The per-lot loop
    // this replaces would have fired 50 reads.
    const lots = Array.from({ length: 50 }, (_unused, index) => lotInput({ id: `lot-${index}` }));
    const resolved = await resolveSufficiencyBatch(lots, counting, NOW);

    expect(queries).toHaveLength(1);
    expect(resolved.size).toBe(50);
    // Cursor-less: one read serves every subject, and each subject's own cursor
    // is applied in memory.
    expect(queries[0].cursor).toBeUndefined();
    expect(queries[0].where.projectId).toBe('project-1');
  });

  it('splits by stream: a different project or activity is a different read', async () => {
    const queries: RegimeStreamQuery[] = [];
    const counting: RegimeStreamFetcher = async (query) => {
      queries.push(query);
      return [];
    };

    await resolveSufficiencyBatch(
      [
        lotInput({ id: 'a1' }),
        lotInput({ id: 'a2' }),
        lotInput({ id: 'b1', projectId: 'project-2' }),
        lotInput({ id: 'c1', activitySlug: 'earthworks_subgrade_prep' }),
      ],
      counting,
      NOW,
    );

    // Three streams: (p1, general), (p2, general), (p1, subgrade_prep).
    expect(queries).toHaveLength(3);
    // AT-18 tenant isolation survives the grouping: every query is
    // project-scoped, so project 2's lots can never enter project 1's stream.
    expect(new Set(queries.map((query) => query.where.projectId))).toEqual(
      new Set(['project-1', 'project-2']),
    );
  });

  it('issues ZERO queries when nothing regime-bearing resolves', async () => {
    let calls = 0;
    const counting: RegimeStreamFetcher = async () => {
      calls += 1;
      return [];
    };
    await resolveSufficiencyBatch(
      [
        lotInput({
          id: 'nsw',
          project: { state: 'NSW', specificationSet: 'rms', testSufficiencyMode: 'warn' },
        }),
        lotInput({ id: 'unclassified', activitySlug: null }),
      ],
      counting,
      NOW,
    );
    expect(calls).toBe(0);
  });

  it('gives a CONFORMED subject its OWN predecessors, not the stream tail (§3.4.3)', async () => {
    // Stream, newest first. `mid` sits third; its three predecessors are
    // older-1..3, and the three most recent are newest-1..3 — different sets, so
    // an implementation that handed every subject the tail would be caught.
    const rowsDesc = [
      streamEntry('newest-1', '2026-07-20T00:00:00Z'),
      streamEntry('newest-2', '2026-07-19T00:00:00Z'),
      streamEntry('mid', '2026-07-18T00:00:00Z'),
      streamEntry('older-1', '2026-07-17T00:00:00Z'),
      streamEntry('older-2', '2026-07-16T00:00:00Z'),
      streamEntry('older-3', '2026-07-15T00:00:00Z'),
      streamEntry('older-4', '2026-07-14T00:00:00Z'),
    ];
    const fetcher: RegimeStreamFetcher = async () => rowsDesc;

    const resolved = await resolveSufficiencyBatch(
      [
        lotInput({ id: 'mid', conformedAt: new Date('2026-07-18T00:00:00Z') }),
        lotInput({ id: 'unconformed', conformedAt: null }),
      ],
      fetcher,
      NOW,
    );

    expect(resolved.get('mid')!.regimeByRuleId.get(RULE_ID)!.basisLotIds).toEqual([
      'older-3',
      'older-2',
      'older-1',
    ]);
    expect(resolved.get('unconformed')!.regimeByRuleId.get(RULE_ID)!.basisLotIds).toEqual([
      'mid',
      'newest-2',
      'newest-1',
    ]);
  });

  it('falls back to `full` for a subject outside the fetched window', async () => {
    // The `ponytail:` ceiling made observable: a conformed subject the read did
    // not reach resolves to the over-testing (safe) direction, never to
    // `reduced` and never to a per-lot query.
    const fetcher: RegimeStreamFetcher = async () => [
      streamEntry('other-1', '2026-07-20T00:00:00Z'),
      streamEntry('other-2', '2026-07-19T00:00:00Z'),
    ];
    const resolved = await resolveSufficiencyBatch(
      [lotInput({ id: 'deep', conformedAt: new Date('2020-01-01T00:00:00Z') })],
      fetcher,
      NOW,
    );
    expect(resolved.get('deep')!.regimeByRuleId.size).toBe(0);
  });

  it('matches the single-lot resolver exactly, so the two paths cannot drift', async () => {
    const rowsDesc = [
      streamEntry('s1', '2026-07-20T00:00:00Z'),
      streamEntry('s2', '2026-07-19T00:00:00Z'),
      streamEntry('s3', '2026-07-18T00:00:00Z'),
    ];
    const fetcher: RegimeStreamFetcher = async () => rowsDesc;
    const lot = lotInput({ id: 'subject', conformedAt: null });

    const single = await resolveSufficiency(lot, fetcher, NOW);
    const batched = await resolveSufficiencyBatch([lot], fetcher, NOW);

    expect(batched.get('subject')!.regimeByRuleId.get(RULE_ID)).toEqual(
      single.regimeByRuleId.get(RULE_ID),
    );
    // Three consecutive conforming entries meet the trigger — reported as
    // ELIGIBILITY at `regime: 'full'`, never as a reduction [C1C-6].
    expect(batched.get('subject')!.regimeByRuleId.get(RULE_ID)).toMatchObject({
      regime: 'full',
      eligible: true,
    });
  });

  it('passing NO fetcher resolves everything DB-free — the claim DECISION path', async () => {
    // What `checkConformancePrerequisitesBatch` does inside the serializable
    // claim transaction: zero regime queries, so the read can never land inside
    // it [C1R-B7].
    const resolved = await resolveSufficiencyBatch([lotInput(), lotInput({ id: 'lot-2' })], null);
    expect(resolved.size).toBe(2);
    for (const entry of resolved.values()) {
      expect(entry.ruleset?.id).toBe('vicroads-204.v1');
      expect(entry.regimeByRuleId.size).toBe(0);
    }
  });
});

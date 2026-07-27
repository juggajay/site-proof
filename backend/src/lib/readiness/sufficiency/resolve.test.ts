// Wave C1 — per-path input resolution (spec §4.1.1, §5.1.1, §16 D5/D6).
// No DB: `resolveSufficiency` takes a plain fetched-lot shape and an injected
// stream reader, so the whole resolver is testable without the C1.1 migration.

import { describe, expect, it } from 'vitest';
import { resolveSufficiency, toSufficiencyMode, type SufficiencyLotInput } from './resolve.js';
import type { RegimeStreamFetcher } from './regime.js';

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
    // tfnsw-r44.v1 DOES declare one, so its lots evaluate with no data entry.
    const nsw = await resolveSufficiency(
      lotInput({ project: { state: 'NSW', specificationSet: 'rms', testSufficiencyMode: 'warn' } }),
      null,
      NOW,
    );
    expect(nsw.scale).toEqual({ value: 'standard', source: 'ruleset_default' });
    // An unrecognised explicit scale stays as given — the evaluator reports
    // `scale_not_recognised` instead of silently substituting the default.
    const unrecognised = await resolveSufficiency(
      lotInput({
        testScale: 'Z',
        project: { state: 'NSW', specificationSet: 'rms', testSufficiencyMode: 'warn' },
      }),
      null,
      NOW,
    );
    expect(unrecognised.scale).toEqual({ value: 'Z', source: 'lot' });
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

    // tfnsw-r44 declares neither limb, so no history read is issued at all.
    calls = 0;
    const nsw = await resolveSufficiency(
      lotInput({ project: { state: 'NSW', specificationSet: 'rms', testSufficiencyMode: 'warn' } }),
      counting,
      NOW,
    );
    expect(calls).toBe(0);
    expect(nsw.regimeByRuleId.size).toBe(0);

    // §12's "0 ADDITIONAL queries when no ruleset resolves".
    calls = 0;
    await resolveSufficiency(
      lotInput({
        project: { state: 'QLD', specificationSet: 'austroads', testSufficiencyMode: 'warn' },
      }),
      counting,
      NOW,
    );
    expect(calls).toBe(0);
  });

  it('passing NO fetcher issues no history read and leaves every regime at `full` (§3.4.3)', async () => {
    // The option the conform DECISION path takes, so the frequency-stream read
    // can never land inside the serializable transaction [C1R-B7].
    const resolved = await resolveSufficiency(lotInput(), null, NOW);
    expect(resolved.regimeByRuleId.size).toBe(0);
  });
});

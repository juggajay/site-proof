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
    // vicroads-204.v1 declares no defaultScale (§16 D6 — no defensible default).
    expect((await resolveSufficiency(lotInput(), null, NOW)).scale).toEqual({
      value: null,
      source: 'none',
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

  it('issues ZERO regime queries today — no shipped rule declares a reduced limb (§12)', async () => {
    let calls = 0;
    const counting: RegimeStreamFetcher = async () => {
      calls += 1;
      return [];
    };
    const resolved = await resolveSufficiency(lotInput(), counting, NOW);
    expect(calls).toBe(0);
    expect(resolved.regimeByRuleId.size).toBe(0);
  });
});

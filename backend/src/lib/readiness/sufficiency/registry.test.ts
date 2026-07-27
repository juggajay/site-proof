// Wave C1 acceptance test AT-17 plus the registry contract (spec §3.1, §8.3).
//
// The currency check is the runnable guard that survives sessions: an expired,
// under-provenanced or C-graded `confirmed` pack FAILS here rather than shipping
// authority numbers nobody has read.

import { describe, expect, it } from 'vitest';
import {
  RULE_LABEL_MAX_LENGTH,
  SUFFICIENCY_RULESETS,
  layerBucketFor,
  resolveRuleset,
  rulesForLot,
  validateRuleset,
} from './registry.js';
import type { FrequencyRule, Ruleset, RulesetProvenance } from './types.js';

const CONFIRMABLE_PROVENANCE: RulesetProvenance = {
  authority: 'SyntheticAuthority',
  document: 'Synthetic Section 1',
  clause: 'Table 1.1',
  pdfPage: 12,
  edition: '2026 edition',
  sourceUrl: 'https://example.invalid/spec',
  evidenceGrade: 'A',
  checkedOn: '2026-07-26',
  revalidateBy: '2099-01-01',
};

function rule(overrides: Partial<FrequencyRule> = {}): FrequencyRule {
  return {
    id: 'synthetic.v1/compaction',
    label: 'Minimum compaction tests per lot',
    testType: 'compaction',
    appliesTo: { activitySlugs: ['earthworks_general'] },
    minCountByScale: { A: 6 },
    provenance: CONFIRMABLE_PROVENANCE,
    ...overrides,
  };
}

function ruleset(overrides: Partial<Ruleset> = {}): Ruleset {
  const rules = overrides.rules ?? [rule()];
  return {
    id: 'synthetic.v1',
    state: 'vic',
    specSet: 'synthetic',
    scaleKeys: ['A'],
    effectiveFrom: '2020-01-01',
    status: 'confirmed',
    provenance: CONFIRMABLE_PROVENANCE,
    ...overrides,
    rules,
  };
}

const NOW = new Date('2026-07-26T00:00:00.000Z');

describe('the shipped packs are registrable and honestly graded', () => {
  it('every shipped ruleset validates clean', () => {
    for (const shipped of SUFFICIENCY_RULESETS) {
      expect(validateRuleset(shipped, NOW), shipped.id).toEqual([]);
    }
  });

  it('ships exactly the two specced packs and no TMR / DIT SA / MRWA numbers (§8.2)', () => {
    expect(SUFFICIENCY_RULESETS.map((set) => set.id)).toEqual(['vicroads-204.v1', 'tfnsw-r44.v1']);
  });

  it('vicroads-204.v1 is CONFIRMED on primary-source provenance (§8.1.1 [C1C-1])', () => {
    const vicroads = SUFFICIENCY_RULESETS.find((set) => set.id === 'vicroads-204.v1');
    expect(vicroads?.status).toBe('confirmed');
    expect(vicroads?.state).toBe('vic');
    expect(vicroads?.scaleKeys).toEqual(['A', 'B', 'C']);
    // "Where the compaction scale has not been specified, Compaction Scale A
    // shall apply" — confirmed verbatim, so VIC lots evaluate with no data entry.
    expect(vicroads?.defaultScale).toBe('A');
    expect(vicroads?.provenance.edition).toBe('v8.0, November 2025');
    expect(vicroads?.provenance.evidenceGrade).toBe('A');
    expect(vicroads?.provenance.checkedOn).toBe('2026-07-27');
  });

  it('vicroads-204.v1: 6/6/3 counts cite clause 204.13(a), NOT Table 204.142 [C1C-1] [C1C-4]', () => {
    const vicroads = SUFFICIENCY_RULESETS.find((set) => set.id === 'vicroads-204.v1');
    const compaction = vicroads?.rules[0];
    expect(compaction?.testType).toBe('compaction');
    expect(compaction?.minCountByScale).toEqual({ A: 6, B: 6, C: 3 });
    // Table 204.142 carries lot SIZE and the reduced sampling interval; it
    // contains no test counts at all. The count comes from clause 204.13(a).
    expect(compaction?.provenance.clause).toBe('204.13(a)');
    // The Section 173 small-lot escape is visible to the user, not hidden (§4.4).
    expect(compaction?.label).toContain('Sec 173');
  });

  it('vicroads-204.v1 encodes NEITHER maxLotSize limb [C1C-2] [C1C-3]', () => {
    const compaction = SUFFICIENCY_RULESETS.find((set) => set.id === 'vicroads-204.v1')?.rules[0];
    // The 500 m² "under paved areas" cap is a Wyndham City Council amendment
    // that appears in NO version of the VicRoads/DTP document — shipping it
    // would assert an authority requirement the authority never wrote.
    // The 5,000 m² cap is TYPE A MATERIAL ONLY, and `appliesTo` has no
    // material-type discriminator, so a bare cap would fire falsely on a Type B
    // lot and invent a cap for Type C (which has none).
    expect(compaction?.maxLotSize).toBeUndefined();
  });

  it('vicroads-204.v1: the regime is ELIGIBILITY-ONLY, never a reduction [C1C-6]', () => {
    const compaction = SUFFICIENCY_RULESETS.find((set) => set.id === 'vicroads-204.v1')?.rules[0];
    // No `reduced` FIGURES. Table 204.142's third column publishes a lot-SAMPLING
    // INTERVAL (every 2nd/3rd/6th lot), not a per-lot count — clause 204.13(a)'s
    // six is unconditional. Encoding {A:2,B:2,C:6} as counts would be
    // catastrophically wrong [C1C-5].
    expect(compaction?.reduced).toBeUndefined();
    // The TRIGGER is encoded, and it cites its OWN clause (§3.2: one rule, one
    // clause — the count and the regime are different rules).
    expect(compaction?.reducedFrequencyEligibility).toEqual({
      consecutiveConformingLots: 3,
      escalationShape: 'reset_on_any_failure',
      clause: '204.14(c)',
    });
    // Section 204 v8.0 publishes no per-area frequency figure (confirmed). This
    // is NOT true of every authority — TfNSW Q6 Table Q6/L.1 is one [C1C-7].
    expect(compaction?.perQuantity).toBeUndefined();
  });

  it('tfnsw-r44.v1 stays MISATTRIBUTED and draft, so it can never block (§8.2 [C1C-7])', () => {
    const tfnsw = SUFFICIENCY_RULESETS.find((set) => set.id === 'tfnsw-r44.v1');
    // R44 Ed 6 publishes no frequencies at all; the n = 6 below is one cell of
    // Q6 Table Q6/L.1. Grade A evidence that the encoded rule is WRONG is still
    // a reason to keep the pack draft, so the grade stays at its weakest limb.
    expect(tfnsw?.provenance.evidenceGrade).toBe('C');
    expect(tfnsw?.status).toBe('draft');
    // The user-visible citation says where the number does NOT come from.
    expect(tfnsw?.provenance.clause).toContain('deferred to TfNSW Q');
    expect(tfnsw?.rules[0]?.minCountByScale).toEqual({ standard: 6 });
    // Promoting it to `confirmed` at grade C is impossible — CI refuses it.
    expect(validateRuleset({ ...(tfnsw as Ruleset), status: 'confirmed' }, NOW)).toContainEqual(
      expect.stringContaining("requires evidenceGrade 'A'"),
    );
  });

  it('no shipped pack declares a `reduced` limb while it is draft', () => {
    for (const shipped of SUFFICIENCY_RULESETS) {
      if (shipped.status !== 'draft') continue;
      for (const shippedRule of shipped.rules) expect(shippedRule.reduced).toBeUndefined();
    }
  });
});

describe('AT-17 the CI currency check fails on each unsafe shipping state', () => {
  it('a confirmed ruleset whose revalidateBy has PASSED', () => {
    const expired = ruleset({
      provenance: { ...CONFIRMABLE_PROVENANCE, revalidateBy: '2020-01-01' },
      rules: [rule({ provenance: { ...CONFIRMABLE_PROVENANCE, revalidateBy: '2020-01-01' } })],
    });
    expect(validateRuleset(expired, NOW)).toContainEqual(
      expect.stringContaining('confirmed ruleset expired'),
    );
  });

  it('a confirmed ruleset at grade other than A', () => {
    for (const grade of ['B', 'C', 'D'] as const) {
      const graded = ruleset({
        provenance: { ...CONFIRMABLE_PROVENANCE, evidenceGrade: grade },
        rules: [rule({ provenance: { ...CONFIRMABLE_PROVENANCE, evidenceGrade: grade } })],
      });
      expect(validateRuleset(graded, NOW)).toContainEqual(
        expect.stringContaining("requires evidenceGrade 'A'"),
      );
    }
  });

  it('a DRAFT ruleset declaring a `reduced` limb [C1R-B8]', () => {
    const draftReduced = ruleset({
      status: 'draft',
      rules: [
        rule({
          reduced: {
            minCountByScale: { A: 3 },
            consecutiveConformingLots: 3,
            escalationShape: 'reset_on_any_failure',
          },
        }),
      ],
    });
    expect(validateRuleset(draftReduced, NOW)).toContainEqual(
      expect.stringContaining("must not declare a 'reduced' limb"),
    );
  });

  it('a confirmed pack missing pdfPage', () => {
    const noPage = { ...CONFIRMABLE_PROVENANCE };
    delete noPage.pdfPage;
    expect(
      validateRuleset(ruleset({ provenance: noPage, rules: [rule({ provenance: noPage })] }), NOW),
    ).toContainEqual(expect.stringContaining('requires pdfPage'));
  });

  it('a confirmed pack missing edition / sourceUrl / checkedOn / revalidateBy', () => {
    for (const field of ['edition', 'sourceUrl', 'checkedOn', 'revalidateBy'] as const) {
      const blanked = { ...CONFIRMABLE_PROVENANCE, [field]: '' };
      expect(
        validateRuleset(
          ruleset({ provenance: blanked, rules: [rule({ provenance: blanked })] }),
          NOW,
        ),
      ).toContainEqual(expect.stringContaining(`requires a non-empty ${field}`));
    }
  });

  it('an unsupported escalationShape — the registry rejects it (§3.4.1)', () => {
    const bad = ruleset({
      rules: [
        rule({
          reduced: {
            minCountByScale: { A: 3 },
            consecutiveConformingLots: 3,
            escalationShape: 'rolling_window' as never,
          },
        }),
      ],
    });
    expect(validateRuleset(bad, NOW)).toContainEqual(
      expect.stringContaining('unsupported escalationShape'),
    );
  });

  it('a label over the §8.4 prose cap, so no clause text can hide in it', () => {
    const wordy = ruleset({ rules: [rule({ label: 'x'.repeat(RULE_LABEL_MAX_LENGTH + 1) })] });
    expect(validateRuleset(wordy, NOW)).toContainEqual(expect.stringContaining('over the'));
  });

  it('a non-canonical activity slug, a scale gap, and a rule id that snapshots could not resolve', () => {
    expect(
      validateRuleset(
        ruleset({ rules: [rule({ appliesTo: { activitySlugs: ['Earthworks'] } })] }),
        NOW,
      ),
    ).toContainEqual(expect.stringContaining('not a canonical Level-2 activity slug'));

    expect(validateRuleset(ruleset({ scaleKeys: ['A', 'B'] }), NOW)).toContainEqual(
      expect.stringContaining("declares no count for scale 'B'"),
    );

    expect(
      validateRuleset(ruleset({ rules: [rule({ id: 'other/compaction' })] }), NOW),
    ).toContainEqual(expect.stringContaining('must be prefixed'));
  });

  it('a perQuantity limb that would divide by zero', () => {
    expect(
      validateRuleset(ruleset({ rules: [rule({ perQuantity: { unit: 'm2', every: 0 } })] }), NOW),
    ).toContainEqual(expect.stringContaining('every must be > 0'));
  });

  it('a defaultScale outside scaleKeys, and an un-normalized specSet', () => {
    expect(validateRuleset(ruleset({ defaultScale: 'Z' }), NOW)).toContainEqual(
      expect.stringContaining("defaultScale 'Z' is not in scaleKeys"),
    );
    expect(validateRuleset(ruleset({ specSet: 'RMS' }), NOW)).toContainEqual(
      expect.stringContaining('must be pre-normalized'),
    );
  });

  it('a DRAFT pack with empty confirmation provenance is legal — that is the honest state', () => {
    const draft = ruleset({
      status: 'draft',
      provenance: {
        ...CONFIRMABLE_PROVENANCE,
        edition: '',
        sourceUrl: '',
        checkedOn: '',
        revalidateBy: '',
      },
      rules: [
        rule({
          provenance: {
            ...CONFIRMABLE_PROVENANCE,
            edition: '',
            sourceUrl: '',
            checkedOn: '',
            revalidateBy: '',
          },
        }),
      ],
    });
    expect(validateRuleset(draft, NOW)).toEqual([]);
  });
});

describe('resolveRuleset (§7.1 rows 1-2)', () => {
  it('resolves VIC / VicRoads, case-insensitively', () => {
    expect(resolveRuleset({ state: 'VIC', specSet: 'VicRoads', at: NOW })?.id).toBe(
      'vicroads-204.v1',
    );
  });

  it('folds the pre-2019 spec-set name `rms` to tfnsw rather than resolving nothing', () => {
    expect(resolveRuleset({ state: 'NSW', specSet: 'rms', at: NOW })?.id).toBe('tfnsw-r44.v1');
    expect(resolveRuleset({ state: 'nsw', specSet: 'TfNSW', at: NOW })?.id).toBe('tfnsw-r44.v1');
  });

  it('returns null for national-baseline spec sets and unknown authorities — unknown, never insufficient', () => {
    for (const specSet of ['austroads', 'aus-spec', 'ipwea', 'wsa', 'national', 'MRTS']) {
      expect(resolveRuleset({ state: 'qld', specSet, at: NOW })).toBeNull();
    }
    expect(resolveRuleset({ state: 'vic', specSet: 'TfNSW', at: NOW })).toBeNull();
    expect(resolveRuleset({ state: null, specSet: 'VicRoads', at: NOW })).toBeNull();
    expect(resolveRuleset({ state: 'vic', specSet: null, at: NOW })).toBeNull();
  });

  it('honours the effective window', () => {
    expect(
      resolveRuleset({ state: 'vic', specSet: 'vicroads', at: new Date('2010-01-01') }),
    ).toBeNull();
  });
});

describe('rulesForLot + layerBucketFor (§3.2 appliesTo, §3.4.2 layerBucket)', () => {
  const vicroads = SUFFICIENCY_RULESETS[0];

  it('matches on the FOLDED slug and never on a NULL slug', () => {
    expect(
      rulesForLot(vicroads, { activitySlug: 'earthworks_general', layer: null, areaZone: null }),
    ).toHaveLength(1);
    expect(rulesForLot(vicroads, { activitySlug: null, layer: null, areaZone: null })).toEqual([]);
    expect(
      rulesForLot(vicroads, { activitySlug: 'asphalt_dga', layer: null, areaZone: null }),
    ).toEqual([]);
  });

  it('layer/areaZone aliases narrow a rule, case-insensitively; an unqualified rule always matches', () => {
    const zoned = ruleset({
      rules: [
        rule({
          appliesTo: {
            activitySlugs: ['earthworks_general'],
            layerAliases: ['subgrade'],
            areaZoneAliases: ['under paved areas'],
          },
        }),
      ],
    });
    const lookup = { activitySlug: 'earthworks_general' };
    expect(
      rulesForLot(zoned, { ...lookup, layer: 'SubGrade', areaZone: 'Under Paved Areas' }),
    ).toHaveLength(1);
    expect(rulesForLot(zoned, { ...lookup, layer: 'base', areaZone: 'under paved areas' })).toEqual(
      [],
    );
    expect(rulesForLot(zoned, { ...lookup, layer: 'subgrade', areaZone: null })).toEqual([]);
  });

  it('layerBucket is `*` for a layer-agnostic rule and the matched alias otherwise', () => {
    const agnostic = rule();
    expect(layerBucketFor(agnostic, null)).toBe('*');
    expect(layerBucketFor(agnostic, 'anything')).toBe('*');

    const discriminated = rule({
      appliesTo: { activitySlugs: ['earthworks_general'], layerAliases: ['Subgrade'] },
    });
    expect(layerBucketFor(discriminated, 'subgrade')).toBe('subgrade');
    // A NULL-layer lot is a member of the layer-agnostic stream ONLY (§16 D7).
    expect(layerBucketFor(discriminated, null)).toBeNull();
    expect(layerBucketFor(discriminated, 'base')).toBeNull();
  });
});

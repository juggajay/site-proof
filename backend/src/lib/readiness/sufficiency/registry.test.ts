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
import { normalizeSpecSet } from '../../itpMatcher.js';
import { TFNSW_R44_V1 } from './rulesets/tfnsw-r44.v1.js';
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

  it('ships ONE pack — and no TMR / DIT SA / MRWA numbers (§8.2, [C1C-9])', () => {
    expect(SUFFICIENCY_RULESETS.map((set) => set.id)).toEqual(['vicroads-204.v1']);
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

  it('tfnsw-r44.v1 is DEREGISTERED, not deleted [C1C-9]', () => {
    // `draft` means plausible-but-unconfirmed. It does NOT mean confirmed-wrong,
    // and we hold grade-A primary-source evidence that this pack is the latter:
    // R44 Ed 6 publishes no frequencies at all, and the n = 6 is one cell of Q6
    // Table Q6/L.1 — wrong in BOTH directions. Evaluating it even tagged
    // "unconfirmed" is the confident-wrong-number defect [C1C-5] [C1C-7] exist
    // to prevent, so it is out of the registry until the Q6 re-author (D14).
    expect(SUFFICIENCY_RULESETS).not.toContain(TFNSW_R44_V1);
    expect(resolveRuleset({ state: 'NSW', specSet: 'TfNSW', at: NOW })).toBeNull();
    expect(resolveRuleset({ state: 'NSW', specSet: 'rms', at: NOW })).toBeNull();

    // The FILE stays: it pins the vocabulary and is the starting point for the
    // `tfnsw-q6.v1` re-author, so its shape is still asserted here.
    expect(TFNSW_R44_V1.status).toBe('draft');
    expect(TFNSW_R44_V1.provenance.evidenceGrade).toBe('C');
    expect(TFNSW_R44_V1.provenance.clause).toContain('deferred to TfNSW Q');
    expect(TFNSW_R44_V1.rules[0]?.minCountByScale).toEqual({ standard: 6 });
    // Promoting it to `confirmed` at grade C is impossible — CI refuses it.
    expect(validateRuleset({ ...TFNSW_R44_V1, status: 'confirmed' }, NOW)).toContainEqual(
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

  it('a confirmed pack missing edition / sourceUrl', () => {
    for (const field of ['edition', 'sourceUrl'] as const) {
      const blanked = { ...CONFIRMABLE_PROVENANCE, [field]: '' };
      expect(
        validateRuleset(
          ruleset({ provenance: blanked, rules: [rule({ provenance: blanked })] }),
          NOW,
        ),
      ).toContainEqual(expect.stringContaining(`requires a non-empty ${field}`));
    }
  });

  it('a confirmed pack missing checkedOn / revalidateBy — now an ISO complaint', () => {
    // F12 folded the empty case into the ISO check: '' is not an ISO date, so
    // one rule covers both blank and malformed rather than two that disagree.
    for (const field of ['checkedOn', 'revalidateBy'] as const) {
      const blanked = { ...CONFIRMABLE_PROVENANCE, [field]: '' };
      expect(
        validateRuleset(
          ruleset({ provenance: blanked, rules: [rule({ provenance: blanked })] }),
          NOW,
        ),
      ).toContainEqual(expect.stringContaining(`confirmed ruleset requires an ISO ${field} date`));
    }
  });

  // External review F12: "non-empty" was not enough. A malformed date is
  // non-empty (so nothing complained) and never ISO (so the expiry check was
  // skipped), which made a confirmed pack that can NEVER expire.
  it.each([
    ['checkedOn', 'yesterday'],
    ['checkedOn', '2026-7-1'],
    ['revalidateBy', '2027-7-27'],
    ['revalidateBy', 'next year'],
  ])('a confirmed pack whose %s is not a strict ISO date (%s)', (field, value) => {
    const malformed = { ...CONFIRMABLE_PROVENANCE, [field]: value };
    const problems = validateRuleset(
      ruleset({ provenance: malformed, rules: [rule({ provenance: malformed })] }),
      NOW,
    );
    expect(problems).toContainEqual(
      expect.stringContaining(`confirmed ruleset requires an ISO ${field} date`),
    );
  });

  it('a confirmed pack whose checkedOn is in the FUTURE', () => {
    // Nobody read the source tomorrow.
    const future = { ...CONFIRMABLE_PROVENANCE, checkedOn: '2027-01-01' };
    expect(
      validateRuleset(ruleset({ provenance: future, rules: [rule({ provenance: future })] }), NOW),
    ).toContainEqual(expect.stringContaining('is in the future'));
  });

  it('a confirmed pack whose revalidateBy is not AFTER checkedOn', () => {
    const inverted = {
      ...CONFIRMABLE_PROVENANCE,
      checkedOn: '2026-07-01',
      revalidateBy: '2026-07-01',
    };
    expect(
      validateRuleset(
        ruleset({ provenance: inverted, rules: [rule({ provenance: inverted })] }),
        NOW,
      ),
    ).toContainEqual(expect.stringContaining('must be after checkedOn'));
  });

  it('the expiry check now fires UNCONDITIONALLY once the date parses', () => {
    // The regression guard for F12: an expired date must be reported whether or
    // not any other date field is well formed.
    const expired = { ...CONFIRMABLE_PROVENANCE, revalidateBy: '2020-01-01' };
    const problems = validateRuleset(
      ruleset({ provenance: expired, rules: [rule({ provenance: expired })] }),
      NOW,
    );
    expect(problems).toContainEqual(expect.stringContaining('confirmed ruleset expired'));
    // And no malformed-date value can reach this branch and skip it silently.
    const junk = { ...CONFIRMABLE_PROVENANCE, revalidateBy: '2020-1-1' };
    expect(
      validateRuleset(ruleset({ provenance: junk, rules: [rule({ provenance: junk })] }), NOW),
    ).toContainEqual(expect.stringContaining('requires an ISO revalidateBy date'));
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

  it('still folds `rms` to tfnsw — the fold is intact, there is just no NSW pack', () => {
    // The 9 live projects carrying the pre-2019 name must not resolve a
    // DIFFERENT authority's pack once a Q6 pack lands (§8.2, [C1C-9]).
    expect(normalizeSpecSet('rms')).toBe('tfnsw');
    expect(resolveRuleset({ state: 'NSW', specSet: 'rms', at: NOW })).toBeNull();
    expect(resolveRuleset({ state: 'nsw', specSet: 'TfNSW', at: NOW })).toBeNull();
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

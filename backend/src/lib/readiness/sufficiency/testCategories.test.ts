// Wave F1.1 acceptance tests AT-22 … AT-26 and AT-56 (spec
// `docs/plans/test-type-canonicalization-spec-2026-07-27.md` §14).
//
// Pure: no DB, no engine. Every fixture string below is a REAL string — a prod
// inventory row (§5.1), a shipped seed literal, or a Create Test modal datalist
// option. None is invented, because inventing a vocabulary the product never
// writes is the defect this slice exists to fix (§2.5).

import { describe, expect, it } from 'vitest';
import { testTypeSpecifications } from '../../../routes/testResults/specifications.js';
import { SUFFICIENCY_RULESETS } from './rulesets/index.js';
import {
  LAB_REFERENCE,
  LAB_REFERENCE_TOKENS,
  TEST_TYPE_ALIASES,
  candidateCategories,
  classifyTestType,
  createCategoryResolver,
  normalizeTestTypeValue,
  resolveTestCategory,
  tokenizeTestType,
} from './testCategories.js';

// ---------------------------------------------------------------------------
// AT-22 — the namespace contract (§4.1).
//
// The registry declares its categories as plain strings and imports nothing, so
// the linkage to `routes/testResults/specifications.ts` cannot be a type. It is
// asserted HERE, because a test may import anything and production code in
// `lib/` must not import from `routes/`.
// ---------------------------------------------------------------------------
describe('AT-22 the canonical namespace is a `testTypeSpecifications` key set', () => {
  const specKeys = new Set(Object.keys(testTypeSpecifications));

  it('every value the alias registry can produce is a key of testTypeSpecifications', () => {
    for (const [alias, category] of Object.entries(TEST_TYPE_ALIASES)) {
      expect(specKeys.has(category), `${alias} -> ${category}`).toBe(true);
    }
  });

  it('every shipped rule.testType is a key of testTypeSpecifications', () => {
    for (const ruleset of SUFFICIENCY_RULESETS) {
      for (const rule of ruleset.rules) {
        expect(specKeys.has(rule.testType), `${rule.id} -> ${rule.testType}`).toBe(true);
      }
    }
  });

  it('every shipped rule.testType has AT LEAST ONE alias resolving to it', () => {
    // A rule whose category nothing can ever resolve to is a silent zero-count
    // rule — this defect in a new hat.
    const producible = new Set(Object.values(TEST_TYPE_ALIASES));
    for (const ruleset of SUFFICIENCY_RULESETS) {
      for (const rule of ruleset.rules) {
        expect(producible.has(rule.testType), `nothing resolves to ${rule.testType}`).toBe(true);
      }
    }
  });

  it('LAB_REFERENCE is NOT a key of testTypeSpecifications [C1C-19]', () => {
    // Makes it impossible for the exclusion sentinel to be mistaken for a
    // category by any code that reads a resolution.
    expect(specKeys.has(LAB_REFERENCE)).toBe(false);
    expect(Object.values(TEST_TYPE_ALIASES)).not.toContain(LAB_REFERENCE);
  });

  it('the alias keys are already normalized, and the two token sets are disjoint', () => {
    for (const alias of Object.keys(TEST_TYPE_ALIASES)) {
      expect(normalizeTestTypeValue(alias), `${alias} is not in normalized form`).toBe(alias);
    }
    for (const token of LAB_REFERENCE_TOKENS) {
      expect(normalizeTestTypeValue(token), `${token} is not in normalized form`).toBe(token);
      expect(Object.keys(TEST_TYPE_ALIASES)).not.toContain(token);
    }
  });
});

// ---------------------------------------------------------------------------
// AT-23 — normalization (§4.3.1).
// ---------------------------------------------------------------------------
describe('AT-23 normalization folds case, `_` and whitespace — and NOTHING else', () => {
  it('the four spellings of the same test all resolve to compaction', () => {
    for (const value of ['Density Ratio', 'density_ratio', 'DENSITY  RATIO', 'density ratio']) {
      expect(resolveTestCategory(value), value).toBe('compaction');
    }
  });

  it('`-`, `/`, `.` and `:` survive tokenization intact', () => {
    expect(tokenizeTestType('TMR Q141a/b')).toContain('tmr q141a/b');
    expect(tokenizeTestType('AS/NZS 2891.2.2 / AGPT-T212')).toContain('as/nzs 2891.2.2');
    expect(tokenizeTestType('AS/NZS 2891.2.2 / AGPT-T212')).toContain('agpt-t212');
    expect(tokenizeTestType('AS 1289.5.4.1')).toContain('as 1289.5.4.1');
    expect(tokenizeTestType('Austroads AG:PT/T250 (Sand Patch Test)')).toContain(
      'austroads ag:pt/t250',
    );
  });

  it('normalize is idempotent — rule 4 of the tokenizer relies on it', () => {
    for (const value of ['  Density_Ratio ', 'TMR Q141a/b (Insitu Density)', 'AS 1289.5.4.1']) {
      const once = normalizeTestTypeValue(value);
      expect(normalizeTestTypeValue(once)).toBe(once);
    }
  });

  // [F1C-R4] KNOWN CEILING, pinned deliberately (§17.4). A spaced slash is a
  // fragment separator; a bare slash is not, because a bare slash is what keeps
  // `tmr q141a/b` and `as/nzs 2891.2.2` intact. Same intent, different
  // whitespace, different count — and the unrecognised half UNDER-counts, which
  // is the cheap direction and is visible in the §8.2 advisory.
  // Flip condition: the §7 classifier reports an unspaced compound in
  // production, at which point the WHOLE STRING is added as an entry.
  it('the slash asymmetry is a known ceiling, not an accident', () => {
    expect(resolveTestCategory('Field Density Nuclear / Sand')).toBe('compaction');
    expect(resolveTestCategory('field density nuclear/sand')).toBe(null);
  });
});

// ---------------------------------------------------------------------------
// AT-24 — tokenization, the §5.1 evidence base, and the conflict rule (§4.3.2).
// ---------------------------------------------------------------------------

/**
 * The complete set of distinct VIC seed `testType` values that resolve to
 * `compaction` under the shipped registry, with the file and line of the first
 * occurrence — the measured sweep of §5.1 [F1C-B6]. F1.2's AT-58 asserts the
 * seed files still produce EXACTLY this set; here it is asserted by literal.
 */
export const VIC_SEED_COMPACTION_STRINGS: readonly string[] = [
  'RC 316.00', // vic-asphalt.js:914
  'RC 316.00 / RC 317.01', // vic-asphalt.js:843
  'RC 316.00 / AS 2891.14.5 / RC 500.05', // vic-asphalt.js:923
  'Standard / modified compaction (Section 173)', // vic-conduits.js:140
  'RC 316.00 / AS 1289 (grading, PI)', // vic-drainage.js:113
  'RC 316.00 / AS 1289', // vic-drainage.js:122
  'RC 500.05 / RC 316.00', // vic-drainage.js:193
  'RC 316.00 / RC 500.05', // vic-drainage.js:286
  'RC 316.00 / Survey', // vic-drainage.js:317
  'AS 1289 / RC 316.00', // vic-drainage.js:1358
  'Sections 204/304 (DDR, Scale C)', // vic-drainage.js:1826
  'AS 1289.5.4.1 (Sand Replacement) or RC 316.00', // vic-earthworks.js:157
  'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00', // vic-earthworks.js:206
  'AS 1289.5.4.1, RC 316.00, RC 316.10', // vic-earthworks.js:242
  'AS 1289.5.4.1', // vic-earthworks.js:282
  'AS 1289.5.4.1, RC 316.00', // vic-earthworks.js:331
  'RC 316.00 (Density Ratio and Moisture Ratio Lot Characteristics)', // vic-environmental.js:643
  'AS 1289.5.4.1, RC 316.00, RC 330.03', // vic-pavements.js:567
  'AS 1289.5.4.1, RC 330.03, RC 316.00', // vic-pavements.js:1020
  'Section 173 (density ratio)', // vic-pavements.js:1631
];

/** The §5.1 production inventory, read read-only on 2026-07-27. Value, row count. */
export const PROD_INVENTORY: readonly (readonly [string, number])[] = [
  // test_results.test_type
  ['compaction', 25],
  ['density_ratio', 18],
  ['dry density ratio', 1],
  // itp_checklist_items.test_type, top 30 by count
  ['as 1012.9', 24],
  ['survey', 16],
  ['as 1012.9 (compressive strength)', 15],
  ['level survey', 11],
  ['survey check', 9],
  ['as 1289.3.6.1', 9],
  ['density_ratio', 9],
  ['measurement', 8],
  ['as 1289.2.1.1', 8],
  ['as 2891.8', 8],
  ['q115 (ucs)', 7],
  ['as 2159', 7],
  ['as 5101.4', 7],
  ['cctv per wsa 05:2020', 6],
  ['field retroreflectivity (rl)', 6],
  ['as 1012.3.1', 5],
  ['rc 316.00', 5],
  ['austroads ag:pt/t250 (sand patch test)', 5],
  ['t198', 5],
  ['as 1379', 5],
  ['tp 320', 5],
  ['tmr q141a/b (insitu density), tmr q142a (mdd)', 5],
  ['survey measurement', 5],
  ['characteristic dry density ratio rc (per spec 201)', 5],
  ['as/nzs 2891.2.2 / agpt-t212', 5],
  ['as 1012.3.1 (slump)', 5],
  ['as 1289.5.4.1 or as 1289.5.7.1, rc 316.00', 4],
  ['austroads ag:pt/t251 (ball penetration test)', 4],
  ['rc 316.00 / rc 500.05', 4],
  ['tmr q115 (ucs)', 4],
];

/** The `compaction` members of {@link PROD_INVENTORY}. */
const PROD_COMPACTION = new Set([
  'compaction',
  'density_ratio',
  'dry density ratio',
  'rc 316.00',
  'tmr q141a/b (insitu density), tmr q142a (mdd)',
  'characteristic dry density ratio rc (per spec 201)',
  'as 1289.5.4.1 or as 1289.5.7.1, rc 316.00',
  'rc 316.00 / rc 500.05',
]);

describe('AT-24 tokenization, the §5.1 corpus, and the conflict rule', () => {
  it.each([
    [
      'AS 1012.9 (Compressive Strength)',
      ['as 1012.9 (compressive strength)', 'as 1012.9', 'compressive strength'],
      null,
    ],
    [
      'AS 1289.5.4.1 (Sand Replacement) or RC 316.00',
      [
        'as 1289.5.4.1 (sand replacement) or rc 316.00',
        'as 1289.5.4.1 or rc 316.00',
        'sand replacement',
        'as 1289.5.4.1',
        'rc 316.00',
      ],
      'compaction',
    ],
    [
      // [F1C-R1] The fragments of rule 2 are RE-NORMALIZED. Without that, the
      // first comma-fragment is `"tmr q141a/b "` — trailing space — and this
      // shipped prod item (5 rows) resolves to nothing.
      'TMR Q141a/b (Insitu Density), TMR Q142a (MDD)',
      [
        'tmr q141a/b (insitu density), tmr q142a (mdd)',
        'tmr q141a/b , tmr q142a',
        'insitu density',
        'mdd',
        'tmr q141a/b',
        'tmr q142a',
      ],
      'compaction',
    ],
    ['MDD Standard', ['mdd standard'], LAB_REFERENCE],
  ])('§4.3.3 worked example %s', (value, tokens, resolution) => {
    const classified = classifyTestType(value);
    expect(classified.tokens).toEqual(tokens);
    expect(classified.resolution).toBe(resolution);
    expect(classified.conflict).toBe(false);
  });

  // [F1C-R2] Parenthetical contents are NOT further split. An implementer who
  // "helpfully" applies rule 4 inside parentheses widens matching and breaks
  // this assertion — which is the point of writing it here.
  it('parenthetical contents are never split', () => {
    expect(tokenizeTestType('Sections 204/304 (DDR, Scale C)')).toEqual([
      'sections 204/304 (ddr, scale c)',
      'sections 204/304',
      'ddr, scale c',
    ]);
    expect(tokenizeTestType('Sections 204/304 (DDR, Scale C)')).not.toContain('ddr');
    expect(tokenizeTestType('RC 316.00 / AS 1289 (grading, PI)')).not.toContain('grading');
  });

  it('every §5.1 VIC seed compaction string resolves to compaction', () => {
    for (const value of VIC_SEED_COMPACTION_STRINGS) {
      expect(resolveTestCategory(value), value).toBe('compaction');
    }
    expect(new Set(VIC_SEED_COMPACTION_STRINGS).size).toBe(20);
  });

  it('the §5.1 production inventory classifies as tabulated, with ZERO conflicts', () => {
    for (const [value] of PROD_INVENTORY) {
      const classified = classifyTestType(value);
      expect(classified.conflict, `${value} raised a conflict`).toBe(false);
      expect(classified.resolution === 'compaction', `${value} -> ${classified.resolution}`).toBe(
        PROD_COMPACTION.has(value),
      );
    }
  });

  it('no shipped seed or prod string raises a conflict', () => {
    for (const value of [...VIC_SEED_COMPACTION_STRINGS, ...PROD_INVENTORY.map(([v]) => v)]) {
      expect(classifyTestType(value).conflict, value).toBe(false);
    }
  });

  // §17.5 [F1C-R10] KNOWN CEILING, accepted and pinned. The conflict rule is
  // what keeps "any token matches" honest, and at F1 it is STRUCTURALLY INERT:
  // `compaction` is the only category with aliases (D-F1d), so two tokens can
  // never disagree and `conflict` can never fire. A mixed-method item therefore
  // resolves `compaction` silently — shipped VIC seeds already contain three.
  // Bounded by rule scope: `vicroads-204.v1/compaction-density` applies only to
  // `earthworks_general` / `earthworks_subgrade_prep`, and all three strings
  // live in drainage and asphalt seeds. AT-59 (F1.2) pins the behaviour so the
  // PR that ships a SECOND category sees a failing assertion and decides
  // deliberately rather than inheriting silently.
  it('the conflict rule is inert at F1 because only one category has aliases', () => {
    expect(new Set(Object.values(TEST_TYPE_ALIASES))).toEqual(new Set(['compaction']));
    for (const value of [
      'RC 316.00 / Survey',
      'RC 316.00 / AS 1289 (grading, PI)',
      'RC 316.00 / AS 2891.14.5 / RC 500.05',
    ]) {
      const classified = classifyTestType(value);
      expect(classified.conflict, value).toBe(false);
      expect(classified.resolution, value).toBe('compaction');
    }
  });

  it('empty and whitespace-only values produce no tokens and resolve null', () => {
    for (const value of ['', '   ', null, undefined]) {
      expect(tokenizeTestType(value)).toEqual([]);
      expect(resolveTestCategory(value)).toBe(null);
    }
  });
});

// ---------------------------------------------------------------------------
// AT-25 — the non-match proof, and the trust boundary.
//
// SUBSTRING MATCHING IS PROHIBITED, and THIS TEST IS THE PROOF. A substring rule
// keyed on `as 1012` would sweep `AS 1012.9 (Compressive Strength)` — concrete
// strength — into whatever category it was written for. Token-exact matching
// cannot do that. A future agent tempted to "improve" the matcher into a
// `includes()` sees the constraint at the failure site, not in a document.
// ---------------------------------------------------------------------------
describe('AT-25 unmapped is unknown, and the lookup is not a property read', () => {
  it.each([
    'AS 1012.9 (Compressive Strength)',
    'AS 1289.2.1.1',
    'AS 1289.3.6.1',
    'survey',
    'cctv per wsa 05:2020',
    'q115 (ucs)',
    'field retroreflectivity (rl)',
  ])('%s resolves to null — no substring match, no guess', (value) => {
    expect(resolveTestCategory(value)).toBe(null);
  });

  // [F1C-R3] `test_results.test_type` is arbitrary free text from users, the AI
  // vision extractor and filename inference — a trust boundary.
  // `Object.freeze({...})['constructor']` returns a FUNCTION. The lookup is a
  // Map, so it cannot.
  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'prototype'])(
    'the prototype-chain key %s resolves to null',
    (value) => {
      expect(resolveTestCategory(value)).toBe(null);
      expect(resolveTestCategory(value.toUpperCase())).toBe(null);
    },
  );
});

// ---------------------------------------------------------------------------
// AT-26 — the exclusions, as a POSITIVE assertion (§5.3).
//
// Rev 1 implemented these as ABSENCES from the alias table, and an absence has
// no semantics: `null` from an excluded value was indistinguishable from `null`
// from an unmapped one, so the item limb attributed it anyway (AT-57).
// ---------------------------------------------------------------------------
describe('AT-26 laboratory references resolve to LAB_REFERENCE, not merely null', () => {
  it.each([
    // AS 1289.5.1.1 — laboratory maximum dry density, standard compactive effort.
    ['MDD Standard', 'modal option CreateTestModal.tsx:265'],
    // AS 1289.5.2.1 — laboratory MDD, modified compactive effort.
    ['MDD Modified', 'modal option CreateTestModal.tsx:266'],
    ['AS 1289.5.1.1', 'seed-itp-templates-austroads.js:108,182,1421'],
    ['AS 1289.5.2.1', 'qld-environmental.js:813, qld-pavements.js:435, sa-pavements.js:634'],
  ])('%s is a LAB_REFERENCE (%s)', (value) => {
    expect(resolveTestCategory(value)).toBe(LAB_REFERENCE);
  });

  it.each([
    // VicRoads TEST-SITE SELECTION procedure, not a test. Every string
    // containing it also contains `rc 316.00`, so excluding it costs nothing.
    ['RC 316.10', 'vic-earthworks.js:242 (and that item`s notes at :243)'],
    // The ACCEPTANCE/assessment procedure (characteristic value method), not a
    // test method. Same — always co-occurs with `rc 316.00`.
    ['RC 500.05', 'prod item, VIC seed notes'],
    // [F1C-B6] The review called this a missed compaction item. It is not, and
    // the shipped item says so: vic-pavements.js:254-262 is "Verify moisture
    // ratio/dryback prior to surfacing", acceptance "Moisture ratio within
    // specified range per RC 316.14". That is a MOISTURE determination, and
    // `moisture_content` is a category no rule references at F1 (D-F1d).
    ['RC 316.14', 'vic-pavements.js:260'],
  ])('%s is plain unknown — no exclusion semantics needed (%s)', (value) => {
    expect(resolveTestCategory(value)).toBe(null);
  });

  it('a category BEATS a lab reference within one string — the ordering is the design', () => {
    // The shipped prod item (5 rows) names both an in-situ density method and
    // its laboratory MDD reference. It MUST resolve `compaction`, because the
    // item genuinely requires an in-situ density test.
    expect(resolveTestCategory('TMR Q141a/b (Insitu Density), TMR Q142a (MDD)')).toBe('compaction');
    // Its lab-reference limbs, alone, are lab references.
    expect(resolveTestCategory('TMR Q142a')).toBe(LAB_REFERENCE);
    expect(resolveTestCategory('MDD')).toBe(LAB_REFERENCE);
  });
});

// ---------------------------------------------------------------------------
// AT-56 — the shared candidate rule [F1C-B1] [F1C-B2].
//
// THIS FUNCTION IS THE ONLY PLACE ATTRIBUTION CANDIDATES ARE DECIDED, and BOTH
// `evaluate.ts` (the per-lot count) and `regime.ts` `streamEntryConforming` (the
// negative streak predicate) must route through it [C1C-20]. Patching one and
// leaving the other comparing a raw string against a category COMPILES, ships
// green, and silently makes every conformed lot read conforming — see §2.1.
// ---------------------------------------------------------------------------
describe('AT-56 candidateCategories is THE attribution rule, used by both callers', () => {
  it.each([
    [LAB_REFERENCE, 'compaction', []],
    [null, 'compaction', ['compaction']],
    ['compaction', null, ['compaction']],
    ['compaction', 'compaction', ['compaction']],
    [null, LAB_REFERENCE, []],
    [null, null, []],
    [LAB_REFERENCE, null, []],
    [LAB_REFERENCE, LAB_REFERENCE, []],
  ] as const)('(%s, %s) -> %s', (own, linked, expected) => {
    expect(candidateCategories(own, linked)).toEqual(expected);
  });

  it('a test whose OWN type is a lab reference NEVER attributes, however it is linked', () => {
    // The AT-57 scenario in miniature: six `MDD Standard` tests hung off the
    // shipped compaction item `AS 1289.5.4.1, RC 316.00, RC 316.10`.
    const own = resolveTestCategory('MDD Standard');
    const item = resolveTestCategory('AS 1289.5.4.1, RC 316.00, RC 316.10');
    expect(own).toBe(LAB_REFERENCE);
    expect(item).toBe('compaction');
    expect(candidateCategories(own, item)).toEqual([]);
  });

  it('the item limb rescues a test whose own type nobody has mapped', () => {
    const own = resolveTestCategory('Certificate Review Required'); // the AI extractor fallback
    const item = resolveTestCategory('AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00');
    expect(own).toBe(null);
    expect(candidateCategories(own, item)).toEqual(['compaction']);
  });
});

// ---------------------------------------------------------------------------
// The batch-scoped resolver (§4.6 [F1C-B4]).
// ---------------------------------------------------------------------------
describe('createCategoryResolver — memoization is transparent and bounded', () => {
  it('returns the same resolutions as the unmemoized function', () => {
    const resolve = createCategoryResolver();
    for (const value of [...VIC_SEED_COMPACTION_STRINGS, 'MDD Standard', 'survey', '', null]) {
      expect(resolve(value)).toBe(resolveTestCategory(value));
    }
  });

  it('caches by input string, including the null/empty key, and never re-resolves', () => {
    const cache = new Map<string, ReturnType<typeof resolveTestCategory>>();
    const resolve = createCategoryResolver(cache);
    resolve('Density Ratio');
    resolve('Density Ratio');
    resolve(null);
    resolve(undefined);
    resolve('survey'); // caches a `null` resolution — must not be re-resolved
    resolve('survey');
    expect([...cache.keys()].sort()).toEqual(['', 'Density Ratio', 'survey']);
    expect(cache.get('survey')).toBe(null);
  });

  it('the cache is bounded by DISTINCT strings, not by call count', () => {
    const cache = new Map<string, ReturnType<typeof resolveTestCategory>>();
    const resolve = createCategoryResolver(cache);
    for (let i = 0; i < 5_000; i += 1) {
      for (const value of VIC_SEED_COMPACTION_STRINGS) resolve(value);
    }
    expect(cache.size).toBe(VIC_SEED_COMPACTION_STRINGS.length);
  });
});

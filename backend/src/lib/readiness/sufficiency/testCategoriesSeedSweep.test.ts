// Wave F1.2 acceptance tests AT-58, AT-59 and AT-61 (spec §14, §5.4, §8.3).
//
// These read the SHIPPED SEEDERS AS TEXT. They cannot be imported: each
// `seed-itp-templates-*.js` constructs `new PrismaClient()` at module scope and
// calls `withItpTemplateSeedLock(prisma, main)`, exporting nothing — so an
// `import` would open a database connection and start seeding. One regex over
// the file contents gets every `testType`/`description`/`evidenceRequired`
// literal with no execution, no Prisma and no side effect.
//
// The point is not the registry file; it is that a future agent who adds a
// compaction-flavoured item to a VIC seed, or who edits an alias, sees CI say so.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyTestType, resolveTestCategory } from './testCategories.js';

const SEED_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../scripts/seeds/itp-templates',
);

/** `field: '…'`, tolerating escaped quotes. */
function fieldPattern(name: string): RegExp {
  return new RegExp(`\\b${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`);
}

function decode(raw: string | undefined): string {
  return (raw ?? '').replace(/\\'/g, "'").replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
}

/**
 * Item object literals in the seeders contain no nested braces (every field is a
 * string, a number or null), so the innermost-brace match IS the item list.
 * Verified below: it recovers exactly the 355 VIC items that carry a `testType`.
 */
const OBJECT_LITERAL = /\{[^{}]*\}/g;

interface SeedItem {
  file: string;
  testType: string;
  description: string;
  acceptanceCriteria: string;
  evidenceRequired: string;
}

/** An item literal, or null when the block is some other object in the file. */
function toSeedItem(file: string, block: string): SeedItem | null {
  if (!fieldPattern('description').test(block) || !/\bpointType:/.test(block)) return null;
  const field = (name: string) => decode(block.match(fieldPattern(name))?.[1]);
  return {
    file: file.replace('seed-itp-templates-', ''),
    testType: field('testType'),
    description: field('description'),
    acceptanceCriteria: field('acceptanceCriteria'),
    evidenceRequired: field('evidenceRequired'),
  };
}

function readSeedItems(filter: RegExp): SeedItem[] {
  const files = readdirSync(SEED_DIR)
    .filter((name) => filter.test(name))
    .sort();
  expect(files.length, `no seed modules matched ${filter}`).toBeGreaterThan(0);
  return files.flatMap((file) =>
    (readFileSync(path.join(SEED_DIR, file), 'utf8').match(OBJECT_LITERAL) ?? [])
      .map((block) => toSeedItem(file, block))
      .filter((item): item is SeedItem => item !== null),
  );
}

const VIC_MODULES = /^seed-itp-templates-vic-.*\.js$/;
/** `seed-itp-templates-nsw.js` plus the six `nsw-*.js` modules. */
const NSW_MODULES = /^seed-itp-templates-nsw(-.*)?\.js$/;
const ALL_MODULES = /^seed-itp-templates-.*\.js$/;

// ---------------------------------------------------------------------------
// AT-58 — the seed-derived fixture, across all EIGHT vic-* modules [F1C-B6]
// and, since the H2 fix, all SEVEN nsw modules.
//
// Parameterized by seed module, so D14.3 adds the NSW modules as rows rather
// than a new test (§10).
// ---------------------------------------------------------------------------

/**
 * The 20 distinct VIC seed `testType` values that resolve to `compaction`
 * (§5.1's measured sweep). A NEW resolving string, or a LOST one, fails CI.
 */
const VIC_COMPACTION_EXPECTED: readonly string[] = [
  'AS 1289 / RC 316.00',
  'AS 1289.5.4.1',
  'AS 1289.5.4.1 (Sand Replacement) or RC 316.00',
  'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00',
  'AS 1289.5.4.1, RC 316.00',
  'AS 1289.5.4.1, RC 316.00, RC 316.10',
  'AS 1289.5.4.1, RC 316.00, RC 330.03',
  'AS 1289.5.4.1, RC 330.03, RC 316.00',
  'RC 316.00',
  'RC 316.00 (Density Ratio and Moisture Ratio Lot Characteristics)',
  'RC 316.00 / AS 1289',
  'RC 316.00 / AS 1289 (grading, PI)',
  'RC 316.00 / AS 2891.14.5 / RC 500.05',
  'RC 316.00 / RC 317.01',
  'RC 316.00 / RC 500.05',
  'RC 316.00 / Survey',
  'RC 500.05 / RC 316.00',
  'Section 173 (density ratio)',
  'Sections 204/304 (DDR, Scale C)',
  'Standard / modified compaction (Section 173)',
];

/**
 * §5.4's adjudication list. Every VIC seed `testType` whose own value, item
 * `description` or `acceptanceCriteria` mentions compaction / density / DDR /
 * MDD and which resolves to `null` — each with a one-line reason.
 *
 * ADDING A COMPACTION-FLAVOURED ITEM TO ANY VIC SEED FAILS CI UNTIL IT IS
 * CLASSIFIED HERE. That is the point: the registry cannot silently fall behind
 * the seeders.
 *
 * All of these belong to categories NO RULE REFERENCES at F1 (D-F1d), so `null`
 * is the correct resolution for every one. **No genuine soil field-compaction
 * string is unresolved in any VIC seed** — that is the review's acceptance-gate
 * item 1, measured rather than asserted.
 */
const VIC_COMPACTION_SUSPECT_ADJUDICATION: Readonly<Record<string, string>> = {
  'Acoustic measurement': 'noise-wall acoustic performance; not a soil test',
  'AS 1012.3 (slump)': 'concrete slump (`concrete_slump`); the item mentions concrete compaction',
  'AS 1012.3.5': 'self-compacting concrete rheology; a concrete mix-design submission',
  'AS 1141.11.1 (Particle Size Distribution)': 'grading (`grading`)',
  'AS 1141.11.1, AS 1289.3.6.1': 'post-compaction grading and PI, not the density determination',
  'AS 1289 series (soil classification, compaction, chemical properties)':
    'a material-property SET, not a per-lot field density test (§5.4 out-of-scope phrasing)',
  'AS 1289.2.1.1': 'moisture content (`moisture_content`)',
  'AS 5101.4 (UCS test on compacted specimens)': 'UCS / binder-content mix design',
  'AS/NZS 2891 series': 'asphalt trial mix production',
  'AS/NZS 2891.8 (density/air voids from cores)': 'asphalt density (`asphalt_density`)',
  'AS/NZS 2891.9.2 (nuclear gauge) or cores': 'asphalt density (`asphalt_density`)',
  'AS/NZS 2891.9.3 (mensuration bulk density)': 'asphalt design air voids',
  'Concrete cylinder testing per Section 610': 'concrete strength (`concrete_strength`)',
  'Density, Marsh funnel, pH, sand content':
    'bentonite stabilising-fluid properties for bored piles; "density" here is fluid density',
  'In-situ moisture content vs OMC': 'moisture ratio (`moisture_content`)',
  'Infrared thermometer / calibrated probe': 'asphalt delivery temperature',
  Measurement: 'reinforcement placement measurement',
  Multiple: 'a trial-section evaluation naming no single method',
  'Nuclear density gauge / AS/NZS 2891.9.2': 'asphalt in-situ density (`asphalt_density`)',
  'RC 330.02': 'maximum allowable working time for stabilised material, not a test',
  'RC 330.03': 'density decay CORRECTION FACTOR, not a test method',
  'RC 500.05; Level survey': 'the acceptance/assessment procedure plus a survey; neither is a test',
  'Seam strength test (if specified)': 'geotextile seam strength',
  'Section 173 (test rolling)':
    'proof rolling, a visual/deflection check rather than a density test',
  'Section 407.27 (in-situ density/air voids)': 'asphalt in-situ density (`asphalt_density`)',
};

/**
 * The NSW strings that resolve to `compaction` once the TfNSW method codes are
 * aliased. BEFORE that fix this list was EMPTY while `tfnsw-q6.v1` shipped
 * `confirmed` — seven distinct shipped strings, on the two rules of a blocking
 * pack, all counting zero. That is the whole of H2, and this row is what would
 * have caught it.
 */
const NSW_COMPACTION_EXPECTED: readonly string[] = [
  'T166',
  'T173',
  'T173 (Nuclear) / T166',
  'T173 (Nuclear) / T166 / T162',
  'T173 / T106 / T108',
  'T173 / T162',
  'T173 / T166',
];

/** §5.4's adjudication list for the NSW modules — same contract as the VIC one. */
const NSW_COMPACTION_SUSPECT_ADJUDICATION: Readonly<Record<string, string>> = {
  'AS 2891.9.2': 'asphalt in-situ density / air voids from cores (`asphalt_density`)',
  'T120 / T121 / T180':
    'the three field MOISTURE CONTENT methods (R71 cl. 8.4.5) — a separate characteristic from density',
  'T120 / T180': 'same: moisture conditioning before compaction, not a density determination',
};

const SUSPECT_WORDS = /compaction|density|\bddr\b|\bmdd\b/i;

interface SweepFixture {
  label: string;
  modules: RegExp;
  /** Guards on the FIXTURE: if a seeder is reformatted so the regex stops matching, every assertion below would pass vacuously. */
  itemCount: number;
  distinctCount: number;
  compactionExpected: readonly string[];
  adjudication: Readonly<Record<string, string>>;
}

const SWEEPS: readonly SweepFixture[] = [
  {
    label: 'VIC (8 modules, 355 items, 264 distinct)',
    modules: VIC_MODULES,
    itemCount: 355,
    distinctCount: 264,
    compactionExpected: VIC_COMPACTION_EXPECTED,
    adjudication: VIC_COMPACTION_SUSPECT_ADJUDICATION,
  },
  {
    label: 'NSW (7 modules, 56 items, 35 distinct)',
    modules: NSW_MODULES,
    itemCount: 56,
    distinctCount: 35,
    compactionExpected: NSW_COMPACTION_EXPECTED,
    adjudication: NSW_COMPACTION_SUSPECT_ADJUDICATION,
  },
];

describe.each(SWEEPS)('AT-58 the shipped $label seeders, swept by the resolver', (sweep) => {
  const withTestType = readSeedItems(sweep.modules).filter((item) => item.testType !== '');
  const distinct = [...new Set(withTestType.map((item) => item.testType))];

  it('the text sweep recovers the whole corpus', () => {
    expect(withTestType.length).toBe(sweep.itemCount);
    expect(distinct.length).toBe(sweep.distinctCount);
  });

  it('the set of strings resolving to `compaction` is EXACTLY the expected set', () => {
    const resolving = distinct
      .filter((value) => resolveTestCategory(value) === 'compaction')
      .sort((a, b) => a.localeCompare(b));
    expect(resolving).toEqual([...sweep.compactionExpected].sort((a, b) => a.localeCompare(b)));
  });

  it('ZERO conflicts across every distinct value', () => {
    const conflicts = distinct.filter((value) => classifyTestType(value).conflict);
    expect(conflicts).toEqual([]);
  });

  it('every compaction-flavoured item that resolves to null is adjudicated', () => {
    const unadjudicated = new Set<string>();
    for (const item of withTestType) {
      const haystack = `${item.testType} ${item.description} ${item.acceptanceCriteria}`;
      if (!SUSPECT_WORDS.test(haystack)) continue;
      if (resolveTestCategory(item.testType) !== null) continue;
      if (item.testType in sweep.adjudication) continue;
      unadjudicated.add(`${item.testType}  [${item.file}]  ${item.description}`);
    }
    expect(
      [...unadjudicated],
      'a compaction-flavoured seed item resolves to null and is not adjudicated — ' +
        'classify it (field test => alias, lab reference => LAB_REFERENCE_TOKENS, ' +
        'other category => adjudicate in this file)',
    ).toEqual([]);
  });

  it('the adjudication list carries no stale rows', () => {
    const present = new Set(withTestType.map((item) => item.testType));
    const stale = Object.keys(sweep.adjudication).filter(
      (value) => !present.has(value) || resolveTestCategory(value) !== null,
    );
    expect(stale).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AT-59 — the union ceiling, pinned [F1C-R10].
// ---------------------------------------------------------------------------
describe('AT-59 mixed-method items resolve `compaction` today — §17.5s accepted ceiling', () => {
  // §4.3.2's conflict rule is what keeps "any token matches" honest, and at F1
  // it is STRUCTURALLY INERT: `compaction` is the only category with aliases
  // (D-F1d), so two tokens can never disagree and a mixed-method item silently
  // resolves `compaction`. Combined with the item limb, a GRADING test linked to
  // a grading-and-density item counts toward the six required density tests, and
  // §4.4's exclusion does not close that (a grading test's own type is UNKNOWN,
  // not a lab reference).
  //
  // Accepted rather than fixed because the exposure is bounded by RULE SCOPE:
  // `vicroads-204.v1/compaction-density` applies only to `earthworks_general`
  // and `earthworks_subgrade_prep`, and all three VIC strings below live in
  // DRAINAGE and ASPHALT seeds. Reaching the false count needs a drainage or
  // asphalt template assigned to an earthworks lot AND a non-density test linked
  // to it.
  //
  // THE H2 FIX WIDENS THIS AND SAYS SO. `T173 / T106 / T108` is a
  // `seed-itp-templates-nsw.js` EARTHWORKS item (Selected Material Zone lot
  // conformance), which IS inside `tfnsw-q6.v1/compaction-density`'s scope — so
  // on NSW the mixed-method ceiling needs no cross-activity template, just a
  // grading (T106) or liquid-limit (T108) test linked to that one item. Still
  // accepted rather than fixed, for the §4.3.2 reason: `compaction` remains the
  // only category with aliases, so the conflict rule cannot fire, and splitting
  // the string would need a `grading`/`atterberg` alias set no rule consumes.
  //
  // THE PR THAT SHIPS A SECOND CATEGORY MUST REVISIT THIS. At that point these
  // assertions change, and the change is visible rather than inherited.
  // Flip condition: the second category.
  it.each([
    ['RC 316.00 / Survey', 'vic-drainage.js:317'],
    ['RC 316.00 / AS 1289 (grading, PI)', 'vic-drainage.js:113'],
    ['RC 316.00 / AS 2891.14.5 / RC 500.05', 'vic-asphalt.js:923'],
    ['T173 / T106 / T108', 'nsw.js:280 — in `tfnsw-q6.v1` earthworks rule scope'],
    ['T173 / T162', 'nsw-pavements.js:100'],
  ])('%s resolves to compaction (%s)', (value) => {
    expect(resolveTestCategory(value)).toBe('compaction');
    expect(classifyTestType(value).conflict).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AT-61 — the description leak stays at zero [F1C-R6].
//
// `CreateTestModal.tsx:173` is `setValue('testType', item?.testType ||
// item?.description || '')`: picking an ITP item with NO `testType` writes the
// item's free-text DESCRIPTION into `test_results.test_type`. The blast radius
// is zero today, and the thing holding it at zero is a predicate in a frontend
// hook nobody wrote for this purpose — `useLotItpTestItems.ts:14-15`, which is
// an OR: `item.evidenceRequired === 'test' || Boolean(item.testType)`.
//
// So a leak needs `evidenceRequired === 'test'` AND an empty `testType` AND a
// description that resolves. No shipped seed item is in all three states. This
// test pins that at zero, so the day a seed or fixture creates a reachable leak,
// CI says so. It is a data-quality item for whoever next touches that modal
// (§17.2), deliberately not fixed here.
// ---------------------------------------------------------------------------
describe('AT-61 no shipped seed item can leak a resolving description into testType', () => {
  it.each([
    ['the 8 VIC modules', VIC_MODULES, 361],
    ['all 40 seed modules', ALL_MODULES, 1149],
  ])('%s', (_label, filter, expectedReachable) => {
    const items = readSeedItems(filter);
    const pickerReachable = items.filter(
      (item) => item.evidenceRequired === 'test' || Boolean(item.testType),
    );
    expect(pickerReachable.length).toBe(expectedReachable);

    const leaks = pickerReachable
      .filter((item) => item.testType === '')
      .filter((item) => resolveTestCategory(item.description) !== null)
      .map((item) => `${item.file}: ${item.description}`);
    expect(leaks).toEqual([]);
  });
});

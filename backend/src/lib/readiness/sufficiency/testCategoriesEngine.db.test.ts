// Wave F1.2 acceptance tests AT-29, AT-30, AT-57, AT-32 and AT-60 (spec §14).
//
// THE ACTUAL DELIVERABLE. The registry file is not what makes this trustworthy —
// these are: real strings, through the real production path
// (`checkConformancePrerequisites` / `checkConformancePrerequisitesBatch`),
// against real rows.
//
// Every string is a shipped string:
//   `AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00`  seed-itp-templates-vic-earthworks.js:206
//   `AS 1289.5.4.1, RC 316.00, RC 316.10`        seed-itp-templates-vic-earthworks.js:242
//   `Density Ratio` / `MDD Standard`             CreateTestModal.tsx:261 / :265
//   `density_ratio`                              18 production rows, sampleProjectData.ts:80
//   `compaction`                                 25 legacy production rows
//
// DB-backed, local disposable database only (`src/test/databaseSafety.ts`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../prisma.js';
import {
  checkConformancePrerequisites,
  checkConformancePrerequisitesBatch,
} from '../../conformancePrerequisites.js';
import { createCategoryResolver, type Resolution } from './testCategories.js';

const tag = `f1-engine-${Date.now()}`;

const VIC_ITEM_TYPE = 'AS 1289.5.4.1 or AS 1289.5.7.1, RC 316.00';
const VIC_MDD_ITEM_TYPE = 'AS 1289.5.4.1, RC 316.00, RC 316.10';

let companyId: string;
let userId: string;
/** VIC / VicRoads: the CONFIRMED `vicroads-204.v1` pack resolves, Scale A => 6. */
let projectId: string;
/** No state / no spec set: NO ruleset resolves. AT-31's control. */
let packlessProjectId: string;

let sequence = 0;

interface LotFixture {
  /** The ITP item's `testType`; null for an item with no test type. */
  itemTestType: string | null;
  /** One entry per test row: its stored `testType`. */
  tests: readonly string[];
  /** Link each test to the checklist item (the modal's primary path). */
  linked: boolean;
  passFail?: string;
  status?: string;
  inProject?: string;
}

async function seedLot(fixture: LotFixture): Promise<string> {
  sequence += 1;
  const projectFor = fixture.inProject ?? projectId;
  const template = await prisma.iTPTemplate.create({
    data: { projectId: projectFor, name: `Tpl ${tag}-${sequence}`, activityType: 'Earthworks' },
  });
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId: template.id,
      sequenceNumber: 1,
      description: 'Compaction test point',
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: fixture.itemTestType,
    },
  });
  const lot = await prisma.lot.create({
    data: {
      projectId: projectFor,
      lotNumber: `${tag}-L${sequence}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      testScale: 'A',
      status: 'completed',
    },
  });
  await prisma.iTPInstance.create({
    data: {
      lotId: lot.id,
      templateId: template.id,
      completions: { create: [{ checklistItemId: item.id, status: 'completed' }] },
    },
  });
  for (const testType of fixture.tests) {
    await prisma.testResult.create({
      data: {
        projectId: projectFor,
        lotId: lot.id,
        itpChecklistItemId: fixture.linked ? item.id : null,
        testType,
        passFail: fixture.passFail ?? 'pass',
        status: fixture.status ?? 'verified',
        enteredById: userId,
      },
    });
  }
  return lot.id;
}

async function compactionRule(lotId: string) {
  const result = await checkConformancePrerequisites(lotId);
  expect(result.error, `lot ${lotId} not found`).toBeUndefined();
  return {
    result,
    prerequisites: result.prerequisites!,
    rule: result.sufficiency?.rules.find((r) => r.testType === 'compaction') ?? null,
    unlinked: result.sufficiency?.unlinkedPassingTestIds ?? [],
    reasonCodes: result.sufficiency?.verdict.reasonCodes ?? [],
  };
}

beforeAll(async () => {
  companyId = (await prisma.company.create({ data: { name: `Co ${tag}` } })).id;
  userId = (
    await prisma.user.create({
      data: {
        email: `${tag}@example.test`,
        passwordHash: 'x',
        fullName: 'F1 Engine User',
        companyId,
        roleInCompany: 'project_manager',
      },
    })
  ).id;
  projectId = (
    await prisma.project.create({
      data: {
        name: `Project ${tag}`,
        projectNumber: `${tag}-P1`,
        companyId,
        state: 'VIC',
        specificationSet: 'VicRoads',
      },
    })
  ).id;
  packlessProjectId = (
    await prisma.project.create({
      data: {
        name: `Packless ${tag}`,
        projectNumber: `${tag}-P2`,
        companyId,
        // QLD/TMR: no shipped pack (§9 — no TMR/DIT SA/MRWA pack exists), so
        // `resolveRuleset` returns null and nothing this slice does can move.
        state: 'QLD',
        specificationSet: 'TMR',
      },
    })
  ).id;
}, 60_000);

afterAll(async () => {
  const projectIds = [projectId, packlessProjectId];
  await prisma.testResult.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPCompletion.deleteMany({
    where: { itpInstance: { lot: { projectId: { in: projectIds } } } },
  });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId: { in: projectIds } } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPChecklistItem.deleteMany({
    where: { template: { projectId: { in: projectIds } } },
  });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

// ---------------------------------------------------------------------------
// AT-29 — THE REVIEW'S ACCEPTANCE GATE, END TO END.
//
// Items 1 and 2 of the review's "Suggested acceptance gate before block mode",
// as one table-driven DB test: a test created from each shipped Victorian
// compaction ITP test type maps to the canonical rule and COUNTS, and the actual
// UI choices — `Density Ratio` foremost — count correctly.
// ---------------------------------------------------------------------------
describe('AT-29 six verified passing tests read 6 of 6 in EVERY entry vocabulary', () => {
  it.each([
    ['Density Ratio (modal datalist :261), unlinked', 'Density Ratio', VIC_ITEM_TYPE, false],
    ['density_ratio (18 prod rows), unlinked', 'density_ratio', VIC_ITEM_TYPE, false],
    ['tests LINKED to the shipped VIC item', 'Certificate Review Required', VIC_ITEM_TYPE, true],
    ['legacy compaction (25 prod rows), linked', 'compaction', 'compaction', true],
    ['Field Density Nuclear (modal :263), unlinked', 'Field Density Nuclear', VIC_ITEM_TYPE, false],
    ['Dry Density Ratio (modal :262), unlinked', 'Dry Density Ratio', VIC_ITEM_TYPE, false],
  ])('%s', async (_label, testType, itemTestType, linked) => {
    const six = await seedLot({ itemTestType, tests: Array(6).fill(testType), linked });
    const { rule } = await compactionRule(six);
    expect(rule).toMatchObject({
      requiredCount: 6,
      passingCount: 6,
      state: 'satisfied',
    });

    const five = await seedLot({ itemTestType, tests: Array(5).fill(testType), linked });
    const short = await compactionRule(five);
    expect(short.rule).toMatchObject({
      requiredCount: 6,
      passingCount: 5,
      state: 'insufficient',
    });
    expect(short.prerequisites.sufficiencyBlocks).toBe(false); // `warn` mode
  });

  it('pending and failing tests are counted separately and never as passing', async () => {
    const lotId = await seedLot({
      itemTestType: VIC_ITEM_TYPE,
      tests: Array(6).fill('Density Ratio'),
      linked: false,
      passFail: 'fail',
    });
    const { rule } = await compactionRule(lotId);
    expect(rule).toMatchObject({ passingCount: 0, failedCount: 6, state: 'insufficient' });
  });
});

// ---------------------------------------------------------------------------
// AT-30 / AT-57 — THE LABORATORY MDD BOUNDARY, both limbs [F1C-B2].
//
// AT-30 is the UNLINKED case; AT-57 is the LINKED one, and the linked one is the
// test Rev 1 did not write. Under Rev 1's design the six tests resolved `null`
// on their own limb and `compaction` on the item limb, so a lot with ZERO field
// density tests read "6 of 6 — met". That was unreachable only because no item
// is typed literally `compaction`; F1 makes it reachable on EVERY shipped VIC
// compaction item, which is why the exclusion had to become a mechanism.
// ---------------------------------------------------------------------------
describe('AT-30 / AT-57 six laboratory MDD tests read 0 of 6, linked or not', () => {
  it.each([
    ['AT-30 unlinked', false],
    ['AT-57 LINKED to the shipped compaction item', true],
  ])('%s', async (_label, linked) => {
    const lotId = await seedLot({
      itemTestType: VIC_MDD_ITEM_TYPE,
      tests: Array(6).fill('MDD Standard'),
      linked,
    });
    const { rule, unlinked, reasonCodes } = await compactionRule(lotId);

    // The count is not inflated…
    expect(rule).toMatchObject({ requiredCount: 6, passingCount: 0, state: 'insufficient' });
    // …AND the user is told why. Both halves, or the exclusion is silent.
    expect(unlinked).toHaveLength(6);
    expect(reasonCodes).toContain('tests_unlinked_to_itp_item');
  });

  it('MDD Modified is excluded on the same basis', async () => {
    const lotId = await seedLot({
      itemTestType: VIC_MDD_ITEM_TYPE,
      tests: Array(6).fill('MDD Modified'),
      linked: true,
    });
    const { rule } = await compactionRule(lotId);
    expect(rule?.passingCount).toBe(0);
  });

  it('the item limb still rescues a test whose own type is merely UNKNOWN', async () => {
    // The distinction that makes LAB_REFERENCE worth having: `null` means
    // "nobody mapped this", and the item limb applies. `LAB_REFERENCE` means
    // "we mapped it, and it is not a countable field test", and it does not.
    const lotId = await seedLot({
      itemTestType: VIC_ITEM_TYPE,
      tests: Array(6).fill('Certificate Review Required'),
      linked: true,
    });
    const { rule } = await compactionRule(lotId);
    expect(rule).toMatchObject({ passingCount: 6, state: 'satisfied' });
  });
});

// ---------------------------------------------------------------------------
// AT-31 (the pack-less control) — nothing outside a resolved pack moves.
// ---------------------------------------------------------------------------
describe('AT-31 a lot whose project resolves no ruleset is untouched by any of this', () => {
  it('reads `unknown` / no_ruleset_for_project regardless of test vocabulary', async () => {
    for (const testType of ['Density Ratio', 'MDD Standard', 'compaction']) {
      const lotId = await seedLot({
        itemTestType: VIC_ITEM_TYPE,
        tests: Array(6).fill(testType),
        linked: false,
        inProject: packlessProjectId,
      });
      const { result, prerequisites } = await compactionRule(lotId);
      expect(result.sufficiency?.state).toBe('unknown');
      expect(result.sufficiency?.rules).toEqual([]);
      expect(result.sufficiency?.unknownCauses).toEqual(['no_ruleset_for_project']);
      expect(prerequisites.sufficiencyBlocks).toBe(false);
    }
  });

  it('the conform GATE stays exactly as strict as before — §8.4s conservative divergence', async () => {
    // Six unlinked verified passing `Density Ratio` tests. Sufficiency now says
    // "6 of 6 — met"; `predicates.ts` `testMatchesItem` (unchanged by design,
    // §17.1 / §19) still refuses, because the raw strings differ. Read as two
    // claims that is a contradiction; §8.4's copy makes it one instruction.
    // NOTHING conforms after F1.2 that could not conform before it.
    const lotId = await seedLot({
      itemTestType: VIC_ITEM_TYPE,
      tests: Array(6).fill('Density Ratio'),
      linked: false,
    });
    const { result, prerequisites, rule } = await compactionRule(lotId);
    expect(rule?.state).toBe('satisfied');
    expect(prerequisites.hasPassingTest).toBe(false);
    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toContain(
      'ITP requires a matching passing verified test result',
    );
    // …and the outstanding item reads as an ACTION (§8.4, AT-62).
    expect(prerequisites.outstandingTestItems?.[0]?.state).toBe('unmatched_result_exists');
  });
});

// ---------------------------------------------------------------------------
// AT-32 / AT-60 — M39 byte-identity across the resolver seam, and the batch cache.
// ---------------------------------------------------------------------------
describe('AT-32 / AT-60 the batch resolver is transparent and bounded', () => {
  it('the single path and the batched path produce byte-identical verdicts', async () => {
    const lotIds = [
      await seedLot({
        itemTestType: VIC_ITEM_TYPE,
        tests: Array(6).fill('Density Ratio'),
        linked: false,
      }),
      await seedLot({
        itemTestType: VIC_MDD_ITEM_TYPE,
        tests: Array(6).fill('MDD Standard'),
        linked: true,
      }),
      await seedLot({
        itemTestType: 'compaction',
        tests: Array(3).fill('compaction'),
        linked: true,
      }),
    ];

    // The single path creates a FRESH resolver per call; the batch path shares
    // ONE across every member. Memoizing a pure function is transparent, so the
    // verdicts must be byte-identical.
    const batch = await checkConformancePrerequisitesBatch(lotIds);
    for (const lotId of lotIds) {
      const single = await checkConformancePrerequisites(lotId);
      expect(JSON.stringify(batch.get(lotId))).toBe(JSON.stringify(single));
    }
  });

  it('the cache is keyed on DISTINCT strings, not on row count (§4.6, AT-60)', async () => {
    const cache = new Map<string, Resolution>();
    const resolve = createCategoryResolver(cache);
    // 5,000 lots × 12 strings: what the batch actually does.
    for (let lot = 0; lot < 5_000; lot += 1) {
      for (const value of [
        VIC_ITEM_TYPE,
        VIC_MDD_ITEM_TYPE,
        'Density Ratio',
        'density_ratio',
        'MDD Standard',
        'compaction',
        'survey',
        'AS 1012.9 (Compressive Strength)',
        'Field Density Nuclear',
        'Dry Density Ratio',
        'RC 316.00',
        '',
      ]) {
        resolve(value);
      }
    }
    expect(cache.size).toBe(12);
  });

  it('total resolution wall-clock over a 5,000-member batch is well under 25 ms', async () => {
    // §12's aggregate budget [F1C-B4]. 5,000 lots × 35 template item strings is
    // the VIC earthworks template's real shape. Unmemoized this measured
    // +436 ms against 36 ms of headroom on the #1581 claim-create budget; this
    // asserts the memoized path stays inside the budget the spec replaced it
    // with.
    const strings = Array.from({ length: 35 }, (_, i) =>
      i === 0 ? VIC_ITEM_TYPE : i === 1 ? 'Density Ratio' : `AS 1289.${i}.4.1, RC 316.00`,
    );
    const resolve = createCategoryResolver();
    const startedAt = performance.now();
    for (let lot = 0; lot < 5_000; lot += 1) {
      for (const value of strings) resolve(value);
    }
    const elapsed = performance.now() - startedAt;
    expect(elapsed, `batch resolution took ${elapsed.toFixed(1)}ms`).toBeLessThan(25);
  });
});

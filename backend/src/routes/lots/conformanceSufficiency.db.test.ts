// Wave C1.1 — the conform-gate sufficiency pin (spec §11 C1.1 gate item 3,
// §14 AT-10, AT-11, AT-14).
//
// The characterization corpus covers the lot-readiness and claim-readiness
// ENDPOINTS; it does not cover the conform GATE [C1R-12]. So the gate needs its
// own pin, and it is the two things C1.1 promises:
//
//   1. no live project's conform outcome changes — proven at `mode: 'off'` and
//      `mode: 'warn'` against a lot with a real, RESOLVED shortfall;
//   2. §5.3's HARD PROHIBITION — sufficiency never enters
//      `getClaimBlockingReasonsForConformedLot`, because that function feeds
//      `lotClaimEligible`'s blocking set and a retroactive shortfall must never
//      un-claim a previously claimable lot.
//
// A SEPARATE file from `lotConformanceDecision.db.test.ts`, which spec §11 C1.1
// names: that suite's fixture project is NSW/TfNSW, and `tfnsw-r44.v1` is DRAFT,
// so it can never block at any mode and an "unchanged decision" assertion there
// would be vacuous. This fixture is VIC/VicRoads, where the CONFIRMED pack
// resolves and the assertion has teeth. (The draft-can-never-block guarantee is
// pinned end-to-end in that other suite.)
//
// DB-backed: `Project.testSufficiencyMode` is a real column and the gate reads
// through Prisma. Local disposable database only (`src/test/databaseSafety.ts`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  checkConformancePrerequisites,
  getClaimBlockingReasonsForConformedLot,
} from '../../lib/conformancePrerequisites.js';
import { prisma } from '../../lib/prisma.js';
import { VICROADS_204_V2 } from '../../lib/readiness/sufficiency/rulesets/vicroads-204.v2.js';

const tag = `conform-suff-${Date.now()}`;

let companyId: string;
let userId: string;
let projectId: string;
let shortLotId: string;

async function setMode(mode: string): Promise<void> {
  await prisma.project.update({ where: { id: projectId }, data: { testSufficiencyMode: mode } });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.test`,
      passwordHash: 'x',
      fullName: 'Conform Sufficiency User',
      companyId,
      roleInCompany: 'project_manager',
    },
  });
  userId = user.id;

  // VIC / VicRoads, so the CONFIRMED `vicroads-204.v2` pack resolves (v1 is
  // frozen and `effectiveTo`-closed since D14.2 §6.5).
  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId,
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  projectId = project.id;

  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Tpl ${tag}`, activityType: 'Earthworks' },
  });
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId: template.id,
      description: 'Compaction test point',
      sequenceNumber: 1,
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'compaction',
    },
  });

  // A lot that PASSES today's existential gate (one passing verified test per
  // test-required item) but is SHORT under the quantitative rule: clause
  // 204.13(a) requires six at Scale A, the ruleset default. This is exactly the
  // ceiling C1 raises — `every` over items, `some` over tests.
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-SHORT`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status: 'in_progress',
    },
  });
  shortLotId = lot.id;
  await prisma.iTPInstance.create({
    data: {
      lotId: shortLotId,
      templateId: template.id,
      completions: { create: [{ checklistItemId: item.id, status: 'completed' }] },
    },
  });
  await prisma.testResult.create({
    data: {
      projectId,
      lotId: shortLotId,
      itpChecklistItemId: item.id,
      testType: 'compaction',
      passFail: 'pass',
      status: 'verified',
      enteredById: userId,
    },
  });
}, 60_000);

afterAll(async () => {
  await prisma.testResult.deleteMany({ where: { projectId } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('the fixture really does resolve a confirmed pack with a real shortfall', () => {
  it('resolves vicroads-204.v2 at Scale A and reports 1 of 6', async () => {
    await setMode('warn');
    const result = await checkConformancePrerequisites(shortLotId);
    expect(VICROADS_204_V2.status).toBe('confirmed');
    expect(result.sufficiency?.rules).toHaveLength(1);
    const rule = result.sufficiency!.rules[0];
    expect(rule.state).toBe('insufficient');
    expect(rule.requiredCount).toBe(6);
    expect(rule.passingCount).toBe(1);
    expect(rule.citation.confirmed).toBe(true);
    expect(rule.citation.clause).toBe('204.13(a)');
  });
});

describe('AT-14 the conform decision is UNCHANGED at mode off and warn', () => {
  it.each(['off', 'warn'])('mode=%s: the shortfall never reaches canConform', async (mode) => {
    await setMode(mode);
    const result = await checkConformancePrerequisites(shortLotId);
    // The existential gate is satisfied, so the lot conforms exactly as it did
    // before C1 — this is the "no live project's conform outcome changes" claim.
    expect(result.prerequisites!.hasPassingTest).toBe(true);
    expect(result.prerequisites!.sufficiencyBlocks).toBe(false);
    expect(result.canConform).toBe(true);
    // …and no sufficiency string leaks into the blocking reasons.
    expect(result.blockingReasons).toEqual([]);
  });

  it('AT-10 mode=block on the confirmed pack DOES block, with the numbers cited', async () => {
    await setMode('block');
    const result = await checkConformancePrerequisites(shortLotId);
    expect(result.prerequisites!.sufficiencyBlocks).toBe(true);
    expect(result.canConform).toBe(false);
    expect(result.blockingReasons).toEqual([
      'Requires 6 compaction tests (DTP (VicRoads) Section 204 – Earthworks, clause 204.13(a)) — 1 verified conforming',
    ]);
  });

  it('an unrecognised mode falls back to `warn`, NEVER to `block`', async () => {
    // A typo must not start gating live production work.
    await setMode('BLOKC');
    const result = await checkConformancePrerequisites(shortLotId);
    expect(result.prerequisites!.sufficiencyBlocks).toBe(false);
    expect(result.canConform).toBe(true);
  });
});

describe('AT-11 §5.3 PROHIBITION: sufficiency never blocks a claim', () => {
  it('getClaimBlockingReasonsForConformedLot is byte-identical across every mode', async () => {
    const outputs: string[] = [];
    for (const mode of ['off', 'warn', 'block']) {
      await setMode(mode);
      const result = await checkConformancePrerequisites(shortLotId);
      // Both readings, since they take different branches inside the function.
      outputs.push(JSON.stringify(getClaimBlockingReasonsForConformedLot(result)));
      outputs.push(
        JSON.stringify(
          getClaimBlockingReasonsForConformedLot(result, { conformanceOverridden: true }),
        ),
      );
    }
    // Six readings, ONE distinct value. A sufficiency reason placed in this
    // function would make a retroactive shortfall silently un-claim a
    // previously claimable lot.
    expect(new Set(outputs).size).toBe(1);
    expect(JSON.parse(outputs[0])).toEqual([]);
  });
});

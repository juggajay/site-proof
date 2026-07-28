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
// names: that suite's fixture project is NSW/TfNSW, and its lots carry no
// canonical activity, so no rule matches and an "unchanged decision" assertion
// there would be vacuous. This fixture's MAIN project is VIC/VicRoads, where the
// confirmed pack resolves at its default scale and the assertion has teeth.
// D14.3 adds a second, NSW project here for AT-41a only.
//
// DB-backed: `Project.testSufficiencyMode` is a real column and the gate reads
// through Prisma. Local disposable database only (`src/test/databaseSafety.ts`).

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  checkConformancePrerequisites,
  checkConformancePrerequisitesBatch,
  getClaimBlockingReasonsForConformedLot,
} from '../../lib/conformancePrerequisites.js';
import { prisma } from '../../lib/prisma.js';
import { VICROADS_204_V2 } from '../../lib/readiness/sufficiency/rulesets/vicroads-204.v2.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { lotsRouter } from '../lots.js';

// Wave C3 Phase A, AT-96. The two ROUTES, not the library — the finding
// `[C3R-B6]` is that one of them supplies no regime fetcher, and only a request
// through the route can show that.
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

const tag = `conform-suff-${Date.now()}`;

let companyId: string;
let userId: string;
let projectId: string;
let shortLotId: string;
let nswProjectId: string;
let nswBadScaleLotId: string;
// C3 AT-96: a token for the two routes, and the checklist item the eligibility
// fixture's conformed lots attribute their tests to.
let routeToken: string;
let checklistItemId: string;

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
  checklistItemId = item.id;
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

  // D14.3 AT-41a — an NSW project resolving `tfnsw-q6.v1`, carrying a lot whose
  // `testScale` is the VIC value 'A'. That is not a Q6 band, and it is exactly
  // what any row written before the §9.2 whitelist shipped can hold; a validator
  // cannot clean those rows retroactively.
  const nswProject = await prisma.project.create({
    data: {
      name: `Project ${tag} NSW`,
      projectNumber: `${tag}-P2`,
      companyId,
      state: 'NSW',
      specificationSet: 'TfNSW',
      testSufficiencyMode: 'block',
    },
  });
  nswProjectId = nswProject.id;
  const nswLot = await prisma.lot.create({
    data: {
      projectId: nswProjectId,
      lotNumber: `${tag}-NSW-BADSCALE`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status: 'in_progress',
      testScale: 'A',
      quantityValue: 3000,
      quantityUnit: 'm2',
    },
  });
  nswBadScaleLotId = nswLot.id;

  // ---- C3 AT-96 fixture ---------------------------------------------------
  // Three consecutive CONFORMING lots in `shortLotId`'s stream (same project +
  // activitySlug), each with an attributable verified passing test — the
  // 204.14(c) eligibility trigger. It changes no count `[C1C-6]`; it changes
  // whether the regime fold RESOLVED, which is precisely what a route with no
  // fetcher cannot know.
  for (let i = 0; i < 3; i += 1) {
    const conformed = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-CONF-${i}`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        activitySlug: 'earthworks_general',
        status: 'conformed',
        conformedAt: new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 60_000),
        conformedById: userId,
      },
    });
    await prisma.testResult.create({
      data: {
        projectId,
        lotId: conformed.id,
        itpChecklistItemId: checklistItemId,
        testType: 'compaction',
        passFail: 'pass',
        status: 'verified',
        enteredById: userId,
      },
    });
  }

  const routeUser = await registerTestUser(app, {
    emailPrefix: 'conform-suff-route',
    fullName: 'Conform Sufficiency Route User',
    companyId,
    roleInCompany: 'project_manager',
  });
  routeToken = routeUser.token;
  await prisma.projectUser.create({
    data: { projectId, userId: routeUser.userId, role: 'project_manager', status: 'active' },
  });
}, 120_000);

afterAll(async () => {
  await prisma.testResult.deleteMany({ where: { projectId } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId: nswProjectId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, nswProjectId] } } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('AT-96 `/conform-status` agrees with `/readiness` — including the regime fold', () => {
  // `[C3R-B6]`. Before Phase A, `qualityRoutes.ts:396` called
  // `checkConformancePrerequisites(id)` with NO client and NO options, so
  // `regimeByRuleId` stayed empty and every rule read regime `full`. The lot
  // page (`:313`) supplied `prismaRegimeStreamFetcher()` and did not.
  //
  // Both routes still report `requiredCount: 6` — eligibility never lowers a
  // count `[C1C-6]` — so a state/count-only assertion would pass on a broken
  // route. The fold's OBSERVABLE output is `reducedFrequencyEligible` and
  // `regimeBasis`, and THAT is what fails at `5265a649`. The moment any pack
  // ships reduced FIGURES, the same defect moves the count too.
  async function get(path: string) {
    const res = await request(app).get(path).set('Authorization', `Bearer ${routeToken}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('returns the resolved regime, not the un-folded default', async () => {
    await setMode('warn');
    const body = await get(`/api/lots/${shortLotId}/conform-status`);
    const rule = body.sufficiency.rules[0];

    // The half that was already true.
    expect(body.sufficiency.state).toBe('insufficient');
    expect(rule.requiredCount).toBe(6);
    // The half that was not: with no fetcher this is `false` and `regimeBasis`
    // is absent, because the stream was never read.
    expect(rule.reducedFrequencyEligible).toBe(true);
    expect(rule.regimeBasis.lotIds).toHaveLength(3);
  });

  it('and the lot page says the same thing, in words, for the same lot', async () => {
    const readiness = await get(`/api/lots/${shortLotId}/readiness`);
    const titles = JSON.stringify(readiness);
    expect(titles).toContain('Eligible to request reduced test frequency');
    expect(titles).toContain('3 consecutive conforming lots recorded');
  });
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

describe('AT-41a an unrecognised band on an NSW lot cannot 500 the claim path', () => {
  // The banded branch indexes `countByAreaBand.byScale[scaleValue]`. With the
  // VIC value 'A' on a Q6 lot that lookup is `undefined`, and scanning it would
  // THROW inside `computeConformanceResult` — which is DB-free and shared by the
  // single-conform path AND the batched claim path, so ONE such row would 500
  // claim create at the 5,000-member ceiling. Asserted at the BATCH level too,
  // because that is where the production 500 would land.
  it('degrades honestly on the single-conform path, at mode=block', async () => {
    const result = await checkConformancePrerequisites(nswBadScaleLotId);
    expect(result.sufficiency?.ruleset?.id).toBe('tfnsw-q6.v1');
    const rule = result.sufficiency!.rules[0];
    expect(rule.state).toBe('unknown');
    expect(rule.requiredCount).toBeNull();
    expect(rule.unknownCauses).toEqual(['scale_not_recognised']);
    // `unknown` never blocks — the honest consequence of unrecognised data.
    expect(result.prerequisites!.sufficiencyBlocks).toBe(false);
  });

  it('and inside a BATCH containing that lot beside a VIC lot — no throw, both resolved', async () => {
    await setMode('block');
    const batch = await checkConformancePrerequisitesBatch([nswBadScaleLotId, shortLotId]);
    expect(batch.size).toBe(2);
    expect(batch.get(nswBadScaleLotId)!.sufficiency!.rules[0].state).toBe('unknown');
    // The VIC member of the same batch still gets its real, blocking shortfall,
    // so the NSW lot degrading did not poison the shared pass.
    expect(batch.get(shortLotId)!.sufficiency!.rules[0].requiredCount).toBe(6);
    expect(batch.get(shortLotId)!.prerequisites!.sufficiencyBlocks).toBe(true);
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

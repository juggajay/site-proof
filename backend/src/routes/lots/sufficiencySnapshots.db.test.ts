// Wave C1.2 — the decision SNAPSHOTS and the `block` mode, end to end
// (spec §5.1.2, §5.4, §11 C1.2, §14 AT-10, AT-15, AT-16).
//
// C1.1's `conformanceSufficiency.db.test.ts` pins the GATE at the
// `checkConformancePrerequisites` level. This suite pins what C1.1 could not:
//
//   * the block reaching the real `POST /api/lots/:id/conform` response, and
//     being INERT at `off`/`warn` on the same lot — the exit-gate claim
//     "`block` proven on a CONFIRMED pack and proven inert at warn/off";
//   * AT-16, a force-conform recording the shortfall in the `lot_conformance`
//     snapshot, which is the whole reason the snapshot carries `sufficiency`;
//   * AT-15, retroactivity: a shortfall that only appears because a PAST test
//     was corrected shows up on an ALREADY-CONFORMED lot.
//
// VIC / VicRoads, so the CONFIRMED `vicroads-204.v2` pack resolves and the
// assertions have teeth. (An NSW fixture now resolves `tfnsw-q6.v1`, but that
// pack declares no `defaultScale`, so it would read `unknown` until a band were
// recorded and the shortfall assertions here would be vacuous.)
//
// DB-backed: `Project.testSufficiencyMode` is a real column and the snapshot is
// a real row. Local disposable database only (`src/test/databaseSafety.ts`).

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildLotReadinessFromInputs } from '../../lib/evidenceReadiness.js';
import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { prisma } from '../../lib/prisma.js';
import { decodeLotConformanceResult } from '../../lib/readiness/requirements/lotConformance.v1.js';
import { prismaRegimeStreamFetcher } from '../../lib/readiness/sufficiency/prismaStream.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { lotsRouter } from '../lots.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

const tag = `suff-snap-${Date.now()}`;

let authToken: string;
let userId: string;
let companyId: string;
let projectId: string;
let templateId: string;
let checklistItemId: string;
let shortLotId: string;

function setMode(mode: string) {
  return prisma.project.update({ where: { id: projectId }, data: { testSufficiencyMode: mode } });
}

function conform(lotId: string, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/lots/${lotId}/conform`)
    .set('Authorization', `Bearer ${authToken}`)
    .send(body);
}

async function lotConformanceSnapshot(lotId: string) {
  const rows = await prisma.requirementEvaluation.findMany({
    where: { projectId, entityId: lotId },
  });
  expect(rows).toHaveLength(1);
  return decodeLotConformanceResult(rows[0]);
}

/** A lot that passes the EXISTENTIAL gate on `passingTests` tests but needs six. */
async function createLot(suffix: string, passingTests: number, status = 'in_progress') {
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status,
    },
  });
  await prisma.iTPInstance.create({
    data: {
      lotId: lot.id,
      templateId,
      completions: { create: [{ checklistItemId, status: 'completed' }] },
    },
  });
  for (let index = 0; index < passingTests; index += 1) {
    await prisma.testResult.create({
      data: {
        projectId,
        lotId: lot.id,
        itpChecklistItemId: checklistItemId,
        testType: 'compaction',
        passFail: 'pass',
        status: 'verified',
        enteredById: userId,
      },
    });
  }
  return lot;
}

beforeAll(async () => {
  const registered = await registerTestUser(app, {
    fullName: 'Sufficiency Snapshot Owner',
    emailPrefix: tag,
  });
  authToken = registered.token;
  userId = registered.userId;

  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  // `owner`, because AT-16 exercises FORCE-conform (`LOT_FORCE_CONFORMERS`).
  await prisma.user.update({
    where: { id: userId },
    data: { companyId, roleInCompany: 'owner' },
  });

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
  templateId = template.id;
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: 'Compaction test point',
      sequenceNumber: 1,
      pointType: 'standard',
      responsibleParty: 'contractor',
      evidenceRequired: 'test',
      testType: 'compaction',
    },
  });
  checklistItemId = item.id;

  shortLotId = (await createLot('SHORT', 1)).id;
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
}, 60_000);

afterEach(async () => {
  await setMode('warn');
});

afterAll(async () => {
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.testResult.deleteMany({ where: { projectId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('AT-10 `block` end to end on a CONFIRMED pack, inert at off and warn', () => {
  it.each(['off', 'warn'])('mode=%s: POST /conform still succeeds', async (mode) => {
    const lot = await createLot(`inert-${mode}`, 1);
    await setMode(mode);

    const res = await conform(lot.id);

    expect(res.status).toBe(200);
    expect((await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).status).toBe(
      'conformed',
    );
    // The snapshot still RECORDS the shortfall — showing it is not the same as
    // gating on it. That distinction is the whole `warn` rollout step.
    const snapshot = await lotConformanceSnapshot(lot.id);
    expect(snapshot.conformable).toBe(true);
    expect(snapshot.sufficiency).toMatchObject({
      state: 'insufficient',
      insufficientRules: 1,
      worstShortfall: 5,
      mode,
      blocks: false,
      ruleset: { id: 'vicroads-204.v2', status: 'confirmed' },
    });
  });

  it('mode=block: POST /conform is REFUSED with the numbers and the clause', async () => {
    await setMode('block');

    const res = await conform(shortLotId);

    expect(res.status).toBe(400);
    // The numbers and the clause ride the error DETAILS, where the existing
    // conform failures already put their blocking reasons.
    expect(res.body.error.details.blockingReasons).toEqual([
      'Requires 6 compaction tests (DTP (VicRoads) Section 204 – Earthworks, clause 204.13(a)) — 1 verified conforming',
    ]);
    expect(res.body.error.details.prerequisites.sufficiencyBlocks).toBe(true);
    expect((await prisma.lot.findUniqueOrThrow({ where: { id: shortLotId } })).status).toBe(
      'in_progress',
    );
    // A refused decision is not a decision: nothing is recorded.
    expect(
      await prisma.requirementEvaluation.count({ where: { projectId, entityId: shortLotId } }),
    ).toBe(0);
  });

  it('mode=block: a lot with ENOUGH tests conforms normally', async () => {
    const lot = await createLot('sufficient', 6);
    await setMode('block');

    expect((await conform(lot.id)).status).toBe(200);
    const snapshot = await lotConformanceSnapshot(lot.id);
    expect(snapshot.sufficiency).toMatchObject({
      state: 'satisfied',
      insufficientRules: 0,
      worstShortfall: 0,
      blocks: false,
    });
  });
});

describe('AT-16 a force-conform past a block records the shortfall', () => {
  it('records insufficient_test_count when sufficiency is the ONLY blocker (review F5)', async () => {
    // Every legacy prerequisite passes — ITP complete, a passing verified test,
    // no open NCRs — so `insufficient_test_count` is the only thing that made
    // this lot unconformable. Before F5 the reason-code allowlist omitted it and
    // the immutable record read `conformable: false, blockingReasonCodes: []`:
    // the one thing a force-conform snapshot exists to say, silently dropped.
    const lot = await createLot('f5-only-blocker', 1);
    await setMode('block');

    const res = await conform(lot.id, { force: true, reason: 'Client accepted the shortfall' });

    expect(res.status).toBe(200);
    const snapshot = await lotConformanceSnapshot(lot.id);
    expect(snapshot.conformable).toBe(false);
    expect(snapshot.overridden).toBe(true);
    expect(snapshot.blockingReasonCodes).toEqual(['insufficient_test_count']);
  });

  it('writes the required/have numbers and the clause into the snapshot', async () => {
    const lot = await createLot('forced', 2);
    await setMode('block');

    const res = await conform(lot.id, { force: true, reason: 'Superintendent accepted' });

    expect(res.status).toBe(200);
    const snapshot = await lotConformanceSnapshot(lot.id);
    expect(snapshot.overridden).toBe(true);
    expect(snapshot.conformable).toBe(false);
    expect(snapshot.blockingReasonCodes).toEqual(['insufficient_test_count']);
    expect(snapshot.sufficiency).toMatchObject({
      state: 'insufficient',
      insufficientRules: 1,
      // Six required, two verified conforming — exactly what was overridden.
      worstShortfall: 4,
      mode: 'block',
      blocks: true,
    });
    const [rule] = snapshot.sufficiency!.rules!;
    expect(rule.requiredCount).toBe(6);
    expect(rule.passingCount).toBe(2);
    expect(rule.citation).toMatchObject({ clause: '204.13(a)', confirmed: true });
  });
});

describe('AT-15 retroactivity is observable on an ALREADY-CONFORMED lot', () => {
  it('a later correction to a past test surfaces on the conformed lot', async () => {
    const lot = await createLot('retro', 6);
    await setMode('warn');
    expect((await conform(lot.id)).status).toBe(200);

    // Conformed and satisfied — no advisory shortfall to see yet.
    const before = await checkConformancePrerequisites(lot.id, prisma, {
      regimeFetcher: prismaRegimeStreamFetcher(),
    });
    expect(before.lot!.status).toBe('conformed');
    expect(before.sufficiency!.state).toBe('satisfied');

    // A PAST test is corrected to a verified fail — the retroactive event the
    // whole wave exists for. Nothing about the lot's status changes.
    const [correctable] = await prisma.testResult.findMany({
      where: { lotId: lot.id },
      take: 2,
    });
    await prisma.testResult.update({
      where: { id: correctable.id },
      data: { passFail: 'fail' },
    });

    const after = await checkConformancePrerequisites(lot.id, prisma, {
      regimeFetcher: prismaRegimeStreamFetcher(),
    });
    expect(after.lot!.status).toBe('conformed');
    expect(after.sufficiency!.state).toBe('insufficient');
    expect(after.sufficiency!.rules[0]).toMatchObject({ requiredCount: 6, passingCount: 5 });

    // §5.1.3 `[C1R-B2]`: the advisory item is PRESENT on the conformed lot's
    // readiness, which is the assertion Rev 1's surface made impossible. This
    // is the payoff — a shortfall discovered after conformance is exactly what
    // must be visible before handover.
    const readiness = buildLotReadinessFromInputs({
      lot: {
        id: lot.id,
        lotNumber: lot.lotNumber,
        status: 'conformed',
        budgetAmount: null,
        claimedInId: null,
        claimedPercentage: 0,
        conformanceOverriddenAt: null,
      },
      canViewCommercial: true,
      conformStatus: {
        canConform: Boolean(after.canConform),
        blockingReasons: after.blockingReasons ?? [],
        prerequisites: after.prerequisites!,
      },
      sufficiency: after.sufficiency,
      evidenceCounts: {
        unreleasedHoldPoints: 0,
        releasedHoldPoints: 0,
        approvedDockets: 0,
        diaryEntries: 0,
        documents: 0,
        photos: 0,
        pendingTests: 0,
      },
    });
    const shortfall = readiness.conformance.warnings.find(
      (readinessItem) => readinessItem.code === 'insufficient_test_count',
    );
    expect(shortfall).toBeDefined();
    // ADVISORY, on a conformed lot, always: never a retroactive blocker — so it
    // is in `warnings`, and `blockers` stays empty.
    expect(shortfall!.blocksAction).toBe(false);
    expect(shortfall!.severity).toBe('warning');
    expect(readiness.conformance.blockers).toEqual([]);
  });
});

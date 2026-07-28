// Wave C3 Phase A — the testing-overlay route (spec §4, §14 AT-82, AT-86,
// AT-91; J3 in §10.1).
//
// The claim Phase A lives or dies on is ONE VERDICT, EVERYWHERE: the colour a
// lot gets on the map is byte-for-byte the `sufficiency.state` its own lot page
// shows, at the same instant, including the regime fold. So AT-82 does not
// compare the route against a hand-written expectation — it compares it against
// the OTHER ROUTE, over a project seeded to span all three states.
//
// DB-backed: local disposable database only (`src/test/databaseSafety.ts`).

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { authRouter } from './auth.js';
import { lotsRouter } from './lots.js';
import { projectTestCoverageRouter } from './projectTestCoverage.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import type { TestCoverageResponse } from './projectTestCoverage.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/projects', projectTestCoverageRouter);
app.use(errorHandler);

const tag = `test-coverage-${Date.now()}`;

let token: string;
let outsiderToken: string;
let subbieToken: string;
let companyId: string;
let userId: string;
let projectId: string;
let shortLotId: string;
let satisfiedLotId: string;
let unknownLotId: string;
let undrawnLotId: string;

const POLYGON = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [151.0, -33.8],
        [151.001, -33.8],
        [151.001, -33.801],
        [151.0, -33.8],
      ],
    ],
  },
};

async function drawLot(lotId: string): Promise<void> {
  await prisma.lotGeometry.create({
    data: { lotId, kind: 'drawn', geometryWgs84: POLYGON },
  });
}

beforeAll(async () => {
  companyId = (await prisma.company.create({ data: { name: `Co ${tag}` } })).id;
  const pm = await registerTestUser(app, {
    emailPrefix: 'tc-pm',
    fullName: 'TC PM',
    companyId,
    roleInCompany: 'owner',
  });
  token = pm.token;
  userId = pm.userId;

  // VIC/VicRoads so the CONFIRMED `vicroads-204.v2` pack resolves and the
  // shortfall assertion has real numbers behind it.
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
  await prisma.projectUser.create({
    data: { projectId, userId, role: 'project_manager', status: 'active' },
  });

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

  async function seedLot(
    suffix: string,
    data: Record<string, unknown>,
    passingTests = 0,
  ): Promise<string> {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-${suffix}`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        status: 'in_progress',
        ...data,
      },
    });
    await prisma.iTPInstance.create({
      data: {
        lotId: lot.id,
        templateId: template.id,
        completions: { create: [{ checklistItemId: item.id, status: 'completed' }] },
      },
    });
    for (let i = 0; i < passingTests; i += 1) {
      await prisma.testResult.create({
        data: {
          projectId,
          lotId: lot.id,
          itpChecklistItemId: item.id,
          testType: 'compaction',
          passFail: 'pass',
          status: 'verified',
          enteredById: userId,
        },
      });
    }
    return lot.id;
  }

  // 1 of 6 at Scale A (the ruleset default) — `insufficient`.
  shortLotId = await seedLot('SHORT', { activitySlug: 'earthworks_general' }, 1);
  // 6 of 6 — `satisfied`.
  satisfiedLotId = await seedLot('OK', { activitySlug: 'earthworks_general' }, 6);
  // No canonical activity — no rule resolves, so `unknown` with a cause.
  unknownLotId = await seedLot('UNKNOWN', { activitySlug: null }, 0);
  // Drawn: three of the four. The fourth stays off the map deliberately.
  await drawLot(shortLotId);
  await drawLot(satisfiedLotId);
  await drawLot(unknownLotId);
  undrawnLotId = await seedLot('UNDRAWN', { activitySlug: 'earthworks_general' }, 0);

  // An internal user of ANOTHER company, and a subcontractor-portal user of this
  // one — J3 says neither may read the overlay.
  const otherCompany = await prisma.company.create({ data: { name: `Other ${tag}` } });
  outsiderToken = (
    await registerTestUser(app, {
      emailPrefix: 'tc-outsider',
      fullName: 'TC Outsider',
      companyId: otherCompany.id,
      roleInCompany: 'owner',
    })
  ).token;

  const subbieCompany = await prisma.company.create({ data: { name: `Subbie ${tag}` } });
  const subbie = await registerTestUser(app, {
    emailPrefix: 'tc-subbie',
    fullName: 'TC Subbie',
    companyId: subbieCompany.id,
    roleInCompany: 'subcontractor',
  });
  subbieToken = subbie.token;
  await prisma.projectUser.create({
    data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
  });
}, 120_000);

afterAll(async () => {
  await prisma.testResult.deleteMany({ where: { projectId } });
  await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { company: { name: { contains: tag } } } });
  await prisma.company.deleteMany({ where: { name: { contains: tag } } });
});

async function fetchCoverage(): Promise<TestCoverageResponse> {
  const res = await request(app)
    .get(`/api/projects/${projectId}/lots/test-coverage`)
    .set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  return res.body as TestCoverageResponse;
}

describe('AT-82 one verdict, two surfaces', () => {
  it('every overlay state equals the same lot page`s sufficiency.state', async () => {
    const body = await fetchCoverage();
    expect(body.lots.map((l) => l.state).sort()).toEqual(['insufficient', 'satisfied', 'unknown']);

    for (const lot of body.lots) {
      // `/conform-status` is the lot page's verdict — and after Phase A step 0
      // it carries the SAME regime fold `/readiness` does `[C3R-B6]`.
      const page = await request(app)
        .get(`/api/lots/${lot.lotId}/conform-status`)
        .set('Authorization', `Bearer ${token}`);
      expect(page.status).toBe(200);
      expect(lot.state).toBe(page.body.sufficiency?.state ?? 'unknown');

      // And where the overlay ships numbers, they are the page's numbers.
      for (const rule of lot.rules ?? []) {
        const pageRule = page.body.sufficiency.rules.find(
          (r: { testType: string }) => r.testType === rule.testType,
        );
        expect(rule.requiredCount).toBe(pageRule.requiredCount);
        expect(rule.passingCount).toBe(pageRule.passingCount);
      }
    }
  });

  it('the shortfall really is a resolved pack shortfall, not a vacuous one', async () => {
    const body = await fetchCoverage();
    const short = body.lots.find((l) => l.lotId === shortLotId)!;
    expect(short.ruleset?.id).toBe('vicroads-204.v2');
    expect(short.rules).toEqual([
      expect.objectContaining({
        testType: 'compaction',
        state: 'insufficient',
        requiredCount: 6,
        passingCount: 1,
        citation: expect.objectContaining({ clause: '204.13(a)' }),
      }),
    ]);
  });
});

describe('AT-86 `unknown` carries its cause; the payload is trimmed', () => {
  it('an unclassified lot is `unknown` with a cause, not green and not amber', async () => {
    const body = await fetchCoverage();
    const unknown = body.lots.find((l) => l.lotId === unknownLotId)!;
    expect(unknown.state).toBe('unknown');
    expect(unknown.unknownCauses).toContain('activity_not_canonical');
  });

  it('AT-A2 a satisfied lot ships `{ lotId, state }` and nothing else', async () => {
    const body = await fetchCoverage();
    const ok = body.lots.find((l) => l.lotId === satisfiedLotId)!;
    expect(Object.keys(ok).sort()).toEqual(['lotId', 'state']);
  });
});

describe('AT-91 the batch is scoped to lots that are actually drawn [C3R-A1]', () => {
  it('evaluates only geometry-bearing lots and counts the rest', async () => {
    const body = await fetchCoverage();
    expect(body.lots.map((l) => l.lotId).sort()).toEqual(
      [shortLotId, satisfiedLotId, unknownLotId].sort(),
    );
    // The overlay can only recolour what is drawn, so the fourth lot is a
    // COUNT, never a colour — the same honesty as an unlocated test.
    expect(body.lots.some((l) => l.lotId === undrawnLotId)).toBe(false);
    expect(body.lotsWithoutGeometry).toBe(1);
  });
});

describe('J3 the overlay is internal-only', () => {
  it('refuses a subcontractor-portal user and a user outside the company', async () => {
    for (const t of [subbieToken, outsiderToken]) {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots/test-coverage`)
        .set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(403);
    }
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/lots/test-coverage`);
    expect(res.status).toBe(401);
  });
});

// The lot requirement summary and the batch raise, end to end against the real
// engine and the real shipped `vicroads-204.v2` pack.
//
// DB-backed: local disposable database only (`src/test/databaseSafety.ts`).

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { authRouter } from '../auth.js';
import { testResultsRouter } from '../testResults.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import type { LotTestRequirements } from './lotRequirements.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/test-results', testResultsRouter);
app.use(errorHandler);

const tag = `lot-reqs-${Date.now()}`;
const RULE_ID = 'vicroads-204.v2/compaction-density';

let token: string;
let subbieToken: string;
let outsiderToken: string;
let companyId: string;
let userId: string;
let projectId: string;
let shortLotId: string;
let failedLotId: string;
let unknownLotId: string;
let raiseLotId: string;
let itemId: string;

async function seedLot(suffix: string, activitySlug: string | null): Promise<string> {
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'chainage',
      activityType: 'Earthworks',
      status: 'in_progress',
      activitySlug,
    },
  });
  return lot.id;
}

async function seedTest(
  lotId: string,
  passFail: string,
  status: string,
  testType = 'compaction',
): Promise<void> {
  await prisma.testResult.create({
    data: {
      projectId,
      lotId,
      itpChecklistItemId: itemId,
      testType,
      passFail,
      status,
      enteredById: userId,
    },
  });
}

async function fetchRequirements(lotId: string, bearer = token) {
  return request(app)
    .get(`/api/test-results/lots/${lotId}/requirements`)
    .set('Authorization', `Bearer ${bearer}`);
}

async function raise(body: unknown, bearer = token) {
  return request(app)
    .post('/api/test-results/batch-raise')
    .set('Authorization', `Bearer ${bearer}`)
    .send(body as object);
}

beforeAll(async () => {
  companyId = (await prisma.company.create({ data: { name: `Co ${tag}` } })).id;
  const pm = await registerTestUser(app, {
    emailPrefix: 'lr-pm',
    fullName: 'LR PM',
    companyId,
    roleInCompany: 'owner',
  });
  token = pm.token;
  userId = pm.userId;

  // VIC/VicRoads so the CONFIRMED `vicroads-204.v2` pack resolves: Scale A (the
  // pack default) requires 6 compaction tests.
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
  itemId = (
    await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        description: 'Compaction test point',
        sequenceNumber: 1,
        pointType: 'standard',
        responsibleParty: 'contractor',
        evidenceRequired: 'test',
        testType: 'compaction',
      },
    })
  ).id;

  shortLotId = await seedLot('SHORT', 'earthworks_general');
  await seedTest(shortLotId, 'pass', 'verified');

  // 2 verified passes, 3 verified FAILURES, 1 still at the lab.
  failedLotId = await seedLot('FAILED', 'earthworks_general');
  await seedTest(failedLotId, 'pass', 'verified');
  await seedTest(failedLotId, 'pass', 'verified');
  await seedTest(failedLotId, 'fail', 'verified');
  await seedTest(failedLotId, 'fail', 'verified');
  await seedTest(failedLotId, 'fail', 'verified');
  await seedTest(failedLotId, 'pending', 'at_lab');

  unknownLotId = await seedLot('UNKNOWN', null);
  raiseLotId = await seedLot('RAISE', 'earthworks_general');

  const otherCompany = await prisma.company.create({ data: { name: `Other ${tag}` } });
  outsiderToken = (
    await registerTestUser(app, {
      emailPrefix: 'lr-outsider',
      fullName: 'LR Outsider',
      companyId: otherCompany.id,
      roleInCompany: 'owner',
    })
  ).token;

  const subbieCompany = await prisma.company.create({ data: { name: `Subbie ${tag}` } });
  const subbie = await registerTestUser(app, {
    emailPrefix: 'lr-subbie',
    fullName: 'LR Subbie',
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
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { company: { name: { contains: tag } } } });
  await prisma.company.deleteMany({ where: { name: { contains: tag } } });
});

describe('GET /lots/:lotId/requirements', () => {
  it('reports the real pack shortfall with its clause', async () => {
    const res = await fetchRequirements(shortLotId);
    expect(res.status).toBe(200);

    const body = res.body as LotTestRequirements;
    expect(body.state).toBe('insufficient');
    expect(body.ruleset).toEqual({
      id: 'vicroads-204.v2',
      status: 'confirmed',
      revalidationLapsed: false,
    });
    expect(body.rules).toEqual([
      expect.objectContaining({
        ruleId: RULE_ID,
        testType: 'compaction',
        state: 'insufficient',
        requiredCount: 6,
        passingCount: 1,
        outstandingCount: 5,
        citation: expect.objectContaining({
          authority: 'DTP (VicRoads)',
          clause: '204.13(a)',
          edition: 'v8.0, November 2025',
          confirmed: true,
        }),
      }),
    ]);
  });

  it('excludes verified FAILURES from the numerator and leaves their slots outstanding', async () => {
    const res = await fetchRequirements(failedLotId);
    expect(res.status).toBe(200);

    const rule = (res.body as LotTestRequirements).rules[0]!;
    // 2 verified passes, 3 verified failures, 1 at the lab.
    expect(rule.passingCount).toBe(2);
    expect(rule.failedCount).toBe(3);
    expect(rule.pendingCount).toBe(1);
    // The three failures counted toward nothing: 6 − 2 − 1 = 3 still to raise.
    expect(rule.outstandingCount).toBe(3);
    expect(rule.state).toBe('insufficient');
  });

  it('reports an uncheckable requirement as unknown with its cause, never as a number', async () => {
    const res = await fetchRequirements(unknownLotId);
    expect(res.status).toBe(200);

    const body = res.body as LotTestRequirements;
    expect(body.state).toBe('unknown');
    expect(body.rules).toEqual([]);
    expect(body.unknownCauses).toContain('activity_not_canonical');
  });

  it('404s for a lot that does not exist', async () => {
    const res = await fetchRequirements('00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('requirement data is internal-only', () => {
  it('refuses a subcontractor-scoped user and one outside the company', async () => {
    for (const bearer of [subbieToken, outsiderToken]) {
      const res = await fetchRequirements(shortLotId, bearer);
      expect(res.status).toBe(403);
      expect(res.body.rules).toBeUndefined();
    }
  });

  it('refuses an unauthenticated request', async () => {
    const res = await request(app).get(`/api/test-results/lots/${shortLotId}/requirements`);
    expect(res.status).toBe(401);
  });

  it('refuses a subcontractor-scoped batch raise', async () => {
    const res = await raise({ lotId: shortLotId, requests: [{ ruleId: RULE_ID }] }, subbieToken);
    expect(res.status).toBe(403);
  });
});

describe('POST /batch-raise', () => {
  it('raises exactly the outstanding count, bound to the rule that asked for them', async () => {
    const res = await raise({ lotId: raiseLotId, requests: [{ ruleId: RULE_ID }] });
    expect(res.status).toBe(201);
    expect(res.body.totalCreated).toBe(6);
    expect(res.body.created[0]).toMatchObject({
      ruleId: RULE_ID,
      testType: 'compaction',
      count: 6,
    });

    const rows = await prisma.testResult.findMany({ where: { lotId: raiseLotId } });
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.status === 'requested' && row.passFail === 'pending')).toBe(
      true,
    );

    // Raised is NOT passing: the rule now reads 6 required, 0 passing, 6 awaiting.
    const after = (await fetchRequirements(raiseLotId)).body as LotTestRequirements;
    expect(after.rules[0]).toMatchObject({
      requiredCount: 6,
      passingCount: 0,
      pendingCount: 6,
      outstandingCount: 0,
      state: 'insufficient',
    });
  });

  it('creates nothing on a retry — the raised rows already cover the requirement', async () => {
    const res = await raise({ lotId: raiseLotId, requests: [{ ruleId: RULE_ID }] });
    expect(res.status).toBe(201);
    expect(res.body.totalCreated).toBe(0);
    expect(await prisma.testResult.count({ where: { lotId: raiseLotId } })).toBe(6);
  });

  it('creates NOTHING when any entry in the batch fails validation', async () => {
    const before = await prisma.testResult.count({ where: { lotId: shortLotId } });

    const res = await raise({
      lotId: shortLotId,
      requests: [{ ruleId: RULE_ID }, { ruleId: 'no-such-pack.v9/imaginary' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('RULE_NOT_APPLICABLE');
    expect(await prisma.testResult.count({ where: { lotId: shortLotId } })).toBe(before);
  });

  it('rejects a test type that would count toward nothing', async () => {
    const res = await raise({
      lotId: shortLotId,
      requests: [{ ruleId: RULE_ID, testType: 'Concrete Slump' }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('TEST_TYPE_MISMATCH');
  });

  it('refuses to raise against a requirement it cannot compute', async () => {
    const res = await raise({ lotId: unknownLotId, requests: [{ ruleId: RULE_ID }] });

    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('RULE_NOT_APPLICABLE');
    expect(await prisma.testResult.count({ where: { lotId: unknownLotId } })).toBe(0);
  });

  it('rejects the same rule twice in one payload', async () => {
    const res = await raise({
      lotId: shortLotId,
      requests: [{ ruleId: RULE_ID }, { ruleId: RULE_ID }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error.details.code).toBe('DUPLICATE_RULE');
  });
});

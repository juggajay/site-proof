import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../prisma.js';
import { errorHandler } from '../../../middleware/errorHandler.js';
import { registerTestUser } from '../../../test/routeTestHarness.js';
import { authRouter } from '../../../routes/auth.js';
import { lotsRouter } from '../../../routes/lots.js';
import claimsRouter from '../../../routes/claims.js';
import { seedCorpus } from './seedCorpus.js';
import { normalizeReadiness } from './normalize.js';

// F0.1 characterization corpus. Drives the two LIVE readiness code paths
// (buildLotReadinessFromInputs via GET /lots/:id/readiness, and the batched
// claim-readiness route) over a fixed permutation of fixture lots, then commits
// normalized JSON snapshots. F0.2 must reproduce these byte-identically.
//
// DB-backed: local test DB only (databaseSafety.ts enforces via setup.ts).

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/projects', claimsRouter);
app.use(errorHandler);

let token: string;
let projectId: string;
// F1.1: a second, VIC/`vicroads` project so the real-vocabulary lots of
// VIC_CORPUS resolve the shipped VicRoads pack (`.v2` since D14.2). The main
// corpus project stays NSW/TfNSW — deliberately unchanged — and since D14.3 it
// resolves `tfnsw-q6.v1`, which publishes no default scale, so its lots record
// the `scale_not_selected` advisory rather than a count (`seedCorpus.ts`).
let vicProjectId: string;
let companyId: string;
let userId: string;
let lots: Array<{ lotNumber: string; id: string }>;

beforeAll(async () => {
  const stamp = Date.now();
  companyId = (await prisma.company.create({ data: { name: `Char Co ${stamp}` } })).id;

  const pm = await registerTestUser(app, {
    emailPrefix: 'char-pm',
    fullName: 'Char PM',
    companyId,
    roleInCompany: 'owner',
  });
  token = pm.token;
  userId = pm.userId;

  const project = await prisma.project.create({
    data: {
      name: `Char Project ${stamp}`,
      projectNumber: `CHAR-${stamp}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  await prisma.projectUser.create({
    data: { projectId, userId, role: 'project_manager', status: 'active' },
  });

  const vicProject = await prisma.project.create({
    data: {
      name: `Char VIC Project ${stamp}`,
      projectNumber: `CHARVIC-${stamp}`,
      companyId,
      status: 'active',
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  vicProjectId = vicProject.id;
  await prisma.projectUser.create({
    data: { projectId: vicProjectId, userId, role: 'project_manager', status: 'active' },
  });

  lots = await seedCorpus({ projectId, companyId, userId, vicProjectId });
}, 60_000);

afterAll(async () => {
  const lotIds = lots?.map((lot) => lot.id) ?? [];
  const projectIds = [projectId, vicProjectId].filter(Boolean);
  await prisma.testResult.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.nCRLot.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.nCR.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.holdPoint.deleteMany({ where: { lotId: { in: lotIds } } });
  await prisma.lot.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.projectUser.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('readiness characterization corpus', () => {
  it('lot-readiness endpoint snapshot across the permutation space', async () => {
    const byLot: Record<string, unknown> = {};
    for (const lot of lots) {
      const res = await request(app)
        .get(`/api/lots/${lot.id}/readiness`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status, `${lot.lotNumber} -> ${res.status}: ${JSON.stringify(res.body)}`).toBe(
        200,
      );
      // §6 snapshot-size guard: a single-lot readiness payload stays small.
      expect(JSON.stringify(res.body).length).toBeLessThan(40_000);
      byLot[lot.lotNumber] = normalizeReadiness(res.body);
    }
    await expect(JSON.stringify(byLot, null, 2)).toMatchFileSnapshot(
      './__fixtures__/lot-readiness.snapshot.json',
    );
  });

  it('claim-readiness endpoint snapshot for the whole project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/claim-readiness`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    await expect(JSON.stringify(normalizeReadiness(res.body), null, 2)).toMatchFileSnapshot(
      './__fixtures__/claim-readiness.snapshot.json',
    );
  });
});

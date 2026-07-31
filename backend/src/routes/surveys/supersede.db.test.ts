// Wave C5.2 — AT-175. Supersession is scoped to one survey IDENTITY.
//
// `Drawing`'s guard is meaningful because of its `drawingNumber` comparison.
// `SurveyRecord` has no identity column, so `(lot_id, kind)` IS the identity —
// and without those two extra checks a `set_out` record on lot A could
// supersede a `conformance` record on lot B, quietly removing the second one
// from every default read.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

import { authRouter } from '../auth.js';
import { lotSurveysRouter, surveysRouter } from './index.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotSurveysRouter);
app.use('/api/surveys', surveysRouter);
app.use(errorHandler);

const originalFlag = process.env.C5_SURVEY_RECORDS_ENABLED;

describe('C5.2 — AT-175 supersession', () => {
  let adminToken: string;
  let projectId: string;
  let lotId: string;
  let otherLotId: string;
  let foreignLotId: string;
  let foreignProjectId: string;

  beforeAll(async () => {
    process.env.C5_SURVEY_RECORDS_ENABLED = 'true';

    const company = await prisma.company.create({
      data: { name: `C5 Supersede Co ${Date.now()}` },
    });
    const admin = await registerTestUser(app, {
      emailPrefix: 'c5-supersede-admin',
      fullName: 'C5 Supersede Admin',
      companyId: company.id,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;

    const project = await prisma.project.create({
      data: {
        name: 'C5 Supersede Project',
        projectNumber: `C5SUP-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
        companyId: company.id,
      },
    });
    projectId = project.id;

    const mkLot = (n: string, pid = projectId) =>
      prisma.lot.create({
        data: { projectId: pid, lotNumber: n, lotType: 'general', activityType: 'earthworks' },
      });
    lotId = (await mkLot('SUP-001')).id;
    otherLotId = (await mkLot('SUP-002')).id;

    const otherCompany = await prisma.company.create({
      data: { name: `C5 Supersede Other Co ${Date.now()}` },
    });
    const otherProject = await prisma.project.create({
      data: {
        name: 'C5 Supersede Other Project',
        projectNumber: `C5SUPO-${Date.now()}`,
        state: 'VIC',
        specificationSet: 'VicRoads',
        companyId: otherCompany.id,
      },
    });
    foreignProjectId = otherProject.id;
    foreignLotId = (await mkLot('SUP-FOREIGN', otherProject.id)).id;
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    } else {
      process.env.C5_SURVEY_RECORDS_ENABLED = originalFlag;
    }
  });

  const mkSurvey = (overrides: Record<string, unknown> = {}) =>
    prisma.surveyRecord.create({
      data: { projectId, lotId, kind: 'conformance', ...overrides },
    });

  const supersede = (id: string, supersededById: string) =>
    request(app)
      .post(`/api/surveys/${id}/supersede`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ supersededById });

  it('supersedes a record by a later one on the same lot and of the same kind', async () => {
    const original = await mkSurvey();
    const revision = await mkSurvey();

    const res = await supersede(original.id, revision.id).expect(200);
    expect(res.body.supersededById).toBe(revision.id);

    // The prior row and its file are untouched and still retrievable.
    const still = await prisma.surveyRecord.findUnique({ where: { id: original.id } });
    expect(still).not.toBeNull();
  });

  it('(1) refuses a self-reference', async () => {
    const record = await mkSurvey();
    const res = await supersede(record.id, record.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('another survey record');
  });

  it('(2) refuses a record in another project', async () => {
    const record = await mkSurvey();
    const foreign = await prisma.surveyRecord.create({
      data: { projectId: foreignProjectId, lotId: foreignLotId, kind: 'conformance' },
    });
    const res = await supersede(record.id, foreign.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('same project');
  });

  it('(3) refuses a record on a different lot', async () => {
    const record = await mkSurvey();
    const otherLotRecord = await mkSurvey({ lotId: otherLotId });
    const res = await supersede(record.id, otherLotRecord.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('same lot');
  });

  it('(4) refuses a record of a different kind', async () => {
    const record = await mkSurvey();
    const otherKind = await mkSurvey({ kind: 'set_out' });
    const res = await supersede(record.id, otherKind.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('same kind');
  });

  it('(5) refuses a target that is itself already superseded', async () => {
    const oldest = await mkSurvey();
    const middle = await mkSurvey();
    const newest = await mkSurvey();

    await supersede(middle.id, newest.id).expect(200);

    const res = await supersede(oldest.id, middle.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('current survey revision');
  });

  it('refuses to supersede a record that is already superseded', async () => {
    const original = await mkSurvey();
    const first = await mkSurvey();
    const second = await mkSurvey();

    await supersede(original.id, first.id).expect(200);
    const res = await supersede(original.id, second.id);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Only the current survey revision');
  });

  it('drops superseded rows from the default lot read and keeps them retrievable by id', async () => {
    const original = await mkSurvey({ kind: 'as_built' });
    const revision = await mkSurvey({ kind: 'as_built' });
    await supersede(original.id, revision.id).expect(200);

    const list = await request(app)
      .get(`/api/lots/${lotId}/surveys`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ids = list.body.surveys.map((s: { id: string }) => s.id);
    expect(ids).not.toContain(original.id);
    expect(ids).toContain(revision.id);

    await request(app)
      .get(`/api/surveys/${original.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});

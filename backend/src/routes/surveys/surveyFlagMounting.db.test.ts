// Wave C5.2 — the regression the E2E suite caught, pinned against the REAL app.
//
// The bug: `requireSurveyFlag` was attached with `lotSurveysRouter.use(...)`.
// A router-level `use` runs for EVERY request routed into the mount path, not
// only the paths that router declares — so with the flag off (its default, and
// therefore production) every `/api/lots/...` request hit it and got a 404. The
// whole lots API went dark.
//
// The per-file suites all mounted routers individually, so none of them could
// see it. This one builds the app the way the server does.

import { describe, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

import { createServerApp } from '../../server.js';
import { prisma } from '../../lib/prisma.js';
import { generateToken } from '../../lib/auth.js';

const app = createServerApp();
const originalFlag = process.env.C5_SURVEY_RECORDS_ENABLED;

describe('C5.2 flag mounting — the gate must not shadow its neighbours', () => {
  let token: string;
  let projectId: string;
  let lotId: string;

  beforeAll(async () => {
    delete process.env.C5_SURVEY_RECORDS_ENABLED;

    const company = await prisma.company.create({
      data: { name: `C5 Flag Mount Co ${Date.now()}` },
    });
    const user = await prisma.user.create({
      data: {
        email: `c5-flag-mount-${Date.now()}@example.com`,
        fullName: 'C5 Flag Mount Admin',
        companyId: company.id,
        roleInCompany: 'admin',
        emailVerified: true,
        tosAcceptedAt: new Date(),
      },
    });
    token = generateToken({ userId: user.id, email: user.email, role: 'admin' });

    const project = await prisma.project.create({
      data: {
        name: 'C5 Flag Mount Project',
        projectNumber: `C5FM-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
        companyId: company.id,
      },
    });
    projectId = project.id;
    lotId = (
      await prisma.lot.create({
        data: { projectId, lotNumber: 'FLAG-001', lotType: 'general', activityType: 'earthworks' },
      })
    ).id;
  });

  afterAll(() => {
    if (originalFlag === undefined) {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    } else {
      process.env.C5_SURVEY_RECORDS_ENABLED = originalFlag;
    }
  });

  it('leaves the shipped lots and projects APIs working with the flag off', async () => {
    await request(app)
      .get(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get(`/api/lots?projectId=${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('still refuses the survey routes themselves with the flag off', async () => {
    await request(app)
      .get(`/api/lots/${lotId}/surveys`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app)
      .get(`/api/projects/${projectId}/surveys`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app)
      .post(`/api/lots/${lotId}/surveys`)
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'conformance' })
      .expect(404);
  });

  it('leaves the C5.1 delivery reads reachable with the survey flag off', async () => {
    await request(app)
      .get(`/api/lots/${lotId}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app)
      .get(`/api/projects/${projectId}/deliveries`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('opens the survey routes once the flag is on, without disturbing the rest', async () => {
    process.env.C5_SURVEY_RECORDS_ENABLED = 'true';
    try {
      await request(app)
        .get(`/api/lots/${lotId}/surveys`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await request(app)
        .get(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    } finally {
      delete process.env.C5_SURVEY_RECORDS_ENABLED;
    }
  });
});

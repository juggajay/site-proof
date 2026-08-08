// Wave 2 lot inspector — GET /api/lots/:id/status-events (the #1800 ledger
// read). DB-backed: the route is a straight Prisma read whose ordering and
// scoping ARE the behaviour under test. `src/test/databaseSafety.ts` keeps this
// on the local disposable database.

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { lotsRouter } from '../lots.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

const stamp = Date.now();

describe('GET /api/lots/:id/status-events', () => {
  let companyId: string;
  let adminToken: string;
  let subbieToken: string;
  let projectId: string;
  let lotId: string;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { name: `SE Co ${stamp}` } })).id;

    const admin = await registerTestUser(app, {
      emailPrefix: 'se-admin',
      fullName: 'SE Admin',
      companyId,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;

    const project = await prisma.project.create({
      data: {
        name: `SE Project ${stamp}`,
        projectNumber: `SE-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `SE-LOT-${stamp}`,
        lotType: 'roadworks',
        activityType: 'Earthworks',
        status: 'in_progress',
      },
    });
    lotId = lot.id;

    // Ledger rows inserted out of effectiveAt order, so the 200 test proves the
    // route sorts by when the transition happened, not by insertion.
    await prisma.lotStatusEvent.createMany({
      data: [
        {
          lotId,
          fromStatus: 'not_started',
          toStatus: 'in_progress',
          effectiveAt: new Date('2026-02-01T00:00:00.000Z'),
          source: 'user',
        },
        {
          lotId,
          fromStatus: null,
          toStatus: 'not_started',
          effectiveAt: new Date('2026-01-15T00:00:00.000Z'),
          source: 'backfill',
        },
      ],
    });

    // Standalone subcontractor portal identity with the lots module enabled but
    // NO assignment to the lot (legacy field or assignment row) — the 404 case.
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `SE Subbie ${stamp}`,
        primaryContactName: 'SE Subbie',
        primaryContactEmail: `se-subbie-${stamp}@example.com`,
        status: 'approved',
        portalAccess: { lots: true },
      },
    });
    const subbie = await registerTestUser(app, {
      emailPrefix: 'se-subbie-user',
      fullName: 'SE Subbie User',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;
    await prisma.user.update({
      where: { id: subbie.userId },
      data: { companyId: null, roleInCompany: 'subcontractor' },
    });
    await prisma.subcontractorUser.create({
      data: {
        userId: subbie.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });
  });

  afterAll(async () => {
    await prisma.lotStatusEvent.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
  });

  it('returns the ledger sorted by effectiveAt with ISO strings', async () => {
    const res = await request(app)
      .get(`/api/lots/${lotId}/status-events`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toEqual({
      fromStatus: null,
      toStatus: 'not_started',
      effectiveAt: '2026-01-15T00:00:00.000Z',
      recordedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      source: 'backfill',
    });
    expect(res.body.events[1]).toMatchObject({
      fromStatus: 'not_started',
      toStatus: 'in_progress',
      effectiveAt: '2026-02-01T00:00:00.000Z',
      source: 'user',
    });
  });

  it('answers 404 (not 403) for a subcontractor without the lot assigned', async () => {
    const res = await request(app)
      .get(`/api/lots/${lotId}/status-events`)
      .set('Authorization', `Bearer ${subbieToken}`);

    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(`/api/lots/${lotId}/status-events`);
    expect(res.status).toBe(401);
  });
});

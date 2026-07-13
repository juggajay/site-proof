import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { controlLinesRouter } from '../controlLines/index.js';
import { lotsRouter } from '../lots.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use('/api/projects', controlLinesRouter);
app.use(errorHandler);

// Straight east-running control line, chainage 0→200 (metres of easting).
const POINTS = [
  { chainage: 0, easting: 500_000, northing: 6_000_000 },
  { chainage: 200, easting: 500_200, northing: 6_000_000 },
];

async function createLot(projectId: string, lotNumber: string, chainage?: [number, number]) {
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber,
      lotType: 'general',
      activityType: 'earthworks',
      status: 'not_started',
      ...(chainage ? { chainageStart: chainage[0], chainageEnd: chainage[1] } : {}),
    },
    select: { id: true },
  });
}

describe('Lot geometry API', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let engineerToken: string;
  let foremanToken: string;
  let viewerToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let siblingProjectId: string;
  let controlLineId: string;
  let siblingControlLineId: string;
  let lotA: string; // no chainage — CRUD target (chainage comes from the body)
  let lotB: string; // chainage 20–120 — backfill in-range
  let lotOut: string; // chainage 500–600 — backfill/POST out-of-range
  let lotNoCh: string; // no chainage — backfill ignores it

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `LG Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `LG Other ${stamp}` } })).id;

    const users = await Promise.all([
      registerTestUser(app, {
        emailPrefix: 'lg-pm',
        fullName: 'LG PM',
        companyId,
        roleInCompany: 'project_manager',
      }),
      registerTestUser(app, {
        emailPrefix: 'lg-eng',
        fullName: 'LG Eng',
        companyId,
        roleInCompany: 'site_engineer',
      }),
      registerTestUser(app, {
        emailPrefix: 'lg-fore',
        fullName: 'LG Fore',
        companyId,
        roleInCompany: 'foreman',
      }),
      registerTestUser(app, {
        emailPrefix: 'lg-view',
        fullName: 'LG View',
        companyId,
        roleInCompany: 'viewer',
      }),
      registerTestUser(app, {
        emailPrefix: 'lg-sub',
        fullName: 'LG Sub',
        companyId,
        roleInCompany: 'subcontractor',
      }),
      registerTestUser(app, {
        emailPrefix: 'lg-out',
        fullName: 'LG Out',
        companyId: otherCompanyId,
        roleInCompany: 'project_manager',
      }),
    ]);
    const [pm, engineer, foreman, viewer, subbie, outsider] = users;
    pmToken = pm.token;
    engineerToken = engineer.token;
    foremanToken = foreman.token;
    viewerToken = viewer.token;
    subbieToken = subbie.token;
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `LG Project ${stamp}`,
        projectNumber: `LG-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;
    const sibling = await prisma.project.create({
      data: {
        name: `LG Sibling ${stamp}`,
        projectNumber: `LGS-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    siblingProjectId = sibling.id;

    for (const [userId, role] of [
      [pm.userId, 'project_manager'],
      [engineer.userId, 'site_engineer'],
      [foreman.userId, 'foreman'],
      [viewer.userId, 'viewer'],
      [subbie.userId, 'subcontractor'],
    ] as const) {
      await prisma.projectUser.create({ data: { projectId, userId, role, status: 'active' } });
    }

    controlLineId = (
      await prisma.controlLine.create({
        data: { projectId, name: 'MC00', coordinateSystem: 'EPSG:7855', points: POINTS },
        select: { id: true },
      })
    ).id;
    siblingControlLineId = (
      await prisma.controlLine.create({
        data: {
          projectId: siblingProjectId,
          name: 'Sibling CL',
          coordinateSystem: 'EPSG:7855',
          points: POINTS,
        },
        select: { id: true },
      })
    ).id;

    lotA = (await createLot(projectId, `A-${stamp}`)).id;
    lotB = (await createLot(projectId, `B-${stamp}`, [20, 120])).id;
    lotOut = (await createLot(projectId, `O-${stamp}`, [500, 600])).id;
    lotNoCh = (await createLot(projectId, `N-${stamp}`)).id;
  });

  afterAll(async () => {
    await prisma.lotGeometry.deleteMany({
      where: { lotId: { in: [lotA, lotB, lotOut, lotNoCh] } },
    });
    await prisma.lot.deleteMany({ where: { projectId: { in: [projectId, siblingProjectId] } } });
    await prisma.controlLine.deleteMany({
      where: { projectId: { in: [projectId, siblingProjectId] } },
    });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, siblingProjectId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/lots/${lotA}/geometries`);
    expect(res.status).toBe(401);
  });

  it('lets any internal member read, denies subcontractors', async () => {
    const viewerRes = await request(app)
      .get(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerRes.status).toBe(200);
    expect(viewerRes.body.geometries).toEqual([]);

    const subbieRes = await request(app)
      .get(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(subbieRes.status).toBe(403);
  });

  it('creates a chainage_offset polygon with computed area/length', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        kind: 'chainage_offset',
        controlLineId,
        chainageStart: 0,
        chainageEnd: 100,
        offsetLeft: 6,
        offsetRight: 6,
      });
    expect(res.status).toBe(201);
    const geom = res.body.geometry;
    expect(geom.kind).toBe('chainage_offset');
    expect(geom.geometryWgs84.geometry.type).toBe('Polygon');
    expect(geom.lengthM).toBe(100);
    expect(geom.areaM2).toBeGreaterThan(0);
  });

  it('creates a point geometry with null area', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ kind: 'point', controlLineId, chainageStart: 50 });
    expect(res.status).toBe(201);
    expect(res.body.geometry.geometryWgs84.geometry.type).toBe('Point');
    expect(res.body.geometry.areaM2).toBeNull();
    expect(res.body.geometry.lengthM).toBe(0);
  });

  it('allows a site_engineer to write but denies foreman, viewer and subcontractor', async () => {
    const body = { kind: 'point', controlLineId, chainageStart: 10 };
    const engineerRes = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send(body);
    expect(engineerRes.status).toBe(201);

    for (const token of [foremanToken, viewerToken, subbieToken, outsiderToken]) {
      const res = await request(app)
        .post(`/api/lots/${lotA}/geometries`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      expect(res.status).toBe(403);
    }
  });

  const DRAWN_RING = [
    [151.0, -33.8],
    [151.001, -33.8],
    [151.001, -33.801],
    [151.0, -33.801],
    [151.0, -33.8],
  ];
  const drawnBody = (ring: number[][]) => ({
    kind: 'drawn',
    geometryWgs84: {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
  });

  it('creates a drawn polygon with server-computed area and no control line', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(drawnBody(DRAWN_RING));
    expect(res.status).toBe(201);
    const geom = res.body.geometry;
    expect(geom.kind).toBe('drawn');
    expect(geom.geometryWgs84.geometry.type).toBe('Polygon');
    expect(geom.controlLineId).toBeNull();
    expect(geom.chainageStart).toBeNull();
    expect(geom.lengthM).toBeNull();
    expect(geom.areaM2).toBeGreaterThan(0);
  });

  it('rejects a drawn polygon whose ring is not closed', async () => {
    const openRing = DRAWN_RING.slice(0, 4); // drop the closing position
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(drawnBody(openRing));
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/closed/i);
  });

  it('rejects a drawn ring with out-of-range coordinates', async () => {
    const badRing = [
      [999, -33.8],
      [151.001, -33.8],
      [151.001, -33.801],
      [999, -33.8],
    ];
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send(drawnBody(badRing));
    expect(res.status).toBe(400);
  });

  it('applies the same LOT_EDITORS gate to drawn geometries', async () => {
    for (const token of [foremanToken, viewerToken, subbieToken, outsiderToken]) {
      const res = await request(app)
        .post(`/api/lots/${lotA}/geometries`)
        .set('Authorization', `Bearer ${token}`)
        .send(drawnBody(DRAWN_RING));
      expect(res.status).toBe(403);
    }
  });

  it('rejects a control line from another project with 400', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ kind: 'point', controlLineId: siblingControlLineId, chainageStart: 10 });
    expect(res.status).toBe(400);
  });

  it('surfaces an out-of-range chainage as 400', async () => {
    const res = await request(app)
      .post(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({
        kind: 'chainage_offset',
        controlLineId,
        chainageStart: 500,
        chainageEnd: 600,
        offsetLeft: 6,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/outside the control line range/);
  });

  it('lists then scope-deletes a lot geometry', async () => {
    const list = await request(app)
      .get(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(list.status).toBe(200);
    expect(list.body.geometries.length).toBeGreaterThan(0);
    const target = list.body.geometries[0].id;

    // Wrong lot in the path → 404 (delete is scoped to the lot).
    const mismatched = await request(app)
      .delete(`/api/lots/${lotB}/geometries/${target}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(mismatched.status).toBe(404);

    // A read-only member cannot delete.
    const viewerDelete = await request(app)
      .delete(`/api/lots/${lotA}/geometries/${target}`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerDelete.status).toBe(403);

    const deleted = await request(app)
      .delete(`/api/lots/${lotA}/geometries/${target}`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(deleted.status).toBe(200);

    const after = await request(app)
      .get(`/api/lots/${lotA}/geometries`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(after.body.geometries.find((g: { id: string }) => g.id === target)).toBeUndefined();
  });

  it('backfills chainaged lots, skips out-of-range, and is idempotent', async () => {
    const denied = await request(app)
      .post(`/api/projects/${projectId}/control-lines/${controlLineId}/backfill-lot-geometries`)
      .set('Authorization', `Bearer ${engineerToken}`)
      .send({ offsetLeft: 6, offsetRight: 6 });
    expect(denied.status).toBe(403); // site_engineer can write lot geometry but not run project backfill

    const first = await request(app)
      .post(`/api/projects/${projectId}/control-lines/${controlLineId}/backfill-lot-geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ offsetLeft: 6, offsetRight: 6 });
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(1); // lotB (in range); lotNoCh/lotA have no chainage
    expect(first.body.skipped).toHaveLength(1);
    expect(first.body.skipped[0].lotId).toBe(lotOut);
    expect(first.body.skipped[0].reason).toMatch(/outside the control line range/);

    // lotB now has a chainage_offset geometry → second run creates nothing.
    const second = await request(app)
      .post(`/api/projects/${projectId}/control-lines/${controlLineId}/backfill-lot-geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ offsetLeft: 6, offsetRight: 6 });
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(0);

    const rejected = await request(app)
      .post(`/api/projects/${projectId}/control-lines/${controlLineId}/backfill-lot-geometries`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ offsetLeft: 0, offsetRight: 0 });
    expect(rejected.status).toBe(400);
  });
});

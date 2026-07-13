import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { projectCoverageRouter } from './projectCoverage.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectCoverageRouter);
app.use(errorHandler);

// A straight control line, chainage 0–100, in GDA2020 MGA56 (EPSG:7856).
const POINTS = [
  { chainage: 0, easting: 500_000, northing: 6_000_000 },
  { chainage: 100, easting: 500_100, northing: 6_000_000 },
];

// The coverage route recomputes gap polygons from the control line; the stored
// geometry WGS84 is not read, so a stub Feature is fine for seeded rows.
function stubFeature(): object {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [151, -33.8],
          [151.001, -33.8],
          [151, -33.801],
          [151, -33.8],
        ],
      ],
    },
  };
}

describe('GET /api/projects/:projectId/coverage', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let controlLineId: string;
  let malformedLineId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `CV Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `CV Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'cv-pm',
      fullName: 'CV PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'cv-outsider',
      fullName: 'CV Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
    outsiderToken = outsider.token;

    const project = await prisma.project.create({
      data: {
        name: `CV Project ${stamp}`,
        projectNumber: `CV-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
    });

    // Standalone subcontractor identity with an active project link — proves the
    // internal-only gate returns 403 even for a subbie who can see the project.
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `CV Subbie ${stamp}`,
        primaryContactName: 'CV Subbie',
        primaryContactEmail: `cv-subbie-${stamp}@example.com`,
        status: 'approved',
        portalAccess: { lots: true },
      },
    });
    const subbie = await registerTestUser(app, {
      emailPrefix: 'cv-subbie-user',
      fullName: 'CV Subbie User',
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

    const controlLine = await prisma.controlLine.create({
      data: {
        projectId,
        name: 'MC00 Mainline',
        coordinateSystem: 'EPSG:7856',
        points: POINTS,
        createdById: pm.userId,
      },
    });
    controlLineId = controlLine.id;

    // A malformed control line (single point) — normaliseControlPoints throws,
    // so it should degrade to an error entry, not 500 the whole report.
    const malformed = await prisma.controlLine.create({
      data: {
        projectId,
        name: 'Broken Line',
        coordinateSystem: 'EPSG:7856',
        points: [{ chainage: 0, easting: 500_000, northing: 6_000_000 }],
        createdById: pm.userId,
      },
    });
    malformedLineId = malformed.id;

    // Earthworks: 0–40 conformed, 60–100 in_progress -> gap 40–60, 40% conformed.
    const seed: Array<{ activity: string; status: string; start: number; end: number }> = [
      { activity: 'Earthworks', status: 'conformed', start: 0, end: 40 },
      { activity: 'Earthworks', status: 'in_progress', start: 60, end: 100 },
    ];
    for (const s of seed) {
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `CV-${s.activity}-${s.start}-${stamp}`,
          status: s.status,
          lotType: 'chainage',
          activityType: s.activity,
          chainageStart: s.start,
          chainageEnd: s.end,
        },
      });
      await prisma.lotGeometry.create({
        data: {
          lotId: lot.id,
          kind: 'chainage_offset',
          controlLineId,
          chainageStart: s.start,
          chainageEnd: s.end,
          offsetLeft: 6,
          offsetRight: 6,
          geometryWgs84: stubFeature() as never,
        },
      });
    }

    // A lot with NO geometry at all -> unmappedLotCount = 1.
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CV-UNMAPPED-${stamp}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Drainage',
      },
    });
  });

  afterAll(async () => {
    await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
    await prisma.controlLine.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompany: { projectId } } });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/coverage`);
    expect(res.status).toBe(401);
  });

  it('rejects a subcontractor with 403 (internal-only)', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/coverage`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a cross-company non-member with 403', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/coverage`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('computes per work-type coverage with gap ranges and polygons', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/coverage`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(200);

    const line = res.body.controlLines.find((l: { id: string }) => l.id === controlLineId);
    expect(line).toBeDefined();
    expect(line.extentStart).toBe(0);
    expect(line.extentEnd).toBe(100);
    expect(line.unmappedLotCount).toBe(1);

    const all = line.groups.find(
      (g: { activityType: string }) => g.activityType === 'All work types',
    );
    expect(all.lotCount).toBe(2);
    expect(all.percentLotted).toBe(80);
    expect(all.percentConformed).toBe(40);
    expect(all.gaps).toHaveLength(1);
    expect(all.gaps[0]).toMatchObject({ start: 40, end: 60, lengthM: 20 });
    expect(all.gaps[0].polygonWgs84).toMatchObject({ type: 'Feature' });

    const earthworks = line.groups.find(
      (g: { activityType: string }) => g.activityType === 'Earthworks',
    );
    expect(earthworks.percentLotted).toBe(80);
    expect(earthworks.percentConformed).toBe(40);
  });

  it('degrades a malformed control line to an error entry, not a 500', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/coverage`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(200);

    const broken = res.body.controlLines.find((l: { id: string }) => l.id === malformedLineId);
    expect(broken).toBeDefined();
    expect(broken.error).toBeTruthy();
    expect(broken.groups).toBeUndefined();
  });
});

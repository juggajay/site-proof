import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { projectLotGeometriesRouter } from './projectLotGeometries.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectLotGeometriesRouter);
app.use(errorHandler);

// Minimal valid GeoJSON Feature — the route returns geometryWgs84 verbatim.
function polygonFeature(): object {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [151.0, -33.8],
          [151.001, -33.8],
          [151.001, -33.801],
          [151.0, -33.801],
          [151.0, -33.8],
        ],
      ],
    },
  };
}

describe('GET /api/projects/:projectId/lot-geometries', () => {
  let companyId: string;
  let otherCompanyId: string;
  let pmToken: string;
  let subbieToken: string;
  let outsiderToken: string;
  let projectId: string;
  let otherProjectId: string;
  let assignedLotId: string;
  let unassignedLotId: string;
  let otherProjectLotId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `LG Co ${stamp}` } })).id;
    otherCompanyId = (await prisma.company.create({ data: { name: `LG Other ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'lg-pm',
      fullName: 'LG PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;

    const outsider = await registerTestUser(app, {
      emailPrefix: 'lg-outsider',
      fullName: 'LG Outsider',
      companyId: otherCompanyId,
      roleInCompany: 'project_manager',
    });
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

    const otherProject = await prisma.project.create({
      data: {
        name: `LG Other Project ${stamp}`,
        projectNumber: `LGO-${stamp}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = otherProject.id;

    await prisma.projectUser.create({
      data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
    });

    // Subcontractor company + standalone portal user, assigned to one lot only.
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `LG Subbie ${stamp}`,
        primaryContactName: 'LG Subbie',
        primaryContactEmail: `lg-subbie-${stamp}@example.com`,
        status: 'approved',
        portalAccess: { lots: true },
      },
    });

    const subbie = await registerTestUser(app, {
      emailPrefix: 'lg-subbie-user',
      fullName: 'LG Subbie User',
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

    const assignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `LG-ASSIGNED-${stamp}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
        assignedSubcontractorId: subcontractorCompany.id,
      },
    });
    assignedLotId = assignedLot.id;

    const unassignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `LG-UNASSIGNED-${stamp}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Drainage',
      },
    });
    unassignedLotId = unassignedLot.id;

    const otherProjectLot = await prisma.lot.create({
      data: {
        projectId: otherProjectId,
        lotNumber: `LG-OTHERPROJ-${stamp}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'General',
      },
    });
    otherProjectLotId = otherProjectLot.id;

    for (const lotId of [assignedLotId, unassignedLotId, otherProjectLotId]) {
      await prisma.lotGeometry.create({
        data: {
          lotId,
          kind: 'chainage_offset',
          geometryWgs84: polygonFeature() as never,
          areaM2: 1200.5,
          lengthM: 100,
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.lotGeometry.deleteMany({
      where: { lotId: { in: [assignedLotId, unassignedLotId, otherProjectLotId] } },
    });
    await prisma.lotSubcontractorAssignment.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.subcontractorUser.deleteMany({
      where: { subcontractorCompany: { projectId } },
    });
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyId, otherCompanyId] } } });
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/lot-geometries`);
    expect(res.status).toBe(401);
  });

  it('rejects a cross-company non-member with 403', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/lot-geometries`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  it('returns all project geometries joined with lot identity for an internal member', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/lot-geometries`)
      .set('Authorization', `Bearer ${pmToken}`);
    expect(res.status).toBe(200);

    const lotIds = res.body.geometries.map((g: { lotId: string }) => g.lotId).sort();
    expect(lotIds).toEqual([assignedLotId, unassignedLotId].sort());
    // Does not leak geometries from a sibling project.
    expect(lotIds).not.toContain(otherProjectLotId);

    const assigned = res.body.geometries.find((g: { lotId: string }) => g.lotId === assignedLotId);
    expect(assigned).toMatchObject({
      lotNumber: expect.stringContaining('LG-ASSIGNED-'),
      status: 'in_progress',
      activityType: 'Earthworks',
      kind: 'chainage_offset',
      areaM2: 1200.5,
      lengthM: 100,
    });
    expect(assigned.geometryWgs84).toMatchObject({ type: 'Feature' });
  });

  it('scopes a subcontractor to geometries for lots assigned to their company', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/lot-geometries`)
      .set('Authorization', `Bearer ${subbieToken}`);
    expect(res.status).toBe(200);
    expect(res.body.geometries).toHaveLength(1);
    expect(res.body.geometries[0].lotId).toBe(assignedLotId);
  });
});

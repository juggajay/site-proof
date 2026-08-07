import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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

const tag = `ifc-export-${Date.now()}`;
let companyId: string;
let projectId: string;
let adminId: string;
let foremanId: string;
let adminToken: string;
let foremanToken: string;

async function createControlLine() {
  return prisma.controlLine.create({
    data: {
      projectId,
      name: `${tag}-control`,
      coordinateSystem: 'EPSG:7856',
      points: [
        { chainage: 0, easting: 500_010, northing: 6_900_010 },
        { chainage: 500, easting: 500_510, northing: 6_900_010 },
      ],
    },
  });
}

async function createChainageLot(suffix: string, chainageStart: number, chainageEnd: number) {
  const controlLine = await createControlLine();
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'roadworks',
      activityType: 'Earthworks',
      status: 'in_progress',
    },
  });
  await prisma.lotGeometry.create({
    data: {
      lotId: lot.id,
      kind: 'chainage_offset',
      controlLineId: controlLine.id,
      chainageStart,
      chainageEnd,
      offsetLeft: 5,
      offsetRight: 5,
      geometryWgs84: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [] },
      },
      lengthM: chainageEnd - chainageStart,
    },
  });
  return lot;
}

function exportIfc(lotId: string, token = adminToken) {
  return request(app)
    .get(`/api/lots/${lotId}/exports/ifc-draft`)
    .set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;
  const admin = await registerTestUser(app, {
    emailPrefix: `${tag}-admin`,
    fullName: 'IFC Export Admin',
    companyId,
    roleInCompany: 'admin',
  });
  adminId = admin.userId;
  adminToken = admin.token;
  const foreman = await registerTestUser(app, {
    emailPrefix: `${tag}-foreman`,
    fullName: 'IFC Export Foreman',
    companyId,
    roleInCompany: 'foreman',
  });
  foremanId = foreman.userId;
  foremanToken = foreman.token;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      companyId,
      status: 'active',
      state: 'QLD',
      specificationSet: 'TMR',
      settings: JSON.stringify({ existingKey: 'preserve-me' }),
    },
  });
  projectId = project.id;
  await prisma.projectUser.createMany({
    data: [
      { projectId, userId: adminId, role: 'admin', status: 'active' },
      { projectId, userId: foremanId, role: 'foreman', status: 'active' },
    ],
  });
});

beforeEach(async () => {
  await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.controlLine.deleteMany({ where: { projectId } });
  await prisma.project.update({
    where: { id: projectId },
    data: { settings: JSON.stringify({ existingKey: 'preserve-me' }) },
  });
});

afterAll(async () => {
  await prisma.lotGeometry.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.controlLine.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: [adminId, foremanId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, foremanId] } } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('GET /api/lots/:id/exports/ifc-draft', () => {
  it('downloads an exportable lot as IFC', async () => {
    const lot = await createChainageLot('LOT-001', 0, 20);
    const response = await exportIfc(lot.id);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^application\/octet-stream/);
    expect(response.headers['content-disposition']).toContain(
      `filename="IFC-DRAFT-${lot.lotNumber}.ifc"`,
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Buffer.from(response.body).toString('ascii')).toMatch(/^ISO-10303-21;/);
  });

  it('returns IFC_NOT_EXPORTABLE for a drawn geometry', async () => {
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-drawn`,
        lotType: 'roadworks',
        activityType: 'Earthworks',
      },
    });
    await prisma.lotGeometry.create({
      data: {
        lotId: lot.id,
        kind: 'drawn',
        geometryWgs84: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [153, -27],
                [153.001, -27],
                [153.001, -27.001],
                [153, -27],
              ],
            ],
          },
        },
      },
    });

    const response = await exportIfc(lot.id);
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('This lot has no chainage-based geometry to export');
    expect(response.body.error.details.code).toBe('IFC_NOT_EXPORTABLE');
  });

  it('forbids a foreman', async () => {
    const lot = await createChainageLot('LOT-FOREMAN', 0, 20);
    expect((await exportIfc(lot.id, foremanToken)).status).toBe(403);
  });

  it('writes one immutable origin and preserves other project settings', async () => {
    const firstLot = await createChainageLot('LOT-FIRST', 0, 20);
    expect((await exportIfc(firstLot.id)).status).toBe(200);
    const afterFirst = JSON.parse(
      (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).settings!,
    );
    expect(afterFirst).toMatchObject({
      existingKey: 'preserve-me',
      ifcExportOrigin: { e: 500_000, n: 6_900_000, epsg: 'EPSG:7856' },
    });

    const secondLot = await createChainageLot('LOT-SECOND', 300, 320);
    expect((await exportIfc(secondLot.id)).status).toBe(200);
    const afterSecond = JSON.parse(
      (await prisma.project.findUniqueOrThrow({ where: { id: projectId } })).settings!,
    );
    expect(afterSecond).toEqual(afterFirst);
  });
});

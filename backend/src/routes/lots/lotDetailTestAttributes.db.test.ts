// D14 review B1 — the lot edit page silently wiped the C1 test attributes.
//
// GET /api/lots/:id did not select testScale / quantityValue / quantityUnit, so
// the edit form hydrated them as blank and its PATCH (which always sends all
// three) NULLed them on any unrelated save — a description edit reverted the
// lot's sufficiency evaluation to "unknown".
//
// The round-trip below is the reproduction: read the lot exactly as the edit
// page does, rebuild the payload from what the read returned, save, and assert
// the attributes survived.
//
// DB-backed, local disposable database only (`src/test/databaseSafety.ts`).

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

const tag = `lot-detail-attrs-${Date.now()}`;

let adminToken: string;
let adminUserId: string;
let companyId: string;
let projectId: string;

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const admin = await registerTestUser(app, {
    emailPrefix: `${tag}-admin`,
    fullName: 'Attrs Admin',
    companyId,
    roleInCompany: 'admin',
  });
  adminToken = admin.token;
  adminUserId = admin.userId;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `${tag}-P1`,
      companyId,
      status: 'active',
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  projectId = project.id;

  await prisma.projectUser.create({
    data: { projectId, userId: adminUserId, role: 'admin', status: 'active' },
  });
}, 60_000);

afterAll(async () => {
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.user.deleteMany({ where: { id: adminUserId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

async function seedLot(lotNumber: string) {
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber,
      lotType: 'chainage',
      activityType: 'Earthworks',
      activitySlug: 'earthworks_general',
      status: 'in_progress',
      description: 'Original description',
      testScale: 'B',
      quantityValue: 3200.5,
      quantityUnit: 'm2',
    },
  });
}

// The form buffer's `|| null` coercion, which is what turns a field the read
// omitted into an explicit NULL on the wire.
function orNull<T>(value: T) {
  return value || null;
}

function getLot(lotId: string) {
  return request(app).get(`/api/lots/${lotId}`).set('Authorization', `Bearer ${adminToken}`);
}

describe('GET /api/lots/:id returns the C1 test attributes', () => {
  it('selects testScale, quantityValue and quantityUnit', async () => {
    const lot = await seedLot(`${tag}-READ`);
    const res = await getLot(lot.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.lot.testScale).toBe('B');
    expect(Number(res.body.lot.quantityValue)).toBe(3200.5);
    expect(res.body.lot.quantityUnit).toBe('m2');
  });

  it('round-trips them through an edit-page save that only changes the description', async () => {
    const lot = await seedLot(`${tag}-ROUNDTRIP`);
    const read = await getLot(lot.id);
    expect(read.status, JSON.stringify(read.body)).toBe(200);
    const loaded = read.body.lot;

    // Exactly what LotEditPage sends: every managed field, hydrated from the
    // read, with `|| null` for the blanks. If the read omits a field the form
    // manages, this payload NULLs it.
    const res = await request(app)
      .patch(`/api/lots/${lot.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lotNumber: loaded.lotNumber,
        description: 'Edited description',
        activityType: orNull(loaded.activityType),
        layer: orNull(loaded.layer),
        areaZone: orNull(loaded.areaZone),
        status: orNull(loaded.status),
        testScale: orNull(loaded.testScale),
        quantityValue: orNull(loaded.quantityValue) && Number(loaded.quantityValue),
        quantityUnit: orNull(loaded.quantityUnit),
        expectedUpdatedAt: loaded.updatedAt,
      });
    expect(res.status, JSON.stringify(res.body)).toBe(200);

    const after = await prisma.lot.findUnique({ where: { id: lot.id } });
    expect(after?.description).toBe('Edited description');
    expect(after?.testScale).toBe('B');
    expect(Number(after?.quantityValue)).toBe(3200.5);
    expect(after?.quantityUnit).toBe('m2');
  });
});

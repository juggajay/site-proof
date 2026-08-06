/**
 * The checklist-item wire shape must carry every persisted field, and a
 * template edit must never reach into a lot that is already using it.
 *
 * Both are load-bearing for the acceptance-criteria editor input (benchmark
 * T4): `PATCH /api/itp/templates/:id` replaces checklist items wholesale
 * (`deleteMany` + `create`), so the edit modal writes back exactly what the GET
 * gave it. Before `toChecklistItemResponse` existed, the nine inline transforms
 * had drifted to omit `testType` and `notes` — so every template edit silently
 * erased the item's test type and the clause citation every seeder parks in
 * `notes`. These tests fail against that shape.
 */

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { itpRouter } from './index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/itp', itpRouter);
app.use(errorHandler);

const tag = `t4-${Date.now()}`;

// Every persisted field the editor can carry, on one item.
const FULL_ITEM = {
  description: 'Proof roll the subgrade in the presence of the Superintendent',
  category: 'contractor',
  responsibleParty: 'contractor',
  pointType: 'hold_point',
  isHoldPoint: true,
  evidenceRequired: 'test',
  acceptanceCriteria: 'No visible deflection or pumping',
  testType: 'Insitu Dry Density (Sand Replacement)',
  notes: 'MRTS04 Cl. 8.3 HOLD POINT.',
};

function expectFullItem(item: Record<string, unknown>) {
  expect(item).toMatchObject({
    description: FULL_ITEM.description,
    responsibleParty: 'contractor',
    pointType: 'hold_point',
    isHoldPoint: true,
    evidenceRequired: 'test',
    acceptanceCriteria: FULL_ITEM.acceptanceCriteria,
    testType: FULL_ITEM.testType,
    notes: FULL_ITEM.notes,
  });
}

describe('ITP template checklist-item field round-trip (T4)', () => {
  let projectId: string;
  let token: string;
  let userId: string;
  let companyId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { name: `T4 Co ${tag}` } });
    companyId = company.id;

    const admin = await registerTestUser(app, {
      emailPrefix: `t4-admin-${tag}`,
      fullName: 'T4 Admin',
      companyId,
      roleInCompany: 'admin',
    });
    token = admin.token;
    userId = admin.userId;

    const project = await prisma.project.create({
      data: {
        name: `T4 Project ${tag}`,
        projectNumber: `T4-${tag}`,
        companyId,
        status: 'active',
        state: 'QLD',
        specificationSet: 'TMR',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  async function createFullTemplate(name: string): Promise<string> {
    const res = await request(app)
      .post('/api/itp/templates')
      .set('Authorization', `Bearer ${token}`)
      .send({
        projectId,
        name,
        activityType: 'earthworks_general',
        checklistItems: [FULL_ITEM],
      });
    expect(res.status).toBe(201);
    expectFullItem(res.body.template.checklistItems[0]);
    return res.body.template.id as string;
  }

  it('returns every persisted field on create, list and get', async () => {
    const templateId = await createFullTemplate(`Round Trip ${tag}`);

    const single = await request(app)
      .get(`/api/itp/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(single.status).toBe(200);
    expectFullItem(single.body.template.checklistItems[0]);

    const list = await request(app)
      .get(`/api/itp/templates?projectId=${projectId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const listed = list.body.templates.find((t: { id: string }) => t.id === templateId) as {
      checklistItems: Record<string, unknown>[];
    };
    expectFullItem(listed.checklistItems[0]);
  });

  it('survives an edit that only changes the acceptance criterion', async () => {
    const templateId = await createFullTemplate(`Edit Preserves ${tag}`);

    const before = await request(app)
      .get(`/api/itp/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`);

    // Exactly what the edit modal sends back: the GET's own items, with one
    // field changed. Anything the GET omitted is null after this call.
    const items = before.body.template.checklistItems.map((item: Record<string, unknown>) => ({
      ...item,
      acceptanceCriteria: 'No visible deflection, pumping or rutting',
    }));

    const patched = await request(app)
      .patch(`/api/itp/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ checklistItems: items });

    expect(patched.status).toBe(200);
    expect(patched.body.template.checklistItems[0]).toMatchObject({
      acceptanceCriteria: 'No visible deflection, pumping or rutting',
      // The fields the form never touches must still be there.
      testType: FULL_ITEM.testType,
      notes: FULL_ITEM.notes,
      evidenceRequired: 'test',
      pointType: 'hold_point',
    });

    const persisted = await prisma.iTPChecklistItem.findFirstOrThrow({
      where: { templateId },
    });
    expect(persisted.testType).toBe(FULL_ITEM.testType);
    expect(persisted.notes).toBe(FULL_ITEM.notes);
    expect(persisted.acceptanceCriteria).toBe('No visible deflection, pumping or rutting');
  });

  it('carries every field through a clone', async () => {
    const templateId = await createFullTemplate(`Clone Source ${tag}`);

    const cloned = await request(app)
      .post(`/api/itp/templates/${templateId}/clone`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Clone Target ${tag}` });

    expect(cloned.status).toBe(201);
    expectFullItem(cloned.body.template.checklistItems[0]);
  });

  it('carries the acceptance criterion onto an assigned lot instance', async () => {
    const templateId = await createFullTemplate(`Assign Source ${tag}`);
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `T4-ASSIGN-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    const assigned = await request(app)
      .post('/api/itp/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ lotId: lot.id, templateId });

    expect(assigned.status).toBe(201);
    expectFullItem(assigned.body.instance.template.checklistItems[0]);
  });

  // The instance holds a frozen snapshot, so the lot states the specification
  // it was inspected against — not whatever the library holds today.
  it('leaves an in-use lot instance untouched when the template is edited', async () => {
    const templateId = await createFullTemplate(`In Use ${tag}`);
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `T4-INUSE-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });

    const assigned = await request(app)
      .post('/api/itp/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ lotId: lot.id, templateId });
    expect(assigned.status).toBe(201);
    const instanceId = assigned.body.instance.id as string;
    const snapshotBefore = (
      await prisma.iTPInstance.findUniqueOrThrow({ where: { id: instanceId } })
    ).templateSnapshot;

    const edited = await request(app)
      .patch(`/api/itp/templates/${templateId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        checklistItems: [
          {
            ...FULL_ITEM,
            description: 'REWRITTEN after the lot was already running',
            acceptanceCriteria: 'REWRITTEN criterion',
          },
        ],
      });
    expect(edited.status).toBe(200);

    const snapshotAfter = (
      await prisma.iTPInstance.findUniqueOrThrow({ where: { id: instanceId } })
    ).templateSnapshot;
    expect(snapshotAfter).toBe(snapshotBefore);

    const instance = await request(app)
      .get(`/api/itp/instances/lot/${lot.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(instance.status).toBe(200);
    const items = instance.body.instance.template.checklistItems as Record<string, unknown>[];
    expect(items[0].description).toBe(FULL_ITEM.description);
    expect(items[0].acceptanceCriteria).toBe(FULL_ITEM.acceptanceCriteria);
    expect(JSON.stringify(items)).not.toContain('REWRITTEN');
  });
});

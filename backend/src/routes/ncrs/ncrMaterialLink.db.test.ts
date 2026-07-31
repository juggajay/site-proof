/**
 * Wave C5.4a §5.1, §10 — the DB-backed acceptance tests for the NCR ↔ delivery
 * link.
 *
 * AT-189 an NCR carries its delivery, the link persists, deleting the delivery
 *        NULLs the link instead of deleting the NCR, and the index exists
 * AT-190 the link cannot cross a project or contradict a lot:
 *        (a) another project of the SAME company → 400
 *        (b) another TENANT entirely → 400
 *        (c) a delivery whose `lotId` is not among the NCR's lots → 400
 *        (d) a delivery with `lotId IS NULL` links freely
 * AT-191 characterisation: the prohibition on incorporation is unchanged — a lot
 *        with an open delivery-linked NCR is not conformable and emits
 *        `open_ncrs` at blocking severity; closing the NCR clears it
 *
 * AT-208(a) coexistence with Wave G G5, a FIRM merge condition in spec Rev 2
 *        (`[C54S-B11]`): one NCR carrying BOTH `itpChecklistItemId` and
 *        `linkedDeliveryId` persists and returns both, both indexes exist,
 *        deleting either referent nulls only that link and never the NCR, and
 *        each wave's own read still returns it
 *
 * DB-backed on purpose. The same-project check is a JOIN through
 * `daily_diaries` — `diary_deliveries` has no `project_id` (`[C5R-A9]`) — and a
 * mocked Prisma would assert nothing about the join, the FK or the `SET NULL`.
 * `src/test/databaseSafety.ts` keeps this on the local disposable database.
 */

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { parseAuditLogChanges } from '../../lib/auditLog.js';
import { buildConformanceBlockerItems } from '../../lib/evidenceReadiness/conformanceItems.js';
import { checkConformancePrerequisites } from '../../lib/conformancePrerequisites.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { ncrsRouter } from './index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use(errorHandler);

const tag = `c54a-${Date.now()}`;

let adminToken: string;
let projectId: string;
let lotId: string;
let otherLotId: string;
let checklistItemId: string;

/** Same company, different project — the cross-project half of AT-190. */
let siblingProjectDeliveryId: string;
/** A whole second tenant — the cross-tenant half of AT-190. */
let otherTenantDeliveryId: string;

let deliveryOnLotId: string;
let deliveryOnOtherLotId: string;
let unlinkedDeliveryId: string;

async function seedDelivery(diaryId: string, overrides: { lotId?: string | null } = {}) {
  const delivery = await prisma.diaryDelivery.create({
    data: {
      diaryId,
      description: '32 MPa concrete',
      supplier: 'Boral',
      docketNumber: `DK-${Math.random().toString(36).slice(2, 8)}`,
      batchRef: 'BATCH-77',
      lotId: overrides.lotId ?? null,
    },
  });
  return delivery.id;
}

function createNcr(body: Record<string, unknown>) {
  return request(app)
    .post('/api/ncrs')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      projectId,
      description: 'Delivered concrete did not match the approved mix',
      category: 'materials',
      severity: 'minor',
      ...body,
    });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `C5.4a Co ${tag}` } });

  const admin = await registerTestUser(app, {
    emailPrefix: `c54a-admin-${tag}`,
    fullName: 'C5.4a Admin',
    companyId: company.id,
    roleInCompany: 'admin',
  });
  adminToken = admin.token;

  const project = await prisma.project.create({
    data: {
      name: `C5.4a Project ${tag}`,
      projectNumber: `C54A-${tag}`,
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;
  await prisma.projectUser.create({
    data: { projectId, userId: admin.userId, role: 'admin', status: 'active' },
  });

  const lot = await prisma.lot.create({
    data: { projectId, lotNumber: `L1-${tag}`, lotType: 'standard', activityType: 'structures' },
  });
  lotId = lot.id;
  const otherLot = await prisma.lot.create({
    data: { projectId, lotNumber: `L2-${tag}`, lotType: 'standard', activityType: 'structures' },
  });
  otherLotId = otherLot.id;

  const diary = await prisma.dailyDiary.create({
    data: { projectId, date: new Date('2026-08-11T00:00:00Z') },
  });
  deliveryOnLotId = await seedDelivery(diary.id, { lotId });
  deliveryOnOtherLotId = await seedDelivery(diary.id, { lotId: otherLotId });
  unlinkedDeliveryId = await seedDelivery(diary.id);

  // Same tenant, different project. The company matches, so only the
  // diary→project join refuses this one.
  const siblingProject = await prisma.project.create({
    data: {
      name: `C5.4a Sibling ${tag}`,
      projectNumber: `C54AS-${tag}`,
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  const siblingDiary = await prisma.dailyDiary.create({
    data: { projectId: siblingProject.id, date: new Date('2026-08-11T00:00:00Z') },
  });
  siblingProjectDeliveryId = await seedDelivery(siblingDiary.id);

  // A whole second tenant.
  const otherCompany = await prisma.company.create({ data: { name: `C5.4a Other Co ${tag}` } });
  const otherProject = await prisma.project.create({
    data: {
      name: `C5.4a Other Project ${tag}`,
      projectNumber: `C54AO-${tag}`,
      companyId: otherCompany.id,
      status: 'active',
      state: 'VIC',
      specificationSet: 'VicRoads',
    },
  });
  const otherDiary = await prisma.dailyDiary.create({
    data: { projectId: otherProject.id, date: new Date('2026-08-11T00:00:00Z') },
  });
  otherTenantDeliveryId = await seedDelivery(otherDiary.id);

  // For the G5 coexistence test.
  const template = await prisma.iTPTemplate.create({
    data: {
      projectId,
      name: `C5.4a ITP ${tag}`,
      activityType: 'structures_general',
      checklistItems: { create: [{ sequenceNumber: 1, description: 'Concrete mix conformance' }] },
    },
    include: { checklistItems: true },
  });
  checklistItemId = template.checklistItems[0].id;
});

describe('AT-189 — an NCR carries its delivery, and the link survives correctly', () => {
  it('persists linkedDeliveryId on create and returns the delivery', async () => {
    const res = await createNcr({ linkedDeliveryId: deliveryOnLotId, lotIds: [lotId] });

    expect(res.status).toBe(201);
    expect(res.body.ncr.linkedDeliveryId).toBe(deliveryOnLotId);
    expect(res.body.ncr.linkedDelivery).toMatchObject({
      id: deliveryOnLotId,
      supplier: 'Boral',
      description: '32 MPa concrete',
    });

    const persisted = await prisma.nCR.findUnique({
      where: { id: res.body.ncr.id },
      select: { linkedDeliveryId: true },
    });
    expect(persisted?.linkedDeliveryId).toBe(deliveryOnLotId);
  });

  it('records the link in the create audit log', async () => {
    const res = await createNcr({ linkedDeliveryId: unlinkedDeliveryId });
    expect(res.status).toBe(201);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'ncr', entityId: res.body.ncr.id, action: 'ncr_created' },
      select: { changes: true },
    });
    const changes = parseAuditLogChanges(audit?.changes ?? null) as Record<string, unknown>;
    expect(changes.linkedDeliveryId).toBe(unlinkedDeliveryId);
  });

  it('NULLs the link when the delivery is deleted, and keeps the NCR', async () => {
    const diary = await prisma.dailyDiary.create({
      data: { projectId, date: new Date('2026-08-12T00:00:00Z') },
    });
    const doomedDeliveryId = await seedDelivery(diary.id);

    const res = await createNcr({ linkedDeliveryId: doomedDeliveryId });
    expect(res.status).toBe(201);
    const ncrId = res.body.ncr.id;

    await prisma.diaryDelivery.delete({ where: { id: doomedDeliveryId } });

    const survivor = await prisma.nCR.findUnique({
      where: { id: ncrId },
      select: { id: true, linkedDeliveryId: true, status: true },
    });
    expect(survivor).not.toBeNull();
    expect(survivor?.linkedDeliveryId).toBeNull();
  });

  it('indexes linked_delivery_id', async () => {
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ncrs' AND indexname = 'ncrs_linked_delivery_id_idx'
    `;
    expect(indexes).toHaveLength(1);
  });
});

describe('AT-190 — the link cannot cross a project or contradict a lot', () => {
  it('(a) refuses a delivery from another project of the same company', async () => {
    const res = await createNcr({ linkedDeliveryId: siblingProjectDeliveryId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Linked delivery must belong to the NCR project');
  });

  it('(b) refuses a delivery from another tenant', async () => {
    const res = await createNcr({ linkedDeliveryId: otherTenantDeliveryId });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Linked delivery must belong to the NCR project');
  });

  it('refuses a delivery id that does not exist', async () => {
    const res = await createNcr({ linkedDeliveryId: '00000000-0000-4000-8000-000000000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Linked delivery must belong to the NCR project');
  });

  it('(c) refuses a delivery whose lot is not among the NCR lots', async () => {
    const res = await createNcr({ linkedDeliveryId: deliveryOnOtherLotId, lotIds: [lotId] });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Linked delivery lot must be included in the NCR lots');
  });

  it('(d) links a delivery with no lot freely', async () => {
    const res = await createNcr({ linkedDeliveryId: unlinkedDeliveryId, lotIds: [lotId] });

    expect(res.status).toBe(201);
    expect(res.body.ncr.linkedDeliveryId).toBe(unlinkedDeliveryId);
  });

  it('leaves the link out entirely when it is not supplied', async () => {
    const res = await createNcr({ lotIds: [lotId] });

    expect(res.status).toBe(201);
    expect(res.body.ncr.linkedDeliveryId).toBeNull();
  });

  it('is create-only — PATCH never writes the link', async () => {
    const created = await createNcr({});
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/ncrs/${created.body.ncr.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ linkedDeliveryId: unlinkedDeliveryId });

    // `updateNcrSchema` never declares the key, so it is stripped before the
    // handler sees it and the request has nothing left to update.
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('No fields to update');
    const persisted = await prisma.nCR.findUnique({
      where: { id: created.body.ncr.id },
      select: { linkedDeliveryId: true },
    });
    expect(persisted?.linkedDeliveryId).toBeNull();
  });
});

describe('AT-191 — the prohibition on incorporation is unchanged (characterisation)', () => {
  it('blocks a lot whose open NCR carries a delivery, and clears when it closes', async () => {
    const conformLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `L191-${tag}`,
        lotType: 'standard',
        activityType: 'structures',
      },
    });
    const diary = await prisma.dailyDiary.create({
      data: { projectId, date: new Date('2026-08-13T00:00:00Z') },
    });
    const deliveryId = await seedDelivery(diary.id, { lotId: conformLot.id });

    const created = await createNcr({ linkedDeliveryId: deliveryId, lotIds: [conformLot.id] });
    expect(created.status).toBe(201);
    const ncrId = created.body.ncr.id;

    const blocked = await checkConformancePrerequisites(conformLot.id);
    expect(blocked.lot).not.toBeNull();
    expect(blocked.prerequisites?.noOpenNcrs).toBe(false);
    expect(blocked.canConform).toBe(false);

    const blockedItems = buildConformanceBlockerItems(blocked.prerequisites!);
    const openNcrItem = blockedItems.find((item) => item.code === 'open_ncrs');
    expect(openNcrItem?.severity).toBe('blocker');
    expect(openNcrItem?.relatedIds).toContain(ncrId);

    await prisma.nCR.update({ where: { id: ncrId }, data: { status: 'closed' } });

    const cleared = await checkConformancePrerequisites(conformLot.id);
    expect(cleared.prerequisites?.noOpenNcrs).toBe(true);
    expect(
      buildConformanceBlockerItems(cleared.prerequisites!).some(
        (item) => item.code === 'open_ncrs',
      ),
    ).toBe(false);

    // The link itself is untouched by closing the NCR.
    const persisted = await prisma.nCR.findUnique({
      where: { id: ncrId },
      select: { linkedDeliveryId: true },
    });
    expect(persisted?.linkedDeliveryId).toBe(deliveryId);
  });
});

describe('AT-208(a) — C5.4a coexists with the G5 learning loop', () => {
  it('carries itpChecklistItemId and linkedDeliveryId at once, with independent SET NULLs', async () => {
    const diary = await prisma.dailyDiary.create({
      data: { projectId, date: new Date('2026-08-14T00:00:00Z') },
    });
    const deliveryId = await seedDelivery(diary.id);

    const created = await createNcr({ linkedDeliveryId: deliveryId });
    expect(created.status).toBe(201);
    const ncrId = created.body.ncr.id;

    // `itpChecklistItemId` has no create-route input — G5 writes it from the
    // failed-ITP path and deliberately did not touch `createNcrSchema` — so the
    // NCR is brought to carrying both at the column.
    await prisma.nCR.update({
      where: { id: ncrId },
      data: { itpChecklistItemId: checklistItemId },
    });

    const both = await prisma.nCR.findUnique({
      where: { id: ncrId },
      select: { itpChecklistItemId: true, linkedDeliveryId: true },
    });
    expect(both).toEqual({ itpChecklistItemId: checklistItemId, linkedDeliveryId: deliveryId });

    // ...and the API returns both, not just the columns.
    const fetched = await request(app)
      .get(`/api/ncrs/${ncrId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.ncr).toMatchObject({
      itpChecklistItemId: checklistItemId,
      linkedDeliveryId: deliveryId,
    });
    expect(fetched.body.ncr.linkedDelivery).toMatchObject({ id: deliveryId });

    // Both indexes exist — G5's and C5.4a's.
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'ncrs'
        AND indexname IN ('ncrs_linked_delivery_id_idx',
                          'ncrs_project_id_itp_checklist_item_id_idx')
    `;
    expect(indexes.map((row) => row.indexname).sort()).toEqual([
      'ncrs_linked_delivery_id_idx',
      'ncrs_project_id_itp_checklist_item_id_idx',
    ]);

    // Each wave's own read still returns it: G5's checklist-item recurrence
    // grouping (`ncrLearning.ts:120-121`) and C5.4a's delivery link.
    const recurrence = await prisma.nCR.groupBy({
      by: ['itpChecklistItemId', 'responsibleSubcontractorId'],
      where: { projectId, itpChecklistItemId: { not: null } },
      _count: { _all: true },
    });
    expect(recurrence.map((group) => group.itpChecklistItemId)).toContain(checklistItemId);
    expect(
      await prisma.nCR.findMany({ where: { linkedDeliveryId: deliveryId }, select: { id: true } }),
    ).toEqual([{ id: ncrId }]);

    // Deleting the delivery NULLs only its own FK, and never the NCR.
    await prisma.diaryDelivery.delete({ where: { id: deliveryId } });
    expect(
      await prisma.nCR.findUnique({
        where: { id: ncrId },
        select: { itpChecklistItemId: true, linkedDeliveryId: true },
      }),
    ).toEqual({ itpChecklistItemId: checklistItemId, linkedDeliveryId: null });

    // And the reverse: re-link a delivery, delete the checklist item instead.
    const replacementDeliveryId = await seedDelivery(diary.id);
    await prisma.nCR.update({
      where: { id: ncrId },
      data: { linkedDeliveryId: replacementDeliveryId },
    });
    await prisma.iTPChecklistItem.delete({ where: { id: checklistItemId } });

    expect(
      await prisma.nCR.findUnique({
        where: { id: ncrId },
        select: { itpChecklistItemId: true, linkedDeliveryId: true },
      }),
    ).toEqual({ itpChecklistItemId: null, linkedDeliveryId: replacementDeliveryId });
  });
});

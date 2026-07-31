// Wave C5.1 — AT-171, AT-176(a)/(b)/(e), AT-177.
//
// `Lot.diaryDeliveries` has existed as a relation with NO route reading it, so
// a lot could not answer "what material went into me" at all. These are the
// first two reads, and they are the wave's first bulk surface — supplier names,
// quantities and docket numbers across a whole project — so the cap and the
// tenancy refusals are the point, not decoration (`[C3R-B1]`).

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

import { authRouter } from '../auth.js';
import {
  lotDeliveriesRouter,
  projectDeliveriesRouter,
  DELIVERY_REGISTER_MAX_LIMIT,
} from './index.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', projectDeliveriesRouter);
app.use('/api/lots', lotDeliveriesRouter);
app.use(errorHandler);

const SEEDED_ROWS = DELIVERY_REGISTER_MAX_LIMIT + 5;
/** C5-b — how many of the seeded rows get a docket document attached. */
const FILED_ROWS = 4;

describe('C5.1 — delivery read surfaces', () => {
  let adminToken: string;
  let subbieToken: string;
  let otherTenantToken: string;
  let projectId: string;
  let lotId: string;
  let otherTenantProjectId: string;
  let otherTenantLotId: string;
  let docketDocumentId: string;
  let filedDeliveryIds: string[];
  let latestDiaryDeliveryId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `C5 Register Co ${Date.now()}` },
    });

    const admin = await registerTestUser(app, {
      emailPrefix: 'c5-register-admin',
      fullName: 'C5 Register Admin',
      companyId: company.id,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;

    const project = await prisma.project.create({
      data: {
        name: 'C5 Register Project',
        projectNumber: `C5R-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
        companyId: company.id,
      },
    });
    projectId = project.id;

    const lot = await prisma.lot.create({
      data: { projectId, lotNumber: 'REG-001', lotType: 'general', activityType: 'earthworks' },
    });
    lotId = lot.id;

    const diary = await prisma.dailyDiary.create({
      data: { projectId, date: new Date('2026-07-10T00:00:00Z') },
    });

    // Past the cap, half of them linked to the lot and half not.
    await prisma.diaryDelivery.createMany({
      data: Array.from({ length: SEEDED_ROWS }, (_, index) => ({
        diaryId: diary.id,
        description: `Delivery ${index}`,
        supplier: index % 2 === 0 ? 'Boral' : 'Hanson',
        lotId: index % 2 === 0 ? lot.id : null,
      })),
    });

    // C5-b. `createMany` inside one statement gives every row the same
    // transaction timestamp, so "ordered by diary date" cannot be proven by
    // createdAt alone: move one row onto a LATER-dated diary and it must climb
    // to the top of the register.
    const laterDiary = await prisma.dailyDiary.create({
      data: { projectId, date: new Date('2026-07-20T00:00:00Z') },
    });
    const seeded = await prisma.diaryDelivery.findMany({
      where: { diaryId: diary.id },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    latestDiaryDeliveryId = seeded[0].id;
    await prisma.diaryDelivery.update({
      where: { id: latestDiaryDeliveryId },
      data: { diaryId: laterDiary.id },
    });

    const docketDocument = await prisma.document.create({
      data: {
        projectId,
        documentType: 'delivery_docket',
        filename: 'docket-4471.pdf',
        fileUrl: 'supabase://documents/test/docket-4471.pdf',
      },
    });
    docketDocumentId = docketDocument.id;
    filedDeliveryIds = seeded.slice(1, 1 + FILED_ROWS).map((row) => row.id);
    await prisma.diaryDelivery.updateMany({
      where: { id: { in: filedDeliveryIds } },
      data: { docketDocumentId },
    });

    const subbie = await registerTestUser(app, {
      emailPrefix: 'c5-register-subbie',
      fullName: 'C5 Register Subbie',
      companyId: company.id,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;
    await prisma.projectUser.create({
      data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
    });

    const otherCompany = await prisma.company.create({
      data: { name: `C5 Register Other Co ${Date.now()}` },
    });
    const otherAdmin = await registerTestUser(app, {
      emailPrefix: 'c5-register-other',
      fullName: 'C5 Register Other Admin',
      companyId: otherCompany.id,
      roleInCompany: 'admin',
    });
    otherTenantToken = otherAdmin.token;
    const otherProject = await prisma.project.create({
      data: {
        name: 'C5 Register Other Project',
        projectNumber: `C5RO-${Date.now()}`,
        state: 'VIC',
        specificationSet: 'VicRoads',
        companyId: otherCompany.id,
      },
    });
    otherTenantProjectId = otherProject.id;
    otherTenantLotId = (
      await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: 'OTHER-REG-001',
          lotType: 'general',
          activityType: 'earthworks',
        },
      })
    ).id;
  });

  describe('AT-171 — the register is bounded', () => {
    it('returns a page, not the full set, and marks that more exist', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(SEEDED_ROWS);
      expect(res.body.deliveries.length).toBe(50);
      expect(res.body.hasMore).toBe(true);
    });

    it('caps the page size at the route rather than trusting the client', async () => {
      await request(app)
        .get(`/api/projects/${projectId}/deliveries?limit=${DELIVERY_REGISTER_MAX_LIMIT + 1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      const atCap = await request(app)
        .get(`/api/projects/${projectId}/deliveries?limit=${DELIVERY_REGISTER_MAX_LIMIT}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(atCap.body.deliveries.length).toBe(DELIVERY_REGISTER_MAX_LIMIT);
      expect(atCap.body.hasMore).toBe(true);
    });

    it('pages to the end without collapsing', async () => {
      const lastPage = await request(app)
        .get(
          `/api/projects/${projectId}/deliveries?limit=${DELIVERY_REGISTER_MAX_LIMIT}&offset=${DELIVERY_REGISTER_MAX_LIMIT}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(lastPage.body.deliveries.length).toBe(SEEDED_ROWS - DELIVERY_REGISTER_MAX_LIMIT);
      expect(lastPage.body.hasMore).toBe(false);
    });

    it('filters by supplier and by linked/unlinked', async () => {
      const unlinked = await request(app)
        .get(
          `/api/projects/${projectId}/deliveries?linked=unlinked&limit=${DELIVERY_REGISTER_MAX_LIMIT}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(
        unlinked.body.deliveries.every((d: { lotId: string | null }) => d.lotId === null),
      ).toBe(true);

      const boral = await request(app)
        .get(
          `/api/projects/${projectId}/deliveries?supplier=boral&limit=${DELIVERY_REGISTER_MAX_LIMIT}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(boral.body.deliveries.every((d: { supplier: string }) => d.supplier === 'Boral')).toBe(
        true,
      );
      expect(boral.body.total).toBeGreaterThan(0);
    });
  });

  describe('C5-b — the docket filter is server-side, and the count is not', () => {
    it('filters to the deliveries whose docket evidence is filed', async () => {
      const res = await request(app)
        .get(
          `/api/projects/${projectId}/deliveries?docket=filed&limit=${DELIVERY_REGISTER_MAX_LIMIT}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBe(FILED_ROWS);
      expect(res.body.deliveries.map((d: { id: string }) => d.id).sort()).toEqual(
        [...filedDeliveryIds].sort(),
      );
      expect(
        res.body.deliveries.every(
          (d: { docketDocumentId: string }) => d.docketDocumentId === docketDocumentId,
        ),
      ).toBe(true);
    });

    it('filters to the deliveries with no docket filed, across the whole project not the page', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/deliveries?docket=not_filed`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // The point of the server-side filter: `total` is every unfiled delivery
      // in the project, not the handful that happened to land on page 1.
      expect(res.body.total).toBe(SEEDED_ROWS - FILED_ROWS);
      expect(res.body.deliveries.length).toBe(50);
      expect(
        res.body.deliveries.every(
          (d: { docketDocumentId: string | null }) => d.docketDocumentId === null,
        ),
      ).toBe(true);
    });

    it('combines with the lot filter instead of replacing it', async () => {
      const res = await request(app)
        .get(
          `/api/projects/${projectId}/deliveries?docket=not_filed&linked=unlinked&limit=${DELIVERY_REGISTER_MAX_LIMIT}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.total).toBeGreaterThan(0);
      expect(
        res.body.deliveries.every(
          (d: { docketDocumentId: string | null; lotId: string | null }) =>
            d.docketDocumentId === null && d.lotId === null,
        ),
      ).toBe(true);
    });

    it('reports the missing-docket count project-wide, unchanged by the active filter', async () => {
      const unfiltered = await request(app)
        .get(`/api/projects/${projectId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(unfiltered.body.missingDocketCount).toBe(SEEDED_ROWS - FILED_ROWS);

      const filed = await request(app)
        .get(`/api/projects/${projectId}/deliveries?docket=filed`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(filed.body.missingDocketCount).toBe(SEEDED_ROWS - FILED_ROWS);
    });

    it('rejects a docket value outside the vocabulary', async () => {
      await request(app)
        .get(`/api/projects/${projectId}/deliveries?docket=maybe`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('C5-b — the register reads as a chronology', () => {
    it('orders by diary date, newest first, with a stable id tiebreak', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/deliveries?limit=100`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.deliveries[0].id).toBe(latestDiaryDeliveryId);

      const dates = res.body.deliveries.map((d: { diary: { date: string } }) =>
        new Date(d.diary.date).getTime(),
      );
      expect(dates).toEqual([...dates].sort((a: number, b: number) => b - a));
    });

    it('pages deterministically — no row appears on two pages', async () => {
      const first = await request(app)
        .get(`/api/projects/${projectId}/deliveries?limit=100`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const second = await request(app)
        .get(`/api/projects/${projectId}/deliveries?limit=100&offset=100`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = [
        ...first.body.deliveries.map((d: { id: string }) => d.id),
        ...second.body.deliveries.map((d: { id: string }) => d.id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('AT-177 — an unlinked delivery warns and never blocks', () => {
    it('emits the support item with a count and blocksAction false', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.unlinkedCount).toBeGreaterThan(0);
      expect(res.body.readiness).toHaveLength(1);
      expect(res.body.readiness[0]).toMatchObject({
        code: 'delivery_not_lot_linked',
        severity: 'support',
        area: 'diary',
        blocksAction: false,
        count: res.body.unlinkedCount,
      });
    });
  });

  describe('AT-176 — cross-tenant refusals on the read surfaces', () => {
    it('(a) another tenant on the lot-scoped read → 403', async () => {
      await request(app)
        .get(`/api/lots/${lotId}/deliveries`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .expect(403);
    });

    it('(b) another tenant on the register → 403', async () => {
      await request(app)
        .get(`/api/projects/${projectId}/deliveries`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .expect(403);
    });

    it('(e) a subcontractor is refused on every C5 read surface', async () => {
      await request(app)
        .get(`/api/projects/${projectId}/deliveries`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .expect(403);
      await request(app)
        .get(`/api/lots/${lotId}/deliveries`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .expect(403);
    });

    it('does not leak another tenant lot through the owning tenant either', async () => {
      await request(app)
        .get(`/api/lots/${otherTenantLotId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
      await request(app)
        .get(`/api/projects/${otherTenantProjectId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  it('the lot-scoped read returns only that lot rows', async () => {
    const res = await request(app)
      .get(`/api/lots/${lotId}/deliveries`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.deliveries.length).toBeGreaterThan(0);
    expect(res.body.deliveries.every((d: { lotId: string }) => d.lotId === lotId)).toBe(true);
  });
});

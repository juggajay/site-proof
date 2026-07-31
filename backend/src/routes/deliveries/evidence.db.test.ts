// Wave C5.1 — AT-170, AT-176(d), AT-184, AT-185, AT-186.
//
// The failure this suite exists to pin: the supplier's concrete docket arrives
// the morning AFTER the pour, and by then the foreman has submitted the day's
// diary — at which point every shipped `DiaryDelivery` mutation refuses. Before
// §4.4a there was no way to attach it, so "what material went into this lot"
// was unanswerable at handover, which is the only time anybody asks.
//
// Every test here runs against a diary that is already `submitted` or
// `lockedAt`, because that is the only state that matters.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Toggled by the AT-185(c) rollback case: a route whose whole justification is
// that it edits evidence outside the normal lock cannot have a best-effort
// audit trail, so a failing audit write must take the update down with it.
const auditControl = vi.hoisted(() => ({ failNext: false }));

vi.mock('../../lib/auditLog.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/auditLog.js')>('../../lib/auditLog.js');
  return {
    ...actual,
    writeAuditLogInTransaction: vi.fn(async (tx: never, params: never) => {
      if (auditControl.failNext) {
        throw new Error('forced audit failure');
      }
      return actual.writeAuditLogInTransaction(tx, params);
    }),
  };
});

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return { ...actual, isSupabaseConfigured: vi.fn(() => false), getSupabaseClient: vi.fn() };
});

import { authRouter } from '../auth.js';
import diaryRouter from '../diary/index.js';
import documentsRouter from '../documents.js';
import { deliveriesRouter } from './index.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use(errorHandler);

async function createDelivery(diaryId: string, overrides: Record<string, unknown> = {}) {
  return prisma.diaryDelivery.create({
    data: { diaryId, description: '30 MPa concrete', supplier: 'Boral', ...overrides },
  });
}

describe('C5.1 — delivery evidence outside the diary lock', () => {
  let adminToken: string;
  let qmToken: string;
  let viewerToken: string;
  let subbieToken: string;
  let otherTenantToken: string;

  let companyId: string;
  let projectId: string;
  let lotId: string;
  let otherLotId: string;
  let submittedDiaryId: string;
  let lockedDiaryId: string;
  let draftDiaryId: string;
  let documentId: string;

  let archivedProjectDeliveryId: string;
  let foreignDocumentId: string;
  let foreignLotId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `C5 Evidence Co ${Date.now()}` },
    });
    companyId = company.id;

    const admin = await registerTestUser(app, {
      emailPrefix: 'c5-evidence-admin',
      fullName: 'C5 Admin',
      companyId,
      roleInCompany: 'admin',
    });
    adminToken = admin.token;

    const project = await prisma.project.create({
      data: {
        name: 'C5 Evidence Project',
        projectNumber: `C5E-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
        companyId,
      },
    });
    projectId = project.id;

    const lot = await prisma.lot.create({
      data: { projectId, lotNumber: 'LOT-001', lotType: 'general', activityType: 'earthworks' },
    });
    lotId = lot.id;
    const otherLot = await prisma.lot.create({
      data: { projectId, lotNumber: 'LOT-002', lotType: 'general', activityType: 'earthworks' },
    });
    otherLotId = otherLot.id;

    const makeDiary = async (date: Date, extra: Record<string, unknown> = {}) =>
      prisma.dailyDiary.create({ data: { projectId, date, ...extra } });

    submittedDiaryId = (
      await makeDiary(new Date('2026-07-01T00:00:00Z'), {
        status: 'submitted',
        submittedAt: new Date('2026-07-01T18:00:00Z'),
      })
    ).id;
    lockedDiaryId = (
      await makeDiary(new Date('2026-07-02T00:00:00Z'), {
        status: 'submitted',
        submittedAt: new Date('2026-07-02T18:00:00Z'),
        lockedAt: new Date('2026-07-09T18:00:00Z'),
      })
    ).id;
    draftDiaryId = (await makeDiary(new Date('2026-07-03T00:00:00Z'))).id;

    const document = await prisma.document.create({
      data: {
        projectId,
        filename: 'boral-docket-88213.pdf',
        fileUrl: 'documents/boral-docket-88213.pdf',
        mimeType: 'application/pdf',
        documentType: 'other',
        category: 'Material Delivery',
        uploadedById: admin.userId,
      },
    });
    documentId = document.id;

    // Roles come from ProjectUser: `quality_manager` is absent from
    // DIARY_WRITE_ROLES, which is the whole point of AT-185(a).
    const qm = await registerTestUser(app, {
      emailPrefix: 'c5-evidence-qm',
      fullName: 'C5 Quality Manager',
      companyId,
      roleInCompany: 'member',
    });
    qmToken = qm.token;
    await prisma.projectUser.create({
      data: { projectId, userId: qm.userId, role: 'quality_manager', status: 'active' },
    });

    const viewer = await registerTestUser(app, {
      emailPrefix: 'c5-evidence-viewer',
      fullName: 'C5 Viewer',
      companyId,
      roleInCompany: 'member',
    });
    viewerToken = viewer.token;
    await prisma.projectUser.create({
      data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
    });

    const subbie = await registerTestUser(app, {
      emailPrefix: 'c5-evidence-subbie',
      fullName: 'C5 Subcontractor',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;
    await prisma.projectUser.create({
      data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
    });

    // An archived project in the same company: `requireWritable: true` is what
    // stops this, and `requireInternalProjectAccess` would NOT have.
    const archivedProject = await prisma.project.create({
      data: {
        name: 'C5 Archived Project',
        projectNumber: `C5A-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
        companyId,
        status: 'archived',
      },
    });
    const archivedDiary = await prisma.dailyDiary.create({
      data: { projectId: archivedProject.id, date: new Date('2026-07-04T00:00:00Z') },
    });
    archivedProjectDeliveryId = (await createDelivery(archivedDiary.id)).id;

    // A whole second tenant, for the cross-tenant cases.
    const otherCompany = await prisma.company.create({
      data: { name: `C5 Other Co ${Date.now()}` },
    });
    const otherAdmin = await registerTestUser(app, {
      emailPrefix: 'c5-evidence-other',
      fullName: 'C5 Other Admin',
      companyId: otherCompany.id,
      roleInCompany: 'admin',
    });
    otherTenantToken = otherAdmin.token;
    const otherProject = await prisma.project.create({
      data: {
        name: 'C5 Other Project',
        projectNumber: `C5O-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
        companyId: otherCompany.id,
      },
    });
    foreignLotId = (
      await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: 'OTHER-001',
          lotType: 'general',
          activityType: 'earthworks',
        },
      })
    ).id;
    foreignDocumentId = (
      await prisma.document.create({
        data: {
          projectId: otherProject.id,
          filename: 'other-docket.pdf',
          fileUrl: 'documents/other-docket.pdf',
          mimeType: 'application/pdf',
          documentType: 'other',
          uploadedById: otherAdmin.userId,
        },
      })
    ).id;
  });

  describe('AT-184 — evidence is editable after submission, diary content is not', () => {
    it('sets docket, batch and lot on a SUBMITTED diary, and refuses the same fields through the diary route', async () => {
      const delivery = await createDelivery(submittedDiaryId);

      const res = await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ docketDocumentId: documentId, batchRef: 'BATCH-77/A', lotId });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        docketDocumentId: documentId,
        batchRef: 'BATCH-77/A',
        lotId,
      });

      const persisted = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(persisted).toMatchObject({
        docketDocumentId: documentId,
        batchRef: 'BATCH-77/A',
        lotId,
      });

      // The shipped diary write path still refuses — C5 did not unlock it.
      const viaDiary = await request(app)
        .put(`/api/diary/${submittedDiaryId}/deliveries/${delivery.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: '30 MPa concrete', lotId });
      expect(viaDiary.status).toBe(400);
      expect(viaDiary.body.error.message).toContain('Cannot modify submitted diary');
    });

    it('works on a LOCKED diary too, while the diary route still refuses', async () => {
      const delivery = await createDelivery(lockedDiaryId);

      const res = await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef: 'BATCH-88', lotId });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ batchRef: 'BATCH-88', lotId });

      const viaDiary = await request(app)
        .put(`/api/diary/${lockedDiaryId}/deliveries/${delivery.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: '30 MPa concrete' });
      expect(viaDiary.status).toBe(400);
      // A locked diary is necessarily a submitted one, and
      // `requireEditableDiaryForWrite` checks `submitted` first — either message
      // is the same refusal.
      expect(viaDiary.body.error.message).toMatch(/Cannot modify (submitted|locked) diary/);
    });

    it('rejects any key outside the three and leaves the row untouched', async () => {
      const delivery = await createDelivery(submittedDiaryId, {
        description: 'AC14 asphalt',
        quantity: 12,
        batchRef: 'KEEP-ME',
      });

      const res = await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef: 'CHANGED', quantity: 999 });

      expect(res.status).toBe(400);

      const after = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(after?.batchRef).toBe('KEEP-ME');
      expect(after?.quantity?.toString()).toBe('12');
      expect(after?.description).toBe('AC14 asphalt');
    });

    it('never touches diary content even when the body only names evidence keys', async () => {
      const delivery = await createDelivery(submittedDiaryId, {
        description: '40 MPa concrete',
        supplier: 'Hanson',
        unit: 'm3',
        notes: 'poured 6am',
      });

      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef: 'B-1' })
        .expect(200);

      const after = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(after).toMatchObject({
        description: '40 MPa concrete',
        supplier: 'Hanson',
        unit: 'm3',
        notes: 'poured 6am',
      });
    });

    it('clears a field when the key is present and null, and ignores absent keys', async () => {
      const delivery = await createDelivery(submittedDiaryId, { lotId, batchRef: 'B-9' });

      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lotId: null })
        .expect(200);

      const after = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(after?.lotId).toBeNull();
      expect(after?.batchRef).toBe('B-9');
    });

    it('refuses an empty body rather than writing a no-op audit row', async () => {
      const delivery = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('AT-170 — the docket is filed and the document survives', () => {
    it('round-trips a batch reference with internal whitespace and non-ASCII', async () => {
      const delivery = await createDelivery(submittedDiaryId);
      const batchRef = 'Lot 7 · BATCH 12/Ω — plant 3';

      const res = await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef })
        .expect(200);

      expect(res.body.batchRef).toBe(batchRef);
      const persisted = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(persisted?.batchRef).toBe(batchRef);
    });

    it('refuses a batch reference over the cap', async () => {
      const delivery = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef: 'x'.repeat(121) })
        .expect(400);
    });

    it('AT-186 — the linked docket cannot be deleted through the generic document route', async () => {
      const linkedDocument = await prisma.document.create({
        data: {
          projectId,
          filename: 'linked-docket.pdf',
          fileUrl: 'documents/linked-docket.pdf',
          mimeType: 'application/pdf',
          documentType: 'other',
          uploadedById: (await prisma.user.findFirstOrThrow({ where: { companyId } })).id,
        },
      });
      const delivery = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ docketDocumentId: linkedDocument.id })
        .expect(200);

      const blocked = await request(app)
        .delete(`/api/documents/${linkedDocument.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // A 409 with a code the UI can branch on — NOT the bare 422
      // INVALID_REFERENCE the raw Restrict FK would produce.
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.details).toMatchObject({
        code: 'WORKFLOW_EVIDENCE_DELETE_BLOCKED',
        evidenceType: 'delivery_docket',
      });
      expect(blocked.body.error.message).toContain('Delivery docket');

      expect(await prisma.document.findUnique({ where: { id: linkedDocument.id } })).not.toBeNull();
    });

    it('AT-187 — generic versioning cannot strand the delivery evidence link', async () => {
      const linkedDocument = await prisma.document.create({
        data: {
          projectId,
          filename: 'versionable-docket.pdf',
          fileUrl: 'documents/versionable-docket.pdf',
          mimeType: 'application/pdf',
          documentType: 'other',
          uploadedById: (await prisma.user.findFirstOrThrow({ where: { companyId } })).id,
        },
      });
      const delivery = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ docketDocumentId: linkedDocument.id })
        .expect(200);

      const blocked = await request(app)
        .post(`/api/documents/${linkedDocument.id}/version`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('%PDF-1.4\n%reissued docket\n'), {
          filename: 'reissued.pdf',
          contentType: 'application/pdf',
        });

      expect(blocked.status).toBe(409);
      expect(blocked.body.error.details).toMatchObject({
        code: 'WORKFLOW_EVIDENCE_VERSION_BLOCKED',
        evidenceType: 'delivery_docket',
      });

      // The FK still resolves to the current document — no superseded row is
      // left holding the evidence link.
      const after = await prisma.diaryDelivery.findUnique({
        where: { id: delivery.id },
        select: { docketDocument: { select: { id: true, isLatestVersion: true } } },
      });
      expect(after?.docketDocument).toMatchObject({
        id: linkedDocument.id,
        isLatestVersion: true,
      });
    });

    it('AT-186 — an unlinked document still deletes', async () => {
      const loose = await prisma.document.create({
        data: {
          projectId,
          filename: 'loose.pdf',
          fileUrl: 'documents/loose.pdf',
          mimeType: 'application/pdf',
          documentType: 'other',
          uploadedById: (await prisma.user.findFirstOrThrow({ where: { companyId } })).id,
        },
      });

      await request(app)
        .delete(`/api/documents/${loose.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      expect(await prisma.document.findUnique({ where: { id: loose.id } })).toBeNull();
    });
  });

  describe('AT-185 — the bypass is narrow, audited and offline-safe', () => {
    it('(a) quality_manager succeeds; viewer and subcontractor are refused', async () => {
      const forQm = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${forQm.id}/evidence`)
        .set('Authorization', `Bearer ${qmToken}`)
        .send({ batchRef: 'QM-OK' })
        .expect(200);

      const forViewer = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${forViewer.id}/evidence`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ batchRef: 'NOPE' })
        .expect(403);

      const forSubbie = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${forSubbie.id}/evidence`)
        .set('Authorization', `Bearer ${subbieToken}`)
        .send({ batchRef: 'NOPE' })
        .expect(403);
    });

    it('(b) an archived project still refuses the write (requireWritable)', async () => {
      const res = await request(app)
        .patch(`/api/deliveries/${archivedProjectDeliveryId}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef: 'ARCHIVED' });

      // `assertProjectAllowsWrite` throws AppError.conflict, so the refusal is a
      // 409 rather than the 403 the spec's prose implies. What matters is that
      // it refuses at all: `requireInternalProjectAccess` would have allowed it.
      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Archived projects are read-only');
      const after = await prisma.diaryDelivery.findUnique({
        where: { id: archivedProjectDeliveryId },
      });
      expect(after?.batchRef).toBeNull();
    });

    it('(c) writes a hard-fail audit row carrying from/to plus the diary lock state', async () => {
      const delivery = await createDelivery(submittedDiaryId, { batchRef: 'OLD' });

      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ batchRef: 'NEW', lotId })
        .expect(200);

      const audit = await prisma.auditLog.findFirst({
        where: { entityType: 'diary_delivery', entityId: delivery.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(audit).not.toBeNull();
      expect(audit?.action).toBe('delivery_evidence_updated');
      expect(audit?.projectId).toBe(projectId);

      const changes = JSON.parse(audit!.changes!) as Record<string, unknown>;
      expect(changes.batchRef).toEqual({ from: 'OLD', to: 'NEW' });
      expect(changes.lotId).toEqual({ from: null, to: lotId });
      expect(changes).not.toHaveProperty('docketDocumentId');
      expect(changes.diaryStatus).toBe('submitted');
      expect(changes).toHaveProperty('diaryLockedAt');
    });

    it('(c) a failed audit write rolls the update back — it is not best-effort', async () => {
      const delivery = await createDelivery(submittedDiaryId, { batchRef: 'BEFORE' });

      auditControl.failNext = true;
      try {
        const res = await request(app)
          .patch(`/api/deliveries/${delivery.id}/evidence`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ batchRef: 'AFTER' });
        expect(res.status).toBeGreaterThanOrEqual(500);
      } finally {
        auditControl.failNext = false;
      }

      const after = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(after?.batchRef).toBe('BEFORE');
    });

    it('(d) an offline replay after an evidence edit does not clobber the lot link', async () => {
      // The offline queue is create-only and always POSTs, so a delayed retry
      // carries the ORIGINAL body — including a null lotId. If
      // `createDiaryItemOnce` ever became an upsert, this replay would wipe a
      // lot link set later through the evidence route.
      const requestKey = `c5-offline-${Date.now()}`;
      const body = { description: 'Offline concrete', supplier: 'Boral', requestKey };

      const first = await request(app)
        .post(`/api/diary/${draftDiaryId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body)
        .expect(201);
      const deliveryId = first.body.id as string;

      await request(app)
        .patch(`/api/deliveries/${deliveryId}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lotId, batchRef: 'OFFLINE-1' })
        .expect(200);

      const replay = await request(app)
        .post(`/api/diary/${draftDiaryId}/deliveries`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      expect(replay.status).toBe(201);
      expect(replay.body.id).toBe(deliveryId);

      const after = await prisma.diaryDelivery.findUnique({ where: { id: deliveryId } });
      expect(after?.lotId).toBe(lotId);
      expect(after?.batchRef).toBe('OFFLINE-1');
      expect(
        await prisma.diaryDelivery.count({ where: { diaryId: draftDiaryId, requestKey } }),
      ).toBe(1);
    });
  });

  describe('AT-176(d)/(f) — cross-tenant binding on the write route', () => {
    it('refuses a document from another project', async () => {
      const delivery = await createDelivery(submittedDiaryId);
      const res = await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ docketDocumentId: foreignDocumentId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Document does not belong to this project');
      const after = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(after?.docketDocumentId).toBeNull();
    });

    it('refuses a lot from another project', async () => {
      const delivery = await createDelivery(submittedDiaryId);
      const res = await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lotId: foreignLotId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Lot does not belong to this project');
    });

    it('refuses another tenant entirely', async () => {
      const delivery = await createDelivery(submittedDiaryId);
      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({ batchRef: 'NOPE' })
        .expect(403);
    });

    it('accepts a second lot in the same project (the link is re-pointable)', async () => {
      const delivery = await createDelivery(submittedDiaryId, { lotId });
      await request(app)
        .patch(`/api/deliveries/${delivery.id}/evidence`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ lotId: otherLotId })
        .expect(200);

      const after = await prisma.diaryDelivery.findUnique({ where: { id: delivery.id } });
      expect(after?.lotId).toBe(otherLotId);
    });
  });
});

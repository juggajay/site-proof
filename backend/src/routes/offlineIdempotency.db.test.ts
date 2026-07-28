// H5 — offline sync retries must never duplicate a field record.
//
// The defect: the offline queue POSTs a mutation, the server commits it, the
// connection drops before the response arrives, the client marks the item
// errored and leaves it queued, and the 60s auto-retry POSTs the SAME body
// again — creating a second NCR / delivery / event / photo.
//
// The client cannot detect this (it never saw a response), so the fix is
// server-side: a client-generated `requestKey`, unique per scope, that makes
// the replayed POST return the ORIGINAL record with the normal success shape.
//
// Every test here reproduces the failure literally: POST once (the request that
// committed), then POST the identical body again (the retry), then assert the
// database holds exactly ONE row and both responses name it. On unfixed code
// the second POST creates a second row and the count assertion fails.
//
// The unique index behind the pre-check is asserted too — it is what makes the
// dedupe race-safe rather than merely check-then-insert.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';

// Force the local-filesystem storage path for the upload route (mirrors
// documents.test.ts) so no test ever reaches Supabase Storage.
vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    getSupabaseClient: vi.fn(),
  };
});

import { authRouter } from './auth.js';
import { ncrsRouter } from './ncrs/index.js';
import diaryRouter from './diary/index.js';
import documentsRouter from './documents.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/documents', documentsRouter);
app.use(errorHandler);

const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
// SOI + APP0/JFIF + EOI — assertUploadedFileMatchesDeclaredType sniffs ff d8 ff.
const JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

describe('H5 — offline retry idempotency (commit, connection drop, retry)', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let diaryId: string;

  beforeAll(async () => {
    fs.mkdirSync(uploadsDir, { recursive: true });

    const company = await prisma.company.create({
      data: { name: `H5 Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const primaryUser = await registerTestUser(app, {
      emailPrefix: 'h5-idempotency',
      fullName: 'H5 Test User',
      companyId,
      roleInCompany: 'admin',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

    const project = await prisma.project.create({
      data: {
        name: `H5 Test Project ${Date.now()}`,
        projectNumber: `H5P-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `H5-LOT-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    // A future-dated diary stays editable (unsubmitted) for the whole suite.
    const diaryRes = await request(app)
      .post('/api/diary')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        date: new Date(Date.now() + 864000000).toISOString().split('T')[0],
      });
    expect(diaryRes.status).toBe(201);
    diaryId = diaryRes.body.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } });
    await prisma.iTPCompletionAttachment.deleteMany({
      where: { document: { projectId } },
    });
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } });
    await prisma.nCR.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.diaryDelivery.deleteMany({ where: { diary: { projectId } } });
    await prisma.diaryEvent.deleteMany({ where: { diary: { projectId } } });
    await prisma.dailyDiary.deleteMany({ where: { projectId } });
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('ncr_create', () => {
    it('replays the original NCR when the queue retries a request that already committed', async () => {
      // The offline queue's own local NCR id, stable across retries.
      const requestKey = `offline-ncr-${crypto.randomUUID()}`;
      const body = {
        projectId,
        description: 'Subgrade fails level tolerance at CH 1250',
        category: 'workmanship',
        severity: 'minor',
        lotIds: [lotId],
        requestKey,
      };

      // 1. The POST that reached the server and committed. Its 201 never
      //    reached the foreman's tablet.
      const committed = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      expect(committed.status).toBe(201);

      // 2. The 60s auto-retry, byte-identical.
      const retry = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);

      // The whole point: ONE NCR, not two identically worded ones with
      // consecutive numbers. Counted by CONTENT, so this fails on unfixed code
      // (which ignores requestKey entirely) rather than silently passing.
      const ncrs = await prisma.nCR.findMany({
        where: { projectId, description: body.description },
        select: { id: true, requestKey: true },
      });
      expect(ncrs).toHaveLength(1);
      expect(ncrs[0].id).toBe(committed.body.ncr.id);
      expect(ncrs[0].requestKey).toBe(requestKey);

      // The retry must look like success so the worker dequeues the item.
      expect(retry.status).toBe(201);
      expect(retry.body.ncr.id).toBe(committed.body.ncr.id);
      expect(retry.body.ncr.ncrNumber).toBe(committed.body.ncr.ncrNumber);
    });

    it('does not re-run the create side effects on a replay', async () => {
      await prisma.auditLog.deleteMany({ where: { projectId, action: 'ncr_created' } });

      const requestKey = `offline-ncr-${crypto.randomUUID()}`;
      const body = {
        projectId,
        description: 'Replay must not double-audit',
        category: 'workmanship',
        requestKey,
      };

      const committed = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      expect(committed.status).toBe(201);

      await request(app).post('/api/ncrs').set('Authorization', `Bearer ${authToken}`).send(body);

      // One create, one audit row — a replay must not re-audit, re-notify or
      // re-emit the webhook the original request already fired.
      const auditRows = await prisma.auditLog.count({
        where: { projectId, action: 'ncr_created' },
      });
      expect(auditRows).toBe(1);
    });

    it('still creates independent NCRs for different keys and for no key at all', async () => {
      const base = { projectId, description: 'Distinct defect', category: 'workmanship' };

      const first = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...base, requestKey: `offline-ncr-${crypto.randomUUID()}` });
      const second = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ...base, requestKey: `offline-ncr-${crypto.randomUUID()}` });
      // Two online creates carry no key at all; NULLs are distinct in the
      // unique index, so they must not block each other.
      const thirdOnline = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(base);
      const fourthOnline = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(base);

      const ids = [first, second, thirdOnline, fourthOnline].map((res) => {
        expect(res.status).toBe(201);
        return res.body.ncr.id as string;
      });
      expect(new Set(ids).size).toBe(4);
    });
  });

  describe('delivery_save', () => {
    it('replays the original delivery when the queue retries a request that already committed', async () => {
      const requestKey = `delivery-${crypto.randomUUID()}`;
      const body = {
        description: '20t 20mm aggregate',
        supplier: 'Boral',
        docketNumber: 'D-88231',
        lotId,
        requestKey,
      };

      const committed = await request(app)
        .post(`/api/diary/${diaryId}/deliveries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      expect(committed.status).toBe(201);

      const retry = await request(app)
        .post(`/api/diary/${diaryId}/deliveries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);

      // Counted by content so the assertion catches unfixed code.
      const rows = await prisma.diaryDelivery.findMany({
        where: { diaryId, docketNumber: body.docketNumber },
        select: { id: true, requestKey: true },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].requestKey).toBe(requestKey);

      expect(retry.status).toBe(201);
      expect(retry.body.id).toBe(committed.body.id);
    });

    it('keeps unkeyed deliveries independent', async () => {
      const body = { description: 'Unkeyed delivery' };
      const first = await request(app)
        .post(`/api/diary/${diaryId}/deliveries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      const second = await request(app)
        .post(`/api/diary/${diaryId}/deliveries`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });
  });

  describe('event_save', () => {
    it('replays the original event when the queue retries a request that already committed', async () => {
      const requestKey = `event-${crypto.randomUUID()}`;
      const body = {
        eventType: 'visitor',
        description: 'TfNSW surveillance visit',
        lotId,
        requestKey,
      };

      const committed = await request(app)
        .post(`/api/diary/${diaryId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);
      expect(committed.status).toBe(201);

      const retry = await request(app)
        .post(`/api/diary/${diaryId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(body);

      // Counted by content so the assertion catches unfixed code.
      const rows = await prisma.diaryEvent.findMany({
        where: { diaryId, description: body.description },
        select: { id: true, requestKey: true },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].requestKey).toBe(requestKey);

      expect(retry.status).toBe(201);
      expect(retry.body.id).toBe(committed.body.id);
    });

    it('leaves the QA auto-event sourceRef dedupe untouched', async () => {
      // requestKey is a separate column from sourceRef: a manual replay key
      // must not collide with the auto-compiled QA provenance key.
      const requestKey = `event-${crypto.randomUUID()}`;
      const res = await request(app)
        .post(`/api/diary/${diaryId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ eventType: 'other', description: 'Manual row', requestKey });

      expect(res.status).toBe(201);
      const row = await prisma.diaryEvent.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row.source).toBe('manual');
      expect(row.sourceRef).toBeNull();
      expect(row.requestKey).toBe(requestKey);
    });
  });

  describe('photo_upload', () => {
    async function uploadPhoto(requestKey: string | undefined, filename: string) {
      const req = request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('lotId', lotId)
        .field('documentType', 'photo')
        .field('capturedAt', new Date().toISOString());
      if (requestKey) {
        req.field('requestKey', requestKey);
      }
      return req.attach('file', JPEG_BYTES, { filename, contentType: 'image/jpeg' });
    }

    it('replays the original document when the queue retries an upload that already committed', async () => {
      const requestKey = `photo-${crypto.randomUUID()}`;
      const filename = `defect-${Date.now()}.jpg`;

      const committed = await uploadPhoto(requestKey, filename);
      expect(committed.status).toBe(201);

      // The retry the re-upload guard can never catch: the client never read
      // the first response, so serverDocumentId was never persisted.
      const retry = await uploadPhoto(requestKey, filename);

      // Counted by content so the assertion catches unfixed code.
      const documents = await prisma.document.findMany({
        where: { projectId, filename },
        select: { id: true, requestKey: true },
      });
      expect(documents).toHaveLength(1);
      expect(documents[0].requestKey).toBe(requestKey);

      expect(retry.status).toBe(201);
      expect(retry.body.id).toBe(committed.body.id);
    });

    it('keeps unkeyed uploads independent', async () => {
      const first = await uploadPhoto(undefined, 'unkeyed-a.jpg');
      const second = await uploadPhoto(undefined, 'unkeyed-b.jpg');
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.id).not.toBe(first.body.id);
    });
  });

  describe('the dedupe is a database constraint, not just a pre-check', () => {
    it('rejects a second row with the same scoped requestKey at the database level', async () => {
      const requestKey = `delivery-${crypto.randomUUID()}`;
      await prisma.diaryDelivery.create({
        data: { diaryId, description: 'first', requestKey },
      });

      await expect(
        prisma.diaryDelivery.create({
          data: { diaryId, description: 'second', requestKey },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('scopes the key so two projects can use the same client id', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `H5 Other Project ${Date.now()}`,
          projectNumber: `H5O-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const requestKey = `photo-${crypto.randomUUID()}`;

      try {
        const a = await prisma.document.create({
          data: {
            projectId,
            documentType: 'photo',
            filename: 'a.jpg',
            fileUrl: '/uploads/documents/a.jpg',
            requestKey,
          },
        });
        const b = await prisma.document.create({
          data: {
            projectId: otherProject.id,
            documentType: 'photo',
            filename: 'b.jpg',
            fileUrl: '/uploads/documents/b.jpg',
            requestKey,
          },
        });
        expect(a.id).not.toBe(b.id);
      } finally {
        await prisma.document.deleteMany({ where: { projectId: otherProject.id } });
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { prisma } from '../../lib/prisma.js';
import { AuditAction } from '../../lib/auditLog.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { holdpointsRouter } from '../holdpoints.js';
import { buildTemplateSnapshot } from '../itp/helpers/templateSnapshot.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const SIGNATURE_DATA_URL = 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=';

function hashToken(rawToken: string): string {
  return `sha256:${crypto.createHash('sha256').update(rawToken).digest('hex')}`;
}

describe('Hold Point batch review-room public routes', () => {
  let companyId: string;
  let projectId: string;
  let templateId: string;
  let lotId: string;
  let itpInstanceId: string;
  let requestingUserId: string;
  let holdPoint1Id: string;
  let holdPoint2Id: string;
  let outsideHoldPointId: string;
  let evidenceDocumentId: string;
  let evidenceFilePath: string;
  let batchRawToken: string;
  let expiredBatchRawToken: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Batch Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const requestingUser = await prisma.user.create({
      data: {
        email: `batch-requester-${Date.now()}@example.com`,
        fullName: 'Batch Requester',
        passwordHash: 'x',
        companyId,
      },
    });
    requestingUserId = requestingUser.id;

    const project = await prisma.project.create({
      data: {
        name: `Batch Test Project ${Date.now()}`,
        projectNumber: `BATCH-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: 'Batch Test Template', activityType: 'Earthworks' },
    });
    templateId = template.id;

    const item1 = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'Subgrade proof roll',
        pointType: 'hold_point',
        sequenceNumber: 1,
      },
    });
    const item2 = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'Base course level',
        pointType: 'hold_point',
        sequenceNumber: 2,
      },
    });
    // unique(lotId, itpChecklistItemId): the outside-the-batch hold point needs
    // its own checklist item — item2 already backs hp2 on the same lot.
    const item3 = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'Not in batch',
        pointType: 'hold_point',
        sequenceNumber: 3,
      },
    });

    const snapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `BATCH-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    const itpInstance = await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId,
        templateSnapshot: JSON.stringify(buildTemplateSnapshot(snapshotSource)),
        status: 'not_started',
      },
    });
    itpInstanceId = itpInstance.id;

    const completion = await prisma.iTPCompletion.create({
      data: { itpInstanceId: itpInstance.id, checklistItemId: item1.id, status: 'completed' },
    });

    const evidenceFilename = `batch-hp-evidence-${Date.now()}.pdf`;
    const evidenceUploadDir = path.join(process.cwd(), 'uploads', 'documents');
    evidenceFilePath = path.join(evidenceUploadDir, evidenceFilename);
    fs.mkdirSync(evidenceUploadDir, { recursive: true });
    fs.writeFileSync(evidenceFilePath, Buffer.from('%PDF-1.4 batch hold point evidence'));
    const evidenceDocument = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'itp_evidence',
        filename: 'batch-release-evidence.pdf',
        fileUrl: `/uploads/documents/${evidenceFilename}`,
        mimeType: 'application/pdf',
      },
    });
    evidenceDocumentId = evidenceDocument.id;
    await prisma.iTPCompletionAttachment.create({
      data: { completionId: completion.id, documentId: evidenceDocument.id },
    });

    const hp1 = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: item1.id,
        pointType: 'hold_point',
        description: 'Subgrade proof roll',
        status: 'notified',
      },
    });
    holdPoint1Id = hp1.id;
    const hp2 = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: item2.id,
        pointType: 'hold_point',
        description: 'Base course level',
        status: 'notified',
      },
    });
    holdPoint2Id = hp2.id;
    // A hold point that is NOT part of the batch (different token, no batchId).
    const outsideHp = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: item3.id,
        pointType: 'hold_point',
        description: 'Not in batch',
        status: 'notified',
      },
    });
    outsideHoldPointId = outsideHp.id;

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    batchRawToken = `batch-token-${Date.now()}`;
    const batch = await prisma.holdPointReleaseBatch.create({
      data: {
        lotId,
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Batch Reviewer',
        token: hashToken(batchRawToken),
        expiresAt,
        scheduledDate: new Date('2026-07-10T00:00:00.000Z'),
        scheduledTime: '09:30',
        requestedByUserId: requestingUserId,
      },
    });

    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: hp1.id,
        batchId: batch.id,
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Batch Reviewer',
        token: hashToken(`${batchRawToken}-hp1`),
        expiresAt,
      },
    });
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: hp2.id,
        batchId: batch.id,
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Batch Reviewer',
        token: hashToken(`${batchRawToken}-hp2`),
        expiresAt,
      },
    });
    // Outside token: no batchId — must never be reachable via the batch link.
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: outsideHp.id,
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Batch Reviewer',
        token: hashToken(`${batchRawToken}-outside`),
        expiresAt,
      },
    });

    expiredBatchRawToken = `expired-batch-token-${Date.now()}`;
    await prisma.holdPointReleaseBatch.create({
      data: {
        lotId,
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Batch Reviewer',
        token: hashToken(expiredBatchRawToken),
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } });
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
    await prisma.holdPointReleaseBatch.deleteMany({ where: { lotId } });
    await prisma.holdPoint.deleteMany({ where: { lotId } });
    await prisma.iTPCompletionAttachment.deleteMany({
      where: { document: { id: evidenceDocumentId } },
    });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
    await prisma.document.deleteMany({ where: { id: evidenceDocumentId } });
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.user.delete({ where: { id: requestingUserId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    if (evidenceFilePath) {
      fs.rmSync(evidenceFilePath, { force: true });
    }
  });

  it('returns the batch summary with its hold points sorted by sequence', async () => {
    const res = await request(app).get(`/api/holdpoints/public/batch/${batchRawToken}`);

    expect(res.status).toBe(200);
    expect(res.body.batch.project.name).toContain('Batch Test Project');
    expect(res.body.batch.lot.lotNumber).toBeDefined();
    expect(res.body.batch.requestedBy).toBe('Batch Requester');
    expect(res.body.batch.recipient).toEqual({
      email: 'reviewer@example.com',
      name: 'Batch Reviewer',
    });
    expect(res.body.batch.holdPoints).toHaveLength(2);
    expect(res.body.batch.holdPoints.map((hp: { holdPointId: string }) => hp.holdPointId)).toEqual([
      holdPoint1Id,
      holdPoint2Id,
    ]);
    expect(res.body.batch.holdPoints[0]).toMatchObject({ sequenceNumber: 1, status: 'notified' });
  });

  it('rejects an unknown or hash-supplied batch token', async () => {
    const unknown = await request(app).get('/api/holdpoints/public/batch/not-a-real-token');
    expect(unknown.status).toBe(404);

    // Supplying the stored hash directly must fail (it is re-hashed on lookup).
    const storedHash = hashToken(batchRawToken);
    const rehashed = await request(app).get(
      `/api/holdpoints/public/batch/${encodeURIComponent(storedHash)}`,
    );
    expect(rehashed.status).toBe(404);
  });

  it('rejects an expired batch token with 410', async () => {
    const res = await request(app).get(`/api/holdpoints/public/batch/${expiredBatchRawToken}`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns the full evidence package for a hold point in the batch', async () => {
    const res = await request(app).get(
      `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${holdPoint1Id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.isPublicAccess).toBe(true);
    expect(res.body.evidencePackage.holdPoint).toBeDefined();
    expect(res.body.tokenInfo.canRelease).toBe(true);
    // Company branding is plumbed on the batch evidence payload (PR A).
    expect(res.body.evidencePackage.project.company?.name).toBeTruthy();
    // Backend-mediated only — no raw storage URLs leak.
    expect(JSON.stringify(res.body.evidencePackage)).not.toContain('/uploads/documents/');
  });

  it('rejects evidence and document access for a hold point not in the batch', async () => {
    const evidence = await request(app).get(
      `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${outsideHoldPointId}`,
    );
    expect(evidence.status).toBe(404);

    const doc = await request(app).get(
      `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${outsideHoldPointId}/documents/${evidenceDocumentId}`,
    );
    expect(doc.status).toBe(404);
  });

  it('streams a scoped evidence document and blocks out-of-package documents', async () => {
    const res = await request(app).get(
      `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${holdPoint1Id}/documents/${evidenceDocumentId}?disposition=inline`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');

    const denied = await request(app).get(
      `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${holdPoint1Id}/documents/not-in-package`,
    );
    expect(denied.status).toBe(403);
  });

  it('rejects releasing a hold point that is not part of the batch', async () => {
    const res = await request(app)
      .post(`/api/holdpoints/public/batch/${batchRawToken}/release`)
      .send({
        holdPointIds: [outsideHoldPointId],
        releasedByName: 'Batch Reviewer',
        signatureDataUrl: SIGNATURE_DATA_URL,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('HOLD_POINT_NOT_IN_BATCH');

    const outsideToken = await prisma.holdPointReleaseToken.findFirstOrThrow({
      where: { holdPointId: outsideHoldPointId },
    });
    expect(outsideToken.usedAt).toBeNull();
  });

  it('releases the selected batch hold points atomically with per-hold-point audit entries', async () => {
    const res = await request(app)
      .post(`/api/holdpoints/public/batch/${batchRawToken}/release`)
      .send({
        holdPointIds: [holdPoint1Id, holdPoint2Id],
        releasedByName: 'Ignored Name',
        releasedByOrg: 'Client Co',
        releaseNotes: 'All good',
        signatureDataUrl: SIGNATURE_DATA_URL,
      });

    expect(res.status).toBe(200);
    expect(res.body.released).toHaveLength(2);
    // Token recipient name wins over the submitted name.
    expect(res.body.released[0].releasedByName).toBe('Batch Reviewer');

    const holdPoints = await prisma.holdPoint.findMany({
      where: { id: { in: [holdPoint1Id, holdPoint2Id] } },
    });
    expect(holdPoints.every((hp) => hp.status === 'released')).toBe(true);
    expect(holdPoints.every((hp) => hp.releaseMethod === 'secure_link')).toBe(true);

    const tokens = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId: { in: [holdPoint1Id, holdPoint2Id] } },
    });
    expect(tokens.every((token) => token.usedAt !== null)).toBe(true);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityId: { in: [holdPoint1Id, holdPoint2Id] },
        action: AuditAction.HP_PUBLIC_RELEASED,
      },
    });
    expect(audits).toHaveLength(2);

    // The matching ITP completions are reconciled to verified/completed.
    const completions = await prisma.iTPCompletion.findMany({ where: { itpInstanceId } });
    expect(completions.every((c) => c.verificationStatus === 'verified')).toBe(true);

    // The stored release signature is now surfaced on the evidence payload (PR A).
    const evidence = await request(app).get(
      `/api/holdpoints/public/batch/${batchRawToken}/holdpoints/${holdPoint1Id}`,
    );
    expect(evidence.status).toBe(200);
    expect(evidence.body.evidencePackage.holdPoint.releaseSignatureUrl).toBe(SIGNATURE_DATA_URL);
  });

  it('rejects re-releasing an already-released batch hold point without a second audit', async () => {
    const res = await request(app)
      .post(`/api/holdpoints/public/batch/${batchRawToken}/release`)
      .send({
        holdPointIds: [holdPoint1Id],
        releasedByName: 'Batch Reviewer',
        signatureDataUrl: SIGNATURE_DATA_URL,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already been released');
  });
});

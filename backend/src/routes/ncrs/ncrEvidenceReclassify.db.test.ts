// The before/after reclassify escape hatch (benchmark T6, review finding 6).
//
// A mistagged photo must never permanently block a close, so reclassify is
// deliberately allowed during 'verification' — unlike DELETE, which is frozen
// there. DB-backed because the lifecycle and audit rows are what matter.
import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
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

const tag = `ncr-reclassify-${Date.now()}`;

let adminToken: string;
let adminId: string;
let outsiderToken: string;
let projectId: string;
let ncrSequence = 0;

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });

  const admin = await registerTestUser(app, {
    emailPrefix: `${tag}-admin`,
    fullName: 'Reclassify Admin',
    companyId: company.id,
    roleInCompany: 'admin',
  });
  adminToken = admin.token;
  adminId = admin.userId;

  const otherCompany = await prisma.company.create({ data: { name: `Other ${tag}` } });
  const outsider = await registerTestUser(app, {
    emailPrefix: `${tag}-outsider`,
    fullName: 'Reclassify Outsider',
    companyId: otherCompany.id,
    roleInCompany: 'admin',
  });
  outsiderToken = outsider.token;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  await prisma.projectUser.create({
    data: { projectId, userId: adminId, role: 'admin', status: 'active' },
  });
});

async function createNcrWithEvidence(
  suffix: string,
  options: { status?: string; evidenceType?: string; mimeType?: string } = {},
) {
  ncrSequence += 1;
  const ncr = await prisma.nCR.create({
    data: {
      projectId,
      ncrNumber: `${tag}-${ncrSequence}-${suffix}`,
      description: `Reclassify suite ${suffix}`,
      category: 'Workmanship',
      severity: 'minor',
      status: options.status ?? 'verification',
      raisedById: adminId,
    },
  });

  const filename = `${tag}-${ncrSequence}-${suffix}.jpg`;
  const document = await prisma.document.create({
    data: {
      projectId,
      documentType: 'ncr_evidence',
      category: 'ncr_evidence',
      filename,
      fileUrl: `/uploads/documents/${filename}`,
      mimeType: options.mimeType ?? 'image/jpeg',
      uploadedById: adminId,
    },
  });

  const evidence = await prisma.nCREvidence.create({
    data: {
      ncrId: ncr.id,
      documentId: document.id,
      evidenceType: options.evidenceType ?? 'before_photo',
    },
  });

  return { ncr, evidence };
}

const reclassify = (
  ncrId: string,
  evidenceId: string,
  body: Record<string, unknown>,
  token = adminToken,
) =>
  request(app)
    .patch(`/api/ncrs/${ncrId}/evidence/${evidenceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('PATCH /api/ncrs/:id/evidence/:evidenceId', () => {
  it('reclassifies a before photo to after and writes an audit row', async () => {
    const { ncr, evidence } = await createNcrWithEvidence('happy');

    const res = await reclassify(ncr.id, evidence.id, { evidenceType: 'after_photo' });

    expect(res.status).toBe(200);
    expect(res.body.evidence.evidenceType).toBe('after_photo');
    expect(
      await prisma.nCREvidence.findUniqueOrThrow({
        where: { id: evidence.id },
        select: { evidenceType: true },
      }),
    ).toMatchObject({ evidenceType: 'after_photo' });

    const audit = await prisma.auditLog.findMany({
      where: { entityId: evidence.id, action: AuditAction.NCR_EVIDENCE_RECLASSIFIED },
    });
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].changes ?? '{}')).toMatchObject({
      evidenceType: { from: 'before_photo', to: 'after_photo' },
    });
  });

  it('never returns a raw storage URL', async () => {
    const { ncr, evidence } = await createNcrWithEvidence('no-url');

    const res = await reclassify(ncr.id, evidence.id, { evidenceType: 'after_photo' });

    expect(res.status).toBe(200);
    expect(res.body.evidence.document).not.toHaveProperty('fileUrl');
    expect(JSON.stringify(res.body)).not.toContain('/uploads/documents/');
  });

  it('rejects a phase outside the before/after vocabulary', async () => {
    const { ncr, evidence } = await createNcrWithEvidence('bad-phase');

    for (const evidenceType of ['photo', 'retest_certificate', 'closed', '']) {
      expect((await reclassify(ncr.id, evidence.id, { evidenceType })).status).toBe(400);
    }

    expect(
      await prisma.nCREvidence.findUniqueOrThrow({
        where: { id: evidence.id },
        select: { evidenceType: true },
      }),
    ).toMatchObject({ evidenceType: 'before_photo' });
  });

  it('refuses to phase a non-photo document', async () => {
    const { ncr, evidence } = await createNcrWithEvidence('certificate', {
      evidenceType: 'retest_certificate',
      mimeType: 'application/pdf',
    });

    const res = await reclassify(ncr.id, evidence.id, { evidenceType: 'after_photo' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Only photo evidence can be classified as before or after');
  });

  it.each(['closed', 'closed_concession'])('refuses to reclassify on a %s NCR', async (status) => {
    const { ncr, evidence } = await createNcrWithEvidence(`locked-${status}`, { status });

    const res = await reclassify(ncr.id, evidence.id, { evidenceType: 'after_photo' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Cannot reclassify evidence on a closed NCR');
  });

  it('rejects a user with no access to the project', async () => {
    const { ncr, evidence } = await createNcrWithEvidence('outsider');

    const res = await reclassify(
      ncr.id,
      evidence.id,
      { evidenceType: 'after_photo' },
      outsiderToken,
    );

    expect([403, 404]).toContain(res.status);
    expect(
      await prisma.nCREvidence.findUniqueOrThrow({
        where: { id: evidence.id },
        select: { evidenceType: true },
      }),
    ).toMatchObject({ evidenceType: 'before_photo' });
  });

  it('requires authentication', async () => {
    const { ncr, evidence } = await createNcrWithEvidence('anon');

    const res = await request(app)
      .patch(`/api/ncrs/${ncr.id}/evidence/${evidence.id}`)
      .send({ evidenceType: 'after_photo' });

    expect(res.status).toBe(401);
  });

  it('404s when the evidence belongs to a different NCR', async () => {
    const { evidence } = await createNcrWithEvidence('mismatch-a');
    const { ncr: otherNcr } = await createNcrWithEvidence('mismatch-b');

    expect(
      (await reclassify(otherNcr.id, evidence.id, { evidenceType: 'after_photo' })).status,
    ).toBe(404);
  });
});

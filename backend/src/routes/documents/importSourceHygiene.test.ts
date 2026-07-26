/**
 * Wave B `[WBR2-11]` §4.11 + `[WBR2-3]` §3.3.
 *
 * Import source files are internal provenance artefacts: they stay out of the
 * client-visible document register, are unreachable by a subcontractor, and
 * cannot be deleted out from under a live or applied import.
 */
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return { ...actual, isSupabaseConfigured: () => false };
});

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import documentsRouter from '../documents.js';
import { IMPORT_SOURCE_DOCUMENT_TYPE, INTERNAL_ONLY_DOCUMENT_TYPES } from './access.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use(errorHandler);

describe('import source documents stay out of the register', () => {
  let companyId: string;
  let projectId: string;
  let pmToken: string;
  let pmUserId: string;
  let subbieToken: string;
  let importSourceId: string;
  let ordinaryDocId: string;

  beforeAll(async () => {
    const stamp = Date.now();
    companyId = (await prisma.company.create({ data: { name: `Hyg Co ${stamp}` } })).id;

    const pm = await registerTestUser(app, {
      emailPrefix: 'hyg-pm',
      fullName: 'Hyg PM',
      companyId,
      roleInCompany: 'project_manager',
    });
    pmToken = pm.token;
    pmUserId = pm.userId;

    const subbie = await registerTestUser(app, {
      emailPrefix: 'hyg-subbie',
      fullName: 'Hyg Subbie',
      companyId,
      roleInCompany: 'subcontractor',
    });
    subbieToken = subbie.token;

    projectId = (
      await prisma.project.create({
        data: {
          name: `Hyg Project ${stamp}`,
          projectNumber: `HYG-${stamp}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      })
    ).id;

    await prisma.projectUser.create({
      data: { projectId, userId: pm.userId, role: 'project_manager', status: 'active' },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
    });
  });

  beforeEach(async () => {
    await prisma.importBatch.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });

    importSourceId = (
      await prisma.document.create({
        data: {
          projectId,
          documentType: IMPORT_SOURCE_DOCUMENT_TYPE,
          filename: 'contractor-itps.xlsx',
          fileUrl: 'uploads/import-sources/x/y/contractor-itps.xlsx',
          uploadedById: pmUserId,
        },
      })
    ).id;
    ordinaryDocId = (
      await prisma.document.create({
        data: {
          projectId,
          documentType: 'general',
          filename: 'site-notes.pdf',
          fileUrl: 'uploads/documents/site-notes.pdf',
          uploadedById: pmUserId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.importBatch.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { companyId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  it('lists the ordinary document but never the import source', async () => {
    const res = await request(app)
      .get(`/api/documents/${projectId}`)
      .set('Authorization', `Bearer ${pmToken}`);

    expect(res.status).toBe(200);
    const ids = (res.body.documents ?? res.body.data ?? []).map((d: { id: string }) => d.id);
    expect(ids).toContain(ordinaryDocId);
    expect(ids).not.toContain(importSourceId);
  });

  it('hides it even when the caller asks for that documentType by name', async () => {
    const res = await request(app)
      .get(`/api/documents/${projectId}?documentType=${IMPORT_SOURCE_DOCUMENT_TYPE}`)
      .set('Authorization', `Bearer ${pmToken}`);

    const ids = (res.body.documents ?? res.body.data ?? []).map((d: { id: string }) => d.id);
    expect(ids).not.toContain(importSourceId);
  });

  it('is unreachable by a subcontractor identity', async () => {
    const res = await request(app)
      .get(`/api/documents/${projectId}`)
      .set('Authorization', `Bearer ${subbieToken}`);

    const ids = (res.body.documents ?? res.body.data ?? []).map((d: { id: string }) => d.id);
    expect(ids).not.toContain(importSourceId);
  });

  it('keeps drawings excluded from the subcontractor register alongside it', () => {
    expect([...INTERNAL_ONLY_DOCUMENT_TYPES]).toEqual(['drawing', 'import_source']);
  });

  describe('source survival guard', () => {
    async function makeBatch(status: string) {
      return prisma.importBatch.create({
        data: {
          projectId,
          kind: 'itp_template',
          sourceFormat: 'excel',
          status,
          sourceDocumentId: importSourceId,
          createdById: pmUserId,
        },
      });
    }

    it('refuses to delete the source of an APPLIED import, naming the blocker', async () => {
      await makeBatch('applied');

      const res = await request(app)
        .delete(`/api/documents/${importSourceId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/roll the import back first/);
      expect(await prisma.document.count({ where: { id: importSourceId } })).toBe(1);
    });

    it('refuses to delete the source of an in-progress import', async () => {
      await makeBatch('dry_run');

      const res = await request(app)
        .delete(`/api/documents/${importSourceId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/cancel the import first/);
    });

    it('releases the source once the import is rolled back', async () => {
      await makeBatch('rolled_back');

      const res = await request(app)
        .delete(`/api/documents/${importSourceId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(204);
    });

    it('leaves an applied batch readable when its source is gone (SetNull, not a crash)', async () => {
      const batch = await makeBatch('rolled_back');
      await request(app)
        .delete(`/api/documents/${importSourceId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      const after = await prisma.importBatch.findUniqueOrThrow({ where: { id: batch.id } });
      expect(after.sourceDocumentId).toBeNull();
    });

    it('lets the PROJECT be deleted even with an applied batch on it (no FK Restrict)', async () => {
      const stamp = Date.now();
      const doomed = await prisma.project.create({
        data: {
          name: `Doomed ${stamp}`,
          projectNumber: `DOOM-${stamp}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const doc = await prisma.document.create({
        data: {
          projectId: doomed.id,
          documentType: IMPORT_SOURCE_DOCUMENT_TYPE,
          filename: 'x.xlsx',
          fileUrl: 'uploads/import-sources/x.xlsx',
          uploadedById: pmUserId,
        },
      });
      await prisma.importBatch.create({
        data: {
          projectId: doomed.id,
          kind: 'itp_template',
          sourceFormat: 'excel',
          status: 'applied',
          sourceDocumentId: doc.id,
          createdById: pmUserId,
        },
      });

      // A Restrict FK here would abort the whole project delete.
      await expect(prisma.project.delete({ where: { id: doomed.id } })).resolves.toBeDefined();
      expect(await prisma.importBatch.count({ where: { projectId: doomed.id } })).toBe(0);
    });
  });
});

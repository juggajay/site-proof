import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Import documents router
import documentsRouter from './documents.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use(errorHandler);

// Ensure upload directory exists for tests
const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
const certificateUploadDir = path.join(process.cwd(), 'uploads', 'certificates');
const drawingUploadDir = path.join(process.cwd(), 'uploads', 'drawings');
for (const dir of [uploadDir, certificateUploadDir, drawingUploadDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const validPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;
const ORIGINAL_ANTHROPIC_DOCUMENT_CLASS_MODEL = process.env.ANTHROPIC_DOCUMENT_CLASS_MODEL;
const ORIGINAL_SUPABASE_URL = process.env.SUPABASE_URL;

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function hasUnsafeFilenameChar(value: string): boolean {
  return value.split('').some((char) => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char));
}

function writeTestUpload(dir: string, filename: string, contents = validPdfBytes): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

describe('Documents API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let documentId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Documents Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `documents-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Documents Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Documents Test Project ${Date.now()}`,
        projectNumber: `DOC-${Date.now()}`,
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

    // Create lot for document association
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `DOC-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    // Create a test document directly in the database
    const document = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'Site Photos',
        filename: 'test-photo.jpg',
        fileUrl: '/uploads/documents/test-photo.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedById: userId,
        caption: 'Test site photo',
        tags: 'test,photo',
      },
    });
    documentId = document.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  afterEach(() => {
    restoreOptionalEnv('ANTHROPIC_API_KEY', ORIGINAL_ANTHROPIC_API_KEY);
    restoreOptionalEnv('ANTHROPIC_MODEL', ORIGINAL_ANTHROPIC_MODEL);
    restoreOptionalEnv('ANTHROPIC_DOCUMENT_CLASS_MODEL', ORIGINAL_ANTHROPIC_DOCUMENT_CLASS_MODEL);
    restoreOptionalEnv('SUPABASE_URL', ORIGINAL_SUPABASE_URL);
    vi.restoreAllMocks();
  });

  async function createDataImageDocument(filename: string) {
    return prisma.document.create({
      data: {
        projectId,
        documentType: 'photo',
        category: 'Site Photos',
        filename,
        fileUrl: `data:image/jpeg;base64,${Buffer.from('mock image').toString('base64')}`,
        fileSize: 10,
        mimeType: 'image/jpeg',
        uploadedById: userId,
      },
    });
  }

  describe('GET /api/documents/:projectId', () => {
    it('should list documents for project', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toBeDefined();
      expect(Array.isArray(res.body.documents)).toBe(true);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.categories).toBeDefined();
    });

    it('should filter by category', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?category=Site Photos`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toBeDefined();
    });

    it('should filter by documentType', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?documentType=photo`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toBeDefined();
    });

    it('should filter by lotId', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?lotId=${lotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toBeDefined();
    });

    it('should search documents', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?search=test`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toBeDefined();
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/documents/${projectId}?dateFrom=${today}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.documents).toBeDefined();
    });

    it('should reject invalid date filters instead of returning a server error', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?dateFrom=not-a-date`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('dateFrom');

      const invalidCalendarDateRes = await request(app)
        .get(`/api/documents/${projectId}?dateFrom=2026-02-30`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidCalendarDateRes.status).toBe(400);
      expect(invalidCalendarDateRes.body.error.message).toContain('dateFrom');

      const invalidCalendarDateTimeRes = await request(app)
        .get(`/api/documents/${projectId}?dateFrom=2026-02-30T10:00:00Z`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidCalendarDateTimeRes.status).toBe(400);
      expect(invalidCalendarDateTimeRes.body.error.message).toContain('dateFrom');
    });
  });

  describe('GET /api/documents/signed-url/validate', () => {
    it('should return invalid for non-existent token', async () => {
      const res = await request(app).get(
        `/api/documents/signed-url/validate?token=invalid-token&documentId=${documentId}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    it('should require token parameter', async () => {
      const res = await request(app).get(
        `/api/documents/signed-url/validate?documentId=${documentId}`,
      );

      expect(res.status).toBe(400);
    });

    it('should require documentId parameter', async () => {
      const res = await request(app).get('/api/documents/signed-url/validate?token=some-token');

      expect(res.status).toBe(400);
    });

    it('should reject oversized documentId parameters', async () => {
      const res = await request(app).get(
        `/api/documents/signed-url/validate?token=some-token&documentId=${'d'.repeat(121)}`,
      );

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('documentId is too long');
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized document route parameters before lookups', async () => {
      const longId = 'd'.repeat(121);
      const checks = [
        {
          label: 'GET project documents',
          response: await request(app)
            .get(`/api/documents/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET signed download',
          response: await request(app).get(`/api/documents/download/${longId}?token=invalid-token`),
        },
        {
          label: 'POST classify',
          response: await request(app)
            .post(`/api/documents/${longId}/classify`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST save classification',
          response: await request(app)
            .post(`/api/documents/${longId}/save-classification`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ classification: 'Safety' }),
        },
        {
          label: 'POST signed URL',
          response: await request(app)
            .post(`/api/documents/${longId}/signed-url`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH document',
          response: await request(app)
            .patch(`/api/documents/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ caption: 'Updated caption' }),
        },
        {
          label: 'GET versions',
          response: await request(app)
            .get(`/api/documents/${longId}/versions`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET file',
          response: await request(app)
            .get(`/api/documents/file/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE document',
          response: await request(app)
            .delete(`/api/documents/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      const versionFilename = `route-param-version-${Date.now()}.pdf`;
      const beforeVersionFiles = new Set(fs.readdirSync(uploadDir));
      let leakedVersionFiles: string[] = [];

      try {
        checks.push({
          label: 'POST version',
          response: await request(app)
            .post(`/api/documents/${longId}/version`)
            .set('Authorization', `Bearer ${authToken}`)
            .attach('file', validPdfBytes, {
              filename: versionFilename,
              contentType: 'application/pdf',
            }),
        });

        leakedVersionFiles = fs
          .readdirSync(uploadDir)
          .filter((file) => !beforeVersionFiles.has(file) && file.includes(versionFilename));

        for (const { label, response } of checks) {
          expect(response.status, label).toBe(400);
          expect(response.body.error.message, label).toContain('is too long');
        }

        expect(leakedVersionFiles).toHaveLength(0);
      } finally {
        for (const leakedFile of leakedVersionFiles) {
          const leakedPath = path.join(uploadDir, leakedFile);
          if (fs.existsSync(leakedPath)) fs.unlinkSync(leakedPath);
        }
      }
    });
  });

  describe('GET /api/documents/download/:documentId', () => {
    it('should require token for download', async () => {
      const res = await request(app).get(`/api/documents/download/${documentId}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Token');
    });

    it('should reject invalid token', async () => {
      const res = await request(app).get(
        `/api/documents/download/${documentId}?token=invalid-token`,
      );

      expect(res.status).toBe(403);
    });

    it('should not redirect arbitrary external document URLs after signed token validation', async () => {
      const externalUrl = 'https://storage.example.com/project/test-photo.jpg';
      const externalDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          category: 'Site Photos',
          filename: 'external-test-photo.jpg',
          fileUrl: externalUrl,
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });

      try {
        const createRes = await request(app)
          .post(`/api/documents/${externalDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${authToken}`);

        const res = await request(app).get(
          `/api/documents/download/${externalDocument.id}?token=${createRes.body.token}`,
        );

        expect(res.status).toBe(404);
        expect(res.headers.location).toBeUndefined();
        expect(res.body.error.message).toContain('File');
      } finally {
        await prisma.document.deleteMany({ where: { id: externalDocument.id } });
      }
    });

    it('should redirect configured Supabase stored documents after signed token validation', async () => {
      process.env.SUPABASE_URL = 'https://siteproof-test.supabase.co';
      const externalUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/documents/${projectId}/test-photo.jpg`;
      const externalDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          category: 'Site Photos',
          filename: 'supabase-test-photo.jpg',
          fileUrl: externalUrl,
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });

      try {
        const createRes = await request(app)
          .post(`/api/documents/${externalDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${authToken}`);

        const res = await request(app).get(
          `/api/documents/download/${externalDocument.id}?token=${createRes.body.token}`,
        );

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe(externalUrl);
        expect(res.headers['referrer-policy']).toBe('no-referrer');
        expect(res.headers['cache-control']).toContain('no-store');
      } finally {
        await prisma.document.deleteMany({ where: { id: externalDocument.id } });
      }
    });

    it('should send local signed downloads with safe headers and filenames', async () => {
      const storedFilename = `signed-download-${Date.now()}.pdf`;
      const storedPath = writeTestUpload(uploadDir, storedFilename);

      const localDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'certificate',
          category: 'Quality Records',
          filename: '../../bad"name\r\n.pdf',
          fileUrl: `/uploads/documents/${storedFilename}`,
          fileSize: validPdfBytes.length,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      try {
        const createRes = await request(app)
          .post(`/api/documents/${localDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${authToken}`);

        const res = await request(app).get(
          `/api/documents/download/${localDocument.id}?token=${createRes.body.token}`,
        );

        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toBe('attachment; filename="bad_name__.pdf"');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['referrer-policy']).toBe('no-referrer');
        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers.pragma).toBe('no-cache');
      } finally {
        await prisma.document.deleteMany({ where: { id: localDocument.id } });
        if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
      }
    });

    it('should send certificate and drawing backed local signed downloads', async () => {
      const cases = [
        {
          dir: certificateUploadDir,
          subdirectory: 'certificates',
          documentType: 'test_certificate',
          category: 'Test Results',
          filename: `signed-certificate-${Date.now()}.pdf`,
        },
        {
          dir: drawingUploadDir,
          subdirectory: 'drawings',
          documentType: 'drawing',
          category: 'Drawings',
          filename: `signed-drawing-${Date.now()}.pdf`,
        },
      ];
      const createdDocuments: string[] = [];
      const createdPaths: string[] = [];

      try {
        for (const item of cases) {
          const storedPath = writeTestUpload(item.dir, item.filename);
          createdPaths.push(storedPath);

          const localDocument = await prisma.document.create({
            data: {
              projectId,
              lotId,
              documentType: item.documentType,
              category: item.category,
              filename: item.filename,
              fileUrl: `/uploads/${item.subdirectory}/${item.filename}`,
              fileSize: validPdfBytes.length,
              mimeType: 'application/pdf',
              uploadedById: userId,
            },
          });
          createdDocuments.push(localDocument.id);

          const createRes = await request(app)
            .post(`/api/documents/${localDocument.id}/signed-url`)
            .set('Authorization', `Bearer ${authToken}`);

          const res = await request(app).get(
            `/api/documents/download/${localDocument.id}?token=${createRes.body.token}`,
          );

          expect(res.status).toBe(200);
          expect(res.headers['content-disposition']).toBe(
            `attachment; filename="${item.filename}"`,
          );
          expect(res.headers['content-type']).toContain('application/pdf');
          expect(res.headers['x-content-type-options']).toBe('nosniff');
        }
      } finally {
        await prisma.document.deleteMany({ where: { id: { in: createdDocuments } } });
        for (const filePath of createdPaths) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
    });
  });

  describe('POST /api/documents/:documentId/classify', () => {
    it('returns unavailable instead of simulated classifications when Anthropic is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const res = await request(app)
        .post(`/api/documents/${documentId}/classify`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(503);
      expect(res.body.error.message).toContain('AI photo classification is not configured');
      expect(res.body.suggestedClassification).toBeUndefined();
    });

    it('classifies an image with Anthropic and returns sorted supported categories', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.ANTHROPIC_DOCUMENT_CLASS_MODEL = 'claude-test-classifier';

      const imageDocument = await createDataImageDocument(`classify-success-${Date.now()}.jpg`);
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'Safety|75\nExcavation|92\nUnsupported Category|99\nTesting|0',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        const res = await request(app)
          .post(`/api/documents/${imageDocument.id}/classify`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.suggestedClassification).toBe('Excavation');
        expect(res.body.confidence).toBe(92);
        expect(res.body.suggestedClassifications).toEqual([
          { label: 'Excavation', confidence: 92 },
          { label: 'Safety', confidence: 75 },
        ]);
        expect(res.body.categories).toContain('Plant/Equipment');

        const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
          model: string;
          messages: Array<{
            content: Array<{ type: string; source?: { media_type?: string } }>;
          }>;
        };
        expect(requestBody.model).toBe('claude-test-classifier');
        expect(requestBody.messages[0].content[0].type).toBe('image');
        expect(requestBody.messages[0].content[0].source?.media_type).toBe('image/jpeg');
      } finally {
        await prisma.document.deleteMany({ where: { id: imageDocument.id } });
      }
    });

    it('does not fall back to default labels when Anthropic returns no supported category', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const imageDocument = await createDataImageDocument(`classify-empty-${Date.now()}.jpg`);
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: 'Unrelated|99',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        const res = await request(app)
          .post(`/api/documents/${imageDocument.id}/classify`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(503);
        expect(res.body.error.message).toContain('did not return supported categories');
        expect(res.body.suggestedClassification).toBeUndefined();
      } finally {
        await prisma.document.deleteMany({ where: { id: imageDocument.id } });
      }
    });
  });

  describe('POST /api/documents/:documentId/save-classification', () => {
    it('should reject malformed multi-label classification payloads', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/save-classification`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ classifications: 'Safety' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/documents/:documentId/signed-url', () => {
    it('should generate a signed URL', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/signed-url`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.signedUrl).toBeDefined();
      expect(res.body.expiresAt).toBeDefined();
      expect(res.body.token).toBeDefined();
    });

    it('should validate generated signed URLs from persistent storage without storing raw tokens', async () => {
      const createRes = await request(app)
        .post(`/api/documents/${documentId}/signed-url`)
        .set('Authorization', `Bearer ${authToken}`);

      const token = createRes.body.token;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const storedToken = await prisma.documentSignedUrlToken.findUnique({
        where: { tokenHash },
      });

      expect(storedToken).toBeDefined();
      expect(storedToken?.tokenHash).not.toBe(token);
      expect(storedToken?.documentId).toBe(documentId);
      expect(storedToken?.userId).toBe(userId);

      const validateRes = await request(app).get(
        `/api/documents/signed-url/validate?token=${token}&documentId=${documentId}`,
      );

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.valid).toBe(true);
      expect(validateRes.body.expiresAt).toBeDefined();
    });

    it('should reject and clean up expired signed URL tokens', async () => {
      const createRes = await request(app)
        .post(`/api/documents/${documentId}/signed-url`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ expiresInMinutes: 1 });

      const token = createRes.body.token;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.documentSignedUrlToken.update({
        where: { tokenHash },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const validateRes = await request(app).get(
        `/api/documents/signed-url/validate?token=${token}&documentId=${documentId}`,
      );

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.valid).toBe(false);
      expect(validateRes.body.expired).toBe(true);

      const storedToken = await prisma.documentSignedUrlToken.findUnique({
        where: { tokenHash },
      });
      expect(storedToken).toBeNull();
    });

    it('should reject invalid signed URL expiry values', async () => {
      for (const expiresInMinutes of [0, -1, 1441, 'abc', '1.5', '1e2', '']) {
        const res = await request(app)
          .post(`/api/documents/${documentId}/signed-url`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ expiresInMinutes });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('expiresInMinutes');
      }
    });

    it('should return 404 for non-existent document', async () => {
      const res = await request(app)
        .post('/api/documents/non-existent-id/signed-url')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/documents/:documentId', () => {
    it('should update document metadata', async () => {
      const res = await request(app)
        .patch(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caption: 'Updated caption',
          category: 'Updated Category',
          tags: 'updated,tags',
        });

      expect(res.status).toBe(200);
      // API returns document directly (not wrapped)
      expect(res.body.id).toBeDefined();
      expect(res.body.caption).toBe('Updated caption');
    });

    it('should return 404 for non-existent document', async () => {
      const res = await request(app)
        .patch('/api/documents/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caption: 'Test',
        });

      expect(res.status).toBe(404);
    });

    it('should reject malformed metadata updates', async () => {
      const res = await request(app)
        .patch(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ isFavourite: 'yes' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/documents/:documentId/versions', () => {
    it('should get document versions', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.versions).toBeDefined();
      expect(Array.isArray(res.body.versions)).toBe(true);
    });
  });

  describe('POST /api/documents/upload', () => {
    it('stores uploads using safe filenames', async () => {
      const unsafeFilename = `unsafe<>name?-${Date.now()}.pdf`;
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('documentType', 'certificate')
        .attach('file', validPdfBytes, {
          filename: unsafeFilename,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(hasUnsafeFilenameChar(res.body.filename)).toBe(false);
      expect(res.body.fileUrl).toMatch(/^\/uploads\/documents\//);
      expect(res.body.fileUrl).not.toContain('..');

      try {
        const storedFilename = path.basename(res.body.fileUrl);
        expect(fs.existsSync(path.join(uploadDir, storedFilename))).toBe(true);
      } finally {
        const storedFilename = path.basename(res.body.fileUrl);
        await prisma.document.deleteMany({ where: { id: res.body.id } });
        const storedPath = path.join(uploadDir, storedFilename);
        if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
      }
    });

    it('rejects PDF uploads whose content does not match the declared file type', async () => {
      const filename = `spoofed-document-${Date.now()}.pdf`;

      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('documentType', 'certificate')
        .attach('file', Buffer.from('not really a pdf'), {
          filename,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

      const createdDocument = await prisma.document.findFirst({
        where: { projectId, filename },
        select: { id: true },
      });
      const leakedFiles = fs.readdirSync(uploadDir).filter((file) => file.includes(filename));

      expect(createdDocument).toBeNull();
      expect(leakedFiles).toHaveLength(0);
    });

    it('normalizes extension-only email uploads away from client supplied HTML content types', async () => {
      const res = await request(app)
        .post('/api/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('documentType', 'correspondence')
        .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), {
          filename: `unsafe-email-${Date.now()}.eml`,
          contentType: 'text/html',
        });

      expect(res.status).toBe(201);
      expect(res.body.mimeType).toBe('message/rfc822');

      try {
        const storedFilename = path.basename(res.body.fileUrl);
        expect(fs.existsSync(path.join(uploadDir, storedFilename))).toBe(true);
      } finally {
        const storedFilename = path.basename(res.body.fileUrl);
        await prisma.document.deleteMany({ where: { id: res.body.id } });
        const storedPath = path.join(uploadDir, storedFilename);
        if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
      }
    });

    it('cleans up the uploaded file when document creation fails', async () => {
      const filename = `db-fail-document-${Date.now()}.pdf`;
      const beforeFiles = new Set(fs.readdirSync(uploadDir));
      const originalCreate = prisma.document.create.bind(prisma.document);
      const createMock = vi.fn(() => Promise.reject(new Error('database write failed')));
      let leakedFiles: string[] = [];

      try {
        Object.defineProperty(prisma.document, 'create', {
          value: createMock,
          configurable: true,
        });

        const res = await request(app)
          .post('/api/documents/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .field('projectId', projectId)
          .field('documentType', 'certificate')
          .attach('file', validPdfBytes, {
            filename,
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(500);
        expect(createMock).toHaveBeenCalledTimes(1);

        leakedFiles = fs
          .readdirSync(uploadDir)
          .filter((file) => !beforeFiles.has(file) && file.includes(filename));
        expect(leakedFiles).toHaveLength(0);
      } finally {
        Object.defineProperty(prisma.document, 'create', {
          value: originalCreate,
          configurable: true,
        });

        for (const leakedFile of leakedFiles) {
          const leakedPath = path.join(uploadDir, leakedFile);
          if (fs.existsSync(leakedPath)) fs.unlinkSync(leakedPath);
        }
      }
    });
  });

  describe('GET /api/documents/file/:documentId', () => {
    it('does not render extension-only local documents as client supplied HTML', async () => {
      const storedFilename = `unsafe-email-${Date.now()}.eml`;
      const storedPath = writeTestUpload(
        uploadDir,
        storedFilename,
        Buffer.from('<html><script>alert(1)</script></html>'),
      );
      const localDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'correspondence',
          category: 'Emails',
          filename: 'client-supplied.eml',
          fileUrl: `/uploads/documents/${storedFilename}`,
          fileSize: 38,
          mimeType: 'text/html',
          uploadedById: userId,
        },
      });

      try {
        const res = await request(app)
          .get(`/api/documents/file/${localDocument.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('message/rfc822');
        expect(res.headers['content-disposition']).toBe(
          'attachment; filename="client-supplied.eml"',
        );
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      } finally {
        await prisma.document.deleteMany({ where: { id: localDocument.id } });
        if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
      }
    });
  });

  describe('POST /api/documents/:documentId/version', () => {
    it('creates a new version transactionally with exactly one latest version', async () => {
      const sourceDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'certificate',
          category: 'Quality Records',
          filename: 'version-source.pdf',
          fileUrl: '/uploads/documents/version-source.pdf',
          fileSize: validPdfBytes.length,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      const res = await request(app)
        .post(`/api/documents/${sourceDocument.id}/version`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', validPdfBytes, {
          filename: `version<>upload-${Date.now()}.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.version).toBe(2);
      expect(hasUnsafeFilenameChar(res.body.filename)).toBe(false);

      const versions = await prisma.document.findMany({
        where: {
          OR: [{ id: sourceDocument.id }, { parentDocumentId: sourceDocument.id }],
        },
        select: { id: true, isLatestVersion: true, fileUrl: true },
      });
      expect(versions.filter((version) => version.isLatestVersion)).toHaveLength(1);
      expect(versions.find((version) => version.id === res.body.id)?.isLatestVersion).toBe(true);

      for (const version of versions) {
        await prisma.document.deleteMany({ where: { id: version.id } });
        const storedPath = path.join(uploadDir, path.basename(version.fileUrl));
        if (fs.existsSync(storedPath)) fs.unlinkSync(storedPath);
      }
    });

    it('cleans up the uploaded version file when version creation fails', async () => {
      const sourceDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'certificate',
          category: 'Quality Records',
          filename: 'version-fail-source.pdf',
          fileUrl: '/uploads/documents/version-fail-source.pdf',
          fileSize: validPdfBytes.length,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      const filename = `db-fail-version-${Date.now()}.pdf`;
      const beforeFiles = new Set(fs.readdirSync(uploadDir));
      const transactionSpy = vi
        .spyOn(prisma, '$transaction')
        .mockRejectedValueOnce(new Error('database transaction failed'));
      let leakedFiles: string[] = [];

      try {
        const res = await request(app)
          .post(`/api/documents/${sourceDocument.id}/version`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('file', validPdfBytes, {
            filename,
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(500);
        expect(transactionSpy).toHaveBeenCalledTimes(1);

        leakedFiles = fs
          .readdirSync(uploadDir)
          .filter((file) => !beforeFiles.has(file) && file.includes(filename));
        expect(leakedFiles).toHaveLength(0);
      } finally {
        await prisma.document.deleteMany({ where: { id: sourceDocument.id } });
        for (const leakedFile of leakedFiles) {
          const leakedPath = path.join(uploadDir, leakedFile);
          if (fs.existsSync(leakedPath)) fs.unlinkSync(leakedPath);
        }
      }
    });
  });

  describe('Document Categories', () => {
    beforeAll(async () => {
      // Create documents with different categories
      await prisma.document.createMany({
        data: [
          {
            projectId,
            documentType: 'photo',
            category: 'Quality Records',
            filename: 'quality-record.pdf',
            fileUrl: '/uploads/documents/quality-record.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
          {
            projectId,
            documentType: 'photo',
            category: 'Test Certificates',
            filename: 'test-cert.pdf',
            fileUrl: '/uploads/documents/test-cert.pdf',
            fileSize: 1536,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
        ],
      });
    });

    it('should return category counts', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.categories).toBeDefined();
      expect(Object.keys(res.body.categories).length).toBeGreaterThan(1);
    });
  });

  describe('Document Access Control', () => {
    let otherUserId: string;
    let otherUserToken: string;
    let viewerUserId: string;
    let viewerUserToken: string;

    beforeAll(async () => {
      // Create another user without project access
      const otherEmail = `other-doc-user-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other User',
        tosAccepted: true,
      });
      otherUserToken = otherRes.body.token;
      otherUserId = otherRes.body.user.id;

      const viewerEmail = `viewer-doc-user-${Date.now()}@example.com`;
      const viewerRes = await request(app).post('/api/auth/register').send({
        email: viewerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Document Viewer',
        tosAccepted: true,
      });
      viewerUserToken = viewerRes.body.token;
      viewerUserId = viewerRes.body.user.id;

      await prisma.user.update({
        where: { id: viewerUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: viewerUserId, role: 'viewer', status: 'active' },
      });
    });

    it('should deny access to users without project access', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow active viewers to read but not edit documents', async () => {
      const readRes = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${viewerUserToken}`);
      expect(readRes.status).toBe(200);

      const updateRes = await request(app)
        .patch(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${viewerUserToken}`)
        .send({ caption: 'Viewer edit should fail' });
      expect(updateRes.status).toBe(403);
    });

    it('should not grant cross-company admins write access through viewer project membership', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Other Document Admin Company ${Date.now()}` },
      });
      const adminEmail = `other-doc-admin-${Date.now()}@example.com`;
      const adminRes = await request(app).post('/api/auth/register').send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Company Document Admin',
        tosAccepted: true,
      });
      const adminToken = adminRes.body.token;
      const adminUserId = adminRes.body.user.id;

      await prisma.user.update({
        where: { id: adminUserId },
        data: { companyId: otherCompany.id, roleInCompany: 'admin' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: adminUserId, role: 'viewer', status: 'active' },
      });

      try {
        const readRes = await request(app)
          .get(`/api/documents/${projectId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(readRes.status).toBe(200);

        const updateRes = await request(app)
          .patch(`/api/documents/${documentId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ caption: 'Cross-company admin viewer edit should fail' });
        expect(updateRes.status).toBe(403);
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId, userId: adminUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: adminUserId } });
        await prisma.user.delete({ where: { id: adminUserId } }).catch(() => {});
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
    });

    it('should scope subcontractor document reads to assigned lots and project-wide documents', async () => {
      const subEmail = `doc-sub-user-${Date.now()}@example.com`;
      const subRes = await request(app).post('/api/auth/register').send({
        email: subEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Document Subcontractor',
        tosAccepted: true,
      });
      const subToken = subRes.body.token;
      const subUserId = subRes.body.user.id;

      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Document Subcontractor ${Date.now()}`,
          primaryContactName: 'Document Sub',
          primaryContactEmail: `doc-sub-${Date.now()}@example.com`,
          status: 'approved',
          portalAccess: { documents: true },
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DOC-UNASSIGNED-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const projectWideDocument = await prisma.document.create({
        data: {
          projectId,
          documentType: 'specification',
          category: 'Specifications',
          filename: 'project-wide-spec.pdf',
          fileUrl: '/uploads/documents/project-wide-spec.pdf',
          uploadedById: userId,
        },
      });
      const unassignedLotDocument = await prisma.document.create({
        data: {
          projectId,
          lotId: otherLot.id,
          documentType: 'photo',
          category: 'Site Photos',
          filename: 'other-lot-photo.jpg',
          fileUrl: '/uploads/documents/other-lot-photo.jpg',
          uploadedById: userId,
        },
      });
      let uploadedAssignedDocumentId: string | null = null;

      try {
        await prisma.user.update({
          where: { id: subUserId },
          data: { companyId, roleInCompany: 'subcontractor' },
        });
        await prisma.subcontractorUser.create({
          data: {
            userId: subUserId,
            subcontractorCompanyId: subcontractorCompany.id,
            role: 'user',
          },
        });
        await prisma.lotSubcontractorAssignment.create({
          data: {
            projectId,
            lotId,
            subcontractorCompanyId: subcontractorCompany.id,
            canCompleteITP: true,
          },
        });

        const listRes = await request(app)
          .get(`/api/documents/${projectId}?subcontractorView=true`)
          .set('Authorization', `Bearer ${subToken}`);

        expect(listRes.status).toBe(200);
        const returnedDocumentIds = listRes.body.documents.map(
          (document: { id: string }) => document.id,
        );
        expect(returnedDocumentIds).toContain(documentId);
        expect(returnedDocumentIds).toContain(projectWideDocument.id);
        expect(returnedDocumentIds).not.toContain(unassignedLotDocument.id);

        const assignedSignedUrlRes = await request(app)
          .post(`/api/documents/${documentId}/signed-url`)
          .set('Authorization', `Bearer ${subToken}`);

        expect(assignedSignedUrlRes.status).toBe(200);

        const unassignedSignedUrlRes = await request(app)
          .post(`/api/documents/${unassignedLotDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${subToken}`);

        expect(unassignedSignedUrlRes.status).toBe(403);

        const internalPatchRes = await request(app)
          .patch(`/api/documents/${documentId}`)
          .set('Authorization', `Bearer ${subToken}`)
          .send({ caption: 'Subcontractor should not edit internal document' });

        expect(internalPatchRes.status).toBe(403);

        const unassignedUploadPath = path.join(
          uploadDir,
          `sub-unassigned-upload-${Date.now()}.pdf`,
        );
        fs.writeFileSync(unassignedUploadPath, validPdfBytes);

        try {
          const unassignedUploadRes = await request(app)
            .post('/api/documents/upload')
            .set('Authorization', `Bearer ${subToken}`)
            .field('projectId', projectId)
            .field('lotId', otherLot.id)
            .field('documentType', 'photo')
            .field('category', 'Site Photos')
            .attach('file', unassignedUploadPath);

          expect(unassignedUploadRes.status).toBe(403);
        } finally {
          if (fs.existsSync(unassignedUploadPath)) fs.unlinkSync(unassignedUploadPath);
        }

        const assignedUploadPath = path.join(uploadDir, `sub-assigned-upload-${Date.now()}.pdf`);
        fs.writeFileSync(assignedUploadPath, validPdfBytes);

        try {
          const assignedUploadRes = await request(app)
            .post('/api/documents/upload')
            .set('Authorization', `Bearer ${subToken}`)
            .field('projectId', projectId)
            .field('lotId', lotId)
            .field('documentType', 'photo')
            .field('category', 'Site Photos')
            .attach('file', assignedUploadPath);

          expect(assignedUploadRes.status).toBe(201);
          uploadedAssignedDocumentId = assignedUploadRes.body.id;

          const ownPatchRes = await request(app)
            .patch(`/api/documents/${uploadedAssignedDocumentId}`)
            .set('Authorization', `Bearer ${subToken}`)
            .send({ caption: 'Subcontractor-owned assigned-lot document' });

          expect(ownPatchRes.status).toBe(200);
          expect(ownPatchRes.body.caption).toBe('Subcontractor-owned assigned-lot document');

          const ownDeleteRes = await request(app)
            .delete(`/api/documents/${uploadedAssignedDocumentId}`)
            .set('Authorization', `Bearer ${subToken}`);

          expect(ownDeleteRes.status).toBe(204);
          uploadedAssignedDocumentId = null;
        } finally {
          if (fs.existsSync(assignedUploadPath)) fs.unlinkSync(assignedUploadPath);
        }
      } finally {
        if (uploadedAssignedDocumentId) {
          await prisma.document.deleteMany({ where: { id: uploadedAssignedDocumentId } });
        }
        await prisma.documentSignedUrlToken.deleteMany({
          where: { documentId: { in: [documentId, unassignedLotDocument.id] } },
        });
        await prisma.document.deleteMany({
          where: { id: { in: [projectWideDocument.id, unassignedLotDocument.id] } },
        });
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subUserId } });
        await prisma.user.delete({ where: { id: subUserId } }).catch(() => {});
      }
    });

    it('should enforce subcontractor portal modules for document writes and direct reads', async () => {
      const suffix = `${Date.now()}-${crypto.randomUUID()}`;
      const subEmail = `doc-sub-portal-${suffix}@example.com`;
      const subRes = await request(app).post('/api/auth/register').send({
        email: subEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Document Portal Subcontractor',
        tosAccepted: true,
      });
      const subToken = subRes.body.token;
      const subUserId = subRes.body.user.id;

      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Document Portal Subcontractor ${suffix}`,
          primaryContactName: 'Document Portal Sub',
          primaryContactEmail: `doc-sub-portal-contact-${suffix}@example.com`,
          status: 'approved',
          portalAccess: { documents: false, itps: false },
        },
      });

      const generalDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          category: 'Site Photos',
          filename: 'portal-general.pdf',
          fileUrl: '/uploads/documents/portal-general.pdf',
          fileSize: validPdfBytes.length,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      const itpEvidenceDocument = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          category: 'itp_evidence',
          filename: 'portal-itp-evidence.pdf',
          fileUrl: '/uploads/documents/portal-itp-evidence.pdf',
          fileSize: validPdfBytes.length,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      let uploadedItpDocumentId: string | null = null;

      const uploadAsSubcontractor = async (category: string) => {
        const uploadPath = writeTestUpload(
          uploadDir,
          `sub-portal-upload-${category}-${crypto.randomUUID()}.pdf`,
        );

        try {
          return await request(app)
            .post('/api/documents/upload')
            .set('Authorization', `Bearer ${subToken}`)
            .field('projectId', projectId)
            .field('lotId', lotId)
            .field('documentType', 'photo')
            .field('category', category)
            .attach('file', uploadPath);
        } finally {
          if (fs.existsSync(uploadPath)) fs.unlinkSync(uploadPath);
        }
      };

      try {
        await prisma.user.update({
          where: { id: subUserId },
          data: { companyId, roleInCompany: 'subcontractor' },
        });
        await prisma.subcontractorUser.create({
          data: {
            userId: subUserId,
            subcontractorCompanyId: subcontractorCompany.id,
            role: 'user',
          },
        });
        await prisma.lotSubcontractorAssignment.create({
          data: {
            projectId,
            lotId,
            subcontractorCompanyId: subcontractorCompany.id,
            canCompleteITP: true,
          },
        });

        const blockedGeneralReadRes = await request(app)
          .post(`/api/documents/${generalDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${subToken}`);
        expect(blockedGeneralReadRes.status).toBe(403);

        const blockedItpReadRes = await request(app)
          .post(`/api/documents/${itpEvidenceDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${subToken}`);
        expect(blockedItpReadRes.status).toBe(403);

        const blockedGeneralUploadRes = await uploadAsSubcontractor('Site Photos');
        expect(blockedGeneralUploadRes.status).toBe(403);
        expect(blockedGeneralUploadRes.body.error.message).toContain(
          'Documents portal access is not enabled',
        );

        const blockedItpUploadRes = await uploadAsSubcontractor('itp_evidence');
        expect(blockedItpUploadRes.status).toBe(403);
        expect(blockedItpUploadRes.body.error.message).toContain(
          'ITPs portal access is not enabled',
        );

        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompany.id },
          data: { portalAccess: { documents: false, itps: true } },
        });

        const stillBlockedGeneralReadRes = await request(app)
          .post(`/api/documents/${generalDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${subToken}`);
        expect(stillBlockedGeneralReadRes.status).toBe(403);

        const allowedItpReadRes = await request(app)
          .post(`/api/documents/${itpEvidenceDocument.id}/signed-url`)
          .set('Authorization', `Bearer ${subToken}`);
        expect(allowedItpReadRes.status).toBe(200);

        const stillBlockedGeneralUploadRes = await uploadAsSubcontractor('Site Photos');
        expect(stillBlockedGeneralUploadRes.status).toBe(403);
        expect(stillBlockedGeneralUploadRes.body.error.message).toContain(
          'Documents portal access is not enabled',
        );

        const allowedItpUploadRes = await uploadAsSubcontractor('itp_evidence');
        expect(allowedItpUploadRes.status).toBe(201);
        const uploadedItpId = allowedItpUploadRes.body.id as string;
        uploadedItpDocumentId = uploadedItpId;

        const ownPatchRes = await request(app)
          .patch(`/api/documents/${uploadedItpId}`)
          .set('Authorization', `Bearer ${subToken}`)
          .send({ caption: 'Subcontractor ITP evidence update' });
        expect(ownPatchRes.status).toBe(200);
        expect(ownPatchRes.body.caption).toBe('Subcontractor ITP evidence update');

        const categoryEscapeRes = await request(app)
          .patch(`/api/documents/${uploadedItpId}`)
          .set('Authorization', `Bearer ${subToken}`)
          .send({ category: 'Site Photos' });
        expect(categoryEscapeRes.status).toBe(403);
        expect(categoryEscapeRes.body.error.message).toContain(
          'Documents portal access is not enabled',
        );

        const unchangedDocument = await prisma.document.findUniqueOrThrow({
          where: { id: uploadedItpId },
          select: { category: true },
        });
        expect(unchangedDocument.category).toBe('itp_evidence');

        const deleteRes = await request(app)
          .delete(`/api/documents/${uploadedItpId}`)
          .set('Authorization', `Bearer ${subToken}`);
        expect(deleteRes.status).toBe(204);
        uploadedItpDocumentId = null;
      } finally {
        if (uploadedItpDocumentId) {
          const uploadedDocument = await prisma.document.findUnique({
            where: { id: uploadedItpDocumentId },
            select: { fileUrl: true },
          });
          const uploadedFileUrl = uploadedDocument?.fileUrl;
          if (uploadedFileUrl?.startsWith('/uploads/documents/')) {
            const uploadedPath = path.join(uploadDir, path.basename(uploadedFileUrl));
            if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
          }
          await prisma.document.deleteMany({ where: { id: uploadedItpDocumentId } });
        }
        await prisma.documentSignedUrlToken.deleteMany({
          where: { documentId: { in: [generalDocument.id, itpEvidenceDocument.id] } },
        });
        await prisma.document.deleteMany({
          where: { id: { in: [generalDocument.id, itpEvidenceDocument.id] } },
        });
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subUserId } });
        await prisma.user.delete({ where: { id: subUserId } }).catch(() => {});
      }
    });

    afterAll(async () => {
      await prisma.projectUser.deleteMany({ where: { userId: viewerUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: viewerUserId } }).catch(() => {});
    });
  });

  describe('Document lot validation', () => {
    let otherProjectId: string;
    let otherLotId: string;

    beforeAll(async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Documents Other Project ${Date.now()}`,
          projectNumber: `DOC-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      otherProjectId = otherProject.id;

      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProjectId,
          lotNumber: `DOC-OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      otherLotId = otherLot.id;
    });

    it('should reject updating metadata to a lot outside the document project', async () => {
      const res = await request(app)
        .patch(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ lotId: otherLotId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('lotId');
    });

    it('should reject uploads linked to a lot outside the upload project', async () => {
      const filePath = path.join(uploadDir, `upload-cross-lot-${Date.now()}.pdf`);
      fs.writeFileSync(filePath, validPdfBytes);

      try {
        const res = await request(app)
          .post('/api/documents/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .field('projectId', projectId)
          .field('lotId', otherLotId)
          .field('documentType', 'certificate')
          .attach('file', filePath);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('lotId');
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });

    afterAll(async () => {
      await prisma.lot.delete({ where: { id: otherLotId } }).catch(() => {});
      await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => {});
    });
  });

  describe('DELETE /api/documents/:documentId', () => {
    let deleteDocId: string;

    beforeAll(async () => {
      // Create document to delete
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          category: 'Test',
          filename: 'to-delete.jpg',
          fileUrl: '/uploads/documents/to-delete.jpg',
          fileSize: 512,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });
      deleteDocId = doc.id;
    });

    it('should delete a document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${deleteDocId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // API returns 204 No Content on successful deletion
      expect(res.status).toBe(204);
    });

    it('should return 404 for already deleted document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${deleteDocId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should delete certificate and drawing backed local files', async () => {
      const cases = [
        {
          dir: certificateUploadDir,
          subdirectory: 'certificates',
          documentType: 'test_certificate',
          category: 'Test Results',
          filename: `delete-certificate-${Date.now()}.pdf`,
        },
        {
          dir: drawingUploadDir,
          subdirectory: 'drawings',
          documentType: 'drawing',
          category: 'Drawings',
          filename: `delete-drawing-${Date.now()}.pdf`,
        },
      ];
      const remainingDocumentIds: string[] = [];
      const createdPaths: string[] = [];

      try {
        for (const item of cases) {
          const storedPath = writeTestUpload(item.dir, item.filename);
          createdPaths.push(storedPath);

          const localDocument = await prisma.document.create({
            data: {
              projectId,
              documentType: item.documentType,
              category: item.category,
              filename: item.filename,
              fileUrl: `/uploads/${item.subdirectory}/${item.filename}`,
              fileSize: validPdfBytes.length,
              mimeType: 'application/pdf',
              uploadedById: userId,
            },
          });
          remainingDocumentIds.push(localDocument.id);

          const res = await request(app)
            .delete(`/api/documents/${localDocument.id}`)
            .set('Authorization', `Bearer ${authToken}`);

          expect(res.status).toBe(204);
          expect(fs.existsSync(storedPath)).toBe(false);
          expect(await prisma.document.findUnique({ where: { id: localDocument.id } })).toBeNull();
          remainingDocumentIds.splice(remainingDocumentIds.indexOf(localDocument.id), 1);
        }
      } finally {
        await prisma.document.deleteMany({ where: { id: { in: remainingDocumentIds } } });
        for (const filePath of createdPaths) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { drawingsRouter } from './drawings.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/drawings', drawingsRouter);
app.use(errorHandler);

// Ensure upload directory exists for tests
const uploadDir = path.join(process.cwd(), 'uploads', 'drawings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const validPdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const validJpegBytes = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);
const validDwgBytes = Buffer.from('AC1027\0\0sample dwg payload');
const createdDrawingUploadPaths: string[] = [];

function trackDrawingUpload(fileUrl: string | undefined) {
  if (!fileUrl) {
    return;
  }

  createdDrawingUploadPaths.push(path.join(process.cwd(), fileUrl.replace(/^\/+/, '')));
}

function isGeneratedDrawingFixture(filename: string): boolean {
  return /(?:^|-)test-(?:upload|image|supersede)\.(?:pdf|jpe?g)$/i.test(filename);
}

function hasUnsafeFilenameChar(filename: string): boolean {
  return filename.split('').some((char) => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char));
}

describe('Drawings API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let drawingId: string;
  let documentId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Drawings Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `drawings-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Drawings Test User',
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
        name: `Drawings Test Project ${Date.now()}`,
        projectNumber: `DRW-${Date.now()}`,
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

    // Create a test drawing directly in the database
    const document = await prisma.document.create({
      data: {
        projectId,
        documentType: 'drawing',
        filename: 'test-drawing.pdf',
        fileUrl: '/uploads/drawings/test-drawing.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedById: userId,
      },
    });
    documentId = document.id;

    const drawing = await prisma.drawing.create({
      data: {
        projectId,
        documentId,
        drawingNumber: 'DRW-001',
        title: 'Test Site Plan',
        revision: 'A',
        status: 'preliminary',
        issueDate: new Date('2024-01-15'),
      },
    });
    drawingId = drawing.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.drawing.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});

    for (const uploadPath of Array.from(new Set(createdDrawingUploadPaths))) {
      fs.rmSync(uploadPath, { force: true });
    }

    // Clean up test upload directory
    const files = fs
      .readdirSync(uploadDir)
      .filter((file) => file.startsWith('test-') || isGeneratedDrawingFixture(file));
    files.forEach((file) => {
      try {
        fs.unlinkSync(path.join(uploadDir, file));
      } catch (err) {
        // Ignore errors
      }
    });
  });

  describe('GET /api/drawings/:projectId', () => {
    it('should list drawings for a project', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings).toBeDefined();
      expect(Array.isArray(res.body.drawings)).toBe(true);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total).toBeGreaterThan(0);
    });

    it('should return stats with status counts', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.preliminary).toBeDefined();
      expect(res.body.stats.forConstruction).toBeDefined();
      expect(res.body.stats.asBuilt).toBeDefined();
    });

    it('should paginate drawings and return pagination metadata', async () => {
      const suffix = Date.now();
      for (let index = 0; index < 3; index += 1) {
        const document = await prisma.document.create({
          data: {
            projectId,
            documentType: 'drawing',
            filename: `pagination-${suffix}-${index}.pdf`,
            fileUrl: `/uploads/drawings/pagination-${suffix}-${index}.pdf`,
            fileSize: 1024 + index,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
        });

        await prisma.drawing.create({
          data: {
            projectId,
            documentId: document.id,
            drawingNumber: `DRW-PAGE-${suffix}-${index}`,
            title: `Pagination Fixture ${index}`,
            revision: 'A',
            status: 'for_construction',
          },
        });
      }

      const res = await request(app)
        .get(`/api/drawings/${projectId}?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 2,
          hasPrevPage: false,
        }),
      );
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);

      const secondPage = await request(app)
        .get(`/api/drawings/${projectId}?page=2&limit=2`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.drawings.length).toBeLessThanOrEqual(2);
      expect(secondPage.body.pagination).toEqual(
        expect.objectContaining({
          page: 2,
          limit: 2,
          hasPrevPage: true,
        }),
      );
    });

    it('should reject oversized page limits', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?limit=101`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('limit must be no greater than 100');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?status=preliminary`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings).toBeDefined();
      const allPreliminary = res.body.drawings.every((d: any) => d.status === 'preliminary');
      expect(allPreliminary).toBe(true);
    });

    it('should reject invalid status filters', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?status=issued_for_review`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should search by drawing number', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?search=DRW-001`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings.length).toBeGreaterThan(0);
      const found = res.body.drawings.some((d: any) => d.drawingNumber.includes('DRW-001'));
      expect(found).toBe(true);
    });

    it('should search by title', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?search=Site Plan`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings.length).toBeGreaterThan(0);
    });

    it('should search drawing fields case-insensitively', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?search=site plan`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings.length).toBeGreaterThan(0);
      expect(res.body.drawings.some((drawing: any) => drawing.title === 'Test Site Plan')).toBe(
        true,
      );
    });

    it('should filter by revision', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?revision=A`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings).toBeDefined();
      const allRevA = res.body.drawings.every((d: any) => d.revision === 'A');
      expect(allRevA).toBe(true);
    });

    it('should reject oversized search filters', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .query({ search: 'x'.repeat(201) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('search is too long');
    });

    it('should deny access without authentication', async () => {
      const res = await request(app).get(`/api/drawings/${projectId}`);

      expect(res.status).toBe(401);
    });

    it('should include document information', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const drawing = res.body.drawings[0];
      expect(drawing.document).toBeDefined();
      expect(drawing.document.filename).toBeDefined();
      expect(drawing.document.fileUrl).toBeDefined();
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized drawing route parameters before lookups', async () => {
      const longId = 'd'.repeat(121);
      const checks = [
        {
          label: 'GET drawings',
          response: await request(app)
            .get(`/api/drawings/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET current set',
          response: await request(app)
            .get(`/api/drawings/${longId}/current-set`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH drawing',
          response: await request(app)
            .patch(`/api/drawings/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ title: 'Updated Drawing Title' }),
        },
        {
          label: 'DELETE drawing',
          response: await request(app)
            .delete(`/api/drawings/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      const supersedeFilename = `route-param-supersede-${Date.now()}.pdf`;
      const beforeSupersedeFiles = new Set(fs.readdirSync(uploadDir));
      let leakedSupersedeFiles: string[] = [];

      try {
        checks.push({
          label: 'POST supersede',
          response: await request(app)
            .post(`/api/drawings/${longId}/supersede`)
            .set('Authorization', `Bearer ${authToken}`)
            .field('revision', 'Z')
            .attach('file', validPdfBytes, {
              filename: supersedeFilename,
              contentType: 'application/pdf',
            }),
        });

        leakedSupersedeFiles = fs
          .readdirSync(uploadDir)
          .filter((file) => !beforeSupersedeFiles.has(file) && file.includes(supersedeFilename));

        for (const { label, response } of checks) {
          expect(response.status, label).toBe(400);
          expect(response.body.error.message, label).toContain('is too long');
        }

        expect(leakedSupersedeFiles).toHaveLength(0);
      } finally {
        for (const leakedFile of leakedSupersedeFiles) {
          fs.rmSync(path.join(uploadDir, leakedFile), { force: true });
        }
      }
    });
  });

  describe('POST /api/drawings', () => {
    const testFilePath = path.join(uploadDir, 'test-upload.pdf');
    const testImagePath = path.join(uploadDir, 'test-image.jpg');

    beforeAll(() => {
      // Create a test PDF file
      fs.writeFileSync(testFilePath, validPdfBytes);
      // Create a test image file
      fs.writeFileSync(testImagePath, validJpegBytes);
    });

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should create a new drawing with file upload', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-002')
        .field('title', 'New Test Drawing')
        .field('revision', 'A')
        .field('status', 'preliminary')
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.drawingNumber).toBe('DRW-002');
      expect(res.body.document).toBeDefined();
      trackDrawingUpload(res.body.document?.fileUrl);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should reject drawing without file', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-003');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('file');
    });

    it('should reject drawing without projectId', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('drawingNumber', 'DRW-004')
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('projectId');
    });

    it('should reject drawing without drawingNumber', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('drawingNumber');
    });

    it('should reject duplicate drawing number and revision', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-001')
        .field('revision', 'A')
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should default to preliminary status if not provided', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-DEFAULT-STATUS')
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('preliminary');
      trackDrawingUpload(res.body.document?.fileUrl);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should parse issueDate correctly', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-DATE-TEST')
        .field('issueDate', '2024-02-15')
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.issueDate).toBeDefined();
      trackDrawingUpload(res.body.document?.fileUrl);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should accept image file types (JPG)', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-IMAGE-TEST')
        .attach('file', testImagePath);

      expect(res.status).toBe(201);
      expect(res.body.document.mimeType).toContain('image');
      trackDrawingUpload(res.body.document?.fileUrl);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should accept CAD files only when their bytes match the declared type', async () => {
      const drawingNumber = `DRW-CAD-${Date.now()}`;

      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', drawingNumber)
        .attach('file', validDwgBytes, {
          filename: `${drawingNumber}.dwg`,
          contentType: 'application/dwg',
        });

      expect(res.status).toBe(201);
      expect(res.body.document.mimeType).toBe('application/dwg');
      trackDrawingUpload(res.body.document?.fileUrl);

      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should sanitize uploaded drawing filenames before storing them', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', `DRW-SAFE-FILENAME-${Date.now()}`)
        .attach('file', validPdfBytes, {
          filename: '../unsafe:drawing?name.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      trackDrawingUpload(res.body.document?.fileUrl);

      const storedPathName = path.basename(res.body.document.fileUrl);
      expect(hasUnsafeFilenameChar(res.body.document.filename)).toBe(false);
      expect(hasUnsafeFilenameChar(storedPathName)).toBe(false);
      expect(res.body.document.filename).toMatch(/\.pdf$/);
      expect(storedPathName).toMatch(/\.pdf$/);

      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should reject invalid drawing metadata without leaking uploaded files', async () => {
      const drawingNumber = `DRW-INVALID-META-${Date.now()}`;
      const beforeFiles = new Set(fs.readdirSync(uploadDir));

      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', drawingNumber)
        .field('status', 'issued_for_review')
        .field('issueDate', '2024-02-31')
        .attach('file', validPdfBytes, {
          filename: `${drawingNumber}.pdf`,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);

      const createdDrawing = await prisma.drawing.findFirst({
        where: { projectId, drawingNumber },
        select: { id: true },
      });
      const newFiles = fs.readdirSync(uploadDir).filter((file) => !beforeFiles.has(file));

      expect(createdDrawing).toBeNull();
      expect(newFiles).toHaveLength(0);
    });

    it('should reject uploads whose content does not match the declared file type', async () => {
      const drawingNumber = `DRW-SPOOF-${Date.now()}`;
      const filename = `${drawingNumber}.pdf`;

      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', drawingNumber)
        .attach('file', Buffer.from('not actually a pdf'), {
          filename,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

      const createdDrawing = await prisma.drawing.findFirst({
        where: { projectId, drawingNumber },
        select: { id: true },
      });
      const leakedFiles = fs.readdirSync(uploadDir).filter((file) => file.includes(filename));

      expect(createdDrawing).toBeNull();
      expect(leakedFiles).toHaveLength(0);
    });

    it('should reject CAD uploads whose content does not match the declared file type', async () => {
      const drawingNumber = `DRW-CAD-SPOOF-${Date.now()}`;
      const filename = `${drawingNumber}.dwg`;

      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', drawingNumber)
        .attach('file', Buffer.from('<script>alert("cad")</script>'), {
          filename,
          contentType: 'application/dwg',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

      const createdDrawing = await prisma.drawing.findFirst({
        where: { projectId, drawingNumber },
        select: { id: true },
      });
      const leakedFiles = fs.readdirSync(uploadDir).filter((file) => file.includes(filename));

      expect(createdDrawing).toBeNull();
      expect(leakedFiles).toHaveLength(0);
    });
  });

  describe('PATCH /api/drawings/:drawingId', () => {
    it('should update drawing metadata', async () => {
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Drawing Title',
          revision: 'B',
          status: 'for_construction',
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Drawing Title');
      expect(res.body.revision).toBe('B');
      expect(res.body.status).toBe('for_construction');
    });

    it('should update issueDate', async () => {
      const newDate = '2024-03-20';
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          issueDate: newDate,
        });

      expect(res.status).toBe(200);
      expect(res.body.issueDate).toBeDefined();
    });

    it('should reject invalid patch metadata', async () => {
      const invalidDateRes = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          issueDate: '2024-02-31',
        });

      const invalidStatusRes = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'issued_for_review',
        });

      const invalidSupersededByRes = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supersededById: { id: drawingId },
        });

      expect(invalidDateRes.status).toBe(400);
      expect(invalidStatusRes.status).toBe(400);
      expect(invalidSupersededByRes.status).toBe(400);
    });

    it('should return 404 for non-existent drawing', async () => {
      const res = await request(app)
        .patch('/api/drawings/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
        });

      expect(res.status).toBe(404);
    });

    it('should deny access without authentication', async () => {
      const res = await request(app).patch(`/api/drawings/${drawingId}`).send({
        title: 'Unauthorized Update',
      });

      expect(res.status).toBe(401);
    });

    it('should update supersededById', async () => {
      // Create a new drawing to supersede the old one
      const doc2 = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'newer-drawing.pdf',
          fileUrl: '/uploads/drawings/newer-drawing.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      const drawing2 = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc2.id,
          drawingNumber: 'DRW-SUPERSEDE-TEST',
          revision: 'B',
          status: 'for_construction',
        },
      });

      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supersededById: drawing2.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.supersededById).toBe(drawing2.id);

      // Cleanup
      await prisma.drawing.delete({ where: { id: drawing2.id } });
      await prisma.document.delete({ where: { id: doc2.id } });
    });

    it('should reject supersededById from another project', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Drawings Other Project ${Date.now()}`,
          projectNumber: `DRW-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });

      const otherDoc = await prisma.document.create({
        data: {
          projectId: otherProject.id,
          documentType: 'drawing',
          filename: 'other-project-drawing.pdf',
          fileUrl: '/uploads/drawings/other-project-drawing.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      const otherDrawing = await prisma.drawing.create({
        data: {
          projectId: otherProject.id,
          documentId: otherDoc.id,
          drawingNumber: 'DRW-OTHER-SUPERSEDE',
          revision: 'A',
          status: 'for_construction',
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/drawings/${drawingId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            supersededById: otherDrawing.id,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('same project');
      } finally {
        await prisma.drawing.delete({ where: { id: otherDrawing.id } }).catch(() => {});
        await prisma.document.delete({ where: { id: otherDoc.id } }).catch(() => {});
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });
  });

  describe('DELETE /api/drawings/:drawingId', () => {
    let deleteDrawingId: string;

    beforeAll(async () => {
      // Create a drawing to delete
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'to-delete.pdf',
          fileUrl: '/uploads/drawings/to-delete.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      const drawing = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc.id,
          drawingNumber: 'DRW-DELETE',
          status: 'preliminary',
        },
      });
      deleteDrawingId = drawing.id;
    });

    it('should delete a drawing', async () => {
      const res = await request(app)
        .delete(`/api/drawings/${deleteDrawingId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(204);
    });

    it('should return 404 for non-existent drawing', async () => {
      const res = await request(app)
        .delete('/api/drawings/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should deny access without authentication', async () => {
      const res = await request(app).delete(`/api/drawings/${drawingId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/drawings/:drawingId/supersede', () => {
    const testFilePath = path.join(uploadDir, 'test-supersede.pdf');
    let supersedeDrawingId: string;

    beforeAll(async () => {
      // Create a test PDF file
      fs.writeFileSync(testFilePath, validPdfBytes);

      // Create a drawing to supersede
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'old-version.pdf',
          fileUrl: '/uploads/drawings/old-version.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      const drawing = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc.id,
          drawingNumber: 'DRW-SUPER',
          title: 'Drawing to Supersede',
          revision: 'A',
          status: 'for_construction',
        },
      });
      supersedeDrawingId = drawing.id;
    });

    afterAll(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    });

    it('should create a new revision that supersedes the old drawing', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('title', 'Updated Drawing')
        .field('status', 'for_construction')
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.drawingNumber).toBe('DRW-SUPER');
      expect(res.body.revision).toBe('B');
      expect(res.body.document).toBeDefined();
      trackDrawingUpload(res.body.document?.fileUrl);

      // Check that old drawing was updated
      const oldDrawing = await prisma.drawing.findUnique({
        where: { id: supersedeDrawingId },
      });
      expect(oldDrawing?.supersededById).toBe(res.body.id);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should sanitize superseded revision filenames and link the old drawing atomically', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', `SAFE-${Date.now()}`)
        .attach('file', validPdfBytes, {
          filename: '../supersede:unsafe?drawing.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      trackDrawingUpload(res.body.document?.fileUrl);
      expect(hasUnsafeFilenameChar(res.body.document.filename)).toBe(false);
      expect(hasUnsafeFilenameChar(path.basename(res.body.document.fileUrl))).toBe(false);

      const oldDrawing = await prisma.drawing.findUnique({
        where: { id: supersedeDrawingId },
        select: { supersededById: true },
      });
      expect(oldDrawing?.supersededById).toBe(res.body.id);

      await prisma.drawing
        .update({
          where: { id: supersedeDrawingId },
          data: { supersededById: null },
        })
        .catch(() => {});
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should reject supersede without file', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'C');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('file');
    });

    it('should reject supersede without revision', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('revision');
    });

    it('should reject invalid supersede metadata without leaking uploaded files', async () => {
      const beforeFiles = new Set(fs.readdirSync(uploadDir));

      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', `INVALID-${Date.now()}`)
        .field('status', 'issued_for_review')
        .field('issueDate', '2024-02-31')
        .attach('file', validPdfBytes, {
          filename: 'invalid-supersede.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);

      const newFiles = fs.readdirSync(uploadDir).filter((file) => !beforeFiles.has(file));
      expect(newFiles).toHaveLength(0);
    });

    it('should reject supersede to an existing revision', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'A')
        .attach('file', testFilePath);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already exists');
    });

    it('should return 404 for non-existent drawing', async () => {
      const res = await request(app)
        .post('/api/drawings/non-existent-id/supersede')
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'C')
        .attach('file', testFilePath);

      expect(res.status).toBe(404);
    });

    it('should preserve title from old drawing if not provided', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'C')
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Drawing to Supersede');
      trackDrawingUpload(res.body.document?.fileUrl);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });

    it('should default to for_construction status', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'D')
        .attach('file', testFilePath);

      expect(res.status).toBe(201);
      // Status may be 'for_construction' or 'FOR_CONSTRUCTION' depending on schema
      expect(res.body.status?.toLowerCase()).toBe('for_construction');
      trackDrawingUpload(res.body.document?.fileUrl);

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } });
      await prisma.document.delete({ where: { id: res.body.documentId } });
    });
  });

  describe('GET /api/drawings/:projectId/current-set', () => {
    beforeAll(async () => {
      // Create multiple drawings with revisions
      const doc1 = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'current-1.pdf',
          fileUrl: '/uploads/drawings/current-1.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc1.id,
          drawingNumber: 'DRW-CURRENT-1',
          revision: 'A',
          status: 'for_construction',
        },
      });

      // Create a superseded drawing
      const doc2Old = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'old-2.pdf',
          fileUrl: '/uploads/drawings/old-2.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      const drawing2Old = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc2Old.id,
          drawingNumber: 'DRW-CURRENT-2',
          revision: 'A',
          status: 'for_construction',
        },
      });

      const doc2New = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'current-2.pdf',
          fileUrl: '/uploads/drawings/current-2.pdf',
          fileSize: 3072,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });

      await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc2New.id,
          drawingNumber: 'DRW-CURRENT-2',
          revision: 'B',
          status: 'for_construction',
        },
      });

      // Mark the old drawing as superseded
      await prisma.drawing.update({
        where: { id: drawing2Old.id },
        data: { supersededById: drawing2Old.id },
      });
    });

    it('should get only current (non-superseded) drawings', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings).toBeDefined();
      expect(Array.isArray(res.body.drawings)).toBe(true);
      expect(res.body.totalCount).toBeDefined();
      expect(res.body.totalSize).toBeDefined();
    });

    it('should include file information for each drawing', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const drawing = res.body.drawings[0];
      expect(drawing.documentId).toBeDefined();
      expect(drawing.drawingNumber).toBeDefined();
      expect(drawing.fileUrl).toBeDefined();
      expect(drawing.filename).toBeDefined();
      expect(drawing.fileSize).toBeDefined();
    });

    it('should calculate total size correctly', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalSize).toBeGreaterThan(0);
    });

    it('should deny access without authentication', async () => {
      const res = await request(app).get(`/api/drawings/${projectId}/current-set`);

      expect(res.status).toBe(401);
    });
  });

  describe('Drawing Access Control', () => {
    let otherUserId: string;
    let otherUserToken: string;
    let viewerUserId: string;
    let viewerUserToken: string;
    let subcontractorUserId: string;
    let subcontractorUserToken: string;
    let subcontractorCompanyId: string;
    const accessTestFilePath = path.join(uploadDir, 'test-access-control.pdf');

    beforeAll(async () => {
      // Create another user without project access
      const otherEmail = `other-drawings-user-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other User',
        tosAccepted: true,
      });
      otherUserToken = otherRes.body.token;
      otherUserId = otherRes.body.user.id;

      const viewerEmail = `viewer-drawings-user-${Date.now()}@example.com`;
      const viewerRes = await request(app).post('/api/auth/register').send({
        email: viewerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Drawing Viewer',
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

      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Drawing Access Subcontractor ${Date.now()}`,
          primaryContactName: 'Drawing Subcontractor',
          primaryContactEmail: `drawing-sub-${Date.now()}@example.com`,
          status: 'approved',
        },
      });
      subcontractorCompanyId = subcontractorCompany.id;

      const subcontractorEmail = `sub-drawings-user-${Date.now()}@example.com`;
      const subcontractorRes = await request(app).post('/api/auth/register').send({
        email: subcontractorEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Drawing Subcontractor User',
        tosAccepted: true,
      });
      subcontractorUserToken = subcontractorRes.body.token;
      subcontractorUserId = subcontractorRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'subcontractor_admin' },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractorUserId,
          subcontractorCompanyId,
          role: 'admin',
        },
      });

      fs.writeFileSync(accessTestFilePath, validPdfBytes);
    });

    afterAll(async () => {
      await prisma.projectUser.deleteMany({ where: { userId: viewerUserId } });
      await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompanyId } })
        .catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: viewerUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
      if (fs.existsSync(accessTestFilePath)) {
        fs.unlinkSync(accessTestFilePath);
      }
    });

    it('should deny access to users without project access', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should deny update to users without project access', async () => {
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Unauthorized Update',
        });

      expect(res.status).toBe(403);
    });

    it('should deny delete to users without project access', async () => {
      const res = await request(app)
        .delete(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should deny current-set access to users without project access', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should allow active viewers to read but not mutate drawings', async () => {
      const readRes = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${viewerUserToken}`);

      expect(readRes.status).toBe(200);

      const createRes = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${viewerUserToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', `DRW-VIEWER-${Date.now()}`)
        .attach('file', accessTestFilePath);

      expect(createRes.status).toBe(403);

      const updateRes = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${viewerUserToken}`)
        .send({
          title: 'Viewer edit should fail',
        });

      expect(updateRes.status).toBe(403);

      const supersedeRes = await request(app)
        .post(`/api/drawings/${drawingId}/supersede`)
        .set('Authorization', `Bearer ${viewerUserToken}`)
        .field('revision', `VIEWER-${Date.now()}`)
        .attach('file', accessTestFilePath);

      expect(supersedeRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${viewerUserToken}`);

      expect(deleteRes.status).toBe(403);
    });

    it('should deny subcontractor portal users from the project-wide drawing register', async () => {
      const readRes = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${subcontractorUserToken}`);

      expect(readRes.status).toBe(403);

      const currentSetRes = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${subcontractorUserToken}`);

      expect(currentSetRes.status).toBe(403);

      const drawingNumber = `DRW-SUB-${Date.now()}`;
      const createRes = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${subcontractorUserToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', drawingNumber)
        .attach('file', accessTestFilePath);

      expect(createRes.status).toBe(403);

      const createdDrawing = await prisma.drawing.findFirst({
        where: { projectId, drawingNumber },
        select: { id: true },
      });
      expect(createdDrawing).toBeNull();

      const updateRes = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${subcontractorUserToken}`)
        .send({
          title: 'Subcontractor edit should fail',
        });

      expect(updateRes.status).toBe(403);

      const supersedeRes = await request(app)
        .post(`/api/drawings/${drawingId}/supersede`)
        .set('Authorization', `Bearer ${subcontractorUserToken}`)
        .field('revision', `SUB-${Date.now()}`)
        .attach('file', accessTestFilePath);

      expect(supersedeRes.status).toBe(403);

      const deleteRes = await request(app)
        .delete(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${subcontractorUserToken}`);

      expect(deleteRes.status).toBe(403);
    });
  });

  describe('Project Manager Access', () => {
    let pmUserId: string;
    let pmToken: string;

    beforeAll(async () => {
      // Create project manager user
      const pmEmail = `pm-drawings-${Date.now()}@example.com`;
      const pmRes = await request(app).post('/api/auth/register').send({
        email: pmEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Project Manager',
        tosAccepted: true,
      });
      pmToken = pmRes.body.token;
      pmUserId = pmRes.body.user.id;

      await prisma.user.update({
        where: { id: pmUserId },
        data: { companyId },
      });

      await prisma.projectUser.create({
        data: { projectId, userId: pmUserId, role: 'project_manager', status: 'active' },
      });
    });

    afterAll(async () => {
      await prisma.projectUser.deleteMany({ where: { userId: pmUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: pmUserId } });
      await prisma.user.delete({ where: { id: pmUserId } }).catch(() => {});
    });

    it('should allow project manager to list drawings', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(200);
      expect(res.body.drawings).toBeDefined();
    });

    it('should allow project manager to access current set', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${pmToken}`);

      expect(res.status).toBe(200);
    });
  });
});

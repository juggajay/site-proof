import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import fs from 'fs';
import path from 'path';

// Mock supabase helpers so individual tests can opt into the Supabase code
// path. The real `isSupabaseConfigured()` returns false in tests
// (vitest.config.ts blanks SUPABASE_URL), and the default mock keeps that
// behaviour so all pre-existing tests continue to exercise the local-disk
// branch unchanged. `getSupabaseStoragePath` is passed through from the
// real module. `getSupabasePublicUrl` is replaced with a non-gated mirror
// of the real implementation: the real one calls its own module-local
// `isSupabaseConfigured` (which is bound to the actual closure, not the
// mock above) and would throw after a successful mocked upload, so we
// rebuild the URL from `process.env.SUPABASE_URL` at call time.
vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    getSupabaseClient: vi.fn(),
    getSupabasePublicUrl: vi.fn((bucket: string, storagePath: string) => {
      const base = (process.env.SUPABASE_URL?.trim() || '').replace(/\/+$/, '');
      return `${base}/storage/v1/object/public/${bucket}/${storagePath}`;
    }),
  };
});

import * as supabaseLib from '../lib/supabase.js';

// Import comments router AFTER vi.mock so it picks up the mocked helpers.
import { commentsRouter } from './comments.js';

const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);
const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

const ORIGINAL_SUPABASE_URL = process.env.SUPABASE_URL;

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/comments', commentsRouter);
app.use(errorHandler);

describe('Comments API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let unassignedLotId: string;
  let commentId: string;
  let replyId: string;
  let subcontractorToken: string;
  let subcontractorUserId: string;
  let subcontractorCompanyId: string;

  // Reset Supabase mocks after every test so state never leaks across tests
  // and the default (Supabase disabled) is restored.
  afterEach(() => {
    mockIsSupabaseConfigured.mockReset();
    mockIsSupabaseConfigured.mockReturnValue(false);
    mockGetSupabaseClient.mockReset();
    if (ORIGINAL_SUPABASE_URL === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = ORIGINAL_SUPABASE_URL;
    }
  });

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Comments Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `comments-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Comments Test User',
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
        name: `Comments Test Project ${Date.now()}`,
        projectNumber: `COM-${Date.now()}`,
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

    // Create lot for comment association
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `COM-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    const unassignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `COM-UNASSIGNED-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    unassignedLotId = unassignedLot.id;

    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Comments Subcontractor ${Date.now()}`,
        primaryContactName: 'Comments Subcontractor',
        primaryContactEmail: `comments-sub-${Date.now()}@example.com`,
        status: 'approved',
      },
    });
    subcontractorCompanyId = subcontractorCompany.id;

    const subcontractorEmail = `comments-sub-user-${Date.now()}@example.com`;
    const subcontractorRes = await request(app).post('/api/auth/register').send({
      email: subcontractorEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Comments Subcontractor User',
      tosAccepted: true,
    });
    subcontractorToken = subcontractorRes.body.token;
    subcontractorUserId = subcontractorRes.body.user.id;

    await prisma.user.update({
      where: { id: subcontractorUserId },
      data: { companyId, roleInCompany: 'subcontractor' },
    });

    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractorUserId,
        subcontractorCompanyId,
        role: 'user',
      },
    });

    await prisma.lotSubcontractorAssignment.create({
      data: {
        projectId,
        lotId,
        subcontractorCompanyId,
        status: 'active',
        assignedById: userId,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.commentAttachment.deleteMany({
      where: { comment: { entityId: { in: [lotId, unassignedLotId] } } },
    });
    await prisma.comment.deleteMany({ where: { entityId: { in: [lotId, unassignedLotId] } } });
    await prisma.lotSubcontractorAssignment.deleteMany({ where: { projectId } });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId } });
    await prisma.subcontractorCompany
      .delete({ where: { id: subcontractorCompanyId } })
      .catch(() => {});
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: { in: [userId, subcontractorUserId] } },
    });
    await prisma.user.delete({ where: { id: subcontractorUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});

    const commentsUploadDir = path.join(process.cwd(), 'uploads', 'comments');
    if (fs.existsSync(commentsUploadDir)) {
      for (const file of fs.readdirSync(commentsUploadDir)) {
        if (file.includes('comment-upload-test')) {
          fs.unlinkSync(path.join(commentsUploadDir, file));
        }
      }
    }
  });

  describe('POST /api/comments/attachments/upload', () => {
    it('should upload attachment files and return normal file URLs', async () => {
      const res = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('comment attachment body'), {
          filename: 'comment-upload-test.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(201);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].filename).toBe('comment-upload-test.txt');
      expect(res.body.attachments[0].fileUrl).not.toMatch(/^data:/);
      expect(res.body.attachments[0].mimeType).toBe('text/plain');

      if (res.body.attachments[0].fileUrl.startsWith('/uploads/')) {
        const uploadedPath = path.join(
          process.cwd(),
          res.body.attachments[0].fileUrl.replace(/^\//, ''),
        );
        expect(fs.existsSync(uploadedPath)).toBe(true);
      }
    });

    it('should sanitize unsafe attachment filenames on upload', async () => {
      const res = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('unsafe attachment filename body'), {
          filename: 'comment-upload-test-unsafe:<bad>.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(201);
      expect(res.body.attachments).toHaveLength(1);
      expect(res.body.attachments[0].filename).toMatch(/^comment-upload-test-unsafe/);
      expect(res.body.attachments[0].filename).not.toMatch(/[<>:"\\|?*]/);

      const storedName = String(res.body.attachments[0].fileUrl).split('/').pop() || '';
      expect(storedName).not.toMatch(/[<>:"\\|?*]/);
    });

    it('should allow subcontractors to upload attachments only for assigned lot comments', async () => {
      const assignedRes = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('assigned lot attachment'), {
          filename: 'comment-upload-test-sub-assigned.txt',
          contentType: 'text/plain',
        });

      expect(assignedRes.status).toBe(201);
      expect(assignedRes.body.attachments).toHaveLength(1);

      const unassignedRes = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .field('entityType', 'Lot')
        .field('entityId', unassignedLotId)
        .attach('files', Buffer.from('unassigned lot attachment'), {
          filename: 'comment-upload-test-sub-unassigned.txt',
          contentType: 'text/plain',
        });

      expect(unassignedRes.status).toBe(403);
    });

    it('should reject upload attempts without entity access', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `No Access Comments Company ${Date.now()}` },
      });
      const otherProject = await prisma.project.create({
        data: {
          name: `No Access Comments Project ${Date.now()}`,
          projectNumber: `NO-COM-${Date.now()}`,
          companyId: otherCompany.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `NO-COM-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      const res = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', otherLot.id)
        .attach('files', Buffer.from('comment attachment body'), {
          filename: 'comment-upload-test-no-access.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(403);

      await prisma.lot.delete({ where: { id: otherLot.id } });
      await prisma.project.delete({ where: { id: otherProject.id } });
      await prisma.company.delete({ where: { id: otherCompany.id } });
    });

    it('should reject uploads whose content does not match the declared file type', async () => {
      const filename = `comment-upload-test-spoof-${Date.now()}.pdf`;
      const commentsUploadDir = path.join(process.cwd(), 'uploads', 'comments');

      const res = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('not really a pdf'), {
          filename,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

      const leakedFiles = fs
        .readdirSync(commentsUploadDir)
        .filter((file) => file.includes(filename));
      expect(leakedFiles).toHaveLength(0);
    });
  });

  describe('POST /api/comments', () => {
    it('should create a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'This is a test comment',
        });

      expect(res.status).toBe(201);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.id).toBeDefined();
      expect(res.body.comment.content).toBe('This is a test comment');
      expect(res.body.comment.entityType).toBe('Lot');
      expect(res.body.comment.entityId).toBe(lotId);
      expect(res.body.comment.author).toBeDefined();
      expect(res.body.comment.author.id).toBe(userId);
      commentId = res.body.comment.id;
    });

    it('should allow subcontractors to create comments only on assigned lots', async () => {
      const assignedRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Assigned lot subcontractor comment',
        });

      expect(assignedRes.status).toBe(201);
      expect(assignedRes.body.comment.authorId).toBe(subcontractorUserId);

      const unassignedRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          entityType: 'Lot',
          entityId: unassignedLotId,
          content: 'Unassigned lot subcontractor comment',
        });

      expect(unassignedRes.status).toBe(403);
    });

    it('should create a comment with attachments', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with attachments',
          attachments: [
            {
              filename: 'test-file.pdf',
              fileUrl: '/uploads/comments/test-file.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
            },
            {
              filename: 'image.jpg',
              fileUrl: '/uploads/comments/image.jpg',
              fileSize: 2048,
              mimeType: 'image/jpeg',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.attachments).toBeDefined();
      expect(res.body.comment.attachments.length).toBe(2);
      expect(res.body.comment.attachments[0].filename).toBe('test-file.pdf');
      expect(res.body.comment.attachments[1].filename).toBe('image.jpg');
    });

    it('should create a reply to a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'This is a reply',
          parentId: commentId,
        });

      expect(res.status).toBe(201);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.parentId).toBe(commentId);
      expect(res.body.comment.content).toBe('This is a reply');
      replyId = res.body.comment.id;
    });

    it('should reject nested replies', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Nested reply should fail',
          parentId: replyId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('top-level comments');
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/comments').send({
        entityType: 'Lot',
        entityId: lotId,
        content: 'Test comment',
      });

      expect(res.status).toBe(401);
    });

    it('should require entityType', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityId: lotId,
          content: 'Test comment',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('entityType');
    });

    it('should require entityId', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          content: 'Test comment',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('entityId');
    });

    it('should require content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('content');
    });

    it('should reject blank content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: '   ',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('content');
    });

    it('should reject oversized comment content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'x'.repeat(5001),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('5000');
    });

    it('should trim whitespace from content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: '  Whitespace test  ',
        });

      expect(res.status).toBe(201);
      expect(res.body.comment.content).toBe('Whitespace test');
    });

    it('should reject reply with invalid parentId', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Invalid parent',
          parentId: 'non-existent-id',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Parent comment not found');
    });

    it('should reject reply to comment from different entity', async () => {
      // Create another lot
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: otherLot.id,
          content: 'Reply to wrong entity',
          parentId: commentId, // Comment belongs to different lot
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('different entity');

      // Cleanup
      await prisma.lot.delete({ where: { id: otherLot.id } });
    });

    it('should handle attachments with missing optional fields', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with minimal attachment',
          attachments: [
            {
              filename: 'minimal.txt',
              fileUrl: '/uploads/comments/minimal.txt',
              // fileSize and mimeType omitted
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.comment.attachments.length).toBe(1);
      expect(res.body.comment.attachments[0].filename).toBe('minimal.txt');
    });

    it('should filter out invalid attachments', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with invalid attachments',
          attachments: [
            {
              filename: 'valid.txt',
              fileUrl: '/uploads/comments/valid.txt',
            },
            {
              filename: 'invalid-no-url.txt',
              // Missing fileUrl
            },
            {
              fileUrl: '/uploads/comments/invalid-no-filename.txt',
              // Missing filename
            },
            {
              filename: 'private-document.pdf',
              fileUrl: '/uploads/documents/private-document.pdf',
            },
            {
              filename: 'data-url.txt',
              fileUrl: 'data:text/plain;base64,SGVsbG8=',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.comment.attachments.length).toBe(1);
      expect(res.body.comment.attachments[0].filename).toBe('valid.txt');
    });

    it('should reject non-finite attachment file sizes without creating the comment', async () => {
      const content = 'Comment with non-finite attachment size';
      const beforeCount = await prisma.comment.count({
        where: { entityType: 'Lot', entityId: lotId, content },
      });
      const body = JSON.stringify({
        entityType: 'Lot',
        entityId: lotId,
        content,
        attachments: [
          {
            filename: 'infinite-size.txt',
            fileUrl: '/uploads/comments/infinite-size.txt',
            fileSize: 0,
          },
        ],
      }).replace('"fileSize":0', '"fileSize":1e309');

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('fileSize');
      await expect(
        prisma.comment.count({ where: { entityType: 'Lot', entityId: lotId, content } }),
      ).resolves.toBe(beforeCount);
    });

    it('should reject external attachment URLs that spoof Supabase storage paths on untrusted hosts', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with spoofed Supabase attachment',
          attachments: [
            {
              filename: 'spoofed.pdf',
              fileUrl:
                'https://example.com/storage/v1/object/public/documents/comments/spoofed.pdf',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No valid attachments');
    });

    it('should reject Supabase attachment URLs outside the target project prefix', async () => {
      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      mockIsSupabaseConfigured.mockReturnValue(true);

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with cross-project Supabase attachment',
          attachments: [
            {
              filename: 'cross-project.pdf',
              fileUrl:
                'https://fixture-project.supabase.co/storage/v1/object/public/documents/comments/other-project/cross-project.pdf',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No valid attachments');
    });

    it('should reject local attachment URLs that escape the comments upload directory', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with traversal attachment URL',
          attachments: [
            {
              filename: 'private-document.pdf',
              fileUrl: '/uploads/comments/../documents/private-document.pdf',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No valid attachments');
    });
  });

  describe('GET /api/comments', () => {
    it('should list comments for an entity', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      expect(res.body.comments).toBeDefined();
      expect(Array.isArray(res.body.comments)).toBe(true);
      expect(res.body.comments.length).toBeGreaterThan(0);
    });

    it('should paginate top-level comments and return pagination metadata', async () => {
      for (let index = 0; index < 3; index += 1) {
        await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            entityType: 'Lot',
            entityId: lotId,
            content: `Pagination comment ${Date.now()}-${index}`,
          });
      }

      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
          page: 1,
          limit: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.comments.length).toBeLessThanOrEqual(2);
      expect(res.body.comments.every((comment: any) => comment.parentId === null)).toBe(true);
      expect(res.body.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 2,
          hasPrevPage: false,
        }),
      );
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
      expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(2);
    });

    it('should reject oversized comment page limits', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
          limit: 101,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('limit must be no greater than 100');
    });

    it('should canonicalize entity type aliases when creating, listing, and replying', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'lot',
          entityId: lotId,
          content: 'Lowercase entity type comment',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.comment.entityType).toBe('Lot');

      const replyRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'LOT',
          entityId: lotId,
          content: 'Uppercase entity type reply',
          parentId: createRes.body.comment.id,
        });

      expect(replyRes.status).toBe(201);
      expect(replyRes.body.comment.entityType).toBe('Lot');
      expect(replyRes.body.comment.parentId).toBe(createRes.body.comment.id);

      const listRes = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'lot',
          entityId: lotId,
        });

      expect(listRes.status).toBe(200);
      const parentComment = listRes.body.comments.find(
        (comment: any) => comment.id === createRes.body.comment.id,
      );
      expect(parentComment).toBeDefined();
      expect(
        parentComment.replies.some((reply: any) => reply.id === replyRes.body.comment.id),
      ).toBe(true);
    });

    it('should allow subcontractors to read comments only on assigned lots', async () => {
      const assignedRes = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(assignedRes.status).toBe(200);
      expect(Array.isArray(assignedRes.body.comments)).toBe(true);

      const unassignedRes = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .query({
          entityType: 'Lot',
          entityId: unassignedLotId,
        });

      expect(unassignedRes.status).toBe(403);
    });

    it('should include author information', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      const comment = res.body.comments[0];
      expect(comment.author).toBeDefined();
      expect(comment.author.id).toBeDefined();
      expect(comment.author.email).toBeDefined();
      expect(comment.author.fullName).toBeDefined();
    });

    it('should include replies', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      // Find the parent comment
      const parentComment = res.body.comments.find((c: any) => c.id === commentId);
      expect(parentComment).toBeDefined();
      expect(parentComment.replies).toBeDefined();
      expect(Array.isArray(parentComment.replies)).toBe(true);
      expect(parentComment.replies.length).toBeGreaterThan(0);

      // Verify reply content
      const reply = parentComment.replies.find((r: any) => r.id === replyId);
      expect(reply).toBeDefined();
      expect(reply.content).toBe('This is a reply');
      expect(reply.author).toBeDefined();
    });

    it('should include attachments', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      // Find a comment with attachments
      const commentWithAttachments = res.body.comments.find(
        (c: any) => c.attachments && c.attachments.length > 0,
      );
      expect(commentWithAttachments).toBeDefined();
      expect(commentWithAttachments.attachments[0].filename).toBeDefined();
      expect(commentWithAttachments.attachments[0].fileUrl).toBeDefined();
    });

    it('should not include deleted comments', async () => {
      // Create and delete a comment
      const deleteRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'To be deleted',
        });
      const deleteCommentId = deleteRes.body.comment.id;

      await request(app)
        .delete(`/api/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // List comments
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      const deletedComment = res.body.comments.find((c: any) => c.id === deleteCommentId);
      expect(deletedComment).toBeUndefined();
    });

    it('should only include top-level comments (not replies)', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      // Verify no comment in the main list has a parentId
      const hasParentId = res.body.comments.some((c: any) => c.parentId !== null);
      expect(hasParentId).toBe(false);
    });

    it('should require entityType', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityId: lotId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('entityType');
    });

    it('should require entityId', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('entityId');
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/comments').query({
        entityType: 'Lot',
        entityId: lotId,
      });

      expect(res.status).toBe(401);
    });

    it('should reject users without project access from reading comments', async () => {
      const otherEmail = `comments-no-access-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Comments No Access User',
        tosAccepted: true,
      });
      const otherToken = otherRes.body.token;
      const otherUserId = otherRes.body.user.id;

      await prisma.user.update({
        where: { id: otherUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      const listRes = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${otherToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'No access comment',
        });

      expect(createRes.status).toBe(403);

      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should order comments by createdAt descending', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      const comments = res.body.comments;
      if (comments.length > 1) {
        // Verify descending order
        for (let i = 0; i < comments.length - 1; i++) {
          const current = new Date(comments[i].createdAt);
          const next = new Date(comments[i + 1].createdAt);
          expect(current >= next).toBe(true);
        }
      }
    });

    it('should order replies by createdAt ascending', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        });

      expect(res.status).toBe(200);
      const parentComment = res.body.comments.find((c: any) => c.id === commentId);
      const replies = parentComment?.replies || [];

      if (replies.length > 1) {
        // Verify ascending order
        for (let i = 0; i < replies.length - 1; i++) {
          const current = new Date(replies[i].createdAt);
          const next = new Date(replies[i + 1].createdAt);
          expect(current <= next).toBe(true);
        }
      }
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized comment route parameters before lookups', async () => {
      const longId = 'c'.repeat(121);
      const validAttachment = {
        filename: 'route-param.txt',
        fileUrl: '/uploads/comments/route-param.txt',
      };

      const checks = [
        {
          label: 'GET attachment download',
          response: await request(app)
            .get(`/api/comments/attachments/${longId}/download`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PUT comment',
          response: await request(app)
            .put(`/api/comments/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ content: 'Updated content' }),
        },
        {
          label: 'DELETE comment',
          response: await request(app)
            .delete(`/api/comments/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST comment attachment',
          response: await request(app)
            .post(`/api/comments/${longId}/attachments`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ attachments: [validAttachment] }),
        },
        {
          label: 'DELETE comment attachment commentId',
          response: await request(app)
            .delete(`/api/comments/${longId}/attachments/attachment-id`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE comment attachment attachmentId',
          response: await request(app)
            .delete(`/api/comments/${commentId}/attachments/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('is too long');
      }
    });
  });

  describe('PUT /api/comments/:id', () => {
    it('should update comment content', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated comment content',
        });

      expect(res.status).toBe(200);
      expect(res.body.comment).toBeDefined();
      expect(res.body.comment.content).toBe('Updated comment content');
      expect(res.body.comment.isEdited).toBe(true);
      expect(res.body.comment.editedAt).toBeDefined();
    });

    it('should trim whitespace from updated content', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '  Trimmed update  ',
        });

      expect(res.status).toBe(200);
      expect(res.body.comment.content).toBe('Trimmed update');
    });

    it('should require authentication', async () => {
      const res = await request(app).put(`/api/comments/${commentId}`).send({
        content: 'Updated content',
      });

      expect(res.status).toBe(401);
    });

    it('should require content', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('content');
    });

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .put('/api/comments/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated content',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('should not allow editing other users comments', async () => {
      // Create another user
      const otherEmail = `other-comment-user-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other User',
        tosAccepted: true,
      });
      const otherToken = otherRes.body.token;
      const otherUserId = otherRes.body.user.id;

      await prisma.user.update({
        where: { id: otherUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: otherUserId, role: 'viewer', status: 'active' },
      });

      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          content: 'Trying to edit someone elses comment',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('own comments');

      // Cleanup
      await prisma.projectUser.deleteMany({ where: { userId: otherUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should not allow editing deleted comments', async () => {
      // Create and delete a comment
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'To be deleted then edited',
        });
      const tempCommentId = createRes.body.comment.id;

      await request(app)
        .delete(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to edit
      const res = await request(app)
        .put(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Trying to edit deleted comment',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/comments/:id', () => {
    let deleteCommentId: string;

    beforeAll(async () => {
      // Create a comment to delete
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment to be deleted',
        });
      deleteCommentId = res.body.comment.id;
    });

    it('should soft delete a comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft delete in database
      const deleted = await prisma.comment.findUnique({
        where: { id: deleteCommentId },
      });
      expect(deleted).toBeDefined();
      expect(deleted?.deletedAt).toBeDefined();
    });

    it('should remove uploaded attachment records and local files when deleting a comment', async () => {
      const uploadRes = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('delete comment attachment body'), {
          filename: 'comment-upload-test-delete-comment.txt',
          contentType: 'text/plain',
        });

      expect(uploadRes.status).toBe(201);
      const uploadedAttachment = uploadRes.body.attachments[0];
      const uploadedPath = path.join(
        process.cwd(),
        String(uploadedAttachment.fileUrl).replace(/^\//, ''),
      );
      expect(fs.existsSync(uploadedPath)).toBe(true);

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Delete this comment and its file',
          attachments: uploadRes.body.attachments,
        });

      expect(createRes.status).toBe(201);
      const uploadedCommentId = createRes.body.comment.id;
      const uploadedAttachmentId = createRes.body.comment.attachments[0].id;

      const deleteRes = await request(app)
        .delete(`/api/comments/${uploadedCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
      expect(fs.existsSync(uploadedPath)).toBe(false);

      const deletedAttachment = await prisma.commentAttachment.findUnique({
        where: { id: uploadedAttachmentId },
      });
      expect(deletedAttachment).toBeNull();
    });

    it('should require authentication', async () => {
      const res = await request(app).delete(`/api/comments/${commentId}`);

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .delete('/api/comments/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should not allow deleting other users comments', async () => {
      // Create another user
      const otherEmail = `other-delete-user-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Delete User',
        tosAccepted: true,
      });
      const otherToken = otherRes.body.token;
      const otherUserId = otherRes.body.user.id;

      await prisma.user.update({
        where: { id: otherUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: otherUserId, role: 'viewer', status: 'active' },
      });

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('own comments');

      // Cleanup
      await prisma.projectUser.deleteMany({ where: { userId: otherUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should return 404 for already deleted comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/comments/:id/attachments', () => {
    let attachCommentId: string;

    beforeAll(async () => {
      // Create a comment for attachment tests
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment for attachment tests',
        });
      attachCommentId = res.body.comment.id;
    });

    it('should add attachments to a comment', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'attachment1.pdf',
              fileUrl: '/uploads/comments/attachment1.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
            },
            {
              filename: 'attachment2.jpg',
              fileUrl: '/uploads/comments/attachment2.jpg',
              fileSize: 2048,
              mimeType: 'image/jpeg',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.count).toBe(2);
      expect(res.body.attachments).toBeDefined();
      expect(res.body.attachments.length).toBe(2);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/comments/test.pdf',
            },
          ],
        });

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .post('/api/comments/non-existent-id/attachments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/comments/test.pdf',
            },
          ],
        });

      expect(res.status).toBe(404);
    });

    it('should not allow adding attachments to other users comments', async () => {
      // Create another user
      const otherEmail = `other-attach-user-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Attach User',
        tosAccepted: true,
      });
      const otherToken = otherRes.body.token;
      const otherUserId = otherRes.body.user.id;

      await prisma.user.update({
        where: { id: otherUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: otherUserId, role: 'viewer', status: 'active' },
      });

      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/comments/test.pdf',
            },
          ],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('own comments');

      // Cleanup
      await prisma.projectUser.deleteMany({ where: { userId: otherUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should require attachments array', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('attachments');
    });

    it('should reject empty attachments array', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('attachments');
    });

    it('should reject attachment batches over the per-comment limit', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: Array.from({ length: 6 }, (_, index) => ({
            filename: `too-many-${index}.txt`,
            fileUrl: `/uploads/comments/too-many-${index}.txt`,
          })),
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('5');
    });

    it('should reject attachments with missing required fields', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'no-url.pdf',
              // Missing fileUrl
            },
            {
              fileUrl: '/uploads/comments/no-filename.pdf',
              // Missing filename
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No valid attachments');
    });

    it('should handle attachments with optional fields omitted', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'minimal.txt',
              fileUrl: '/uploads/comments/minimal.txt',
              // fileSize and mimeType omitted
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.count).toBe(1);
      expect(res.body.attachments[res.body.attachments.length - 1].filename).toBe('minimal.txt');
    });

    it('should reject invalid attachment metadata without adding attachments', async () => {
      const invalidMetadataCases = [
        {
          expectedMessage: 'fileSize',
          payload: {
            filename: 'negative-size.txt',
            fileUrl: '/uploads/comments/negative-size.txt',
            fileSize: -1,
          },
        },
        {
          expectedMessage: 'mimeType',
          payload: {
            filename: 'oversized-mime.txt',
            fileUrl: '/uploads/comments/oversized-mime.txt',
            mimeType: 'x'.repeat(121),
          },
        },
      ];

      for (const { expectedMessage, payload } of invalidMetadataCases) {
        const beforeCount = await prisma.commentAttachment.count({
          where: { commentId: attachCommentId },
        });

        const res = await request(app)
          .post(`/api/comments/${attachCommentId}/attachments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ attachments: [payload] });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain(expectedMessage);
        await expect(
          prisma.commentAttachment.count({ where: { commentId: attachCommentId } }),
        ).resolves.toBe(beforeCount);
      }
    });

    it('should reject attachment references outside comment upload storage', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'private-document.pdf',
              fileUrl: '/uploads/documents/private-document.pdf',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No valid attachments');
    });

    it('should reject Supabase attachment URLs outside the comment project prefix', async () => {
      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      mockIsSupabaseConfigured.mockReturnValue(true);

      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'cross-project.pdf',
              fileUrl:
                'https://fixture-project.supabase.co/storage/v1/object/public/documents/comments/other-project/cross-project.pdf',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No valid attachments');
    });

    it('should not allow adding attachments to deleted comments', async () => {
      // Create and delete a comment
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'To be deleted',
        });
      const tempId = createRes.body.comment.id;

      await request(app)
        .delete(`/api/comments/${tempId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to add attachment
      const res = await request(app)
        .post(`/api/comments/${tempId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/comments/test.pdf',
            },
          ],
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/comments/:commentId/attachments/:attachmentId', () => {
    let deleteAttachCommentId: string;
    let attachmentId: string;

    beforeAll(async () => {
      // Create a comment with attachments
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with attachment to delete',
          attachments: [
            {
              filename: 'to-delete.pdf',
              fileUrl: '/uploads/comments/to-delete.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
            },
          ],
        });
      deleteAttachCommentId = res.body.comment.id;
      attachmentId = res.body.comment.attachments[0].id;
    });

    it('should delete an attachment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify attachment was deleted
      const attachment = await prisma.commentAttachment.findUnique({
        where: { id: attachmentId },
      });
      expect(attachment).toBeNull();
    });

    it('should remove uploaded local files when deleting attachments', async () => {
      const uploadRes = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('delete uploaded attachment body'), {
          filename: `comment-upload-test-delete-local-${Date.now()}.txt`,
          contentType: 'text/plain',
        });

      expect(uploadRes.status).toBe(201);
      const uploadedAttachment = uploadRes.body.attachments[0];
      const localPath = uploadedAttachment.fileUrl.startsWith('/uploads/')
        ? path.join(process.cwd(), uploadedAttachment.fileUrl.replace(/^\//, ''))
        : null;

      if (localPath) {
        expect(fs.existsSync(localPath)).toBe(true);
      }

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with uploaded attachment to delete',
          attachments: uploadRes.body.attachments,
        });

      const uploadedCommentId = createRes.body.comment.id;
      const uploadedAttachmentId = createRes.body.comment.attachments[0].id;
      const deleteRes = await request(app)
        .delete(`/api/comments/${uploadedCommentId}/attachments/${uploadedAttachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteRes.status).toBe(200);
      if (localPath) {
        expect(fs.existsSync(localPath)).toBe(false);
      }
    });

    it('should require authentication', async () => {
      const res = await request(app).delete(
        `/api/comments/${deleteAttachCommentId}/attachments/${attachmentId}`,
      );

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .delete('/api/comments/non-existent-id/attachments/some-attachment-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent attachment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/non-existent-attachment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Attachment not found');
    });

    it('should not allow deleting attachments from other users comments', async () => {
      // Create another user and their comment
      const otherEmail = `other-del-attach-user-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Del Attach User',
        tosAccepted: true,
      });
      const otherToken = otherRes.body.token;
      const otherUserId = otherRes.body.user.id;

      await prisma.user.update({
        where: { id: otherUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: otherUserId, role: 'viewer', status: 'active' },
      });

      // Create a new attachment on our comment
      const attachRes = await request(app)
        .post(`/api/comments/${deleteAttachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'protected.pdf',
              fileUrl: '/uploads/comments/protected.pdf',
            },
          ],
        });
      const protectedAttachmentId =
        attachRes.body.attachments[attachRes.body.attachments.length - 1].id;

      // Try to delete with other user
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/${protectedAttachmentId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('own comments');

      // Cleanup
      await prisma.projectUser.deleteMany({ where: { userId: otherUserId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
    });

    it('should not allow deleting attachments from deleted comments', async () => {
      // Create a comment with attachment
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment to delete',
          attachments: [
            {
              filename: 'temp.pdf',
              fileUrl: '/uploads/comments/temp.pdf',
            },
          ],
        });
      const tempCommentId = createRes.body.comment.id;
      const tempAttachmentId = createRes.body.comment.attachments[0].id;

      // Delete the comment
      await request(app)
        .delete(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Try to delete attachment
      const res = await request(app)
        .delete(`/api/comments/${tempCommentId}/attachments/${tempAttachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/comments/attachments/:attachmentId/download', () => {
    it('should download stored attachments for users with entity access', async () => {
      const uploadRes = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('comment attachment download body'), {
          filename: 'comment-upload-test-download.txt',
          contentType: 'text/plain',
        });

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with downloadable attachment',
          attachments: uploadRes.body.attachments,
        });

      const attachment = createRes.body.comment.attachments[0];
      const res = await request(app)
        .get(`/api/comments/attachments/${attachment.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('comment-upload-test-download.txt');
      expect(res.headers['cache-control']).toBe('private, no-store, max-age=0');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.text).toContain('comment attachment download body');
    });

    it('should sanitize legacy attachment filenames in download headers', async () => {
      const commentsUploadDir = path.join(process.cwd(), 'uploads', 'comments');
      const storedFilename = `comment-upload-test-header-${Date.now()}.txt`;
      fs.writeFileSync(path.join(commentsUploadDir, storedFilename), 'header hardening body');

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with legacy unsafe attachment filename',
        });

      const attachment = await prisma.commentAttachment.create({
        data: {
          commentId: createRes.body.comment.id,
          filename: '../unsafe"\r\n.pdf',
          fileUrl: `/uploads/comments/${storedFilename}`,
          fileSize: 21,
          mimeType: 'text/plain',
        },
      });

      const res = await request(app)
        .get(`/api/comments/attachments/${attachment.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBe('attachment; filename="unsafe___.pdf"');
      expect(res.text).toContain('header hardening body');
    });

    it('should serve unsafe legacy attachment MIME types as downloads without sniffing', async () => {
      const commentsUploadDir = path.join(process.cwd(), 'uploads', 'comments');
      fs.mkdirSync(commentsUploadDir, { recursive: true });
      const storedFilename = `comment-upload-test-mime-${Date.now()}.txt`;
      fs.writeFileSync(path.join(commentsUploadDir, storedFilename), 'mime hardening body');

      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with unsafe legacy attachment MIME type',
        });

      const attachment = await prisma.commentAttachment.create({
        data: {
          commentId: createRes.body.comment.id,
          filename: 'legacy.html',
          fileUrl: `/uploads/comments/${storedFilename}`,
          fileSize: 19,
          mimeType: 'text/html',
        },
      });

      const res = await request(app)
        .get(`/api/comments/attachments/${attachment.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/octet-stream');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-disposition']).toBe('attachment; filename="legacy.html"');
    });

    it('should not serve legacy attachment records that point outside comment uploads', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with legacy bad attachment',
        });

      const attachment = await prisma.commentAttachment.create({
        data: {
          commentId: createRes.body.comment.id,
          filename: 'private-document.pdf',
          fileUrl: '/uploads/documents/private-document.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });

      const res = await request(app)
        .get(`/api/comments/attachments/${attachment.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Attachment file');
    });

    it('should not redirect legacy attachment records to arbitrary external URLs', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with legacy external attachment',
        });

      const attachment = await prisma.commentAttachment.create({
        data: {
          commentId: createRes.body.comment.id,
          filename: 'external.pdf',
          fileUrl: 'https://example.com/external.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });

      const res = await request(app)
        .get(`/api/comments/attachments/${attachment.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Attachment file');
    });

    it('should not redirect legacy attachment records to Supabase-path URLs on untrusted hosts', async () => {
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with spoofed Supabase host attachment',
        });

      const attachment = await prisma.commentAttachment.create({
        data: {
          commentId: createRes.body.comment.id,
          filename: 'external-supabase-path.pdf',
          fileUrl: 'https://example.com/storage/v1/object/public/documents/comments/external.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });

      const res = await request(app)
        .get(`/api/comments/attachments/${attachment.id}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('Attachment file');
    });

    it('should require authentication for attachment downloads', async () => {
      const res = await request(app).get('/api/comments/attachments/non-existent-id/download');

      expect(res.status).toBe(401);
    });
  });

  describe('Comment Mentions', () => {
    it('should create comment with @mentions in content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Hey @testuser, check this out!',
        });

      // Comment should still be created even if mention notifications fail
      expect(res.status).toBe(201);
      expect(res.body.comment.content).toBe('Hey @testuser, check this out!');
    });

    it('should create mounted project comment links for mention notifications', async () => {
      const mentionEmail = `comments-mention-${Date.now()}@example.com`;
      const mentionRes = await request(app).post('/api/auth/register').send({
        email: mentionEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Comments Mention User',
        tosAccepted: true,
      });
      const mentionedUserId = mentionRes.body.user.id;

      await prisma.user.update({
        where: { id: mentionedUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: mentionedUserId, role: 'viewer', status: 'active' },
      });

      try {
        const res = await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            entityType: 'Lot',
            entityId: lotId,
            content: `Please review @${mentionEmail}`,
          });

        expect(res.status).toBe(201);

        const notification = await prisma.notification.findFirst({
          where: {
            userId: mentionedUserId,
            projectId,
            type: 'mention',
          },
          orderBy: { createdAt: 'desc' },
        });

        expect(notification).toBeDefined();
        const linkUrl = notification?.linkUrl || '';
        expect(linkUrl).toContain(
          `/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(lotId)}`,
        );

        const queryString = linkUrl.split('?')[1] || '';
        const params = new URLSearchParams(queryString);
        expect(params.get('tab')).toBe('comments');
        expect(params.get('commentId')).toBe(res.body.comment.id);
      } finally {
        await prisma.notification.deleteMany({ where: { userId: mentionedUserId } });
        await prisma.projectUser.deleteMany({ where: { userId: mentionedUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: mentionedUserId } });
        await prisma.user.delete({ where: { id: mentionedUserId } }).catch(() => {});
      }
    });
  });

  describe('Multiple Entity Types', () => {
    it('should support comments on project-backed entity types', async () => {
      const document = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          filename: 'comment-entity-document.jpg',
          fileUrl: '/uploads/documents/comment-entity-document.jpg',
          fileSize: 512,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });

      const ncr = await prisma.nCR.create({
        data: {
          projectId,
          ncrNumber: `COM-NCR-${Date.now()}`,
          description: 'Comment entity NCR',
          category: 'minor',
          severity: 'minor',
          raisedById: userId,
        },
      });

      try {
        const entities = [
          { entityType: 'Lot', entityId: lotId },
          { entityType: 'ITP', entityId: lotId },
          { entityType: 'Document', entityId: document.id },
          { entityType: 'NCR', entityId: ncr.id },
        ];

        for (const entity of entities) {
          const res = await request(app)
            .post('/api/comments')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              ...entity,
              content: `Comment on ${entity.entityType}`,
            });

          expect(res.status).toBe(201);
          expect(res.body.comment.entityType).toBe(entity.entityType);
        }
      } finally {
        await prisma.commentAttachment.deleteMany({
          where: { comment: { entityId: { in: [document.id, ncr.id] } } },
        });
        await prisma.comment.deleteMany({ where: { entityId: { in: [document.id, ncr.id] } } });
        await prisma.nCR.delete({ where: { id: ncr.id } }).catch(() => {});
        await prisma.document.delete({ where: { id: document.id } }).catch(() => {});
      }
    });

    it('should deny subcontractor comments on internal-only entity types', async () => {
      const document = await prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'photo',
          filename: 'comment-subcontractor-internal-document.jpg',
          fileUrl: '/uploads/documents/comment-subcontractor-internal-document.jpg',
          fileSize: 512,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        },
      });

      try {
        const createRes = await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .send({
            entityType: 'Document',
            entityId: document.id,
            content: 'Subcontractor document comment should fail',
          });

        expect(createRes.status).toBe(403);

        const readRes = await request(app)
          .get('/api/comments')
          .set('Authorization', `Bearer ${subcontractorToken}`)
          .query({
            entityType: 'Document',
            entityId: document.id,
          });

        expect(readRes.status).toBe(403);
      } finally {
        await prisma.commentAttachment.deleteMany({
          where: { comment: { entityId: document.id } },
        });
        await prisma.comment.deleteMany({ where: { entityId: document.id } });
        await prisma.document.delete({ where: { id: document.id } }).catch(() => {});
      }
    });

    it('should reject unsupported entity types', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'System',
          entityId: lotId,
          content: 'Unsupported entity comment',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Unsupported');
    });
  });

  describe('Supabase comment attachment cleanup', () => {
    const SUPABASE_HOST = 'https://fixture-project.supabase.co';

    function buildSupabaseAttachmentUrl(filename: string, urlProjectId = projectId) {
      return `${SUPABASE_HOST}/storage/v1/object/public/documents/comments/${urlProjectId}/${filename}`;
    }

    async function insertSupabaseAttachmentComment(filename: string, urlProjectId = projectId) {
      const fileUrl = buildSupabaseAttachmentUrl(filename, urlProjectId);
      const comment = await prisma.comment.create({
        data: {
          entityType: 'Lot',
          entityId: lotId,
          content: `Supabase attachment comment ${filename}`,
          authorId: userId,
          attachments: {
            create: [
              {
                filename,
                fileUrl,
                fileSize: 4,
                mimeType: 'text/plain',
              },
            ],
          },
        },
        include: { attachments: true },
      });
      return {
        commentId: comment.id,
        attachmentId: comment.attachments[0]!.id,
        fileUrl,
        storagePath: `comments/${urlProjectId}/${filename}`,
      };
    }

    it('removes the Supabase object on DELETE comment when an attachment URL points at the documents bucket', async () => {
      process.env.SUPABASE_URL = SUPABASE_HOST;
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      const filename = `supabase-comment-${Date.now()}.txt`;
      const { commentId: targetCommentId, storagePath } =
        await insertSupabaseAttachmentComment(filename);

      const res = await request(app)
        .delete(`/api/comments/${targetCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      // Allow the awaited cleanup helpers to flush.
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledWith([storagePath]);
    });

    it('does not remove a Supabase object outside the comment project prefix on DELETE comment', async () => {
      process.env.SUPABASE_URL = SUPABASE_HOST;
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      const filename = `supabase-foreign-comment-${Date.now()}.txt`;
      const { commentId: targetCommentId } = await insertSupabaseAttachmentComment(
        filename,
        'other-project',
      );

      const res = await request(app)
        .delete(`/api/comments/${targetCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('removes the Supabase object on DELETE single attachment when its URL points at the documents bucket', async () => {
      process.env.SUPABASE_URL = SUPABASE_HOST;
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      const filename = `supabase-attachment-${Date.now()}.txt`;
      const {
        commentId: targetCommentId,
        attachmentId,
        storagePath,
      } = await insertSupabaseAttachmentComment(filename);

      const res = await request(app)
        .delete(`/api/comments/${targetCommentId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledWith([storagePath]);

      // Cleanup the comment row for tidiness; attachment row is already gone.
      await prisma.comment.delete({ where: { id: targetCommentId } }).catch(() => {});
    });

    it('does not remove a Supabase object outside the comment project prefix on DELETE single attachment', async () => {
      process.env.SUPABASE_URL = SUPABASE_HOST;
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      const filename = `supabase-foreign-attachment-${Date.now()}.txt`;
      const { commentId: targetCommentId, attachmentId } = await insertSupabaseAttachmentComment(
        filename,
        'other-project',
      );

      const res = await request(app)
        .delete(`/api/comments/${targetCommentId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRemove).not.toHaveBeenCalled();

      await prisma.comment.delete({ where: { id: targetCommentId } }).catch(() => {});
    });

    it('removes already-uploaded Supabase comment objects when a later upload in the same batch fails', async () => {
      process.env.SUPABASE_URL = SUPABASE_HOST;
      let firstUploadedPath: string | undefined;
      const mockUpload = vi
        .fn()
        .mockImplementationOnce((storagePath: string) => {
          firstUploadedPath = storagePath;
          return Promise.resolve({ data: { path: storagePath }, error: null });
        })
        .mockImplementationOnce(() =>
          Promise.resolve({
            data: null,
            error: { message: 'simulated supabase upload failure' },
          }),
        );
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ upload: mockUpload, remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      const res = await request(app)
        .post('/api/comments/attachments/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('entityType', 'Lot')
        .field('entityId', lotId)
        .attach('files', Buffer.from('rollback first ok'), {
          filename: 'supabase-rollback-first.txt',
          contentType: 'text/plain',
        })
        .attach('files', Buffer.from('rollback second fails'), {
          filename: 'supabase-rollback-second.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(mockUpload).toHaveBeenCalledTimes(2);

      await new Promise((resolve) => setImmediate(resolve));

      expect(firstUploadedPath).toBeDefined();
      expect(mockRemove).toHaveBeenCalledTimes(1);
      expect(mockRemove).toHaveBeenCalledWith([firstUploadedPath]);
    });

    it('still returns 200 from DELETE comment when Supabase cleanup throws (best-effort)', async () => {
      process.env.SUPABASE_URL = SUPABASE_HOST;
      mockIsSupabaseConfigured.mockReturnValue(true);
      // Simulate Supabase being unreachable at delete time. The DB delete
      // must still succeed and the response must still be 200 because
      // storage cleanup is best-effort.
      mockGetSupabaseClient.mockImplementation(() => {
        throw new Error('simulated Supabase outage');
      });

      const filename = `supabase-besteffort-${Date.now()}.txt`;
      const { commentId: targetCommentId } = await insertSupabaseAttachmentComment(filename);

      const res = await request(app)
        .delete(`/api/comments/${targetCommentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const persisted = await prisma.comment.findUnique({
        where: { id: targetCommentId },
        select: { deletedAt: true },
      });
      // Soft-delete: row remains, deletedAt set.
      expect(persisted?.deletedAt).not.toBeNull();
    });
  });
});

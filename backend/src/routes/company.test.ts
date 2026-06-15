import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';

// Mock Supabase helpers so individual logo tests can opt into the Supabase
// branch by overriding the mock returns. By default `isSupabaseConfigured()`
// returns false (matching vitest.config.ts, which blanks SUPABASE_URL).
vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    getSupabaseClient: vi.fn(),
  };
});

import * as supabaseLib from '../lib/supabase.js';
import apiKeysRouter, { authenticateApiKey } from './apiKeys.js';
import { companyRouter } from './company.js';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import { registerTestUser } from '../test/routeTestHarness.js';

const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);
const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

const app = express();
app.use(express.json());
app.use(authenticateApiKey);
app.use('/api/auth', authRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/company', companyRouter);
app.use(errorHandler);

const companyLogoUploadDir = path.join(process.cwd(), 'uploads', 'company-logos');
const tinyPngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function listCompanyLogoFiles(prefix: string) {
  if (!fs.existsSync(companyLogoUploadDir)) {
    return new Set<string>();
  }

  return new Set(fs.readdirSync(companyLogoUploadDir).filter((name) => name.startsWith(prefix)));
}

async function expectLatestCompanyAuditLog(companyId: string, action: string) {
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      entityType: 'company',
      entityId: companyId,
      action,
    },
    orderBy: { createdAt: 'desc' },
  });

  expect(auditLog).toBeDefined();
  if (!auditLog) {
    throw new Error(`Expected ${action} audit log for company ${companyId}`);
  }

  return {
    auditLog,
    changes: parseAuditLogChanges(auditLog.changes) as Record<string, unknown>,
  };
}

describe('Company API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: {
        name: `Company Test ${Date.now()}`,
        subscriptionTier: 'professional',
      },
    });
    companyId = company.id;

    // Create test user
    const primaryUser = await registerTestUser(app, {
      emailPrefix: 'company-test',
      fullName: 'Company Test User',
      companyId,
      roleInCompany: 'owner',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { OR: [{ userId }, { entityId: companyId }] },
    });
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('POST /api/company', () => {
    it('creates a company for a company-less user and promotes them to owner', async () => {
      const noCompanyEmail = `company-onboarding-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: noCompanyEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Company Onboarding User',
        tosAccepted: true,
      });

      const onboardingUserId = regRes.body.user.id as string;
      let createdCompanyId: string | undefined;

      try {
        const res = await request(app)
          .post('/api/company')
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .send({
            name: '  Onboarding Civil Pty Ltd  ',
            abn: '  12345678901  ',
            address: '  10 Test Street, Sydney NSW 2000  ',
          });

        expect(res.status).toBe(201);
        expect(res.body.company).toMatchObject({
          name: 'Onboarding Civil Pty Ltd',
          abn: '12345678901',
          address: '10 Test Street, Sydney NSW 2000',
          subscriptionTier: 'basic',
        });
        expect(res.body.user).toMatchObject({
          id: onboardingUserId,
          role: 'owner',
          roleInCompany: 'owner',
          companyId: res.body.company.id,
          companyName: 'Onboarding Civil Pty Ltd',
        });

        const responseCompanyId = res.body.company.id as string;
        createdCompanyId = responseCompanyId;

        const updatedUser = await prisma.user.findUnique({
          where: { id: onboardingUserId },
          select: { companyId: true, roleInCompany: true },
        });
        expect(updatedUser).toMatchObject({
          companyId: createdCompanyId,
          roleInCompany: 'owner',
        });

        const { auditLog, changes } = await expectLatestCompanyAuditLog(
          responseCompanyId,
          'company_created',
        );
        expect(auditLog.userId).toBe(onboardingUserId);
        expect(changes.companyName).toBe('Onboarding Civil Pty Ltd');
      } finally {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { userId: onboardingUserId },
              ...(createdCompanyId ? [{ entityId: createdCompanyId }] : []),
            ],
          },
        });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: onboardingUserId } });
        await prisma.user.delete({ where: { id: onboardingUserId } }).catch(() => {});
        if (createdCompanyId) {
          await prisma.company.delete({ where: { id: createdCompanyId } }).catch(() => {});
        }
      }
    });

    it('rejects company creation when the user already belongs to a company', async () => {
      const res = await request(app)
        .post('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Second Company Pty Ltd' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('already belong to a company');
    });

    it('rejects company creation when the user is linked to a subcontractor portal account', async () => {
      const suffix = Date.now();
      const portalEmail = `company-subbie-linked-${suffix}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: portalEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Linked Subbie Portal User',
        tosAccepted: true,
      });
      const portalUserId = regRes.body.user.id as string;
      let createdCompanyId: string | undefined;
      let projectId: string | undefined;
      let subcontractorCompanyId: string | undefined;

      try {
        const project = await prisma.project.create({
          data: {
            name: `Linked Subbie Project ${suffix}`,
            projectNumber: `LINKED-SUB-${suffix}`,
            companyId,
            status: 'active',
            state: 'NSW',
            specificationSet: 'TfNSW',
          },
        });
        projectId = project.id;

        const subcontractor = await prisma.subcontractorCompany.create({
          data: {
            projectId: project.id,
            companyName: `Linked Subbie ${suffix}`,
            primaryContactName: 'Linked Subbie Portal User',
            primaryContactEmail: portalEmail,
            status: 'approved',
          },
        });
        subcontractorCompanyId = subcontractor.id;

        await prisma.subcontractorUser.create({
          data: {
            subcontractorCompanyId: subcontractor.id,
            userId: portalUserId,
            role: 'admin',
          },
        });

        const res = await request(app)
          .post('/api/company')
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .send({ name: 'Should Not Become HC Pty Ltd' });

        createdCompanyId = res.body.company?.id;

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Subcontractor portal accounts');

        const user = await prisma.user.findUnique({
          where: { id: portalUserId },
          select: { companyId: true, roleInCompany: true },
        });
        expect(user?.companyId).toBeNull();
        expect(user?.roleInCompany).not.toBe('owner');
      } finally {
        await prisma.auditLog.deleteMany({ where: { userId: portalUserId } });
        await prisma.subcontractorUser.deleteMany({ where: { userId: portalUserId } });
        if (subcontractorCompanyId) {
          await prisma.subcontractorCompany
            .delete({ where: { id: subcontractorCompanyId } })
            .catch(() => {});
        }
        if (projectId) {
          await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
        }
        await prisma.emailVerificationToken.deleteMany({ where: { userId: portalUserId } });
        await prisma.user.delete({ where: { id: portalUserId } }).catch(() => {});
        if (createdCompanyId) {
          await prisma.company.delete({ where: { id: createdCompanyId } }).catch(() => {});
        }
      }
    });
  });

  describe('GET /api/company', () => {
    it("should get the current user's company", async () => {
      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company).toBeDefined();
      expect(res.body.company.id).toBe(companyId);
      expect(res.body.company.name).toContain('Company Test');
      expect(res.body.company.subscriptionTier).toBe('professional');
    });

    it('should include project count and limit', async () => {
      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company.projectCount).toBeDefined();
      expect(res.body.company.projectLimit).toBe(10); // professional tier
      expect(typeof res.body.company.projectCount).toBe('number');
    });

    it('should include user count and limit', async () => {
      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company.userCount).toBeDefined();
      expect(res.body.company.userLimit).toBe(25); // professional tier
      expect(typeof res.body.company.userCount).toBe('number');
    });

    it('should return 404 if user has no company', async () => {
      // Create a user without company
      const noCompanyEmail = `no-company-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: noCompanyEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Company User',
        tosAccepted: true,
      });

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } });
      await prisma.user.delete({ where: { id: regRes.body.user.id } });
    });

    it('should reject subcontractor users from reading head contractor company metadata', async () => {
      const subcontractorEmail = `company-subcontractor-${Date.now()}@example.com`;
      const subcontractorRes = await request(app).post('/api/auth/register').send({
        email: subcontractorEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Company Subcontractor',
        tosAccepted: true,
      });
      const subcontractorId = subcontractorRes.body.user.id;

      await prisma.user.update({
        where: { id: subcontractorId },
        data: { companyId, roleInCompany: 'subcontractor' },
      });

      try {
        const res = await request(app)
          .get('/api/company')
          .set('Authorization', `Bearer ${subcontractorRes.body.token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('subcontractor company profile');
        expect(res.body.company).toBeUndefined();
      } finally {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: subcontractorId } });
        await prisma.user.delete({ where: { id: subcontractorId } }).catch(() => {});
      }
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/company');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/company', () => {
    it('should update company name', async () => {
      const newName = `Updated Company ${Date.now()}`;
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: newName });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('updated successfully');
      expect(res.body.company.name).toBe(newName);
    });

    it('should update company ABN', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ abn: '12345678901' });

      expect(res.status).toBe(200);
      expect(res.body.company.abn).toBe('12345678901');
    });

    it('should update company address', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ address: '123 Test Street, Sydney NSW 2000' });

      expect(res.status).toBe(200);
      expect(res.body.company.address).toBe('123 Test Street, Sydney NSW 2000');
    });

    it('should update company logo URL', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ logoUrl: 'https://example.com/logo.png' });

      expect(res.status).toBe(200);
      expect(res.body.company.logoUrl).toBe('https://example.com/logo.png');
    });

    it('should reject inline company logo data URLs', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ logoUrl: 'data:image/png;base64,abc123' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('uploaded before saving');
    });

    it('should reject unsafe company logo URLs', async () => {
      const unsafeLogoUrls = [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'https://user:pass@example.com/logo.png',
        '/uploads/company-logos/../secret.png',
        'https://example.com\\logo.png',
      ];

      for (const logoUrl of unsafeLogoUrls) {
        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl });

        expect(res.status).toBe(400);
      }
    });

    it('should upload a company logo file and store a URL', async () => {
      const res = await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('logo', tinyPngBytes, {
          filename: 'logo.svg',
          contentType: 'image/png',
        });

      expect(res.status).toBe(201);
      expect(res.body.logoUrl).toContain('/uploads/company-logos/');
      expect(res.body.company.logoUrl).toBe(res.body.logoUrl);

      const filename = res.body.logoUrl.split('/').pop();
      const logoPath = path.join(process.cwd(), 'uploads', 'company-logos', filename);
      expect(filename).toMatch(new RegExp(`^company-logo-${companyId}-[0-9a-f-]{36}\\.png$`));
      expect(filename).not.toContain('.svg');
      expect(fs.existsSync(logoPath)).toBe(true);

      const { auditLog, changes } = await expectLatestCompanyAuditLog(
        companyId,
        AuditAction.COMPANY_LOGO_UPDATED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({ changedFields: ['logoUrl'] });
      expect(JSON.stringify(changes)).not.toContain(filename);
      expect(JSON.stringify(changes)).not.toContain(res.body.logoUrl);
      expect(JSON.stringify(changes)).not.toContain('Company Test');

      fs.unlinkSync(logoPath);
    });

    it('should not delete local company logo files referenced by untrusted external URLs', async () => {
      const sentinelFilename = `company-logo-external-sentinel-${Date.now()}.png`;
      const sentinelPath = path.join(companyLogoUploadDir, sentinelFilename);
      let uploadedFilename: string | undefined;

      try {
        fs.mkdirSync(companyLogoUploadDir, { recursive: true });
        fs.writeFileSync(sentinelPath, tinyPngBytes);
        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: `https://example.com/uploads/company-logos/${sentinelFilename}` },
        });

        const res = await request(app)
          .post('/api/company/logo')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('logo', tinyPngBytes, {
            filename: 'replacement-logo.png',
            contentType: 'image/png',
          });

        expect(res.status).toBe(201);
        expect(fs.existsSync(sentinelPath)).toBe(true);
        uploadedFilename = res.body.logoUrl?.split('/').pop();
      } finally {
        fs.rmSync(sentinelPath, { force: true });
        if (uploadedFilename) {
          fs.rmSync(path.join(companyLogoUploadDir, uploadedFilename), { force: true });
        }
      }
    });

    it('should reject company logo files whose bytes do not match the declared type', async () => {
      const beforeFiles = listCompanyLogoFiles(`company-logo-${companyId}-`);

      const res = await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('logo', Buffer.from('not really a png'), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      const afterFiles = listCompanyLogoFiles(`company-logo-${companyId}-`);
      const newFiles = [...afterFiles].filter((name) => !beforeFiles.has(name));

      for (const file of newFiles) {
        fs.rmSync(path.join(companyLogoUploadDir, file), { force: true });
      }

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
      expect(newFiles).toEqual([]);
    });

    it('should reject invalid company logo file types with a client error', async () => {
      const res = await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('logo', Buffer.from('not an image'), {
          filename: 'logo.txt',
          contentType: 'text/plain',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('should reject oversized company logo files with a client error', async () => {
      const res = await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('logo', Buffer.alloc(2 * 1024 * 1024 + 1), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('should update multiple fields at once', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: `Multi Update ${Date.now()}`,
          abn: '98765432109',
          address: '456 Another St',
          logoUrl: 'https://example.com/new-logo.png',
        });

      expect(res.status).toBe(200);
      expect(res.body.company.name).toContain('Multi Update');
      expect(res.body.company.abn).toBe('98765432109');
      expect(res.body.company.address).toBe('456 Another St');
      expect(res.body.company.logoUrl).toBe('https://example.com/new-logo.png');

      const { auditLog, changes } = await expectLatestCompanyAuditLog(
        companyId,
        AuditAction.COMPANY_UPDATED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({ changedFields: ['name', 'abn', 'address', 'logoUrl'] });
      expect(JSON.stringify(changes)).not.toContain(res.body.company.name);
      expect(JSON.stringify(changes)).not.toContain('98765432109');
      expect(JSON.stringify(changes)).not.toContain('456 Another St');
      expect(JSON.stringify(changes)).not.toContain('https://example.com/new-logo.png');
    });

    it('should reject empty company name', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject malformed company setting fields', async () => {
      const nonStringNameRes = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: { value: 'Bad Company Name' } });

      expect(nonStringNameRes.status).toBe(400);
      expect(nonStringNameRes.body.error.message).toContain('Company name');

      const longAddressRes = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ address: 'A'.repeat(301) });

      expect(longAddressRes.status).toBe(400);
      expect(longAddressRes.body.error.message).toContain('Address');
    });

    it('should trim company name', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '  Trimmed Name  ' });

      expect(res.status).toBe(200);
      expect(res.body.company.name).toBe('Trimmed Name');
    });

    it('should allow clearing optional fields', async () => {
      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '',
          address: '',
          logoUrl: '',
        });

      expect(res.status).toBe(200);
      expect(res.body.company.abn).toBeNull();
      expect(res.body.company.address).toBeNull();
      expect(res.body.company.logoUrl).toBeNull();
    });

    it('should require authentication', async () => {
      const res = await request(app).patch('/api/company').send({ name: 'Should Fail' });

      expect(res.status).toBe(401);
    });

    it('should reject non-admin/owner users', async () => {
      // Create a member user
      const memberEmail = `member-${Date.now()}@example.com`;
      const memberRes = await request(app).post('/api/auth/register').send({
        email: memberEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Member User',
        tosAccepted: true,
      });

      await prisma.user.update({
        where: { id: memberRes.body.user.id },
        data: { companyId, roleInCompany: 'site_manager' },
      });

      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${memberRes.body.token}`)
        .send({ name: 'Should Fail' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('owners and admins');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: memberRes.body.user.id } });
      await prisma.user.delete({ where: { id: memberRes.body.user.id } });
    });

    it('should allow admin to update company', async () => {
      // Create an admin user
      const adminEmail = `admin-${Date.now()}@example.com`;
      const adminRes = await request(app).post('/api/auth/register').send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Admin User',
        tosAccepted: true,
      });

      await prisma.user.update({
        where: { id: adminRes.body.user.id },
        data: { companyId, roleInCompany: 'admin' },
      });

      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${adminRes.body.token}`)
        .send({ name: `Admin Updated ${Date.now()}` });

      expect(res.status).toBe(200);
      expect(res.body.company.name).toContain('Admin Updated');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: adminRes.body.user.id } });
      await prisma.user.delete({ where: { id: adminRes.body.user.id } });
    });

    it('should return 404 if user has no company', async () => {
      // Create a user without company
      const noCompanyEmail = `no-company-patch-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: noCompanyEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Company User',
        tosAccepted: true,
      });

      const res = await request(app)
        .patch('/api/company')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({ name: 'Should Fail' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } });
      await prisma.user.delete({ where: { id: regRes.body.user.id } });
    });

    // Supabase storage path coverage. Because `isSupabaseConfigured()` is
    // evaluated at module load to decide multer storage mode, the route file
    // always uses disk storage in tests. These tests therefore exercise the
    // *cleanup* path (replacement branch in POST /logo) which works regardless
    // of multer mode — same approach PR #5 used for test certificates.
    describe('Supabase-backed company-logo cleanup', () => {
      const previousSupabaseUrl = process.env.SUPABASE_URL;

      afterEach(() => {
        if (previousSupabaseUrl === undefined) {
          delete process.env.SUPABASE_URL;
        } else {
          process.env.SUPABASE_URL = previousSupabaseUrl;
        }
        mockIsSupabaseConfigured.mockReset();
        mockIsSupabaseConfigured.mockReturnValue(false);
        mockGetSupabaseClient.mockReset();
      });

      it('removes the previous Supabase object when a new logo replaces it', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        const oldSupabaseUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/${companyId}/company-logo-${companyId}-oldfile.png`;
        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: oldSupabaseUrl },
        });

        let uploadedFilename: string | undefined;
        try {
          const res = await request(app)
            .post('/api/company/logo')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('logo', tinyPngBytes, {
              filename: 'replacement.png',
              contentType: 'image/png',
            });

          uploadedFilename = res.body.logoUrl?.split('/').pop();

          expect(res.status).toBe(201);

          // Wait one tick for the awaited cleanup helper.
          await new Promise((resolve) => setImmediate(resolve));

          expect(mockRemove).toHaveBeenCalledTimes(1);
          expect(mockRemove).toHaveBeenCalledWith([
            `company-logos/${companyId}/company-logo-${companyId}-oldfile.png`,
          ]);
        } finally {
          if (uploadedFilename) {
            fs.rmSync(path.join(companyLogoUploadDir, uploadedFilename), { force: true });
          }
        }
      });

      it('does not call Supabase remove when the previous logo is a local /uploads path', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: '/uploads/company-logos/local-noop.png' },
        });

        let uploadedFilename: string | undefined;
        try {
          const res = await request(app)
            .post('/api/company/logo')
            .set('Authorization', `Bearer ${authToken}`)
            .attach('logo', tinyPngBytes, {
              filename: 'replacement.png',
              contentType: 'image/png',
            });

          uploadedFilename = res.body.logoUrl?.split('/').pop();
          expect(res.status).toBe(201);
          expect(mockRemove).not.toHaveBeenCalled();
        } finally {
          if (uploadedFilename) {
            fs.rmSync(path.join(companyLogoUploadDir, uploadedFilename), { force: true });
          }
        }
      });

      it('accepts Supabase public URLs as logoUrl in PATCH /api/company', async () => {
        // Sanity check that normalizeCompanyLogoUrl admits Supabase URLs.
        const supabaseLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/${companyId}/company-logo-${companyId}-newfile.png`;
        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: supabaseLogoUrl });

        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBe(supabaseLogoUrl);
      });

      it('rejects Supabase logo URLs outside the current company prefix in PATCH /api/company', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        mockIsSupabaseConfigured.mockReturnValue(true);

        const supabaseLogoUrl =
          'https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/other-company/company-logo-other-company.png';
        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: supabaseLogoUrl });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('uploaded company logo');
      });

      it('PATCH clearing logoUrl removes the previous Supabase object', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        const previousSupabasePath = `company-logos/${companyId}/company-logo-${companyId}-prev-clear.png`;
        const previousLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/${previousSupabasePath}`;
        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: previousLogoUrl },
        });

        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: '' });

        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBeNull();

        // Wait one tick for the awaited best-effort cleanup.
        await new Promise((resolve) => setImmediate(resolve));

        expect(mockRemove).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledWith([previousSupabasePath]);
      });

      it('PATCH clearing logoUrl does not remove a Supabase object outside the current company prefix', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        const previousLogoUrl =
          'https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/other-company/company-logo-other-company-prev.png';
        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: previousLogoUrl },
        });

        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: '' });

        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBeNull();

        await new Promise((resolve) => setImmediate(resolve));

        expect(mockRemove).not.toHaveBeenCalled();
      });

      it('PATCH replacing logoUrl removes the previous Supabase object', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        const previousSupabasePath = `company-logos/${companyId}/company-logo-${companyId}-prev-replace.png`;
        const previousLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/${previousSupabasePath}`;
        const newLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/${companyId}/company-logo-${companyId}-new-replace.png`;
        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: previousLogoUrl },
        });

        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: newLogoUrl });

        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBe(newLogoUrl);

        await new Promise((resolve) => setImmediate(resolve));

        expect(mockRemove).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledWith([previousSupabasePath]);
      });

      it('PATCH does not call Supabase remove when the previous logoUrl is a local /uploads path', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: '/uploads/company-logos/local-prev.png' },
        });

        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: '' });

        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBeNull();
        expect(mockRemove).not.toHaveBeenCalled();
      });

      it('PATCH still returns 200 when Supabase cleanup throws (best-effort cleanup)', async () => {
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        mockIsSupabaseConfigured.mockReturnValue(true);
        // Simulate Supabase being unreachable at delete time. The PATCH must
        // still succeed because the DB row is the source of truth and cleanup
        // is best-effort.
        mockGetSupabaseClient.mockImplementation(() => {
          throw new Error('simulated Supabase outage');
        });

        const previousLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/${companyId}/company-logo-${companyId}-prev-throw.png`;
        const newLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/${companyId}/company-logo-${companyId}-new-throw.png`;
        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: previousLogoUrl },
        });

        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: newLogoUrl });

        // Response must succeed and DB must be updated even though
        // best-effort cleanup blew up.
        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBe(newLogoUrl);

        const persisted = await prisma.company.findUnique({
          where: { id: companyId },
          select: { logoUrl: true },
        });
        expect(persisted?.logoUrl).toBe(newLogoUrl);
      });

      it('PATCH replacing logoUrl with the same Supabase object plus a query string does not remove it', async () => {
        // Two URLs that resolve to the same Supabase storage path but differ
        // in querystring (cache-buster, signed-URL variant, etc.). The raw
        // string comparison would mark them as different and trigger a
        // destructive cleanup; the path-aware comparison must recognise them
        // as the same object and skip the remove call.
        process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
        const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
        mockIsSupabaseConfigured.mockReturnValue(true);
        mockGetSupabaseClient.mockReturnValue({
          storage: { from: () => ({ remove: mockRemove }) },
        } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

        const sharedSupabasePath = `company-logos/${companyId}/company-logo-${companyId}-querystring.png`;
        const previousLogoUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/${sharedSupabasePath}`;
        const newLogoUrl = `${previousLogoUrl}?v=2`;

        await prisma.company.update({
          where: { id: companyId },
          data: { logoUrl: previousLogoUrl },
        });

        const res = await request(app)
          .patch('/api/company')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ logoUrl: newLogoUrl });

        expect(res.status).toBe(200);
        expect(res.body.company.logoUrl).toBe(newLogoUrl);

        // Give any awaited cleanup a tick to run before asserting.
        await new Promise((resolve) => setImmediate(resolve));

        expect(mockRemove).not.toHaveBeenCalled();

        const persisted = await prisma.company.findUnique({
          where: { id: companyId },
          select: { logoUrl: true },
        });
        expect(persisted?.logoUrl).toBe(newLogoUrl);
      });
    });
  });

  describe('GET /api/company/members', () => {
    let memberId: string;
    let memberEmail: string;

    beforeAll(async () => {
      // Create a member user
      memberEmail = `member-list-${Date.now()}@example.com`;
      const memberRes = await request(app).post('/api/auth/register').send({
        email: memberEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Member List User',
        tosAccepted: true,
      });
      memberId = memberRes.body.user.id;

      await prisma.user.update({
        where: { id: memberId },
        data: { companyId, roleInCompany: 'admin' },
      });
    });

    afterAll(async () => {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: memberId } });
      await prisma.user.delete({ where: { id: memberId } }).catch(() => {});
    });

    it('should list all company members for owner', async () => {
      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.members).toBeDefined();
      expect(Array.isArray(res.body.members)).toBe(true);
      expect(res.body.members.length).toBeGreaterThanOrEqual(2); // owner + member
    });

    it('should include member details', async () => {
      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const member = res.body.members.find((m: any) => m.email === memberEmail);
      expect(member).toBeDefined();
      expect(member.id).toBeDefined();
      expect(member.fullName).toBe('Member List User');
      expect(member.roleInCompany).toBe('admin');
    });

    it('should sort members by full name', async () => {
      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const names = res.body.members.map((m: any) => m.fullName);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should reject field users', async () => {
      const fieldEmail = `field-list-${Date.now()}@example.com`;
      const fieldRes = await request(app).post('/api/auth/register').send({
        email: fieldEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Field User',
        tosAccepted: true,
      });

      await prisma.user.update({
        where: { id: fieldRes.body.user.id },
        data: { companyId, roleInCompany: 'foreman' },
      });

      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${fieldRes.body.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only company owners and admins');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: fieldRes.body.user.id } });
      await prisma.user.delete({ where: { id: fieldRes.body.user.id } });
    });

    it('should require authentication', async () => {
      const res = await request(app).get('/api/company/members');

      expect(res.status).toBe(401);
    });

    it('should return 404 if user has no company', async () => {
      // Create a user without company
      const noCompanyEmail = `no-company-members-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: noCompanyEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Company User',
        tosAccepted: true,
      });

      // Make them owner (for permission check)
      await prisma.user.update({
        where: { id: regRes.body.user.id },
        data: { roleInCompany: 'owner' },
      });

      const res = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } });
      await prisma.user.delete({ where: { id: regRes.body.user.id } });
    });
  });

  describe('POST /api/company/members/invite', () => {
    const invitedUserIds: string[] = [];
    const invitedCompanyIds: string[] = [];

    afterEach(async () => {
      if (invitedUserIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: {
            OR: [{ userId: { in: invitedUserIds } }, { entityId: { in: invitedUserIds } }],
          },
        });
        await prisma.passwordResetToken.deleteMany({ where: { userId: { in: invitedUserIds } } });
        await prisma.emailVerificationToken.deleteMany({
          where: { userId: { in: invitedUserIds } },
        });
        await prisma.projectUser.deleteMany({ where: { userId: { in: invitedUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: invitedUserIds } } });
        invitedUserIds.length = 0;
      }

      if (invitedCompanyIds.length > 0) {
        await prisma.company.deleteMany({ where: { id: { in: invitedCompanyIds } } });
        invitedCompanyIds.length = 0;
      }
    });

    it('creates a pending company member and one-time setup token', async () => {
      const email = `company-invite-${Date.now()}@example.com`;

      const res = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email,
          fullName: 'Pending Company Member',
          roleInCompany: 'foreman',
        });

      expect(res.status).toBe(201);
      expect(res.body.member).toMatchObject({
        email,
        fullName: 'Pending Company Member',
        roleInCompany: 'foreman',
        status: 'pending',
        hasPassword: false,
      });
      expect(JSON.stringify(res.body)).not.toContain('token=');

      invitedUserIds.push(res.body.member.id);

      const invitedUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          companyId: true,
          roleInCompany: true,
          passwordHash: true,
          emailVerified: true,
        },
      });
      expect(invitedUser).toMatchObject({
        id: res.body.member.id,
        companyId,
        roleInCompany: 'foreman',
        passwordHash: null,
        emailVerified: true,
      });

      const setupTokens = await prisma.passwordResetToken.findMany({
        where: { userId: res.body.member.id, usedAt: null },
      });
      expect(setupTokens).toHaveLength(1);
      expect(setupTokens[0].token).toMatch(/^sha256:/);
    });

    it('includes pending members in the company member list', async () => {
      const email = `company-invite-list-${Date.now()}@example.com`;
      const inviteRes = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email,
          fullName: 'Pending Listed Member',
          roleInCompany: 'site_engineer',
        });
      expect(inviteRes.status).toBe(201);
      invitedUserIds.push(inviteRes.body.member.id);

      const listRes = await request(app)
        .get('/api/company/members')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      const member = listRes.body.members.find((m: any) => m.email === email);
      expect(member).toMatchObject({
        id: inviteRes.body.member.id,
        email,
        fullName: 'Pending Listed Member',
        roleInCompany: 'site_engineer',
        status: 'pending',
        hasPassword: false,
      });
    });

    it('lets admins invite company members but rejects field users', async () => {
      const adminEmail = `company-invite-admin-${Date.now()}@example.com`;
      const adminRes = await request(app).post('/api/auth/register').send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Company Invite Admin',
        tosAccepted: true,
      });
      invitedUserIds.push(adminRes.body.user.id);

      await prisma.user.update({
        where: { id: adminRes.body.user.id },
        data: { companyId, roleInCompany: 'admin' },
      });

      const invitedEmail = `company-invite-by-admin-${Date.now()}@example.com`;
      const adminInviteRes = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${adminRes.body.token}`)
        .send({ email: invitedEmail, roleInCompany: 'project_manager' });
      expect(adminInviteRes.status).toBe(201);
      invitedUserIds.push(adminInviteRes.body.member.id);

      const fieldEmail = `company-invite-field-${Date.now()}@example.com`;
      const fieldRes = await request(app).post('/api/auth/register').send({
        email: fieldEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Company Invite Field',
        tosAccepted: true,
      });
      invitedUserIds.push(fieldRes.body.user.id);

      await prisma.user.update({
        where: { id: fieldRes.body.user.id },
        data: { companyId, roleInCompany: 'foreman' },
      });

      const rejectedRes = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${fieldRes.body.token}`)
        .send({
          email: `company-invite-rejected-${Date.now()}@example.com`,
          roleInCompany: 'foreman',
        });

      expect(rejectedRes.status).toBe(403);
      expect(rejectedRes.body.error.message).toContain('Only company owners and admins');
    });

    it('rejects owner and subcontractor roles for company member invitations', async () => {
      for (const roleInCompany of ['owner', 'subcontractor', 'subcontractor_admin']) {
        const res = await request(app)
          .post('/api/company/members/invite')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: `company-invite-${roleInCompany}-${Date.now()}@example.com`,
            roleInCompany,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Company member role is not supported');
      }
    });

    it('rejects users who already belong to a different company', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Other Invite Company ${Date.now()}` },
      });
      invitedCompanyIds.push(otherCompany.id);

      const otherEmail = `company-invite-other-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Company User',
        tosAccepted: true,
      });
      invitedUserIds.push(otherRes.body.user.id);

      await prisma.user.update({
        where: { id: otherRes.body.user.id },
        data: { companyId: otherCompany.id, roleInCompany: 'admin' },
      });

      const res = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: otherEmail, roleInCompany: 'foreman' });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('already belongs to another company');
    });

    it('rejects new company member invites that exceed the subscription seat limit', async () => {
      const limitedCompany = await prisma.company.create({
        data: {
          name: `Seat Limited Company ${Date.now()}`,
          subscriptionTier: 'basic',
        },
      });
      invitedCompanyIds.push(limitedCompany.id);

      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `seat-limit-owner-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Seat Limit Owner',
          tosAccepted: true,
        });
      invitedUserIds.push(ownerRes.body.user.id);

      await prisma.user.update({
        where: { id: ownerRes.body.user.id },
        data: { companyId: limitedCompany.id, roleInCompany: 'owner' },
      });

      for (let index = 0; index < 4; index += 1) {
        const member = await prisma.user.create({
          data: {
            email: `seat-limit-member-${Date.now()}-${index}@example.com`,
            fullName: `Seat Limit Member ${index}`,
            companyId: limitedCompany.id,
            roleInCompany: 'foreman',
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        invitedUserIds.push(member.id);
      }

      const overLimitEmail = `seat-limit-over-${Date.now()}@example.com`;
      const res = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${ownerRes.body.token}`)
        .send({ email: overLimitEmail, roleInCompany: 'site_engineer' });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('basic subscription allows up to 5 users');
      await expect(prisma.user.findUnique({ where: { email: overLimitEmail } })).resolves.toBe(
        null,
      );
    });

    it('allows updating an existing company member at the subscription seat limit', async () => {
      const limitedCompany = await prisma.company.create({
        data: {
          name: `Seat Limit Existing Member Company ${Date.now()}`,
          subscriptionTier: 'basic',
        },
      });
      invitedCompanyIds.push(limitedCompany.id);

      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `seat-existing-owner-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Seat Existing Owner',
          tosAccepted: true,
        });
      invitedUserIds.push(ownerRes.body.user.id);

      await prisma.user.update({
        where: { id: ownerRes.body.user.id },
        data: { companyId: limitedCompany.id, roleInCompany: 'owner' },
      });

      const existingMember = await prisma.user.create({
        data: {
          email: `seat-existing-member-${Date.now()}@example.com`,
          fullName: 'Seat Existing Member',
          companyId: limitedCompany.id,
          roleInCompany: 'foreman',
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
      invitedUserIds.push(existingMember.id);

      for (let index = 0; index < 3; index += 1) {
        const member = await prisma.user.create({
          data: {
            email: `seat-existing-fill-${Date.now()}-${index}@example.com`,
            fullName: `Seat Existing Fill ${index}`,
            companyId: limitedCompany.id,
            roleInCompany: 'foreman',
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        invitedUserIds.push(member.id);
      }

      const res = await request(app)
        .post('/api/company/members/invite')
        .set('Authorization', `Bearer ${ownerRes.body.token}`)
        .send({ email: existingMember.email, roleInCompany: 'site_engineer' });

      expect(res.status).toBe(201);
      expect(res.body.member.id).toBe(existingMember.id);
      expect(res.body.member.roleInCompany).toBe('site_engineer');
      await expect(prisma.user.count({ where: { companyId: limitedCompany.id } })).resolves.toBe(5);
    });

    it('serializes concurrent member invites against the subscription seat limit', async () => {
      const limitedCompany = await prisma.company.create({
        data: {
          name: `Concurrent Seat Limited Company ${Date.now()}`,
          subscriptionTier: 'basic',
        },
      });
      invitedCompanyIds.push(limitedCompany.id);

      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `seat-race-owner-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Seat Race Owner',
          tosAccepted: true,
        });
      invitedUserIds.push(ownerRes.body.user.id);

      await prisma.user.update({
        where: { id: ownerRes.body.user.id },
        data: { companyId: limitedCompany.id, roleInCompany: 'owner' },
      });

      for (let index = 0; index < 3; index += 1) {
        const member = await prisma.user.create({
          data: {
            email: `seat-race-member-${Date.now()}-${index}@example.com`,
            fullName: `Seat Race Member ${index}`,
            companyId: limitedCompany.id,
            roleInCompany: 'foreman',
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        invitedUserIds.push(member.id);
      }

      const inviteEmails = [
        `seat-race-a-${Date.now()}@example.com`,
        `seat-race-b-${Date.now()}@example.com`,
      ];

      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION test_delay_company_member_invite_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_delay_company_member_invite_insert_trigger ON users
      `;
      await prisma.$executeRaw`
        CREATE TRIGGER test_delay_company_member_invite_insert_trigger
        BEFORE INSERT ON users
        FOR EACH ROW
        EXECUTE FUNCTION test_delay_company_member_invite_insert();
      `;

      try {
        const responses = await Promise.all(
          inviteEmails.map((email) =>
            request(app)
              .post('/api/company/members/invite')
              .set('Authorization', `Bearer ${ownerRes.body.token}`)
              .send({ email, roleInCompany: 'site_engineer' }),
          ),
        );

        const createdInvitees = await prisma.user.findMany({
          where: { email: { in: inviteEmails } },
          select: { id: true },
        });
        invitedUserIds.push(...createdInvitees.map((invitee) => invitee.id));

        expect(responses.map((res) => res.status).sort((a, b) => a - b)).toEqual([201, 403]);
        expect(createdInvitees).toHaveLength(1);
        await expect(prisma.user.count({ where: { companyId: limitedCompany.id } })).resolves.toBe(
          5,
        );
      } finally {
        await prisma.$executeRaw`
          DROP TRIGGER IF EXISTS test_delay_company_member_invite_insert_trigger ON users
        `;
        await prisma.$executeRaw`
          DROP FUNCTION IF EXISTS test_delay_company_member_invite_insert()
        `;
      }
    });
  });

  describe('POST /api/company/transfer-ownership', () => {
    let oldOwnerId: string;
    let newOwnerId: string;
    let newOwnerToken: string;
    let transferCompanyId: string;

    beforeAll(async () => {
      // Create a separate company for transfer tests
      const company = await prisma.company.create({
        data: { name: `Transfer Test Company ${Date.now()}` },
      });
      transferCompanyId = company.id;

      // Create owner
      const ownerEmail = `transfer-owner-${Date.now()}@example.com`;
      const ownerRes = await request(app).post('/api/auth/register').send({
        email: ownerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Transfer Owner',
        tosAccepted: true,
      });
      oldOwnerId = ownerRes.body.user.id;

      await prisma.user.update({
        where: { id: oldOwnerId },
        data: { companyId: transferCompanyId, roleInCompany: 'owner' },
      });

      // Create new owner candidate
      const newOwnerEmail = `new-owner-${Date.now()}@example.com`;
      const newOwnerRes = await request(app).post('/api/auth/register').send({
        email: newOwnerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'New Owner',
        tosAccepted: true,
      });
      newOwnerId = newOwnerRes.body.user.id;
      newOwnerToken = ownerRes.body.token;

      await prisma.user.update({
        where: { id: newOwnerId },
        data: { companyId: transferCompanyId, roleInCompany: 'admin' },
      });
    });

    afterAll(async () => {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ entityId: transferCompanyId }, { userId: oldOwnerId }, { userId: newOwnerId }],
        },
      });
      // Cleanup users
      const users = await prisma.user.findMany({
        where: { companyId: transferCompanyId },
      });
      for (const user of users) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
      await prisma.company.delete({ where: { id: transferCompanyId } }).catch(() => {});
    });

    it('should transfer ownership to another member', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${newOwnerToken}`)
        .send({ newOwnerId });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('transferred successfully');
      expect(res.body.newOwner.id).toBe(newOwnerId);
      expect(res.body.transferredAt).toBeDefined();

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId: oldOwnerId,
          entityType: 'company',
          entityId: transferCompanyId,
          action: 'company_ownership_transferred',
        },
      });
      expect(auditLog).not.toBeNull();

      const changes = parseAuditLogChanges(auditLog?.changes ?? null) as Record<string, unknown>;
      expect(changes).toMatchObject({
        previousOwnerId: oldOwnerId,
        newOwnerId,
        previousOwnerRole: { from: 'owner', to: 'admin' },
        newOwnerRole: { from: 'admin', to: 'owner' },
      });
    });

    it('should update roles correctly after transfer', async () => {
      // Verify new owner has owner role
      const newOwner = await prisma.user.findUnique({
        where: { id: newOwnerId },
      });
      expect(newOwner?.roleInCompany).toBe('owner');

      // Verify old owner is now admin
      const admins = await prisma.user.findMany({
        where: {
          companyId: transferCompanyId,
          roleInCompany: 'admin',
        },
      });
      expect(admins.length).toBeGreaterThan(0);
    });

    it('should reject transfer without newOwnerId', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('New owner ID is required');
    });

    it('should reject malformed transfer target ids', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newOwnerId: { id: newOwnerId } });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('New owner ID');
    });

    it('should reject transfer to self', async () => {
      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newOwnerId: userId });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Cannot transfer ownership to yourself');
    });

    it('should reject transfer to non-member', async () => {
      // Create user in different company
      const otherEmail = `other-company-${Date.now()}@example.com`;
      const otherRes = await request(app).post('/api/auth/register').send({
        email: otherEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Company User',
        tosAccepted: true,
      });

      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newOwnerId: otherRes.body.user.id });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherRes.body.user.id } });
      await prisma.user.delete({ where: { id: otherRes.body.user.id } });
    });

    it('should reject non-owner users', async () => {
      // Create admin user
      const adminEmail = `admin-transfer-${Date.now()}@example.com`;
      const adminRes = await request(app).post('/api/auth/register').send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Admin User',
        tosAccepted: true,
      });

      await prisma.user.update({
        where: { id: adminRes.body.user.id },
        data: { companyId, roleInCompany: 'admin' },
      });

      const res = await request(app)
        .post('/api/company/transfer-ownership')
        .set('Authorization', `Bearer ${adminRes.body.token}`)
        .send({ newOwnerId: userId });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only the company owner');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: adminRes.body.user.id } });
      await prisma.user.delete({ where: { id: adminRes.body.user.id } });
    });

    it('should reject ownership transfer with an owner write-scoped API key', async () => {
      const suffix = Date.now();
      const apiKeyCompany = await prisma.company.create({
        data: { name: `Transfer API Key Company ${suffix}` },
      });
      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `transfer-api-owner-${suffix}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Transfer API Owner',
          tosAccepted: true,
        });
      const targetRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `transfer-api-target-${suffix}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Transfer API Target',
          tosAccepted: true,
        });
      const ownerId = ownerRes.body.user.id;
      const targetId = targetRes.body.user.id;

      try {
        await prisma.user.update({
          where: { id: ownerId },
          data: { companyId: apiKeyCompany.id, roleInCompany: 'owner' },
        });
        await prisma.user.update({
          where: { id: targetId },
          data: { companyId: apiKeyCompany.id, roleInCompany: 'admin' },
        });

        const apiKeyRes = await request(app)
          .post('/api/api-keys')
          .set('Authorization', `Bearer ${ownerRes.body.token}`)
          .send({
            name: 'Transfer Write Key',
            scopes: 'write',
          });
        expect(apiKeyRes.status).toBe(201);

        const res = await request(app)
          .post('/api/company/transfer-ownership')
          .set('Authorization', `ApiKey ${apiKeyRes.body.apiKey.key}`)
          .send({ newOwnerId: targetId });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('browser session');

        const [owner, target] = await Promise.all([
          prisma.user.findUniqueOrThrow({ where: { id: ownerId } }),
          prisma.user.findUniqueOrThrow({ where: { id: targetId } }),
        ]);
        expect(owner.roleInCompany).toBe('owner');
        expect(target.roleInCompany).toBe('admin');
      } finally {
        await prisma.apiKey.deleteMany({ where: { userId: ownerId } });
        await prisma.emailVerificationToken.deleteMany({
          where: { userId: { in: [ownerId, targetId] } },
        });
        await prisma.user.deleteMany({ where: { id: { in: [ownerId, targetId] } } });
        await prisma.company.delete({ where: { id: apiKeyCompany.id } }).catch(() => {});
      }
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/company/transfer-ownership').send({ newOwnerId });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/company/leave', () => {
    let leaveCompanyId: string;
    let leaveOwnerId: string;
    let leaveUserId: string;
    let leaveUserToken: string;
    let projectId: string;

    beforeAll(async () => {
      // Create company
      const company = await prisma.company.create({
        data: { name: `Leave Test Company ${Date.now()}` },
      });
      leaveCompanyId = company.id;

      // Create owner (can't leave)
      const ownerEmail = `leave-owner-${Date.now()}@example.com`;
      const ownerRes = await request(app).post('/api/auth/register').send({
        email: ownerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Leave Owner',
        tosAccepted: true,
      });
      leaveOwnerId = ownerRes.body.user.id;

      await prisma.user.update({
        where: { id: leaveOwnerId },
        data: { companyId: leaveCompanyId, roleInCompany: 'owner' },
      });

      // Create member (can leave)
      const memberEmail = `leave-member-${Date.now()}@example.com`;
      const memberRes = await request(app).post('/api/auth/register').send({
        email: memberEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Leave Member',
        tosAccepted: true,
      });
      leaveUserId = memberRes.body.user.id;
      leaveUserToken = memberRes.body.token;

      await prisma.user.update({
        where: { id: leaveUserId },
        data: { companyId: leaveCompanyId, roleInCompany: 'admin' },
      });

      // Create a project with the member
      const project = await prisma.project.create({
        data: {
          name: `Leave Test Project ${Date.now()}`,
          projectNumber: `LEAVE-${Date.now()}`,
          companyId: leaveCompanyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      projectId = project.id;

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: leaveUserId,
          role: 'admin',
          status: 'active',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: leaveOwnerId,
          role: 'admin',
          status: 'active',
        },
      });
    });

    afterAll(async () => {
      // Cleanup
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ entityId: leaveCompanyId }, { userId: leaveOwnerId }, { userId: leaveUserId }],
        },
      });
      await prisma.projectUser.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

      const users = await prisma.user.findMany({
        where: { OR: [{ companyId: leaveCompanyId }, { id: leaveUserId }] },
      });
      for (const user of users) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
      await prisma.company.delete({ where: { id: leaveCompanyId } }).catch(() => {});
    });

    it('should allow non-owner to leave company', async () => {
      const res = await request(app)
        .post('/api/company/leave')
        .set('Authorization', `Bearer ${leaveUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Successfully left');
      expect(res.body.leftAt).toBeDefined();

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId: leaveUserId,
          entityType: 'company',
          entityId: leaveCompanyId,
          action: 'company_member_left',
        },
      });
      expect(auditLog).not.toBeNull();

      const changes = parseAuditLogChanges(auditLog?.changes ?? null) as Record<string, unknown>;
      expect(changes).toMatchObject({
        memberUserId: leaveUserId,
        previousRole: 'admin',
        removedProjectMembershipCount: 1,
      });
    });

    it('should remove company association from user', async () => {
      const user = await prisma.user.findUnique({
        where: { id: leaveUserId },
      });
      expect(user?.companyId).toBeNull();
      expect(user?.roleInCompany).toBe('member'); // Reset to default
    });

    it('should remove user from all company projects', async () => {
      const projectUsers = await prisma.projectUser.findMany({
        where: {
          userId: leaveUserId,
          projectId,
        },
      });
      expect(projectUsers.length).toBe(0);
    });

    it('should reject owner leaving', async () => {
      const res = await request(app)
        .post('/api/company/leave')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('owners cannot leave');
      expect(res.body.error.message).toContain('transfer ownership');
    });

    it('should reject leaving when user is the sole active project admin', async () => {
      const soleCompany = await prisma.company.create({
        data: { name: `Sole Leave Company ${Date.now()}` },
      });
      const ownerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `sole-leave-owner-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Sole Leave Owner',
          tosAccepted: true,
        });
      const soleAdminRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `sole-leave-admin-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Sole Leave Admin',
          tosAccepted: true,
        });
      const soleOwnerId = ownerRes.body.user.id;
      const soleAdminId = soleAdminRes.body.user.id;
      let soleProjectId: string | undefined;

      try {
        await prisma.user.update({
          where: { id: soleOwnerId },
          data: { companyId: soleCompany.id, roleInCompany: 'owner' },
        });
        await prisma.user.update({
          where: { id: soleAdminId },
          data: { companyId: soleCompany.id, roleInCompany: 'admin' },
        });
        const project = await prisma.project.create({
          data: {
            name: `Sole Leave Project ${Date.now()}`,
            projectNumber: `SOLE-LEAVE-${Date.now()}`,
            companyId: soleCompany.id,
            status: 'active',
            state: 'NSW',
            specificationSet: 'TfNSW',
          },
        });
        soleProjectId = project.id;
        await prisma.projectUser.create({
          data: {
            projectId: soleProjectId,
            userId: soleAdminId,
            role: 'admin',
            status: 'active',
          },
        });

        const res = await request(app)
          .post('/api/company/leave')
          .set('Authorization', `Bearer ${soleAdminRes.body.token}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('only active project admin or project manager');
      } finally {
        if (soleProjectId) {
          await prisma.projectUser.deleteMany({ where: { projectId: soleProjectId } });
          await prisma.project.delete({ where: { id: soleProjectId } }).catch(() => {});
        }
        for (const tempUserId of [soleOwnerId, soleAdminId]) {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
          await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
        }
        await prisma.company.delete({ where: { id: soleCompany.id } }).catch(() => {});
      }
    });

    it('should keep one active project admin when two admins leave concurrently', async () => {
      const raceCompany = await prisma.company.create({
        data: { name: `Concurrent Leave Company ${Date.now()}` },
      });
      const firstAdminRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `leave-race-admin-a-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Leave Race Admin A',
          tosAccepted: true,
        });
      const secondAdminRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `leave-race-admin-b-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Leave Race Admin B',
          tosAccepted: true,
        });
      const firstAdminId = firstAdminRes.body.user.id as string;
      const secondAdminId = secondAdminRes.body.user.id as string;
      let raceProjectId: string | undefined;
      let middlewareActive = true;
      let matchingAdminCounts = 0;
      let firstCountReached: () => void = () => {};
      let secondCountFinished: () => void = () => {};
      let releaseFirstCount: () => void = () => {};
      const firstCountStarted = new Promise<void>((resolve) => {
        firstCountReached = resolve;
      });
      const secondCountDone = new Promise<void>((resolve) => {
        secondCountFinished = resolve;
      });
      const releaseFirst = new Promise<void>((resolve) => {
        releaseFirstCount = resolve;
      });

      try {
        await prisma.user.updateMany({
          where: { id: { in: [firstAdminId, secondAdminId] } },
          data: { companyId: raceCompany.id, roleInCompany: 'admin' },
        });
        const project = await prisma.project.create({
          data: {
            name: `Concurrent Leave Project ${Date.now()}`,
            projectNumber: `LEAVE-RACE-${Date.now()}`,
            companyId: raceCompany.id,
            status: 'active',
            state: 'NSW',
            specificationSet: 'TfNSW',
          },
        });
        raceProjectId = project.id;
        await prisma.projectUser.createMany({
          data: [
            { projectId: raceProjectId, userId: firstAdminId, role: 'admin', status: 'active' },
            { projectId: raceProjectId, userId: secondAdminId, role: 'admin', status: 'active' },
          ],
        });

        prisma.$use(async (params, next) => {
          const result = await next(params);
          const where = JSON.stringify(params.args?.where ?? {});

          if (
            middlewareActive &&
            params.model === 'ProjectUser' &&
            params.action === 'groupBy' &&
            where.includes(raceProjectId!)
          ) {
            matchingAdminCounts += 1;

            if (matchingAdminCounts === 1) {
              firstCountReached();
              await releaseFirst;
              return result;
            }

            secondCountFinished();
          }

          return result;
        });

        const firstLeave = request(app)
          .post('/api/company/leave')
          .set('Authorization', `Bearer ${firstAdminRes.body.token}`)
          .then((res) => res);

        await firstCountStarted;

        const secondLeave = request(app)
          .post('/api/company/leave')
          .set('Authorization', `Bearer ${secondAdminRes.body.token}`)
          .then((res) => res);

        await Promise.race([
          secondCountDone,
          new Promise<void>((resolve) => setTimeout(resolve, 2000)),
        ]);
        releaseFirstCount();

        const responses = await Promise.all([firstLeave, secondLeave]);
        expect(responses.map((res) => res.status).sort()).toEqual([200, 400]);

        const activeAdminCount = await prisma.projectUser.count({
          where: {
            projectId: raceProjectId,
            status: 'active',
            role: { in: ['admin', 'project_manager'] },
          },
        });
        expect(activeAdminCount).toBe(1);
      } finally {
        middlewareActive = false;
        releaseFirstCount();
        if (raceProjectId) {
          await prisma.projectUser.deleteMany({ where: { projectId: raceProjectId } });
          await prisma.project.delete({ where: { id: raceProjectId } }).catch(() => {});
        }
        for (const tempUserId of [firstAdminId, secondAdminId]) {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: tempUserId } });
          await prisma.user.delete({ where: { id: tempUserId } }).catch(() => {});
        }
        await prisma.company.delete({ where: { id: raceCompany.id } }).catch(() => {});
      }
    });

    it('should reject if user has no company', async () => {
      // Create user without company
      const noCompanyEmail = `no-company-leave-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: noCompanyEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Company User',
        tosAccepted: true,
      });

      const res = await request(app)
        .post('/api/company/leave')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not a member of any company');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: regRes.body.user.id } });
      await prisma.user.delete({ where: { id: regRes.body.user.id } });
    });

    it('should require authentication', async () => {
      const res = await request(app).post('/api/company/leave');

      expect(res.status).toBe(401);
    });
  });

  describe('Subscription Tier Limits', () => {
    it('should return correct limits for basic tier', async () => {
      // Create basic tier company
      const basicCompany = await prisma.company.create({
        data: {
          name: `Basic Tier ${Date.now()}`,
          subscriptionTier: 'basic',
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: basicCompany.id },
      });

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company.projectLimit).toBe(3);
      expect(res.body.company.userLimit).toBe(5);

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId },
      });
      await prisma.company.delete({ where: { id: basicCompany.id } });
    });

    it('should return correct limits for enterprise tier', async () => {
      // Create enterprise tier company
      const enterpriseCompany = await prisma.company.create({
        data: {
          name: `Enterprise Tier ${Date.now()}`,
          subscriptionTier: 'enterprise',
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: enterpriseCompany.id },
      });

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company.projectLimit).toBe(50);
      expect(res.body.company.userLimit).toBe(100);

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId },
      });
      await prisma.company.delete({ where: { id: enterpriseCompany.id } });
    });

    it('should return infinity for unlimited tier', async () => {
      // Create unlimited tier company
      const unlimitedCompany = await prisma.company.create({
        data: {
          name: `Unlimited Tier ${Date.now()}`,
          subscriptionTier: 'unlimited',
        },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: unlimitedCompany.id },
      });

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Unlimited plans use null limits in the JSON contract.
      expect(res.body.company.projectLimit).toBeNull();
      expect(res.body.company.userLimit).toBeNull();

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId },
      });
      await prisma.company.delete({ where: { id: unlimitedCompany.id } });
    });

    it('should default to basic tier if not set', async () => {
      // Create company without subscription tier
      const noTierCompany = await prisma.company.create({
        data: { name: `No Tier ${Date.now()}` },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { companyId: noTierCompany.id },
      });

      const res = await request(app)
        .get('/api/company')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.company.projectLimit).toBe(3); // basic default
      expect(res.body.company.userLimit).toBe(5); // basic default

      // Restore original company
      await prisma.user.update({
        where: { id: userId },
        data: { companyId },
      });
      await prisma.company.delete({ where: { id: noTierCompany.id } });
    });
  });
});

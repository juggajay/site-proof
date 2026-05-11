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
import { companyRouter } from './company.js';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);
const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
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
    const testEmail = `company-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Company Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    // Update user with company and owner role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'owner' },
    });
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
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
      expect(filename).toMatch(new RegExp(`^company-logo-${userId}-[0-9a-f-]{36}\\.png$`));
      expect(filename).not.toContain('.svg');
      expect(fs.existsSync(logoPath)).toBe(true);
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
      const beforeFiles = listCompanyLogoFiles(`company-logo-${userId}-`);

      const res = await request(app)
        .post('/api/company/logo')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('logo', Buffer.from('not really a png'), {
          filename: 'logo.png',
          contentType: 'image/png',
        });

      const afterFiles = listCompanyLogoFiles(`company-logo-${userId}-`);
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

    it('should reject non-owner users', async () => {
      // Create a non-owner user
      const adminEmail = `admin-list-${Date.now()}@example.com`;
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
        .get('/api/company/members')
        .set('Authorization', `Bearer ${adminRes.body.token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Only company owners');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: adminRes.body.user.id } });
      await prisma.user.delete({ where: { id: adminRes.body.user.id } });
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

  describe('POST /api/company/transfer-ownership', () => {
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

      await prisma.user.update({
        where: { id: ownerRes.body.user.id },
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

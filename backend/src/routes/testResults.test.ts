import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { AuditAction } from '../lib/auditLog.js';
import { registerTestUser as registerSharedTestUser } from '../test/routeTestHarness.js';

const mockSendNotificationIfEnabled = vi.hoisted(() =>
  vi.fn(async () => ({ sent: false, queued: false })),
);

vi.mock('./notifications.js', async () => {
  const actual = await vi.importActual<typeof import('./notifications.js')>('./notifications.js');
  return {
    ...actual,
    sendNotificationIfEnabled: mockSendNotificationIfEnabled,
  };
});

// Mock the supabase helpers so we can drive the testResult DELETE handler
// through both "local" (default) and "Supabase-stored" code paths. The real
// `isSupabaseConfigured()` returns false in tests (SUPABASE_URL is blanked
// by vitest.config.ts), and individual tests opt-in to the Supabase branch
// by overriding the mock returns.
vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    getSupabaseClient: vi.fn(),
  };
});

import * as supabaseLib from '../lib/supabase.js';

// Import test results router (after vi.mock so the router picks up the mocks)
import { testResultsRouter } from './testResults.js';

const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);
const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/test-results', testResultsRouter);
app.use(errorHandler);

const TEST_PASSWORD = 'SecureP@ssword123!';
const ORIGINAL_ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL;
const ORIGINAL_ANTHROPIC_TEST_CERT_MODEL = process.env.ANTHROPIC_TEST_CERT_MODEL;

const createdCertificatePaths: string[] = [];
const certificatesDir = path.join(process.cwd(), 'uploads', 'certificates');

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function trackCertificateFile(fileUrl: string | undefined) {
  if (!fileUrl) {
    return;
  }

  createdCertificatePaths.push(path.join(process.cwd(), fileUrl.replace(/^\/+/, '')));
}

async function trackCertificateDocumentFile(documentId: string | undefined) {
  if (!documentId) {
    return;
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { fileUrl: true },
  });
  trackCertificateFile(document?.fileUrl);
}

function hasUnsafeFilenameChar(filename: string): boolean {
  return filename.split('').some((char) => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char));
}

function findNewFilesWithContent(beforeFiles: Set<string>, content: Buffer): string[] {
  return fs
    .readdirSync(certificatesDir)
    .filter((file) => !beforeFiles.has(file))
    .filter((file) => fs.readFileSync(path.join(certificatesDir, file)).equals(content));
}

async function registerTestUser(fullName: string, roleInCompany: string, companyId: string | null) {
  const { token, userId } = await registerSharedTestUser(app, {
    fullName,
    roleInCompany,
    companyId,
    password: TEST_PASSWORD,
  });
  return { token, userId };
}

async function cleanupTestUser(userId: string) {
  await prisma.projectUser.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe('Test Results API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let testResultId: string;

  beforeAll(async () => {
    fs.mkdirSync(certificatesDir, { recursive: true });

    const company = await prisma.company.create({
      data: { name: `Test Results Company ${Date.now()}` },
    });
    companyId = company.id;

    const testEmail = `testresults-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: TEST_PASSWORD,
      fullName: 'Test Results User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Test Results Project ${Date.now()}`,
        projectNumber: `TR-${Date.now()}`,
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
        lotNumber: `TR-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;
  });

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});

    for (const certificatePath of createdCertificatePaths) {
      fs.rmSync(certificatePath, { force: true });
    }
  });

  afterEach(() => {
    restoreOptionalEnv('ANTHROPIC_API_KEY', ORIGINAL_ANTHROPIC_API_KEY);
    restoreOptionalEnv('ANTHROPIC_MODEL', ORIGINAL_ANTHROPIC_MODEL);
    restoreOptionalEnv('ANTHROPIC_TEST_CERT_MODEL', ORIGINAL_ANTHROPIC_TEST_CERT_MODEL);
    vi.restoreAllMocks();
    mockSendNotificationIfEnabled.mockReset();
    mockSendNotificationIfEnabled.mockResolvedValue({ sent: false, queued: false });
  });

  async function createEnteredTestResult() {
    return prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testType: `Rejectable Test ${Date.now()}`,
        status: 'entered',
        // Ticket T2: an 'entered' test now carries a real result value + a
        // definitive pass/fail outcome (the RESULT_REQUIRED gate). Seed both so
        // these rows reflect valid post-T2 state and stay verifiable.
        resultValue: 98.5,
        passFail: 'pass',
        enteredById: userId,
        enteredAt: new Date(),
      },
    });
  }

  describe('GET /api/test-results/specifications', () => {
    it('should get all test specifications', async () => {
      const res = await request(app)
        .get('/api/test-results/specifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.specifications).toBeDefined();
      expect(Array.isArray(res.body.specifications)).toBe(true);
    });
  });

  describe('GET /api/test-results/specifications/:testType', () => {
    it('should get specification for a specific test type', async () => {
      const res = await request(app)
        .get('/api/test-results/specifications/compaction')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.testType).toBe('compaction');
      expect(res.body.name).toBeDefined();
      expect(res.body.specificationMin).toBeDefined();
    });

    it('should return 404 for unknown test type', async () => {
      const res = await request(app)
        .get('/api/test-results/specifications/unknown_test_type')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should reject oversized test type route parameters', async () => {
      const res = await request(app)
        .get(`/api/test-results/specifications/${'t'.repeat(161)}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('testType is too long');
    });
  });

  describe('POST /api/test-results', () => {
    it('should create a new test result', async () => {
      const res = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotId,
          testType: 'Compaction Test',
          laboratoryName: 'ABC Testing Labs',
          sampleDate: new Date().toISOString().split('T')[0],
        });

      expect(res.status).toBe(201);
      expect(res.body.testResult).toBeDefined();
      expect(res.body.testResult.testType).toBe('Compaction Test');
      testResultId = res.body.testResult.id;
    });

    it('should accept decimal exponent values for numeric result fields', async () => {
      const res = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotId,
          testType: 'Compaction Test',
          resultValue: '9.5e1',
          specificationMin: '90',
          specificationMax: '100',
          passFail: 'pass',
        });

      expect(res.status).toBe(201);
      expect(res.body.testResult).toBeDefined();
    });

    it('recomputes pass/fail from the spec on manual create, overriding a contradictory client pass (H13)', async () => {
      const res = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotId,
          testType: 'H13 Create Backstop',
          resultValue: '80',
          specificationMin: '90',
          specificationMax: '100',
          passFail: 'pass',
        });

      expect(res.status).toBe(201);
      const createdId = res.body.testResult.id;
      try {
        const stored = await prisma.testResult.findUniqueOrThrow({
          where: { id: createdId },
          select: { passFail: true },
        });
        // 80 is below the minimum spec of 90, so the data overrides the client 'pass'.
        expect(stored.passFail).toBe('fail');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: createdId } });
      }
    });

    it('recomputes pass/fail from the spec on manual edit, overriding a contradictory client pass (H13)', async () => {
      const created = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `H13 Edit Backstop ${Date.now()}`,
          status: 'entered',
          resultValue: 98.5,
          specificationMin: 90,
          specificationMax: 100,
          passFail: 'pass',
          enteredById: userId,
          enteredAt: new Date(),
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/test-results/${created.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ resultValue: '80', passFail: 'pass' });

        expect(res.status).toBe(200);
        const stored = await prisma.testResult.findUniqueOrThrow({
          where: { id: created.id },
          select: { passFail: true },
        });
        // The new value 80 is below the stored minimum spec of 90.
        expect(stored.passFail).toBe('fail');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: created.id } });
      }
    });

    it('should keep company admin test result rights when project membership is lower', async () => {
      await prisma.projectUser.updateMany({
        where: { projectId, userId },
        data: { role: 'viewer' },
      });

      try {
        const res = await request(app)
          .post('/api/test-results')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            lotId,
            testType: 'Compaction Test',
            laboratoryName: 'Company Admin Lab',
          });

        expect(res.status).toBe(201);
        expect(res.body.testResult.testType).toBe('Compaction Test');
      } finally {
        await prisma.testResult.deleteMany({
          where: { projectId, laboratoryName: 'Company Admin Lab' },
        });
        await prisma.projectUser.updateMany({
          where: { projectId, userId },
          data: { role: 'admin' },
        });
      }
    });

    it('should not grant subcontractors creator rights through project memberships', async () => {
      const suffix = Date.now();
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Test Results Project Role Sub ${suffix}`,
          status: 'approved',
          portalAccess: { testResults: true },
        },
      });
      const subcontractor = await registerTestUser(
        'Test Results Project Role Sub',
        'subcontractor',
        null,
      );
      const testType = `Blocked Subcontractor Creator ${suffix}`;

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'admin',
        },
      });
      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId,
          subcontractorCompanyId: subcontractorCompany.id,
          status: 'active',
        },
      });
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: subcontractor.userId,
          role: 'project_manager',
          status: 'active',
        },
      });

      try {
        const res = await request(app)
          .post('/api/test-results')
          .set('Authorization', `Bearer ${subcontractor.token}`)
          .send({
            projectId,
            lotId,
            testType,
            laboratoryName: 'Blocked Subcontractor Creator Lab',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('create test results');
        await expect(prisma.testResult.count({ where: { projectId, testType } })).resolves.toBe(0);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subcontractor.userId);
      }
    });

    it('should reject test result without required fields', async () => {
      const res = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // missing testType
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid create values before writing test results', async () => {
      const invalidDateRes = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          testType: 'Compaction Test',
          sampleDate: '2024-02-31',
        });

      const invalidNumberRes = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          testType: 'Compaction Test',
          resultValue: '97abc',
        });

      const invalidHexNumberRes = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          testType: 'Compaction Test',
          resultValue: '0x10',
        });

      const invalidPassFailRes = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          testType: 'Compaction Test',
          passFail: 'maybe',
        });

      expect(invalidDateRes.status).toBe(400);
      expect(invalidDateRes.body.error.message).toContain('sampleDate');
      expect(invalidNumberRes.status).toBe(400);
      expect(invalidNumberRes.body.error.message).toContain('resultValue');
      expect(invalidHexNumberRes.status).toBe(400);
      expect(invalidHexNumberRes.body.error.message).toContain('resultValue');
      expect(invalidPassFailRes.status).toBe(400);
      expect(invalidPassFailRes.body.error.message).toContain('passFail');
    });
  });

  describe('POST /api/test-results/upload-certificate', () => {
    it('uses deterministic manual review fallback when Anthropic is not configured', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_TEST_CERT_MODEL;

      const res = await request(app)
        .post('/api/test-results/upload-certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('certificate', Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'), {
          filename: 'compaction-CH1234+50.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      await trackCertificateDocumentFile(res.body.testResult.certificateDoc?.id);

      expect(res.body.extraction.extractedFields.testType.value).toBe('Compaction Test');
      expect(res.body.extraction.extractedFields.sampleLocation.value).toBe('CH 1234+50');
      expect(res.body.extraction.confidence.testType).toBeLessThan(0.8);
      expect(res.body.extraction.needsReview).toBe(true);
      expect(res.body.lotSuggestion.extractedLocation).toBe('CH 1234+50');

      const savedTestResult = await prisma.testResult.findUniqueOrThrow({
        where: { id: res.body.testResult.id },
      });

      expect(savedTestResult.aiExtracted).toBe(true);
      expect(savedTestResult.passFail).toBe('pending');
      expect(savedTestResult.testType).toBe('Compaction Test');
      expect(savedTestResult.laboratoryName).toBeNull();
      expect(savedTestResult.laboratoryReportNumber).toBeNull();
      expect(savedTestResult.resultValue).toBeNull();
      expect(savedTestResult.specificationMin).toBeNull();
      expect(savedTestResult.specificationMax).toBeNull();

      const savedConfidence = JSON.parse(savedTestResult.aiConfidence || '{}') as Record<
        string,
        number
      >;
      expect(savedConfidence.testType).toBeLessThan(0.8);
    });

    it('persists fields extracted from Anthropic document analysis', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.ANTHROPIC_TEST_CERT_MODEL = 'claude-test-model';

      const extractedFields = {
        testType: { value: 'Compaction Test', confidence: 0.96 },
        laboratoryName: { value: 'Metro Materials Lab', confidence: 0.94 },
        laboratoryReportNumber: { value: 'LAB-2026-0042', confidence: 0.93 },
        sampleDate: { value: '2026-04-10', confidence: 0.91 },
        testDate: { value: '2026-04-12', confidence: 0.92 },
        resultValue: { value: '98.5', confidence: 0.95 },
        resultUnit: { value: '% MDD', confidence: 0.9 },
        specificationMin: { value: '95', confidence: 0.88 },
        specificationMax: { value: '100', confidence: 0.87 },
        sampleLocation: { value: 'CH 1000+25', confidence: 0.9 },
      };

      const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify(extractedFields),
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const res = await request(app)
        .post('/api/test-results/upload-certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('certificate', Buffer.from('%PDF-1.4\nmock certificate\n%%EOF'), {
          filename: 'metro-lab-report.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      await trackCertificateDocumentFile(res.body.testResult.certificateDoc?.id);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as {
        model: string;
        messages: Array<{
          content: Array<{ type: string; source?: { media_type?: string } }>;
        }>;
      };
      expect(requestBody.model).toBe('claude-test-model');
      expect(requestBody.messages[0].content[0].type).toBe('document');
      expect(requestBody.messages[0].content[0].source?.media_type).toBe('application/pdf');

      expect(res.body.extraction.needsReview).toBe(false);
      expect(res.body.testResult.testType).toBe('Compaction Test');

      const savedTestResult = await prisma.testResult.findUniqueOrThrow({
        where: { id: res.body.testResult.id },
      });

      expect(savedTestResult.testType).toBe('Compaction Test');
      expect(savedTestResult.laboratoryName).toBe('Metro Materials Lab');
      expect(savedTestResult.laboratoryReportNumber).toBe('LAB-2026-0042');
      expect(Number(savedTestResult.resultValue)).toBe(98.5);
      expect(savedTestResult.resultUnit).toBe('% MDD');
      expect(Number(savedTestResult.specificationMin)).toBe(95);
      expect(Number(savedTestResult.specificationMax)).toBe(100);
      expect(savedTestResult.sampleLocation).toBe('CH 1000+25');
      expect(savedTestResult.sampleDate?.toISOString()).toBe('2026-04-10T00:00:00.000Z');
      expect(savedTestResult.testDate?.toISOString()).toBe('2026-04-12T00:00:00.000Z');
      expect(savedTestResult.passFail).toBe('pass');

      const savedConfidence = JSON.parse(savedTestResult.aiConfidence || '{}') as Record<
        string,
        number
      >;
      expect(savedConfidence.laboratoryName).toBe(0.94);
      expect(savedConfidence.specificationMax).toBe(0.87);
    });

    it('drops invalid dates extracted from Anthropic document analysis', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
      process.env.ANTHROPIC_TEST_CERT_MODEL = 'claude-test-model';

      const extractedFields = {
        testType: { value: 'Compaction Test', confidence: 0.96 },
        laboratoryName: { value: 'Metro Materials Lab', confidence: 0.94 },
        laboratoryReportNumber: { value: 'LAB-2026-0043', confidence: 0.93 },
        sampleDate: { value: '2026-02-30', confidence: 0.91 },
        testDate: { value: '2026-02-30T10:00:00Z', confidence: 0.92 },
        resultValue: { value: '98.5', confidence: 0.95 },
        resultUnit: { value: '% MDD', confidence: 0.9 },
        specificationMin: { value: '95', confidence: 0.88 },
        specificationMax: { value: '100', confidence: 0.87 },
        sampleLocation: { value: 'CH 1000+25', confidence: 0.9 },
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              {
                type: 'text',
                text: JSON.stringify(extractedFields),
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      const res = await request(app)
        .post('/api/test-results/upload-certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('certificate', Buffer.from('%PDF-1.4\nmock certificate\n%%EOF'), {
          filename: 'metro-lab-invalid-date-report.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      await trackCertificateDocumentFile(res.body.testResult.certificateDoc?.id);

      const savedTestResult = await prisma.testResult.findUniqueOrThrow({
        where: { id: res.body.testResult.id },
      });

      expect(savedTestResult.sampleDate).toBeNull();
      expect(savedTestResult.testDate).toBeNull();
      expect(savedTestResult.testType).toBe('Compaction Test');
    });

    it('rejects certificates whose content does not match the declared file type', async () => {
      const filename = `spoofed-certificate-${Date.now()}.pdf`;
      const invalidCertificateBytes = Buffer.from('not a pdf');
      const beforeFiles = new Set(fs.readdirSync(certificatesDir));

      const res = await request(app)
        .post('/api/test-results/upload-certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('certificate', invalidCertificateBytes, {
          filename,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

      const createdDocument = await prisma.document.findFirst({
        where: { projectId, filename },
        select: { id: true },
      });
      const leakedFiles = fs
        .readdirSync(certificatesDir)
        .filter((file) => !beforeFiles.has(file))
        .filter((file) =>
          fs.readFileSync(path.join(certificatesDir, file)).equals(invalidCertificateBytes),
        );

      expect(createdDocument).toBeNull();
      expect(leakedFiles).toHaveLength(0);
    });

    it('cleans up uploaded certificate files when projectId is missing', async () => {
      const beforeFiles = new Set(fs.readdirSync(certificatesDir));
      const certificateBytes = Buffer.from(`%PDF-1.4\nmissing project ${Date.now()}\n%%EOF`);

      const res = await request(app)
        .post('/api/test-results/upload-certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('certificate', certificateBytes, {
          filename: 'missing-project.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('projectId');

      expect(findNewFilesWithContent(beforeFiles, certificateBytes)).toHaveLength(0);
    });

    it('sanitizes certificate document filenames before storing them', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_TEST_CERT_MODEL;

      const res = await request(app)
        .post('/api/test-results/upload-certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('certificate', Buffer.from('%PDF-1.4\nsafe filename\n%%EOF'), {
          filename: '../compaction:<unsafe>?-CH777+1.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      await trackCertificateDocumentFile(res.body.testResult.certificateDoc?.id);

      const certificateDoc = res.body.testResult.certificateDoc;
      expect(certificateDoc.filename).toMatch(/\.pdf$/);
      expect(hasUnsafeFilenameChar(certificateDoc.filename)).toBe(false);
      expect(certificateDoc.filename).not.toContain('..');
      expect(certificateDoc).not.toHaveProperty('fileUrl');

      const savedCertificateDoc = await prisma.document.findUniqueOrThrow({
        where: { id: certificateDoc.id },
        select: { fileUrl: true },
      });
      expect(hasUnsafeFilenameChar(path.basename(savedCertificateDoc.fileUrl))).toBe(false);
    });
  });

  describe('POST /api/test-results/batch-upload', () => {
    it('rejects batch certificates whose content does not match the declared file type', async () => {
      const filename = `spoofed-batch-certificate-${Date.now()}.pdf`;
      const invalidCertificateBytes = Buffer.from(`not a pdf ${filename}`);
      const beforeFiles = new Set(fs.readdirSync(certificatesDir));

      const res = await request(app)
        .post('/api/test-results/batch-upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('certificates', invalidCertificateBytes, {
          filename,
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

      const createdDocument = await prisma.document.findFirst({
        where: { projectId, filename },
        select: { id: true },
      });
      expect(createdDocument).toBeNull();
      expect(findNewFilesWithContent(beforeFiles, invalidCertificateBytes)).toHaveLength(0);
    });

    it('cleans up every uploaded batch file when projectId is missing', async () => {
      const beforeFiles = new Set(fs.readdirSync(certificatesDir));
      const firstCertificateBytes = Buffer.from(`%PDF-1.4\nbatch one ${Date.now()}\n%%EOF`);
      const secondCertificateBytes = Buffer.from(`%PDF-1.4\nbatch two ${Date.now()}\n%%EOF`);

      const res = await request(app)
        .post('/api/test-results/batch-upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('certificates', firstCertificateBytes, {
          filename: 'missing-project-one.pdf',
          contentType: 'application/pdf',
        })
        .attach('certificates', secondCertificateBytes, {
          filename: 'missing-project-two.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('projectId');

      expect(findNewFilesWithContent(beforeFiles, firstCertificateBytes)).toHaveLength(0);
      expect(findNewFilesWithContent(beforeFiles, secondCertificateBytes)).toHaveLength(0);
    });
  });

  describe('GET /api/test-results', () => {
    it('should list test results for project', async () => {
      const res = await request(app)
        .get(`/api/test-results?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.testResults).toBeDefined();
      expect(Array.isArray(res.body.testResults)).toBe(true);
    });

    it('should filter by lotId', async () => {
      const res = await request(app)
        .get(`/api/test-results?projectId=${projectId}&lotId=${lotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.testResults).toBeDefined();
    });

    it('should search test results server-side across request and lab fields', async () => {
      const searchToken = `test-search-${Date.now()}`;
      const matchingTest = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'Compaction Test',
          testRequestNumber: `REQ-${searchToken}`,
          laboratoryName: 'Global Search Lab',
          status: 'requested',
        },
      });
      const otherTest = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'Concrete Cylinder',
          testRequestNumber: `REQ-OTHER-${Date.now()}`,
          laboratoryName: 'Unrelated Lab',
          status: 'requested',
        },
      });

      try {
        const res = await request(app)
          .get(
            `/api/test-results?projectId=${projectId}&search=${encodeURIComponent(searchToken.toUpperCase())}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        const returnedIds = res.body.testResults.map((testResult: { id: string }) => testResult.id);
        expect(returnedIds).toContain(matchingTest.id);
        expect(returnedIds).not.toContain(otherTest.id);
      } finally {
        await prisma.testResult.deleteMany({
          where: { id: { in: [matchingTest.id, otherTest.id] } },
        });
      }
    });

    it('should require projectId', async () => {
      const res = await request(app)
        .get('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should reject malformed test result search parameters', async () => {
      const duplicateSearchRes = await request(app)
        .get('/api/test-results')
        .query({ projectId, search: ['one', 'two'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateSearchRes.status).toBe(400);

      const oversizedSearchRes = await request(app)
        .get('/api/test-results')
        .query({ projectId, search: 'x'.repeat(201) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(oversizedSearchRes.status).toBe(400);
    });

    it('should reject users without active project access', async () => {
      const outsiderEmail = `testresults-outsider-${Date.now()}@example.com`;
      const outsiderRes = await request(app).post('/api/auth/register').send({
        email: outsiderEmail,
        password: TEST_PASSWORD,
        fullName: 'Test Results Outsider',
        tosAccepted: true,
      });
      const outsiderToken = outsiderRes.body.token;
      const outsiderUserId = outsiderRes.body.user.id;

      await prisma.user.update({
        where: { id: outsiderUserId },
        data: { companyId, roleInCompany: 'viewer' },
      });

      const res = await request(app)
        .get(`/api/test-results?projectId=${projectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`);

      expect(res.status).toBe(403);

      await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderUserId } });
      await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
    });
  });

  describe('Access hardening', () => {
    it('rejects same-company project managers without active project membership from mutating test results', async () => {
      const projectManager = await registerTestUser(
        'Test Results Rogue PM',
        'project_manager',
        companyId,
      );
      const guardedTestResult = await prisma.testResult.create({
        data: {
          projectId,
          testType: 'Access Guard Test',
          status: 'requested',
        },
      });

      try {
        const createRes = await request(app)
          .post('/api/test-results')
          .set('Authorization', `Bearer ${projectManager.token}`)
          .send({
            projectId,
            testType: 'Unauthorized Test',
          });

        const patchRes = await request(app)
          .patch(`/api/test-results/${guardedTestResult.id}`)
          .set('Authorization', `Bearer ${projectManager.token}`)
          .send({
            resultValue: '99',
          });

        const statusRes = await request(app)
          .post(`/api/test-results/${guardedTestResult.id}/status`)
          .set('Authorization', `Bearer ${projectManager.token}`)
          .send({
            status: 'at_lab',
          });

        const deleteRes = await request(app)
          .delete(`/api/test-results/${guardedTestResult.id}`)
          .set('Authorization', `Bearer ${projectManager.token}`);

        expect(createRes.status).toBe(403);
        expect(patchRes.status).toBe(403);
        expect(statusRes.status).toBe(403);
        expect(deleteRes.status).toBe(403);
      } finally {
        await prisma.testResult.deleteMany({ where: { id: guardedTestResult.id } });
        await cleanupTestUser(projectManager.userId);
      }
    });

    it('rejects pending project memberships from creating test results', async () => {
      const pendingEngineer = await registerTestUser(
        'Test Results Pending Engineer',
        'viewer',
        companyId,
      );
      await prisma.projectUser.create({
        data: {
          projectId,
          userId: pendingEngineer.userId,
          role: 'site_engineer',
          status: 'pending',
        },
      });

      try {
        const res = await request(app)
          .post('/api/test-results')
          .set('Authorization', `Bearer ${pendingEngineer.token}`)
          .send({
            projectId,
            testType: 'Pending Membership Test',
          });

        expect(res.status).toBe(403);
      } finally {
        await cleanupTestUser(pendingEngineer.userId);
      }
    });

    it('rejects assigning a test result to a lot from another project', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Test Results Other Project ${Date.now()}`,
          projectNumber: `TR-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `TR-OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResultId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            lotId: otherLot.id,
          });

        expect(res.status).toBe(400);
      } finally {
        await prisma.lot.deleteMany({ where: { projectId: otherProject.id } });
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('rejects malformed laboratory query parameters', async () => {
      const repeatedProjectRes = await request(app)
        .get('/api/test-results/laboratories')
        .query({ projectId: [projectId, 'other-project'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(repeatedProjectRes.status).toBe(400);
      expect(repeatedProjectRes.body.error.message).toContain('projectId');

      const repeatedSearchRes = await request(app)
        .get('/api/test-results/laboratories')
        .query({ search: ['Lab', 'Other'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(repeatedSearchRes.status).toBe(400);
      expect(repeatedSearchRes.body.error.message).toContain('search');

      const emptySearchRes = await request(app)
        .get('/api/test-results/laboratories')
        .query({ search: '   ' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(emptySearchRes.status).toBe(400);
      expect(emptySearchRes.body.error.message).toContain('search');
    });

    it('does not leak laboratory names from unreadable projects', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Test Results Private Company ${Date.now()}` },
      });
      const otherProject = await prisma.project.create({
        data: {
          name: `Test Results Private Project ${Date.now()}`,
          projectNumber: `TR-PRIVATE-${Date.now()}`,
          companyId: otherCompany.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      await prisma.testResult.create({
        data: {
          projectId: otherProject.id,
          testType: 'Private Lab Test',
          laboratoryName: 'Private Competitor Lab',
        },
      });

      try {
        const res = await request(app)
          .get('/api/test-results/laboratories')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.laboratories).not.toContain('Private Competitor Lab');
      } finally {
        await prisma.testResult.deleteMany({ where: { projectId: otherProject.id } });
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
    });

    it('scopes subcontractor laboratory names and lot filters to assigned lots', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Test Results Subcontractor ${Date.now()}`,
          status: 'approved',
          portalAccess: {
            documents: true,
            itps: true,
            testResults: true,
          },
        },
      });
      const subcontractor = await registerTestUser(
        'Test Results Subcontractor',
        'subcontractor',
        null,
      );
      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `TR-HIDDEN-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const [visibleTestResult, hiddenTestResult] = await Promise.all([
        prisma.testResult.create({
          data: {
            projectId,
            lotId,
            testType: 'Visible Assigned Lab Test',
            laboratoryName: 'Visible Assigned Lab',
          },
        }),
        prisma.testResult.create({
          data: {
            projectId,
            lotId: unassignedLot.id,
            testType: 'Hidden Unassigned Lab Test',
            laboratoryName: 'Hidden Unassigned Lab',
          },
        }),
      ]);

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });
      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId,
          subcontractorCompanyId: subcontractorCompany.id,
          status: 'active',
        },
      });

      try {
        const projectLabsRes = await request(app)
          .get(`/api/test-results/laboratories?projectId=${projectId}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(projectLabsRes.status).toBe(200);
        expect(projectLabsRes.body.laboratories).toContain('Visible Assigned Lab');
        expect(projectLabsRes.body.laboratories).not.toContain('Hidden Unassigned Lab');

        const allLabsRes = await request(app)
          .get('/api/test-results/laboratories')
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(allLabsRes.status).toBe(200);
        expect(allLabsRes.body.laboratories).toContain('Visible Assigned Lab');
        expect(allLabsRes.body.laboratories).not.toContain('Hidden Unassigned Lab');

        const unassignedListRes = await request(app)
          .get(`/api/test-results?projectId=${projectId}&lotId=${unassignedLot.id}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(unassignedListRes.status).toBe(200);
        expect(unassignedListRes.body.testResults).toHaveLength(0);

        const assignedListRes = await request(app)
          .get(`/api/test-results?projectId=${projectId}&lotId=${lotId}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(assignedListRes.status).toBe(200);
        expect(
          assignedListRes.body.testResults.some(
            (result: any) => result.id === visibleTestResult.id,
          ),
        ).toBe(true);
        expect(
          assignedListRes.body.testResults.some((result: any) => result.id === hiddenTestResult.id),
        ).toBe(false);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
        await prisma.testResult.deleteMany({
          where: { id: { in: [visibleTestResult.id, hiddenTestResult.id] } },
        });
        await prisma.lot.delete({ where: { id: unassignedLot.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subcontractor.userId);
      }
    });

    it('does not expose laboratory names to stale company-linked subcontractor roles', async () => {
      const suffix = Date.now();
      const staleLabName = `Stale Linked Lab ${suffix}`;
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Test Results Stale Subcontractor ${suffix}`,
          status: 'approved',
          portalAccess: {
            testResults: true,
          },
        },
      });
      const staleUser = await registerTestUser(
        'Test Results Stale Subcontractor',
        'subcontractor',
        companyId,
      );
      const assignedTestResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'Stale Linked Lab Test',
          laboratoryName: staleLabName,
        },
      });

      try {
        await prisma.subcontractorUser.create({
          data: {
            userId: staleUser.userId,
            subcontractorCompanyId: subcontractorCompany.id,
            role: 'user',
          },
        });
        await prisma.lotSubcontractorAssignment.create({
          data: {
            projectId,
            lotId,
            subcontractorCompanyId: subcontractorCompany.id,
            status: 'active',
          },
        });

        const allLabsRes = await request(app)
          .get('/api/test-results/laboratories')
          .set('Authorization', `Bearer ${staleUser.token}`);
        expect(allLabsRes.status).toBe(200);
        expect(allLabsRes.body.laboratories).not.toContain(staleLabName);

        const projectLabsRes = await request(app)
          .get(`/api/test-results/laboratories?projectId=${projectId}`)
          .set('Authorization', `Bearer ${staleUser.token}`);
        expect(projectLabsRes.status).toBe(403);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: staleUser.userId } });
        await prisma.testResult.delete({ where: { id: assignedTestResult.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(staleUser.userId);
      }
    });

    it('rejects subcontractor direct test-result reads when portal access is disabled', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Test Results Portal Disabled ${Date.now()}`,
          status: 'approved',
          portalAccess: {
            testResults: false,
          },
        },
      });
      const subcontractor = await registerTestUser(
        'Test Results Portal Blocked',
        'subcontractor',
        null,
      );
      const assignedTestResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'Blocked Portal Lab Test',
          laboratoryName: 'Blocked Portal Lab',
          status: 'requested',
        },
      });

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });
      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId,
          subcontractorCompanyId: subcontractorCompany.id,
          status: 'active',
        },
      });

      try {
        const listRes = await request(app)
          .get(`/api/test-results?projectId=${projectId}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(listRes.status).toBe(403);
        expect(listRes.body.error.message).toContain('Test results portal access is not enabled');

        const projectLabsRes = await request(app)
          .get(`/api/test-results/laboratories?projectId=${projectId}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(projectLabsRes.status).toBe(403);
        expect(projectLabsRes.body.error.message).toContain(
          'Test results portal access is not enabled',
        );

        const allLabsRes = await request(app)
          .get('/api/test-results/laboratories')
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(allLabsRes.status).toBe(200);
        expect(allLabsRes.body.laboratories).not.toContain('Blocked Portal Lab');

        const directReadRes = await request(app)
          .get(`/api/test-results/${assignedTestResult.id}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(directReadRes.status).toBe(403);
        expect(directReadRes.body.error.message).toContain(
          'Test results portal access is not enabled',
        );

        const requestFormRes = await request(app)
          .get(`/api/test-results/${assignedTestResult.id}/request-form?format=json`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(requestFormRes.status).toBe(403);

        const workflowRes = await request(app)
          .get(`/api/test-results/${assignedTestResult.id}/workflow`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(workflowRes.status).toBe(403);

        const extractionRes = await request(app)
          .get(`/api/test-results/${assignedTestResult.id}/extraction`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(extractionRes.status).toBe(403);

        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompany.id },
          data: { portalAccess: { testResults: true } },
        });

        const allowedDirectReadRes = await request(app)
          .get(`/api/test-results/${assignedTestResult.id}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(allowedDirectReadRes.status).toBe(200);
        expect(allowedDirectReadRes.body.testResult.id).toBe(assignedTestResult.id);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
        await prisma.testResult.deleteMany({ where: { id: assignedTestResult.id } });
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subcontractor.userId);
      }
    });
  });

  // PR-I: Characterize the test-result access-control trust boundary before it is
  // extracted into its own module. These freeze the CURRENT wire behavior of the
  // per-result, per-role, and per-lot guards (requireTestResultReadAccess,
  // requireTestProjectRole, hasAssignedSubcontractorLotAccess). Behavior only --
  // production access code is intentionally unchanged.
  describe('Access control characterization', () => {
    it('rejects cross-company users from reading or listing test results by id', async () => {
      const otherCompany = await prisma.company.create({
        data: { name: `Test Results Cross Company ${Date.now()}` },
      });
      const outsider = await registerTestUser(
        'Test Results Cross Company Admin',
        'admin',
        otherCompany.id,
      );
      const guardedTestResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Cross Company Guard ${Date.now()}`,
          status: 'requested',
        },
      });

      try {
        const readRes = await request(app)
          .get(`/api/test-results/${guardedTestResult.id}`)
          .set('Authorization', `Bearer ${outsider.token}`);

        expect(readRes.status).toBe(403);
        expect(readRes.body.error.code).toBe('FORBIDDEN');
        expect(readRes.body.error.message).toBe('You do not have access to this test result');

        // The list endpoint must not leak another company's project either.
        const listRes = await request(app)
          .get(`/api/test-results?projectId=${projectId}`)
          .set('Authorization', `Bearer ${outsider.token}`);

        expect(listRes.status).toBe(403);
        expect(listRes.body.error.code).toBe('FORBIDDEN');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: guardedTestResult.id } });
        await cleanupTestUser(outsider.userId);
        await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
      }
    });

    it('rejects active members with creator-only roles from deleting test results', async () => {
      // foreman is a TEST_CREATOR but not a TEST_DELETER. An *active* membership
      // resolves to a concrete role, so this exercises the allowedRoles denial
      // branch of requireTestProjectRole (distinct from the no-membership case the
      // "Access hardening" suite already covers).
      const foreman = await registerTestUser('Test Results Delete Foreman', 'foreman', companyId);
      const guardedTestResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Delete Role Guard ${Date.now()}`,
          status: 'requested',
        },
      });

      try {
        await prisma.projectUser.create({
          data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
        });

        const deleteRes = await request(app)
          .delete(`/api/test-results/${guardedTestResult.id}`)
          .set('Authorization', `Bearer ${foreman.token}`);

        expect(deleteRes.status).toBe(403);
        expect(deleteRes.body.error.code).toBe('FORBIDDEN');
        expect(deleteRes.body.error.message).toBe(
          'You do not have permission to delete test results',
        );

        // The denied delete must not remove the row.
        await expect(
          prisma.testResult.findUnique({ where: { id: guardedTestResult.id } }),
        ).resolves.not.toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: guardedTestResult.id } });
        await cleanupTestUser(foreman.userId);
      }
    });

    it('scopes subcontractor direct reads to assigned lots within an authorized project', async () => {
      const subcontractorCompany = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Test Results Assigned Read Sub ${Date.now()}`,
          status: 'approved',
          portalAccess: { testResults: true },
        },
      });
      const subcontractor = await registerTestUser(
        'Test Results Assigned Read Sub',
        'subcontractor',
        null,
      );
      const unassignedLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `TR-UNASSIGNED-READ-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const [assignedTestResult, unassignedTestResult] = await Promise.all([
        prisma.testResult.create({
          data: {
            projectId,
            lotId,
            testType: `Assigned Lot Read ${Date.now()}`,
            status: 'requested',
          },
        }),
        prisma.testResult.create({
          data: {
            projectId,
            lotId: unassignedLot.id,
            testType: `Unassigned Lot Read ${Date.now()}`,
            status: 'requested',
          },
        }),
      ]);

      await prisma.subcontractorUser.create({
        data: {
          userId: subcontractor.userId,
          subcontractorCompanyId: subcontractorCompany.id,
          role: 'user',
        },
      });
      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId,
          subcontractorCompanyId: subcontractorCompany.id,
          status: 'active',
        },
      });

      try {
        const unassignedReadRes = await request(app)
          .get(`/api/test-results/${unassignedTestResult.id}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(unassignedReadRes.status).toBe(403);
        expect(unassignedReadRes.body.error.code).toBe('FORBIDDEN');
        expect(unassignedReadRes.body.error.message).toBe(
          'You do not have access to this test result',
        );

        const assignedReadRes = await request(app)
          .get(`/api/test-results/${assignedTestResult.id}`)
          .set('Authorization', `Bearer ${subcontractor.token}`);
        expect(assignedReadRes.status).toBe(200);
        expect(assignedReadRes.body.testResult.id).toBe(assignedTestResult.id);
      } finally {
        await prisma.lotSubcontractorAssignment.deleteMany({
          where: { subcontractorCompanyId: subcontractorCompany.id },
        });
        await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
        await prisma.testResult.deleteMany({
          where: { id: { in: [assignedTestResult.id, unassignedTestResult.id] } },
        });
        await prisma.lot.delete({ where: { id: unassignedLot.id } }).catch(() => {});
        await prisma.subcontractorCompany
          .delete({ where: { id: subcontractorCompany.id } })
          .catch(() => {});
        await cleanupTestUser(subcontractor.userId);
      }
    });
  });

  describe('GET /api/test-results/:id', () => {
    it('should get a single test result', async () => {
      const res = await request(app)
        .get(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.testResult).toBeDefined();
      expect(res.body.testResult.id).toBe(testResultId);
    });

    it('should return 404 for non-existent test result', async () => {
      const res = await request(app)
        .get('/api/test-results/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized test result route parameters before lookups', async () => {
      const longId = 't'.repeat(121);
      const checks = [
        {
          label: 'GET test result',
          response: await request(app)
            .get(`/api/test-results/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET request form',
          response: await request(app)
            .get(`/api/test-results/${longId}/request-form?format=json`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH test result',
          response: await request(app)
            .patch(`/api/test-results/${longId}`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ resultValue: '97.5' }),
        },
        {
          label: 'GET workflow',
          response: await request(app)
            .get(`/api/test-results/${longId}/workflow`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST reject',
          response: await request(app)
            .post(`/api/test-results/${longId}/reject`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ reason: 'Values do not match the uploaded certificate.' }),
        },
        {
          label: 'POST status',
          response: await request(app)
            .post(`/api/test-results/${longId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ status: 'at_lab' }),
        },
        {
          label: 'GET verification view',
          response: await request(app)
            .get(`/api/test-results/${longId}/verification-view`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST verify',
          response: await request(app)
            .post(`/api/test-results/${longId}/verify`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET extraction',
          response: await request(app)
            .get(`/api/test-results/${longId}/extraction`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PATCH confirm extraction',
          response: await request(app)
            .patch(`/api/test-results/${longId}/confirm-extraction`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ corrections: {} }),
        },
        {
          label: 'DELETE test result',
          response: await request(app)
            .delete(`/api/test-results/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('id is too long');
      }
    });
  });

  describe('GET /api/test-results/:id/request-form', () => {
    it('should validate request form format query parameters', async () => {
      const jsonRes = await request(app)
        .get(`/api/test-results/${testResultId}/request-form?format=json`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.testRequestForm).toBeDefined();

      const duplicateFormatRes = await request(app)
        .get(`/api/test-results/${testResultId}/request-form`)
        .query({ format: ['json', 'html'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateFormatRes.status).toBe(400);
      expect(duplicateFormatRes.body.error.message).toContain(
        'format query parameter must be a single value',
      );

      const invalidFormatRes = await request(app)
        .get(`/api/test-results/${testResultId}/request-form?format=pdf`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidFormatRes.status).toBe(400);
      expect(invalidFormatRes.body.error.message).toContain('format must be one of');
    });

    it('escapes stored fields in printable HTML request forms', async () => {
      const xssProject = await prisma.project.create({
        data: {
          name: '<script>Project XSS</script>',
          projectNumber: `TR-XSS-${Date.now()}`,
          clientName: '<img src=x onerror=alert(1)>',
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      await prisma.projectUser.create({
        data: { projectId: xssProject.id, userId, role: 'admin', status: 'active' },
      });
      const xssLot = await prisma.lot.create({
        data: {
          projectId: xssProject.id,
          lotNumber: '<b>LOT-XSS</b>',
          description: '<img src=x onerror=alert(2)>',
          status: 'not_started',
          lotType: 'chainage',
          activityType: '<svg onload=alert(3)>',
        },
      });
      const xssTestResult = await prisma.testResult.create({
        data: {
          projectId: xssProject.id,
          lotId: xssLot.id,
          testType: '<script>Test Type XSS</script>',
          testRequestNumber: '<script>REQ-XSS</script>',
          laboratoryName: '<svg onload=alert(4)>',
          sampleLocation: '<img src=x onerror=alert(5)>',
          resultUnit: '<b>% MDD</b>',
          specificationMin: 95,
          enteredById: userId,
          status: 'requested',
        },
      });

      try {
        const res = await request(app)
          .get(`/api/test-results/${xssTestResult.id}/request-form`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.text).toContain('&lt;script&gt;Project XSS&lt;/script&gt;');
        expect(res.text).toContain('&lt;script&gt;REQ-XSS&lt;/script&gt;');
        expect(res.text).toContain('&lt;svg onload=alert(4)&gt;');
        expect(res.text).not.toContain('<script>Project XSS</script>');
        expect(res.text).not.toContain('<script>REQ-XSS</script>');
        expect(res.text).not.toContain('<svg onload=alert(4)>');
        expect(res.text).not.toContain('<img src=x onerror=alert(5)>');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: xssTestResult.id } });
        await prisma.lot.deleteMany({ where: { id: xssLot.id } });
        await prisma.projectUser.deleteMany({ where: { projectId: xssProject.id } });
        await prisma.project.delete({ where: { id: xssProject.id } }).catch(() => {});
      }
    });
  });

  describe('GET /api/test-results/:id/verification-view', () => {
    async function createVerificationViewCertificate(filenamePrefix: string) {
      const filename = `${filenamePrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

      return prisma.document.create({
        data: {
          projectId,
          lotId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename,
          fileUrl: `/uploads/certificates/${filename}`,
          fileSize: 100,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
    }

    it('returns certificate-backed data needed by the verification UI', async () => {
      const certificate = await createVerificationViewCertificate('verification-view-cert');
      const sampleDate = new Date('2026-05-01T00:00:00.000Z');
      const testDate = new Date('2026-05-02T00:00:00.000Z');
      const resultDate = new Date('2026-05-03T00:00:00.000Z');
      const enteredAt = new Date('2026-05-04T05:06:07.000Z');
      const aiConfidence = {
        testType: 0.97,
        resultValue: 0.74,
        sampleLocation: 0.88,
      };
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'compaction',
          testRequestNumber: 'TR-VIEW-001',
          laboratoryName: 'QA Lab & Partners',
          laboratoryReportNumber: 'LAB-7788',
          sampleDate,
          sampleLocation: 'CH 100-120 left shoulder',
          testDate,
          resultDate,
          resultValue: 98.5,
          resultUnit: '% MDD',
          specificationMin: 95,
          specificationMax: 100,
          passFail: 'pass',
          certificateDocId: certificate.id,
          status: 'entered',
          enteredById: userId,
          enteredAt,
          aiExtracted: true,
          aiConfidence: JSON.stringify(aiConfidence),
        },
      });

      try {
        const res = await request(app)
          .get(`/api/test-results/${testResult.id}/verification-view`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');

        const view = res.body.verificationView;
        expect(view.document).toMatchObject({
          id: certificate.id,
          filename: certificate.filename,
          mimeType: 'application/pdf',
          isPdf: true,
        });
        expect(view.document).not.toHaveProperty('fileUrl');
        expect(view.extractedData).toMatchObject({
          testType: 'compaction',
          testRequestNumber: 'TR-VIEW-001',
          laboratoryName: 'QA Lab & Partners',
          laboratoryReportNumber: 'LAB-7788',
          sampleLocation: 'CH 100-120 left shoulder',
          resultUnit: '% MDD',
          aiExtracted: true,
          aiConfidence,
        });
        expect(view.extractedData.sampleDate).toBe(sampleDate.toISOString());
        expect(view.extractedData.testDate).toBe(testDate.toISOString());
        expect(view.extractedData.resultDate).toBe(resultDate.toISOString());
        expect(Number(view.extractedData.resultValue)).toBe(98.5);

        expect(view.confidenceHighlights).toMatchObject({
          hasLowConfidence: true,
          lowConfidenceFields: ['resultValue'],
          thresholds: { low: 0.8, medium: 0.9 },
        });
        expect(view.confidenceHighlights.fieldStatus).toMatchObject({
          testType: { confidence: 0.97, status: 'high', needsReview: false },
          resultValue: { confidence: 0.74, status: 'low', needsReview: true },
          sampleLocation: { confidence: 0.88, status: 'medium', needsReview: false },
        });

        expect(Number(view.specification.min)).toBe(95);
        expect(Number(view.specification.max)).toBe(100);
        expect(view.specification).toMatchObject({
          unit: '% MDD',
          currentStatus: 'pass',
          calculatedStatus: 'pass',
          standardReference: 'TMR MRTS04 / AS 1289.5.4.1',
        });
        expect(view.metadata).toMatchObject({
          id: testResult.id,
          status: 'entered',
          project: {
            id: projectId,
            name: expect.any(String),
            projectNumber: expect.any(String),
            specificationSet: 'TfNSW',
          },
          lot: {
            id: lotId,
            lotNumber: expect.any(String),
            activityType: 'Earthworks',
          },
          enteredBy: {
            id: userId,
            fullName: 'Test Results User',
          },
        });
        expect(view.metadata.enteredAt).toBe(enteredAt.toISOString());
        expect(view.canVerify).toBe(true);
        expect(view.needsVerification).toBe(true);
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({ where: { id: certificate.id } });
      }
    });

    it('represents user-provided markup as JSON data instead of rendered HTML', async () => {
      const certificate = await createVerificationViewCertificate('verification-view-xss-cert');
      const unsafeTestResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: '<script>Test Type XSS</script>',
          testRequestNumber: '<script>REQ-XSS</script>',
          laboratoryName: '<svg onload=alert(1)>',
          sampleLocation: '<img src=x onerror=alert(2)>',
          certificateDocId: certificate.id,
          status: 'entered',
          enteredById: userId,
          enteredAt: new Date('2026-05-05T06:07:08.000Z'),
        },
      });

      try {
        const res = await request(app)
          .get(`/api/test-results/${unsafeTestResult.id}/verification-view`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.text.trim()).toMatch(/^\{/);
        expect(res.text).not.toContain('<!DOCTYPE html>');
        expect(res.text).not.toContain('<html');
        expect(res.body.verificationView.extractedData).toMatchObject({
          testType: '<script>Test Type XSS</script>',
          testRequestNumber: '<script>REQ-XSS</script>',
          laboratoryName: '<svg onload=alert(1)>',
          sampleLocation: '<img src=x onerror=alert(2)>',
        });
      } finally {
        await prisma.testResult.deleteMany({ where: { id: unsafeTestResult.id } });
        await prisma.document.deleteMany({ where: { id: certificate.id } });
      }
    });

    it('rejects verification-view reads without test-result access', async () => {
      const outsider = await registerTestUser('Test Results View Outsider', 'viewer', null);
      const testResult = await createEnteredTestResult();

      try {
        const res = await request(app)
          .get(`/api/test-results/${testResult.id}/verification-view`)
          .set('Authorization', `Bearer ${outsider.token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('access to this test result');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(outsider.userId);
      }
    });
  });

  describe('PATCH /api/test-results/:id', () => {
    it('should update a test result', async () => {
      const res = await request(app)
        .patch(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resultValue: '97.5',
          resultUnit: '% MDD',
          passFail: 'pass',
        });

      expect(res.status).toBe(200);
      expect(res.body.testResult).toBeDefined();
    });

    it('should reject invalid update values', async () => {
      const invalidDateRes = await request(app)
        .patch(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resultDate: '2024-02-31',
        });

      const invalidNumberRes = await request(app)
        .patch(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          specificationMin: '95abc',
        });

      const invalidPassFailRes = await request(app)
        .patch(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          passFail: 'maybe',
        });

      expect(invalidDateRes.status).toBe(400);
      expect(invalidDateRes.body.error.message).toContain('resultDate');
      expect(invalidNumberRes.status).toBe(400);
      expect(invalidNumberRes.body.error.message).toContain('specificationMin');
      expect(invalidPassFailRes.status).toBe(400);
      expect(invalidPassFailRes.body.error.message).toContain('passFail');
    });

    it('should reject non-verifier edits to verified test results', async () => {
      const foreman = await registerTestUser('Test Result Foreman', 'foreman', companyId);
      const testResult = await createEnteredTestResult();
      const verifiedAt = new Date('2026-02-03T04:05:06.000Z');

      try {
        await prisma.projectUser.create({
          data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
        });
        await prisma.testResult.update({
          where: { id: testResult.id },
          data: {
            status: 'verified',
            verifiedAt,
            verifiedById: userId,
            resultUnit: '% MDD',
          },
        });

        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}`)
          .set('Authorization', `Bearer ${foreman.token}`)
          .send({ resultUnit: 'kPa' });

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('Verified test results');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true, resultUnit: true },
        });
        expect(unchanged.status).toBe('verified');
        expect(unchanged.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
        expect(unchanged.verifiedById).toBe(userId);
        expect(unchanged.resultUnit).toBe('% MDD');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(foreman.userId);
      }
    });

    it('should clear verification when a verifier corrects verified test result evidence', async () => {
      const testResult = await createEnteredTestResult();
      const verifiedAt = new Date('2026-02-03T04:05:06.000Z');

      try {
        await prisma.testResult.update({
          where: { id: testResult.id },
          data: {
            status: 'verified',
            verifiedAt,
            verifiedById: userId,
            resultUnit: '% MDD',
          },
        });

        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ resultUnit: 'kPa', passFail: 'fail' });

        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('entered');

        const updated = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: {
            status: true,
            enteredAt: true,
            enteredById: true,
            verifiedAt: true,
            verifiedById: true,
            resultUnit: true,
            passFail: true,
          },
        });
        expect(updated.status).toBe('entered');
        expect(updated.enteredAt).not.toBeNull();
        expect(updated.enteredById).toBe(userId);
        expect(updated.verifiedAt).toBeNull();
        expect(updated.verifiedById).toBeNull();
        expect(updated.resultUnit).toBe('kPa');
        expect(updated.passFail).toBe('fail');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });
  });

  describe('GET /api/test-results/:id/workflow', () => {
    it('should get workflow status', async () => {
      const res = await request(app)
        .get(`/api/test-results/${testResultId}/workflow`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.workflow).toBeDefined();
      expect(res.body.workflow.currentStatus).toBeDefined();
      expect(res.body.workflow.steps).toBeDefined();
    });

    it.each([
      {
        // Ticket T2: the intermediate lab states are optional, so the workflow
        // presenter now surfaces every reachable next status from 'requested'.
        // The result-required gate is enforced by the route layer, not here.
        status: 'requested',
        label: 'Requested',
        completed: ['requested'],
        next: ['at_lab', 'results_received', 'entered'],
        isComplete: false,
      },
      {
        status: 'at_lab',
        label: 'At Lab',
        completed: ['requested', 'at_lab'],
        next: ['results_received', 'entered'],
        isComplete: false,
      },
      {
        status: 'results_received',
        label: 'Results Received',
        completed: ['requested', 'at_lab', 'results_received'],
        next: ['entered'],
        isComplete: false,
      },
      {
        status: 'entered',
        label: 'Entered',
        completed: ['requested', 'at_lab', 'results_received', 'entered'],
        next: ['verified'],
        isComplete: false,
      },
      {
        status: 'verified',
        label: 'Verified',
        completed: ['requested', 'at_lab', 'results_received', 'entered', 'verified'],
        next: [],
        isComplete: true,
      },
    ])('should return workflow details for $status status', async (workflowCase) => {
      const enteredAt = new Date('2026-03-04T05:06:07.000Z');
      const verifiedAt = new Date('2026-03-05T06:07:08.000Z');
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Workflow ${workflowCase.status} ${Date.now()}`,
          status: workflowCase.status,
          enteredAt: ['entered', 'verified'].includes(workflowCase.status) ? enteredAt : null,
          enteredById: ['entered', 'verified'].includes(workflowCase.status) ? userId : null,
          verifiedAt: workflowCase.status === 'verified' ? verifiedAt : null,
          verifiedById: workflowCase.status === 'verified' ? userId : null,
        },
      });

      try {
        const res = await request(app)
          .get(`/api/test-results/${testResult.id}/workflow`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.workflow.currentStatus).toBe(workflowCase.status);
        expect(res.body.workflow.currentStatusLabel).toBe(workflowCase.label);
        expect(res.body.workflow.canAdvance).toBe(workflowCase.next.length > 0);
        expect(res.body.workflow.isComplete).toBe(workflowCase.isComplete);
        expect(
          res.body.workflow.nextTransitions.map(
            (transition: { status: string }) => transition.status,
          ),
        ).toEqual(workflowCase.next);
        expect(
          res.body.workflow.nextTransitions.every(
            (transition: { canPerform: boolean }) => transition.canPerform,
          ),
        ).toBe(true);

        const steps = res.body.workflow.steps as Array<{
          status: string;
          completed: boolean;
          completedBy: string | null;
        }>;
        expect(steps.map((step) => step.status)).toEqual([
          'requested',
          'at_lab',
          'results_received',
          'entered',
          'verified',
        ]);
        expect(steps.filter((step) => step.completed).map((step) => step.status)).toEqual(
          workflowCase.completed,
        );

        const enteredStep = steps.find((step) => step.status === 'entered');
        const verifiedStep = steps.find((step) => step.status === 'verified');

        if (['entered', 'verified'].includes(workflowCase.status)) {
          expect(enteredStep?.completedBy).toBe('Test Results User');
        } else {
          expect(enteredStep?.completedBy).toBeNull();
        }

        if (workflowCase.status === 'verified') {
          expect(verifiedStep?.completedBy).toBe('Test Results User');
        } else {
          expect(verifiedStep?.completedBy).toBeNull();
        }
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });
  });

  describe('POST /api/test-results/:id/verify', () => {
    async function createTestCertificate(filenamePrefix: string) {
      const filename = `${filenamePrefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

      return prisma.document.create({
        data: {
          projectId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename,
          fileUrl: `/uploads/certificates/${filename}`,
          fileSize: 100,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
    }

    it('rejects non-verifier direct verification without mutating the test result', async () => {
      const foreman = await registerTestUser('Test Result Verify Foreman', 'foreman', companyId);
      const certificate = await createTestCertificate('non-verifier-verify-cert');
      const enteredAt = new Date('2026-04-05T06:07:08.000Z');
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Non Verifier Verify Test ${Date.now()}`,
          status: 'entered',
          certificateDocId: certificate.id,
          enteredById: userId,
          enteredAt,
        },
      });

      try {
        await prisma.projectUser.create({
          data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
        });

        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${foreman.token}`);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('permission to verify test results');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true, enteredAt: true },
        });
        expect(unchanged.status).toBe('entered');
        expect(unchanged.verifiedAt).toBeNull();
        expect(unchanged.verifiedById).toBeNull();
        expect(unchanged.enteredAt?.toISOString()).toBe(enteredAt.toISOString());

        const auditCount = await prisma.auditLog.count({
          where: {
            entityId: testResult.id,
            action: AuditAction.TEST_RESULT_VERIFIED,
          },
        });
        expect(auditCount).toBe(0);
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({ where: { id: certificate.id } });
        await cleanupTestUser(foreman.userId);
      }
    });

    it('requires a certificate before direct verification without mutating the test result', async () => {
      const testResult = await createEnteredTestResult();

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('CERTIFICATE_REQUIRED');
        expect(res.body.error.message).toContain('certificate must be uploaded');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true, certificateDocId: true },
        });
        expect(unchanged.status).toBe('entered');
        expect(unchanged.verifiedAt).toBeNull();
        expect(unchanged.verifiedById).toBeNull();
        expect(unchanged.certificateDocId).toBeNull();

        const auditCount = await prisma.auditLog.count({
          where: {
            entityId: testResult.id,
            action: AuditAction.TEST_RESULT_VERIFIED,
          },
        });
        expect(auditCount).toBe(0);
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('requires a recorded result before direct verification even with a certificate (Ticket T2)', async () => {
      const certificate = await createTestCertificate('blank-result-verify-cert');
      // An 'entered' row with a certificate but NO result value / pending
      // pass-fail — exactly the empty rows the old no-data flow produced.
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Blank Result Verify Test ${Date.now()}`,
          status: 'entered',
          certificateDocId: certificate.id,
          enteredById: userId,
          enteredAt: new Date(),
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('RESULT_REQUIRED');
        expect(res.body.error.message).toContain('pass/fail');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true },
        });
        expect(unchanged.status).toBe('entered');
        expect(unchanged.verifiedAt).toBeNull();
        expect(unchanged.verifiedById).toBeNull();

        const auditCount = await prisma.auditLog.count({
          where: { entityId: testResult.id, action: AuditAction.TEST_RESULT_VERIFIED },
        });
        expect(auditCount).toBe(0);
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({ where: { id: certificate.id } });
      }
    });

    it('verifies entered test results with a certificate and writes an audit log', async () => {
      const certificate = await createTestCertificate('direct-verify-cert');
      const testResult = await createEnteredTestResult();

      try {
        await prisma.testResult.update({
          where: { id: testResult.id },
          data: { certificateDocId: certificate.id },
        });

        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('verified');
        expect(res.body.testResult.verifiedBy.fullName).toBe('Test Results User');

        const updated = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true },
        });
        expect(updated.status).toBe('verified');
        expect(updated.verifiedAt).not.toBeNull();
        expect(updated.verifiedById).toBe(userId);

        const auditLog = await prisma.auditLog.findFirst({
          where: {
            entityId: testResult.id,
            action: AuditAction.TEST_RESULT_VERIFIED,
          },
          orderBy: { createdAt: 'desc' },
        });
        expect(auditLog).toMatchObject({
          projectId,
          userId,
          entityType: 'test_result',
          entityId: testResult.id,
          action: AuditAction.TEST_RESULT_VERIFIED,
        });
        expect(JSON.parse(auditLog?.changes ?? '{}')).toEqual({ status: 'verified' });
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({ where: { id: certificate.id } });
      }
    });

    it('should keep repeat direct verification idempotent for already verified test results', async () => {
      const certificate = await prisma.document.create({
        data: {
          projectId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename: 'repeat-verify-cert.pdf',
          fileUrl: '/uploads/certificates/repeat-verify-cert.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      const verifiedAt = new Date('2026-02-03T04:05:06.000Z');
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Repeat Verify Test ${Date.now()}`,
          status: 'verified',
          certificateDocId: certificate.id,
          verifiedAt,
          verifiedById: userId,
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('verified');
        expect(res.body.testResult.verifiedAt).toBe(verifiedAt.toISOString());

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true },
        });
        expect(unchanged.status).toBe('verified');
        expect(unchanged.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
        expect(unchanged.verifiedById).toBe(userId);
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({ where: { id: certificate.id } });
      }
    });
  });

  describe('POST /api/test-results/:id/reject', () => {
    it('should reject invalid rejection reasons without mutating the test result', async () => {
      const testResult = await createEnteredTestResult();
      const cases = [
        {
          payload: { reason: { value: 'Wrong values' } },
          message: 'reason must be a string',
        },
        {
          payload: { reason: '   ' },
          message: 'reason is required',
        },
        {
          payload: { reason: 'R'.repeat(3001) },
          message: 'reason is too long',
        },
      ];

      for (const testCase of cases) {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/reject`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(testCase.payload);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain(testCase.message);
      }

      const unchanged = await prisma.testResult.findUnique({ where: { id: testResult.id } });
      expect(unchanged?.status).toBe('entered');
      expect(unchanged?.rejectionReason).toBeNull();
      expect(unchanged?.rejectedById).toBeNull();
      expect(unchanged?.enteredById).toBe(userId);
    });

    it('should trim and store valid rejection reasons', async () => {
      const testResult = await createEnteredTestResult();

      const res = await request(app)
        .post(`/api/test-results/${testResult.id}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reason: '  Values do not match the uploaded certificate.  ' });

      expect(res.status).toBe(200);
      expect(res.body.testResult.status).toBe('results_received');
      expect(res.body.testResult.rejectionReason).toBe(
        'Values do not match the uploaded certificate.',
      );

      const updated = await prisma.testResult.findUnique({ where: { id: testResult.id } });
      expect(updated?.status).toBe('results_received');
      expect(updated?.rejectionReason).toBe('Values do not match the uploaded certificate.');
      expect(updated?.enteredById).toBeNull();
    });
  });

  // Feature B2: attach (or replace) a certificate on an EXISTING test result so
  // a manually-created test can satisfy the verification gate without the AI
  // upload path (which would create a brand-new test instead).
  describe('POST /api/test-results/:id/certificate', () => {
    const PDF_BYTES = Buffer.from('%PDF-1.4\nattach cert\n%%EOF');

    it('attaches a certificate to a manual test, then the test can be verified', async () => {
      const testResult = await createEnteredTestResult();

      try {
        // Pre-condition: no certificate, so verification is blocked.
        expect(testResult.certificateDocId).toBeNull();
        const blocked = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(blocked.status).toBe(400);
        expect(blocked.body.error.code).toBe('CERTIFICATE_REQUIRED');

        // Attach a PDF certificate to the existing test.
        const attachRes = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('certificate', PDF_BYTES, {
            filename: 'attach-existing.pdf',
            contentType: 'application/pdf',
          });

        expect(attachRes.status).toBe(200);
        expect(attachRes.body.message).toBe('Certificate attached successfully');
        expect(attachRes.body.testResult.id).toBe(testResult.id);
        expect(attachRes.body.testResult.certificateDoc).toBeTruthy();
        expect(attachRes.body.testResult.certificateDoc.filename).toBe('attach-existing.pdf');
        await trackCertificateDocumentFile(attachRes.body.testResult.certificateDoc?.id);

        const certificateDocId = attachRes.body.testResult.certificateDoc.id;

        // DB row now links the new certificate; manual test stays manual.
        const linked = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { certificateDocId: true, aiExtracted: true, status: true },
        });
        expect(linked.certificateDocId).toBe(certificateDocId);
        expect(linked.aiExtracted).toBe(false);
        expect(linked.status).toBe('entered');

        // Acceptance: the gate is now satisfied and verification succeeds.
        const verifyRes = await request(app)
          .post(`/api/test-results/${testResult.id}/verify`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.testResult.status).toBe('verified');
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({ where: { projectId, filename: 'attach-existing.pdf' } });
      }
    });

    it('replaces the existing certificate and deletes the old Document row', async () => {
      const firstDoc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename: 'first-cert.pdf',
          fileUrl: '/uploads/certificates/first-cert.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Replace Cert Test ${Date.now()}`,
          status: 'entered',
          certificateDocId: firstDoc.id,
          enteredById: userId,
          enteredAt: new Date(),
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('certificate', PDF_BYTES, {
            filename: 'replacement-cert.pdf',
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(200);
        await trackCertificateDocumentFile(res.body.testResult.certificateDoc?.id);
        const newDocId = res.body.testResult.certificateDoc.id;
        expect(newDocId).not.toBe(firstDoc.id);

        // The test points at the new doc; the old Document row is gone.
        const linked = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { certificateDocId: true },
        });
        expect(linked.certificateDocId).toBe(newDocId);
        expect(await prisma.document.findUnique({ where: { id: firstDoc.id } })).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({
          where: { projectId, filename: { in: ['first-cert.pdf', 'replacement-cert.pdf'] } },
        });
      }
    });

    it('blocks replacing the certificate on a verified test result', async () => {
      const firstDoc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename: 'verified-first-cert.pdf',
          fileUrl: '/uploads/certificates/verified-first-cert.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      const verifiedAt = new Date('2026-05-06T07:08:09.000Z');
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Verified Replace Cert Test ${Date.now()}`,
          status: 'verified',
          certificateDocId: firstDoc.id,
          resultValue: 98.5,
          passFail: 'pass',
          enteredById: userId,
          enteredAt: new Date(),
          verifiedById: userId,
          verifiedAt,
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('certificate', PDF_BYTES, {
            filename: 'verified-replacement-cert.pdf',
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('Verified test result certificates');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, certificateDocId: true, verifiedAt: true, verifiedById: true },
        });
        expect(unchanged.status).toBe('verified');
        expect(unchanged.certificateDocId).toBe(firstDoc.id);
        expect(unchanged.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
        expect(unchanged.verifiedById).toBe(userId);
        expect(await prisma.document.findUnique({ where: { id: firstDoc.id } })).not.toBeNull();
        expect(
          await prisma.document.findFirst({
            where: { projectId, filename: 'verified-replacement-cert.pdf' },
          }),
        ).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.document.deleteMany({
          where: {
            projectId,
            filename: { in: ['verified-first-cert.pdf', 'verified-replacement-cert.pdf'] },
          },
        });
      }
    });

    it('rejects a file whose content does not match the declared type without linking it', async () => {
      const testResult = await createEnteredTestResult();
      const beforeFiles = new Set(fs.readdirSync(certificatesDir));
      const invalidBytes = Buffer.from('not a pdf');

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${authToken}`)
          .attach('certificate', invalidBytes, {
            filename: 'spoofed-attach.pdf',
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_FILE_TYPE');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { certificateDocId: true },
        });
        expect(unchanged.certificateDocId).toBeNull();
        expect(
          await prisma.document.findFirst({ where: { projectId, filename: 'spoofed-attach.pdf' } }),
        ).toBeNull();
        expect(findNewFilesWithContent(beforeFiles, invalidBytes)).toHaveLength(0);
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('rejects the attach with 400 when no file is uploaded', async () => {
      const testResult = await createEnteredTestResult();

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('No file uploaded');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('returns 404 for an unknown test result and cleans up the upload', async () => {
      const beforeFiles = new Set(fs.readdirSync(certificatesDir));
      const bytes = Buffer.from(`%PDF-1.4\nunknown ${Date.now()}\n%%EOF`);

      const res = await request(app)
        .post('/api/test-results/nonexistent-test-id/certificate')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('certificate', bytes, {
          filename: 'unknown-test.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(404);
      expect(findNewFilesWithContent(beforeFiles, bytes)).toHaveLength(0);
    });

    it('forbids a non-creator role from attaching a certificate', async () => {
      const subbie = await registerTestUser(
        'Attach Cert Subcontractor',
        'subcontractor',
        companyId,
      );
      const testResult = await createEnteredTestResult();

      try {
        await prisma.projectUser.create({
          data: { projectId, userId: subbie.userId, role: 'subcontractor', status: 'active' },
        });

        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${subbie.token}`)
          .attach('certificate', PDF_BYTES, {
            filename: 'forbidden-attach.pdf',
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('permission to attach test certificates');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { certificateDocId: true },
        });
        expect(unchanged.certificateDocId).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(subbie.userId);
      }
    });

    it('forbids attaching to a test result in a project the user cannot access', async () => {
      // Outsider belongs to a different company and has no membership on this
      // project, so the project/role scoping must reject the attach.
      const outsiderCompany = await prisma.company.create({
        data: { name: `Attach Cert Outsider Co ${Date.now()}` },
      });
      const outsider = await registerTestUser('Attach Cert Outsider', 'admin', outsiderCompany.id);
      const testResult = await createEnteredTestResult();

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/certificate`)
          .set('Authorization', `Bearer ${outsider.token}`)
          .attach('certificate', PDF_BYTES, {
            filename: 'cross-project-attach.pdf',
            contentType: 'application/pdf',
          });

        expect(res.status).toBe(403);

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { certificateDocId: true },
        });
        expect(unchanged.certificateDocId).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(outsider.userId);
        await prisma.company.delete({ where: { id: outsiderCompany.id } }).catch(() => {});
      }
    });
  });

  describe('POST /api/test-results/:id/status', () => {
    it('should reject invalid workflow status payloads', async () => {
      const unknownStatusRes = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'not_a_real_status',
        });

      const objectStatusRes = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: { value: 'at_lab' },
        });

      expect(unknownStatusRes.status).toBe(400);
      expect(unknownStatusRes.body.error.message).toContain('valid test result status');
      expect(objectStatusRes.status).toBe(400);
      expect(objectStatusRes.body.error.message).toContain('status');
    });

    it('should update test result status', async () => {
      const res = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'at_lab',
        });

      expect(res.status).toBe(200);
      expect(res.body.testResult.status).toBe('at_lab');
    });

    it('notifies active site engineers when test results are received', async () => {
      const siteEngineer = await registerTestUser(
        'Test Result Notification Engineer',
        'site_engineer',
        companyId,
      );
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'Compaction Test',
          testRequestNumber: 'TRN-1001',
          laboratoryName: 'Geo Lab',
          status: 'at_lab',
        },
      });

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: siteEngineer.userId,
          role: 'site_engineer',
          status: 'active',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'results_received',
          });

        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('results_received');

        const notification = await prisma.notification.findFirst({
          where: {
            userId: siteEngineer.userId,
            projectId,
            type: 'test_result_received',
          },
        });

        expect(notification).toMatchObject({
          title: 'Test Result Received',
          linkUrl: `/projects/${projectId}/tests`,
        });
        expect(notification?.message).toContain('Compaction Test');
        expect(notification?.message).toContain('TRN-1001');
        expect(notification?.message).toContain('Geo Lab');

        expect(mockSendNotificationIfEnabled).toHaveBeenCalledOnce();
        expect(mockSendNotificationIfEnabled).toHaveBeenCalledWith(siteEngineer.userId, 'enabled', {
          title: 'Test Result Received',
          message:
            'Test result for Compaction Test (TRN-1001) from Geo Lab is pending verification.',
          linkUrl: `/projects/${projectId}/tests`,
          projectName: expect.any(String),
        });
      } finally {
        await prisma.notification.deleteMany({ where: { userId: siteEngineer.userId } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(siteEngineer.userId);
      }
    });

    it('suppresses test-result notifications when the project toggle is off', async () => {
      const siteEngineer = await registerTestUser(
        'Test Result Toggle-Off Engineer',
        'site_engineer',
        companyId,
      );
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: 'Compaction Test',
          testRequestNumber: 'TRN-2002',
          laboratoryName: 'Geo Lab',
          status: 'at_lab',
        },
      });

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: siteEngineer.userId,
          role: 'site_engineer',
          status: 'active',
        },
      });

      // Admin turned the "Test Results" category off for this project.
      await prisma.project.update({
        where: { id: projectId },
        data: {
          settings: JSON.stringify({ notificationPreferences: { testResults: false } }),
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            status: 'results_received',
          });

        // The status change still succeeds; only the notification is suppressed.
        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('results_received');

        const notification = await prisma.notification.findFirst({
          where: {
            userId: siteEngineer.userId,
            projectId,
            type: 'test_result_received',
          },
        });
        expect(notification).toBeNull();
        expect(mockSendNotificationIfEnabled).not.toHaveBeenCalled();
      } finally {
        await prisma.project.update({
          where: { id: projectId },
          data: { settings: null },
        });
        await prisma.notification.deleteMany({ where: { userId: siteEngineer.userId } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(siteEngineer.userId);
      }
    });

    it('should reject invalid status transition', async () => {
      const res = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'verified', // Can't go directly to verified
        });

      expect(res.status).toBe(400);
    });

    it('blocks moving a blank test to entered without a recorded result (Ticket T2)', async () => {
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Blank Enter Test ${Date.now()}`,
          status: 'results_received',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'entered' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('RESULT_REQUIRED');
        expect(res.body.error.message).toContain('pass/fail');

        // The blank test is NOT advanced — this was the core bug.
        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, enteredById: true, enteredAt: true },
        });
        expect(unchanged.status).toBe('results_received');
        expect(unchanged.enteredById).toBeNull();
        expect(unchanged.enteredAt).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('enters a test with a recorded result via the optional-state short path (Ticket T2)', async () => {
      // A manually-created test that already has a real result + pass/fail can
      // jump straight from 'requested' to 'entered' (intermediate lab states are
      // optional), keeping "have a cert" -> verified within 2 clicks.
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Short Path Enter Test ${Date.now()}`,
          status: 'requested',
          resultValue: 97.2,
          passFail: 'pass',
        },
      });

      try {
        const res = await request(app)
          .post(`/api/test-results/${testResult.id}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ status: 'entered' });

        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('entered');

        const updated = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, enteredById: true, enteredAt: true },
        });
        expect(updated.status).toBe('entered');
        expect(updated.enteredById).toBe(userId);
        expect(updated.enteredAt).not.toBeNull();
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });
  });

  describe('DELETE /api/test-results/:id', () => {
    it('blocks deleting verified test results', async () => {
      const testResult = await createEnteredTestResult();
      const verifiedAt = new Date('2026-07-08T09:10:11.000Z');

      try {
        await prisma.testResult.update({
          where: { id: testResult.id },
          data: {
            status: 'verified',
            verifiedAt,
            verifiedById: userId,
          },
        });

        const res = await request(app)
          .delete(`/api/test-results/${testResult.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('Verified test results cannot be deleted');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, verifiedAt: true, verifiedById: true },
        });
        expect(unchanged.status).toBe('verified');
        expect(unchanged.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
        expect(unchanged.verifiedById).toBe(userId);
      } finally {
        await prisma.auditLog.deleteMany({ where: { entityId: testResult.id } });
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('should delete a test result', async () => {
      // Create a new test result to delete
      const createRes = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          testType: 'CBR Test',
        });

      const newId = createRes.body.testResult.id;

      const res = await request(app)
        .delete(`/api/test-results/${newId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('deleted');
    });

    it('should delete the linked Document row when a local certificate is attached', async () => {
      // Pre-seed a Document with a local-disk fileUrl + a TestResult that links to it
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'test_certificate',
          category: 'test_results',
          filename: 'local-cert.pdf',
          fileUrl: '/uploads/certificates/cert-local-fixture.pdf',
          fileSize: 100,
          mimeType: 'application/pdf',
          uploadedById: userId,
        },
      });
      const tr = await prisma.testResult.create({
        data: {
          projectId,
          testType: 'CBR Test',
          certificateDocId: doc.id,
        },
      });

      const res = await request(app)
        .delete(`/api/test-results/${tr.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(await prisma.testResult.findUnique({ where: { id: tr.id } })).toBeNull();
      expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();

      // Supabase remove must not have been called for a local certificate.
      expect(mockGetSupabaseClient).not.toHaveBeenCalled();
    });

    it('should remove the Supabase object when the certificate fileUrl is a Supabase URL', async () => {
      // Drive the Supabase-stored code path by:
      //   1. Pretending Supabase is configured.
      //   2. Pretending SUPABASE_URL matches the fileUrl host so
      //      getSupabaseStoragePath can extract a storage path.
      //   3. Capturing the storage.remove() call.
      const previousSupabaseUrl = process.env.SUPABASE_URL;
      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';

      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const storagePath = `certificates/${projectId}/cert-supabase-fixture.pdf`;
        const supabaseFileUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/${storagePath}`;

        const doc = await prisma.document.create({
          data: {
            projectId,
            documentType: 'test_certificate',
            category: 'test_results',
            filename: 'supabase-cert.pdf',
            fileUrl: supabaseFileUrl,
            fileSize: 100,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
        });
        const tr = await prisma.testResult.create({
          data: {
            projectId,
            testType: 'CBR Test',
            certificateDocId: doc.id,
          },
        });

        const res = await request(app)
          .delete(`/api/test-results/${tr.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(await prisma.testResult.findUnique({ where: { id: tr.id } })).toBeNull();
        expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();

        expect(mockRemove).toHaveBeenCalledOnce();
        expect(mockRemove).toHaveBeenCalledWith([storagePath]);
      } finally {
        if (previousSupabaseUrl === undefined) {
          delete process.env.SUPABASE_URL;
        } else {
          process.env.SUPABASE_URL = previousSupabaseUrl;
        }
        mockIsSupabaseConfigured.mockReset();
        mockIsSupabaseConfigured.mockReturnValue(false);
        mockGetSupabaseClient.mockReset();
      }
    });

    it('does not remove a Supabase certificate outside the test result project prefix', async () => {
      const previousSupabaseUrl = process.env.SUPABASE_URL;
      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';

      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      let docId: string | undefined;
      let testResultToDeleteId: string | undefined;

      try {
        const externalStoragePath = 'certificates/other-project/cert-not-owned.pdf';
        const supabaseFileUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/${externalStoragePath}`;

        const doc = await prisma.document.create({
          data: {
            projectId,
            documentType: 'test_certificate',
            category: 'test_results',
            filename: 'not-owned-cert.pdf',
            fileUrl: supabaseFileUrl,
            fileSize: 100,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
        });
        docId = doc.id;

        const tr = await prisma.testResult.create({
          data: {
            projectId,
            testType: 'CBR Test',
            certificateDocId: doc.id,
          },
        });
        testResultToDeleteId = tr.id;

        const res = await request(app)
          .delete(`/api/test-results/${tr.id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(await prisma.testResult.findUnique({ where: { id: tr.id } })).toBeNull();
        expect(await prisma.document.findUnique({ where: { id: doc.id } })).toBeNull();
        expect(mockRemove).not.toHaveBeenCalled();
        testResultToDeleteId = undefined;
        docId = undefined;
      } finally {
        if (testResultToDeleteId) {
          await prisma.testResult.deleteMany({ where: { id: testResultToDeleteId } });
        }
        if (docId) {
          await prisma.document.deleteMany({ where: { id: docId } });
        }
        if (previousSupabaseUrl === undefined) {
          delete process.env.SUPABASE_URL;
        } else {
          process.env.SUPABASE_URL = previousSupabaseUrl;
        }
        mockIsSupabaseConfigured.mockReset();
        mockIsSupabaseConfigured.mockReturnValue(false);
        mockGetSupabaseClient.mockReset();
      }
    });
  });

  // Characterization of the CURRENT behavior of the extraction-confirmation
  // routes (PATCH /:id/confirm-extraction and POST /batch-confirm) ahead of a
  // planned handler extraction. These pin the exact response shapes, status
  // codes, AppError messages, and the per-item error swallowing in
  // batch-confirm so the refactor can be proven behavior-preserving. The two
  // handlers share applyTestResultCorrections, so the validation paths are
  // intentionally exercised on both. See
  // .gstack/dev-browser/test-results-big-refactor-plan-2026-05-30.md (PR-D).
  async function createPendingExtractionTestResult() {
    return prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testType: `Pending Extraction ${Date.now()}-${Math.random().toString(36).slice(2)}`,
        status: 'pending_extraction',
        aiExtracted: true,
        // Ticket T2: a real AI-extracted certificate lands with a result value
        // and a pass/fail outcome already populated. Seed both so confirming
        // (which moves the row to 'entered') satisfies the RESULT_REQUIRED gate
        // even when the confirmation supplies no overriding corrections.
        resultValue: 98.0,
        passFail: 'pass',
      },
    });
  }

  describe('PATCH /api/test-results/:id/confirm-extraction', () => {
    it('confirms an extraction, applies corrections, and moves status to entered', async () => {
      const testResult = await createPendingExtractionTestResult();

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            corrections: {
              testType: 'Compaction Test',
              laboratoryName: 'ABC Testing Labs',
              resultValue: '97.5',
              resultUnit: '% MDD',
              specificationMin: '95',
              specificationMax: '100',
              sampleDate: '2026-02-10',
              passFail: 'pass',
            },
          });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Extraction confirmed and test result saved');
        expect(res.body.nextStep).toEqual({
          status: 'entered',
          message: 'Test result is now entered and ready for verification',
        });
        // Corrections are applied to the persisted record via the response shape.
        expect(res.body.testResult).toMatchObject({
          id: testResult.id,
          testType: 'Compaction Test',
          laboratoryName: 'ABC Testing Labs',
          resultUnit: '% MDD',
          passFail: 'pass',
          status: 'entered',
          aiExtracted: true,
        });
        // resultValue/specificationMin/specificationMax are returned as numbers.
        expect(Number(res.body.testResult.resultValue)).toBe(97.5);
        expect(Number(res.body.testResult.specificationMin)).toBe(95);
        expect(Number(res.body.testResult.specificationMax)).toBe(100);
        // enteredBy is stamped from the confirming user, enteredAt is set.
        expect(res.body.testResult.enteredBy).toEqual({ fullName: 'Test Results User' });
        expect(res.body.testResult.enteredAt).not.toBeNull();

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, enteredById: true, enteredAt: true, testType: true },
        });
        expect(persisted.status).toBe('entered');
        expect(persisted.enteredById).toBe(userId);
        expect(persisted.enteredAt).not.toBeNull();
        expect(persisted.testType).toBe('Compaction Test');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('persists a reviewed lot correction when confirming an AI certificate', async () => {
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          testType: `Unlinked Extraction ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'pending_extraction',
          aiExtracted: true,
          resultValue: 98.0,
          passFail: 'pass',
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { lotId } });

        expect(res.status).toBe(200);

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { lotId: true, status: true },
        });
        expect(persisted.lotId).toBe(lotId);
        expect(persisted.status).toBe('entered');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('rejects lot corrections outside the test result project', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Other Test Results Project ${Date.now()}`,
          projectNumber: `TR-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProject.id,
          lotNumber: `OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          testType: `Cross Project Lot Extraction ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'pending_extraction',
          aiExtracted: true,
          resultValue: 98.0,
          passFail: 'pass',
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { lotId: otherLot.id } });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Lot not found');

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { lotId: true, status: true },
        });
        expect(persisted.lotId).toBeNull();
        expect(persisted.status).toBe('pending_extraction');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await prisma.lot.deleteMany({ where: { projectId: otherProject.id } });
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('blocks confirming extraction corrections against a verified test result', async () => {
      const verifiedAt = new Date('2026-08-09T10:11:12.000Z');
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Verified Extraction ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'verified',
          aiExtracted: true,
          resultValue: 98.0,
          passFail: 'pass',
          enteredById: userId,
          enteredAt: new Date(),
          verifiedById: userId,
          verifiedAt,
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { resultValue: '80', passFail: 'fail' } });

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('Verified test results cannot be confirmed');

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: {
            status: true,
            resultValue: true,
            passFail: true,
            verifiedById: true,
            verifiedAt: true,
          },
        });
        expect(unchanged.status).toBe('verified');
        expect(Number(unchanged.resultValue)).toBe(98);
        expect(unchanged.passFail).toBe('pass');
        expect(unchanged.verifiedById).toBe(userId);
        expect(unchanged.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('confirms with no corrections payload and still moves status to entered', async () => {
      // Ticket T2: the seeded row already carries an AI-extracted result + pass/
      // fail, so confirming with no overriding corrections still satisfies the
      // RESULT_REQUIRED gate and reaches 'entered'.
      const testResult = await createPendingExtractionTestResult();

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(res.status).toBe(200);
        expect(res.body.testResult.status).toBe('entered');
        expect(res.body.nextStep.status).toBe('entered');

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, enteredById: true },
        });
        expect(persisted.status).toBe('entered');
        expect(persisted.enteredById).toBe(userId);
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('blocks confirming an extraction with no recorded result (Ticket T2)', async () => {
      // A pending-extraction row with NO result value / pending pass-fail and no
      // overriding correction must not reach 'entered'.
      const testResult = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Blank Extraction ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'pending_extraction',
          aiExtracted: true,
        },
      });

      try {
        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { laboratoryName: 'ABC Labs' } });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('RESULT_REQUIRED');

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, enteredById: true },
        });
        expect(persisted.status).toBe('pending_extraction');
        expect(persisted.enteredById).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('rejects invalid correction values with a 400 before persisting', async () => {
      const testResult = await createPendingExtractionTestResult();

      try {
        const invalidNumberRes = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { resultValue: '95abc' } });

        const invalidDateRes = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { sampleDate: '2026-02-31' } });

        const invalidPassFailRes = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ corrections: { passFail: 'maybe' } });

        expect(invalidNumberRes.status).toBe(400);
        expect(invalidNumberRes.body.error.code).toBe('VALIDATION_ERROR');
        expect(invalidNumberRes.body.error.message).toContain('resultValue');

        expect(invalidDateRes.status).toBe(400);
        expect(invalidDateRes.body.error.message).toContain('sampleDate');

        expect(invalidPassFailRes.status).toBe(400);
        expect(invalidPassFailRes.body.error.message).toContain('passFail');

        // The record stays in its pre-confirmation state on validation failure.
        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true, enteredById: true },
        });
        expect(persisted.status).toBe('pending_extraction');
        expect(persisted.enteredById).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
      }
    });

    it('returns 404 when the test result does not exist', async () => {
      const res = await request(app)
        .patch('/api/test-results/non-existent-id/confirm-extraction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ corrections: {} });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Test result not found');
    });

    it('returns 403 for project members without creator rights', async () => {
      const viewer = await registerTestUser('Confirm Extraction Viewer', 'foreman', companyId);
      const testResult = await createPendingExtractionTestResult();

      try {
        await prisma.projectUser.create({
          data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
        });

        const res = await request(app)
          .patch(`/api/test-results/${testResult.id}/confirm-extraction`)
          .set('Authorization', `Bearer ${viewer.token}`)
          .send({ corrections: { testType: 'Compaction Test' } });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(res.body.error.message).toBe('You do not have permission to confirm test results');

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: testResult.id },
          select: { status: true },
        });
        expect(persisted.status).toBe('pending_extraction');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: testResult.id } });
        await cleanupTestUser(viewer.userId);
      }
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .patch('/api/test-results/some-id/confirm-extraction')
        .send({ corrections: {} });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/test-results/batch-confirm', () => {
    it('confirms multiple extractions and reports a success summary', async () => {
      const first = await createPendingExtractionTestResult();
      const second = await createPendingExtractionTestResult();

      try {
        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            confirmations: [
              { testResultId: first.id, corrections: { resultValue: '98.1' } },
              { testResultId: second.id, corrections: { passFail: 'pass' } },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Confirmed 2 of 2 test results');
        expect(res.body.summary).toEqual({ total: 2, success: 2, failed: 0 });
        expect(res.body.results).toHaveLength(2);
        expect(res.body.results[0]).toEqual({
          success: true,
          testResultId: first.id,
          testResult: { id: first.id, testType: first.testType, status: 'entered' },
        });
        expect(res.body.results[1].success).toBe(true);
        expect(res.body.results[1].testResult.status).toBe('entered');

        const persisted = await prisma.testResult.findMany({
          where: { id: { in: [first.id, second.id] } },
          select: { id: true, status: true, enteredById: true },
        });
        expect(persisted.every((row) => row.status === 'entered')).toBe(true);
        expect(persisted.every((row) => row.enteredById === userId)).toBe(true);
      } finally {
        await prisma.testResult.deleteMany({ where: { id: { in: [first.id, second.id] } } });
      }
    });

    it('persists reviewed lot corrections during batch confirmation', async () => {
      const target = await prisma.testResult.create({
        data: {
          projectId,
          testType: `Batch Unlinked Extraction ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'pending_extraction',
          aiExtracted: true,
          resultValue: 98.0,
          passFail: 'pass',
        },
      });

      try {
        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            confirmations: [{ testResultId: target.id, corrections: { lotId } }],
          });

        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({ total: 1, success: 1, failed: 0 });

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: target.id },
          select: { lotId: true, status: true },
        });
        expect(persisted.lotId).toBe(lotId);
        expect(persisted.status).toBe('entered');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: target.id } });
      }
    });

    it('records a verified test result as a per-item failure without mutating it', async () => {
      const verifiedAt = new Date('2026-09-10T11:12:13.000Z');
      const target = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Verified Batch ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'verified',
          aiExtracted: true,
          resultValue: 98.0,
          passFail: 'pass',
          enteredById: userId,
          enteredAt: new Date(),
          verifiedById: userId,
          verifiedAt,
        },
      });

      try {
        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            confirmations: [
              { testResultId: target.id, corrections: { resultValue: '80', passFail: 'fail' } },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({ total: 1, success: 0, failed: 1 });
        expect(res.body.results[0]).toEqual({
          success: false,
          testResultId: target.id,
          error: 'Failed to confirm',
        });

        const unchanged = await prisma.testResult.findUniqueOrThrow({
          where: { id: target.id },
          select: {
            status: true,
            resultValue: true,
            passFail: true,
            verifiedById: true,
            verifiedAt: true,
          },
        });
        expect(unchanged.status).toBe('verified');
        expect(Number(unchanged.resultValue)).toBe(98);
        expect(unchanged.passFail).toBe('pass');
        expect(unchanged.verifiedById).toBe(userId);
        expect(unchanged.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
      } finally {
        await prisma.testResult.deleteMany({ where: { id: target.id } });
      }
    });

    it('reports per-item failures without aborting the whole batch', async () => {
      const ok = await createPendingExtractionTestResult();

      try {
        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            confirmations: [
              { testResultId: ok.id, corrections: {} },
              { testResultId: 'missing-test-result', corrections: {} },
              { corrections: {} },
            ],
          });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Confirmed 1 of 3 test results');
        expect(res.body.summary).toEqual({ total: 3, success: 1, failed: 2 });

        expect(res.body.results[0]).toMatchObject({ success: true, testResultId: ok.id });
        // Unknown id: caught and reported, not thrown.
        expect(res.body.results[1]).toEqual({
          success: false,
          testResultId: 'missing-test-result',
          error: 'Test result not found',
        });
        // Missing/invalid testResultId: reported with an empty id.
        expect(res.body.results[2]).toEqual({
          success: false,
          testResultId: '',
          error: 'Invalid test result id',
        });

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: ok.id },
          select: { status: true },
        });
        expect(persisted.status).toBe('entered');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: ok.id } });
      }
    });

    it('swallows correction validation errors into a per-item failure', async () => {
      const target = await createPendingExtractionTestResult();

      try {
        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            confirmations: [{ testResultId: target.id, corrections: { resultValue: '95abc' } }],
          });

        // Unlike confirm-extraction (which returns 400), batch-confirm catches
        // the AppError thrown by applyTestResultCorrections and records a
        // generic per-item failure instead of failing the request.
        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({ total: 1, success: 0, failed: 1 });
        expect(res.body.results[0]).toEqual({
          success: false,
          testResultId: target.id,
          error: 'Failed to confirm',
        });

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: target.id },
          select: { status: true, enteredById: true },
        });
        expect(persisted.status).toBe('pending_extraction');
        expect(persisted.enteredById).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: target.id } });
      }
    });

    it('records a blank-result item as a per-item failure (Ticket T2)', async () => {
      // A pending-extraction row with no result + no overriding correction is
      // swallowed as a per-item failure rather than reaching 'entered'.
      const target = await prisma.testResult.create({
        data: {
          projectId,
          lotId,
          testType: `Blank Batch ${Date.now()}-${Math.random().toString(36).slice(2)}`,
          status: 'pending_extraction',
          aiExtracted: true,
        },
      });

      try {
        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ confirmations: [{ testResultId: target.id, corrections: {} }] });

        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({ total: 1, success: 0, failed: 1 });
        expect(res.body.results[0]).toEqual({
          success: false,
          testResultId: target.id,
          error: 'Failed to confirm',
        });

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: target.id },
          select: { status: true, enteredById: true },
        });
        expect(persisted.status).toBe('pending_extraction');
        expect(persisted.enteredById).toBeNull();
      } finally {
        await prisma.testResult.deleteMany({ where: { id: target.id } });
      }
    });

    it('records a permission failure per item for non-creator roles', async () => {
      const viewer = await registerTestUser('Batch Confirm Viewer', 'foreman', companyId);
      const target = await createPendingExtractionTestResult();

      try {
        await prisma.projectUser.create({
          data: { projectId, userId: viewer.userId, role: 'viewer', status: 'active' },
        });

        const res = await request(app)
          .post('/api/test-results/batch-confirm')
          .set('Authorization', `Bearer ${viewer.token}`)
          .send({ confirmations: [{ testResultId: target.id, corrections: {} }] });

        expect(res.status).toBe(200);
        expect(res.body.summary).toEqual({ total: 1, success: 0, failed: 1 });
        expect(res.body.results[0]).toEqual({
          success: false,
          testResultId: target.id,
          error: 'No permission',
        });

        const persisted = await prisma.testResult.findUniqueOrThrow({
          where: { id: target.id },
          select: { status: true },
        });
        expect(persisted.status).toBe('pending_extraction');
      } finally {
        await prisma.testResult.deleteMany({ where: { id: target.id } });
        await cleanupTestUser(viewer.userId);
      }
    });

    it('rejects a request with a missing or empty confirmations array', async () => {
      const missingRes = await request(app)
        .post('/api/test-results/batch-confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      const emptyRes = await request(app)
        .post('/api/test-results/batch-confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmations: [] });

      const nonArrayRes = await request(app)
        .post('/api/test-results/batch-confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ confirmations: 'nope' });

      for (const res of [missingRes, emptyRes, nonArrayRes]) {
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        expect(res.body.error.message).toBe('confirmations array is required');
      }
    });

    it('requires authentication', async () => {
      const res = await request(app)
        .post('/api/test-results/batch-confirm')
        .send({ confirmations: [{ testResultId: 'x', corrections: {} }] });

      expect(res.status).toBe(401);
    });
  });
});

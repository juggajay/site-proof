import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

// Import test results router
import { testResultsRouter } from './testResults.js';

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

function hasUnsafeFilenameChar(filename: string): boolean {
  return filename.split('').some((char) => char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char));
}

function findNewFilesWithContent(beforeFiles: Set<string>, content: Buffer): string[] {
  return fs
    .readdirSync(certificatesDir)
    .filter((file) => !beforeFiles.has(file))
    .filter((file) => fs.readFileSync(path.join(certificatesDir, file)).equals(content));
}

async function registerTestUser(fullName: string, roleInCompany: string, companyId: string) {
  const email = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    fullName,
    tosAccepted: true,
  });

  await prisma.user.update({
    where: { id: res.body.user.id },
    data: { companyId, roleInCompany },
  });

  return { token: res.body.token as string, userId: res.body.user.id as string };
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
  });

  async function createEnteredTestResult() {
    return prisma.testResult.create({
      data: {
        projectId,
        lotId,
        testType: `Rejectable Test ${Date.now()}`,
        status: 'entered',
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
        companyId,
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
      trackCertificateFile(res.body.testResult.certificateDoc?.fileUrl);

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
      trackCertificateFile(res.body.testResult.certificateDoc?.fileUrl);
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
      trackCertificateFile(res.body.testResult.certificateDoc?.fileUrl);

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
      trackCertificateFile(res.body.testResult.certificateDoc?.fileUrl);

      const certificateDoc = res.body.testResult.certificateDoc;
      expect(certificateDoc.filename).toMatch(/\.pdf$/);
      expect(hasUnsafeFilenameChar(certificateDoc.filename)).toBe(false);
      expect(certificateDoc.filename).not.toContain('..');
      expect(hasUnsafeFilenameChar(path.basename(certificateDoc.fileUrl))).toBe(false);
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
        companyId,
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
        companyId,
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

    it('should reject invalid status transition', async () => {
      const res = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'verified', // Can't go directly to verified
        });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/test-results/:id', () => {
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
  });
});

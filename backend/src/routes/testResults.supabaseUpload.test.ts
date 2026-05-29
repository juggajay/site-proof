import fs from 'fs';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';

const mockUpload = vi.hoisted(() => vi.fn());
const mockGetSupabaseClient = vi.hoisted(() => vi.fn());
const mockGetSupabasePublicUrl = vi.hoisted(() =>
  vi.fn(
    (bucket: string, storagePath: string) =>
      `https://fixture.supabase.co/storage/v1/object/public/${bucket}/${storagePath}`,
  ),
);

vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
    getSupabaseClient: mockGetSupabaseClient,
    getSupabasePublicUrl: mockGetSupabasePublicUrl,
  };
});

// Import after the Supabase mock is registered. The router chooses memory vs
// disk multer storage during module initialization.
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

const certificatesDir = path.join(process.cwd(), 'uploads', 'certificates');

let authToken: string;
let userId: string;
let companyId: string;
let projectId: string;

function restoreOptionalEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function findNewFilesWithContent(beforeFiles: Set<string>, content: Buffer): string[] {
  return fs
    .readdirSync(certificatesDir)
    .filter((file) => !beforeFiles.has(file))
    .filter((file) => fs.readFileSync(path.join(certificatesDir, file)).equals(content));
}

describe('Test Results API Supabase certificate uploads', () => {
  beforeAll(async () => {
    fs.mkdirSync(certificatesDir, { recursive: true });

    const company = await prisma.company.create({
      data: { name: `Supabase Upload Company ${Date.now()}` },
    });
    companyId = company.id;

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `supabase-upload-${Date.now()}@example.com`,
        password: TEST_PASSWORD,
        fullName: 'Supabase Upload User',
        tosAccepted: true,
      });
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const project = await prisma.project.create({
      data: {
        name: `Supabase Upload Project ${Date.now()}`,
        projectNumber: `SUP-${Date.now()}`,
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
  });

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_TEST_CERT_MODEL;

    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ data: { path: 'unused' }, error: null });
    mockGetSupabaseClient.mockReset();
    mockGetSupabaseClient.mockReturnValue({
      storage: {
        from: () => ({
          upload: mockUpload,
        }),
      },
    });
    mockGetSupabasePublicUrl.mockClear();
  });

  afterAll(async () => {
    restoreOptionalEnv('ANTHROPIC_API_KEY', ORIGINAL_ANTHROPIC_API_KEY);
    restoreOptionalEnv('ANTHROPIC_MODEL', ORIGINAL_ANTHROPIC_MODEL);
    restoreOptionalEnv('ANTHROPIC_TEST_CERT_MODEL', ORIGINAL_ANTHROPIC_TEST_CERT_MODEL);

    await prisma.testResult.deleteMany({ where: { projectId } });
    await prisma.document.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('streams certificate uploads to Supabase memory storage without writing a local file', async () => {
    const certificateBytes = Buffer.from('%PDF-1.4\nsupabase certificate\n%%EOF');
    const beforeFiles = new Set(fs.readdirSync(certificatesDir));

    const res = await request(app)
      .post('/api/test-results/upload-certificate')
      .set('Authorization', `Bearer ${authToken}`)
      .field('projectId', projectId)
      .attach('certificate', certificateBytes, {
        filename: 'supabase-compaction-certificate.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(201);
    expect(res.body.testResult.certificateDoc.fileUrl).toContain(
      `https://fixture.supabase.co/storage/v1/object/public/documents/certificates/${projectId}/cert-`,
    );
    expect(findNewFilesWithContent(beforeFiles, certificateBytes)).toHaveLength(0);

    expect(mockUpload).toHaveBeenCalledOnce();
    const [storagePath, uploadedBuffer, uploadOptions] = mockUpload.mock.calls[0]!;
    expect(storagePath).toMatch(new RegExp(`^certificates/${projectId}/cert-.+\\.pdf$`));
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
    expect(Buffer.compare(uploadedBuffer, certificateBytes)).toBe(0);
    expect(uploadOptions).toMatchObject({
      contentType: 'application/pdf',
      upsert: false,
    });
    expect(mockGetSupabasePublicUrl).toHaveBeenCalledWith('documents', storagePath);

    const savedDocument = await prisma.document.findUniqueOrThrow({
      where: { id: res.body.testResult.certificateDoc.id },
    });
    const savedTestResult = await prisma.testResult.findUniqueOrThrow({
      where: { id: res.body.testResult.id },
      include: { certificateDoc: true },
    });

    expect(savedDocument.fileUrl).toBe(res.body.testResult.certificateDoc.fileUrl);
    expect(savedDocument.filename).toBe('supabase-compaction-certificate.pdf');
    expect(savedDocument.fileSize).toBe(certificateBytes.length);
    expect(savedDocument.mimeType).toBe('application/pdf');
    expect(savedTestResult.certificateDocId).toBe(savedDocument.id);
    expect(savedTestResult.certificateDoc?.fileUrl).toBe(savedDocument.fileUrl);
  });
});

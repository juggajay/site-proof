import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { AppError } from '../../lib/AppError.js';
import {
  processCertificateAttachment,
  type ExistingTestResultForAttachment,
} from './certificateAttachment.js';

// Track scratch files so a failed assertion never leaves temp data behind.
const tempPaths: string[] = [];

function createTempFile(contents = 'certificate'): string {
  const filePath = path.join(
    os.tmpdir(),
    `certattach-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
  );
  fs.writeFileSync(filePath, contents);
  tempPaths.push(filePath);
  return filePath;
}

function makeUploadedFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'certificate',
    originalname: 'cert.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 11,
    destination: '',
    filename: 'cert-stored.pdf',
    path: '',
    buffer: Buffer.alloc(0),
    stream: Readable.from([]),
    ...overrides,
  };
}

const existingTest: ExistingTestResultForAttachment = {
  projectId: 'p1',
  certificateDocId: null,
  certificateDoc: null,
};

afterEach(() => {
  for (const filePath of tempPaths.splice(0)) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// These cases all short-circuit before any Prisma/Supabase call, so they are
// safe to run locally (the DB-backed happy/replace/role paths live in the
// CI-only integration suite, backend/src/routes/testResults.test.ts).
describe('processCertificateAttachment — early cleanup-on-error', () => {
  it('rejects when no file was uploaded', async () => {
    await expect(
      processCertificateAttachment({
        testResultId: 't1',
        file: undefined,
        userId: 'u1',
        loadTestResult: async () => existingTest,
        authorize: async () => {},
      }),
    ).rejects.toThrow('No file uploaded');
  });

  it('rejects with a 400 when no file was uploaded', async () => {
    let captured: unknown;
    try {
      await processCertificateAttachment({
        testResultId: 't1',
        file: undefined,
        userId: 'u1',
        loadTestResult: async () => existingTest,
        authorize: async () => {},
      });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(AppError);
    expect((captured as AppError).statusCode).toBe(400);
  });

  it('deletes the upload and 404s when the test result is missing', async () => {
    const filePath = createTempFile();

    let captured: unknown;
    try {
      await processCertificateAttachment({
        testResultId: 'missing',
        file: makeUploadedFile({ path: filePath }),
        userId: 'u1',
        loadTestResult: async () => null,
        authorize: async () => {},
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect((captured as AppError).statusCode).toBe(404);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('deletes the upload and rethrows when loadTestResult throws', async () => {
    const filePath = createTempFile();

    await expect(
      processCertificateAttachment({
        testResultId: 't1',
        file: makeUploadedFile({ path: filePath }),
        userId: 'u1',
        loadTestResult: async () => {
          throw new Error('DB exploded');
        },
        authorize: async () => {},
      }),
    ).rejects.toThrow('DB exploded');

    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('deletes the upload and rethrows when authorization is denied', async () => {
    const filePath = createTempFile();

    await expect(
      processCertificateAttachment({
        testResultId: 't1',
        file: makeUploadedFile({ path: filePath }),
        userId: 'u1',
        loadTestResult: async () => existingTest,
        authorize: async () => {
          throw new Error('Access denied');
        },
      }),
    ).rejects.toThrow('Access denied');

    expect(fs.existsSync(filePath)).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { AppError } from '../../lib/AppError.js';

// AT-78 drives the write path, which is the only part of this module that talks
// to Prisma. The cleanup-on-error cases below all short-circuit before it, so
// they are unaffected by the mock.
const mockTransaction = vi.hoisted(() => vi.fn());
const mockTxFindUnique = vi.hoisted(() => vi.fn());

vi.mock('../../lib/prisma.js', () => ({
  prisma: { $transaction: mockTransaction },
}));

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
  status: 'entered',
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

beforeEach(() => {
  mockTransaction.mockReset();
  mockTxFindUnique.mockReset();
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

  it('deletes the upload and returns 409 before replacing a verified certificate', async () => {
    const filePath = createTempFile();
    let captured: unknown;

    try {
      await processCertificateAttachment({
        testResultId: 't1',
        file: makeUploadedFile({ path: filePath }),
        userId: 'u1',
        loadTestResult: async () => ({ ...existingTest, status: 'verified' }),
        authorize: async () => {},
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect((captured as AppError).statusCode).toBe(409);
    expect((captured as AppError).message).toContain('Verified test result certificates');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

// AT-78 [C2R-A6]: the pre-transaction guard reads the row, then storage happens,
// then the swap commits. A verify landing in that window would otherwise replace
// the evidence under a verified result. The guard is re-read inside the
// transaction, so the commit is what decides.
describe('processCertificateAttachment — the verified guard is transaction-scoped (AT-78)', () => {
  // A row that passes the pre-read guard: not verified when the request starts.
  const notYetVerified: ExistingTestResultForAttachment = {
    projectId: 'p1',
    status: 'requested',
    certificateDocId: null,
    certificateDoc: null,
  };

  function pdfUpload() {
    const filePath = createTempFile();
    fs.writeFileSync(filePath, '%PDF-1.4\nin-tx guard\n%%EOF');
    return makeUploadedFile({
      path: filePath,
      buffer: undefined,
      filename: path.basename(filePath),
    });
  }

  it('409s and writes nothing when the row is verified by the time the transaction runs', async () => {
    // The row flips to verified between the pre-read and the commit.
    mockTxFindUnique.mockResolvedValue({ status: 'verified' });
    const documentCreate = vi.fn();
    const testResultUpdate = vi.fn();

    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        testResult: { findUnique: mockTxFindUnique, update: testResultUpdate },
        document: { create: documentCreate, delete: vi.fn() },
      }),
    );

    let captured: unknown;
    try {
      await processCertificateAttachment({
        testResultId: 't1',
        file: pdfUpload(),
        userId: 'u1',
        loadTestResult: async () => notYetVerified,
        authorize: async () => {},
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(AppError);
    expect((captured as AppError).statusCode).toBe(409);
    // The guard fires before anything is written: no Document row, no swap.
    expect(documentCreate).not.toHaveBeenCalled();
    expect(testResultUpdate).not.toHaveBeenCalled();
  });

  it('commits the swap when the row is still unverified inside the transaction', async () => {
    mockTxFindUnique.mockResolvedValue({ status: 'requested' });
    const documentCreate = vi.fn(async () => ({ id: 'doc-1' }));
    const testResultUpdate = vi.fn(async () => ({
      id: 't1',
      testType: 'Field Density (Nuclear)',
      status: 'requested',
      certificateDoc: { id: 'doc-1', filename: 'cert.pdf', mimeType: 'application/pdf' },
    }));

    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        testResult: { findUnique: mockTxFindUnique, update: testResultUpdate },
        document: { create: documentCreate, delete: vi.fn() },
      }),
    );

    const result = await processCertificateAttachment({
      testResultId: 't1',
      file: pdfUpload(),
      userId: 'u1',
      loadTestResult: async () => notYetVerified,
      authorize: async () => {},
    });

    expect(result.testResult.id).toBe('t1');
    expect(documentCreate).toHaveBeenCalledTimes(1);
    // AT-76 at the unit level: certificateDocId is the ONLY column written.
    expect(testResultUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { certificateDocId: 'doc-1' } }),
    );
    // Not asked to extract, so no extraction is offered for review.
    expect(result).not.toHaveProperty('extraction');
  });
});

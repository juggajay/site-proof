import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { AppError } from '../../lib/AppError.js';
import { MAX_UPLOAD_PROJECT_ID_LENGTH } from './validation.js';
import {
  cleanupUploadedCertificateFiles,
  getRequiredUploadProjectId,
  processBatchCertificateUpload,
  processCertificateUpload,
} from './certificateIntake.js';

// Track scratch files so a failed assertion never leaves temp data behind.
const tempPaths: string[] = [];

function createTempFile(contents = 'certificate'): string {
  const filePath = path.join(
    os.tmpdir(),
    `certintake-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
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

afterEach(() => {
  for (const filePath of tempPaths.splice(0)) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

describe('getRequiredUploadProjectId', () => {
  it('returns the trimmed projectId for a valid string', () => {
    expect(getRequiredUploadProjectId({ projectId: '  proj-123  ' })).toBe('proj-123');
  });

  it('rejects a missing projectId with a 400 validation error', () => {
    let captured: unknown;
    try {
      getRequiredUploadProjectId({});
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(AppError);
    expect((captured as AppError).statusCode).toBe(400);
    expect((captured as AppError).message).toBe('projectId is required');
  });

  it('rejects a non-string projectId', () => {
    expect(() => getRequiredUploadProjectId({ projectId: 42 })).toThrow('projectId is required');
  });

  it('rejects an empty / whitespace-only projectId', () => {
    expect(() => getRequiredUploadProjectId({ projectId: '   ' })).toThrow('projectId is required');
  });

  it('rejects an over-length projectId', () => {
    const tooLong = 'x'.repeat(MAX_UPLOAD_PROJECT_ID_LENGTH + 1);
    expect(() => getRequiredUploadProjectId({ projectId: tooLong })).toThrow(
      'projectId is too long',
    );
  });
});

describe('cleanupUploadedCertificateFiles', () => {
  it('removes every uploaded temp file from disk', () => {
    const first = createTempFile();
    const second = createTempFile();

    cleanupUploadedCertificateFiles([
      makeUploadedFile({ path: first }),
      makeUploadedFile({ path: second }),
    ]);

    expect(fs.existsSync(first)).toBe(false);
    expect(fs.existsSync(second)).toBe(false);
  });

  it('tolerates path-less files and an empty list', () => {
    expect(() => cleanupUploadedCertificateFiles([])).not.toThrow();
    expect(() => cleanupUploadedCertificateFiles([makeUploadedFile({ path: '' })])).not.toThrow();
  });
});

describe('processCertificateUpload — early cleanup-on-error', () => {
  it('rejects when no file was uploaded', async () => {
    await expect(
      processCertificateUpload({
        file: undefined,
        body: { projectId: 'p1' },
        userId: 'u1',
        authorize: async () => {},
      }),
    ).rejects.toThrow('No file uploaded');
  });

  it('deletes the upload and rethrows when projectId is missing', async () => {
    const filePath = createTempFile();

    await expect(
      processCertificateUpload({
        file: makeUploadedFile({ path: filePath }),
        body: {},
        userId: 'u1',
        authorize: async () => {},
      }),
    ).rejects.toThrow('projectId is required');

    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('deletes the upload and rethrows when authorization is denied', async () => {
    const filePath = createTempFile();

    await expect(
      processCertificateUpload({
        file: makeUploadedFile({ path: filePath }),
        body: { projectId: 'p1' },
        userId: 'u1',
        authorize: async () => {
          throw new Error('Access denied');
        },
      }),
    ).rejects.toThrow('Access denied');

    expect(fs.existsSync(filePath)).toBe(false);
  });
});

describe('processBatchCertificateUpload — early cleanup-on-error', () => {
  it('rejects when no files were uploaded', async () => {
    await expect(
      processBatchCertificateUpload({
        files: [],
        body: { projectId: 'p1' },
        userId: 'u1',
        authorize: async () => {},
      }),
    ).rejects.toThrow('No files uploaded');
  });

  it('deletes every upload and rethrows when authorization is denied', async () => {
    const first = createTempFile();
    const second = createTempFile();

    await expect(
      processBatchCertificateUpload({
        files: [makeUploadedFile({ path: first }), makeUploadedFile({ path: second })],
        body: { projectId: 'p1' },
        userId: 'u1',
        authorize: async () => {
          throw new Error('Access denied');
        },
      }),
    ).rejects.toThrow('Access denied');

    expect(fs.existsSync(first)).toBe(false);
    expect(fs.existsSync(second)).toBe(false);
  });
});

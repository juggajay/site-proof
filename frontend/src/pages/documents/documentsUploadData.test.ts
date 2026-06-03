import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The upload orchestration calls the network through authFetch and reports
// problems through logError. Mock only those boundaries; the pure helpers stay
// real so the loop is exercised end to end. authFetch is stubbed via a partial
// mock so the module's other exports (e.g. ApiError, which extractErrorMessage
// relies on) keep their real implementations.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, authFetch: vi.fn() };
});
vi.mock('@/lib/logger', () => ({ logError: vi.fn() }));

import { authFetch } from '@/lib/api';
import {
  buildDocumentUploadFormData,
  buildPartialFailureMessage,
  buildUploadSuccessMessage,
  detectDocumentTypeFromFile,
  evaluateImageDimensions,
  formatFailedUpload,
  getResponseErrorMessage,
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
  uploadDocuments,
  type UploadDocumentForm,
} from './documentsUploadData';

const authFetchMock = vi.mocked(authFetch);

function makeFile(name: string, type: string): File {
  return new File(['x'], name, { type });
}

function okResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

function errorResponse(body: unknown): Response {
  return { ok: false, json: async () => body } as unknown as Response;
}

const baseForm: UploadDocumentForm = {
  documentType: 'photo',
  category: '',
  caption: '',
  lotId: '',
};

describe('detectDocumentTypeFromFile', () => {
  it('maps any image type to photo', () => {
    expect(detectDocumentTypeFromFile(makeFile('a.png', 'image/png'))).toBe('photo');
    expect(detectDocumentTypeFromFile(makeFile('a.webp', 'image/webp'))).toBe('photo');
  });

  it('maps pdf to drawing', () => {
    expect(detectDocumentTypeFromFile(makeFile('a.pdf', 'application/pdf'))).toBe('drawing');
  });

  it('returns null for any other type (so the current selection is kept)', () => {
    expect(detectDocumentTypeFromFile(makeFile('a.docx', 'application/msword'))).toBeNull();
    expect(detectDocumentTypeFromFile(makeFile('a.txt', 'text/plain'))).toBeNull();
    expect(detectDocumentTypeFromFile(makeFile('a', ''))).toBeNull();
  });
});

describe('evaluateImageDimensions', () => {
  it('returns null when both dimensions meet the minimum', () => {
    expect(evaluateImageDimensions(MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT)).toBeNull();
    expect(evaluateImageDimensions(800, 600)).toBeNull();
  });

  it('warns when width is below the minimum', () => {
    expect(evaluateImageDimensions(50, 600)).toBe(
      `Warning: Image dimensions (50x600) are below recommended minimum (${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}). Photo may lack detail for documentation.`,
    );
  });

  it('warns when height is below the minimum', () => {
    expect(evaluateImageDimensions(600, 50)).toBe(
      `Warning: Image dimensions (600x50) are below recommended minimum (${MIN_IMAGE_WIDTH}x${MIN_IMAGE_HEIGHT}). Photo may lack detail for documentation.`,
    );
  });
});

describe('formatFailedUpload', () => {
  it('returns just the filename when there is no usable reason', () => {
    expect(formatFailedUpload('plan.pdf', '')).toBe('plan.pdf');
    expect(formatFailedUpload('plan.pdf', '   ')).toBe('plan.pdf');
    expect(formatFailedUpload('plan.pdf', 'Upload failed')).toBe('plan.pdf');
  });

  it('returns the reason as-is when it already mentions the filename', () => {
    expect(formatFailedUpload('plan.pdf', 'plan.pdf is too large')).toBe('plan.pdf is too large');
    // case-insensitive match
    expect(formatFailedUpload('Plan.PDF', 'plan.pdf rejected')).toBe('plan.pdf rejected');
  });

  it('prefixes the filename when the reason does not mention it', () => {
    expect(formatFailedUpload('plan.pdf', 'File too large')).toBe('plan.pdf: File too large');
  });

  it('trims surrounding whitespace from the reason', () => {
    expect(formatFailedUpload('plan.pdf', '  File too large  ')).toBe('plan.pdf: File too large');
  });
});

describe('getResponseErrorMessage', () => {
  it('uses a string error field', async () => {
    expect(await getResponseErrorMessage(errorResponse({ error: 'Boom' }), 'fallback')).toBe(
      'Boom',
    );
  });

  it('uses a nested error.message field', async () => {
    expect(
      await getResponseErrorMessage(errorResponse({ error: { message: 'Nested' } }), 'fallback'),
    ).toBe('Nested');
  });

  it('falls back to the message field', async () => {
    expect(await getResponseErrorMessage(errorResponse({ message: 'Msg' }), 'fallback')).toBe(
      'Msg',
    );
  });

  it('uses the provided fallback when nothing usable is present', async () => {
    expect(await getResponseErrorMessage(errorResponse({}), 'fallback')).toBe('fallback');
  });

  it('uses the provided fallback when the body is not JSON', async () => {
    const broken = {
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response;
    expect(await getResponseErrorMessage(broken, 'fallback')).toBe('fallback');
  });
});

describe('buildDocumentUploadFormData', () => {
  it('always includes file, projectId, and documentType', () => {
    const file = makeFile('a.pdf', 'application/pdf');
    const fd = buildDocumentUploadFormData({
      file,
      projectId: 'project-1',
      form: { ...baseForm, documentType: 'drawing' },
      totalFiles: 1,
    });
    expect(fd.get('file')).toBe(file);
    expect(fd.get('projectId')).toBe('project-1');
    expect(fd.get('documentType')).toBe('drawing');
  });

  it('coerces a missing projectId to an empty string', () => {
    const fd = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: undefined,
      form: baseForm,
      totalFiles: 1,
    });
    expect(fd.get('projectId')).toBe('');
  });

  it('includes category only when present', () => {
    const withCategory = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: { ...baseForm, category: 'quality' },
      totalFiles: 1,
    });
    expect(withCategory.get('category')).toBe('quality');

    const withoutCategory = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: { ...baseForm, category: '' },
      totalFiles: 1,
    });
    expect(withoutCategory.has('category')).toBe(false);
  });

  it('includes lotId only when present', () => {
    const withLot = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: { ...baseForm, lotId: 'lot-9' },
      totalFiles: 1,
    });
    expect(withLot.get('lotId')).toBe('lot-9');

    const withoutLot = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: baseForm,
      totalFiles: 1,
    });
    expect(withoutLot.has('lotId')).toBe(false);
  });

  it('includes a trimmed caption only for single-file uploads', () => {
    const single = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: { ...baseForm, caption: '  Hello  ' },
      totalFiles: 1,
    });
    expect(single.get('caption')).toBe('Hello');
  });

  it('omits the caption when uploading multiple files', () => {
    const multi = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: { ...baseForm, caption: 'Hello' },
      totalFiles: 3,
    });
    expect(multi.has('caption')).toBe(false);
  });

  it('omits a blank/whitespace caption even for a single file', () => {
    const blank = buildDocumentUploadFormData({
      file: makeFile('a.pdf', 'application/pdf'),
      projectId: 'p',
      form: { ...baseForm, caption: '   ' },
      totalFiles: 1,
    });
    expect(blank.has('caption')).toBe(false);
  });
});

describe('buildPartialFailureMessage', () => {
  it('summarises how many succeeded and lists the failures', () => {
    expect(buildPartialFailureMessage(1, 3, ['a.pdf: too big', 'b.pdf'])).toBe(
      'Uploaded 1 of 3. Failed: a.pdf: too big; b.pdf',
    );
  });
});

describe('buildUploadSuccessMessage', () => {
  it('uses the singular form for one file', () => {
    expect(buildUploadSuccessMessage(1)).toBe('1 file uploaded successfully.');
  });

  it('uses the plural form otherwise', () => {
    expect(buildUploadSuccessMessage(2)).toBe('2 files uploaded successfully.');
    expect(buildUploadSuccessMessage(0)).toBe('0 files uploaded successfully.');
  });
});

describe('uploadDocuments', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uploads every file and reports progress per file', async () => {
    authFetchMock
      .mockResolvedValueOnce(okResponse({ id: 'doc-1' }))
      .mockResolvedValueOnce(okResponse({ id: 'doc-2' }));
    const onProgress = vi.fn();

    const result = await uploadDocuments({
      files: [makeFile('a.pdf', 'application/pdf'), makeFile('b.pdf', 'application/pdf')],
      projectId: 'p',
      form: { ...baseForm, documentType: 'drawing' },
      onProgress,
    });

    expect(authFetchMock).toHaveBeenCalledTimes(2);
    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/documents/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
    expect(result.uploadedDocs).toEqual([{ id: 'doc-1' }, { id: 'doc-2' }]);
    expect(result.failedUploads).toEqual([]);
    expect(onProgress.mock.calls).toEqual([
      [1, 50],
      [2, 100],
    ]);
  });

  it('reports 100% for a single-file upload', async () => {
    authFetchMock.mockResolvedValueOnce(okResponse({ id: 'doc-1' }));
    const onProgress = vi.fn();

    await uploadDocuments({
      files: [makeFile('a.pdf', 'application/pdf')],
      projectId: 'p',
      form: { ...baseForm, documentType: 'drawing' },
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([[1, 100]]);
  });

  it('collects per-file failures from non-ok responses while keeping successes', async () => {
    authFetchMock
      .mockResolvedValueOnce(okResponse({ id: 'doc-1' }))
      .mockResolvedValueOnce(errorResponse({ error: 'File too large' }));
    const onProgress = vi.fn();

    const result = await uploadDocuments({
      files: [makeFile('ok.pdf', 'application/pdf'), makeFile('big.pdf', 'application/pdf')],
      projectId: 'p',
      form: { ...baseForm, documentType: 'drawing' },
      onProgress,
    });

    expect(result.uploadedDocs).toEqual([{ id: 'doc-1' }]);
    expect(result.failedUploads).toEqual(['big.pdf: File too large']);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it('collects failures from thrown network errors', async () => {
    authFetchMock.mockRejectedValueOnce(new Error('Network down'));
    const onProgress = vi.fn();

    const result = await uploadDocuments({
      files: [makeFile('a.pdf', 'application/pdf')],
      projectId: 'p',
      form: { ...baseForm, documentType: 'drawing' },
      onProgress,
    });

    expect(result.uploadedDocs).toEqual([]);
    expect(result.failedUploads).toEqual(['a.pdf: Network down']);
  });
});

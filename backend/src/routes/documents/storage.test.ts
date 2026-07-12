import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return {
    ...actual,
    getSupabaseClient: vi.fn(),
    isSupabaseConfigured: vi.fn(),
  };
});

import sharp from 'sharp';

import * as supabaseLib from '../../lib/supabase.js';
import { getSupabaseStorageReference } from '../../lib/supabase.js';
import {
  generateDocumentThumbnail,
  getOwnedDocumentStoragePath,
  isThumbnailableImageMimeType,
  loadDocumentImageAsBase64,
  THUMBNAIL_STORAGE_SUFFIX,
  uploadToSupabase,
} from './storage.js';

const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);
const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('document Supabase storage ownership', () => {
  it('accepts canonical storage references inside the document project prefix', () => {
    const reference = getSupabaseStorageReference('documents', 'project-a/evidence photo.jpg');

    expect(getOwnedDocumentStoragePath(reference, 'project-a')).toBe(
      'project-a/evidence photo.jpg',
    );
  });

  it('accepts canonical drawing and certificate references inside their scoped prefixes', () => {
    expect(
      getOwnedDocumentStoragePath(
        'supabase://documents/drawings/project-a/drawing.pdf',
        'project-a',
        'drawing',
      ),
    ).toBe('drawings/project-a/drawing.pdf');

    expect(
      getOwnedDocumentStoragePath(
        'supabase://documents/certificates/project-a/cert.pdf',
        'project-a',
        'test_certificate',
      ),
    ).toBe('certificates/project-a/cert.pdf');
  });

  it('rejects canonical storage references outside the document project prefixes', () => {
    expect(
      getOwnedDocumentStoragePath('supabase://documents/project-b/file.pdf', 'project-a'),
    ).toBeNull();
    expect(
      getOwnedDocumentStoragePath(
        'supabase://documents/drawings/project-b/drawing.pdf',
        'project-a',
        'drawing',
      ),
    ).toBeNull();
  });

  it('loads canonical storage reference images through Supabase', async () => {
    const download = vi.fn().mockResolvedValue({
      data: new Blob([Buffer.from('image bytes')], { type: 'image/png' }),
      error: null,
    });
    const from = vi.fn(() => ({ download }));

    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    await expect(
      loadDocumentImageAsBase64(
        {
          fileUrl: 'supabase://documents/project-a/photo.png',
          projectId: 'project-a',
          documentType: 'image',
        },
        'image/png',
      ),
    ).resolves.toBe(Buffer.from('image bytes').toString('base64'));

    expect(from).toHaveBeenCalledWith('documents');
    expect(download).toHaveBeenCalledWith('project-a/photo.png');
  });

  it('stores new Supabase document uploads as private storage references', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'unused' }, error: null });
    const from = vi.fn(() => ({ upload }));
    const buffer = Buffer.from('document bytes');

    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    const result = await uploadToSupabase(
      {
        originalname: 'Evidence Photo.png',
        mimetype: 'image/png',
        buffer,
      } as Express.Multer.File,
      'project-a',
      {
        buildStoredFilename: () => 'stored evidence.png',
        getSafeStoredDocumentMimeType: () => 'image/png',
      },
    );

    expect(result).toEqual({
      storagePath: 'project-a/stored evidence.png',
      url: 'supabase://documents/project-a/stored%20evidence.png',
    });
    expect(from).toHaveBeenCalledWith('documents');
    expect(upload).toHaveBeenCalledWith('project-a/stored evidence.png', buffer, {
      contentType: 'image/png',
      upsert: false,
    });
  });

  it('reports Supabase upload failures as temporary storage outages', async () => {
    const upload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'fetch failed' },
    });
    const from = vi.fn(() => ({ upload }));

    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    await expect(
      uploadToSupabase(
        {
          originalname: 'Evidence Photo.png',
          mimetype: 'image/png',
          buffer: Buffer.from('document bytes'),
        } as Express.Multer.File,
        'project-a',
        {
          buildStoredFilename: () => 'stored evidence.png',
          getSafeStoredDocumentMimeType: () => 'image/png',
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'UPLOAD_FAILED',
      message: 'File storage is unavailable. Please try again later.',
    });
  });
});

describe('generateDocumentThumbnail', () => {
  async function makeTinyPng(): Promise<Buffer> {
    return sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .png()
      .toBuffer();
  }

  it('identifies thumbnailable image mime types', () => {
    expect(isThumbnailableImageMimeType('image/jpeg')).toBe(true);
    expect(isThumbnailableImageMimeType('image/png')).toBe(true);
    expect(isThumbnailableImageMimeType('image/webp')).toBe(true);
    expect(isThumbnailableImageMimeType('application/pdf')).toBe(false);
    expect(isThumbnailableImageMimeType(null)).toBe(false);
  });

  it('writes a webp thumbnail beside the original at the derived storage key', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ upload }));
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    const fileUrl = getSupabaseStorageReference('documents', 'project-a/photo.jpg');

    await generateDocumentThumbnail({
      fileUrl,
      projectId: 'project-a',
      mimeType: 'image/jpeg',
      buffer: await makeTinyPng(),
    });

    expect(from).toHaveBeenCalledWith('documents');
    expect(upload).toHaveBeenCalledTimes(1);
    const [key, body, options] = upload.mock.calls[0];
    expect(key).toBe(`project-a/photo.jpg${THUMBNAIL_STORAGE_SUFFIX}`);
    expect(Buffer.isBuffer(body)).toBe(true);
    // A real webp thumbnail begins with the RIFF/WEBP container magic bytes.
    expect((body as Buffer).subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect((body as Buffer).subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(options).toMatchObject({ contentType: 'image/webp', upsert: true });
  });

  it('skips non-image mime types without touching storage', async () => {
    const upload = vi.fn();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    await generateDocumentThumbnail({
      fileUrl: getSupabaseStorageReference('documents', 'project-a/report.pdf'),
      projectId: 'project-a',
      mimeType: 'application/pdf',
      buffer: Buffer.from('not an image'),
    });

    expect(upload).not.toHaveBeenCalled();
  });

  it('never throws when sharp fails on an unreadable buffer (upload stays unaffected)', async () => {
    const upload = vi.fn();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockGetSupabaseClient.mockReturnValue({
      storage: { from: vi.fn(() => ({ upload })) },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    await expect(
      generateDocumentThumbnail({
        fileUrl: getSupabaseStorageReference('documents', 'project-a/photo.jpg'),
        projectId: 'project-a',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('this is not a decodable image'),
      }),
    ).resolves.toBeUndefined();

    expect(upload).not.toHaveBeenCalled();
  });
});

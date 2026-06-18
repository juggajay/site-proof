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

import * as supabaseLib from '../../lib/supabase.js';
import { getSupabaseStorageReference } from '../../lib/supabase.js';
import { getOwnedDocumentStoragePath, loadDocumentImageAsBase64 } from './storage.js';

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
});

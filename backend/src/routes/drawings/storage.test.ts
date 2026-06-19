import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase.js')>();
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
    getSupabaseClient: vi.fn(),
  };
});

import * as supabaseLib from '../../lib/supabase.js';
import { storeDrawingUpload } from './storage.js';

const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

beforeEach(() => {
  mockGetSupabaseClient.mockReset();
});

describe('drawing Supabase storage', () => {
  it('stores new drawing uploads as private storage references', async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: 'unused' }, error: null });
    const from = vi.fn(() => ({ upload }));
    const buffer = Buffer.from('drawing bytes');

    mockGetSupabaseClient.mockReturnValue({
      storage: { from },
    } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

    const result = await storeDrawingUpload(
      {
        originalname: 'Drawing A.pdf',
        mimetype: 'application/pdf',
        buffer,
      } as Express.Multer.File,
      'project-a',
    );

    expect(result).toMatch(/^supabase:\/\/documents\/drawings\/project-a\/.+-Drawing%20A\.pdf$/);
    expect(result).not.toContain('/storage/v1/object/public/');
    expect(from).toHaveBeenCalledWith('documents');
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^drawings\/project-a\/.+-Drawing A\.pdf$/),
      buffer,
      {
        contentType: 'application/pdf',
        upsert: false,
      },
    );
  });
});

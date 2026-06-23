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
import {
  isAllowedDrawingUpload,
  storeDrawingUpload,
  unsupportedDrawingMessage,
} from './storage.js';

const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

beforeEach(() => {
  mockGetSupabaseClient.mockReset();
});

describe('drawing upload filter (M49)', () => {
  it('accepts supported drawing files by extension or mime type', () => {
    expect(isAllowedDrawingUpload('plan.pdf', 'application/octet-stream')).toBe(true);
    expect(isAllowedDrawingUpload('survey.DWG', 'application/octet-stream')).toBe(true);
    expect(isAllowedDrawingUpload('scan', 'image/tiff')).toBe(true);
  });

  it('rejects unsupported files', () => {
    expect(isAllowedDrawingUpload('notes.txt', 'text/plain')).toBe(false);
    expect(isAllowedDrawingUpload('sheet.xlsx', 'application/vnd.ms-excel')).toBe(false);
  });

  it('builds a descriptive rejection naming the file and supported formats', () => {
    const message = unsupportedDrawingMessage('notes.txt');
    expect(message).toContain('notes.txt');
    expect(message).toMatch(/PDF, JPEG, PNG, TIFF, DWG, or DXF/);
  });
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

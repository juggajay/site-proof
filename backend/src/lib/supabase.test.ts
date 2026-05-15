import { afterEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('supabase storage client', () => {
  it('does not construct a Supabase client when credentials are missing', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const storage = await import('./supabase.js');

    expect(storage.isSupabaseConfigured()).toBe(false);
    expect(() => storage.getSupabaseClient()).toThrow('Supabase storage is not configured');
    expect(() => storage.getSupabasePublicUrl('documents', 'file.pdf')).toThrow(
      'Supabase storage is not configured',
    );
    expect(warn).toHaveBeenCalledWith(
      'Supabase credentials not configured. File storage will use local filesystem.',
    );
  });

  it('uses configured Supabase storage credentials', async () => {
    process.env.SUPABASE_URL = 'https://siteproof.supabase.co/';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'prod-supabase-service-role-key-32-plus-chars';
    delete process.env.SUPABASE_ANON_KEY;

    const storage = await import('./supabase.js');

    expect(storage.isSupabaseConfigured()).toBe(true);
    expect(storage.getSupabaseClient()).not.toBeNull();
    expect(storage.getSupabasePublicUrl('documents', 'project/file.pdf')).toBe(
      'https://siteproof.supabase.co/storage/v1/object/public/documents/project/file.pdf',
    );
    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/project/file.pdf',
      ),
    ).toBe('project/file.pdf');
  });

  it('parses storage paths against the current configured Supabase URL', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const storage = await import('./supabase.js');

    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/project/file.pdf',
      ),
    ).toBeNull();

    process.env.SUPABASE_URL = 'https://siteproof.supabase.co/';

    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/project/file.pdf',
      ),
    ).toBe('project/file.pdf');
  });

  it('only parses storage paths from the configured Supabase origin and bucket', async () => {
    process.env.SUPABASE_URL = 'https://siteproof.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'prod-supabase-service-role-key-32-plus-chars';
    delete process.env.SUPABASE_ANON_KEY;

    const storage = await import('./supabase.js');

    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/project/file%20name.pdf',
      ),
    ).toBe('project/file name.pdf');
    expect(
      storage.getSupabaseStoragePath(
        'https://example.com/storage/v1/object/public/documents/project/file.pdf',
      ),
    ).toBeNull();
    expect(
      storage.getSupabaseStoragePath(
        'https://user:pass@siteproof.supabase.co/storage/v1/object/public/documents/project/file.pdf',
      ),
    ).toBeNull();
    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/comments/project/file.pdf',
      ),
    ).toBeNull();
    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/project/../file.pdf',
      ),
    ).toBeNull();
  });

  it('can require a storage path to stay inside an expected owner prefix', async () => {
    process.env.SUPABASE_URL = 'https://siteproof.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'prod-supabase-service-role-key-32-plus-chars';
    delete process.env.SUPABASE_ANON_KEY;

    const storage = await import('./supabase.js');

    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/comments/project-a/file.pdf',
        { bucket: 'documents', expectedPrefix: 'comments/project-a/' },
      ),
    ).toBe('comments/project-a/file.pdf');
    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/comments/project-b/file.pdf',
        { bucket: 'documents', expectedPrefix: 'comments/project-a/' },
      ),
    ).toBeNull();
    expect(
      storage.getSupabaseStoragePath(
        'https://siteproof.supabase.co/storage/v1/object/public/documents/comments/project-a-file.pdf',
        { bucket: 'documents', expectedPrefix: 'comments/project-a/' },
      ),
    ).toBeNull();
  });
});

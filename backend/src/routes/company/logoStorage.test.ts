import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/supabase.js')>('../../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => true),
    getSupabaseClient: vi.fn(),
  };
});

import {
  isSupabaseConfigured,
  getSupabaseClient,
  getSupabaseStorageReference,
  DOCUMENTS_BUCKET,
} from '../../lib/supabase.js';
import {
  buildCompanyLogoDisplayUrl,
  buildCompanyLogoStorageFilename,
  createCompanyLogoAccessToken,
  getCompanyLogoDataUrl,
  getCompanyLogoDisplayUrlCompanyId,
  getOwnedCompanyLogoStoragePath,
  shouldRemovePreviousLogoOnPatch,
  validateCompanyLogoAccessToken,
} from './logoStorage.js';

const mockIsSupabaseConfigured = vi.mocked(isSupabaseConfigured);
const mockGetSupabaseClient = vi.mocked(getSupabaseClient);

function storageClientWithDownload(download: () => Promise<unknown>) {
  return { storage: { from: () => ({ download }) } } as unknown as ReturnType<
    typeof getSupabaseClient
  >;
}
const previousSupabaseUrl = process.env.SUPABASE_URL;

function restoreLogoStorageTestEnvironment() {
  vi.clearAllMocks();
  mockIsSupabaseConfigured.mockReturnValue(true);
  if (previousSupabaseUrl !== undefined) {
    process.env.SUPABASE_URL = previousSupabaseUrl;
    return;
  }

  delete process.env.SUPABASE_URL;
}

afterEach(restoreLogoStorageTestEnvironment);

describe('getCompanyLogoDataUrl (PDF embedding)', () => {
  const ownedRef = getSupabaseStorageReference(
    DOCUMENTS_BUCKET,
    'company-logos/company-1/company-logo-company-1-a.png',
  );

  it('embeds a small owned logo as a base64 data URL', async () => {
    const bytes = Buffer.from('PNGDATA');
    mockGetSupabaseClient.mockReturnValue(
      storageClientWithDownload(async () => ({
        data: { arrayBuffer: async () => bytes },
        error: null,
      })),
    );

    expect(await getCompanyLogoDataUrl('company-1', ownedRef)).toBe(
      `data:image/png;base64,${bytes.toString('base64')}`,
    );
  });

  it('skips embedding when the logo exceeds the 200KB cap (falls back to URL)', async () => {
    mockGetSupabaseClient.mockReturnValue(
      storageClientWithDownload(async () => ({
        data: { arrayBuffer: async () => Buffer.alloc(200 * 1024 + 1) },
        error: null,
      })),
    );

    expect(await getCompanyLogoDataUrl('company-1', ownedRef)).toBeNull();
  });

  it('returns null when Supabase is not configured or the logo is not owned', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    expect(await getCompanyLogoDataUrl('company-1', ownedRef)).toBeNull();

    mockIsSupabaseConfigured.mockReturnValue(true);
    expect(await getCompanyLogoDataUrl('company-1', 'https://cdn.example.com/logo.png')).toBeNull();
  });
});

describe('company logo storage helpers', () => {
  it('builds owned logo filenames only for supported image mime types', () => {
    expect(buildCompanyLogoStorageFilename('company-1', 'image/png')).toMatch(
      /^company-logo-company-1-[0-9a-f-]+\.png$/,
    );
    expect(buildCompanyLogoStorageFilename('company-1', 'text/plain')).toBeNull();
  });

  it('does not remove a missing previous logo', () => {
    expect(shouldRemovePreviousLogoOnPatch(null, '/uploads/company-logos/logo.png')).toBe(false);
  });

  it('falls back to raw URL comparison for local and external logos', () => {
    expect(
      shouldRemovePreviousLogoOnPatch(
        '/uploads/company-logos/company-logo-company-1-old.png',
        '/uploads/company-logos/company-logo-company-1-new.png',
      ),
    ).toBe(true);
    expect(
      shouldRemovePreviousLogoOnPatch(
        'https://cdn.example/logo.png',
        'https://cdn.example/logo.png',
      ),
    ).toBe(false);
    expect(
      shouldRemovePreviousLogoOnPatch(
        'https://cdn.example/logo-old.png',
        'https://cdn.example/logo-new.png',
      ),
    ).toBe(true);
  });

  it('builds signed backend URLs for owned Supabase logo references', () => {
    const displayUrl = buildCompanyLogoDisplayUrl(
      'company-1',
      'supabase://documents/company-logos/company-1/company-logo-company-1.png',
    );

    expect(displayUrl).toContain('/api/company/logo/file/company-1?token=');
    expect(displayUrl).not.toContain('supabase://');
    expect(displayUrl).not.toContain('/storage/v1/object/public/');
  });

  it('leaves non-Supabase and unowned URLs untouched', () => {
    expect(buildCompanyLogoDisplayUrl('company-1', 'https://example.com/logo.png')).toBe(
      'https://example.com/logo.png',
    );
    expect(
      buildCompanyLogoDisplayUrl('company-1', 'supabase://documents/company-logos/other/logo.png'),
    ).toBe('supabase://documents/company-logos/other/logo.png');
  });

  it('preserves stored refs when Supabase is not configured locally', () => {
    mockIsSupabaseConfigured.mockReturnValue(false);

    expect(
      buildCompanyLogoDisplayUrl(
        'company-1',
        'supabase://documents/company-logos/company-1/company-logo-company-1.png',
      ),
    ).toBe('supabase://documents/company-logos/company-1/company-logo-company-1.png');
  });

  it('validates signed tokens only for the current logo path and before expiry', () => {
    const token = createCompanyLogoAccessToken(
      'company-1',
      'company-logos/company-1/company-logo-company-1.png',
      1_000,
    );

    expect(
      validateCompanyLogoAccessToken(
        token,
        'company-1',
        'company-logos/company-1/company-logo-company-1.png',
        2_000,
      ),
    ).toBe(true);
    expect(
      validateCompanyLogoAccessToken(
        token,
        'company-1',
        'company-logos/company-1/company-logo-company-2.png',
        2_000,
      ),
    ).toBe(false);
    expect(
      validateCompanyLogoAccessToken(
        token,
        'company-1',
        'company-logos/company-1/company-logo-company-1.png',
        90_000_000,
      ),
    ).toBe(false);
  });

  it('accepts legacy public Supabase URLs as owned storage paths', () => {
    process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';

    expect(
      getOwnedCompanyLogoStoragePath(
        'https://fixture-project.supabase.co/storage/v1/object/public/documents/company-logos/company-1/company-logo-company-1.png',
        'company-1',
      ),
    ).toBe('company-logos/company-1/company-logo-company-1.png');
  });

  it('identifies backend display URLs by company id', () => {
    expect(
      getCompanyLogoDisplayUrlCompanyId(
        'http://localhost:3001/api/company/logo/file/company-1?token=example',
      ),
    ).toBe('company-1');
    expect(getCompanyLogoDisplayUrlCompanyId('https://example.com/logo.png')).toBeNull();
  });
});

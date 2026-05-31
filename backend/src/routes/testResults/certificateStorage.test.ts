import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `isSupabaseConfigured()` is frozen at module load (the supabase client is a
// module-level const built from env at import time), so to characterize both the
// configured and unconfigured branches we override only that export and keep the
// real `getSupabaseStoragePath` — the actual URL-ownership logic under test.
vi.mock('../../lib/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase.js')>();
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
  };
});

import { isSupabaseConfigured } from '../../lib/supabase.js';
import {
  getOwnedCertificateStoragePath,
  isOwnedSupabaseCertificateUrl,
  sanitizeUploadFilename,
  shouldUploadCertificateToSupabase,
} from './certificateStorage.js';

// A non-secret, fake Supabase origin. The vitest config blanks SUPABASE_URL for
// safety; the URL-ownership helpers read it fresh, so we stub it at runtime.
const TEST_SUPABASE_URL = 'https://test-project.supabase.co';
const PROJECT_ID = 'project-123';
const OTHER_PROJECT_ID = 'project-999';

function ownedCertificateUrl(projectId: string, filename = 'cert-1.pdf'): string {
  return `${TEST_SUPABASE_URL}/storage/v1/object/public/documents/certificates/${projectId}/${filename}`;
}

function setSupabaseConfigured(value: boolean): void {
  vi.mocked(isSupabaseConfigured).mockReturnValue(value);
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', TEST_SUPABASE_URL);
  setSupabaseConfigured(false);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sanitizeUploadFilename', () => {
  it('passes through a normal filename, preserving spaces and dots', () => {
    expect(sanitizeUploadFilename('Lab Report 2024.pdf')).toBe('Lab Report 2024.pdf');
  });

  it('strips directory components from POSIX path traversal', () => {
    expect(sanitizeUploadFilename('../../etc/passwd')).toBe('passwd');
  });

  it('strips directory components from Windows-style paths', () => {
    expect(sanitizeUploadFilename('C:\\Windows\\system32\\evil.pdf')).toBe('evil.pdf');
  });

  it('replaces reserved filesystem characters with underscores', () => {
    expect(sanitizeUploadFilename('a<b>c:d"e|f?g*h.pdf')).toBe('a_b_c_d_e_f_g_h.pdf');
  });

  it('replaces control characters with underscores', () => {
    expect(sanitizeUploadFilename('re\tport\n.pdf')).toBe('re_port_.pdf');
  });

  it('strips leading dots so dotfiles cannot be created', () => {
    expect(sanitizeUploadFilename('...report.pdf')).toBe('report.pdf');
    expect(sanitizeUploadFilename('.htaccess')).toBe('htaccess');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeUploadFilename('  report.pdf  ')).toBe('report.pdf');
  });

  it('caps the filename at 180 characters', () => {
    const result = sanitizeUploadFilename(`${'a'.repeat(250)}.pdf`);
    expect(result).toHaveLength(180);
    expect(result).toBe('a'.repeat(180));
  });

  it('falls back to "certificate" when nothing usable remains', () => {
    expect(sanitizeUploadFilename('...')).toBe('certificate');
    expect(sanitizeUploadFilename('   ')).toBe('certificate');
    expect(sanitizeUploadFilename('')).toBe('certificate');
  });
});

describe('getOwnedCertificateStoragePath', () => {
  it('returns the storage path for a URL under this project certificate prefix', () => {
    expect(
      getOwnedCertificateStoragePath(ownedCertificateUrl(PROJECT_ID, 'cert-abc.pdf'), PROJECT_ID),
    ).toBe(`certificates/${PROJECT_ID}/cert-abc.pdf`);
  });

  it('rejects a certificate URL owned by a different project (cross-project prefix)', () => {
    expect(
      getOwnedCertificateStoragePath(ownedCertificateUrl(OTHER_PROJECT_ID), PROJECT_ID),
    ).toBeNull();
  });

  it('rejects a public documents URL outside the certificate prefix', () => {
    const drawingsUrl = `${TEST_SUPABASE_URL}/storage/v1/object/public/documents/drawings/${PROJECT_ID}/plan.pdf`;
    expect(getOwnedCertificateStoragePath(drawingsUrl, PROJECT_ID)).toBeNull();
  });

  it('rejects a URL from a different origin', () => {
    const foreignUrl = `https://evil.example.com/storage/v1/object/public/documents/certificates/${PROJECT_ID}/cert.pdf`;
    expect(getOwnedCertificateStoragePath(foreignUrl, PROJECT_ID)).toBeNull();
  });

  it('rejects URLs containing path-traversal segments', () => {
    const traversalUrl = `${TEST_SUPABASE_URL}/storage/v1/object/public/documents/certificates/${PROJECT_ID}/../../secret.pdf`;
    expect(getOwnedCertificateStoragePath(traversalUrl, PROJECT_ID)).toBeNull();
  });

  it('rejects malformed (non-URL) input', () => {
    expect(getOwnedCertificateStoragePath('not a url', PROJECT_ID)).toBeNull();
    expect(getOwnedCertificateStoragePath('', PROJECT_ID)).toBeNull();
  });

  it('rejects everything when SUPABASE_URL is not configured', () => {
    vi.stubEnv('SUPABASE_URL', '');
    expect(getOwnedCertificateStoragePath(ownedCertificateUrl(PROJECT_ID), PROJECT_ID)).toBeNull();
  });
});

describe('isOwnedSupabaseCertificateUrl', () => {
  it('is true for an owned URL when Supabase is configured', () => {
    setSupabaseConfigured(true);
    expect(isOwnedSupabaseCertificateUrl(ownedCertificateUrl(PROJECT_ID), PROJECT_ID)).toBe(true);
  });

  it('is false for an owned URL when Supabase is NOT configured', () => {
    setSupabaseConfigured(false);
    expect(isOwnedSupabaseCertificateUrl(ownedCertificateUrl(PROJECT_ID), PROJECT_ID)).toBe(false);
  });

  it('is false for a cross-project URL even when configured', () => {
    setSupabaseConfigured(true);
    expect(isOwnedSupabaseCertificateUrl(ownedCertificateUrl(OTHER_PROJECT_ID), PROJECT_ID)).toBe(
      false,
    );
  });

  it('is false for a non-Supabase URL even when configured', () => {
    setSupabaseConfigured(true);
    expect(isOwnedSupabaseCertificateUrl('https://cdn.example.com/file.pdf', PROJECT_ID)).toBe(
      false,
    );
  });
});

describe('shouldUploadCertificateToSupabase', () => {
  const fileWithBuffer = { buffer: Buffer.from('pdf-bytes') } as Express.Multer.File;
  const fileOnDisk = { path: '/tmp/cert.pdf' } as Express.Multer.File;

  it('is true when Supabase is configured and the file is in memory (has a buffer)', () => {
    setSupabaseConfigured(true);
    expect(shouldUploadCertificateToSupabase(fileWithBuffer)).toBe(true);
  });

  it('is false when Supabase is configured but the file is on disk (no buffer)', () => {
    setSupabaseConfigured(true);
    expect(shouldUploadCertificateToSupabase(fileOnDisk)).toBe(false);
  });

  it('is false when Supabase is not configured even if the file has a buffer', () => {
    setSupabaseConfigured(false);
    expect(shouldUploadCertificateToSupabase(fileWithBuffer)).toBe(false);
  });
});

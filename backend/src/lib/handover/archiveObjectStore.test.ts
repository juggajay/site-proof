// Wave D `D1c.2` — §10.3's fail-closed decision, and the storage-path
// ownership check.
//
// **AT-142** (fail closed) · §10.2 (ownership checked at the storage-path
// level). Pure predicates, so neither needs a production process or a bucket.

import { describe, expect, it } from 'vitest';

import { AppError } from '../AppError.js';
import {
  archiveStorageKeyFromFileUrl,
  assertDurableArchiveStorage,
  readS3Config,
} from './archiveObjectStore.js';

describe('**AT-142** — fail closed in production (§10.3, `[DR-B8]`)', () => {
  it('REFUSES in production with no S3 configuration', () => {
    expect(() =>
      assertDurableArchiveStorage({ s3Configured: false, nodeEnv: 'production' }),
    ).toThrow(AppError);
    try {
      assertDurableArchiveStorage({ s3Configured: false, nodeEnv: 'production' });
    } catch (error) {
      expect((error as AppError).statusCode).toBe(503);
      // A stated reason, not a generic 500 — §10.3's whole point is that the
      // refusal explains itself rather than silently writing to ephemeral disk.
      expect((error as AppError).message).toContain('does not survive a redeploy');
    }
  });

  it('allows development and test to run on local storage', () => {
    expect(() =>
      assertDurableArchiveStorage({ s3Configured: false, nodeEnv: 'development' }),
    ).not.toThrow();
    expect(() =>
      assertDurableArchiveStorage({ s3Configured: false, nodeEnv: undefined }),
    ).not.toThrow();
  });

  it('allows production once S3 is configured', () => {
    expect(() =>
      assertDurableArchiveStorage({ s3Configured: true, nodeEnv: 'production' }),
    ).not.toThrow();
  });
});

describe('readS3Config — all three credentials or nothing', () => {
  const full = {
    SUPABASE_S3_ENDPOINT: 'https://example.supabase.co/storage/v1/s3',
    SUPABASE_S3_ACCESS_KEY_ID: 'key',
    SUPABASE_S3_SECRET_ACCESS_KEY: 'secret',
  };

  it('reads a complete configuration and defaults the region', () => {
    expect(readS3Config(full as NodeJS.ProcessEnv)).toEqual({
      endpoint: full.SUPABASE_S3_ENDPOINT,
      accessKeyId: 'key',
      secretAccessKey: 'secret',
      region: 'us-east-1',
    });
  });

  it('returns null when any credential is missing — a half-configured client is worse than none', () => {
    for (const key of Object.keys(full)) {
      const partial = { ...full, [key]: '' };
      expect(readS3Config(partial as NodeJS.ProcessEnv)).toBeNull();
    }
  });
});

describe('§10.2 — ownership is checked at the storage path, from the row own ids', () => {
  const projectId = 'p1';
  const exportId = 'e1';

  it('accepts a supabase reference inside this export prefix', () => {
    expect(
      archiveStorageKeyFromFileUrl(
        `supabase://documents/handover-exports/${projectId}/${exportId}/token.zip`,
        projectId,
        exportId,
      ),
    ).toBe(`handover-exports/${projectId}/${exportId}/token.zip`);
  });

  it('accepts a local development path inside the prefix', () => {
    expect(
      archiveStorageKeyFromFileUrl(
        `uploads/handover-exports/${projectId}/${exportId}/token.zip`,
        projectId,
        exportId,
      ),
    ).toBe(`handover-exports/${projectId}/${exportId}/token.zip`);
  });

  it('REFUSES another project or another export — a tampered fileUrl cannot redirect the download', () => {
    expect(
      archiveStorageKeyFromFileUrl(
        `supabase://documents/handover-exports/other-project/${exportId}/token.zip`,
        projectId,
        exportId,
      ),
    ).toBeNull();
    expect(
      archiveStorageKeyFromFileUrl(
        `supabase://documents/handover-exports/${projectId}/other-export/token.zip`,
        projectId,
        exportId,
      ),
    ).toBeNull();
  });

  it('REFUSES traversal and unknown schemes', () => {
    expect(
      archiveStorageKeyFromFileUrl(
        `supabase://documents/handover-exports/${projectId}/${exportId}/../../../secrets.zip`,
        projectId,
        exportId,
      ),
    ).toBeNull();
    expect(
      archiveStorageKeyFromFileUrl('https://evil.example.com/archive.zip', projectId, exportId),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { assertSafeTestDatabaseUrl } from './databaseSafety.js';

describe('test database safety guard', () => {
  it('allows local disposable PostgreSQL databases', () => {
    expect(() =>
      assertSafeTestDatabaseUrl({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:55432/siteproof_e2e?schema=public',
      }),
    ).not.toThrow();
  });

  it('rejects non-local database hosts by default', () => {
    expect(() =>
      assertSafeTestDatabaseUrl({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/siteproof_test',
      }),
    ).toThrow('non-local database host');
  });

  it('rejects local database names that do not look disposable', () => {
    expect(() =>
      assertSafeTestDatabaseUrl({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@localhost:5432/siteproof',
      }),
    ).toThrow('database name or schema must include test, e2e, shadow, or ci');
  });

  it('allows deliberate external test databases only with an explicit override', () => {
    expect(() =>
      assertSafeTestDatabaseUrl({
        NODE_ENV: 'test',
        ALLOW_EXTERNAL_TEST_DATABASE: 'true',
        DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/siteproof_test',
      }),
    ).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';

import {
  TEST_WORKER_COUNT,
  databaseNameFromUrl,
  withDatabaseName,
  workerDatabaseName,
  workerDatabaseUrl,
} from './workerDatabase.js';

const BASE = 'postgresql://postgres:postgres@localhost:5432/siteproof_test';

describe('workerDatabaseUrl', () => {
  it('points each worker at its own clone', () => {
    expect(workerDatabaseUrl(BASE, '1')).toContain('/siteproof_test_w1');
    expect(workerDatabaseUrl(BASE, '2')).toContain('/siteproof_test_w2');
  });

  it('keeps credentials, host and port', () => {
    const parsed = new URL(workerDatabaseUrl(BASE, '1'));
    expect(parsed.username).toBe('postgres');
    expect(parsed.password).toBe('postgres');
    expect(parsed.host).toBe('localhost:5432');
  });

  it('keeps the `test` safety marker every clone name must carry', () => {
    // `databaseSafety.ts` refuses a database whose name lacks test/e2e/shadow/ci.
    expect(workerDatabaseName('siteproof_test', 3)).toContain('test');
  });

  it('wraps a pool larger than the provisioned set instead of inventing a database', () => {
    expect(workerDatabaseUrl(BASE, String(TEST_WORKER_COUNT + 1))).toBe(
      workerDatabaseUrl(BASE, '1'),
    );
  });

  it('leaves the url alone when there is no worker id', () => {
    expect(workerDatabaseUrl(BASE, undefined)).toBe(BASE);
    expect(workerDatabaseUrl(BASE, '0')).toBe(BASE);
    expect(workerDatabaseUrl(BASE, 'nope')).toBe(BASE);
  });

  it('leaves an unusable url alone for assertSafeTestDatabaseUrl to reject', () => {
    expect(workerDatabaseUrl('not-a-url', '1')).toBe('not-a-url');
    expect(workerDatabaseUrl('postgresql://localhost:5432/', '1')).toBe(
      'postgresql://localhost:5432/',
    );
  });

  it('preserves query parameters such as ?schema=', () => {
    const withSchema = `${BASE}?schema=public&connection_limit=1`;
    const result = workerDatabaseUrl(withSchema, '2');
    expect(result).toContain('/siteproof_test_w2');
    expect(new URL(result).searchParams.get('connection_limit')).toBe('1');
  });
});

describe('database url helpers', () => {
  it('reads and replaces the database name', () => {
    expect(databaseNameFromUrl(BASE)).toBe('siteproof_test');
    expect(databaseNameFromUrl('nope')).toBeNull();
    expect(withDatabaseName(BASE, 'postgres')).toContain('/postgres');
  });
});

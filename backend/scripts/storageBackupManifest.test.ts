/**
 * Unit tests for the pure storage-backup manifest/verification logic.
 *
 * Runs on the Node built-in test runner (no network, no DB, no vitest config
 * changes needed — the CLI script lives in scripts/ which vitest does not scan):
 *   npx tsx --test scripts/storageBackupManifest.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ManifestVerificationError,
  buildManifest,
  selectSampleIndices,
  verifyManifest,
  type ManifestObject,
} from './storageBackupManifest.js';

const objects: ManifestObject[] = [
  { path: 'b/2.png', size: 20, checksum: 'bb' },
  { path: 'a/1.png', size: 10, checksum: 'aa' },
  { path: 'a/0.png', size: 5, checksum: 'cc' },
];

describe('buildManifest', () => {
  it('sorts by path and derives count + total bytes', () => {
    const manifest = buildManifest('documents', objects, '2026-07-24T00:00:00.000Z');
    assert.equal(manifest.bucket, 'documents');
    assert.equal(manifest.objectCount, 3);
    assert.equal(manifest.totalBytes, 35);
    assert.deepEqual(
      manifest.objects.map((o) => o.path),
      ['a/0.png', 'a/1.png', 'b/2.png'],
    );
  });

  it('produces an empty manifest for an empty bucket', () => {
    const manifest = buildManifest('documents', []);
    assert.equal(manifest.objectCount, 0);
    assert.equal(manifest.totalBytes, 0);
  });
});

describe('selectSampleIndices', () => {
  it('returns empty for non-positive inputs', () => {
    assert.deepEqual(selectSampleIndices(0, 5), []);
    assert.deepEqual(selectSampleIndices(10, 0), []);
  });

  it('caps the sample at the object count and always includes the last index', () => {
    assert.deepEqual(selectSampleIndices(3, 10), [0, 1, 2]);
    // 5 evenly-spread indices plus the always-included last index.
    const sample = selectSampleIndices(100, 5);
    assert.ok(sample.length <= 6);
    assert.equal(sample[0], 0);
    assert.equal(sample[sample.length - 1], 99);
    assert.deepEqual(
      [...sample].sort((a, b) => a - b),
      sample,
    );
  });
});

describe('verifyManifest', () => {
  const manifest = buildManifest('documents', objects);
  const goodPresent = new Map([
    ['a/0.png', 5],
    ['a/1.png', 10],
    ['b/2.png', 20],
  ]);

  it('passes when counts, sizes, and sampled checksums all match', () => {
    assert.doesNotThrow(() => verifyManifest(manifest, goodPresent, new Map([['a/1.png', 'aa']])));
  });

  it('fails on object count mismatch (the truncation case)', () => {
    const short = new Map(goodPresent);
    short.delete('b/2.png');
    assert.throws(() => verifyManifest(manifest, short, new Map()), ManifestVerificationError);
  });

  it('fails on a size mismatch', () => {
    const wrongSize = new Map(goodPresent);
    wrongSize.set('a/1.png', 999);
    assert.throws(() => verifyManifest(manifest, wrongSize, new Map()), ManifestVerificationError);
  });

  it('fails on an extra file not in the manifest', () => {
    const extra = new Map(goodPresent);
    extra.set('a/1.png', 10);
    extra.set('rogue.png', 1);
    // still 3? no — add makes 4; drop one to keep count equal but path unknown
    extra.delete('b/2.png');
    assert.throws(() => verifyManifest(manifest, extra, new Map()), ManifestVerificationError);
  });

  it('fails on a sampled checksum mismatch', () => {
    assert.throws(
      () => verifyManifest(manifest, goodPresent, new Map([['a/1.png', 'deadbeef']])),
      ManifestVerificationError,
    );
  });
});

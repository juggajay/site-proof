#!/usr/bin/env tsx
/**
 * Supabase Storage backup helper.
 *
 * Produces a FULL consistent snapshot of the private `documents` bucket:
 * lists every object (paginated, recursive), downloads each one preserving its
 * path, records a SHA-256 checksum per object in a manifest, and fails hard on
 * any listed-vs-downloaded count mismatch. The GitHub Actions workflow then
 * tars + GPG-encrypts the staging directory and verifies it by decrypting into
 * a temp dir and re-checking the manifest.
 *
 * This is the storage sibling of `scripts/backup.ts` (the Postgres backup) and
 * mirrors its checksum/verify/retention shape.
 *
 * Usage:
 *   tsx scripts/storage-backup.ts create            # list + download + manifest
 *   tsx scripts/storage-backup.ts create --dry-run  # list + sum bytes only
 *   tsx scripts/storage-backup.ts verify <dir>      # verify an extracted archive
 *
 * Environment:
 *   STORAGE_BACKUP_SUPABASE_URL               required for create (fallback SUPABASE_URL)
 *   STORAGE_BACKUP_SUPABASE_SERVICE_ROLE_KEY  required for create (fallback SUPABASE_SERVICE_ROLE_KEY)
 *   STORAGE_BACKUP_BUCKET                      optional, defaults to `documents`
 *   STORAGE_BACKUP_DIR                         optional staging dir, defaults to ./storage-backups
 *   STORAGE_BACKUP_SIZE_WARN_BYTES            optional soft cap, defaults to 5 GiB
 *   STORAGE_BACKUP_VERIFY_SAMPLE              optional sample size, defaults to 50
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  buildManifest,
  selectSampleIndices,
  verifyManifest,
  type ManifestObject,
  type StorageBackupManifest,
} from './storageBackupManifest.js';

const DEFAULT_BUCKET = 'documents';
const DEFAULT_STAGING_DIR = 'storage-backups';
const MANIFEST_FILENAME = 'manifest.json';
const OBJECTS_DIRNAME = 'objects';
const LIST_PAGE_SIZE = 100;
const DEFAULT_SIZE_WARN_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB
const DEFAULT_VERIFY_SAMPLE = 50;

function stagingDir(): string {
  return resolve(process.env.STORAGE_BACKUP_DIR || join(process.cwd(), DEFAULT_STAGING_DIR));
}

function bucketName(): string {
  return process.env.STORAGE_BACKUP_BUCKET?.trim() || DEFAULT_BUCKET;
}

function sizeWarnBytes(): number {
  const raw = process.env.STORAGE_BACKUP_SIZE_WARN_BYTES?.trim();
  if (!raw) return DEFAULT_SIZE_WARN_BYTES;
  if (!/^\d+$/.test(raw))
    throw new Error('STORAGE_BACKUP_SIZE_WARN_BYTES must be a positive integer.');
  return Number(raw);
}

function verifySampleSize(): number {
  const raw = process.env.STORAGE_BACKUP_VERIFY_SAMPLE?.trim();
  if (!raw) return DEFAULT_VERIFY_SAMPLE;
  if (!/^\d+$/.test(raw))
    throw new Error('STORAGE_BACKUP_VERIFY_SAMPLE must be a positive integer.');
  return Number(raw);
}

function requireStorageClient(): SupabaseClient {
  const url = (process.env.STORAGE_BACKUP_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const key = (
    process.env.STORAGE_BACKUP_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  if (!url) {
    throw new Error(
      'Set STORAGE_BACKUP_SUPABASE_URL (or SUPABASE_URL) to the Supabase project URL for storage backups.',
    );
  }
  if (!key) {
    throw new Error(
      'Set STORAGE_BACKUP_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY) to the service-role key.',
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}

/**
 * Reject any object key that could escape the staging directory when written
 * to disk (path traversal, absolute paths, backslashes). Supabase keys are
 * normally safe, but the archive is only as trustworthy as this guard.
 */
function assertSafeObjectPath(objectPath: string): void {
  if (
    !objectPath ||
    objectPath.includes('\\') ||
    isAbsolute(objectPath) ||
    objectPath.split('/').some((segment) => segment === '..' || segment === '.')
  ) {
    throw new Error(`Refusing to write unsafe object path: ${objectPath}`);
  }
}

type ListedObject = { path: string; size: number };

/**
 * Recursively list every object in the bucket. Supabase `.list()` is
 * folder-scoped and paginated (default 100), and returns folders as entries
 * with a null `id`, so we page each prefix and descend into folders.
 */
async function listAllObjects(client: SupabaseClient, bucket: string): Promise<ListedObject[]> {
  const results: ListedObject[] = [];

  async function walk(prefix: string): Promise<void> {
    let offset = 0;
    for (;;) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error) {
        throw new Error(`Failed to list "${prefix || '/'}": ${error.message}`);
      }
      if (!data || data.length === 0) {
        break;
      }

      for (const entry of data) {
        const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        // Folders come back with id === null and no metadata; recurse into them.
        if (entry.id === null) {
          await walk(fullPath);
        } else {
          results.push({ path: fullPath, size: entry.metadata?.size ?? 0 });
        }
      }

      if (data.length < LIST_PAGE_SIZE) {
        break;
      }
      offset += LIST_PAGE_SIZE;
    }
  }

  await walk('');
  return results;
}

async function downloadObject(
  client: SupabaseClient,
  bucket: string,
  objectPath: string,
  destPath: string,
): Promise<{ size: number; checksum: string }> {
  const { data, error } = await client.storage.from(bucket).download(objectPath);
  if (error || !data) {
    throw new Error(`Failed to download "${objectPath}": ${error?.message ?? 'no data'}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buffer);
  return {
    size: buffer.byteLength,
    checksum: createHash('sha256').update(buffer).digest('hex'),
  };
}

async function createBackup(dryRun: boolean): Promise<void> {
  const client = requireStorageClient();
  const bucket = bucketName();
  const warnBytes = sizeWarnBytes();

  console.log(`Listing objects in bucket "${bucket}"...`);
  const listed = await listAllObjects(client, bucket);
  const listedBytes = listed.reduce((sum, obj) => sum + obj.size, 0);
  console.log(
    `Listed ${listed.length} object(s), ${formatBytes(listedBytes)} (per listing metadata).`,
  );

  if (listedBytes > warnBytes) {
    console.log(
      `::warning::Bucket size ${formatBytes(listedBytes)} exceeds the ${formatBytes(warnBytes)} soft cap. ` +
        `A single GitHub Actions artifact / runner disk may not hold the full snapshot. ` +
        `Review the dry-run size report before relying on this artifact (see runbook).`,
    );
  }

  if (dryRun) {
    console.log('Dry run: no objects downloaded.');
    return;
  }

  const root = stagingDir();
  const objectsRoot = join(root, OBJECTS_DIRNAME);
  mkdirSync(objectsRoot, { recursive: true });

  const manifestObjects: ManifestObject[] = [];
  let downloaded = 0;
  for (const object of listed) {
    assertSafeObjectPath(object.path);
    const destPath = join(objectsRoot, object.path);
    const { size, checksum } = await downloadObject(client, bucket, object.path, destPath);
    manifestObjects.push({ path: object.path, size, checksum });
    downloaded += 1;
  }

  const manifest = buildManifest(bucket, manifestObjects);

  // Full consistent snapshot or nothing: a listed-vs-downloaded gap means the
  // archive would look complete while missing objects. Fail the job instead.
  if (manifest.objectCount !== listed.length) {
    throw new Error(
      `Backup incomplete: listed ${listed.length} object(s) but archived ${manifest.objectCount}.`,
    );
  }

  writeFileSync(join(root, MANIFEST_FILENAME), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(
    `Counts — listed: ${listed.length}, downloaded: ${downloaded}, archived: ${manifest.objectCount}.`,
  );
  console.log(
    `Archived ${formatBytes(manifest.totalBytes)} across ${manifest.objectCount} object(s).`,
  );
  console.log(`Staging directory ready for tar + encrypt: ${root}`);
}

function readManifest(dir: string): StorageBackupManifest {
  const manifestPath = join(dir, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    throw new Error(`No ${MANIFEST_FILENAME} found in ${dir}`);
  }
  return JSON.parse(readFileSync(manifestPath, 'utf8')) as StorageBackupManifest;
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Verify an extracted archive directory (containing `manifest.json` and an
 * `objects/` tree) against its manifest: object count, every path present at
 * the recorded size, no extra files, and a re-hashed sample of objects.
 */
function verifyBackup(dir: string): void {
  const root = resolve(dir);
  const manifest = readManifest(root);
  const objectsRoot = join(root, OBJECTS_DIRNAME);

  const present = new Map<string, number>();
  for (const file of walkFiles(objectsRoot)) {
    const relPath = relative(objectsRoot, file).split('\\').join('/');
    present.set(relPath, statSync(file).size);
  }

  // Re-hash a deterministic sample of objects and compare to the manifest.
  const sampleChecksums = new Map<string, string>();
  for (const index of selectSampleIndices(manifest.objects.length, verifySampleSize())) {
    const object = manifest.objects[index];
    const filePath = join(objectsRoot, object.path);
    if (!existsSync(filePath)) {
      throw new Error(`Sampled object missing from archive: ${object.path}`);
    }
    sampleChecksums.set(
      object.path,
      createHash('sha256').update(readFileSync(filePath)).digest('hex'),
    );
  }

  verifyManifest(manifest, present, sampleChecksums);

  console.log(
    `Backup verified: ${manifest.objectCount} object(s), ${formatBytes(manifest.totalBytes)}, ` +
      `${sampleChecksums.size} checksum sample(s) matched.`,
  );
}

function printHelp(): void {
  console.log(`
Supabase Storage Backup

Commands:
  create [--dry-run]   List + download every object, write manifest.json.
                       --dry-run lists and sums bytes without downloading.
  verify <dir>         Verify an extracted archive directory against its manifest.

Environment:
  STORAGE_BACKUP_SUPABASE_URL / SUPABASE_URL                       required for create
  STORAGE_BACKUP_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY  required for create
  STORAGE_BACKUP_BUCKET            optional, defaults to "documents"
  STORAGE_BACKUP_DIR              optional staging dir, defaults to ./storage-backups
  STORAGE_BACKUP_SIZE_WARN_BYTES  optional soft cap, defaults to 5 GiB
  STORAGE_BACKUP_VERIFY_SAMPLE    optional checksum sample size, defaults to 50
`);
}

async function main(): Promise<void> {
  const command = process.argv[2] || 'help';
  const rest = process.argv.slice(3);

  switch (command) {
    case 'create':
      await createBackup(rest.includes('--dry-run'));
      break;
    case 'verify': {
      const dir = rest.find((arg) => !arg.startsWith('--'));
      if (!dir) throw new Error('verify requires an extracted archive directory path.');
      verifyBackup(dir);
      break;
    }
    default:
      printHelp();
      process.exitCode = command === 'help' ? 0 : 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

// Wave D `D1c.2` — the archive object store: the S3 multipart write leg, the
// streamed read-back, and the fail-closed decision
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §4.5.3 delivery
// path, §4.6.2 lease-keyed keys, §10.2, §10.3; `[DR-B8]`). **AT-142**.
//
// WHY S3 AND NOT THE SUPABASE JS CLIENT. §4.5.3 decided the delivery path by
// measurement: a streaming ZIP does not know its size until the last byte, and
// `supabase-js`'s `.upload()` takes a whole body. S3 multipart needs no total
// size upfront and takes the writer's `Readable` straight in as
// `@aws-sdk/lib-storage` `Upload`'s `Body`. The bucket is the same `documents`
// bucket; only the protocol differs.
//
// FAIL CLOSED (§10.3, `[DR-B8]`). `storeScheduledReportArtifact` falls through
// to local Railway disk when storage is unconfigured, and `CLAUDE.md:266` says
// those files vanish on the next redeploy. An archive silently written to
// ephemeral disk is the same failure as a folio written there: it reports
// success and then disappears. So in production, missing S3 configuration means
// the worker REFUSES TO CLAIM — it does not fall back, and it does not start a
// job it cannot finish durably.
//
// PART SIZE IS SET DELIBERATELY, not discovered. The spike (§4.5.3) recorded
// that `lib-storage`'s default 5 MiB part × the 10,000-part S3 cap gives
// 46.6 GiB and "must be set deliberately". At 16 MiB the 8 GiB output cap is
// 512 parts — half a percent of the part budget — and the buffered working set
// is `partSize × queueSize` = 32 MiB, which is what keeps the worker inside
// §4.5.1 fixture 1's 256 MiB bar alongside `archiver`'s ~39 MiB.

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import { AppError, ErrorCodes } from '../AppError.js';
import { logInfo, logWarn } from '../serverLogger.js';
import { DOCUMENTS_BUCKET, getSupabaseStorageReference } from '../supabase.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../uploadPaths.js';

/** 16 MiB. See the header note — a config term, not a default. */
export const MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024;
/** Two parts in flight. `partSize × queueSize` is the buffered working set. */
export const MULTIPART_QUEUE_SIZE = 2;

export const ARCHIVE_STORAGE_ROOT = 'handover-exports';
export const ARCHIVE_MIME_TYPE = 'application/zip';

export interface S3Config {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/**
 * Read at CALL time, never at module load.
 *
 * `supabase.ts:23` freezes its client at import, which is why
 * `isSupabaseConfigured()` can only ever report what the environment looked
 * like when the module was first required. A worker that is restarted with new
 * credentials should pick them up; a test that sets them per-case should not
 * have to re-import the module graph.
 */
export function readS3Config(env: NodeJS.ProcessEnv = process.env): S3Config | null {
  const endpoint = env.SUPABASE_S3_ENDPOINT?.trim();
  const accessKeyId = env.SUPABASE_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.SUPABASE_S3_SECRET_ACCESS_KEY?.trim();
  const region = env.SUPABASE_S3_REGION?.trim() || 'us-east-1';

  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, region, accessKeyId, secretAccessKey };
}

/**
 * §10.3 as a pure predicate, so **AT-142** can assert it without standing up a
 * production process — the same shape as `assertDurableFolioStorage`
 * (`folioStorage.ts:75`), deliberately, because it is the same decision.
 */
export function assertDurableArchiveStorage(options: {
  s3Configured: boolean;
  nodeEnv: string | undefined;
}): void {
  if (options.s3Configured) return;
  if (options.nodeEnv !== 'production') return;
  throw new AppError(
    503,
    'Durable archive storage is not configured, so no handover export was generated. ' +
      'A handover archive is a legal record and CIVOS will not write one to storage that does not survive a redeploy.',
    ErrorCodes.UPLOAD_FAILED,
  );
}

export interface MultipartProgress {
  readonly uploadId: string | null;
  readonly key: string;
  readonly parts: number;
  readonly loadedBytes: number;
}

/**
 * The write/read/list/delete surface the worker, the download route and the
 * sweeper all share.
 *
 * ONE interface with two implementations is not an abstraction for its own
 * sake: the local one exists because DB-backed tests may never touch real S3
 * (and because `npm run dev` has no bucket), and the fail-closed assertion
 * above is what stops it being reachable in production.
 */
export interface ArchiveObjectStore {
  readonly kind: 's3' | 'local';
  /** Streams `body` to `key`. Resolves with the durable locator for `fileUrl`. */
  put(
    key: string,
    body: Readable,
    onProgress?: (progress: MultipartProgress) => void,
  ): Promise<string>;
  /** Streams the object back. The download route pipes this to the response. */
  get(key: string): Promise<Readable>;
  remove(keys: readonly string[]): Promise<void>;
  /** Every key under `prefix`. Used by the orphaned-object sweep (§10.5). */
  list(prefix: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// S3
// ---------------------------------------------------------------------------

export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    // Supabase's S3 endpoint is path-style (`/storage/v1/s3/{bucket}/{key}`);
    // virtual-host style would resolve a bucket subdomain that does not exist.
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

class S3ArchiveObjectStore implements ArchiveObjectStore {
  readonly kind = 's3' as const;

  constructor(
    private readonly client: S3Client,
    private readonly bucket: string = DOCUMENTS_BUCKET,
  ) {}

  async put(
    key: string,
    body: Readable,
    onProgress?: (progress: MultipartProgress) => void,
  ): Promise<string> {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: body, ContentType: ARCHIVE_MIME_TYPE },
      partSize: MULTIPART_PART_SIZE_BYTES,
      queueSize: MULTIPART_QUEUE_SIZE,
      // `lib-storage` calls `AbortMultipartUpload` itself when the upload
      // errors, which is what keeps a failed run from leaving billable parts
      // behind. `leavePartsOnError: true` would defeat that; the resume story
      // here is `uploadState`, not orphaned parts.
      leavePartsOnError: false,
    });

    if (onProgress) {
      upload.on('httpUploadProgress', (progress) => {
        onProgress({
          uploadId: (progress as { UploadId?: string }).UploadId ?? null,
          key,
          parts: progress.part ?? 0,
          loadedBytes: progress.loaded ?? 0,
        });
      });
    }

    await upload.done();
    return getSupabaseStorageReference(this.bucket, key);
  }

  async get(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = result.Body;
    if (!body) throw AppError.notFound('Handover export archive');
    return body as Readable;
  }

  async remove(keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      }),
    );
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  /** Best-effort abort for a multipart the process died in the middle of. */
  async abortMultipart(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
      );
    } catch (error) {
      logWarn('[Handover Export] Multipart abort failed', { key, error });
    }
  }
}

// ---------------------------------------------------------------------------
// Local — development and test ONLY. `assertDurableArchiveStorage` refuses in
// production before anything here is reachable.
// ---------------------------------------------------------------------------

class LocalArchiveObjectStore implements ArchiveObjectStore {
  readonly kind = 'local' as const;

  async put(
    key: string,
    body: Readable,
    onProgress?: (progress: MultipartProgress) => void,
  ): Promise<string> {
    const directory = await ensureUploadSubdirectoryAsync(path.posix.dirname(key));
    const filePath = path.join(directory, path.posix.basename(key));
    // `wx` — §13: "partial archives are never stored — written once, complete,
    // `flag: 'wx'`". A lease-keyed key is unique per claim, so a collision here
    // is a bug, never a retry.
    const handle = await fs.promises.open(filePath, 'wx');
    let loaded = 0;
    let parts = 0;

    try {
      for await (const chunk of body) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        await handle.write(buffer);
        loaded += buffer.length;
        parts += 1;
        onProgress?.({ uploadId: null, key, parts, loadedBytes: loaded });
      }
    } finally {
      await handle.close();
    }

    return `uploads/${key}`;
  }

  async get(key: string): Promise<Readable> {
    const resolved = resolveUploadPath(`uploads/${key}`, ARCHIVE_STORAGE_ROOT);
    if (!fs.existsSync(resolved)) throw AppError.notFound('Handover export archive');
    return fs.createReadStream(resolved);
  }

  async remove(keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      try {
        await fs.promises.rm(resolveUploadPath(`uploads/${key}`, ARCHIVE_STORAGE_ROOT), {
          force: true,
        });
      } catch (error) {
        logWarn('[Handover Export] Local archive delete failed', { key, error });
      }
    }
  }

  async list(prefix: string): Promise<string[]> {
    let directory: string;
    try {
      directory = resolveUploadPath(`uploads/${prefix}`, ARCHIVE_STORAGE_ROOT);
    } catch {
      return [];
    }
    if (!fs.existsSync(directory)) return [];
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => `${prefix}/${entry.name}`);
  }
}

/**
 * The store this process should use, or a refusal.
 *
 * Called once at worker start (so an unconfigured production worker refuses to
 * claim rather than failing per job) and per request on the download path.
 */
export function resolveArchiveObjectStore(
  env: NodeJS.ProcessEnv = process.env,
): ArchiveObjectStore {
  const config = readS3Config(env);
  assertDurableArchiveStorage({ s3Configured: config !== null, nodeEnv: env.NODE_ENV });

  if (!config) {
    logInfo('[Handover Export] No S3 configuration; using local archive storage (non-production)');
    return new LocalArchiveObjectStore();
  }
  return new S3ArchiveObjectStore(createS3Client(config));
}

/** Exposed for tests and for the sweeper, which needs a store without the
 * production refusal when it is only deleting local development objects. */
export function createLocalArchiveObjectStore(): ArchiveObjectStore {
  return new LocalArchiveObjectStore();
}

/**
 * The published archive's storage key, recovered from the row's `fileUrl`.
 *
 * Ownership is checked at the STORAGE PATH level (§10.2), so the download route
 * recomputes the prefix from the row's own ids and refuses anything outside it
 * — a tampered `fileUrl` cannot point the download at another project's object.
 */
export function archiveStorageKeyFromFileUrl(
  fileUrl: string,
  projectId: string,
  exportId: string,
): string | null {
  const expectedPrefix = `${ARCHIVE_STORAGE_ROOT}/${projectId}/${exportId}/`;
  const supabaseRef = `supabase://${DOCUMENTS_BUCKET}/`;

  const key = fileUrl.startsWith(supabaseRef)
    ? decodeURIComponent(fileUrl.slice(supabaseRef.length))
    : fileUrl.startsWith('uploads/')
      ? fileUrl.slice('uploads/'.length)
      : null;

  if (!key || key.includes('\\') || key.includes('..')) return null;
  return key.startsWith(expectedPrefix) ? key : null;
}

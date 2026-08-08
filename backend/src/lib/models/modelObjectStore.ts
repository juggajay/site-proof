import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

import { AppError, ErrorCodes } from '../AppError.js';
import {
  MULTIPART_PART_SIZE_BYTES,
  MULTIPART_QUEUE_SIZE,
  createS3Client,
  readS3Config,
} from '../handover/archiveObjectStore.js';
import { logInfo } from '../serverLogger.js';
import { DOCUMENTS_BUCKET } from '../supabase.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../uploadPaths.js';
import { assertSafeStorageId } from '../scheduledReports/artifacts.js';

export const DESIGN_MODEL_STORAGE_ROOT = 'design-models';
export const ORTHO_STORAGE_ROOT = 'ortho';

export interface ModelObjectStore {
  readonly kind: 's3' | 'local';
  writeFromFile(localPath: string, ref: string, contentType?: string): Promise<void>;
  readStream(ref: string): Promise<Readable>;
  delete(ref: string): Promise<void>;
  deleteMany(refs: readonly string[]): Promise<void>;
  list(prefix: string): Promise<string[]>;
  sizeOf(ref: string): Promise<bigint>;
  copy(sourceRef: string, destinationRef: string): Promise<void>;
}

export function assertDurableModelStorage(options: {
  s3Configured: boolean;
  nodeEnv: string | undefined;
}): void {
  if (options.s3Configured || options.nodeEnv !== 'production') return;
  throw new AppError(
    503,
    'Durable model and orthophoto storage is not configured, so uploads and background processing are unavailable.',
    ErrorCodes.UPLOAD_FAILED,
  );
}

export function sourceObjectRef(projectId: string, modelId: string, versionId: string): string {
  return modelObjectRef(projectId, modelId, versionId, 'source.ifc');
}

export function fragmentObjectRef(projectId: string, modelId: string, versionId: string): string {
  return modelObjectRef(projectId, modelId, versionId, 'model.frag');
}

export function orthoSourceObjectRef(projectId: string, orthoId: string): string {
  assertSafeStorageId(projectId, 'projectId');
  assertSafeStorageId(orthoId, 'orthoId');
  return `${ORTHO_STORAGE_ROOT}/${projectId}/${orthoId}/source.tif`;
}

export function orthoTileStorageRoot(projectId: string, orthoId: string): string {
  assertSafeStorageId(projectId, 'projectId');
  assertSafeStorageId(orthoId, 'orthoId');
  return `${ORTHO_STORAGE_ROOT}/${projectId}/${orthoId}/tiles`;
}

export function orthoTileObjectRef(root: string, z: number, x: number, y: number): string {
  assertObjectRef(root);
  if (!root.startsWith(`${ORTHO_STORAGE_ROOT}/`) || !root.endsWith('/tiles')) {
    throw AppError.badRequest('Invalid ortho tile storage root');
  }
  for (const [name, value] of Object.entries({ z, x, y })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw AppError.badRequest(`${name} must be a non-negative integer`);
    }
  }
  return `${root}/${z}/${x}/${y}.png`;
}

function modelObjectRef(
  projectId: string,
  modelId: string,
  versionId: string,
  fileName: 'source.ifc' | 'model.frag',
): string {
  assertSafeStorageId(projectId, 'projectId');
  assertSafeStorageId(modelId, 'modelId');
  assertSafeStorageId(versionId, 'versionId');
  return `${DESIGN_MODEL_STORAGE_ROOT}/${projectId}/${modelId}/${versionId}/${fileName}`;
}

function assertObjectRef(ref: string): void {
  if (
    ![`${DESIGN_MODEL_STORAGE_ROOT}/`, `${ORTHO_STORAGE_ROOT}/`].some((root) =>
      ref.startsWith(root),
    ) ||
    ref.includes('\\') ||
    ref.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw AppError.badRequest('Invalid model or ortho storage reference');
  }
}

function isS3NotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    name?: unknown;
    Code?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  return (
    candidate.name === 'NoSuchKey' ||
    candidate.Code === 'NoSuchKey' ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

class S3ModelObjectStore implements ModelObjectStore {
  readonly kind = 's3' as const;

  constructor(
    private readonly client: ReturnType<typeof createS3Client>,
    private readonly bucket = DOCUMENTS_BUCKET,
  ) {}

  async writeFromFile(
    localPath: string,
    ref: string,
    contentType = 'application/octet-stream',
  ): Promise<void> {
    assertObjectRef(ref);
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: ref,
        Body: fs.createReadStream(localPath),
        ContentType: contentType,
      },
      partSize: MULTIPART_PART_SIZE_BYTES,
      queueSize: MULTIPART_QUEUE_SIZE,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  async readStream(ref: string): Promise<Readable> {
    assertObjectRef(ref);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: ref }),
      );
      if (!response.Body) throw AppError.notFound('Stored model or ortho object');
      return response.Body as Readable;
    } catch (error) {
      if (isS3NotFound(error)) throw AppError.notFound('Stored model or ortho object');
      throw error;
    }
  }

  async delete(ref: string): Promise<void> {
    assertObjectRef(ref);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: ref }));
  }

  async deleteMany(refs: readonly string[]): Promise<void> {
    for (let index = 0; index < refs.length; index += 1000) {
      const batch = refs.slice(index, index + 1000);
      for (const ref of batch) assertObjectRef(ref);
      if (batch.length === 0) continue;
      const result = await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
      if (result.Errors?.length) {
        throw new Error(`Object storage failed to delete ${result.Errors.length} object(s)`);
      }
    }
  }

  async list(prefix: string): Promise<string[]> {
    assertObjectRef(prefix);
    const descendantPrefix = `${prefix}/`;
    const refs: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: descendantPrefix,
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of page.Contents ?? []) if (object.Key) refs.push(object.Key);
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return refs;
  }

  async sizeOf(ref: string): Promise<bigint> {
    assertObjectRef(ref);
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: ref }),
    );
    if (response.ContentLength === undefined) throw AppError.notFound('Design model object');
    return BigInt(response.ContentLength);
  }

  async copy(sourceRef: string, destinationRef: string): Promise<void> {
    assertObjectRef(sourceRef);
    assertObjectRef(destinationRef);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceRef}`,
        Key: destinationRef,
        ContentType: 'application/octet-stream',
      }),
    );
  }
}

class LocalModelObjectStore implements ModelObjectStore {
  readonly kind = 'local' as const;

  private resolve(ref: string): string {
    assertObjectRef(ref);
    const expectedRoot = ref.startsWith(`${ORTHO_STORAGE_ROOT}/`)
      ? ORTHO_STORAGE_ROOT
      : DESIGN_MODEL_STORAGE_ROOT;
    return resolveUploadPath(`uploads/${ref}`, expectedRoot);
  }

  async writeFromFile(localPath: string, ref: string, _contentType?: string): Promise<void> {
    assertObjectRef(ref);
    const directory = await ensureUploadSubdirectoryAsync(path.posix.dirname(ref));
    await fs.promises.copyFile(localPath, path.join(directory, path.posix.basename(ref)));
  }

  async readStream(ref: string): Promise<Readable> {
    const localPath = this.resolve(ref);
    try {
      await fs.promises.access(localPath, fs.constants.R_OK);
    } catch {
      throw AppError.notFound('Design model object');
    }
    return fs.createReadStream(localPath);
  }

  async delete(ref: string): Promise<void> {
    await fs.promises.rm(this.resolve(ref), { force: true });
  }

  async deleteMany(refs: readonly string[]): Promise<void> {
    await Promise.all(refs.map((ref) => this.delete(ref)));
  }

  async list(prefix: string): Promise<string[]> {
    assertObjectRef(prefix);
    const root = this.resolve(prefix);
    const storageRoot = prefix.split('/')[0];
    const storageRootPath = resolveUploadPath(`uploads/${storageRoot}`, storageRoot);
    const refs: string[] = [];
    const visit = async (directory: string): Promise<void> => {
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(directory, { withFileTypes: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
      for (const entry of entries) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) await visit(absolute);
        else if (entry.isFile()) {
          const relative = path.relative(storageRootPath, absolute).replaceAll('\\', '/');
          refs.push(`${storageRoot}/${relative}`);
        }
      }
    };
    await visit(root);
    return refs;
  }

  async sizeOf(ref: string): Promise<bigint> {
    try {
      return BigInt((await fs.promises.stat(this.resolve(ref))).size);
    } catch {
      throw AppError.notFound('Design model object');
    }
  }

  async copy(sourceRef: string, destinationRef: string): Promise<void> {
    assertObjectRef(destinationRef);
    const directory = await ensureUploadSubdirectoryAsync(path.posix.dirname(destinationRef));
    await fs.promises.copyFile(
      this.resolve(sourceRef),
      path.join(directory, path.posix.basename(destinationRef)),
    );
  }
}

let cachedStore: { key: string; store: ModelObjectStore } | null = null;

export function resolveModelObjectStore(env: NodeJS.ProcessEnv = process.env): ModelObjectStore {
  const config = readS3Config(env);
  assertDurableModelStorage({ s3Configured: config !== null, nodeEnv: env.NODE_ENV });
  const key = config ? `s3:${config.endpoint}:${config.region}:${config.accessKeyId}` : 'local';
  if (cachedStore?.key === key) return cachedStore.store;

  if (!config) {
    logInfo('[Model Storage] No S3 configuration; using local storage (non-production)');
    cachedStore = { key, store: new LocalModelObjectStore() };
    return cachedStore.store;
  }

  cachedStore = { key, store: new S3ModelObjectStore(createS3Client(config)) };
  return cachedStore.store;
}

export function createLocalModelObjectStore(): ModelObjectStore {
  return new LocalModelObjectStore();
}

import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
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

export interface ModelObjectStore {
  readonly kind: 's3' | 'local';
  writeFromFile(localPath: string, ref: string): Promise<void>;
  readStream(ref: string): Promise<Readable>;
  delete(ref: string): Promise<void>;
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
    'Durable design-model storage is not configured, so uploads and conversions are unavailable.',
    ErrorCodes.UPLOAD_FAILED,
  );
}

export function sourceObjectRef(projectId: string, modelId: string, versionId: string): string {
  return modelObjectRef(projectId, modelId, versionId, 'source.ifc');
}

export function fragmentObjectRef(projectId: string, modelId: string, versionId: string): string {
  return modelObjectRef(projectId, modelId, versionId, 'model.frag');
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

function assertModelObjectRef(ref: string): void {
  if (
    !ref.startsWith(`${DESIGN_MODEL_STORAGE_ROOT}/`) ||
    ref.includes('\\') ||
    ref.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw AppError.badRequest('Invalid design-model storage reference');
  }
}

class S3ModelObjectStore implements ModelObjectStore {
  readonly kind = 's3' as const;

  constructor(
    private readonly client: ReturnType<typeof createS3Client>,
    private readonly bucket = DOCUMENTS_BUCKET,
  ) {}

  async writeFromFile(localPath: string, ref: string): Promise<void> {
    assertModelObjectRef(ref);
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: ref,
        Body: fs.createReadStream(localPath),
        ContentType: 'application/octet-stream',
      },
      partSize: MULTIPART_PART_SIZE_BYTES,
      queueSize: MULTIPART_QUEUE_SIZE,
      leavePartsOnError: false,
    });
    await upload.done();
  }

  async readStream(ref: string): Promise<Readable> {
    assertModelObjectRef(ref);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: ref }),
    );
    if (!response.Body) throw AppError.notFound('Design model object');
    return response.Body as Readable;
  }

  async delete(ref: string): Promise<void> {
    assertModelObjectRef(ref);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: ref }));
  }

  async sizeOf(ref: string): Promise<bigint> {
    assertModelObjectRef(ref);
    const response = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: ref }),
    );
    if (response.ContentLength === undefined) throw AppError.notFound('Design model object');
    return BigInt(response.ContentLength);
  }

  async copy(sourceRef: string, destinationRef: string): Promise<void> {
    assertModelObjectRef(sourceRef);
    assertModelObjectRef(destinationRef);
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
    assertModelObjectRef(ref);
    return resolveUploadPath(`uploads/${ref}`, DESIGN_MODEL_STORAGE_ROOT);
  }

  async writeFromFile(localPath: string, ref: string): Promise<void> {
    assertModelObjectRef(ref);
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

  async sizeOf(ref: string): Promise<bigint> {
    try {
      return BigInt((await fs.promises.stat(this.resolve(ref))).size);
    } catch {
      throw AppError.notFound('Design model object');
    }
  }

  async copy(sourceRef: string, destinationRef: string): Promise<void> {
    assertModelObjectRef(destinationRef);
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

import crypto from 'node:crypto';
import fs from 'node:fs';
import { Readable } from 'node:stream';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '../prisma.js';
import { CONVERTER_VERSION, runNextConversion } from './conversionRunner.js';
import { fragmentObjectRef, sourceObjectRef, type ModelObjectStore } from './modelObjectStore.js';

class FakeModelObjectStore implements ModelObjectStore {
  readonly kind = 'local' as const;
  readonly objects = new Map<string, Buffer>();

  async writeFromFile(localPath: string, ref: string): Promise<void> {
    this.objects.set(ref, await fs.promises.readFile(localPath));
  }

  async readStream(ref: string): Promise<Readable> {
    const value = this.objects.get(ref);
    if (!value) throw new Error(`Missing fake object ${ref}`);
    return Readable.from([value]);
  }

  async delete(ref: string): Promise<void> {
    this.objects.delete(ref);
  }

  async deleteMany(refs: readonly string[]): Promise<void> {
    for (const ref of refs) this.objects.delete(ref);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.objects.keys()].filter((ref) => ref.startsWith(`${prefix}/`));
  }

  async sizeOf(ref: string): Promise<bigint> {
    const value = this.objects.get(ref);
    if (!value) throw new Error(`Missing fake object ${ref}`);
    return BigInt(value.length);
  }

  copy = vi.fn(async (sourceRef: string, destinationRef: string): Promise<void> => {
    const value = this.objects.get(sourceRef);
    if (!value) throw new Error(`Missing fake object ${sourceRef}`);
    this.objects.set(destinationRef, Buffer.from(value));
  });
}

const tag = `conversion-runner-${Date.now()}`;
let companyId: string;
let projectId: string;
let modelId: string;
let versionNumber = 0;

async function createVersion(source: Buffer, sourceSha256?: string) {
  versionNumber += 1;
  const version = await prisma.designModelVersion.create({
    data: {
      modelId,
      versionNumber,
      status: 'queued',
      fileName: `fixture-${versionNumber}.ifc`,
      sourceSizeBytes: BigInt(source.length),
      sourceSha256: sourceSha256 ?? crypto.createHash('sha256').update(source).digest('hex'),
      nextAttemptAt: new Date(0),
    },
  });
  const sourceRef = sourceObjectRef(projectId, modelId, version.id);
  await prisma.designModelVersion.update({
    where: { id: version.id },
    data: { sourceStorageRef: sourceRef },
  });
  return { version, sourceRef };
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Company ${tag}` } });
  companyId = company.id;
  const project = await prisma.project.create({
    data: {
      companyId,
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;
  const model = await prisma.designModel.create({ data: { projectId, name: 'Runner model' } });
  modelId = model.id;
});

afterEach(async () => {
  await prisma.designModelVersion.deleteMany({ where: { modelId } });
});

afterAll(async () => {
  await prisma.designModelVersion.deleteMany({ where: { modelId } });
  await prisma.designModel.delete({ where: { id: modelId } }).catch(() => undefined);
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
});

describe('model conversion runner', () => {
  it('writes the extracted element index and diagnostic counts before publishing ready', async () => {
    const store = new FakeModelObjectStore();
    const source = Buffer.from('source with injectable extraction');
    const target = await createVersion(source);
    store.objects.set(target.sourceRef, source);

    expect(
      await runNextConversion({
        leaseOwner: 'runner',
        store,
        convert: async () => Uint8Array.from([1, 2, 3]),
        extract: async () => ({
          elements: [
            {
              ifcGuid: 'ifc-guid-1',
              name: 'Drainage element',
              category: 'IFCBUILDINGELEMENTPROXY',
              lotNumberValue: 'LOT-1',
              objectCode: 'OBJ-1',
            },
          ],
          skippedMissingGuid: 2,
          skippedDuplicateGuid: 1,
        }),
      }),
    ).toBe('ready');

    expect(await prisma.modelElement.findMany({ where: { versionId: target.version.id } })).toEqual(
      [expect.objectContaining({ ifcGuid: 'ifc-guid-1', lotNumberValue: 'LOT-1' })],
    );
    const updated = await prisma.designModelVersion.findUniqueOrThrow({
      where: { id: target.version.id },
    });
    expect(updated.diagnostics).toMatchObject({
      elementCount: 1,
      skippedMissingGuid: 2,
      skippedDuplicateGuid: 1,
    });
  });

  it('catches invalid IFC bytes and remains callable for the next job', async () => {
    const store = new FakeModelObjectStore();
    const garbage = crypto.randomBytes(64);
    const first = await createVersion(garbage);
    store.objects.set(first.sourceRef, garbage);

    expect(await runNextConversion({ leaseOwner: 'runner', store })).toBe('failed');
    const failed = await prisma.designModelVersion.findUnique({ where: { id: first.version.id } });
    expect(failed?.status).toBe('failed');
    expect(failed?.lastFailureReason).toBeTruthy();

    const validForInjectedConverter = Buffer.from('injected source');
    const second = await createVersion(validForInjectedConverter);
    store.objects.set(second.sourceRef, validForInjectedConverter);
    expect(
      await runNextConversion({
        leaseOwner: 'runner',
        store,
        convert: async () => Uint8Array.from([1, 2, 3]),
      }),
    ).toBe('ready');
    expect(
      (await prisma.designModelVersion.findUnique({ where: { id: second.version.id } }))?.status,
    ).toBe('ready');
    // 120 s: the first real conversion cold-boots the web-ifc wasm, which can
    // exceed the default 30 s under CI coverage instrumentation on a cold runner.
  }, 120_000);

  it('copies a same-project cache hit without constructing the importer', async () => {
    const store = new FakeModelObjectStore();
    const sharedSha = 'a'.repeat(64);
    const cached = await createVersion(Buffer.from('cached source'), sharedSha);
    const cachedFragRef = fragmentObjectRef(projectId, modelId, cached.version.id);
    const cachedFrag = Buffer.from('cached fragment');
    store.objects.set(cachedFragRef, cachedFrag);
    await prisma.designModelVersion.update({
      where: { id: cached.version.id },
      data: {
        status: 'ready',
        nextAttemptAt: null,
        converterVersion: CONVERTER_VERSION,
        fragStorageRef: cachedFragRef,
        fragSizeBytes: BigInt(cachedFrag.length),
        convertedAt: new Date(),
        diagnostics: {
          elementCount: 1,
          skippedMissingGuid: 1,
          skippedDuplicateGuid: 2,
        },
      },
    });
    await prisma.modelElement.create({
      data: {
        versionId: cached.version.id,
        ifcGuid: 'cached-guid',
        name: 'Cached element',
        category: 'IFCWALL',
        lotNumberValue: 'LOT-CACHED',
      },
    });

    const target = await createVersion(Buffer.from('same digest target'), sharedSha);
    store.objects.set(target.sourceRef, Buffer.from('same digest target'));
    const convert = vi.fn(async () => Uint8Array.from([9]));
    expect(await runNextConversion({ leaseOwner: 'runner', store, convert })).toBe('cache_hit');
    expect(convert).not.toHaveBeenCalled();
    expect(store.copy).toHaveBeenCalledWith(
      cachedFragRef,
      fragmentObjectRef(projectId, modelId, target.version.id),
    );

    const updated = await prisma.designModelVersion.findUnique({
      where: { id: target.version.id },
    });
    expect(updated?.status).toBe('ready');
    expect(updated?.diagnostics).toEqual({
      cacheHitFromVersionId: cached.version.id,
      elementCount: 1,
      skippedMissingGuid: 1,
      skippedDuplicateGuid: 2,
    });
    expect(await prisma.modelElement.findMany({ where: { versionId: target.version.id } })).toEqual(
      [expect.objectContaining({ ifcGuid: 'cached-guid', lotNumberValue: 'LOT-CACHED' })],
    );
  });

  it('publishes a viewable ready version when element extraction fails', async () => {
    const store = new FakeModelObjectStore();
    const source = Buffer.from('source whose index fails');
    const target = await createVersion(source);
    store.objects.set(target.sourceRef, source);

    expect(
      await runNextConversion({
        leaseOwner: 'runner',
        store,
        convert: async () => Uint8Array.from([4, 5, 6]),
        extract: async () => {
          throw new Error('fixture extraction failure');
        },
      }),
    ).toBe('ready');
    const updated = await prisma.designModelVersion.findUniqueOrThrow({
      where: { id: target.version.id },
    });
    expect(updated.status).toBe('ready');
    expect(updated.diagnostics).toMatchObject({ elementIndexError: 'fixture extraction failure' });
  });
});

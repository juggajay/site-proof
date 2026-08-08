import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createLocalModelObjectStore,
  orthoSourceObjectRef,
  orthoTileObjectRef,
  orthoTileStorageRoot,
} from '../models/modelObjectStore.js';
import { prisma } from '../prisma.js';
import { getUploadSubdirectoryPath } from '../uploadPaths.js';
import { runNextOrthoTiling } from './orthoRunner.js';
import type { GdalExecutor } from './tiling.js';

const tag = `ortho-runner-${Date.now()}`;
const fixtureUrl = new URL('./fixtures/camino-gdalinfo.json', import.meta.url);
let companyId: string;
let projectId: string;

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
});

afterAll(async () => {
  await prisma.orthoLayer.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
  await fs.promises.rm(getUploadSubdirectoryPath(`ortho/${projectId}`), {
    recursive: true,
    force: true,
  });
});

describe('ortho tiling runner', () => {
  it('runs injected GDAL, uploads tiles and publishes the fenced result', async () => {
    const ortho = await prisma.orthoLayer.create({
      data: {
        projectId,
        name: 'Camino flight',
        fileName: 'camino.tif',
        sourceSizeBytes: 6n,
        sourceSha256: 'b'.repeat(64),
        status: 'queued',
        nextAttemptAt: new Date(0),
      },
    });
    const store = createLocalModelObjectStore();
    const sourceRef = orthoSourceObjectRef(projectId, ortho.id);
    const scratch = getUploadSubdirectoryPath('ortho-runner-fixtures');
    await fs.promises.mkdir(scratch, { recursive: true });
    const sourcePath = path.join(scratch, 'source.tif');
    await fs.promises.writeFile(sourcePath, 'source');
    await store.writeFromFile(sourcePath, sourceRef, 'image/tiff');
    await prisma.orthoLayer.update({
      where: { id: ortho.id },
      data: { sourceStorageRef: sourceRef },
    });

    const fixture = await fs.promises.readFile(fixtureUrl, 'utf8');
    const invocations: string[] = [];
    const runGdal: GdalExecutor = async (executable, args) => {
      invocations.push(`${executable} ${args.join(' ')}`);
      if (executable === 'gdalinfo') return { stdout: fixture, stderr: '' };
      const outputDirectory = args.at(-1)!;
      const tilePath = path.join(outputDirectory, '16', '1', '2.png');
      await fs.promises.mkdir(path.dirname(tilePath), { recursive: true });
      await fs.promises.writeFile(tilePath, 'png');
      return { stdout: '', stderr: '' };
    };

    expect(await runNextOrthoTiling({ leaseOwner: 'test-worker', store, runGdal })).toBe('ready');
    const ready = await prisma.orthoLayer.findUniqueOrThrow({ where: { id: ortho.id } });
    expect(ready).toMatchObject({ status: 'ready', minZoom: 16, maxZoom: 22, tileCount: 1 });
    expect(invocations[1]).toContain('gdal2tiles.py --xyz --processes=4 --resume');
    expect(
      await store.sizeOf(orthoTileObjectRef(orthoTileStorageRoot(projectId, ortho.id), 16, 1, 2)),
    ).toBe(3n);
  });
});

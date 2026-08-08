import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createLocalModelObjectStore,
  orthoSourceObjectRef,
  orthoTileObjectRef,
  orthoTileStorageRoot,
} from '../lib/models/modelObjectStore.js';
import { ORTHO_UPLOAD_SCRATCH } from '../lib/models/uploadParts.js';
import { prisma } from '../lib/prisma.js';
import { getUploadSubdirectoryPath } from '../lib/uploadPaths.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { orthoLayersRouter } from './orthoLayers.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', orthoLayersRouter);
app.use(errorHandler);

const tag = `ortho-routes-${Date.now()}`;
let companyId: string;
let projectId: string;
let ownerId: string;
let ownerToken: string;
let subcontractorId: string;
let subcontractorToken: string;

function auth(token = ownerToken) {
  return { Authorization: `Bearer ${token}` };
}

async function createUploadingOrtho(bytes = Buffer.from('tiny geotiff fixture')) {
  const response = await request(app)
    .post(`/api/projects/${projectId}/orthos`)
    .set(auth())
    .send({
      name: 'Camino flight',
      capturedAt: '2026-08-01T00:00:00.000Z',
      fileName: 'camino.tif',
      sizeBytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
  expect(response.status).toBe(201);
  return { orthoId: response.body.orthoId as string, bytes };
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
  const owner = await registerTestUser(app, {
    fullName: 'Ortho Owner',
    emailPrefix: `${tag}-owner`,
    companyId,
    roleInCompany: 'owner',
  });
  ownerId = owner.userId;
  ownerToken = owner.token;
  const subcontractor = await registerTestUser(app, {
    fullName: 'Ortho Subcontractor',
    emailPrefix: `${tag}-subbie`,
    companyId,
    roleInCompany: 'subcontractor',
  });
  subcontractorId = subcontractor.userId;
  subcontractorToken = subcontractor.token;
});

afterEach(async () => {
  await prisma.orthoLayer.deleteMany({ where: { projectId } });
  await fs.promises.rm(getUploadSubdirectoryPath(ORTHO_UPLOAD_SCRATCH), {
    recursive: true,
    force: true,
  });
  await fs.promises.rm(getUploadSubdirectoryPath(`ortho/${projectId}`), {
    recursive: true,
    force: true,
  });
});

afterAll(async () => {
  await prisma.orthoLayer.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  const userIds = [ownerId, subcontractorId];
  await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
});

describe('orthophoto routes', () => {
  it('uploads one resumable part, verifies sha256 and queues the layer', async () => {
    const { orthoId, bytes } = await createUploadingOrtho();
    await request(app)
      .put(`/api/projects/${projectId}/orthos/${orthoId}/parts/0`)
      .set(auth())
      .attach('file', bytes, 'part')
      .expect(200);
    const received = await request(app)
      .get(`/api/projects/${projectId}/orthos/${orthoId}/parts`)
      .set(auth());
    expect(received.body).toEqual({ received: [0] });

    const complete = await request(app)
      .post(`/api/projects/${projectId}/orthos/${orthoId}/complete`)
      .set(auth());
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('queued');
    expect(complete.body.sourceSizeBytes).toBe(String(bytes.length));
    expect((await prisma.orthoLayer.findUnique({ where: { id: orthoId } }))?.sourceStorageRef).toBe(
      orthoSourceObjectRef(projectId, orthoId),
    );
  });

  it('lists layers and returns 404 for tiles before the layer is ready', async () => {
    const { orthoId } = await createUploadingOrtho();
    const list = await request(app).get(`/api/projects/${projectId}/orthos`).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.orthos[0]).toMatchObject({ id: orthoId, status: 'uploading' });
    expect(list.body.orthos[0].tileUrlTemplate).toBeNull();

    await request(app)
      .get(`/api/projects/${projectId}/orthos/${orthoId}/tiles/16/1/2.png`)
      .expect(404);
  });

  it('streams a ready immutable tile through its signed URL template', async () => {
    const { orthoId } = await createUploadingOrtho();
    const store = createLocalModelObjectStore();
    const root = orthoTileStorageRoot(projectId, orthoId);
    const tileRef = orthoTileObjectRef(root, 16, 1, 2);
    const scratch = getUploadSubdirectoryPath('ortho-route-fixtures');
    await fs.promises.mkdir(scratch, { recursive: true });
    const tilePath = path.join(scratch, 'tile.png');
    await fs.promises.writeFile(tilePath, 'png');
    await store.writeFromFile(tilePath, tileRef, 'image/png');
    await prisma.orthoLayer.update({
      where: { id: orthoId },
      data: {
        status: 'ready',
        tileStorageRoot: root,
        boundsWgs84: [150, -34, 150.1, -33.9],
        minZoom: 16,
        maxZoom: 22,
        tileCount: 1,
      },
    });
    const list = await request(app).get(`/api/projects/${projectId}/orthos`).set(auth());
    const template = list.body.orthos[0].tileUrlTemplate as string;
    const tileUrl = template.replace('{z}', '16').replace('{x}', '1').replace('{y}', '2');
    await request(app)
      .get(`/api/projects/${projectId}/orthos/${orthoId}/tiles/16/1/2.png`)
      .expect(401);
    const tile = await request(app).get(tileUrl);
    expect(tile.status).toBe(200);
    expect(tile.headers['cache-control']).toBe('private, max-age=86400, immutable');
    expect(tile.headers.etag).toBeTruthy();
    await request(app).get(tileUrl.replace('/16/', '/15/')).expect(404);
    await request(app)
      .get(`/api/projects/${projectId}/orthos/${orthoId}/tiles/not-a-zoom/1/2.png`)
      .expect(400);
  });

  it('deletes the source, tile tree and database row for an idle layer', async () => {
    const { orthoId } = await createUploadingOrtho();
    const store = createLocalModelObjectStore();
    const root = orthoTileStorageRoot(projectId, orthoId);
    const scratch = getUploadSubdirectoryPath('ortho-route-delete-fixtures');
    await fs.promises.mkdir(scratch, { recursive: true });
    const objectPath = path.join(scratch, 'object');
    await fs.promises.writeFile(objectPath, 'data');
    await store.writeFromFile(objectPath, orthoSourceObjectRef(projectId, orthoId));
    await store.writeFromFile(objectPath, orthoTileObjectRef(root, 16, 1, 2), 'image/png');
    await prisma.orthoLayer.update({
      where: { id: orthoId },
      data: {
        status: 'ready',
        sourceStorageRef: orthoSourceObjectRef(projectId, orthoId),
        tileStorageRoot: root,
        boundsWgs84: [150, -34, 150.1, -33.9],
        minZoom: 16,
        maxZoom: 22,
        tileCount: 1,
      },
    });

    await request(app)
      .delete(`/api/projects/${projectId}/orthos/${orthoId}`)
      .set(auth())
      .expect(204);

    expect(await prisma.orthoLayer.findUnique({ where: { id: orthoId } })).toBeNull();
    expect(await store.list(`ortho/${projectId}/${orthoId}`)).toEqual([]);
  });

  it('returns 409 while tiling and forbids subcontractor reads', async () => {
    const { orthoId } = await createUploadingOrtho();
    await prisma.orthoLayer.update({ where: { id: orthoId }, data: { status: 'tiling' } });
    await request(app)
      .delete(`/api/projects/${projectId}/orthos/${orthoId}`)
      .set(auth())
      .expect(409);
    await request(app)
      .get(`/api/projects/${projectId}/orthos`)
      .set(auth(subcontractorToken))
      .expect(403);
  });
});

import crypto from 'node:crypto';
import fs from 'node:fs';

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  createLocalModelObjectStore,
  fragmentObjectRef,
  sourceObjectRef,
} from '../lib/models/modelObjectStore.js';
import {
  DESIGN_MODEL_UPLOAD_SCRATCH,
  UPLOAD_PART_SIZE_BYTES,
  ensureUploadPartsDirectory,
} from '../lib/models/uploadParts.js';
import { prisma } from '../lib/prisma.js';
import { getUploadSubdirectoryPath } from '../lib/uploadPaths.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { authRouter } from './auth.js';
import { designModelsRouter } from './designModels.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', designModelsRouter);
app.use(errorHandler);

const tag = `design-model-${Date.now()}`;
let companyId: string;
let projectId: string;
let ownerToken: string;
let ownerId: string;
let foremanToken: string;
let foremanId: string;
let subcontractorToken: string;
let subcontractorId: string;

function auth(token = ownerToken) {
  return { Authorization: `Bearer ${token}` };
}

async function createModel(name = 'Coordination model') {
  const response = await request(app)
    .post(`/api/projects/${projectId}/models`)
    .set(auth())
    .send({ name });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

async function createVersion(
  modelId: string,
  bytes: Buffer,
  sha256 = crypto.createHash('sha256').update(bytes).digest('hex'),
) {
  const response = await request(app)
    .post(`/api/projects/${projectId}/models/${modelId}/versions`)
    .set(auth())
    .send({ fileName: 'model with spaces.ifc', sizeBytes: bytes.length, sha256 });
  expect(response.status).toBe(201);
  return response.body.versionId as string;
}

function partUrl(modelId: string, versionId: string, index: number) {
  return `/api/projects/${projectId}/models/${modelId}/versions/${versionId}/parts/${index}`;
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
    fullName: 'Model Owner',
    emailPrefix: `${tag}-owner`,
    companyId,
    roleInCompany: 'owner',
  });
  ownerToken = owner.token;
  ownerId = owner.userId;

  const foreman = await registerTestUser(app, {
    fullName: 'Model Foreman',
    emailPrefix: `${tag}-foreman`,
    companyId,
    roleInCompany: 'foreman',
  });
  foremanToken = foreman.token;
  foremanId = foreman.userId;
  await prisma.projectUser.create({
    data: { projectId, userId: foremanId, role: 'foreman', status: 'active' },
  });

  const subcontractor = await registerTestUser(app, {
    fullName: 'Model Subcontractor',
    emailPrefix: `${tag}-subbie`,
    companyId,
    roleInCompany: 'subcontractor',
  });
  subcontractorToken = subcontractor.token;
  subcontractorId = subcontractor.userId;
});

afterEach(async () => {
  await prisma.designModel.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await fs.promises
    .rm(getUploadSubdirectoryPath(DESIGN_MODEL_UPLOAD_SCRATCH), {
      recursive: true,
      force: true,
    })
    .catch(() => undefined);
  await fs.promises
    .rm(getUploadSubdirectoryPath(`design-models/${projectId}`), {
      recursive: true,
      force: true,
    })
    .catch(() => undefined);
});

afterAll(async () => {
  await prisma.designModel.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
  const userIds = [ownerId, foremanId, subcontractorId];
  await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
});

describe('design model upload routes', () => {
  it('returns one model with all versions in descending version order', async () => {
    const modelId = await createModel('Versioned model');
    const firstId = await createVersion(modelId, Buffer.from('first'));
    const secondId = await createVersion(modelId, Buffer.from('second'));

    const response = await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}`)
      .set(auth());
    expect(response.status).toBe(200);
    expect(response.body.model).toMatchObject({ id: modelId, name: 'Versioned model' });
    expect(response.body.versions.map((version: { id: string }) => version.id)).toEqual([
      secondId,
      firstId,
    ]);
  });

  it('creates models for managers and rejects a foreman', async () => {
    const created = await request(app)
      .post(`/api/projects/${projectId}/models`)
      .set(auth())
      .send({ name: 'Federated model' });
    expect(created.status).toBe(201);

    const denied = await request(app)
      .post(`/api/projects/${projectId}/models`)
      .set(auth(foremanToken))
      .send({ name: 'No access' });
    expect(denied.status).toBe(403);
  });

  it('rejects sources over 200 MB and malformed sha256 values', async () => {
    const modelId = await createModel();
    const tooLarge = await request(app)
      .post(`/api/projects/${projectId}/models/${modelId}/versions`)
      .set(auth())
      .send({ fileName: 'large.ifc', sizeBytes: 209_715_201, sha256: 'a'.repeat(64) });
    expect(tooLarge.status).toBe(400);
    expect(JSON.stringify(tooLarge.body)).toContain('200 MB');

    const badSha = await request(app)
      .post(`/api/projects/${projectId}/models/${modelId}/versions`)
      .set(auth())
      .send({ fileName: 'small.ifc', sizeBytes: 10, sha256: 'abc' });
    expect(badSha.status).toBe(400);
  });

  it('accepts out-of-order and repeated parts, reports resume state, and checks sizes and sha', async () => {
    const modelId = await createModel();
    const bytes = Buffer.concat([
      Buffer.alloc(UPLOAD_PART_SIZE_BYTES, 1),
      Buffer.alloc(UPLOAD_PART_SIZE_BYTES, 2),
      Buffer.from('tail'),
    ]);
    const versionId = await createVersion(modelId, bytes, '0'.repeat(64));

    expect(
      (
        await request(app)
          .put(partUrl(modelId, versionId, 2))
          .set(auth())
          .attach('file', Buffer.from('tail'), 'part')
      ).status,
    ).toBe(200);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(
        (
          await request(app)
            .put(partUrl(modelId, versionId, 0))
            .set(auth())
            .attach('file', bytes.subarray(0, UPLOAD_PART_SIZE_BYTES), 'part')
        ).status,
      ).toBe(200);
    }

    const wrongMiddle = await request(app)
      .put(partUrl(modelId, versionId, 1))
      .set(auth())
      .attach('file', Buffer.from('short'), 'part');
    expect(wrongMiddle.status).toBe(400);
    expect(JSON.stringify(wrongMiddle.body)).toContain('wrong size');

    await request(app)
      .put(partUrl(modelId, versionId, 1))
      .set(auth())
      .attach('file', bytes.subarray(UPLOAD_PART_SIZE_BYTES, 2 * UPLOAD_PART_SIZE_BYTES), 'part')
      .expect(200);

    const resume = await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/parts`)
      .set(auth());
    expect(resume.body).toEqual({ received: [0, 1, 2] });

    const complete = await request(app)
      .post(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/complete`)
      .set(auth());
    expect(complete.status).toBe(400);
    expect(JSON.stringify(complete.body)).toContain('sha256 check failed');
    expect((await fs.promises.readdir(await ensureUploadPartsDirectory(versionId))).length).toBe(3);
  });

  it('completes a valid upload into queued durable storage', async () => {
    const modelId = await createModel();
    const bytes = Buffer.from('valid IFC upload fixture');
    const versionId = await createVersion(modelId, bytes);
    await request(app)
      .put(partUrl(modelId, versionId, 0))
      .set(auth())
      .attach('file', bytes, 'part')
      .expect(200);

    const complete = await request(app)
      .post(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/complete`)
      .set(auth());
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('queued');
    expect(complete.body.sourceStorageRef).toContain('design-models/');
  });

  it('serves ready fragments with metadata headers and deletes rows and files', async () => {
    const modelId = await createModel('Bridge model');
    const source = Buffer.from('source');
    const versionId = await createVersion(modelId, source);
    const beforeReady = await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/fragments`)
      .set(auth());
    expect(beforeReady.status).toBe(404);

    const scratch = await ensureUploadPartsDirectory(versionId);
    const localFragPath = `${scratch}/fixture.frag`;
    const localSourcePath = `${scratch}/fixture.ifc`;
    const fragBytes = Buffer.from('fragment bytes');
    await fs.promises.writeFile(localSourcePath, source);
    await fs.promises.writeFile(localFragPath, fragBytes);
    const fragRef = fragmentObjectRef(projectId, modelId, versionId);
    const sourceRef = sourceObjectRef(projectId, modelId, versionId);
    const store = createLocalModelObjectStore();
    await store.writeFromFile(localSourcePath, sourceRef);
    await store.writeFromFile(localFragPath, fragRef);
    await prisma.designModelVersion.update({
      where: { id: versionId },
      data: {
        status: 'ready',
        sourceStorageRef: sourceRef,
        fragStorageRef: fragRef,
        fragSizeBytes: BigInt(fragBytes.length),
      },
    });

    const metadata = await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}`)
      .set(auth());
    expect(metadata.status).toBe(200);
    expect(metadata.body.fragSizeBytes).toBe(String(fragBytes.length));

    const download = await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/fragments`)
      .set(auth());
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/octet-stream');
    expect(download.headers['content-length']).toBe(String(fragBytes.length));
    expect(download.headers['content-disposition']).toContain('Bridge_model-v1.frag');
    expect(download.headers['cache-control']).toBe('no-store');

    await request(app)
      .delete(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}`)
      .set(auth())
      .expect(204);
    expect(await prisma.designModelVersion.findUnique({ where: { id: versionId } })).toBeNull();
    await expect(store.sizeOf(sourceRef)).rejects.toThrow();
    await expect(store.sizeOf(fragRef)).rejects.toThrow();
  });

  it('blocks whole-model deletion while converting, then removes every stored object', async () => {
    const modelId = await createModel('Delete all versions');
    const versionIds = [
      await createVersion(modelId, Buffer.from('source-v1')),
      await createVersion(modelId, Buffer.from('source-v2')),
    ];
    await prisma.designModelVersion.update({
      where: { id: versionIds[1] },
      data: { status: 'converting' },
    });
    await request(app)
      .delete(`/api/projects/${projectId}/models/${modelId}`)
      .set(auth())
      .expect(409);

    const store = createLocalModelObjectStore();
    const refs: Array<{ sourceRef: string; fragRef: string }> = [];
    for (const versionId of versionIds) {
      const scratch = await ensureUploadPartsDirectory(versionId);
      const sourcePath = `${scratch}/delete-source.ifc`;
      const fragPath = `${scratch}/delete-frag.frag`;
      await fs.promises.writeFile(sourcePath, `source-${versionId}`);
      await fs.promises.writeFile(fragPath, `fragment-${versionId}`);
      const sourceRef = sourceObjectRef(projectId, modelId, versionId);
      const fragRef = fragmentObjectRef(projectId, modelId, versionId);
      refs.push({ sourceRef, fragRef });
      await store.writeFromFile(sourcePath, sourceRef);
      await store.writeFromFile(fragPath, fragRef);
      await prisma.designModelVersion.update({
        where: { id: versionId },
        data: {
          status: 'ready',
          sourceStorageRef: sourceRef,
          fragStorageRef: fragRef,
          fragSizeBytes: BigInt(`fragment-${versionId}`.length),
        },
      });
    }

    await request(app)
      .delete(`/api/projects/${projectId}/models/${modelId}`)
      .set(auth())
      .expect(204);
    expect(await prisma.designModel.findUnique({ where: { id: modelId } })).toBeNull();
    for (const { sourceRef, fragRef } of refs) {
      await expect(store.sizeOf(sourceRef)).rejects.toThrow();
      await expect(store.sizeOf(fragRef)).rejects.toThrow();
    }
  });

  it('returns compact element links and live counts, and forbids a subcontractor', async () => {
    const modelId = await createModel('Linked model');
    const versionId = await createVersion(modelId, Buffer.from('linked source'));
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `${tag}-LINKED`,
        lotType: 'general',
        activityType: 'Earthworks',
      },
    });
    const linked = await prisma.modelElement.create({
      data: { versionId, ifcGuid: 'linked-guid', lotNumberValue: lot.lotNumber },
    });
    await prisma.modelElement.create({
      data: { versionId, ifcGuid: 'unlinked-guid', lotNumberValue: null },
    });
    await prisma.modelElementLotLink.create({
      data: { versionId, elementId: linked.id, lotId: lot.id, source: 'auto' },
    });

    const response = await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/element-links`)
      .set(auth());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      links: [{ ifcGuid: 'linked-guid', lotId: lot.id }],
      counts: { elements: 2, linked: 1, unlinked: 1 },
    });

    await request(app)
      .get(`/api/projects/${projectId}/models/${modelId}/versions/${versionId}/element-links`)
      .set(auth(subcontractorToken))
      .expect(403);
  });

  it('forbids subcontractor reads', async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}/models`)
      .set(auth(subcontractorToken));
    expect(response.status).toBe(403);
  });
});

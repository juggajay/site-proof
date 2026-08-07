import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { DesignModelVersion } from '@prisma/client';
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  fragmentObjectRef,
  resolveModelObjectStore,
  sourceObjectRef,
} from '../lib/models/modelObjectStore.js';
import {
  MAX_SOURCE_SIZE_BYTES,
  UPLOAD_PART_SIZE_BYTES,
  ensureUploadPartsDirectory,
  listReceivedParts,
  removeUploadParts,
  uploadPartPath,
  uploadPartsDirectory,
} from '../lib/models/uploadParts.js';
import { prisma } from '../lib/prisma.js';
import {
  checkProjectAccess,
  requireProjectRoleExcludingSubcontractors,
} from '../lib/projectAccess.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';

export const MODEL_MANAGERS = ['owner', 'admin', 'project_manager'] as const;
const MANAGE_DENIED = 'You do not have permission to manage design models';
const SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

const createModelSchema = z.object({ name: z.string().trim().min(1).max(200) });
const createVersionSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_SOURCE_SIZE_BYTES, 'IFC source files are limited to 200 MB'),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'sha256 must be 64 hexadecimal characters'),
});
const partIndexSchema = z.coerce.number().int().min(0);

const partUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 9 * 1024 * 1024 },
}).single('file');

const designModelsRouter = Router();
designModelsRouter.use(requireAuth);

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function serializeVersion(version: DesignModelVersion) {
  return {
    id: version.id,
    modelId: version.modelId,
    versionNumber: version.versionNumber,
    status: version.status,
    fileName: version.fileName,
    sourceSizeBytes: version.sourceSizeBytes.toString(),
    sourceSha256: version.sourceSha256,
    sourceStorageRef: version.sourceStorageRef,
    fragStorageRef: version.fragStorageRef,
    fragSizeBytes: version.fragSizeBytes?.toString() ?? null,
    converterVersion: version.converterVersion,
    diagnostics: version.diagnostics,
    failureCount: version.failureCount,
    lastFailureReason: version.lastFailureReason,
    convertedAt: version.convertedAt?.toISOString() ?? null,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

async function requireReadAccess(
  projectId: string,
  user: NonNullable<Request['user']>,
): Promise<void> {
  if (SUBCONTRACTOR_ROLES.has(user.roleInCompany)) {
    throw AppError.forbidden('Design models are not available in the subcontractor portal');
  }
  if (!(await checkProjectAccess(user.id, projectId))) {
    throw AppError.forbidden('Access denied');
  }
}

async function requireManageAccess(
  projectId: string,
  user: NonNullable<Request['user']>,
): Promise<void> {
  await requireReadAccess(projectId, user);
  await requireProjectRoleExcludingSubcontractors(projectId, user, MODEL_MANAGERS, MANAGE_DENIED, {
    requireWritable: true,
  });
}

async function loadModel(projectId: string, modelId: string) {
  const model = await prisma.designModel.findUnique({ where: { id: modelId } });
  if (!model || model.projectId !== projectId) throw AppError.notFound('Design model');
  return model;
}

async function loadVersion(projectId: string, modelId: string, versionId: string) {
  const model = await loadModel(projectId, modelId);
  const version = await prisma.designModelVersion.findUnique({ where: { id: versionId } });
  if (!version || version.modelId !== model.id) throw AppError.notFound('Design model version');
  return { model, version };
}

function parseNestedParams(req: Request) {
  return {
    projectId: parseProjectRouteParam(req.params.projectId, 'projectId'),
    modelId: parseProjectRouteParam(req.params.modelId, 'modelId'),
    versionId: parseProjectRouteParam(req.params.versionId, 'versionId'),
  };
}

designModelsRouter.post(
  '/:projectId/models',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireManageAccess(projectId, req.user!);
    const parsed = createModelSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.fromZodError(parsed.error);

    const model = await prisma.designModel.create({
      data: { projectId, name: parsed.data.name, createdById: req.user!.id },
    });
    res.status(201).json(model);
  }),
);

designModelsRouter.get(
  '/:projectId/models',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireReadAccess(projectId, req.user!);
    const models = await prisma.designModel.findMany({
      where: { projectId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      models: models.map(({ versions, ...model }) => ({
        ...model,
        latestVersion: versions[0]
          ? {
              id: versions[0].id,
              versionNumber: versions[0].versionNumber,
              status: versions[0].status,
              fragSizeBytes: versions[0].fragSizeBytes?.toString() ?? null,
              createdAt: versions[0].createdAt.toISOString(),
            }
          : null,
      })),
    });
  }),
);

designModelsRouter.get(
  '/:projectId/models/:modelId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const modelId = parseProjectRouteParam(req.params.modelId, 'modelId');
    await requireReadAccess(projectId, req.user!);
    const model = await loadModel(projectId, modelId);
    const versions = await prisma.designModelVersion.findMany({
      where: { modelId },
      orderBy: { versionNumber: 'desc' },
    });
    res.json({ model, versions: versions.map(serializeVersion) });
  }),
);

designModelsRouter.delete(
  '/:projectId/models/:modelId',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const modelId = parseProjectRouteParam(req.params.modelId, 'modelId');
    await requireManageAccess(projectId, req.user!);
    await loadModel(projectId, modelId);
    const versions = await prisma.designModelVersion.findMany({ where: { modelId } });
    if (versions.some((version) => version.status === 'converting')) {
      throw AppError.conflict('A design model with a converting version cannot be deleted');
    }

    const store = resolveModelObjectStore();
    for (const version of versions) {
      const expectedSourceRef = sourceObjectRef(projectId, modelId, version.id);
      const expectedFragRef = fragmentObjectRef(projectId, modelId, version.id);
      if (version.sourceStorageRef === expectedSourceRef) await store.delete(expectedSourceRef);
      if (version.fragStorageRef === expectedFragRef) await store.delete(expectedFragRef);
      await removeUploadParts(version.id);
    }
    const deleted = await prisma.designModel.deleteMany({
      where: { id: modelId, versions: { none: { status: 'converting' } } },
    });
    if (deleted.count !== 1) {
      throw AppError.conflict('A design model with a converting version cannot be deleted');
    }
    res.status(204).send();
  }),
);

designModelsRouter.post(
  '/:projectId/models/:modelId/versions',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    const modelId = parseProjectRouteParam(req.params.modelId, 'modelId');
    await requireManageAccess(projectId, req.user!);
    await loadModel(projectId, modelId);
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.fromZodError(parsed.error);

    const version = await prisma.$transaction(async (tx) => {
      const latest = await tx.designModelVersion.aggregate({
        where: { modelId },
        _max: { versionNumber: true },
      });
      return tx.designModelVersion.create({
        data: {
          modelId,
          versionNumber: (latest._max.versionNumber ?? 0) + 1,
          fileName: sanitizeFileName(parsed.data.fileName),
          sourceSizeBytes: BigInt(parsed.data.sizeBytes),
          sourceSha256: parsed.data.sha256.toLowerCase(),
          uploadedById: req.user!.id,
        },
      });
    });

    res.status(201).json({
      versionId: version.id,
      partSizeBytes: UPLOAD_PART_SIZE_BYTES,
      partCount: Math.ceil(parsed.data.sizeBytes / UPLOAD_PART_SIZE_BYTES),
    });
  }),
);

designModelsRouter.put(
  '/:projectId/models/:modelId/versions/:versionId/parts/:index',
  partUpload,
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    const indexResult = partIndexSchema.safeParse(req.params.index);
    if (!indexResult.success) throw AppError.badRequest('index must be a non-negative integer');
    await requireManageAccess(projectId, req.user!);
    const { version } = await loadVersion(projectId, modelId, versionId);
    if (version.status !== 'uploading') {
      throw AppError.conflict('Only an uploading design-model version accepts parts');
    }
    if (!req.file) throw AppError.badRequest('A multipart file field named file is required');

    const partCount = Math.ceil(Number(version.sourceSizeBytes) / UPLOAD_PART_SIZE_BYTES);
    const index = indexResult.data;
    if (index >= partCount) throw AppError.badRequest('Part index is outside the declared upload');
    const finalSize = Number(version.sourceSizeBytes) - (partCount - 1) * UPLOAD_PART_SIZE_BYTES;
    const expectedSize = index === partCount - 1 ? finalSize : UPLOAD_PART_SIZE_BYTES;
    if (req.file.size !== expectedSize) {
      throw AppError.badRequest(`Part ${index} has the wrong size: expected ${expectedSize} bytes`);
    }

    const directory = await ensureUploadPartsDirectory(version.id);
    const destination = path.join(directory, index.toString().padStart(6, '0'));
    await fs.promises.writeFile(destination, req.file.buffer);
    res.json({ index, sizeBytes: req.file.size });
  }),
);

designModelsRouter.get(
  '/:projectId/models/:modelId/versions/:versionId/parts',
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    await requireManageAccess(projectId, req.user!);
    await loadVersion(projectId, modelId, versionId);
    // Staged parts live on Railway's ephemeral disk. A redeploy produces an
    // incomplete list and the resumable client re-sends the missing indexes.
    res.json({ received: await listReceivedParts(versionId) });
  }),
);

designModelsRouter.post(
  '/:projectId/models/:modelId/versions/:versionId/complete',
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    await requireManageAccess(projectId, req.user!);
    const { version } = await loadVersion(projectId, modelId, versionId);
    if (version.status !== 'uploading') {
      throw AppError.conflict('Only an uploading design-model version can be completed');
    }

    const partCount = Math.ceil(Number(version.sourceSizeBytes) / UPLOAD_PART_SIZE_BYTES);
    const received = await listReceivedParts(version.id);
    const expected = Array.from({ length: partCount }, (_unused, index) => index);
    if (received.length !== expected.length || received.some((value, index) => value !== index)) {
      throw AppError.badRequest('Upload is incomplete: all declared parts must be present');
    }

    const assembledPath = path.join(
      uploadPartsDirectory(version.id),
      `assembled-${crypto.randomUUID()}.ifc`,
    );
    const handle = await fs.promises.open(assembledPath, 'w');
    const hash = crypto.createHash('sha256');
    let byteCount = 0;
    try {
      for (const index of expected) {
        for await (const chunk of fs.createReadStream(uploadPartPath(version.id, index))) {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
          hash.update(buffer);
          byteCount += buffer.length;
          await handle.write(buffer);
        }
      }
    } finally {
      await handle.close();
    }

    const actualSha256 = hash.digest('hex');
    if (byteCount !== Number(version.sourceSizeBytes)) {
      await fs.promises.rm(assembledPath, { force: true });
      throw AppError.badRequest(
        `Upload byte-count check failed: expected ${version.sourceSizeBytes.toString()}, received ${byteCount}`,
      );
    }
    if (actualSha256 !== version.sourceSha256) {
      await fs.promises.rm(assembledPath, { force: true });
      throw AppError.badRequest('Upload sha256 check failed');
    }

    const sourceRef = sourceObjectRef(projectId, modelId, version.id);
    const store = resolveModelObjectStore();
    await store.writeFromFile(assembledPath, sourceRef);
    const completed = await prisma.designModelVersion.updateMany({
      where: { id: version.id, status: 'uploading' },
      data: { sourceStorageRef: sourceRef, status: 'queued', nextAttemptAt: new Date() },
    });
    if (completed.count !== 1) {
      const current = await prisma.designModelVersion.findUnique({ where: { id: version.id } });
      if (!current) await store.delete(sourceRef);
      throw AppError.conflict('This design-model upload is no longer accepting completion');
    }
    const updated = await prisma.designModelVersion.findUniqueOrThrow({
      where: { id: version.id },
    });
    await removeUploadParts(version.id);
    res.json(serializeVersion(updated));
  }),
);

designModelsRouter.get(
  '/:projectId/models/:modelId/versions/:versionId',
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    await requireReadAccess(projectId, req.user!);
    const { version } = await loadVersion(projectId, modelId, versionId);
    res.json(serializeVersion(version));
  }),
);

designModelsRouter.get(
  '/:projectId/models/:modelId/versions/:versionId/element-links',
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    await requireReadAccess(projectId, req.user!);
    await loadVersion(projectId, modelId, versionId);

    const [elements, linked, latestProposal] = await Promise.all([
      prisma.modelElement.findMany({
        where: { versionId },
        select: {
          ifcGuid: true,
          links: { select: { lotId: true } },
        },
        orderBy: { ifcGuid: 'asc' },
      }),
      prisma.modelElementLotLink.count({ where: { versionId } }),
      prisma.aiProposal.findFirst({
        where: {
          projectId,
          stage: 'model_lot_linking',
          payload: { path: ['versionId'], equals: versionId },
        },
        orderBy: { createdAt: 'desc' },
        select: { payload: true },
      }),
    ]);
    const links = elements.flatMap((element) =>
      element.links.map((link) => ({ ifcGuid: element.ifcGuid, lotId: link.lotId })),
    );
    let ambiguousAtLastProposal: number | undefined;
    if (
      latestProposal?.payload &&
      typeof latestProposal.payload === 'object' &&
      !Array.isArray(latestProposal.payload)
    ) {
      const counts = (latestProposal.payload as Record<string, unknown>).counts;
      if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
        const ambiguous = (counts as Record<string, unknown>).ambiguous;
        if (typeof ambiguous === 'number' && Number.isFinite(ambiguous)) {
          ambiguousAtLastProposal = ambiguous;
        }
      }
    }

    res.json({
      links,
      counts: {
        elements: elements.length,
        linked,
        unlinked: Math.max(0, elements.length - linked),
        ...(ambiguousAtLastProposal === undefined ? {} : { ambiguousAtLastProposal }),
      },
    });
  }),
);

designModelsRouter.get(
  '/:projectId/models/:modelId/versions/:versionId/fragments',
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    await requireReadAccess(projectId, req.user!);
    const { model, version } = await loadVersion(projectId, modelId, versionId);
    const expectedRef = fragmentObjectRef(projectId, modelId, version.id);
    if (
      version.status !== 'ready' ||
      version.fragStorageRef !== expectedRef ||
      version.fragSizeBytes === null
    ) {
      throw AppError.notFound('Design model fragments');
    }

    const source = await resolveModelObjectStore().readStream(expectedRef);
    const filename = `${sanitizeFileName(model.name)}-v${version.versionNumber}.frag`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', version.fragSizeBytes.toString());
    await pipeline(source, res);
  }),
);

designModelsRouter.delete(
  '/:projectId/models/:modelId/versions/:versionId',
  asyncHandler(async (req, res) => {
    const { projectId, modelId, versionId } = parseNestedParams(req);
    await requireManageAccess(projectId, req.user!);
    const { version } = await loadVersion(projectId, modelId, versionId);
    if (version.status === 'converting') {
      throw AppError.conflict('A converting design-model version cannot be deleted');
    }

    // ponytail: no mid-conversion cancel — jobs run seconds to ~1 min;
    // DELETE on queued/failed/ready covers cleanup.
    const store = resolveModelObjectStore();
    const expectedSourceRef = sourceObjectRef(projectId, modelId, version.id);
    const expectedFragRef = fragmentObjectRef(projectId, modelId, version.id);
    const deleted = await prisma.designModelVersion.deleteMany({
      where: { id: version.id, status: { not: 'converting' } },
    });
    if (deleted.count !== 1) {
      throw AppError.conflict('A converting design-model version cannot be deleted');
    }
    if (version.sourceStorageRef === expectedSourceRef) await store.delete(expectedSourceRef);
    if (version.fragStorageRef === expectedFragRef) await store.delete(expectedFragRef);
    await removeUploadParts(version.id);
    res.status(204).send();
  }),
);

export { designModelsRouter };

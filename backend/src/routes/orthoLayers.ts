import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { OrthoLayer } from '@prisma/client';
import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  orthoSourceObjectRef,
  orthoTileObjectRef,
  orthoTileStorageRoot,
  resolveModelObjectStore,
} from '../lib/models/modelObjectStore.js';
import {
  ORTHO_UPLOAD_SCRATCH,
  UPLOAD_PART_SIZE_BYTES,
  ensureUploadPartsDirectory,
  expectedUploadPartSize,
  listReceivedParts,
  removeUploadParts,
  uploadPartCount,
  uploadPartPath,
  uploadPartsDirectory,
} from '../lib/models/uploadParts.js';
import { prisma } from '../lib/prisma.js';
import {
  checkProjectAccess,
  requireProjectRoleExcludingSubcontractors,
} from '../lib/projectAccess.js';
import {
  createSignedStorageAccessToken,
  validateSignedStorageAccessToken,
} from '../lib/signedStorageUrls.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { parseProjectRouteParam } from './controlLines/validation.js';

export const MAX_ORTHO_SOURCE_SIZE_BYTES = 2 * 1024 ** 3;
export const ORTHO_MANAGERS = ['owner', 'admin', 'project_manager'] as const;
const ORTHO_TILE_TOKEN_TTL_MS = 48 * 60 * 60_000;
const ORTHO_TILE_TOKEN_WINDOW_MS = 24 * 60 * 60_000;
const MANAGE_DENIED = 'You do not have permission to manage orthophotos';
const SUBCONTRACTOR_ROLES = new Set(['subcontractor', 'subcontractor_admin']);

const createOrthoSchema = z.object({
  name: z.string().trim().min(1).max(200),
  capturedAt: z.string().datetime().nullable().optional(),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/\.tiff?$/i, 'A GeoTIFF file is required'),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_ORTHO_SOURCE_SIZE_BYTES, 'Orthophoto source files are limited to 2 GB'),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'sha256 must be 64 hexadecimal characters'),
});
const partIndexSchema = z.coerce.number().int().min(0);
const tileZoomSchema = z.coerce.number().int().min(0).max(22);
const tileCoordinateSchema = z.coerce.number().int().safe().min(0);

const partUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 9 * 1024 * 1024 },
}).single('file');

const orthoLayersRouter = Router();

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '_');
}

function tileTemplate(ortho: OrthoLayer): string | null {
  const expectedRoot = orthoTileStorageRoot(ortho.projectId, ortho.id);
  if (ortho.status !== 'ready' || ortho.tileStorageRoot !== expectedRoot) return null;
  const windowStart =
    Math.floor(Date.now() / ORTHO_TILE_TOKEN_WINDOW_MS) * ORTHO_TILE_TOKEN_WINDOW_MS;
  const token = createSignedStorageAccessToken(
    ortho.id,
    expectedRoot,
    ORTHO_TILE_TOKEN_TTL_MS,
    windowStart,
  );
  return `/api/projects/${encodeURIComponent(ortho.projectId)}/orthos/${encodeURIComponent(ortho.id)}/tiles/{z}/{x}/{y}.png?token=${encodeURIComponent(token)}`;
}

function serializeOrtho(ortho: OrthoLayer) {
  return {
    id: ortho.id,
    name: ortho.name,
    capturedAt: ortho.capturedAt?.toISOString() ?? null,
    status: ortho.status,
    fileName: ortho.fileName,
    sourceSizeBytes: ortho.sourceSizeBytes.toString(),
    boundsWgs84: ortho.boundsWgs84,
    minZoom: ortho.minZoom,
    maxZoom: ortho.maxZoom,
    tileCount: ortho.tileCount,
    diagnostics: ortho.status === 'failed' ? ortho.diagnostics : null,
    lastFailureReason: ortho.status === 'failed' ? ortho.lastFailureReason : null,
    tileUrlTemplate: tileTemplate(ortho),
    tiledAt: ortho.tiledAt?.toISOString() ?? null,
    createdAt: ortho.createdAt.toISOString(),
    updatedAt: ortho.updatedAt.toISOString(),
  };
}

async function requireReadAccess(
  projectId: string,
  user: NonNullable<Request['user']>,
): Promise<void> {
  if (SUBCONTRACTOR_ROLES.has(user.roleInCompany)) {
    throw AppError.forbidden('Orthophotos are not available in the subcontractor portal');
  }
  if (!(await checkProjectAccess(user.id, projectId))) throw AppError.forbidden('Access denied');
}

async function requireManageAccess(
  projectId: string,
  user: NonNullable<Request['user']>,
): Promise<void> {
  await requireReadAccess(projectId, user);
  await requireProjectRoleExcludingSubcontractors(projectId, user, ORTHO_MANAGERS, MANAGE_DENIED, {
    requireWritable: true,
  });
}

async function loadOrtho(projectId: string, orthoId: string): Promise<OrthoLayer> {
  const ortho = await prisma.orthoLayer.findUnique({ where: { id: orthoId } });
  if (!ortho || ortho.projectId !== projectId) throw AppError.notFound('Orthophoto');
  return ortho;
}

function parseOrthoParams(req: Request): { projectId: string; orthoId: string } {
  return {
    projectId: parseProjectRouteParam(req.params.projectId, 'projectId'),
    orthoId: parseProjectRouteParam(req.params.orthoId, 'orthoId'),
  };
}

// Browser tile <img> requests cannot carry the app's bearer token. Like signed
// avatar/logo URLs, this route precedes route-wide auth and accepts only a
// short-lived token bound to this layer's immutable tile root.
orthoLayersRouter.get(
  '/:projectId/orthos/:orthoId/tiles/:z/:x/:y.png',
  asyncHandler(async (req, res) => {
    const { projectId, orthoId } = parseOrthoParams(req);
    const parsed = z
      .object({ z: tileZoomSchema, x: tileCoordinateSchema, y: tileCoordinateSchema })
      .safeParse(req.params);
    if (!parsed.success) throw AppError.badRequest('z, x and y must be non-negative integers');
    const { z: zoom, x, y } = parsed.data;
    if (x >= 2 ** zoom || y >= 2 ** zoom)
      throw AppError.badRequest('Tile coordinate is outside zoom');

    const ortho = await loadOrtho(projectId, orthoId);
    const expectedRoot = orthoTileStorageRoot(projectId, orthoId);
    if (
      ortho.status !== 'ready' ||
      ortho.tileStorageRoot !== expectedRoot ||
      ortho.minZoom === null ||
      ortho.maxZoom === null ||
      zoom < ortho.minZoom ||
      zoom > ortho.maxZoom
    ) {
      throw AppError.notFound('Orthophoto tile');
    }
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    if (!validateSignedStorageAccessToken(token, ortho.id, expectedRoot)) {
      throw AppError.unauthorized('Invalid or expired orthophoto tile URL');
    }

    const ref = orthoTileObjectRef(expectedRoot, zoom, x, y);
    const etag = `"${crypto.createHash('sha256').update(ref).digest('base64url')}"`;
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    await pipeline(await resolveModelObjectStore().readStream(ref), res);
  }),
);

orthoLayersRouter.use(requireAuth);

orthoLayersRouter.post(
  '/:projectId/orthos',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireManageAccess(projectId, req.user!);
    const parsed = createOrthoSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.fromZodError(parsed.error);
    const ortho = await prisma.orthoLayer.create({
      data: {
        projectId,
        name: parsed.data.name,
        capturedAt: parsed.data.capturedAt ? new Date(parsed.data.capturedAt) : null,
        fileName: sanitizeFileName(parsed.data.fileName),
        sourceSizeBytes: BigInt(parsed.data.sizeBytes),
        sourceSha256: parsed.data.sha256.toLowerCase(),
        uploadedById: req.user!.id,
      },
    });
    res.status(201).json({
      orthoId: ortho.id,
      partSizeBytes: UPLOAD_PART_SIZE_BYTES,
      partCount: uploadPartCount(parsed.data.sizeBytes, MAX_ORTHO_SOURCE_SIZE_BYTES),
    });
  }),
);

orthoLayersRouter.put(
  '/:projectId/orthos/:orthoId/parts/:index',
  partUpload,
  asyncHandler(async (req, res) => {
    const { projectId, orthoId } = parseOrthoParams(req);
    const indexResult = partIndexSchema.safeParse(req.params.index);
    if (!indexResult.success) throw AppError.badRequest('index must be a non-negative integer');
    await requireManageAccess(projectId, req.user!);
    const ortho = await loadOrtho(projectId, orthoId);
    if (ortho.status !== 'uploading')
      throw AppError.conflict('Only an uploading orthophoto accepts parts');
    if (!req.file) throw AppError.badRequest('A multipart file field named file is required');

    const sourceSizeBytes = Number(ortho.sourceSizeBytes);
    const expectedSize = expectedUploadPartSize(
      sourceSizeBytes,
      indexResult.data,
      MAX_ORTHO_SOURCE_SIZE_BYTES,
    );
    if (req.file.size !== expectedSize) {
      throw AppError.badRequest(
        `Part ${indexResult.data} has the wrong size: expected ${expectedSize} bytes`,
      );
    }
    const directory = await ensureUploadPartsDirectory(ortho.id, ORTHO_UPLOAD_SCRATCH);
    await fs.promises.writeFile(
      path.join(directory, indexResult.data.toString().padStart(6, '0')),
      req.file.buffer,
    );
    res.json({ index: indexResult.data, sizeBytes: req.file.size });
  }),
);

orthoLayersRouter.get(
  '/:projectId/orthos/:orthoId/parts',
  asyncHandler(async (req, res) => {
    const { projectId, orthoId } = parseOrthoParams(req);
    await requireManageAccess(projectId, req.user!);
    await loadOrtho(projectId, orthoId);
    res.json({ received: await listReceivedParts(orthoId, ORTHO_UPLOAD_SCRATCH) });
  }),
);

orthoLayersRouter.post(
  '/:projectId/orthos/:orthoId/complete',
  asyncHandler(async (req, res) => {
    const { projectId, orthoId } = parseOrthoParams(req);
    await requireManageAccess(projectId, req.user!);
    const ortho = await loadOrtho(projectId, orthoId);
    if (ortho.status !== 'uploading')
      throw AppError.conflict('Only an uploading orthophoto can be completed');

    const partCount = uploadPartCount(Number(ortho.sourceSizeBytes), MAX_ORTHO_SOURCE_SIZE_BYTES);
    const received = await listReceivedParts(ortho.id, ORTHO_UPLOAD_SCRATCH);
    const expected = Array.from({ length: partCount }, (_unused, index) => index);
    if (received.length !== expected.length || received.some((value, index) => value !== index)) {
      throw AppError.badRequest('Upload is incomplete: all declared parts must be present');
    }

    const assembledPath = path.join(
      uploadPartsDirectory(ortho.id, ORTHO_UPLOAD_SCRATCH),
      `assembled-${crypto.randomUUID()}.tif`,
    );
    const handle = await fs.promises.open(assembledPath, 'w');
    const hash = crypto.createHash('sha256');
    let byteCount = 0;
    try {
      for (const index of expected) {
        for await (const chunk of fs.createReadStream(
          uploadPartPath(ortho.id, index, ORTHO_UPLOAD_SCRATCH),
        )) {
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
    if (byteCount !== Number(ortho.sourceSizeBytes) || actualSha256 !== ortho.sourceSha256) {
      await fs.promises.rm(assembledPath, { force: true });
      throw AppError.badRequest(
        byteCount !== Number(ortho.sourceSizeBytes)
          ? 'Upload byte-count check failed'
          : 'Upload sha256 check failed',
      );
    }

    const sourceRef = orthoSourceObjectRef(projectId, ortho.id);
    const store = resolveModelObjectStore();
    await store.writeFromFile(assembledPath, sourceRef, 'image/tiff');
    const completed = await prisma.orthoLayer.updateMany({
      where: { id: ortho.id, status: 'uploading' },
      data: { sourceStorageRef: sourceRef, status: 'queued', nextAttemptAt: new Date() },
    });
    if (completed.count !== 1) {
      const current = await prisma.orthoLayer.findUnique({ where: { id: ortho.id } });
      if (!current) await store.delete(sourceRef);
      throw AppError.conflict('This orthophoto upload is no longer accepting completion');
    }
    await removeUploadParts(ortho.id, ORTHO_UPLOAD_SCRATCH);
    res.json(
      serializeOrtho(await prisma.orthoLayer.findUniqueOrThrow({ where: { id: ortho.id } })),
    );
  }),
);

orthoLayersRouter.get(
  '/:projectId/orthos',
  asyncHandler(async (req, res) => {
    const projectId = parseProjectRouteParam(req.params.projectId, 'projectId');
    await requireReadAccess(projectId, req.user!);
    const orthos = await prisma.orthoLayer.findMany({
      where: { projectId },
      orderBy: [{ capturedAt: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ orthos: orthos.map(serializeOrtho) });
  }),
);

orthoLayersRouter.delete(
  '/:projectId/orthos/:orthoId',
  asyncHandler(async (req, res) => {
    const { projectId, orthoId } = parseOrthoParams(req);
    await requireManageAccess(projectId, req.user!);
    const ortho = await loadOrtho(projectId, orthoId);
    if (ortho.status === 'tiling') throw AppError.conflict('A tiling orthophoto cannot be deleted');

    // ponytail: no mid-tiling cancel; queued/failed/ready cleanup is explicit.
    const deleted = await prisma.orthoLayer.deleteMany({
      where: { id: ortho.id, status: { not: 'tiling' } },
    });
    if (deleted.count !== 1) throw AppError.conflict('A tiling orthophoto cannot be deleted');
    const store = resolveModelObjectStore();
    const objectPrefix = `ortho/${projectId}/${ortho.id}`;
    await store.deleteMany(await store.list(objectPrefix));
    await removeUploadParts(ortho.id, ORTHO_UPLOAD_SCRATCH);
    res.status(204).send();
  }),
);

export { orthoLayersRouter };

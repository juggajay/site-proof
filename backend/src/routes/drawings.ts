// Feature #250: Drawing Register API routes
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { ensureUploadSubdirectory, resolveUploadPath } from '../lib/uploadPaths.js';
import { assertUploadedFileMatchesDeclaredType } from '../lib/imageValidation.js';
import { getPaginationMeta, getPrismaSkipTake, parsePagination } from '../lib/pagination.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../lib/supabase.js';

const DRAWINGS_STORAGE_PREFIX = 'drawings';

const router = Router();
const DRAWING_STATUSES = ['preliminary', 'for_construction', 'as_built'] as const;
const DRAWING_WRITE_ROLES = [
  'owner',
  'admin',
  'project_manager',
  'quality_manager',
  'site_manager',
  'site_engineer',
  'foreman',
];
const SUBCONTRACTOR_DRAWING_ROLES = ['subcontractor_admin', 'subcontractor'];
const MAX_ID_LENGTH = 120;
const MAX_DRAWING_NUMBER_LENGTH = 120;
const MAX_TITLE_LENGTH = 240;
const MAX_REVISION_LENGTH = 40;
const MAX_DATE_LENGTH = 32;
const MAX_FILENAME_LENGTH = 180;
const MAX_SEARCH_LENGTH = 200;
const MAX_CURRENT_SET_DOWNLOAD_DRAWINGS = 500;

type AuthUser = NonNullable<Express.Request['user']>;

const requiredFormStringSchema = (fieldName: string, maxLength = MAX_ID_LENGTH) =>
  z.string().trim().min(1, `${fieldName} is required`).max(maxLength, `${fieldName} is too long`);

const nullableFormStringSchema = (fieldName: string, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) {
        return value;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${fieldName} is too long`).nullish(),
  );

const optionalDrawingStatusSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.enum(DRAWING_STATUSES).optional());

const createDrawingSchema = z.object({
  projectId: requiredFormStringSchema('projectId'),
  drawingNumber: requiredFormStringSchema('drawingNumber', MAX_DRAWING_NUMBER_LENGTH),
  title: nullableFormStringSchema('title', MAX_TITLE_LENGTH),
  revision: nullableFormStringSchema('revision', MAX_REVISION_LENGTH),
  issueDate: nullableFormStringSchema('issueDate', MAX_DATE_LENGTH),
  status: optionalDrawingStatusSchema,
});

const updateDrawingSchema = z.object({
  title: nullableFormStringSchema('title', MAX_TITLE_LENGTH),
  revision: nullableFormStringSchema('revision', MAX_REVISION_LENGTH),
  issueDate: nullableFormStringSchema('issueDate', MAX_DATE_LENGTH),
  status: optionalDrawingStatusSchema,
  supersededById: nullableFormStringSchema('supersededById', MAX_ID_LENGTH),
});

const supersedeDrawingSchema = z.object({
  title: nullableFormStringSchema('title', MAX_TITLE_LENGTH),
  revision: requiredFormStringSchema('revision', MAX_REVISION_LENGTH),
  issueDate: nullableFormStringSchema('issueDate', MAX_DATE_LENGTH),
  status: optionalDrawingStatusSchema,
});

// Apply auth middleware
router.use(requireAuth);

// Configure multer for drawing file uploads.
// When Supabase Storage is configured we keep uploads in memory and stream
// them to the `documents` bucket under a `drawings/<projectId>/...` prefix.
// Otherwise we fall back to the local filesystem (dev only — Railway's
// filesystem is ephemeral).
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('drawings'));
    } catch (error) {
      cb(
        error instanceof Error ? error : new Error('Failed to prepare drawing upload directory'),
        '',
      );
    }
  },
  filename: (_req, file, cb) => {
    cb(null, buildStoredFilename(file.originalname));
  },
});

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: isSupabaseConfigured() ? memoryStorage : diskStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for drawings
  fileFilter: (_req, file, cb) => {
    // Accept common drawing types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'application/dxf',
      'application/dwg',
      'application/vnd.dwg',
    ];
    // Also accept by extension for CAD files
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowedTypes.includes(file.mimetype) ||
      ['.pdf', '.dwg', '.dxf', '.jpg', '.jpeg', '.png', '.tiff', '.tif'].includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

function cleanupUploadedFile(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function sanitizeUploadFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);

  return sanitized || 'upload';
}

function buildStoredFilename(originalName: string): string {
  const uniqueSuffix = `${Date.now()}-${crypto.randomUUID()}`;
  return `${uniqueSuffix}-${sanitizeUploadFilename(originalName)}`;
}

async function uploadDrawingToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<{ url: string; storagePath: string }> {
  const storagePath = `${DRAWINGS_STORAGE_PREFIX}/${projectId}/${buildStoredFilename(file.originalname)}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase drawing upload failed:', error);
    throw AppError.internal('Failed to upload drawing');
  }

  return {
    url: getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath),
    storagePath,
  };
}

async function deleteDrawingFromSupabase(fileUrl: string): Promise<void> {
  const storagePath = getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET);
  if (!storagePath) {
    return;
  }

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .remove([storagePath]);

  if (error) {
    logError('Supabase drawing delete failed:', error);
  }
}

// Best-effort cleanup after a failed drawing upload. Removes either the
// Supabase object (if we already uploaded) or the local temp file.
async function cleanupStoredDrawingUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getSupabaseStoragePath(fileUrl, DOCUMENTS_BUCKET)) {
    await deleteDrawingFromSupabase(fileUrl);
    return;
  }
  cleanupUploadedFile(file);
}

function getOptionalQueryString(
  query: Request['query'],
  fieldName: string,
  maxLength: number,
): string | undefined {
  const value = query[fieldName];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function parseDrawingRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > MAX_ID_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function requireValidDrawingRouteParam(fieldName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    parseDrawingRouteParam(req.params[fieldName], fieldName);
    next();
  };
}

function getOptionalStatusQuery(
  query: Request['query'],
): (typeof DRAWING_STATUSES)[number] | undefined {
  const status = getOptionalQueryString(query, 'status', MAX_REVISION_LENGTH);
  if (!status) {
    return undefined;
  }

  const parsed = z.enum(DRAWING_STATUSES).safeParse(status);
  if (!parsed.success) {
    throw AppError.badRequest('status must be a valid drawing status');
  }

  return parsed.data;
}

function containsInsensitive(value: string) {
  return {
    contains: value,
    mode: 'insensitive' as const,
  };
}

function parseDrawingDate(value: string | null | undefined, fieldName: string): Date | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw AppError.badRequest(`${fieldName} must be a valid date`);
    }

    return date;
  }

  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) {
    throw AppError.badRequest(`${fieldName} must be a valid date`);
  }

  return date;
}

function zodValidationMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  const fieldName = firstIssue?.path.join('.');
  return fieldName ? `${fieldName}: ${firstIssue.message}` : 'Validation failed';
}

async function getEffectiveProjectRole(user: AuthUser, projectId: string): Promise<string | null> {
  const [project, projectUser] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    }),
    prisma.projectUser.findFirst({
      where: {
        projectId,
        userId: user.id,
        status: 'active',
      },
      select: { role: true },
    }),
  ]);

  if (
    (user.roleInCompany === 'owner' || user.roleInCompany === 'admin') &&
    project?.companyId === user.companyId
  ) {
    return user.roleInCompany;
  }

  if (projectUser) {
    return projectUser.role;
  }

  return null;
}

async function requireDrawingReadAccess(user: AuthUser, projectId: string): Promise<string> {
  if (SUBCONTRACTOR_DRAWING_ROLES.includes(user.roleInCompany || '')) {
    throw AppError.forbidden('Internal drawing access required');
  }

  const effectiveRole = await getEffectiveProjectRole(user, projectId);
  if (!effectiveRole || SUBCONTRACTOR_DRAWING_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Access denied');
  }

  return effectiveRole;
}

async function requireDrawingWriteAccess(user: AuthUser, projectId: string): Promise<void> {
  const effectiveRole = await requireDrawingReadAccess(user, projectId);

  if (!DRAWING_WRITE_ROLES.includes(effectiveRole)) {
    throw AppError.forbidden('Drawing write access required');
  }
}

async function requireSupersededByInProject(
  projectId: string,
  drawingId: string,
  supersededById?: string | null,
): Promise<void> {
  if (!supersededById) return;

  if (supersededById === drawingId) {
    throw AppError.badRequest('supersededById must reference another drawing in the same project');
  }

  const supersedingDrawing = await prisma.drawing.findFirst({
    where: { id: supersededById, projectId },
    select: { id: true },
  });

  if (!supersedingDrawing) {
    throw AppError.badRequest('supersededById must reference a drawing in the same project');
  }
}

// GET /api/drawings/:projectId - List drawings for a project
router.get(
  '/:projectId',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDrawingRouteParam(req.params.projectId, 'projectId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    await requireDrawingReadAccess(req.user!, projectId);

    const { page, limit } = parsePagination(req.query);
    const status = getOptionalStatusQuery(req.query);
    const search = getOptionalQueryString(req.query, 'search', MAX_SEARCH_LENGTH);
    const revision = getOptionalQueryString(req.query, 'revision', MAX_REVISION_LENGTH);
    const where: Prisma.DrawingWhereInput = { projectId };
    if (status) where.status = status;
    if (revision) where.revision = revision;
    if (search) {
      where.OR = [
        { drawingNumber: containsInsensitive(search) },
        { title: containsInsensitive(search) },
        { revision: containsInsensitive(search) },
      ];
    }

    const statusCountWhere = (
      drawingStatus: (typeof DRAWING_STATUSES)[number],
    ): Prisma.DrawingWhereInput => ({
      AND: [where, { status: drawingStatus }],
    });

    const [drawings, total, preliminary, forConstruction, asBuilt] = await prisma.$transaction([
      prisma.drawing.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              filename: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              uploadedAt: true,
              uploadedBy: { select: { id: true, fullName: true, email: true } },
            },
          },
          supersededBy: { select: { id: true, drawingNumber: true, revision: true } },
          supersedes: { select: { id: true, drawingNumber: true, revision: true } },
        },
        orderBy: [{ drawingNumber: 'asc' }, { revision: 'desc' }],
        ...getPrismaSkipTake(page, limit),
      }),
      prisma.drawing.count({ where }),
      prisma.drawing.count({ where: statusCountWhere('preliminary') }),
      prisma.drawing.count({ where: statusCountWhere('for_construction') }),
      prisma.drawing.count({ where: statusCountWhere('as_built') }),
    ]);

    const stats = {
      total,
      preliminary,
      forConstruction,
      asBuilt,
    };

    res.json({
      drawings,
      stats,
      pagination: getPaginationMeta(total, page, limit),
    });
  }),
);

// POST /api/drawings - Create a new drawing with file upload
router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (!userId) {
      throw AppError.unauthorized();
    }

    if (!req.file) {
      throw AppError.badRequest('No file uploaded');
    }
    const uploadedFile = req.file;

    const parseResult = createDrawingSchema.safeParse(req.body);
    if (!parseResult.success) {
      cleanupUploadedFile(uploadedFile);
      throw AppError.fromZodError(parseResult.error, zodValidationMessage(parseResult.error));
    }

    const { projectId, drawingNumber, title, revision, issueDate, status } = parseResult.data;
    let issueDateValue: Date | null;
    try {
      issueDateValue = parseDrawingDate(issueDate, 'issueDate');
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    try {
      await requireDrawingWriteAccess(req.user!, projectId);
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }
    try {
      assertUploadedFileMatchesDeclaredType(uploadedFile);
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    // Check for duplicate drawing number + revision
    const existing = await prisma.drawing.findFirst({
      where: {
        projectId,
        drawingNumber,
        revision: revision || null,
      },
    });

    if (existing) {
      cleanupUploadedFile(uploadedFile);
      throw AppError.badRequest('Drawing with this number and revision already exists');
    }

    // Upload to Supabase if configured; otherwise the file is already on the
    // local disk via multer.diskStorage and we just record its relative path.
    let fileUrl: string | null = null;
    try {
      if (isSupabaseConfigured() && uploadedFile.buffer) {
        const uploaded = await uploadDrawingToSupabase(uploadedFile, projectId);
        fileUrl = uploaded.url;
      } else {
        fileUrl = `/uploads/drawings/${uploadedFile.filename}`;
      }
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    let drawing;
    try {
      drawing = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            projectId,
            documentType: 'drawing',
            filename: sanitizeUploadFilename(uploadedFile.originalname),
            fileUrl: fileUrl!,
            fileSize: uploadedFile.size,
            mimeType: uploadedFile.mimetype,
            uploadedById: userId,
          },
        });

        return tx.drawing.create({
          data: {
            projectId,
            documentId: document.id,
            drawingNumber,
            title: title || null,
            revision: revision || null,
            issueDate: issueDateValue,
            status: status || 'preliminary',
          },
          include: {
            document: {
              select: {
                id: true,
                filename: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
                uploadedAt: true,
                uploadedBy: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        });
      });
    } catch (error) {
      await cleanupStoredDrawingUpload(fileUrl, uploadedFile);
      throw error;
    }

    res.status(201).json(drawing);
  }),
);

// PATCH /api/drawings/:drawingId - Update drawing metadata
router.patch(
  '/:drawingId',
  asyncHandler(async (req: Request, res: Response) => {
    const drawingId = parseDrawingRouteParam(req.params.drawingId, 'drawingId');
    const parseResult = updateDrawingSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw AppError.fromZodError(parseResult.error, zodValidationMessage(parseResult.error));
    }
    const { title, revision, issueDate, status, supersededById } = parseResult.data;
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    });

    if (!drawing) {
      throw AppError.notFound('Drawing');
    }

    await requireDrawingWriteAccess(req.user!, drawing.projectId);
    await requireSupersededByInProject(drawing.projectId, drawingId, supersededById);

    const issueDateValue =
      issueDate !== undefined ? parseDrawingDate(issueDate, 'issueDate') : undefined;

    const updatedDrawing = await prisma.drawing.update({
      where: { id: drawingId },
      data: {
        title: title !== undefined ? title : undefined,
        revision: revision !== undefined ? revision : undefined,
        issueDate: issueDateValue,
        status: status !== undefined ? status : undefined,
        supersededById: supersededById !== undefined ? supersededById || null : undefined,
      },
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            uploadedAt: true,
            uploadedBy: { select: { id: true, fullName: true, email: true } },
          },
        },
        supersededBy: { select: { id: true, drawingNumber: true, revision: true } },
      },
    });

    res.json(updatedDrawing);
  }),
);

// DELETE /api/drawings/:drawingId - Delete a drawing
router.delete(
  '/:drawingId',
  asyncHandler(async (req: Request, res: Response) => {
    const drawingId = parseDrawingRouteParam(req.params.drawingId, 'drawingId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const drawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
      include: { document: true },
    });

    if (!drawing) {
      throw AppError.notFound('Drawing');
    }

    await requireDrawingWriteAccess(req.user!, drawing.projectId);

    const existingFileUrl = drawing.document.fileUrl;
    const isSupabaseStored =
      isSupabaseConfigured() &&
      typeof existingFileUrl === 'string' &&
      getSupabaseStoragePath(existingFileUrl, DOCUMENTS_BUCKET) !== null;

    let filePath: string | null = null;
    if (!isSupabaseStored) {
      try {
        filePath = resolveUploadPath(existingFileUrl, 'drawings');
      } catch (error) {
        logWarn('Skipping drawing file cleanup for invalid file path:', error);
      }
    }

    await prisma.$transaction([
      prisma.drawing.delete({ where: { id: drawingId } }),
      prisma.document.delete({ where: { id: drawing.documentId } }),
    ]);

    if (isSupabaseStored) {
      try {
        await deleteDrawingFromSupabase(existingFileUrl);
      } catch (error) {
        logWarn('Failed to delete drawing file from Supabase after database delete:', error);
      }
    } else if (filePath) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        logWarn('Failed to delete drawing file after database delete:', error);
      }
    }

    res.status(204).send();
  }),
);

// POST /api/drawings/:drawingId/supersede - Create a new revision that supersedes this drawing
router.post(
  '/:drawingId/supersede',
  requireValidDrawingRouteParam('drawingId'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const drawingId = parseDrawingRouteParam(req.params.drawingId, 'drawingId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    if (!req.file) {
      throw AppError.badRequest('No file uploaded');
    }
    const uploadedFile = req.file;

    const parseResult = supersedeDrawingSchema.safeParse(req.body);
    if (!parseResult.success) {
      cleanupUploadedFile(uploadedFile);
      throw AppError.fromZodError(parseResult.error, zodValidationMessage(parseResult.error));
    }
    const { title, revision, issueDate, status } = parseResult.data;
    let issueDateValue: Date | null;
    try {
      issueDateValue = parseDrawingDate(issueDate, 'issueDate');
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    const oldDrawing = await prisma.drawing.findUnique({
      where: { id: drawingId },
    });

    if (!oldDrawing) {
      cleanupUploadedFile(uploadedFile);
      throw AppError.notFound('Drawing');
    }

    try {
      await requireDrawingWriteAccess(req.user!, oldDrawing.projectId);
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    const existingRevision = await prisma.drawing.findFirst({
      where: {
        projectId: oldDrawing.projectId,
        drawingNumber: oldDrawing.drawingNumber,
        revision,
      },
      select: { id: true },
    });

    if (existingRevision) {
      cleanupUploadedFile(uploadedFile);
      throw AppError.badRequest('Drawing with this number and revision already exists');
    }
    try {
      assertUploadedFileMatchesDeclaredType(uploadedFile);
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    let fileUrl: string | null = null;
    try {
      if (isSupabaseConfigured() && uploadedFile.buffer) {
        const uploaded = await uploadDrawingToSupabase(uploadedFile, oldDrawing.projectId);
        fileUrl = uploaded.url;
      } else {
        fileUrl = `/uploads/drawings/${uploadedFile.filename}`;
      }
    } catch (error) {
      cleanupUploadedFile(uploadedFile);
      throw error;
    }

    let newDrawing;
    try {
      newDrawing = await prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            projectId: oldDrawing.projectId,
            documentType: 'drawing',
            filename: sanitizeUploadFilename(uploadedFile.originalname),
            fileUrl: fileUrl!,
            fileSize: uploadedFile.size,
            mimeType: uploadedFile.mimetype,
            uploadedById: userId,
          },
        });

        const createdDrawing = await tx.drawing.create({
          data: {
            projectId: oldDrawing.projectId,
            documentId: document.id,
            drawingNumber: oldDrawing.drawingNumber,
            title: title || oldDrawing.title,
            revision,
            issueDate: issueDateValue,
            status: status || 'for_construction',
          },
          include: {
            document: {
              select: {
                id: true,
                filename: true,
                fileUrl: true,
                fileSize: true,
                mimeType: true,
                uploadedAt: true,
                uploadedBy: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        });

        await tx.drawing.update({
          where: { id: drawingId },
          data: { supersededById: createdDrawing.id },
        });

        return createdDrawing;
      });
    } catch (error) {
      await cleanupStoredDrawingUpload(fileUrl, uploadedFile);
      throw error;
    }

    res.status(201).json(newDrawing);
  }),
);

// GET /api/drawings/:projectId/current-set - Get current (non-superseded) drawings for download
router.get(
  '/:projectId/current-set',
  asyncHandler(async (req: Request, res: Response) => {
    const projectId = parseDrawingRouteParam(req.params.projectId, 'projectId');
    const userId = req.user!.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    await requireDrawingReadAccess(req.user!, projectId);

    const currentSetWhere: Prisma.DrawingWhereInput = {
      projectId,
      supersededById: null, // Only current versions (not superseded)
    };
    const currentDrawingCount = await prisma.drawing.count({ where: currentSetWhere });
    if (currentDrawingCount > MAX_CURRENT_SET_DOWNLOAD_DRAWINGS) {
      throw AppError.badRequest(
        `Current drawing set exceeds the ${MAX_CURRENT_SET_DOWNLOAD_DRAWINGS} drawing download limit`,
      );
    }

    const currentDrawings = await prisma.drawing.findMany({
      where: currentSetWhere,
      include: {
        document: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
          },
        },
      },
      orderBy: [{ drawingNumber: 'asc' }, { revision: 'desc' }],
    });

    // Return the list of current drawings with download info
    res.json({
      drawings: currentDrawings.map((d) => ({
        id: d.id,
        documentId: d.document.id,
        drawingNumber: d.drawingNumber,
        title: d.title,
        revision: d.revision,
        status: d.status,
        fileUrl: d.document.fileUrl,
        filename: d.document.filename,
        fileSize: d.document.fileSize,
      })),
      totalCount: currentDrawingCount,
      totalSize: currentDrawings.reduce((sum, d) => sum + (d.document.fileSize || 0), 0),
    });
  }),
);

export const drawingsRouter = router;

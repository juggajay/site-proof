// Feature #250: Drawing Register API routes
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ensureUploadSubdirectory, resolveUploadPath } from '../lib/uploadPaths.js';
import { assertUploadedFileMatchesDeclaredType } from '../lib/imageValidation.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import {
  DOCUMENTS_BUCKET,
  getSupabaseClient,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  isSupabaseConfigured,
} from '../lib/supabase.js';
import {
  createDrawingSchema,
  parseDrawingDate,
  parseDrawingRouteParam,
  requireValidDrawingRouteParam,
  supersedeDrawingSchema,
  updateDrawingSchema,
  zodValidationMessage,
} from './drawings/validation.js';
import { drawingReadRoutes } from './drawings/readRoutes.js';
import { requireDrawingWriteAccess } from './drawings/access.js';
import { buildStoredFilename, sanitizeUploadFilename } from './drawings/filenames.js';

const DRAWINGS_STORAGE_PREFIX = 'drawings';

const router = Router();

// Apply auth middleware
router.use(requireAuth);
router.use(drawingReadRoutes);

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

function getDrawingStoragePrefix(projectId: string): string {
  return `${DRAWINGS_STORAGE_PREFIX}/${projectId}/`;
}

function getOwnedDrawingStoragePath(fileUrl: string, projectId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getDrawingStoragePrefix(projectId),
  });
}

async function deleteDrawingFromSupabase(fileUrl: string, projectId: string): Promise<void> {
  const storagePath = getOwnedDrawingStoragePath(fileUrl, projectId);
  if (!storagePath) {
    return;
  }

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);

  if (error) {
    logError('Supabase drawing delete failed:', error);
  }
}

// Best-effort cleanup after a failed drawing upload. Removes either the
// Supabase object (if we already uploaded) or the local temp file.
async function cleanupStoredDrawingUpload(
  fileUrl: string | null,
  file: Express.Multer.File,
  projectId: string,
): Promise<void> {
  if (fileUrl && isSupabaseConfigured() && getOwnedDrawingStoragePath(fileUrl, projectId)) {
    await deleteDrawingFromSupabase(fileUrl, projectId);
    return;
  }
  cleanupUploadedFile(file);
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
      await cleanupStoredDrawingUpload(fileUrl, uploadedFile, projectId);
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
      getOwnedDrawingStoragePath(existingFileUrl, drawing.projectId) !== null;

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
        await deleteDrawingFromSupabase(existingFileUrl, drawing.projectId);
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
      await cleanupStoredDrawingUpload(fileUrl, uploadedFile, oldDrawing.projectId);
      throw error;
    }

    res.status(201).json(newDrawing);
  }),
);

export const drawingsRouter = router;

// Feature #250: Drawing Register API routes
import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { AppError } from '../lib/AppError.js';
import { AuditAction, writeAuditLogInTransaction } from '../lib/auditLog.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { assertUploadedFileMatchesDeclaredType } from '../lib/imageValidation.js';
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
import { sanitizeUploadFilename } from './drawings/filenames.js';
import { buildDrawingResponse } from './drawings/responses.js';
import {
  cleanupStoredDrawingUpload,
  cleanupUploadedFile,
  prepareStoredDrawingFileCleanup,
  storeDrawingUpload,
  upload,
} from './drawings/storage.js';

const router = Router();

// Apply auth middleware
router.use(requireAuth);
router.use(drawingReadRoutes);

async function requireSupersededByInProject(
  projectId: string,
  drawing: { id: string; drawingNumber: string },
  supersededById?: string | null,
): Promise<void> {
  if (!supersededById) return;

  if (supersededById === drawing.id) {
    throw AppError.badRequest('supersededById must reference another drawing in the same project');
  }

  const supersedingDrawing = await prisma.drawing.findFirst({
    where: { id: supersededById, projectId },
    select: { id: true, drawingNumber: true, supersededById: true },
  });

  if (!supersedingDrawing) {
    throw AppError.badRequest('supersededById must reference a drawing in the same project');
  }

  if (supersedingDrawing.drawingNumber !== drawing.drawingNumber) {
    throw AppError.badRequest(
      'supersededById must reference a revision of the same drawing number',
    );
  }

  if (supersedingDrawing.supersededById) {
    throw AppError.badRequest('supersededById must reference a current drawing revision');
  }
}

function getDrawingStorageKind(fileUrl: string): 'supabase' | 'external' | 'inline' | 'local' {
  if (fileUrl.startsWith('supabase://')) {
    return 'supabase';
  }
  if (/^https?:\/\//i.test(fileUrl)) {
    return 'external';
  }
  if (fileUrl.startsWith('data:')) {
    return 'inline';
  }
  return 'local';
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

    let fileUrl: string | null = null;
    try {
      fileUrl = await storeDrawingUpload(uploadedFile, projectId);
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

    res.status(201).json(buildDrawingResponse(drawing));
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
    await requireSupersededByInProject(drawing.projectId, drawing, supersededById);

    if (revision !== undefined) {
      const existingRevision = await prisma.drawing.findFirst({
        where: {
          projectId: drawing.projectId,
          drawingNumber: drawing.drawingNumber,
          revision,
          id: { not: drawingId },
        },
        select: { id: true },
      });

      if (existingRevision) {
        throw AppError.badRequest('Drawing with this number and revision already exists');
      }
    }

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

    res.json(buildDrawingResponse(updatedDrawing));
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

    const cleanupStoredFile = prepareStoredDrawingFileCleanup(
      drawing.document.fileUrl,
      drawing.projectId,
    );

    await prisma.$transaction(async (tx) => {
      await writeAuditLogInTransaction(tx, {
        projectId: drawing.projectId,
        userId,
        entityType: 'drawing',
        entityId: drawingId,
        action: AuditAction.DRAWING_DELETED,
        changes: {
          documentId: drawing.documentId,
          drawingNumber: drawing.drawingNumber,
          revision: drawing.revision,
          filename: drawing.document.filename,
          storageKind: getDrawingStorageKind(drawing.document.fileUrl),
        },
        req,
      });

      await tx.drawing.delete({ where: { id: drawingId } });
      await tx.document.delete({ where: { id: drawing.documentId } });
    });

    await cleanupStoredFile();

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
      fileUrl = await storeDrawingUpload(uploadedFile, oldDrawing.projectId);
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

    res.status(201).json(buildDrawingResponse(newDrawing));
  }),
);

export const drawingsRouter = router;

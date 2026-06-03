import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { createMentionNotifications } from './notifications.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  getSupabasePublicUrl,
  getSupabaseStoragePath,
  DOCUMENTS_BUCKET,
} from '../lib/supabase.js';
import { ensureUploadSubdirectoryAsync, resolveUploadPath } from '../lib/uploadPaths.js';
import { assertUploadedFileMatchesDeclaredType } from '../lib/imageValidation.js';
import { logError, logWarn } from '../lib/serverLogger.js';
import { getPrismaSkipTake, parsePagination } from '../lib/pagination.js';
import {
  buildCommentAttachmentsCreatedResponse,
  buildCommentListResponse,
  buildCommentMutationResponse,
  buildCommentSuccessResponse,
  buildUploadedCommentAttachmentsResponse,
} from './comments/responses.js';
import {
  getCanonicalCommentEntityType,
  getCommentEntityTypeQueryValues,
  requireCommentEntityAccess,
} from './comments/access.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const commentsRouter = Router();

// Apply authentication middleware to all comment routes
commentsRouter.use(requireAuth);

const COMMENT_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
const COMMENT_ATTACHMENT_MAX_FILES = 5;
const COMMENT_CONTENT_MAX_LENGTH = 5000;
const COMMENT_ATTACHMENT_FILENAME_MAX_LENGTH = 180;
const COMMENT_ATTACHMENT_MIME_TYPE_MAX_LENGTH = 120;
const COMMENT_ROUTE_PARAM_MAX_LENGTH = 120;

const allowedAttachmentTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

function sanitizeFilename(filename: string): string {
  const basename = path.basename(filename.replace(/\\/g, '/'));
  const sanitized = basename
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, COMMENT_ATTACHMENT_FILENAME_MAX_LENGTH);

  return sanitized || 'attachment';
}

function getSafeAttachmentMimeType(mimeType: string | null | undefined): string {
  const normalizedMimeType = mimeType?.toLowerCase();
  return normalizedMimeType && allowedAttachmentTypes.includes(normalizedMimeType)
    ? normalizedMimeType
    : 'application/octet-stream';
}

const commentAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: COMMENT_ATTACHMENT_MAX_SIZE,
    files: COMMENT_ATTACHMENT_MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedAttachmentTypes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error('Invalid file type'));
  },
});

function getSingleString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseCommentRouteParam(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a single value`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  if (trimmed.length > COMMENT_ROUTE_PARAM_MAX_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return trimmed;
}

function requireContent(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest('content is required');
  }

  const content = value.trim();
  if (content.length > COMMENT_CONTENT_MAX_LENGTH) {
    throw AppError.badRequest(`content must be ${COMMENT_CONTENT_MAX_LENGTH} characters or less`);
  }

  return content;
}

async function uploadCommentAttachmentToSupabase(
  file: Express.Multer.File,
  projectId: string,
): Promise<string> {
  const storagePath = `${getCommentAttachmentStoragePrefix(projectId)}${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`;

  const { error } = await getSupabaseClient()
    .storage.from(DOCUMENTS_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });

  if (error) {
    logError('Supabase comment attachment upload failed:', error);
    throw AppError.internal('Failed to upload attachment');
  }

  return getSupabasePublicUrl(DOCUMENTS_BUCKET, storagePath);
}

async function uploadCommentAttachmentToDisk(file: Express.Multer.File): Promise<string> {
  const filename = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(file.originalname)}`;
  const uploadDirectory = await ensureUploadSubdirectoryAsync('comments');
  await fs.promises.writeFile(path.join(uploadDirectory, filename), file.buffer, { flag: 'wx' });
  return `/uploads/comments/${filename}`;
}

function getCommentAttachmentStoragePrefix(projectId: string): string {
  return `comments/${projectId}/`;
}

async function deleteLocalCommentAttachmentFile(fileUrl: string): Promise<void> {
  if (!fileUrl.startsWith('/uploads/comments/')) {
    return;
  }

  let filePath: string;
  try {
    filePath = resolveUploadPath(fileUrl, 'comments');
  } catch {
    return;
  }

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logError('Failed to delete comment attachment file:', error);
    }
  }
}

function getOwnedCommentAttachmentStoragePath(fileUrl: string, projectId: string): string | null {
  return getSupabaseStoragePath(fileUrl, {
    bucket: DOCUMENTS_BUCKET,
    expectedPrefix: getCommentAttachmentStoragePrefix(projectId),
  });
}

async function deleteCommentAttachmentFromSupabase(
  fileUrl: string,
  projectId: string,
): Promise<void> {
  const storagePath = getOwnedCommentAttachmentStoragePath(fileUrl, projectId);
  if (!storagePath) {
    return;
  }

  const { error } = await getSupabaseClient().storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) {
    logError('Supabase comment attachment delete failed:', error);
  }
}

// Routes a comment-attachment fileUrl to the right cleanup mechanism.
// Supabase URLs that resolve inside the configured documents bucket get a
// best-effort `remove` call; everything else falls back to the legacy
// local-disk cleanup. Throws on infrastructure errors (e.g. mocked
// `getSupabaseClient` blowing up); call sites must wrap in try/catch and
// log because storage cleanup is best-effort and the DB row is the source
// of truth.
async function removeStoredCommentAttachment(fileUrl: string, projectId: string): Promise<void> {
  if (isSupabaseConfigured() && getOwnedCommentAttachmentStoragePath(fileUrl, projectId) !== null) {
    await deleteCommentAttachmentFromSupabase(fileUrl, projectId);
    return;
  }
  await deleteLocalCommentAttachmentFile(fileUrl);
}

function isSafeAttachmentUrl(fileUrl: string, projectId: string): boolean {
  if (fileUrl.length > 2048) {
    return false;
  }

  if (fileUrl.startsWith('/uploads/comments/')) {
    try {
      resolveUploadPath(fileUrl, 'comments');
      return true;
    } catch {
      return false;
    }
  }

  if (!/^https?:\/\//i.test(fileUrl)) {
    return false;
  }

  try {
    return (
      isSupabaseConfigured() && getOwnedCommentAttachmentStoragePath(fileUrl, projectId) !== null
    );
  } catch {
    return false;
  }
}

function isExternalAttachmentUrl(fileUrl: string): boolean {
  return /^https?:\/\//i.test(fileUrl);
}

function getSafeAttachmentFilename(filename: string): string {
  return sanitizeFilename(filename);
}

function parseAttachmentFileSize(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > COMMENT_ATTACHMENT_MAX_SIZE
  ) {
    throw AppError.badRequest(
      `attachment fileSize must be a whole number between 0 and ${COMMENT_ATTACHMENT_MAX_SIZE}`,
    );
  }

  return value;
}

function parseAttachmentMimeType(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string' || value.length > COMMENT_ATTACHMENT_MIME_TYPE_MAX_LENGTH) {
    throw AppError.badRequest(
      `attachment mimeType must be text no longer than ${COMMENT_ATTACHMENT_MIME_TYPE_MAX_LENGTH} characters`,
    );
  }

  return getSafeAttachmentMimeType(value);
}

function sendCommentAttachmentFile(
  attachment: { fileUrl: string; filename: string; mimeType: string | null },
  projectId: string,
  res: {
    redirect: (url: string) => void;
    setHeader: (name: string, value: string) => void;
    sendFile: (path: string) => void;
  },
): void {
  if (isExternalAttachmentUrl(attachment.fileUrl)) {
    if (!isSafeAttachmentUrl(attachment.fileUrl, projectId)) {
      throw AppError.notFound('Attachment file');
    }

    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(attachment.fileUrl);
    return;
  }

  let filePath: string;
  try {
    filePath = resolveUploadPath(attachment.fileUrl, 'comments');
  } catch {
    throw AppError.notFound('Attachment file');
  }

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('Attachment file');
  }

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${getSafeAttachmentFilename(attachment.filename)}"`,
  );
  res.setHeader('Content-Type', getSafeAttachmentMimeType(attachment.mimeType));
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
}

// GET /api/comments - Get comments for an entity
commentsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const entityType = getSingleString(req.query.entityType);
    const entityId = getSingleString(req.query.entityId);
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    if (!entityType || !entityId) {
      throw AppError.badRequest('entityType and entityId are required');
    }

    await requireCommentEntityAccess(req.user!, entityType, entityId);
    const entityTypeValues = getCommentEntityTypeQueryValues(entityType);
    const { page, limit } = parsePagination(req.query);

    const where = {
      entityType: { in: entityTypeValues },
      entityId,
      deletedAt: null,
      parentId: null, // Only top-level comments
    };

    const [comments, total] = await prisma.$transaction([
      prisma.comment.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          attachments: {
            select: {
              id: true,
              filename: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              createdAt: true,
            },
          },
          replies: {
            where: { deletedAt: null },
            include: {
              author: {
                select: {
                  id: true,
                  email: true,
                  fullName: true,
                  avatarUrl: true,
                },
              },
              attachments: {
                select: {
                  id: true,
                  filename: true,
                  fileUrl: true,
                  fileSize: true,
                  mimeType: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...getPrismaSkipTake(page, limit),
      }),
      prisma.comment.count({ where }),
    ]);

    res.json(buildCommentListResponse(comments, total, page, limit));
  }),
);

// Attachment type for validation
interface AttachmentInput {
  filename: string;
  fileUrl: string;
  fileSize?: number | null;
  mimeType?: string | null;
}

function getValidAttachments(attachments: unknown, projectId: string): AttachmentInput[] {
  const validAttachments: AttachmentInput[] = [];

  if (!Array.isArray(attachments)) {
    return validAttachments;
  }

  for (const att of attachments) {
    if (!att || typeof att !== 'object') continue;
    const attachment = att as Record<string, unknown>;
    const filename = getSingleString(attachment.filename);
    const fileUrl = getSingleString(attachment.fileUrl);

    if (filename && fileUrl && isSafeAttachmentUrl(fileUrl, projectId)) {
      const fileSize = parseAttachmentFileSize(attachment.fileSize);
      const mimeType = parseAttachmentMimeType(attachment.mimeType);

      validAttachments.push({
        filename: sanitizeFilename(filename),
        fileUrl,
        fileSize,
        mimeType,
      });
    }
  }

  return validAttachments;
}

async function cleanupStoredCommentAttachments(
  attachments: Pick<AttachmentInput, 'fileUrl'>[],
  projectId: string,
  logMessage: string,
): Promise<void> {
  await Promise.all(
    attachments.map(async (attachment) => {
      try {
        await removeStoredCommentAttachment(attachment.fileUrl, projectId);
      } catch (cleanupError) {
        logWarn(logMessage, cleanupError);
      }
    }),
  );
}

async function storeCommentAttachmentFiles(
  files: Express.Multer.File[],
  projectId: string,
): Promise<AttachmentInput[]> {
  const attachments: AttachmentInput[] = [];

  try {
    for (const file of files) {
      const fileUrl = isSupabaseConfigured()
        ? await uploadCommentAttachmentToSupabase(file, projectId)
        : await uploadCommentAttachmentToDisk(file);

      attachments.push({
        filename: sanitizeFilename(file.originalname),
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
      });
    }
  } catch (error) {
    await cleanupStoredCommentAttachments(
      attachments,
      projectId,
      'Failed to remove comment attachment after upload rollback:',
    );
    throw error;
  }

  return attachments;
}

// POST /api/comments/attachments/upload - Upload files for comment attachments
commentsRouter.post(
  '/attachments/upload',
  commentAttachmentUpload.array('files', COMMENT_ATTACHMENT_MAX_FILES),
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user?.id;
    const entityType = getSingleString(req.body.entityType);
    const entityId = getSingleString(req.body.entityId);

    if (!userId) {
      throw AppError.unauthorized();
    }

    if (!entityType || !entityId) {
      throw AppError.badRequest('entityType and entityId are required');
    }

    const projectId = await requireCommentEntityAccess(req.user!, entityType, entityId);
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      throw AppError.badRequest('At least one attachment file is required');
    }

    for (const file of files) {
      assertUploadedFileMatchesDeclaredType(file);
    }

    const attachments = await storeCommentAttachmentFiles(files, projectId);

    res.status(201).json(buildUploadedCommentAttachmentsResponse(attachments));
  }),
);

// GET /api/comments/attachments/:attachmentId/download - Authenticated attachment download
commentsRouter.get(
  '/attachments/:attachmentId/download',
  asyncHandler(async (req: AuthRequest, res) => {
    const attachmentId = parseCommentRouteParam(req.params.attachmentId, 'attachmentId');
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const attachment = await prisma.commentAttachment.findUnique({
      where: { id: attachmentId },
      include: { comment: true },
    });

    if (!attachment || attachment.comment.deletedAt) {
      throw AppError.notFound('Attachment');
    }

    const projectId = await requireCommentEntityAccess(
      req.user!,
      attachment.comment.entityType,
      attachment.comment.entityId,
    );
    sendCommentAttachmentFile(attachment, projectId, res);
  }),
);

// POST /api/comments - Create a new comment
commentsRouter.post(
  '/',
  commentAttachmentUpload.array('files', COMMENT_ATTACHMENT_MAX_FILES),
  asyncHandler(async (req: AuthRequest, res) => {
    const { attachments } = req.body;
    const entityType = getSingleString(req.body.entityType);
    const entityId = getSingleString(req.body.entityId);
    const parentId = getSingleString(req.body.parentId);
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    if (!entityType || !entityId) {
      throw AppError.badRequest('entityType, entityId, and content are required');
    }

    const trimmedContent = requireContent(req.body.content);
    const canonicalEntityType = getCanonicalCommentEntityType(entityType);
    const projectId = await requireCommentEntityAccess(req.user!, entityType, entityId);

    // Validate parent exists if parentId provided
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parent || parent.deletedAt) {
        throw AppError.badRequest('Parent comment not found');
      }
      if (parent.parentId) {
        throw AppError.badRequest('Replies can only be added to top-level comments');
      }
      // Ensure parent is for the same entity
      if (
        getCanonicalCommentEntityType(parent.entityType) !== canonicalEntityType ||
        parent.entityId !== entityId
      ) {
        throw AppError.badRequest('Parent comment is for a different entity');
      }
    }

    // Validate attachments if provided
    if (Array.isArray(attachments) && attachments.length > COMMENT_ATTACHMENT_MAX_FILES) {
      throw AppError.badRequest(
        `attachments cannot include more than ${COMMENT_ATTACHMENT_MAX_FILES} files`,
      );
    }

    const files = req.files as Express.Multer.File[] | undefined;
    for (const file of files || []) {
      assertUploadedFileMatchesDeclaredType(file);
    }

    const uploadedAttachments =
      files && files.length > 0 ? await storeCommentAttachmentFiles(files, projectId) : [];
    const validAttachments =
      uploadedAttachments.length > 0
        ? uploadedAttachments
        : getValidAttachments(attachments, projectId);

    if (Array.isArray(attachments) && attachments.length > 0 && validAttachments.length === 0) {
      throw AppError.badRequest('No valid attachments provided');
    }

    let comment;
    try {
      comment = await prisma.comment.create({
        data: {
          entityType: canonicalEntityType,
          entityId,
          content: trimmedContent,
          authorId: userId,
          parentId: parentId || null,
          attachments: {
            create: validAttachments,
          },
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          attachments: {
            select: {
              id: true,
              filename: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              createdAt: true,
            },
          },
        },
      });
    } catch (error) {
      if (uploadedAttachments.length > 0) {
        await cleanupStoredCommentAttachments(
          uploadedAttachments,
          projectId,
          'Failed to remove comment attachment after comment create rollback:',
        );
      }
      throw error;
    }

    // Check for @mentions and create notifications
    try {
      await createMentionNotifications(
        trimmedContent,
        userId,
        canonicalEntityType,
        entityId,
        comment.id,
        projectId,
      );
    } catch (notifError) {
      // Log but don't fail the comment creation
      logError('Error creating mention notifications:', notifError);
    }

    res.status(201).json(buildCommentMutationResponse(comment));
  }),
);

// PUT /api/comments/:id - Update a comment
commentsRouter.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseCommentRouteParam(req.params.id, 'id');
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    const content = requireContent(req.body.content);

    // Find the comment
    const existing = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      throw AppError.notFound('Comment');
    }

    await requireCommentEntityAccess(req.user!, existing.entityType, existing.entityId);

    // Only author can edit
    if (existing.authorId !== userId) {
      throw AppError.forbidden('You can only edit your own comments');
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.json(buildCommentMutationResponse(comment));
  }),
);

// DELETE /api/comments/:id - Soft delete a comment
commentsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseCommentRouteParam(req.params.id, 'id');
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    // Find the comment
    const existing = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      throw AppError.notFound('Comment');
    }

    const projectId = await requireCommentEntityAccess(
      req.user!,
      existing.entityType,
      existing.entityId,
    );

    // Only author can delete
    if (existing.authorId !== userId) {
      throw AppError.forbidden('You can only delete your own comments');
    }

    const attachments = await prisma.commentAttachment.findMany({
      where: { commentId: id },
      select: { fileUrl: true },
    });

    await prisma.$transaction([
      prisma.comment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      }),
      prisma.commentAttachment.deleteMany({
        where: { commentId: id },
      }),
    ]);

    // Best-effort storage cleanup after the DB transaction commits. Each
    // attachment is removed independently; failures are logged so the
    // response still succeeds (DB is the source of truth).
    await Promise.all(
      attachments.map(async (attachment) => {
        try {
          await removeStoredCommentAttachment(attachment.fileUrl, projectId);
        } catch (cleanupError) {
          logWarn('Failed to remove comment attachment file after comment delete:', cleanupError);
        }
      }),
    );

    res.json(buildCommentSuccessResponse());
  }),
);

// POST /api/comments/:id/attachments - Add attachments to a comment
commentsRouter.post(
  '/:id/attachments',
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseCommentRouteParam(req.params.id, 'id');
    const { attachments } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!comment || comment.deletedAt) {
      throw AppError.notFound('Comment');
    }

    const projectId = await requireCommentEntityAccess(
      req.user!,
      comment.entityType,
      comment.entityId,
    );

    // Only author can add attachments
    if (comment.authorId !== userId) {
      throw AppError.forbidden('You can only add attachments to your own comments');
    }

    // Validate attachments
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      throw AppError.badRequest('attachments array is required');
    }

    if (attachments.length > COMMENT_ATTACHMENT_MAX_FILES) {
      throw AppError.badRequest(
        `attachments cannot include more than ${COMMENT_ATTACHMENT_MAX_FILES} files`,
      );
    }

    const validAttachments = getValidAttachments(attachments, projectId);

    if (validAttachments.length === 0) {
      throw AppError.badRequest('No valid attachments provided');
    }

    // Create attachments
    const created = await prisma.commentAttachment.createMany({
      data: validAttachments.map((att) => ({
        commentId: id,
        ...att,
      })),
    });

    // Fetch the updated comment with attachments
    const updatedComment = await prisma.comment.findUnique({
      where: { id },
      include: {
        attachments: {
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    res
      .status(201)
      .json(
        buildCommentAttachmentsCreatedResponse(created.count, updatedComment?.attachments || []),
      );
  }),
);

// DELETE /api/comments/:commentId/attachments/:attachmentId - Delete an attachment
commentsRouter.delete(
  '/:commentId/attachments/:attachmentId',
  asyncHandler(async (req: AuthRequest, res) => {
    const commentId = parseCommentRouteParam(req.params.commentId, 'commentId');
    const attachmentId = parseCommentRouteParam(req.params.attachmentId, 'attachmentId');
    const userId = req.user?.id;

    if (!userId) {
      throw AppError.unauthorized();
    }

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.deletedAt) {
      throw AppError.notFound('Comment');
    }

    const projectId = await requireCommentEntityAccess(
      req.user!,
      comment.entityType,
      comment.entityId,
    );

    // Only author can delete attachments
    if (comment.authorId !== userId) {
      throw AppError.forbidden('You can only delete attachments from your own comments');
    }

    // Find and delete the attachment
    const attachment = await prisma.commentAttachment.findFirst({
      where: {
        id: attachmentId,
        commentId,
      },
    });

    if (!attachment) {
      throw AppError.notFound('Attachment');
    }

    await prisma.commentAttachment.delete({
      where: { id: attachmentId },
    });

    try {
      await removeStoredCommentAttachment(attachment.fileUrl, projectId);
    } catch (cleanupError) {
      logWarn('Failed to remove comment attachment file after attachment delete:', cleanupError);
    }

    res.json(buildCommentSuccessResponse());
  }),
);

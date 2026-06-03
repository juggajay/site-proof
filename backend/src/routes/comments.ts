import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { createMentionNotifications } from './notifications.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
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
import {
  COMMENT_ATTACHMENT_MAX_FILES,
  cleanupStoredCommentAttachments,
  commentAttachmentUpload,
  getValidAttachments,
  removeStoredCommentAttachment,
  sendCommentAttachmentFile,
  storeCommentAttachmentFiles,
} from './comments/attachmentStorage.js';

export const commentsRouter = Router();

// Apply authentication middleware to all comment routes
commentsRouter.use(requireAuth);

const COMMENT_CONTENT_MAX_LENGTH = 5000;
const COMMENT_ROUTE_PARAM_MAX_LENGTH = 120;

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

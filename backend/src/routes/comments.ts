import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { createMentionNotifications } from './notifications.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { assertProjectAllowsWrite } from '../lib/projectAccess.js';
import { logError } from '../lib/serverLogger.js';
import { getPrismaSkipTake, parsePagination } from '../lib/pagination.js';
import {
  buildCommentAttachmentsCreatedResponse,
  buildCommentListResponse,
  buildCommentMutationResponse,
  buildCommentSuccessResponse,
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
  sendCommentAttachmentFile,
  storeCommentAttachmentFiles,
} from './comments/attachmentStorage.js';
import type { AttachmentInput } from './comments/attachmentStorage.js';
import {
  cleanupDeletedCommentAttachmentFile,
  cleanupDeletedCommentAttachmentFiles,
  requireCommentAuthor,
  requireCommentUserId,
  validateUploadedCommentFiles,
} from './comments/routeGuards.js';
import { commentAttachmentSelect, commentAuthorSelect } from './comments/selects.js';
import { getSingleString, parseCommentRouteParam, requireContent } from './comments/validation.js';

export const commentsRouter = Router();

// Apply authentication middleware to all comment routes
commentsRouter.use(requireAuth);

function rejectClientSuppliedCommentAttachmentLocators(attachments: unknown): void {
  if (Array.isArray(attachments) && attachments.length > 0) {
    throw AppError.badRequest('Upload comment attachments as multipart files');
  }
}

function requireUploadedCommentAttachmentFiles(req: AuthRequest): Express.Multer.File[] {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    throw AppError.badRequest('At least one attachment file is required');
  }

  validateUploadedCommentFiles(files);
  return files;
}

async function appendStoredCommentAttachments(
  commentId: string,
  uploadedAttachments: AttachmentInput[],
  projectId: string,
) {
  try {
    return await prisma.commentAttachment.createMany({
      data: uploadedAttachments.map((att) => ({
        commentId,
        ...att,
      })),
    });
  } catch (error) {
    await cleanupStoredCommentAttachments(
      uploadedAttachments,
      projectId,
      'Failed to remove comment attachment after append rollback:',
    );
    throw error;
  }
}

// GET /api/comments - Get comments for an entity
commentsRouter.get(
  '/',
  asyncHandler(async (req: AuthRequest, res) => {
    const entityType = getSingleString(req.query.entityType);
    const entityId = getSingleString(req.query.entityId);
    requireCommentUserId(req.user?.id);

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
          author: { select: commentAuthorSelect },
          attachments: {
            select: commentAttachmentSelect,
          },
          replies: {
            where: { deletedAt: null },
            include: {
              author: { select: commentAuthorSelect },
              attachments: {
                select: commentAttachmentSelect,
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
  asyncHandler(async (req: AuthRequest, _res) => {
    requireCommentUserId(req.user?.id);
    throw new AppError(
      410,
      'Standalone comment attachment uploads are no longer supported. Upload files with the comment request instead.',
      'GONE',
    );
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
    await sendCommentAttachmentFile(attachment, projectId, res);
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
    const userId = requireCommentUserId(req.user?.id);

    if (!entityType || !entityId) {
      throw AppError.badRequest('entityType, entityId, and content are required');
    }

    const trimmedContent = requireContent(req.body.content);
    const canonicalEntityType = getCanonicalCommentEntityType(entityType);
    const projectId = await requireCommentEntityAccess(req.user!, entityType, entityId);
    await assertProjectAllowsWrite(projectId);

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

    rejectClientSuppliedCommentAttachmentLocators(attachments);

    const files = req.files as Express.Multer.File[] | undefined;
    validateUploadedCommentFiles(files);

    const uploadedAttachments =
      files && files.length > 0 ? await storeCommentAttachmentFiles(files, projectId) : [];

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
            create: uploadedAttachments,
          },
        },
        include: {
          author: { select: commentAuthorSelect },
          attachments: {
            select: commentAttachmentSelect,
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
    const userId = requireCommentUserId(req.user?.id);

    const content = requireContent(req.body.content);

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
    await assertProjectAllowsWrite(projectId);

    // Only author can edit
    requireCommentAuthor(existing.authorId, userId, 'You can only edit your own comments');

    const comment = await prisma.comment.update({
      where: { id },
      data: {
        content,
        isEdited: true,
        editedAt: new Date(),
      },
      include: {
        author: { select: commentAuthorSelect },
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
    const userId = requireCommentUserId(req.user?.id);

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
    await assertProjectAllowsWrite(projectId);

    // Only author can delete
    requireCommentAuthor(existing.authorId, userId, 'You can only delete your own comments');

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
    await cleanupDeletedCommentAttachmentFiles(attachments, projectId);

    res.json(buildCommentSuccessResponse());
  }),
);

// POST /api/comments/:id/attachments - Add attachments to a comment
commentsRouter.post(
  '/:id/attachments',
  commentAttachmentUpload.array('files', COMMENT_ATTACHMENT_MAX_FILES),
  asyncHandler(async (req: AuthRequest, res) => {
    const id = parseCommentRouteParam(req.params.id, 'id');
    const { attachments } = req.body;
    const userId = requireCommentUserId(req.user?.id);

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
    await assertProjectAllowsWrite(projectId);

    // Only author can add attachments
    requireCommentAuthor(
      comment.authorId,
      userId,
      'You can only add attachments to your own comments',
    );

    rejectClientSuppliedCommentAttachmentLocators(attachments);
    const files = requireUploadedCommentAttachmentFiles(req);
    const uploadedAttachments = await storeCommentAttachmentFiles(files, projectId);
    const created = await appendStoredCommentAttachments(id, uploadedAttachments, projectId);

    // Fetch the updated comment with attachments
    const updatedComment = await prisma.comment.findUnique({
      where: { id },
      include: {
        attachments: {
          select: commentAttachmentSelect,
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
    const userId = requireCommentUserId(req.user?.id);

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
    await assertProjectAllowsWrite(projectId);

    // Only author can delete attachments
    requireCommentAuthor(
      comment.authorId,
      userId,
      'You can only delete attachments from your own comments',
    );

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

    await cleanupDeletedCommentAttachmentFile(attachment.fileUrl, projectId);

    res.json(buildCommentSuccessResponse());
  }),
);

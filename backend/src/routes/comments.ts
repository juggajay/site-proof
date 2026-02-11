import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js'
import { createMentionNotifications } from './notifications.js'
import { AppError } from '../lib/AppError.js'
import { asyncHandler } from '../lib/asyncHandler.js'

export const commentsRouter = Router()

// Apply authentication middleware to all comment routes
commentsRouter.use(requireAuth)

// GET /api/comments - Get comments for an entity
commentsRouter.get('/', asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId } = req.query

  if (!entityType || !entityId) {
    throw AppError.badRequest('entityType and entityId are required')
  }

  const comments = await prisma.comment.findMany({
    where: {
      entityType: entityType as string,
      entityId: entityId as string,
      deletedAt: null,
      parentId: null, // Only top-level comments
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
  })

  res.json({ comments })
}))

// Attachment type for validation
interface AttachmentInput {
  filename: string
  fileUrl: string
  fileSize?: number
  mimeType?: string
}

// POST /api/comments - Create a new comment
commentsRouter.post('/', asyncHandler(async (req: AuthRequest, res) => {
  const { entityType, entityId, content, parentId, attachments } = req.body
  const userId = req.user?.id

  if (!userId) {
    throw AppError.unauthorized()
  }

  if (!entityType || !entityId || !content) {
    throw AppError.badRequest('entityType, entityId, and content are required')
  }

  // Validate parent exists if parentId provided
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
    })
    if (!parent || parent.deletedAt) {
      throw AppError.badRequest('Parent comment not found')
    }
    // Ensure parent is for the same entity
    if (parent.entityType !== entityType || parent.entityId !== entityId) {
      throw AppError.badRequest('Parent comment is for a different entity')
    }
  }

  // Validate attachments if provided
  const validAttachments: AttachmentInput[] = []
  if (attachments && Array.isArray(attachments)) {
    for (const att of attachments) {
      if (att.filename && att.fileUrl) {
        validAttachments.push({
          filename: att.filename,
          fileUrl: att.fileUrl,
          fileSize: att.fileSize || null,
          mimeType: att.mimeType || null,
        })
      }
    }
  }

  const comment = await prisma.comment.create({
    data: {
      entityType,
      entityId,
      content: content.trim(),
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
  })

  // Check for @mentions and create notifications
  try {
    // Get the entity to find projectId if available
    let projectId: string | undefined
    if (entityType === 'Lot') {
      const lot = await prisma.lot.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      })
      projectId = lot?.projectId
    }

    await createMentionNotifications(
      content.trim(),
      userId,
      entityType,
      entityId,
      comment.id,
      projectId
    )
  } catch (notifError) {
    // Log but don't fail the comment creation
    console.error('Error creating mention notifications:', notifError)
  }

  res.status(201).json({ comment })
}))

// PUT /api/comments/:id - Update a comment
commentsRouter.put('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  const { content } = req.body
  const userId = req.user?.id

  if (!userId) {
    throw AppError.unauthorized()
  }

  if (!content) {
    throw AppError.badRequest('content is required')
  }

  // Find the comment
  const existing = await prisma.comment.findUnique({
    where: { id },
  })

  if (!existing || existing.deletedAt) {
    throw AppError.notFound('Comment')
  }

  // Only author can edit
  if (existing.authorId !== userId) {
    throw AppError.forbidden('You can only edit your own comments')
  }

  const comment = await prisma.comment.update({
    where: { id },
    data: {
      content: content.trim(),
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
  })

  res.json({ comment })
}))

// DELETE /api/comments/:id - Soft delete a comment
commentsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  const userId = req.user?.id

  if (!userId) {
    throw AppError.unauthorized()
  }

  // Find the comment
  const existing = await prisma.comment.findUnique({
    where: { id },
  })

  if (!existing || existing.deletedAt) {
    throw AppError.notFound('Comment')
  }

  // Only author can delete
  if (existing.authorId !== userId) {
    throw AppError.forbidden('You can only delete your own comments')
  }

  await prisma.comment.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  })

  res.json({ success: true })
}))

// POST /api/comments/:id/attachments - Add attachments to a comment
commentsRouter.post('/:id/attachments', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  const { attachments } = req.body
  const userId = req.user?.id

  if (!userId) {
    throw AppError.unauthorized()
  }

  // Find the comment
  const comment = await prisma.comment.findUnique({
    where: { id },
  })

  if (!comment || comment.deletedAt) {
    throw AppError.notFound('Comment')
  }

  // Only author can add attachments
  if (comment.authorId !== userId) {
    throw AppError.forbidden('You can only add attachments to your own comments')
  }

  // Validate attachments
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    throw AppError.badRequest('attachments array is required')
  }

  const validAttachments: AttachmentInput[] = []
  for (const att of attachments) {
    if (att.filename && att.fileUrl) {
      validAttachments.push({
        filename: att.filename,
        fileUrl: att.fileUrl,
        fileSize: att.fileSize || null,
        mimeType: att.mimeType || null,
      })
    }
  }

  if (validAttachments.length === 0) {
    throw AppError.badRequest('No valid attachments provided')
  }

  // Create attachments
  const created = await prisma.commentAttachment.createMany({
    data: validAttachments.map(att => ({
      commentId: id,
      ...att,
    })),
  })

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
  })

  res.status(201).json({
    count: created.count,
    attachments: updatedComment?.attachments || [],
  })
}))

// DELETE /api/comments/:commentId/attachments/:attachmentId - Delete an attachment
commentsRouter.delete('/:commentId/attachments/:attachmentId', asyncHandler(async (req: AuthRequest, res) => {
  const { commentId, attachmentId } = req.params
  const userId = req.user?.id

  if (!userId) {
    throw AppError.unauthorized()
  }

  // Find the comment
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  })

  if (!comment || comment.deletedAt) {
    throw AppError.notFound('Comment')
  }

  // Only author can delete attachments
  if (comment.authorId !== userId) {
    throw AppError.forbidden('You can only delete attachments from your own comments')
  }

  // Find and delete the attachment
  const attachment = await prisma.commentAttachment.findFirst({
    where: {
      id: attachmentId,
      commentId,
    },
  })

  if (!attachment) {
    throw AppError.notFound('Attachment')
  }

  await prisma.commentAttachment.delete({
    where: { id: attachmentId },
  })

  res.json({ success: true })
}))

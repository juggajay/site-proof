import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { commentsRouter } from './comments.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/comments', commentsRouter)
app.use(errorHandler)

describe('Comments API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let commentId: string
  let replyId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Comments Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `comments-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Comments Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Comments Test Project ${Date.now()}`,
        projectNumber: `COM-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    // Create lot for comment association
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `COM-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.commentAttachment.deleteMany({
      where: { comment: { entityId: lotId } }
    })
    await prisma.comment.deleteMany({ where: { entityId: lotId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/comments', () => {
    it('should create a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'This is a test comment',
        })

      expect(res.status).toBe(201)
      expect(res.body.comment).toBeDefined()
      expect(res.body.comment.id).toBeDefined()
      expect(res.body.comment.content).toBe('This is a test comment')
      expect(res.body.comment.entityType).toBe('Lot')
      expect(res.body.comment.entityId).toBe(lotId)
      expect(res.body.comment.author).toBeDefined()
      expect(res.body.comment.author.id).toBe(userId)
      commentId = res.body.comment.id
    })

    it('should create a comment with attachments', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with attachments',
          attachments: [
            {
              filename: 'test-file.pdf',
              fileUrl: '/uploads/test-file.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
            },
            {
              filename: 'image.jpg',
              fileUrl: '/uploads/image.jpg',
              fileSize: 2048,
              mimeType: 'image/jpeg',
            },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.comment).toBeDefined()
      expect(res.body.comment.attachments).toBeDefined()
      expect(res.body.comment.attachments.length).toBe(2)
      expect(res.body.comment.attachments[0].filename).toBe('test-file.pdf')
      expect(res.body.comment.attachments[1].filename).toBe('image.jpg')
    })

    it('should create a reply to a comment', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'This is a reply',
          parentId: commentId,
        })

      expect(res.status).toBe(201)
      expect(res.body.comment).toBeDefined()
      expect(res.body.comment.parentId).toBe(commentId)
      expect(res.body.comment.content).toBe('This is a reply')
      replyId = res.body.comment.id
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/comments')
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Test comment',
        })

      expect(res.status).toBe(401)
    })

    it('should require entityType', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityId: lotId,
          content: 'Test comment',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('entityType')
    })

    it('should require entityId', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          content: 'Test comment',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('entityId')
    })

    it('should require content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('content')
    })

    it('should trim whitespace from content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: '  Whitespace test  ',
        })

      expect(res.status).toBe(201)
      expect(res.body.comment.content).toBe('Whitespace test')
    })

    it('should reject reply with invalid parentId', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Invalid parent',
          parentId: 'non-existent-id',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Parent comment not found')
    })

    it('should reject reply to comment from different entity', async () => {
      // Create another lot
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        }
      })

      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: otherLot.id,
          content: 'Reply to wrong entity',
          parentId: commentId, // Comment belongs to different lot
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('different entity')

      // Cleanup
      await prisma.lot.delete({ where: { id: otherLot.id } })
    })

    it('should handle attachments with missing optional fields', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with minimal attachment',
          attachments: [
            {
              filename: 'minimal.txt',
              fileUrl: '/uploads/minimal.txt',
              // fileSize and mimeType omitted
            },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.comment.attachments.length).toBe(1)
      expect(res.body.comment.attachments[0].filename).toBe('minimal.txt')
    })

    it('should filter out invalid attachments', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with invalid attachments',
          attachments: [
            {
              filename: 'valid.txt',
              fileUrl: '/uploads/valid.txt',
            },
            {
              filename: 'invalid-no-url.txt',
              // Missing fileUrl
            },
            {
              fileUrl: '/uploads/invalid-no-filename.txt',
              // Missing filename
            },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.comment.attachments.length).toBe(1)
      expect(res.body.comment.attachments[0].filename).toBe('valid.txt')
    })
  })

  describe('GET /api/comments', () => {
    it('should list comments for an entity', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      expect(res.body.comments).toBeDefined()
      expect(Array.isArray(res.body.comments)).toBe(true)
      expect(res.body.comments.length).toBeGreaterThan(0)
    })

    it('should include author information', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      const comment = res.body.comments[0]
      expect(comment.author).toBeDefined()
      expect(comment.author.id).toBeDefined()
      expect(comment.author.email).toBeDefined()
      expect(comment.author.fullName).toBeDefined()
    })

    it('should include replies', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      // Find the parent comment
      const parentComment = res.body.comments.find((c: any) => c.id === commentId)
      expect(parentComment).toBeDefined()
      expect(parentComment.replies).toBeDefined()
      expect(Array.isArray(parentComment.replies)).toBe(true)
      expect(parentComment.replies.length).toBeGreaterThan(0)

      // Verify reply content
      const reply = parentComment.replies.find((r: any) => r.id === replyId)
      expect(reply).toBeDefined()
      expect(reply.content).toBe('This is a reply')
      expect(reply.author).toBeDefined()
    })

    it('should include attachments', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      // Find a comment with attachments
      const commentWithAttachments = res.body.comments.find(
        (c: any) => c.attachments && c.attachments.length > 0
      )
      expect(commentWithAttachments).toBeDefined()
      expect(commentWithAttachments.attachments[0].filename).toBeDefined()
      expect(commentWithAttachments.attachments[0].fileUrl).toBeDefined()
    })

    it('should not include deleted comments', async () => {
      // Create and delete a comment
      const deleteRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'To be deleted',
        })
      const deleteCommentId = deleteRes.body.comment.id

      await request(app)
        .delete(`/api/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // List comments
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      const deletedComment = res.body.comments.find((c: any) => c.id === deleteCommentId)
      expect(deletedComment).toBeUndefined()
    })

    it('should only include top-level comments (not replies)', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      // Verify no comment in the main list has a parentId
      const hasParentId = res.body.comments.some((c: any) => c.parentId !== null)
      expect(hasParentId).toBe(false)
    })

    it('should require entityType', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityId: lotId,
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('entityType')
    })

    it('should require entityId', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('entityId')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/comments')
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(401)
    })

    it('should order comments by createdAt descending', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      const comments = res.body.comments
      if (comments.length > 1) {
        // Verify descending order
        for (let i = 0; i < comments.length - 1; i++) {
          const current = new Date(comments[i].createdAt)
          const next = new Date(comments[i + 1].createdAt)
          expect(current >= next).toBe(true)
        }
      }
    })

    it('should order replies by createdAt ascending', async () => {
      const res = await request(app)
        .get('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          entityType: 'Lot',
          entityId: lotId,
        })

      expect(res.status).toBe(200)
      const parentComment = res.body.comments.find((c: any) => c.id === commentId)
      const replies = parentComment?.replies || []

      if (replies.length > 1) {
        // Verify ascending order
        for (let i = 0; i < replies.length - 1; i++) {
          const current = new Date(replies[i].createdAt)
          const next = new Date(replies[i + 1].createdAt)
          expect(current <= next).toBe(true)
        }
      }
    })
  })

  describe('PUT /api/comments/:id', () => {
    it('should update comment content', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated comment content',
        })

      expect(res.status).toBe(200)
      expect(res.body.comment).toBeDefined()
      expect(res.body.comment.content).toBe('Updated comment content')
      expect(res.body.comment.isEdited).toBe(true)
      expect(res.body.comment.editedAt).toBeDefined()
    })

    it('should trim whitespace from updated content', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: '  Trimmed update  ',
        })

      expect(res.status).toBe(200)
      expect(res.body.comment.content).toBe('Trimmed update')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .send({
          content: 'Updated content',
        })

      expect(res.status).toBe(401)
    })

    it('should require content', async () => {
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('content')
    })

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .put('/api/comments/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated content',
        })

      expect(res.status).toBe(404)
      expect(res.body.error.message).toContain('not found')
    })

    it('should not allow editing other users comments', async () => {
      // Create another user
      const otherEmail = `other-comment-user-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        })
      const otherToken = otherRes.body.token
      const otherUserId = otherRes.body.user.id

      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          content: 'Trying to edit someone elses comment',
        })

      expect(res.status).toBe(403)
      expect(res.body.error.message).toContain('own comments')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })

    it('should not allow editing deleted comments', async () => {
      // Create and delete a comment
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'To be deleted then edited',
        })
      const tempCommentId = createRes.body.comment.id

      await request(app)
        .delete(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Try to edit
      const res = await request(app)
        .put(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Trying to edit deleted comment',
        })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/comments/:id', () => {
    let deleteCommentId: string

    beforeAll(async () => {
      // Create a comment to delete
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment to be deleted',
        })
      deleteCommentId = res.body.comment.id
    })

    it('should soft delete a comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Verify soft delete in database
      const deleted = await prisma.comment.findUnique({
        where: { id: deleteCommentId }
      })
      expect(deleted).toBeDefined()
      expect(deleted?.deletedAt).toBeDefined()
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/comments/${commentId}`)

      expect(res.status).toBe(401)
    })

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .delete('/api/comments/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })

    it('should not allow deleting other users comments', async () => {
      // Create another user
      const otherEmail = `other-delete-user-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other Delete User',
          tosAccepted: true,
        })
      const otherToken = otherRes.body.token
      const otherUserId = otherRes.body.user.id

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.message).toContain('own comments')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })

    it('should return 404 for already deleted comment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/comments/:id/attachments', () => {
    let attachCommentId: string

    beforeAll(async () => {
      // Create a comment for attachment tests
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment for attachment tests',
        })
      attachCommentId = res.body.comment.id
    })

    it('should add attachments to a comment', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'attachment1.pdf',
              fileUrl: '/uploads/attachment1.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
            },
            {
              filename: 'attachment2.jpg',
              fileUrl: '/uploads/attachment2.jpg',
              fileSize: 2048,
              mimeType: 'image/jpeg',
            },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.count).toBe(2)
      expect(res.body.attachments).toBeDefined()
      expect(res.body.attachments.length).toBe(2)
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/test.pdf',
            },
          ],
        })

      expect(res.status).toBe(401)
    })

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .post('/api/comments/non-existent-id/attachments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/test.pdf',
            },
          ],
        })

      expect(res.status).toBe(404)
    })

    it('should not allow adding attachments to other users comments', async () => {
      // Create another user
      const otherEmail = `other-attach-user-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other Attach User',
          tosAccepted: true,
        })
      const otherToken = otherRes.body.token
      const otherUserId = otherRes.body.user.id

      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/test.pdf',
            },
          ],
        })

      expect(res.status).toBe(403)
      expect(res.body.error.message).toContain('own comments')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })

    it('should require attachments array', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('attachments')
    })

    it('should reject empty attachments array', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [],
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('attachments')
    })

    it('should reject attachments with missing required fields', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'no-url.pdf',
              // Missing fileUrl
            },
            {
              fileUrl: '/uploads/no-filename.pdf',
              // Missing filename
            },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('No valid attachments')
    })

    it('should handle attachments with optional fields omitted', async () => {
      const res = await request(app)
        .post(`/api/comments/${attachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'minimal.txt',
              fileUrl: '/uploads/minimal.txt',
              // fileSize and mimeType omitted
            },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.count).toBe(1)
      expect(res.body.attachments[res.body.attachments.length - 1].filename).toBe('minimal.txt')
    })

    it('should not allow adding attachments to deleted comments', async () => {
      // Create and delete a comment
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'To be deleted',
        })
      const tempId = createRes.body.comment.id

      await request(app)
        .delete(`/api/comments/${tempId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Try to add attachment
      const res = await request(app)
        .post(`/api/comments/${tempId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'test.pdf',
              fileUrl: '/uploads/test.pdf',
            },
          ],
        })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/comments/:commentId/attachments/:attachmentId', () => {
    let deleteAttachCommentId: string
    let attachmentId: string

    beforeAll(async () => {
      // Create a comment with attachments
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment with attachment to delete',
          attachments: [
            {
              filename: 'to-delete.pdf',
              fileUrl: '/uploads/to-delete.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
            },
          ],
        })
      deleteAttachCommentId = res.body.comment.id
      attachmentId = res.body.comment.attachments[0].id
    })

    it('should delete an attachment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Verify attachment was deleted
      const attachment = await prisma.commentAttachment.findUnique({
        where: { id: attachmentId }
      })
      expect(attachment).toBeNull()
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/${attachmentId}`)

      expect(res.status).toBe(401)
    })

    it('should return 404 for non-existent comment', async () => {
      const res = await request(app)
        .delete('/api/comments/non-existent-id/attachments/some-attachment-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })

    it('should return 404 for non-existent attachment', async () => {
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/non-existent-attachment`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error.message).toContain('Attachment not found')
    })

    it('should not allow deleting attachments from other users comments', async () => {
      // Create another user and their comment
      const otherEmail = `other-del-attach-user-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other Del Attach User',
          tosAccepted: true,
        })
      const otherToken = otherRes.body.token
      const otherUserId = otherRes.body.user.id

      // Create a new attachment on our comment
      const attachRes = await request(app)
        .post(`/api/comments/${deleteAttachCommentId}/attachments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          attachments: [
            {
              filename: 'protected.pdf',
              fileUrl: '/uploads/protected.pdf',
            },
          ],
        })
      const protectedAttachmentId = attachRes.body.attachments[attachRes.body.attachments.length - 1].id

      // Try to delete with other user
      const res = await request(app)
        .delete(`/api/comments/${deleteAttachCommentId}/attachments/${protectedAttachmentId}`)
        .set('Authorization', `Bearer ${otherToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.message).toContain('own comments')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })

    it('should not allow deleting attachments from deleted comments', async () => {
      // Create a comment with attachment
      const createRes = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Comment to delete',
          attachments: [
            {
              filename: 'temp.pdf',
              fileUrl: '/uploads/temp.pdf',
            },
          ],
        })
      const tempCommentId = createRes.body.comment.id
      const tempAttachmentId = createRes.body.comment.attachments[0].id

      // Delete the comment
      await request(app)
        .delete(`/api/comments/${tempCommentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Try to delete attachment
      const res = await request(app)
        .delete(`/api/comments/${tempCommentId}/attachments/${tempAttachmentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('Comment Mentions', () => {
    it('should create comment with @mentions in content', async () => {
      const res = await request(app)
        .post('/api/comments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          entityType: 'Lot',
          entityId: lotId,
          content: 'Hey @testuser, check this out!',
        })

      // Comment should still be created even if mention notifications fail
      expect(res.status).toBe(201)
      expect(res.body.comment.content).toBe('Hey @testuser, check this out!')
    })
  })

  describe('Multiple Entity Types', () => {
    it('should support comments on different entity types', async () => {
      const entityTypes = ['Lot', 'NCR', 'ITP', 'Docket', 'Document']

      for (const entityType of entityTypes) {
        const res = await request(app)
          .post('/api/comments')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            entityType,
            entityId: lotId, // Using lotId as a generic ID
            content: `Comment on ${entityType}`,
          })

        expect(res.status).toBe(201)
        expect(res.body.comment.entityType).toBe(entityType)
      }
    })
  })
})

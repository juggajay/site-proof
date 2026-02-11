import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import path from 'path'
import fs from 'fs'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import documents router
import documentsRouter from './documents.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/documents', documentsRouter)

// Ensure upload directory exists for tests
const uploadDir = path.join(process.cwd(), 'uploads', 'documents')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

describe('Documents API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let documentId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Documents Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `documents-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Documents Test User',
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
        name: `Documents Test Project ${Date.now()}`,
        projectNumber: `DOC-${Date.now()}`,
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

    // Create lot for document association
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `DOC-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id

    // Create a test document directly in the database
    const document = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'Site Photos',
        filename: 'test-photo.jpg',
        fileUrl: '/uploads/documents/test-photo.jpg',
        fileSize: 1024,
        mimeType: 'image/jpeg',
        uploadedById: userId,
        caption: 'Test site photo',
        tags: 'test,photo',
      }
    })
    documentId = document.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.document.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/documents/:projectId', () => {
    it('should list documents for project', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.documents).toBeDefined()
      expect(Array.isArray(res.body.documents)).toBe(true)
      expect(res.body.total).toBeGreaterThan(0)
      expect(res.body.categories).toBeDefined()
    })

    it('should filter by category', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?category=Site Photos`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.documents).toBeDefined()
    })

    it('should filter by documentType', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?documentType=photo`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.documents).toBeDefined()
    })

    it('should filter by lotId', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?lotId=${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.documents).toBeDefined()
    })

    it('should search documents', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}?search=test`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.documents).toBeDefined()
    })

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0]
      const res = await request(app)
        .get(`/api/documents/${projectId}?dateFrom=${today}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.documents).toBeDefined()
    })
  })

  describe('GET /api/documents/signed-url/validate', () => {
    it('should return invalid for non-existent token', async () => {
      const res = await request(app)
        .get(`/api/documents/signed-url/validate?token=invalid-token&documentId=${documentId}`)

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(false)
    })

    it('should require token parameter', async () => {
      const res = await request(app)
        .get(`/api/documents/signed-url/validate?documentId=${documentId}`)

      expect(res.status).toBe(400)
    })

    it('should require documentId parameter', async () => {
      const res = await request(app)
        .get('/api/documents/signed-url/validate?token=some-token')

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/documents/download/:documentId', () => {
    it('should require token for download', async () => {
      const res = await request(app)
        .get(`/api/documents/download/${documentId}`)

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Token')
    })

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get(`/api/documents/download/${documentId}?token=invalid-token`)

      expect(res.status).toBe(403)
    })
  })

  describe('POST /api/documents/:documentId/signed-url', () => {
    it('should generate a signed URL', async () => {
      const res = await request(app)
        .post(`/api/documents/${documentId}/signed-url`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.signedUrl).toBeDefined()
      expect(res.body.expiresAt).toBeDefined()
      expect(res.body.token).toBeDefined()
    })

    it('should return 404 for non-existent document', async () => {
      const res = await request(app)
        .post('/api/documents/non-existent-id/signed-url')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/documents/:documentId', () => {
    it('should update document metadata', async () => {
      const res = await request(app)
        .patch(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caption: 'Updated caption',
          category: 'Updated Category',
          tags: 'updated,tags',
        })

      expect(res.status).toBe(200)
      // API returns document directly (not wrapped)
      expect(res.body.id).toBeDefined()
      expect(res.body.caption).toBe('Updated caption')
    })

    it('should return 404 for non-existent document', async () => {
      const res = await request(app)
        .patch('/api/documents/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          caption: 'Test',
        })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/documents/:documentId/versions', () => {
    it('should get document versions', async () => {
      const res = await request(app)
        .get(`/api/documents/${documentId}/versions`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.versions).toBeDefined()
      expect(Array.isArray(res.body.versions)).toBe(true)
    })
  })

  describe('Document Categories', () => {
    beforeAll(async () => {
      // Create documents with different categories
      await prisma.document.createMany({
        data: [
          {
            projectId,
            documentType: 'photo',
            category: 'Quality Records',
            filename: 'quality-record.pdf',
            fileUrl: '/uploads/documents/quality-record.pdf',
            fileSize: 2048,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
          {
            projectId,
            documentType: 'photo',
            category: 'Test Certificates',
            filename: 'test-cert.pdf',
            fileUrl: '/uploads/documents/test-cert.pdf',
            fileSize: 1536,
            mimeType: 'application/pdf',
            uploadedById: userId,
          },
        ]
      })
    })

    it('should return category counts', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.categories).toBeDefined()
      expect(Object.keys(res.body.categories).length).toBeGreaterThan(1)
    })
  })

  describe('Document Access Control', () => {
    let otherUserId: string
    let otherUserToken: string

    beforeAll(async () => {
      // Create another user without project access
      const otherEmail = `other-doc-user-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        })
      otherUserToken = otherRes.body.token
      otherUserId = otherRes.body.user.id
    })

    it('should deny access to users without project access', async () => {
      const res = await request(app)
        .get(`/api/documents/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })

    afterAll(async () => {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })
  })

  describe('DELETE /api/documents/:documentId', () => {
    let deleteDocId: string

    beforeAll(async () => {
      // Create document to delete
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          category: 'Test',
          filename: 'to-delete.jpg',
          fileUrl: '/uploads/documents/to-delete.jpg',
          fileSize: 512,
          mimeType: 'image/jpeg',
          uploadedById: userId,
        }
      })
      deleteDocId = doc.id
    })

    it('should delete a document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${deleteDocId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // API returns 204 No Content on successful deletion
      expect(res.status).toBe(204)
    })

    it('should return 404 for already deleted document', async () => {
      const res = await request(app)
        .delete(`/api/documents/${deleteDocId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })
})

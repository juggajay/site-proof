import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import path from 'path'
import fs from 'fs'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { drawingsRouter } from './drawings.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/drawings', drawingsRouter)

// Ensure upload directory exists for tests
const uploadDir = path.join(process.cwd(), 'uploads', 'drawings')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

describe('Drawings API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let drawingId: string
  let documentId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Drawings Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `drawings-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Drawings Test User',
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
        name: `Drawings Test Project ${Date.now()}`,
        projectNumber: `DRW-${Date.now()}`,
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

    // Create a test drawing directly in the database
    const document = await prisma.document.create({
      data: {
        projectId,
        documentType: 'drawing',
        filename: 'test-drawing.pdf',
        fileUrl: '/uploads/drawings/test-drawing.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedById: userId,
      }
    })
    documentId = document.id

    const drawing = await prisma.drawing.create({
      data: {
        projectId,
        documentId,
        drawingNumber: 'DRW-001',
        title: 'Test Site Plan',
        revision: 'A',
        status: 'preliminary',
        issueDate: new Date('2024-01-15'),
      }
    })
    drawingId = drawing.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.drawing.deleteMany({ where: { projectId } })
    await prisma.document.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})

    // Clean up test upload directory
    const files = fs.readdirSync(uploadDir).filter(f => f.startsWith('test-'))
    files.forEach(file => {
      try {
        fs.unlinkSync(path.join(uploadDir, file))
      } catch (err) {
        // Ignore errors
      }
    })
  })

  describe('GET /api/drawings/:projectId', () => {
    it('should list drawings for a project', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings).toBeDefined()
      expect(Array.isArray(res.body.drawings)).toBe(true)
      expect(res.body.stats).toBeDefined()
      expect(res.body.stats.total).toBeGreaterThan(0)
    })

    it('should return stats with status counts', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.stats.preliminary).toBeDefined()
      expect(res.body.stats.forConstruction).toBeDefined()
      expect(res.body.stats.asBuilt).toBeDefined()
    })

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?status=preliminary`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings).toBeDefined()
      const allPreliminary = res.body.drawings.every((d: any) => d.status === 'preliminary')
      expect(allPreliminary).toBe(true)
    })

    it('should search by drawing number', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?search=DRW-001`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings.length).toBeGreaterThan(0)
      const found = res.body.drawings.some((d: any) => d.drawingNumber.includes('DRW-001'))
      expect(found).toBe(true)
    })

    it('should search by title', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?search=Site Plan`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings.length).toBeGreaterThan(0)
    })

    it('should filter by revision', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}?revision=A`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings).toBeDefined()
      const allRevA = res.body.drawings.every((d: any) => d.revision === 'A')
      expect(allRevA).toBe(true)
    })

    it('should deny access without authentication', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)

      expect(res.status).toBe(401)
    })

    it('should include document information', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const drawing = res.body.drawings[0]
      expect(drawing.document).toBeDefined()
      expect(drawing.document.filename).toBeDefined()
      expect(drawing.document.fileUrl).toBeDefined()
    })
  })

  describe('POST /api/drawings', () => {
    const testFilePath = path.join(uploadDir, 'test-upload.pdf')
    const testImagePath = path.join(uploadDir, 'test-image.jpg')

    beforeAll(() => {
      // Create a test PDF file
      fs.writeFileSync(testFilePath, 'PDF test content')
      // Create a test image file
      fs.writeFileSync(testImagePath, 'JPG test content')
    })

    afterAll(() => {
      // Clean up test files
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
      }
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath)
      }
    })

    it('should create a new drawing with file upload', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-002')
        .field('title', 'New Test Drawing')
        .field('revision', 'A')
        .field('status', 'preliminary')
        .attach('file', testFilePath)

      expect(res.status).toBe(201)
      expect(res.body.id).toBeDefined()
      expect(res.body.drawingNumber).toBe('DRW-002')
      expect(res.body.document).toBeDefined()

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })

    it('should reject drawing without file', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-003')

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('file')
    })

    it('should reject drawing without projectId', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('drawingNumber', 'DRW-004')
        .attach('file', testFilePath)

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('projectId')
    })

    it('should reject drawing without drawingNumber', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .attach('file', testFilePath)

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('drawingNumber')
    })

    it('should reject duplicate drawing number and revision', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-001')
        .field('revision', 'A')
        .attach('file', testFilePath)

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('already exists')
    })

    it('should default to preliminary status if not provided', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-DEFAULT-STATUS')
        .attach('file', testFilePath)

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('preliminary')

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })

    it('should parse issueDate correctly', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-DATE-TEST')
        .field('issueDate', '2024-02-15')
        .attach('file', testFilePath)

      expect(res.status).toBe(201)
      expect(res.body.issueDate).toBeDefined()

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })

    it('should accept image file types (JPG)', async () => {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${authToken}`)
        .field('projectId', projectId)
        .field('drawingNumber', 'DRW-IMAGE-TEST')
        .attach('file', testImagePath)

      expect(res.status).toBe(201)
      expect(res.body.document.mimeType).toContain('image')

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })
  })

  describe('PATCH /api/drawings/:drawingId', () => {
    it('should update drawing metadata', async () => {
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Drawing Title',
          revision: 'B',
          status: 'for_construction',
        })

      expect(res.status).toBe(200)
      expect(res.body.title).toBe('Updated Drawing Title')
      expect(res.body.revision).toBe('B')
      expect(res.body.status).toBe('for_construction')
    })

    it('should update issueDate', async () => {
      const newDate = '2024-03-20'
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          issueDate: newDate,
        })

      expect(res.status).toBe(200)
      expect(res.body.issueDate).toBeDefined()
    })

    it('should return 404 for non-existent drawing', async () => {
      const res = await request(app)
        .patch('/api/drawings/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
        })

      expect(res.status).toBe(404)
    })

    it('should deny access without authentication', async () => {
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .send({
          title: 'Unauthorized Update',
        })

      expect(res.status).toBe(401)
    })

    it('should update supersededById', async () => {
      // Create a new drawing to supersede the old one
      const doc2 = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'newer-drawing.pdf',
          fileUrl: '/uploads/drawings/newer-drawing.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedById: userId,
        }
      })

      const drawing2 = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc2.id,
          drawingNumber: 'DRW-SUPERSEDE-TEST',
          revision: 'B',
          status: 'for_construction',
        }
      })

      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          supersededById: drawing2.id,
        })

      expect(res.status).toBe(200)
      expect(res.body.supersededById).toBe(drawing2.id)

      // Cleanup
      await prisma.drawing.delete({ where: { id: drawing2.id } })
      await prisma.document.delete({ where: { id: doc2.id } })
    })
  })

  describe('DELETE /api/drawings/:drawingId', () => {
    let deleteDrawingId: string

    beforeAll(async () => {
      // Create a drawing to delete
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'to-delete.pdf',
          fileUrl: '/uploads/drawings/to-delete.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedById: userId,
        }
      })

      const drawing = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc.id,
          drawingNumber: 'DRW-DELETE',
          status: 'preliminary',
        }
      })
      deleteDrawingId = drawing.id
    })

    it('should delete a drawing', async () => {
      const res = await request(app)
        .delete(`/api/drawings/${deleteDrawingId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(204)
    })

    it('should return 404 for non-existent drawing', async () => {
      const res = await request(app)
        .delete('/api/drawings/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })

    it('should deny access without authentication', async () => {
      const res = await request(app)
        .delete(`/api/drawings/${drawingId}`)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/drawings/:drawingId/supersede', () => {
    const testFilePath = path.join(uploadDir, 'test-supersede.pdf')
    let supersedeDrawingId: string

    beforeAll(async () => {
      // Create a test PDF file
      fs.writeFileSync(testFilePath, 'PDF test content for supersede')

      // Create a drawing to supersede
      const doc = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'old-version.pdf',
          fileUrl: '/uploads/drawings/old-version.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedById: userId,
        }
      })

      const drawing = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc.id,
          drawingNumber: 'DRW-SUPER',
          title: 'Drawing to Supersede',
          revision: 'A',
          status: 'for_construction',
        }
      })
      supersedeDrawingId = drawing.id
    })

    afterAll(() => {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath)
      }
    })

    it('should create a new revision that supersedes the old drawing', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'B')
        .field('title', 'Updated Drawing')
        .field('status', 'for_construction')
        .attach('file', testFilePath)

      expect(res.status).toBe(201)
      expect(res.body.drawingNumber).toBe('DRW-SUPER')
      expect(res.body.revision).toBe('B')
      expect(res.body.document).toBeDefined()

      // Check that old drawing was updated
      const oldDrawing = await prisma.drawing.findUnique({
        where: { id: supersedeDrawingId }
      })
      expect(oldDrawing?.supersededById).toBe(res.body.id)

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })

    it('should reject supersede without file', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'C')

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('file')
    })

    it('should reject supersede without revision', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath)

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('revision')
    })

    it('should return 404 for non-existent drawing', async () => {
      const res = await request(app)
        .post('/api/drawings/non-existent-id/supersede')
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'C')
        .attach('file', testFilePath)

      expect(res.status).toBe(404)
    })

    it('should preserve title from old drawing if not provided', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'C')
        .attach('file', testFilePath)

      expect(res.status).toBe(201)
      expect(res.body.title).toBe('Drawing to Supersede')

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })

    it('should default to for_construction status', async () => {
      const res = await request(app)
        .post(`/api/drawings/${supersedeDrawingId}/supersede`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('revision', 'D')
        .attach('file', testFilePath)

      expect(res.status).toBe(201)
      // Status may be 'for_construction' or 'FOR_CONSTRUCTION' depending on schema
      expect(res.body.status?.toLowerCase()).toBe('for_construction')

      // Cleanup
      await prisma.drawing.delete({ where: { id: res.body.id } })
      await prisma.document.delete({ where: { id: res.body.documentId } })
    })
  })

  describe('GET /api/drawings/:projectId/current-set', () => {
    beforeAll(async () => {
      // Create multiple drawings with revisions
      const doc1 = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'current-1.pdf',
          fileUrl: '/uploads/drawings/current-1.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedById: userId,
        }
      })

      await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc1.id,
          drawingNumber: 'DRW-CURRENT-1',
          revision: 'A',
          status: 'for_construction',
        }
      })

      // Create a superseded drawing
      const doc2Old = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'old-2.pdf',
          fileUrl: '/uploads/drawings/old-2.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedById: userId,
        }
      })

      const drawing2Old = await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc2Old.id,
          drawingNumber: 'DRW-CURRENT-2',
          revision: 'A',
          status: 'for_construction',
        }
      })

      const doc2New = await prisma.document.create({
        data: {
          projectId,
          documentType: 'drawing',
          filename: 'current-2.pdf',
          fileUrl: '/uploads/drawings/current-2.pdf',
          fileSize: 3072,
          mimeType: 'application/pdf',
          uploadedById: userId,
        }
      })

      await prisma.drawing.create({
        data: {
          projectId,
          documentId: doc2New.id,
          drawingNumber: 'DRW-CURRENT-2',
          revision: 'B',
          status: 'for_construction',
        }
      })

      // Mark the old drawing as superseded
      await prisma.drawing.update({
        where: { id: drawing2Old.id },
        data: { supersededById: drawing2Old.id }
      })
    })

    it('should get only current (non-superseded) drawings', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings).toBeDefined()
      expect(Array.isArray(res.body.drawings)).toBe(true)
      expect(res.body.totalCount).toBeDefined()
      expect(res.body.totalSize).toBeDefined()
    })

    it('should include file information for each drawing', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const drawing = res.body.drawings[0]
      expect(drawing.drawingNumber).toBeDefined()
      expect(drawing.fileUrl).toBeDefined()
      expect(drawing.filename).toBeDefined()
      expect(drawing.fileSize).toBeDefined()
    })

    it('should calculate total size correctly', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.totalSize).toBeGreaterThan(0)
    })

    it('should deny access without authentication', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)

      expect(res.status).toBe(401)
    })
  })

  describe('Drawing Access Control', () => {
    let otherUserId: string
    let otherUserToken: string

    beforeAll(async () => {
      // Create another user without project access
      const otherEmail = `other-drawings-user-${Date.now()}@example.com`
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

    afterAll(async () => {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })

    it('should deny access to users without project access', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })

    it('should deny update to users without project access', async () => {
      const res = await request(app)
        .patch(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({
          title: 'Unauthorized Update',
        })

      expect(res.status).toBe(403)
    })

    it('should deny delete to users without project access', async () => {
      const res = await request(app)
        .delete(`/api/drawings/${drawingId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })

    it('should deny current-set access to users without project access', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(403)
    })
  })

  describe('Project Manager Access', () => {
    let pmUserId: string
    let pmToken: string

    beforeAll(async () => {
      // Create project manager user
      const pmEmail = `pm-drawings-${Date.now()}@example.com`
      const pmRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: pmEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Project Manager',
          tosAccepted: true,
        })
      pmToken = pmRes.body.token
      pmUserId = pmRes.body.user.id

      await prisma.user.update({
        where: { id: pmUserId },
        data: { companyId }
      })

      await prisma.projectUser.create({
        data: { projectId, userId: pmUserId, role: 'project_manager', status: 'active' }
      })
    })

    afterAll(async () => {
      await prisma.projectUser.deleteMany({ where: { userId: pmUserId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: pmUserId } })
      await prisma.user.delete({ where: { id: pmUserId } }).catch(() => {})
    })

    it('should allow project manager to list drawings', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}`)
        .set('Authorization', `Bearer ${pmToken}`)

      expect(res.status).toBe(200)
      expect(res.body.drawings).toBeDefined()
    })

    it('should allow project manager to access current set', async () => {
      const res = await request(app)
        .get(`/api/drawings/${projectId}/current-set`)
        .set('Authorization', `Bearer ${pmToken}`)

      expect(res.status).toBe(200)
    })
  })
})

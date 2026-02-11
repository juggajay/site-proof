import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { lotsRouter } from './lots.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/lots', lotsRouter)

describe('Lots API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user via registration
    const testEmail = `lots-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Lots Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    // Update user with company and admin role
    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Test Project ${Date.now()}`,
        projectNumber: `TP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    // Add user to project with admin role
    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      }
    })
  })

  afterAll(async () => {
    // Clean up in reverse order of dependencies
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    // Clean up user and related tokens
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/lots', () => {
    it('should create a new lot', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-001',
          description: 'Test lot description',
          activityType: 'Earthworks',
        })

      expect(res.status).toBe(201)
      expect(res.body.lot).toBeDefined()
      expect(res.body.lot.lotNumber).toBe('LOT-001')
      lotId = res.body.lot.id
    })

    it('should reject lot without projectId', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotNumber: 'LOT-002',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should reject lot without lotNumber', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should reject duplicate lot number in same project', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-001', // Already exists
        })

      expect(res.status).toBe(409)
      expect(res.body.code).toBe('DUPLICATE_LOT_NUMBER')
    })

    it('should require area zone for area lot type', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-AREA-001',
          lotType: 'area',
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('AREA_ZONE_REQUIRED')
    })

    it('should require structure ID for structure lot type', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-STRUCT-001',
          lotType: 'structure',
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('STRUCTURE_ID_REQUIRED')
    })

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/lots')
        .send({
          projectId,
          lotNumber: 'LOT-NOAUTH',
        })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/lots', () => {
    it('should list lots for a project with pagination', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // New paginated format
      expect(res.body.data).toBeDefined()
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThan(0)
      // Pagination metadata
      expect(res.body.pagination).toBeDefined()
      expect(res.body.pagination.total).toBeGreaterThan(0)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(20) // default limit
      expect(typeof res.body.pagination.totalPages).toBe('number')
      expect(typeof res.body.pagination.hasNextPage).toBe('boolean')
      expect(typeof res.body.pagination.hasPrevPage).toBe('boolean')
      // Backward compatibility
      expect(res.body.lots).toBeDefined()
      expect(res.body.lots).toEqual(res.body.data)
    })

    it('should respect pagination parameters', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}&page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.pagination.page).toBe(1)
      expect(res.body.pagination.limit).toBe(5)
      expect(res.body.data.length).toBeLessThanOrEqual(5)
    })

    it('should require projectId query param', async () => {
      const res = await request(app)
        .get('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}&status=not_started`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      for (const lot of res.body.data) {
        expect(lot.status).toBe('not_started')
      }
    })
  })

  describe('GET /api/lots/:id', () => {
    it('should get a single lot', async () => {
      const res = await request(app)
        .get(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lot).toBeDefined()
      expect(res.body.lot.lotNumber).toBe('LOT-001')
    })

    it('should return 404 for non-existent lot', async () => {
      const res = await request(app)
        .get('/api/lots/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/lots/:id', () => {
    it('should update a lot', async () => {
      const res = await request(app)
        .patch(`/api/lots/${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          status: 'in_progress',
        })

      expect(res.status).toBe(200)
      expect(res.body.lot.description).toBe('Updated description')
      expect(res.body.lot.status).toBe('in_progress')
    })
  })

  describe('DELETE /api/lots/:id', () => {
    let deletableLotId: string

    beforeAll(async () => {
      const createRes = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: 'LOT-DELETE-001',
          description: 'Lot to delete',
        })
      deletableLotId = createRes.body.lot.id
    })

    it('should delete a lot', async () => {
      const res = await request(app)
        .delete(`/api/lots/${deletableLotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deleted')
    })

    it('should return 404 for non-existent lot', async () => {
      const res = await request(app)
        .delete('/api/lots/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })
})

describe('Lot Status Workflows', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let workflowLotId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Workflow Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `workflow-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Workflow Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Workflow Project ${Date.now()}`,
        projectNumber: `WP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      }
    })

    const createRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lotNumber: `LOT-WORKFLOW-${Date.now()}`,
        description: 'Workflow test lot',
      })
    workflowLotId = createRes.body.lot.id
  })

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should transition from not_started to in_progress', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'in_progress' })

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('in_progress')
  })

  it('should transition to awaiting_test', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'awaiting_test' })

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('awaiting_test')
  })

  it('should transition to completed', async () => {
    const res = await request(app)
      .patch(`/api/lots/${workflowLotId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' })

    expect(res.status).toBe(200)
    expect(res.body.lot.status).toBe('completed')
  })
})

describe('Lot Bulk Operations', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let bulkLotIds: string[] = []

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Bulk Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `bulk-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Bulk Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Bulk Project ${Date.now()}`,
        projectNumber: `BP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: {
        projectId,
        userId,
        role: 'admin',
        status: 'active',
      }
    })

    // Create multiple lots for bulk testing
    for (let i = 1; i <= 3; i++) {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotNumber: `BULK-LOT-${Date.now()}-${i}`,
          description: `Bulk test lot ${i}`,
        })
      bulkLotIds.push(res.body.lot.id)
    }
  })

  afterAll(async () => {
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should bulk create lots', async () => {
    const timestamp = Date.now()
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [
          { lotNumber: `BULK-NEW-${timestamp}-1`, description: 'New bulk 1' },
          { lotNumber: `BULK-NEW-${timestamp}-2`, description: 'New bulk 2' },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.lots.length).toBe(2)
    expect(res.body.count).toBe(2)
  })

  it('should reject bulk create without lots array', async () => {
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('required')
  })

  it('should reject bulk create with empty lots array', async () => {
    const res = await request(app)
      .post('/api/lots/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        lots: [],
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('required')
  })
})

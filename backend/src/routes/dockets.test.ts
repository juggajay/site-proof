import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import dockets router
import { docketsRouter } from './dockets.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/dockets', docketsRouter)

describe('Dockets API', () => {
  let authToken: string
  let subcontractorToken: string
  let userId: string
  let subcontractorUserId: string
  let companyId: string
  let projectId: string
  let subcontractorCompanyId: string
  let docketId: string
  let employeeId: string
  let plantId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Dockets Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create head contractor user
    const adminEmail = `dockets-admin-${Date.now()}@example.com`
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Dockets Admin',
        tosAccepted: true,
      })
    authToken = adminRes.body.token
    userId = adminRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'site_manager' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Dockets Test Project ${Date.now()}`,
        projectNumber: `DKT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'site_manager', status: 'active' }
    })

    // Create subcontractor company
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Test Subcontractor ${Date.now()}`,
        primaryContactName: 'Sub Contact',
        primaryContactEmail: `sub-${Date.now()}@example.com`,
        status: 'approved',
      }
    })
    subcontractorCompanyId = subcontractorCompany.id

    // Create subcontractor user
    const subEmail = `sub-user-${Date.now()}@example.com`
    const subRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: subEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Subcontractor User',
        tosAccepted: true,
      })
    subcontractorToken = subRes.body.token
    subcontractorUserId = subRes.body.user.id

    await prisma.user.update({
      where: { id: subcontractorUserId },
      data: { companyId, roleInCompany: 'subcontractor' }
    })

    // Link subcontractor user to subcontractor company
    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractorUserId,
        subcontractorCompanyId,
        role: 'admin',
      }
    })

    // Create employee in roster
    const employee = await prisma.employeeRoster.create({
      data: {
        subcontractorCompanyId,
        name: 'Test Worker',
        role: 'Operator',
        hourlyRate: 45.50,
        status: 'approved',
      }
    })
    employeeId = employee.id

    // Create plant in register
    const plant = await prisma.plantRegister.create({
      data: {
        subcontractorCompanyId,
        type: 'Excavator',
        description: 'CAT 320',
        idRego: 'EX-001',
        dryRate: 150,
        wetRate: 180,
        status: 'approved',
      }
    })
    plantId = plant.id

    // Create lot for testing lot allocations
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `DKT-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
  })

  afterAll(async () => {
    // Cleanup in correct order
    await prisma.docketLabourLot.deleteMany({ where: { docketLabour: { docket: { projectId } } } })
    await prisma.docketLabour.deleteMany({ where: { docket: { projectId } } })
    await prisma.docketPlant.deleteMany({ where: { docket: { projectId } } })
    await prisma.dailyDocket.deleteMany({ where: { projectId } })
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.employeeRoster.deleteMany({ where: { subcontractorCompanyId } })
    await prisma.plantRegister.deleteMany({ where: { subcontractorCompanyId } })
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId } })
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    for (const uid of [userId, subcontractorUserId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/dockets', () => {
    it('should create a new docket as subcontractor', async () => {
      const today = new Date().toISOString().split('T')[0]
      const res = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          projectId,
          date: today,
          notes: 'Test docket',
        })

      expect(res.status).toBe(201)
      expect(res.body.docket).toBeDefined()
      expect(res.body.docket.status).toBe('draft')
      docketId = res.body.docket.id
    })

    it('should reject docket without projectId', async () => {
      const res = await request(app)
        .post('/api/dockets')
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          date: new Date().toISOString().split('T')[0],
        })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/dockets', () => {
    it('should list dockets for project', async () => {
      const res = await request(app)
        .get(`/api/dockets?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.dockets).toBeDefined()
      expect(Array.isArray(res.body.dockets)).toBe(true)
    })

    it('should require projectId', async () => {
      const res = await request(app)
        .get('/api/dockets')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
    })

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/dockets?projectId=${projectId}&status=draft`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.dockets).toBeDefined()
    })
  })

  describe('GET /api/dockets/:id', () => {
    it('should get a single docket with details', async () => {
      const res = await request(app)
        .get(`/api/dockets/${docketId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.docket).toBeDefined()
      expect(res.body.docket.id).toBe(docketId)
    })

    it('should return 404 for non-existent docket', async () => {
      const res = await request(app)
        .get('/api/dockets/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('Labour Entry Management', () => {
    let labourEntryId: string

    it('should add labour entry to docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          employeeId,
          startTime: '07:00',
          finishTime: '15:30',
        })

      expect(res.status).toBe(201)
      expect(res.body.labourEntry).toBeDefined()
      expect(res.body.labourEntry.submittedHours).toBeGreaterThan(0)
      labourEntryId = res.body.labourEntry.id
    })

    it('should get labour entries for docket', async () => {
      const res = await request(app)
        .get(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.labourEntries).toBeDefined()
      expect(res.body.totals).toBeDefined()
    })

    it('should update labour entry', async () => {
      const res = await request(app)
        .put(`/api/dockets/${docketId}/labour/${labourEntryId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          startTime: '06:00',
          finishTime: '16:00',
        })

      expect(res.status).toBe(200)
      expect(res.body.labourEntry).toBeDefined()
    })

    it('should reject adding labour without employeeId', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/labour`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          startTime: '07:00',
          finishTime: '15:00',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Plant Entry Management', () => {
    let plantEntryId: string

    it('should add plant entry to docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId,
          hoursOperated: 8,
          wetOrDry: 'dry',
        })

      expect(res.status).toBe(201)
      expect(res.body.plantEntry).toBeDefined()
      expect(res.body.plantEntry.hoursOperated).toBe(8)
      plantEntryId = res.body.plantEntry.id
    })

    it('should get plant entries for docket', async () => {
      const res = await request(app)
        .get(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.plantEntries).toBeDefined()
      expect(res.body.totals).toBeDefined()
    })

    it('should update plant entry', async () => {
      const res = await request(app)
        .put(`/api/dockets/${docketId}/plant/${plantEntryId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          hoursOperated: 10,
          wetOrDry: 'wet',
        })

      expect(res.status).toBe(200)
      expect(res.body.plantEntry).toBeDefined()
    })

    it('should reject adding plant without plantId', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          hoursOperated: 8,
        })

      expect(res.status).toBe(400)
    })

    it('should reject adding plant without hoursOperated', async () => {
      const res = await request(app)
        .post(`/api/dockets/${docketId}/plant`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          plantId,
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Docket Submission Flow', () => {
    let submittableDocketId: string
    let labourId: string

    beforeAll(async () => {
      // Create a new docket for submission testing
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(),
          status: 'draft',
        }
      })
      submittableDocketId = docket.id

      // Add labour entry with lot allocation for submission
      const lot = await prisma.lot.findFirst({ where: { projectId } })
      const labour = await prisma.docketLabour.create({
        data: {
          docketId: submittableDocketId,
          employeeId,
          startTime: '07:00',
          finishTime: '15:00',
          submittedHours: 8,
          hourlyRate: 45.50,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: lot!.id,
              hours: 8,
            }
          }
        }
      })
      labourId = labour.id
    })

    it('should reject submission without entries', async () => {
      // Create empty docket
      const emptyDocket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 86400000), // Tomorrow
          status: 'draft',
        }
      })

      const res = await request(app)
        .post(`/api/dockets/${emptyDocket.id}/submit`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('ENTRY_REQUIRED')

      await prisma.dailyDocket.delete({ where: { id: emptyDocket.id } })
    })

    it('should submit docket for approval', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/submit`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.docket.status).toBe('pending_approval')
    })

    it('should reject submitting non-draft docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/submit`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(400)
    })

    it('should approve docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          foremanNotes: 'Looks good',
        })

      expect(res.status).toBe(200)
      expect(res.body.docket.status).toBe('approved')
    })

    it('should reject approving non-pending docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${submittableDocketId}/approve`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
    })

    afterAll(async () => {
      await prisma.docketLabourLot.deleteMany({ where: { docketLabourId: labourId } })
      await prisma.docketLabour.deleteMany({ where: { docketId: submittableDocketId } })
      await prisma.dailyDocket.delete({ where: { id: submittableDocketId } }).catch(() => {})
    })
  })

  describe('Docket Rejection Flow', () => {
    let rejectableDocketId: string

    beforeAll(async () => {
      // Create docket in pending_approval state
      const lot = await prisma.lot.findFirst({ where: { projectId } })
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 172800000), // 2 days from now
          status: 'pending_approval',
          submittedAt: new Date(),
        }
      })
      rejectableDocketId = docket.id

      // Add required labour entry
      await prisma.docketLabour.create({
        data: {
          docketId: rejectableDocketId,
          employeeId,
          submittedHours: 8,
          hourlyRate: 45.50,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: lot!.id,
              hours: 8,
            }
          }
        }
      })
    })

    it('should reject docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${rejectableDocketId}/reject`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Hours do not match diary',
        })

      expect(res.status).toBe(200)
      expect(res.body.docket.status).toBe('rejected')
    })

    afterAll(async () => {
      await prisma.docketLabourLot.deleteMany({ where: { docketLabour: { docketId: rejectableDocketId } } })
      await prisma.docketLabour.deleteMany({ where: { docketId: rejectableDocketId } })
      await prisma.dailyDocket.delete({ where: { id: rejectableDocketId } }).catch(() => {})
    })
  })

  describe('Docket Query Flow', () => {
    let queryableDocketId: string

    beforeAll(async () => {
      const lot = await prisma.lot.findFirst({ where: { projectId } })
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 259200000), // 3 days from now
          status: 'pending_approval',
          submittedAt: new Date(),
        }
      })
      queryableDocketId = docket.id

      await prisma.docketLabour.create({
        data: {
          docketId: queryableDocketId,
          employeeId,
          submittedHours: 8,
          hourlyRate: 45.50,
          submittedCost: 364,
          lotAllocations: {
            create: {
              lotId: lot!.id,
              hours: 8,
            }
          }
        }
      })
    })

    it('should query docket', async () => {
      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/query`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questions: 'What work area was this for?',
        })

      expect(res.status).toBe(200)
      expect(res.body.docket.status).toBe('queried')
    })

    it('should reject query without questions', async () => {
      // Reset status for this test
      await prisma.dailyDocket.update({
        where: { id: queryableDocketId },
        data: { status: 'pending_approval' }
      })

      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/query`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questions: '',
        })

      expect(res.status).toBe(400)
    })

    it('should respond to query', async () => {
      // Set to queried state
      await prisma.dailyDocket.update({
        where: { id: queryableDocketId },
        data: { status: 'queried' }
      })

      const res = await request(app)
        .post(`/api/dockets/${queryableDocketId}/respond`)
        .set('Authorization', `Bearer ${subcontractorToken}`)
        .send({
          response: 'This was for the northern section',
        })

      expect(res.status).toBe(200)
      expect(res.body.docket.status).toBe('pending_approval')
    })

    afterAll(async () => {
      await prisma.docketLabourLot.deleteMany({ where: { docketLabour: { docketId: queryableDocketId } } })
      await prisma.docketLabour.deleteMany({ where: { docketId: queryableDocketId } })
      await prisma.dailyDocket.delete({ where: { id: queryableDocketId } }).catch(() => {})
    })
  })

  describe('Labour Entry Deletion', () => {
    let deletableDocketId: string
    let deletableLabourId: string

    beforeAll(async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 345600000), // 4 days from now
          status: 'draft',
        }
      })
      deletableDocketId = docket.id

      const labour = await prisma.docketLabour.create({
        data: {
          docketId: deletableDocketId,
          employeeId,
          submittedHours: 4,
          hourlyRate: 45.50,
          submittedCost: 182,
        }
      })
      deletableLabourId = labour.id
    })

    it('should delete labour entry', async () => {
      const res = await request(app)
        .delete(`/api/dockets/${deletableDocketId}/labour/${deletableLabourId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deleted')
    })

    afterAll(async () => {
      await prisma.docketLabour.deleteMany({ where: { docketId: deletableDocketId } })
      await prisma.dailyDocket.delete({ where: { id: deletableDocketId } }).catch(() => {})
    })
  })

  describe('Plant Entry Deletion', () => {
    let deletableDocketId: string
    let deletablePlantEntryId: string

    beforeAll(async () => {
      const docket = await prisma.dailyDocket.create({
        data: {
          projectId,
          subcontractorCompanyId,
          date: new Date(Date.now() + 432000000), // 5 days from now
          status: 'draft',
        }
      })
      deletableDocketId = docket.id

      const plantEntry = await prisma.docketPlant.create({
        data: {
          docketId: deletableDocketId,
          plantId,
          hoursOperated: 4,
          hourlyRate: 150,
          submittedCost: 600,
        }
      })
      deletablePlantEntryId = plantEntry.id
    })

    it('should delete plant entry', async () => {
      const res = await request(app)
        .delete(`/api/dockets/${deletableDocketId}/plant/${deletablePlantEntryId}`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deleted')
    })

    afterAll(async () => {
      await prisma.docketPlant.deleteMany({ where: { docketId: deletableDocketId } })
      await prisma.dailyDocket.delete({ where: { id: deletableDocketId } }).catch(() => {})
    })
  })
})

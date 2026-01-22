import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import subcontractors router
import { subcontractorsRouter } from './subcontractors.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/subcontractors', subcontractorsRouter)

describe('Subcontractors API', () => {
  let authToken: string
  let subcontractorToken: string
  let userId: string
  let subcontractorUserId: string
  let companyId: string
  let projectId: string
  let subcontractorCompanyId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Subcontractors Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create head contractor user
    const adminEmail = `sub-admin-${Date.now()}@example.com`
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Subcontractor Admin',
        tosAccepted: true,
      })
    authToken = adminRes.body.token
    userId = adminRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Subcontractors Test Project ${Date.now()}`,
        projectNumber: `SUB-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'project_manager', status: 'active' }
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.employeeRoster.deleteMany({ where: { subcontractorCompany: { projectId } } })
    await prisma.plantRegister.deleteMany({ where: { subcontractorCompany: { projectId } } })
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompany: { projectId } } })
    await prisma.subcontractorCompany.deleteMany({ where: { projectId } })
    await prisma.globalSubcontractor.deleteMany({ where: { organizationId: companyId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    for (const uid of [userId, subcontractorUserId].filter(Boolean)) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } })
      await prisma.user.delete({ where: { id: uid } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/subcontractors/invite', () => {
    it('should invite a new subcontractor', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          companyName: 'Test Subcontractor Co',
          primaryContactName: 'John Sub',
          primaryContactEmail: `sub-invite-${Date.now()}@example.com`,
          primaryContactPhone: '0412345678',
        })

      expect(res.status).toBe(201)
      expect(res.body.subcontractor).toBeDefined()
      expect(res.body.subcontractor.companyName).toBe('Test Subcontractor Co')
      expect(res.body.subcontractor.status).toBe('pending_approval')
      subcontractorCompanyId = res.body.subcontractor.id
    })

    it('should reject duplicate company name for same project', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          companyName: 'Test Subcontractor Co',
          primaryContactName: 'Jane Sub',
          primaryContactEmail: `sub-dupe-${Date.now()}@example.com`,
        })

      expect(res.status).toBe(409)
    })

    it('should reject invitation without required fields', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // Missing companyName, primaryContactName, primaryContactEmail
        })

      expect(res.status).toBe(400)
    })

    it('should reject invitation without projectId', async () => {
      const res = await request(app)
        .post('/api/subcontractors/invite')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          companyName: 'Another Co',
          primaryContactName: 'Test',
          primaryContactEmail: 'test@example.com',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/subcontractors/validate-abn', () => {
    it('should validate a correct ABN', async () => {
      // Using a known valid ABN format (Australian Tax Office test ABN)
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '51824753556', // Valid test ABN
        })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBeDefined()
    })

    it('should reject invalid ABN', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '12345678901', // Invalid checksum
        })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(false)
      expect(res.body.error).toBeDefined()
    })

    it('should reject ABN with wrong length', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          abn: '123456',
        })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(false)
    })

    it('should require ABN field', async () => {
      const res = await request(app)
        .post('/api/subcontractors/validate-abn')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/subcontractors/project/:projectId', () => {
    it('should list subcontractors for project', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.subcontractors).toBeDefined()
      expect(Array.isArray(res.body.subcontractors)).toBe(true)
      expect(res.body.subcontractors.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/subcontractors/for-project/:projectId', () => {
    it('should get subcontractors for project selection', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/for-project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.subcontractors).toBeDefined()
      expect(Array.isArray(res.body.subcontractors)).toBe(true)
    })
  })

  describe('GET /api/subcontractors/invitation/:id', () => {
    it('should get invitation details (public endpoint)', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/invitation/${subcontractorCompanyId}`)

      expect(res.status).toBe(200)
      expect(res.body.invitation).toBeDefined()
      expect(res.body.invitation.companyName).toBe('Test Subcontractor Co')
    })

    it('should return 404 for non-existent invitation', async () => {
      const res = await request(app)
        .get('/api/subcontractors/invitation/non-existent-id')

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/subcontractors/:id/status', () => {
    it('should update subcontractor status to approved', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved',
        })

      expect(res.status).toBe(200)
      expect(res.body.subcontractor.status).toBe('approved')
    })

    it('should suspend subcontractor', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'suspended',
        })

      expect(res.status).toBe(200)
      expect(res.body.subcontractor.status).toBe('suspended')
    })

    it('should reject invalid status', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status',
        })

      expect(res.status).toBe(400)
    })

    // Reset to approved for further tests
    afterAll(async () => {
      await prisma.subcontractorCompany.update({
        where: { id: subcontractorCompanyId },
        data: { status: 'approved' }
      })
    })
  })

  describe('Portal Access Management', () => {
    it('should get portal access settings', async () => {
      const res = await request(app)
        .get(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.portalAccess).toBeDefined()
      expect(res.body.portalAccess.lots).toBeDefined()
    })

    it('should update portal access settings', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          portalAccess: {
            lots: true,
            itps: true,
            holdPoints: false,
            testResults: false,
            ncrs: false,
            documents: true,
          }
        })

      expect(res.status).toBe(200)
      expect(res.body.portalAccess).toBeDefined()
    })

    it('should reject invalid portal access values', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/portal-access`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          portalAccess: {
            lots: 'yes', // Should be boolean
          }
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Employee Management', () => {
    let employeeId: string

    it('should add employee to subcontractor', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Worker',
          role: 'Labourer',
          hourlyRate: 42.50,
          phone: '0412345678',
        })

      expect(res.status).toBe(201)
      expect(res.body.employee).toBeDefined()
      expect(res.body.employee.name).toBe('Test Worker')
      expect(res.body.employee.status).toBe('pending')
      employeeId = res.body.employee.id
    })

    it('should reject employee without name', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/employees`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          role: 'Labourer',
          hourlyRate: 42.50,
        })

      expect(res.status).toBe(400)
    })

    it('should approve employee rate', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved',
        })

      expect(res.status).toBe(200)
      expect(res.body.employee.status).toBe('approved')
    })

    it('should counter-propose employee rate', async () => {
      // First reset to pending
      await prisma.employeeRoster.update({
        where: { id: employeeId },
        data: { status: 'pending' }
      })

      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterRate: 38.00,
        })

      expect(res.status).toBe(200)
      expect(res.body.employee.status).toBe('counter')
    })

    it('should reject counter without counterRate', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/employees/${employeeId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          // Missing counterRate
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Plant Management', () => {
    let plantId: string

    it('should add plant to subcontractor', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'Excavator',
          description: 'CAT 320DL',
          idRego: 'EX-001',
          dryRate: 150,
          wetRate: 180,
        })

      expect(res.status).toBe(201)
      expect(res.body.plant).toBeDefined()
      expect(res.body.plant.type).toBe('Excavator')
      expect(res.body.plant.status).toBe('pending')
      plantId = res.body.plant.id
    })

    it('should reject plant without type', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/${subcontractorCompanyId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Some equipment',
          dryRate: 100,
        })

      expect(res.status).toBe(400)
    })

    it('should approve plant rate', async () => {
      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${plantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'approved',
        })

      expect(res.status).toBe(200)
      expect(res.body.plant.status).toBe('approved')
    })

    it('should counter-propose plant rate', async () => {
      // Reset to pending
      await prisma.plantRegister.update({
        where: { id: plantId },
        data: { status: 'pending' }
      })

      const res = await request(app)
        .patch(`/api/subcontractors/${subcontractorCompanyId}/plant/${plantId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'counter',
          counterDryRate: 140,
          counterWetRate: 170,
        })

      expect(res.status).toBe(200)
      expect(res.body.plant.status).toBe('counter')
    })
  })

  describe('Invitation Acceptance', () => {
    let invitationSubId: string

    beforeAll(async () => {
      // Create a new subcontractor for acceptance testing
      const sub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Invite Accept Test ${Date.now()}`,
          primaryContactName: 'Accept Test',
          primaryContactEmail: `accept-${Date.now()}@example.com`,
          status: 'pending_approval',
        }
      })
      invitationSubId = sub.id

      // Create a user to accept
      const acceptEmail = `accept-user-${Date.now()}@example.com`
      const acceptRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: acceptEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Accept User',
          tosAccepted: true,
        })
      subcontractorToken = acceptRes.body.token
      subcontractorUserId = acceptRes.body.user.id

      await prisma.user.update({
        where: { id: subcontractorUserId },
        data: { companyId, roleInCompany: 'viewer' }
      })
    })

    it('should accept invitation and link user', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/invitation/${invitationSubId}/accept`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(200)
      expect(res.body.subcontractor).toBeDefined()
      expect(res.body.subcontractor.status).toBe('approved')
    })

    it('should reject duplicate acceptance', async () => {
      const res = await request(app)
        .post(`/api/subcontractors/invitation/${invitationSubId}/accept`)
        .set('Authorization', `Bearer ${subcontractorToken}`)

      expect(res.status).toBe(400)
    })

    afterAll(async () => {
      await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId: invitationSubId } })
      await prisma.subcontractorCompany.delete({ where: { id: invitationSubId } }).catch(() => {})
    })
  })

  describe('Subcontractor Portal (my-company)', () => {
    let portalSubId: string
    let portalUserId: string
    let portalToken: string

    beforeAll(async () => {
      // Create subcontractor company
      const sub = await prisma.subcontractorCompany.create({
        data: {
          projectId,
          companyName: `Portal Test Co ${Date.now()}`,
          primaryContactName: 'Portal Admin',
          primaryContactEmail: `portal-${Date.now()}@example.com`,
          status: 'approved',
        }
      })
      portalSubId = sub.id

      // Create and link user
      const portalEmail = `portal-admin-${Date.now()}@example.com`
      const portalRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: portalEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Portal Admin User',
          tosAccepted: true,
        })
      portalToken = portalRes.body.token
      portalUserId = portalRes.body.user.id

      await prisma.user.update({
        where: { id: portalUserId },
        data: { companyId, roleInCompany: 'subcontractor_admin' }
      })

      await prisma.subcontractorUser.create({
        data: {
          userId: portalUserId,
          subcontractorCompanyId: portalSubId,
          role: 'admin',
        }
      })
    })

    it('should get my company details', async () => {
      const res = await request(app)
        .get('/api/subcontractors/my-company')
        .set('Authorization', `Bearer ${portalToken}`)

      expect(res.status).toBe(200)
      expect(res.body.company).toBeDefined()
      expect(res.body.company.companyName).toContain('Portal Test Co')
    })

    it('should add employee via my-company', async () => {
      const res = await request(app)
        .post('/api/subcontractors/my-company/employees')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({
          name: 'My Employee',
          role: 'Operator',
          hourlyRate: 55,
          phone: '0400000000',
        })

      expect(res.status).toBe(201)
      expect(res.body.employee).toBeDefined()
    })

    it('should add plant via my-company', async () => {
      const res = await request(app)
        .post('/api/subcontractors/my-company/plant')
        .set('Authorization', `Bearer ${portalToken}`)
        .send({
          type: 'Truck',
          description: 'Tipper Truck',
          dryRate: 120,
        })

      expect(res.status).toBe(201)
      expect(res.body.plant).toBeDefined()
    })

    afterAll(async () => {
      await prisma.employeeRoster.deleteMany({ where: { subcontractorCompanyId: portalSubId } })
      await prisma.plantRegister.deleteMany({ where: { subcontractorCompanyId: portalSubId } })
      await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId: portalSubId } })
      await prisma.subcontractorCompany.delete({ where: { id: portalSubId } }).catch(() => {})
      await prisma.emailVerificationToken.deleteMany({ where: { userId: portalUserId } })
      await prisma.user.delete({ where: { id: portalUserId } }).catch(() => {})
    })
  })

  describe('Global Subcontractor Directory', () => {
    it('should get global subcontractor directory', async () => {
      const res = await request(app)
        .get('/api/subcontractors/directory')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.subcontractors).toBeDefined()
      expect(Array.isArray(res.body.subcontractors)).toBe(true)
    })
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { lotsRouter } from './lots.js'
import { ncrsRouter } from './ncrs.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/lots', lotsRouter)
app.use('/api/ncrs', ncrsRouter)

describe('Role-Based Access Control', () => {
  let companyId: string
  let projectId: string

  // User tokens by role
  let adminToken: string
  let adminId: string
  let foremenToken: string
  let foremenId: string
  let viewerToken: string
  let viewerId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `RBAC Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `RBAC Test Project ${Date.now()}`,
        projectNumber: `RBAC-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    // Create admin user
    const adminEmail = `rbac-admin-${Date.now()}@example.com`
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'RBAC Admin',
        tosAccepted: true,
      })
    adminToken = adminRes.body.token
    adminId = adminRes.body.user.id

    await prisma.user.update({
      where: { id: adminId },
      data: { companyId, roleInCompany: 'admin' }
    })
    await prisma.projectUser.create({
      data: { projectId, userId: adminId, role: 'admin', status: 'active' }
    })

    // Create foremen user (can create lots)
    const foremenEmail = `rbac-foremen-${Date.now()}@example.com`
    const foremenRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: foremenEmail,
        password: 'SecureP@ssword123!',
        fullName: 'RBAC Foreman',
        tosAccepted: true,
      })
    foremenToken = foremenRes.body.token
    foremenId = foremenRes.body.user.id

    await prisma.user.update({
      where: { id: foremenId },
      data: { companyId, roleInCompany: 'foreman' }
    })
    await prisma.projectUser.create({
      data: { projectId, userId: foremenId, role: 'foreman', status: 'active' }
    })

    // Create viewer user (limited access)
    const viewerEmail = `rbac-viewer-${Date.now()}@example.com`
    const viewerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: viewerEmail,
        password: 'SecureP@ssword123!',
        fullName: 'RBAC Viewer',
        tosAccepted: true,
      })
    viewerToken = viewerRes.body.token
    viewerId = viewerRes.body.user.id

    await prisma.user.update({
      where: { id: viewerId },
      data: { companyId, roleInCompany: 'viewer' }
    })
    await prisma.projectUser.create({
      data: { projectId, userId: viewerId, role: 'viewer', status: 'active' }
    })

    // Create a test lot for RBAC testing
    await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `RBAC-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    for (const userId of [adminId, foremenId, viewerId]) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('Lot Creation Permissions', () => {
    it('admin should create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          lotNumber: `ADMIN-LOT-${Date.now()}`,
          description: 'Admin created lot',
        })

      expect(res.status).toBe(201)
    })

    it('foreman should create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${foremenToken}`)
        .send({
          projectId,
          lotNumber: `FOREMAN-LOT-${Date.now()}`,
          description: 'Foreman created lot',
        })

      expect(res.status).toBe(201)
    })

    it('viewer should NOT create lots', async () => {
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId,
          lotNumber: `VIEWER-LOT-${Date.now()}`,
          description: 'Viewer attempted lot',
        })

      expect(res.status).toBe(403)
    })
  })

  describe('Lot Read Permissions', () => {
    it('admin should read lots', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lots.length).toBeGreaterThan(0)
    })

    it('foreman should read lots', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${foremenToken}`)

      expect(res.status).toBe(200)
    })

    it('viewer should read lots', async () => {
      const res = await request(app)
        .get(`/api/lots?projectId=${projectId}`)
        .set('Authorization', `Bearer ${viewerToken}`)

      expect(res.status).toBe(200)
    })
  })

  describe('Lot Delete Permissions', () => {
    let deletableLotId: string

    beforeAll(async () => {
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DELETE-TEST-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        }
      })
      deletableLotId = lot.id
    })

    it('admin should delete lots', async () => {
      const res = await request(app)
        .delete(`/api/lots/${deletableLotId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
    })

    it('viewer should NOT delete lots', async () => {
      // Create another lot for viewer to try to delete
      const newLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `VIEWER-DELETE-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        }
      })

      const res = await request(app)
        .delete(`/api/lots/${newLot.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)

      expect(res.status).toBe(403)

      // Clean up
      await prisma.lot.delete({ where: { id: newLot.id } }).catch(() => {})
    })
  })

  describe('NCR Permissions', () => {
    it('all project members should create NCRs', async () => {
      // Admin can create NCR
      const adminRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          projectId,
          description: 'Admin NCR',
          category: 'Workmanship',
          severity: 'minor',
        })
      expect(adminRes.status).toBe(201)

      // Foreman can create NCR
      const foremanRes = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${foremenToken}`)
        .send({
          projectId,
          description: 'Foreman NCR',
          category: 'Workmanship',
          severity: 'minor',
        })
      expect(foremanRes.status).toBe(201)
    })

    it('all project members should read NCRs', async () => {
      const adminRes = await request(app)
        .get('/api/ncrs')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(adminRes.status).toBe(200)

      const viewerRes = await request(app)
        .get('/api/ncrs')
        .set('Authorization', `Bearer ${viewerToken}`)
      expect(viewerRes.status).toBe(200)
    })
  })

  describe('Cross-Company Access Control', () => {
    let otherCompanyId: string
    let otherProjectId: string
    let otherLotId: string
    let outsiderToken: string
    let outsiderId: string

    beforeAll(async () => {
      // Create a DIFFERENT company
      const otherCompany = await prisma.company.create({
        data: { name: `Other Company ${Date.now()}` }
      })
      otherCompanyId = otherCompany.id

      // Create project in the other company
      const otherProject = await prisma.project.create({
        data: {
          name: `Other Company Project ${Date.now()}`,
          projectNumber: `OTHERCO-${Date.now()}`,
          companyId: otherCompanyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'rms',
        }
      })
      otherProjectId = otherProject.id

      const otherLot = await prisma.lot.create({
        data: {
          projectId: otherProjectId,
          lotNumber: `OTHER-LOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        }
      })
      otherLotId = otherLot.id

      // Create a user in the OTHER company who has access to otherProject
      const outsiderEmail = `outsider-${Date.now()}@example.com`
      const outsiderRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: outsiderEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Outsider User',
          tosAccepted: true,
        })
      outsiderToken = outsiderRes.body.token
      outsiderId = outsiderRes.body.user.id

      await prisma.user.update({
        where: { id: outsiderId },
        data: { companyId: otherCompanyId, roleInCompany: 'admin' }
      })
      await prisma.projectUser.create({
        data: { projectId: otherProjectId, userId: outsiderId, role: 'admin', status: 'active' }
      })
    })

    afterAll(async () => {
      await prisma.lot.deleteMany({ where: { projectId: otherProjectId } })
      await prisma.projectUser.deleteMany({ where: { projectId: otherProjectId } })
      await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => {})
      await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderId } })
      await prisma.user.delete({ where: { id: outsiderId } }).catch(() => {})
      await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {})
    })

    it('viewer should NOT create lots in other company project', async () => {
      // Viewer from our company tries to create lot in otherCompanyId's project
      // Should fail because viewer doesn't have LOT_CREATORS role
      const res = await request(app)
        .post('/api/lots')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          projectId: otherProjectId,
          lotNumber: `UNAUTHORIZED-${Date.now()}`,
        })

      expect(res.status).toBe(403)
    })

    it('should NOT allow reading lots from other company project', async () => {
      // Our admin user (from companyId) tries to read lot in otherCompanyId's project
      const res = await request(app)
        .get(`/api/lots/${otherLotId}`)
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(403)
    })

    it('outsider CAN access their own company lots', async () => {
      const res = await request(app)
        .get(`/api/lots/${otherLotId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)

      expect(res.status).toBe(200)
    })
  })
})

describe('Authentication Requirements', () => {
  it('should reject requests without auth token', async () => {
    const res = await request(app)
      .get('/api/lots?projectId=test')

    expect(res.status).toBe(401)
  })

  it('should reject requests with invalid token', async () => {
    const res = await request(app)
      .get('/api/lots?projectId=test')
      .set('Authorization', 'Bearer invalid-token')

    expect(res.status).toBe(401)
  })

  it('should reject requests with expired token format', async () => {
    const res = await request(app)
      .get('/api/lots?projectId=test')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.invalid')

    expect(res.status).toBe(401)
  })
})

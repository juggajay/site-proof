import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { lotsRouter } from './lots.js'
import { ncrsRouter } from './ncrs/index.js'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/lots', lotsRouter)
app.use('/api/ncrs', ncrsRouter)
app.use(errorHandler)

describe('Full Workflow Integration', () => {
  let adminToken: string
  let adminId: string
  let companyId: string
  let projectId: string

  beforeAll(async () => {
    // Create company
    const company = await prisma.company.create({
      data: { name: `Integration Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Register admin user
    const adminEmail = `integration-admin-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Integration Admin',
        tosAccepted: true,
      })
    adminToken = regRes.body.token
    adminId = regRes.body.user.id

    // Set up admin with company
    await prisma.user.update({
      where: { id: adminId },
      data: { companyId, roleInCompany: 'admin' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Integration Project ${Date.now()}`,
        projectNumber: `INT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    // Add admin to project
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: adminId,
        role: 'admin',
        status: 'active',
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
    await prisma.emailVerificationToken.deleteMany({ where: { userId: adminId } })
    await prisma.user.delete({ where: { id: adminId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should complete full lot lifecycle', async () => {
    // 1. Create lot
    const createRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        lotNumber: `LIFECYCLE-${Date.now()}`,
        description: 'Full lifecycle test',
        activityType: 'Earthworks',
      })

    expect(createRes.status).toBe(201)
    const lotId = createRes.body.lot.id

    // 2. Update lot status to in_progress
    const progressRes = await request(app)
      .patch(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' })

    expect(progressRes.status).toBe(200)
    expect(progressRes.body.lot.status).toBe('in_progress')

    // 3. Update to awaiting_test
    const awaitRes = await request(app)
      .patch(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'awaiting_test' })

    expect(awaitRes.status).toBe(200)

    // 4. Complete lot
    const completeRes = await request(app)
      .patch(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed' })

    expect(completeRes.status).toBe(200)
    expect(completeRes.body.lot.status).toBe('completed')

    // 5. Verify lot in list
    const listRes = await request(app)
      .get(`/api/lots?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(listRes.status).toBe(200)
    const found = listRes.body.lots.find((l: any) => l.id === lotId)
    expect(found).toBeDefined()
    expect(found.status).toBe('completed')
  })

  it('should complete full NCR workflow', async () => {
    // 1. Create lot for NCR
    const lotRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        lotNumber: `NCR-WORKFLOW-LOT-${Date.now()}`,
        activityType: 'Earthworks',
      })

    expect(lotRes.status).toBe(201)
    const lotId = lotRes.body.lot.id

    // 2. Create NCR against lot
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        description: 'Integration test NCR',
        category: 'Workmanship',
        severity: 'minor',
        lotIds: [lotId],
        responsibleUserId: adminId,
      })

    expect(ncrRes.status).toBe(201)
    const ncrId = ncrRes.body.ncr.id

    // 3. Submit response
    const respondRes = await request(app)
      .post(`/api/ncrs/${ncrId}/respond`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Process error',
        proposedCorrectiveAction: 'Retrain staff',
      })

    expect(respondRes.status).toBe(200)
    expect(respondRes.body.ncr.status).toBe('investigating')

    // 4. QM accepts response
    const reviewRes = await request(app)
      .post(`/api/ncrs/${ncrId}/qm-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'accept',
        comments: 'Good analysis',
      })

    expect(reviewRes.status).toBe(200)
    expect(reviewRes.body.ncr.status).toBe('rectification')

    // 5. Submit rectification
    const rectifyRes = await request(app)
      .post(`/api/ncrs/${ncrId}/rectify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rectificationNotes: 'Work has been corrected',
      })

    expect(rectifyRes.status).toBe(200)
    expect(rectifyRes.body.ncr.status).toBe('verification')

    // 6. Close NCR
    const closeRes = await request(app)
      .post(`/api/ncrs/${ncrId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        verificationNotes: 'Verified satisfactory',
        lessonsLearned: 'Updated procedures',
      })

    expect(closeRes.status).toBe(200)
    expect(closeRes.body.ncr.status).toBe('closed')

    // 7. Verify NCR in list
    const listRes = await request(app)
      .get(`/api/ncrs?projectId=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(listRes.status).toBe(200)
    const found = listRes.body.ncrs.find((n: any) => n.id === ncrId)
    expect(found).toBeDefined()
    expect(found.status).toBe('closed')
  })

  it('should handle NCR linked to lot status', async () => {
    // Create lot
    const lotRes = await request(app)
      .post('/api/lots')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        lotNumber: `STATUS-LINK-${Date.now()}`,
        activityType: 'Earthworks',
      })

    const lotId = lotRes.body.lot.id

    // Verify lot starts as not_started
    const initialLot = await request(app)
      .get(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(initialLot.body.lot.status).toBe('not_started')

    // Create NCR against lot - should change lot status to ncr_raised
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        projectId,
        description: 'Status link test NCR',
        category: 'Workmanship',
        severity: 'minor',
        lotIds: [lotId],
      })

    expect(ncrRes.status).toBe(201)

    // Verify lot status changed
    const updatedLot = await request(app)
      .get(`/api/lots/${lotId}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(updatedLot.body.lot.status).toBe('ncr_raised')
  })
})

describe('Authentication Flow Integration', () => {
  it('should complete registration and login flow', async () => {
    const testEmail = `flow-test-${Date.now()}@example.com`
    const testPassword = 'SecureP@ssword123!'

    // 1. Register
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Flow Test User',
        tosAccepted: true,
      })

    expect(regRes.status).toBe(201)
    expect(regRes.body.token).toBeDefined()

    // 2. Login with same credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.token).toBeDefined()

    // 3. Use token to access protected resource
    const protectedRes = await request(app)
      .get('/api/lots?projectId=test')
      .set('Authorization', `Bearer ${loginRes.body.token}`)

    // Should get 200 or 400 (bad project), not 401
    expect(protectedRes.status).not.toBe(401)

    // Cleanup
    await prisma.emailVerificationToken.deleteMany({
      where: { user: { email: testEmail } }
    })
    await prisma.user.delete({ where: { email: testEmail } }).catch(() => {})
  })
})

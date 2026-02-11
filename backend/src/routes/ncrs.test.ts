import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { ncrsRouter } from './ncrs/index.js'
import { authRouter } from './auth.js'
import { lotsRouter } from './lots.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/ncrs', ncrsRouter)
app.use('/api/lots', lotsRouter)

describe('NCR API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let ncrId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `NCR Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `ncr-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'NCR Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' }
    })

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `NCR Test Project ${Date.now()}`,
        projectNumber: `NTP-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      }
    })

    // Create test lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `NCR-LOT-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id
  })

  afterAll(async () => {
    // Clean up in reverse order
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCR.deleteMany({ where: { projectId } })
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

  describe('POST /api/ncrs', () => {
    it('should create a minor NCR', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Test non-conformance',
          category: 'Workmanship',
          severity: 'minor',
          lotIds: [lotId],
        })

      expect(res.status).toBe(201)
      expect(res.body.ncr).toBeDefined()
      expect(res.body.ncr.ncrNumber).toMatch(/^NCR-\d{4}$/)
      expect(res.body.ncr.severity).toBe('minor')
      ncrId = res.body.ncr.id
    })

    it('should create a major NCR with QM approval required', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'Major defect found',
          category: 'Material',
          severity: 'major',
          lotIds: [lotId],
        })

      expect(res.status).toBe(201)
      expect(res.body.ncr.severity).toBe('major')
    })

    it('should reject NCR without required fields', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // Missing description and category
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Validation failed')
      expect(res.body.details).toBeDefined()
    })

    it('should reject NCR without projectId', async () => {
      const res = await request(app)
        .post('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Test',
          category: 'Workmanship',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/ncrs', () => {
    it('should list NCRs for accessible projects', async () => {
      const res = await request(app)
        .get('/api/ncrs')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ncrs).toBeDefined()
      expect(Array.isArray(res.body.ncrs)).toBe(true)
    })

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/ncrs?status=open')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      for (const ncr of res.body.ncrs) {
        expect(ncr.status).toBe('open')
      }
    })

    it('should filter by severity', async () => {
      const res = await request(app)
        .get('/api/ncrs?severity=minor')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      for (const ncr of res.body.ncrs) {
        expect(ncr.severity).toBe('minor')
      }
    })

    it('should filter by projectId', async () => {
      const res = await request(app)
        .get(`/api/ncrs?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ncrs.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/ncrs/:id', () => {
    it('should get a single NCR', async () => {
      const res = await request(app)
        .get(`/api/ncrs/${ncrId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.ncr).toBeDefined()
      expect(res.body.ncr.id).toBe(ncrId)
    })

    it('should return 404 for non-existent NCR', async () => {
      const res = await request(app)
        .get('/api/ncrs/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })
})

describe('NCR Workflow', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let workflowNcrId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Workflow Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `ncr-workflow-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'NCR Workflow User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' }
    })

    const project = await prisma.project.create({
      data: {
        name: `NCR Workflow Project ${Date.now()}`,
        projectNumber: `NCRWP-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      }
    })

    // Create NCR for workflow testing
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Workflow test NCR',
        category: 'Workmanship',
        severity: 'minor',
        responsibleUserId: userId,
      })
    workflowNcrId = ncrRes.body.ncr.id
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCR.deleteMany({ where: { projectId } })
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

  it('should submit response to NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Incorrect procedure followed',
        proposedCorrectiveAction: 'Retrain workers on correct method',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('investigating')
  })

  it('should reject response when NCR not in open status', async () => {
    // NCR is now in investigating status
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Test',
        proposedCorrectiveAction: 'Test',
      })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('not in open status')
  })

  it('should accept response via QM review', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'accept',
        comments: 'Response is acceptable',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('rectification')
  })

  it('should submit rectification', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rectificationNotes: 'Work has been rectified',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('verification')
  })

  it('should close NCR', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${workflowNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        verificationNotes: 'Verified complete',
        lessonsLearned: 'Document procedure changes',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('closed')
  })
})

describe('NCR QM Review - Request Revision', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let revisionNcrId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `NCR Revision Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `ncr-revision-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'NCR Revision User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' }
    })

    const project = await prisma.project.create({
      data: {
        name: `NCR Revision Project ${Date.now()}`,
        projectNumber: `NCRREV-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      }
    })

    // Create NCR
    const createRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Revision test NCR',
        category: 'Workmanship',
        severity: 'minor',
      })
    revisionNcrId = createRes.body.ncr.id

    // Submit response
    await request(app)
      .post(`/api/ncrs/${revisionNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Test',
        proposedCorrectiveAction: 'Test',
      })
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should request revision of response', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${revisionNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'request_revision',
        comments: 'Root cause analysis is insufficient',
      })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('open')
    expect(res.body.ncr.revisionRequested).toBe(true)
  })

  it('should reject invalid action', async () => {
    // First respond again
    await request(app)
      .post(`/api/ncrs/${revisionNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Method',
        rootCauseDescription: 'Updated test',
        proposedCorrectiveAction: 'Updated test',
      })

    const res = await request(app)
      .post(`/api/ncrs/${revisionNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'invalid_action',
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
    expect(res.body.details).toBeDefined()
  })
})

describe('Major NCR QM Approval', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let majorNcrId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Major NCR Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `major-ncr-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Major NCR User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'quality_manager' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Major NCR Project ${Date.now()}`,
        projectNumber: `MAJNCR-${Date.now()}`,
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
        role: 'quality_manager',
        status: 'active',
      }
    })

    // Create major NCR
    const ncrRes = await request(app)
      .post('/api/ncrs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        projectId,
        description: 'Major defect requiring QM approval',
        category: 'Material',
        severity: 'major',
      })
    majorNcrId = ncrRes.body.ncr.id

    // Complete workflow up to verification
    await request(app)
      .post(`/api/ncrs/${majorNcrId}/respond`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        rootCauseCategory: 'Material',
        rootCauseDescription: 'Defective material',
        proposedCorrectiveAction: 'Replace material',
      })

    await request(app)
      .post(`/api/ncrs/${majorNcrId}/qm-review`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'accept' })

    await request(app)
      .post(`/api/ncrs/${majorNcrId}/rectify`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ rectificationNotes: 'Material replaced' })
  })

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.nCREvidence.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCRLot.deleteMany({ where: { ncr: { projectId } } })
    await prisma.nCR.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should reject closing major NCR without QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Done' })

    expect(res.status).toBe(403)
    expect(res.body.requiresQmApproval).toBe(true)
  })

  it('should grant QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/qm-approve`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('approval granted')
  })

  it('should close major NCR after QM approval', async () => {
    const res = await request(app)
      .post(`/api/ncrs/${majorNcrId}/close`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ verificationNotes: 'Verified' })

    expect(res.status).toBe(200)
    expect(res.body.ncr.status).toBe('closed')
  })
})

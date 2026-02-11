import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import claims router
import claimsRouter from './claims.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/projects', claimsRouter)

describe('Progress Claims API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId1: string
  let lotId2: string
  let claimId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Claims Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `claims-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Claims Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' }
    })

    // Create project
    const project = await prisma.project.create({
      data: {
        name: `Claims Test Project ${Date.now()}`,
        projectNumber: `CLM-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'project_manager', status: 'active' }
    })

    // Create conformed lots with budget amounts for claiming
    const lot1 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLM-LOT-1-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 5000,
        conformedAt: new Date(),
        conformedById: userId,
      }
    })
    lotId1 = lot1.id

    const lot2 = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `CLM-LOT-2-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 7500,
        conformedAt: new Date(),
        conformedById: userId,
      }
    })
    lotId2 = lot2.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.notification.deleteMany({ where: { projectId } })
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } })
    await prisma.progressClaim.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/projects/:projectId/lots', () => {
    it('should list lots for claiming', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lots).toBeDefined()
      expect(Array.isArray(res.body.lots)).toBe(true)
    })

    it('should filter by status', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots?status=conformed`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lots).toBeDefined()
    })

    it('should filter for unclaimed lots', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/lots?unclaimed=true`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.lots).toBeDefined()
    })
  })

  describe('POST /api/projects/:projectId/claims', () => {
    it('should create a new claim', async () => {
      const today = new Date()
      const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
      const periodEnd = today.toISOString().split('T')[0]

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart,
          periodEnd,
          lotIds: [lotId1],
        })

      expect(res.status).toBe(201)
      expect(res.body.claim).toBeDefined()
      expect(res.body.claim.claimNumber).toBe(1)
      expect(res.body.claim.status).toBe('draft')
      expect(res.body.claim.totalClaimedAmount).toBe(5000)
      claimId = res.body.claim.id
    })

    it('should reject claim without lots', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-01-01',
          periodEnd: '2025-01-31',
          lotIds: [],
        })

      expect(res.status).toBe(400)
    })

    it('should reject claim without period dates', async () => {
      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotIds: [lotId2],
        })

      expect(res.status).toBe(400)
    })

    it('should reject lots without budget amount', async () => {
      // Create a lot without budget amount
      const lotNoBudget = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `NO-BUDGET-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          // No budgetAmount set
        }
      })

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-02-01',
          periodEnd: '2025-02-28',
          lotIds: [lotNoBudget.id],
        })

      expect(res.status).toBe(400)
      expect(res.body.code).toBe('RATE_REQUIRED')

      // Cleanup
      await prisma.lot.delete({ where: { id: lotNoBudget.id } })
    })
  })

  describe('GET /api/projects/:projectId/claims', () => {
    it('should list all claims for project', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.claims).toBeDefined()
      expect(Array.isArray(res.body.claims)).toBe(true)
      expect(res.body.claims.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/projects/:projectId/claims/:claimId', () => {
    it('should get a single claim with details', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.claim).toBeDefined()
      expect(res.body.claim.id).toBe(claimId)
      expect(res.body.claim.claimedLots).toBeDefined()
    })

    it('should return 404 for non-existent claim', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/non-existent-id`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/projects/:projectId/claims/:claimId - Status Workflow', () => {
    it('should submit a draft claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'submitted',
        })

      expect(res.status).toBe(200)
      expect(res.body.claim.status).toBe('submitted')
      expect(res.body.claim.submittedAt).toBeDefined()
    })

    it('should certify a submitted claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
          certifiedAmount: 4800,
        })

      expect(res.status).toBe(200)
      expect(res.body.claim.status).toBe('certified')
      // Prisma returns Decimal as string
      expect(Number(res.body.claim.certifiedAmount)).toBe(4800)
    })

    it('should mark claim as paid', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
          paidAmount: 4800,
          paymentReference: 'PAY-2025-001',
        })

      expect(res.status).toBe(200)
      expect(res.body.claim.status).toBe('paid')
      // Prisma returns Decimal as string
      expect(Number(res.body.claim.paidAmount)).toBe(4800)
    })

    it('should reject updates to paid claims', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${claimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'certified',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('Claim Dispute Flow', () => {
    let disputeClaimId: string

    beforeAll(async () => {
      // Create a new lot for this test
      const disputeLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `DISPUTE-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 3000,
        }
      })

      // Create a claim to dispute
      const claim = await prisma.progressClaim.create({
        data: {
          projectId,
          claimNumber: 99,
          claimPeriodStart: new Date('2025-01-01'),
          claimPeriodEnd: new Date('2025-01-31'),
          status: 'submitted',
          preparedById: userId,
          totalClaimedAmount: 3000,
          submittedAt: new Date(),
          claimedLots: {
            create: {
              lotId: disputeLot.id,
              quantity: 1,
              unit: 'ea',
              rate: 3000,
              amountClaimed: 3000,
              percentageComplete: 100,
            }
          }
        }
      })
      disputeClaimId = claim.id
    })

    it('should dispute a claim', async () => {
      const res = await request(app)
        .put(`/api/projects/${projectId}/claims/${disputeClaimId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'disputed',
          disputeNotes: 'Documentation incomplete',
        })

      expect(res.status).toBe(200)
      expect(res.body.claim.status).toBe('disputed')
      expect(res.body.claim.disputeNotes).toBe('Documentation incomplete')
    })

    afterAll(async () => {
      await prisma.claimedLot.deleteMany({ where: { claimId: disputeClaimId } })
      await prisma.progressClaim.delete({ where: { id: disputeClaimId } }).catch(() => {})
    })
  })

  describe('GET /api/projects/:projectId/claims/:claimId/evidence-package', () => {
    let evidenceClaimId: string

    beforeAll(async () => {
      // Create a new lot and claim for evidence package test
      const evidenceLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `EVIDENCE-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 2000,
          conformedAt: new Date(),
          conformedById: userId,
        }
      })

      const claim = await prisma.progressClaim.create({
        data: {
          projectId,
          claimNumber: 98,
          claimPeriodStart: new Date('2025-02-01'),
          claimPeriodEnd: new Date('2025-02-28'),
          status: 'submitted',
          preparedById: userId,
          preparedAt: new Date(),
          totalClaimedAmount: 2000,
          submittedAt: new Date(),
          claimedLots: {
            create: {
              lotId: evidenceLot.id,
              quantity: 1,
              unit: 'ea',
              rate: 2000,
              amountClaimed: 2000,
              percentageComplete: 100,
            }
          }
        }
      })
      evidenceClaimId = claim.id
    })

    it('should get evidence package data', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/${evidenceClaimId}/evidence-package`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.claim).toBeDefined()
      expect(res.body.project).toBeDefined()
      expect(res.body.lots).toBeDefined()
      expect(Array.isArray(res.body.lots)).toBe(true)
    })

    it('should return 404 for non-existent claim', async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/claims/non-existent-id/evidence-package`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })

    afterAll(async () => {
      await prisma.claimedLot.deleteMany({ where: { claimId: evidenceClaimId } })
      await prisma.progressClaim.delete({ where: { id: evidenceClaimId } }).catch(() => {})
    })
  })

  describe('Claim Number Auto-Increment', () => {
    it('should auto-increment claim numbers', async () => {
      // Create another lot for second claim
      const autoLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `AUTO-LOT-${Date.now()}`,
          status: 'conformed',
          lotType: 'chainage',
          activityType: 'Earthworks',
          budgetAmount: 1000,
        }
      })

      const res = await request(app)
        .post(`/api/projects/${projectId}/claims`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          periodStart: '2025-03-01',
          periodEnd: '2025-03-31',
          lotIds: [autoLot.id],
        })

      expect(res.status).toBe(201)
      // Should be higher than claim #1 we created earlier (but could be 2, 100, etc. depending on cleanup)
      expect(res.body.claim.claimNumber).toBeGreaterThan(1)

      // Cleanup
      await prisma.claimedLot.deleteMany({ where: { claimId: res.body.claim.id } })
      await prisma.progressClaim.delete({ where: { id: res.body.claim.id } }).catch(() => {})
    })
  })
})

describe('Claim Lots Association', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Claim Lots Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `claim-lots-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Claim Lots User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'project_manager' }
    })

    const project = await prisma.project.create({
      data: {
        name: `Claim Lots Project ${Date.now()}`,
        projectNumber: `CLMLT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'project_manager', status: 'active' }
    })
  })

  afterAll(async () => {
    await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } })
    await prisma.progressClaim.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should mark lots as claimed when added to a claim', async () => {
    // Create conformed lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ASSOC-LOT-${Date.now()}`,
        status: 'conformed',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 1500,
      }
    })

    // Create claim with this lot
    const res = await request(app)
      .post(`/api/projects/${projectId}/claims`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        periodStart: '2025-04-01',
        periodEnd: '2025-04-30',
        lotIds: [lot.id],
      })

    expect(res.status).toBe(201)

    // Verify lot is now claimed
    const updatedLot = await prisma.lot.findUnique({
      where: { id: lot.id }
    })

    expect(updatedLot?.status).toBe('claimed')
    expect(updatedLot?.claimedInId).toBe(res.body.claim.id)
  })

  it('should not allow claiming non-conformed lots', async () => {
    // Create a lot that is not conformed
    const nonConformedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `NOT-CONF-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
        budgetAmount: 2000,
      }
    })

    const res = await request(app)
      .post(`/api/projects/${projectId}/claims`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        periodStart: '2025-05-01',
        periodEnd: '2025-05-31',
        lotIds: [nonConformedLot.id],
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('No valid conformed lots')
  })
})

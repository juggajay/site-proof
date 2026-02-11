import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import holdpoints router - named export
import { holdpointsRouter } from './holdpoints.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/holdpoints', holdpointsRouter)

describe('Hold Points API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let templateId: string
  let lotId: string
  let checklistItemId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `HP Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `hp-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'HP Test User',
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
        name: `HP Test Project ${Date.now()}`,
        projectNumber: `HP-${Date.now()}`,
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

    // Create template with a hold point item
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Hold Point Test Template',
        activityType: 'Earthworks',
      }
    })
    templateId = template.id

    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'Hold Point Item',
        pointType: 'hold_point',
        sequenceNumber: 1,
      }
    })
    checklistItemId = checklistItem.id

    // Create lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `HP-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id

    // Create ITP instance for the lot
    await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId,
        status: 'not_started',
      }
    })
  })

  afterAll(async () => {
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { itpChecklistItem: { templateId } } } })
    await prisma.holdPoint.deleteMany({ where: { itpChecklistItem: { templateId } } })
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId } } })
    await prisma.iTPInstance.deleteMany({ where: { lotId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } })
    await prisma.iTPTemplate.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/holdpoints/project/:projectId', () => {
    it('should list hold points for project', async () => {
      const res = await request(app)
        .get(`/api/holdpoints/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.holdPoints).toBeDefined()
      expect(Array.isArray(res.body.holdPoints)).toBe(true)
    })
  })

  describe('GET /api/holdpoints/lot/:lotId/item/:itemId', () => {
    it('should get hold point for specific lot and item', async () => {
      const res = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Returns hold point if exists, or creates/returns one
      expect([200, 404]).toContain(res.status)
    })
  })

  describe('POST /api/holdpoints/:id/release', () => {
    let holdPointId: string

    beforeAll(async () => {
      // Create a hold point record directly
      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          status: 'pending',
        }
      })
      holdPointId = hp.id
    })

    it('should release hold point with notes', async () => {
      const res = await request(app)
        .post(`/api/holdpoints/${holdPointId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          notes: 'Approved by QM',
        })

      expect(res.status).toBe(200)
      expect(res.body.holdPoint).toBeDefined()
      expect(res.body.holdPoint.status).toBe('released')
    })
  })
})

describe('Hold Point Token Release', () => {
  let companyId: string
  let projectId: string
  let lotId: string
  let templateId: string
  let holdPointId: string
  let releaseToken: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Token Test Company ${Date.now()}` }
    })
    companyId = company.id

    const project = await prisma.project.create({
      data: {
        name: `Token Test Project ${Date.now()}`,
        projectNumber: `TOK-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      }
    })
    projectId = project.id

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Token Test Template',
        activityType: 'Earthworks',
      }
    })
    templateId = template.id

    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'External Hold Point',
        pointType: 'hold_point',
        sequenceNumber: 1,
      }
    })

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TOK-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id

    // Create ITP instance for the lot (required for public token endpoint)
    await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId,
        status: 'not_started',
      }
    })

    // Create hold point
    const hp = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItem.id,
        pointType: 'hold_point',
        status: 'pending',
      }
    })
    holdPointId = hp.id

    // Create release token
    const token = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: `test-token-${Date.now()}`,
        recipientEmail: 'external@example.com',
        recipientName: 'External Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      }
    })
    releaseToken = token.token
  })

  afterAll(async () => {
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId } })
    await prisma.holdPoint.deleteMany({ where: { lotId } })
    await prisma.iTPInstance.deleteMany({ where: { lotId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } })
    await prisma.iTPTemplate.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  it('should get hold point by public token', async () => {
    const res = await request(app)
      .get(`/api/holdpoints/public/${releaseToken}`)

    expect(res.status).toBe(200)
    // API returns { evidencePackage: { holdPoint, lot, project, ... }, tokenInfo, isPublicAccess }
    expect(res.body.evidencePackage).toBeDefined()
    expect(res.body.evidencePackage.holdPoint).toBeDefined()
    expect(res.body.tokenInfo).toBeDefined()
  })

  it('should release hold point via public token', async () => {
    const res = await request(app)
      .post(`/api/holdpoints/public/${releaseToken}/release`)
      .send({
        releasedByName: 'External Reviewer',
        releasedByOrg: 'Client Company',
        notes: 'Approved externally',
      })

    expect(res.status).toBe(200)
    expect(res.body.holdPoint.status).toBe('released')
  })
})

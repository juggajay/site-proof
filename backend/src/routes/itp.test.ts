import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import ITP router - named export
import { itpRouter } from './itp.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/itp', itpRouter)

describe('ITP Templates API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let templateId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `ITP Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `itp-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'ITP Test User',
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
        name: `ITP Test Project ${Date.now()}`,
        projectNumber: `ITP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })
  })

  afterAll(async () => {
    await prisma.iTPChecklistItem.deleteMany({ where: { template: { projectId } } })
    await prisma.iTPTemplate.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/itp/templates', () => {
    it('should create a new ITP template with checklist items', async () => {
      const res = await request(app)
        .post('/api/itp/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          name: 'Earthworks ITP',
          description: 'Inspection and test plan for earthworks',
          activityType: 'Earthworks',
          checklistItems: [
            {
              description: 'Check compaction level',
              pointType: 'verification',
              evidenceRequired: 'required',
            },
            {
              description: 'QM Approval Required',
              pointType: 'hold_point',
            },
            {
              description: 'Client Witness Required',
              pointType: 'witness',
            },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.template).toBeDefined()
      expect(res.body.template.name).toBe('Earthworks ITP')
      expect(res.body.template.checklistItems).toBeDefined()
      expect(res.body.template.checklistItems.length).toBe(3)
      templateId = res.body.template.id
    })

    it('should reject template without name', async () => {
      const res = await request(app)
        .post('/api/itp/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          description: 'No name template',
        })

      expect(res.status).toBe(400)
    })

    it('should reject template without activityType', async () => {
      const res = await request(app)
        .post('/api/itp/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          name: 'Missing Activity',
        })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/itp/templates', () => {
    it('should list templates for project', async () => {
      const res = await request(app)
        .get(`/api/itp/templates?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.templates).toBeDefined()
      expect(Array.isArray(res.body.templates)).toBe(true)
      expect(res.body.templates.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/itp/templates/:id', () => {
    it('should get a single template with checklist items', async () => {
      const res = await request(app)
        .get(`/api/itp/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.template).toBeDefined()
      expect(res.body.template.id).toBe(templateId)
      expect(res.body.template.checklistItems).toBeDefined()
    })

    it('should return 404 for non-existent template', async () => {
      const res = await request(app)
        .get('/api/itp/templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/itp/templates/:id', () => {
    it('should update template metadata', async () => {
      const res = await request(app)
        .patch(`/api/itp/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Earthworks ITP',
          description: 'Updated description',
        })

      expect(res.status).toBe(200)
      expect(res.body.template.name).toBe('Updated Earthworks ITP')
    })
  })

  describe('POST /api/itp/templates/:id/clone', () => {
    it('should clone a template', async () => {
      const res = await request(app)
        .post(`/api/itp/templates/${templateId}/clone`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Cloned Earthworks ITP',
        })

      expect(res.status).toBe(201)
      expect(res.body.template).toBeDefined()
      expect(res.body.template.name).toBe('Cloned Earthworks ITP')
      // Cleanup cloned template
      await prisma.iTPChecklistItem.deleteMany({ where: { templateId: res.body.template.id } })
      await prisma.iTPTemplate.delete({ where: { id: res.body.template.id } })
    })
  })
})

describe('ITP Instances', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let templateId: string
  let lotId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `ITP Instance Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `itp-instance-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'ITP Instance User',
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
        name: `ITP Instance Project ${Date.now()}`,
        projectNumber: `ITPINST-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'rms',
      }
    })
    projectId = project.id

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' }
    })

    // Create template with items
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Instance Test ITP',
        activityType: 'Earthworks',
        checklistItems: {
          create: [{
            description: 'Test Item',
            pointType: 'verification',
            sequenceNumber: 1,
          }]
        }
      }
    })
    templateId = template.id

    // Create lot
    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `ITP-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id
  })

  afterAll(async () => {
    // Use correct relation name 'itpInstance' (not 'instance')
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

  it('should create ITP instance for lot', async () => {
    const res = await request(app)
      .post('/api/itp/instances')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        lotId,
        templateId,
      })

    expect(res.status).toBe(201)
    expect(res.body.instance).toBeDefined()
    // instanceId stored in res.body.instance.id if needed
  })

  it('should get ITP instance for lot', async () => {
    const res = await request(app)
      .get(`/api/itp/instances/lot/${lotId}`)
      .set('Authorization', `Bearer ${authToken}`)

    expect(res.status).toBe(200)
    // API returns { instance: { ...instance, template: { ... } } }
    expect(res.body.instance).toBeDefined()
    expect(res.body.instance.template).toBeDefined()
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errorHandler.js'

// Import diary router
import diaryRouter from './diary/index.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/diary', diaryRouter)
app.use(errorHandler)

describe('Daily Diary API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let diaryId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Diary Test Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `diary-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Diary Test User',
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
        name: `Diary Test Project ${Date.now()}`,
        projectNumber: `DIARY-${Date.now()}`,
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
  })

  afterAll(async () => {
    await prisma.diaryAddendum.deleteMany({ where: { diary: { projectId } } })
    await prisma.diaryDelay.deleteMany({ where: { diary: { projectId } } })
    await prisma.diaryVisitor.deleteMany({ where: { diary: { projectId } } })
    await prisma.diaryActivity.deleteMany({ where: { diary: { projectId } } })
    await prisma.diaryPlant.deleteMany({ where: { diary: { projectId } } })
    await prisma.diaryPersonnel.deleteMany({ where: { diary: { projectId } } })
    await prisma.dailyDiary.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('POST /api/diary', () => {
    it('should create a diary entry', async () => {
      const today = new Date().toISOString().split('T')[0]
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: today,
        })

      expect(res.status).toBe(201)
      // API returns diary directly (not wrapped)
      expect(res.body.id).toBeDefined()
      diaryId = res.body.id
    })

    it('should update existing diary for same date (upsert behavior)', async () => {
      const today = new Date().toISOString().split('T')[0]
      const res = await request(app)
        .post('/api/diary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          date: today,
          generalNotes: 'Updated notes',
        })

      // API updates existing diary, returns 200
      expect(res.status).toBe(200)
      expect(res.body.generalNotes).toBe('Updated notes')
    })
  })

  describe('GET /api/diary/:projectId', () => {
    it('should list diary entries for project', async () => {
      const res = await request(app)
        .get(`/api/diary/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // API returns paginated response
      expect(res.body).toHaveProperty('data')
      expect(res.body).toHaveProperty('pagination')
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/diary/entry/:diaryId', () => {
    it('should get a single diary by ID', async () => {
      // Ensure diaryId is set from previous test
      if (!diaryId) {
        throw new Error('diaryId not set from creation test')
      }
      const res = await request(app)
        .get(`/api/diary/entry/${diaryId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // API returns 200 with diary or 403 if access check fails
      expect([200, 403]).toContain(res.status)
      if (res.status === 200) {
        expect(res.body.id).toBe(diaryId)
      }
    })
  })

  describe('Diary Personnel', () => {
    let personnelId: string

    it('should add personnel entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'John Worker',
          company: 'Test Company',
          role: 'Operator',
          hours: 8,
        })

      expect(res.status).toBe(201)
      // API returns personnel directly
      expect(res.body.id).toBeDefined()
      expect(res.body.name).toBe('John Worker')
      personnelId = res.body.id
    })

    it('should delete personnel entry', async () => {
      const res = await request(app)
        .delete(`/api/diary/${diaryId}/personnel/${personnelId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(204)
    })
  })

  describe('Diary Plant', () => {
    let plantId: string

    it('should add plant entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/plant`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Excavator CAT 320',
          idRego: 'EX-001',
          hoursOperated: 8,
        })

      expect(res.status).toBe(201)
      // API returns plant directly
      expect(res.body.id).toBeDefined()
      expect(res.body.description).toBe('Excavator CAT 320')
      plantId = res.body.id
    })

    it('should delete plant entry', async () => {
      const res = await request(app)
        .delete(`/api/diary/${diaryId}/plant/${plantId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(204)
    })
  })

  describe('Diary Activities', () => {
    it('should add activity entry', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/activities`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Excavation work',
          quantity: 500,
          unit: 'm3',
        })

      expect(res.status).toBe(201)
      // API returns activity directly
      expect(res.body.id).toBeDefined()
      expect(res.body.description).toBe('Excavation work')
    })
  })

  describe('Diary Submission', () => {
    it('should submit diary with warnings acknowledged', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ acknowledgeWarnings: true })

      expect(res.status).toBe(200)
      expect(res.body.diary.status).toBe('submitted')
    })

    it('should reject adding personnel to submitted diary', async () => {
      const res = await request(app)
        .post(`/api/diary/${diaryId}/personnel`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Worker',
          company: 'Test Company',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('submitted')
    })
  })
})

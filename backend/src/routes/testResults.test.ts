import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

// Import test results router
import { testResultsRouter } from './testResults.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/test-results', testResultsRouter)

describe('Test Results API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let projectId: string
  let lotId: string
  let testResultId: string

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Test Results Company ${Date.now()}` }
    })
    companyId = company.id

    const testEmail = `testresults-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Test Results User',
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
        name: `Test Results Project ${Date.now()}`,
        projectNumber: `TR-${Date.now()}`,
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

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TR-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      }
    })
    lotId = lot.id
  })

  afterAll(async () => {
    await prisma.testResult.deleteMany({ where: { projectId } })
    await prisma.lot.deleteMany({ where: { projectId } })
    await prisma.projectUser.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  describe('GET /api/test-results/specifications', () => {
    it('should get all test specifications', async () => {
      const res = await request(app)
        .get('/api/test-results/specifications')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.specifications).toBeDefined()
      expect(Array.isArray(res.body.specifications)).toBe(true)
    })
  })

  describe('GET /api/test-results/specifications/:testType', () => {
    it('should get specification for a specific test type', async () => {
      const res = await request(app)
        .get('/api/test-results/specifications/compaction')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.testType).toBe('compaction')
      expect(res.body.name).toBeDefined()
      expect(res.body.specificationMin).toBeDefined()
    })

    it('should return 404 for unknown test type', async () => {
      const res = await request(app)
        .get('/api/test-results/specifications/unknown_test_type')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/test-results', () => {
    it('should create a new test result', async () => {
      const res = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          lotId,
          testType: 'Compaction Test',
          laboratoryName: 'ABC Testing Labs',
          sampleDate: new Date().toISOString().split('T')[0],
        })

      expect(res.status).toBe(201)
      expect(res.body.testResult).toBeDefined()
      expect(res.body.testResult.testType).toBe('Compaction Test')
      testResultId = res.body.testResult.id
    })

    it('should reject test result without required fields', async () => {
      const res = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          // missing testType
        })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/test-results', () => {
    it('should list test results for project', async () => {
      const res = await request(app)
        .get(`/api/test-results?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.testResults).toBeDefined()
      expect(Array.isArray(res.body.testResults)).toBe(true)
    })

    it('should filter by lotId', async () => {
      const res = await request(app)
        .get(`/api/test-results?projectId=${projectId}&lotId=${lotId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.testResults).toBeDefined()
    })

    it('should require projectId', async () => {
      const res = await request(app)
        .get('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/test-results/:id', () => {
    it('should get a single test result', async () => {
      const res = await request(app)
        .get(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.testResult).toBeDefined()
      expect(res.body.testResult.id).toBe(testResultId)
    })

    it('should return 404 for non-existent test result', async () => {
      const res = await request(app)
        .get('/api/test-results/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/test-results/:id', () => {
    it('should update a test result', async () => {
      const res = await request(app)
        .patch(`/api/test-results/${testResultId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resultValue: '97.5',
          resultUnit: '% MDD',
          passFail: 'pass',
        })

      expect(res.status).toBe(200)
      expect(res.body.testResult).toBeDefined()
    })
  })

  describe('GET /api/test-results/:id/workflow', () => {
    it('should get workflow status', async () => {
      const res = await request(app)
        .get(`/api/test-results/${testResultId}/workflow`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.workflow).toBeDefined()
      expect(res.body.workflow.currentStatus).toBeDefined()
      expect(res.body.workflow.steps).toBeDefined()
    })
  })

  describe('POST /api/test-results/:id/status', () => {
    it('should update test result status', async () => {
      const res = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'at_lab',
        })

      expect(res.status).toBe(200)
      expect(res.body.testResult.status).toBe('at_lab')
    })

    it('should reject invalid status transition', async () => {
      const res = await request(app)
        .post(`/api/test-results/${testResultId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'verified', // Can't go directly to verified
        })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/test-results/:id', () => {
    it('should delete a test result', async () => {
      // Create a new test result to delete
      const createRes = await request(app)
        .post('/api/test-results')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId,
          testType: 'CBR Test',
        })

      const newId = createRes.body.testResult.id

      const res = await request(app)
        .delete(`/api/test-results/${newId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('deleted')
    })
  })
})

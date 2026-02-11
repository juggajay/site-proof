import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import webhooksRouter, { webhookConfigs } from './webhooks.js'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/webhooks', webhooksRouter)
app.use(errorHandler)

describe('Webhooks API', () => {
  let authToken: string
  let userId: string
  let companyId: string
  let webhookId: string

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Webhooks Test Company ${Date.now()}` }
    })
    companyId = company.id

    // Create test user
    const testEmail = `webhooks-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Webhooks Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' }
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {})
  })

  beforeEach(() => {
    // Clear webhook configs between tests
    webhookConfigs.clear()
  })

  describe('Public Endpoints - Test Receiver', () => {
    beforeEach(async () => {
      // Clear test receiver logs before each test
      await request(app).delete('/api/webhooks/test-receiver/logs')
    })

    describe('POST /api/webhooks/test-receiver', () => {
      it('should receive webhook without authentication', async () => {
        const payload = { test: 'data', value: 123 }
        const res = await request(app)
          .post('/api/webhooks/test-receiver')
          .send(payload)

        expect(res.status).toBe(200)
        expect(res.body.received).toBe(true)
        expect(res.body.id).toBeDefined()
        expect(res.body.timestamp).toBeDefined()
      })

      it('should capture webhook signature header', async () => {
        const signature = 'test-signature-abc123'
        const res = await request(app)
          .post('/api/webhooks/test-receiver')
          .set('x-webhook-signature', signature)
          .send({ data: 'test' })

        expect(res.status).toBe(200)
        expect(res.body.received).toBe(true)

        // Verify signature was captured
        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=1')
        expect(logsRes.body.logs[0].signature).toBe(signature)
      })

      it('should handle missing signature header', async () => {
        const res = await request(app)
          .post('/api/webhooks/test-receiver')
          .send({ data: 'test' })

        expect(res.status).toBe(200)

        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=1')
        expect(logsRes.body.logs[0].signature).toBeNull()
      })
    })

    describe('GET /api/webhooks/test-receiver/logs', () => {
      it('should retrieve received webhook logs', async () => {
        // Send a test webhook
        await request(app)
          .post('/api/webhooks/test-receiver')
          .send({ test: 'data' })

        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs')

        expect(res.status).toBe(200)
        expect(res.body.logs).toBeDefined()
        expect(Array.isArray(res.body.logs)).toBe(true)
        expect(res.body.total).toBeGreaterThan(0)
        expect(res.body.message).toContain('received webhooks')
      })

      it('should limit returned logs', async () => {
        // Send multiple webhooks
        await request(app).post('/api/webhooks/test-receiver').send({ msg: 1 })
        await request(app).post('/api/webhooks/test-receiver').send({ msg: 2 })
        await request(app).post('/api/webhooks/test-receiver').send({ msg: 3 })

        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=2')

        expect(res.status).toBe(200)
        expect(res.body.logs.length).toBeLessThanOrEqual(2)
      })

      it('should default to limit of 10', async () => {
        // Send a webhook first to have data
        await request(app)
          .post('/api/webhooks/test-receiver')
          .send({ test: 'data' })

        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs')

        expect(res.status).toBe(200)
        expect(res.body.message).toMatch(/Showing last \d+ received webhooks/)
      })
    })

    describe('DELETE /api/webhooks/test-receiver/logs', () => {
      it('should clear test webhook logs', async () => {
        // Send a test webhook
        await request(app)
          .post('/api/webhooks/test-receiver')
          .send({ test: 'data' })

        // Clear logs
        const res = await request(app)
          .delete('/api/webhooks/test-receiver/logs')

        expect(res.status).toBe(200)
        expect(res.body.message).toContain('cleared')

        // Verify logs are empty
        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs')
        expect(logsRes.body.total).toBe(0)
      })
    })
  })

  describe('Protected Endpoints - Webhook Management', () => {
    describe('POST /api/webhooks', () => {
      it('should create a webhook configuration', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['lot.created', 'lot.updated'],
          })

        expect(res.status).toBe(201)
        expect(res.body.id).toBeDefined()
        expect(res.body.url).toBe('https://example.com/webhook')
        expect(res.body.secret).toBeDefined()
        expect(res.body.events).toEqual(['lot.created', 'lot.updated'])
        expect(res.body.enabled).toBe(true)
        expect(res.body.createdAt).toBeDefined()
        expect(res.body.message).toMatch(/[Ss]ave the secret/)

        webhookId = res.body.id
      })

      it('should default to wildcard events if not specified', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
          })

        expect(res.status).toBe(201)
        expect(res.body.events).toEqual(['*'])
      })

      it('should require URL', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            events: ['test'],
          })

        expect(res.status).toBe(400)
        expect(res.body.error.message).toContain('URL')
      })

      it('should validate URL format', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'not-a-valid-url',
          })

        expect(res.status).toBe(400)
        expect(res.body.error.message).toContain('Invalid URL')
      })

      it('should require authentication', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .send({
            url: 'https://example.com/webhook',
          })

        expect(res.status).toBe(401)
      })

      it('should require company context', async () => {
        // Create user without company
        const noCompanyEmail = `no-company-${Date.now()}@example.com`
        const noCompanyRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: noCompanyEmail,
            password: 'SecureP@ssword123!',
            fullName: 'No Company User',
            tosAccepted: true,
          })
        const noCompanyToken = noCompanyRes.body.token
        const noCompanyUserId = noCompanyRes.body.user.id

        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${noCompanyToken}`)
          .send({
            url: 'https://example.com/webhook',
          })

        expect(res.status).toBe(403)
        expect(res.body.error.message).toContain('Company context required')

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: noCompanyUserId } })
        await prisma.user.delete({ where: { id: noCompanyUserId } })
      })
    })

    describe('GET /api/webhooks', () => {
      beforeEach(async () => {
        // Create a test webhook
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          })
        webhookId = res.body.id
      })

      it('should list webhooks for the company', async () => {
        const res = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        expect(res.body.webhooks).toBeDefined()
        expect(Array.isArray(res.body.webhooks)).toBe(true)
        expect(res.body.webhooks.length).toBeGreaterThan(0)
      })

      it('should mask webhook secrets in listing', async () => {
        const res = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        const webhook = res.body.webhooks.find((w: any) => w.id === webhookId)
        expect(webhook.secret).toBe('****')
      })

      it('should only return webhooks for user company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` }
        })
        const otherEmail = `other-${Date.now()}@example.com`
        const otherRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Other User',
            tosAccepted: true,
          })
        const otherToken = otherRes.body.token
        const otherUserId = otherRes.body.user.id

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' }
        })

        const res = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${otherToken}`)

        expect(res.status).toBe(200)
        expect(res.body.webhooks.length).toBe(0)

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
        await prisma.user.delete({ where: { id: otherUserId } })
        await prisma.company.delete({ where: { id: company2.id } })
      })
    })

    describe('GET /api/webhooks/:id', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['test.event'],
          })
        webhookId = res.body.id
      })

      it('should get a specific webhook', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        expect(res.body.id).toBe(webhookId)
        expect(res.body.url).toBe('https://example.com/webhook')
        expect(res.body.secret).toBe('****') // Masked
      })

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .get('/api/webhooks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(404)
        expect(res.body.error.message).toContain('not found')
      })

      it('should deny access to webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` }
        })
        const otherEmail = `other-${Date.now()}@example.com`
        const otherRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Other User',
            tosAccepted: true,
          })
        const otherToken = otherRes.body.token
        const otherUserId = otherRes.body.user.id

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' }
        })

        const res = await request(app)
          .get(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${otherToken}`)

        expect(res.status).toBe(403)
        expect(res.body.error.message).toContain('Access denied')

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
        await prisma.user.delete({ where: { id: otherUserId } })
        await prisma.company.delete({ where: { id: company2.id } })
      })
    })

    describe('PATCH /api/webhooks/:id', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          })
        webhookId = res.body.id
      })

      it('should update webhook URL', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://updated.example.com/webhook',
          })

        expect(res.status).toBe(200)
        expect(res.body.url).toBe('https://updated.example.com/webhook')
      })

      it('should update webhook events', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            events: ['lot.created', 'lot.deleted'],
          })

        expect(res.status).toBe(200)
        expect(res.body.events).toEqual(['lot.created', 'lot.deleted'])
      })

      it('should enable/disable webhook', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
          })

        expect(res.status).toBe(200)
        expect(res.body.enabled).toBe(false)
      })

      it('should validate URL format when updating', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'invalid-url',
          })

        expect(res.status).toBe(400)
        expect(res.body.error.message).toContain('Invalid URL')
      })

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .patch('/api/webhooks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
          })

        expect(res.status).toBe(404)
      })

      it('should mask secret in response', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
          })

        expect(res.status).toBe(200)
        expect(res.body.secret).toBe('****')
      })
    })

    describe('DELETE /api/webhooks/:id', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          })
        webhookId = res.body.id
      })

      it('should delete a webhook', async () => {
        const res = await request(app)
          .delete(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(204)

        // Verify webhook is deleted
        const getRes = await request(app)
          .get(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
        expect(getRes.status).toBe(404)
      })

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .delete('/api/webhooks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(404)
      })

      it('should deny deletion of webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` }
        })
        const otherEmail = `other-${Date.now()}@example.com`
        const otherRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Other User',
            tosAccepted: true,
          })
        const otherToken = otherRes.body.token
        const otherUserId = otherRes.body.user.id

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' }
        })

        const res = await request(app)
          .delete(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${otherToken}`)

        expect(res.status).toBe(403)

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
        await prisma.user.delete({ where: { id: otherUserId } })
        await prisma.company.delete({ where: { id: company2.id } })
      })
    })

    describe('POST /api/webhooks/:id/regenerate-secret', () => {
      let originalSecret: string

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          })
        webhookId = res.body.id
        originalSecret = res.body.secret
      })

      it('should regenerate webhook secret', async () => {
        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/regenerate-secret`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        expect(res.body.id).toBe(webhookId)
        expect(res.body.secret).toBeDefined()
        expect(res.body.secret).not.toBe(originalSecret)
        expect(res.body.message).toContain('regenerated')
      })

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .post('/api/webhooks/non-existent-id/regenerate-secret')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(404)
      })

      it('should deny regeneration for webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` }
        })
        const otherEmail = `other-${Date.now()}@example.com`
        const otherRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Other User',
            tosAccepted: true,
          })
        const otherToken = otherRes.body.token
        const otherUserId = otherRes.body.user.id

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' }
        })

        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/regenerate-secret`)
          .set('Authorization', `Bearer ${otherToken}`)

        expect(res.status).toBe(403)

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
        await prisma.user.delete({ where: { id: otherUserId } })
        await prisma.company.delete({ where: { id: company2.id } })
      })
    })

    describe('GET /api/webhooks/:id/deliveries', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          })
        webhookId = res.body.id
      })

      it('should get delivery history for a webhook', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        expect(res.body.deliveries).toBeDefined()
        expect(Array.isArray(res.body.deliveries)).toBe(true)
        expect(res.body.total).toBeDefined()
      })

      it('should support limit parameter', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries?limit=5`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        expect(res.body.deliveries).toBeDefined()
      })

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .get('/api/webhooks/non-existent-id/deliveries')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(404)
      })

      it('should deny access to deliveries from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` }
        })
        const otherEmail = `other-${Date.now()}@example.com`
        const otherRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Other User',
            tosAccepted: true,
          })
        const otherToken = otherRes.body.token
        const otherUserId = otherRes.body.user.id

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' }
        })

        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries`)
          .set('Authorization', `Bearer ${otherToken}`)

        expect(res.status).toBe(403)

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
        await prisma.user.delete({ where: { id: otherUserId } })
        await prisma.company.delete({ where: { id: company2.id } })
      })
    })

    describe('POST /api/webhooks/:id/test', () => {
      beforeEach(async () => {
        // Clear test receiver logs
        await request(app).delete('/api/webhooks/test-receiver/logs')

        // Create webhook pointing to test receiver
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'http://localhost:3001/api/webhooks/test-receiver',
            events: ['*'],
          })
        webhookId = res.body.id
      })

      it('should send a test webhook', async () => {
        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/test`)
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(200)
        expect(res.body.success).toBeDefined()
        expect(res.body.deliveryId).toBeDefined()
        expect(res.body.responseStatus).toBeDefined()
      })

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .post('/api/webhooks/non-existent-id/test')
          .set('Authorization', `Bearer ${authToken}`)

        expect(res.status).toBe(404)
      })

      it('should deny testing webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` }
        })
        const otherEmail = `other-${Date.now()}@example.com`
        const otherRes = await request(app)
          .post('/api/auth/register')
          .send({
            email: otherEmail,
            password: 'SecureP@ssword123!',
            fullName: 'Other User',
            tosAccepted: true,
          })
        const otherToken = otherRes.body.token
        const otherUserId = otherRes.body.user.id

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' }
        })

        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/test`)
          .set('Authorization', `Bearer ${otherToken}`)

        expect(res.status).toBe(403)

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
        await prisma.user.delete({ where: { id: otherUserId } })
        await prisma.company.delete({ where: { id: company2.id } })
      })
    })
  })
})

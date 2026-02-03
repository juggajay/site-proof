import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { supportRouter } from './support.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/support', supportRouter)

describe('Support API', () => {
  describe('POST /api/support/request', () => {
    it('should submit support request with valid data', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Need help with lot creation',
          message: 'I am unable to create a new lot in my project. The form keeps showing an error.',
          category: 'technical',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('successfully')
      expect(res.body.ticketId).toBeDefined()
      expect(res.body.ticketId).toMatch(/^SP-/)
    })

    it('should submit support request with user email', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Billing question',
          message: 'I have a question about my invoice for last month.',
          category: 'billing',
          userEmail: 'user@example.com',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.ticketId).toBeDefined()
    })

    it('should reject request without subject', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          message: 'This is a message without a subject',
          category: 'general',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should reject request without message', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Subject without message',
          category: 'general',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should reject request with empty subject', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: '',
          message: 'This has an empty subject',
          category: 'general',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should reject request with empty message', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Valid subject',
          message: '',
          category: 'general',
        })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('required')
    })

    it('should accept request without category', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Request without category',
          message: 'Category is optional',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should accept request without user email', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Anonymous support request',
          message: 'This request does not include user email',
          category: 'general',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('POST /api/support/request with audit logging', () => {
    let userId: string
    const testEmail = `support-test-${Date.now()}@example.com`

    beforeAll(async () => {
      // Create test user for audit log testing
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Support Test User',
          tosAccepted: true,
        })
      userId = regRes.body.user.id
    })

    afterAll(async () => {
      // Clean up audit logs and user
      await prisma.auditLog.deleteMany({ where: { userId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    })

    it('should create audit log when user email is provided and exists', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Test audit logging',
          message: 'This request should create an audit log entry for the authenticated user.',
          category: 'technical',
          userEmail: testEmail,
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Verify audit log was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId,
          action: 'SUPPORT_REQUEST_SUBMITTED',
          entityType: 'support_request',
        },
      })

      expect(auditLog).toBeDefined()
      expect(auditLog?.entityId).toMatch(/^SP-/)

      const changes = JSON.parse(auditLog!.changes)
      expect(changes.subject).toBe('Test audit logging')
      expect(changes.category).toBe('technical')
      expect(changes.messagePreview).toBeDefined()
    })

    it('should truncate long messages in audit log', async () => {
      const longMessage = 'A'.repeat(200) // 200 characters

      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Long message test',
          message: longMessage,
          category: 'general',
          userEmail: testEmail,
        })

      expect(res.status).toBe(200)

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          userId,
          action: 'SUPPORT_REQUEST_SUBMITTED',
        },
        orderBy: { createdAt: 'desc' },
      })

      const changes = JSON.parse(auditLog!.changes)
      expect(changes.messagePreview.length).toBe(100)
    })

    it('should not fail request if audit logging fails', async () => {
      // Submit with non-existent user email
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Test with non-existent user',
          message: 'This should succeed even though audit logging will fail',
          category: 'general',
          userEmail: 'nonexistent@example.com',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/support/contact', () => {
    it('should return support contact information', async () => {
      const res = await request(app)
        .get('/api/support/contact')

      expect(res.status).toBe(200)
      expect(res.body.email).toBeDefined()
      expect(res.body.phone).toBeDefined()
      expect(res.body.phoneLabel).toBeDefined()
      expect(res.body.emergencyPhone).toBeDefined()
      expect(res.body.address).toBeDefined()
      expect(res.body.hours).toBeDefined()
      expect(res.body.responseTime).toBeDefined()
    })

    it('should include proper email format', async () => {
      const res = await request(app)
        .get('/api/support/contact')

      expect(res.status).toBe(200)
      expect(res.body.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    })

    it('should include response time information', async () => {
      const res = await request(app)
        .get('/api/support/contact')

      expect(res.status).toBe(200)
      expect(res.body.responseTime.critical).toBeDefined()
      expect(res.body.responseTime.standard).toBeDefined()
      expect(res.body.responseTime.general).toBeDefined()
    })

    it('should return consistent contact information', async () => {
      const res1 = await request(app).get('/api/support/contact')
      const res2 = await request(app).get('/api/support/contact')

      expect(res1.body).toEqual(res2.body)
    })
  })

  describe('Support request ticket ID generation', () => {
    it('should generate unique ticket IDs', async () => {
      const res1 = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'First request',
          message: 'First message',
        })

      const res2 = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Second request',
          message: 'Second message',
        })

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res1.body.ticketId).not.toBe(res2.body.ticketId)
    })

    it('should use SP- prefix for ticket IDs', async () => {
      const res = await request(app)
        .post('/api/support/request')
        .send({
          subject: 'Ticket ID test',
          message: 'Testing ticket ID format',
        })

      expect(res.status).toBe(200)
      expect(res.body.ticketId).toMatch(/^SP-\d+$/)
    })
  })
})

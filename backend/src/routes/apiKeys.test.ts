import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import apiKeysRouter from './apiKeys.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/api-keys', apiKeysRouter)

describe('API Keys Management', () => {
  let authToken: string
  let userId: string
  let apiKeyId: string
  let generatedApiKey: string

  beforeAll(async () => {
    // Create test user
    const testEmail = `apikeys-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'API Keys Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id
  })

  afterAll(async () => {
    // Clean up API keys
    await prisma.apiKey.deleteMany({ where: { userId } })
    // Clean up user
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  describe('POST /api/api-keys', () => {
    it('should create a new API key with valid data', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test API Key',
          scopes: 'read',
        })

      expect(res.status).toBe(201)
      expect(res.body.apiKey).toBeDefined()
      expect(res.body.apiKey.id).toBeDefined()
      expect(res.body.apiKey.name).toBe('Test API Key')
      expect(res.body.apiKey.key).toBeDefined()
      expect(res.body.apiKey.key).toMatch(/^sp_[a-f0-9]{64}$/)
      expect(res.body.apiKey.keyPrefix).toBeDefined()
      expect(res.body.apiKey.keyPrefix).toBe(res.body.apiKey.key.substring(0, 11))
      expect(res.body.apiKey.scopes).toBe('read')
      expect(res.body.message).toContain('Save this key securely')

      // Store for later tests
      apiKeyId = res.body.apiKey.id
      generatedApiKey = res.body.apiKey.key
    })

    it('should create API key with expiration', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Expiring Key',
          scopes: 'read,write',
          expiresInDays: 30,
        })

      expect(res.status).toBe(201)
      expect(res.body.apiKey.expiresAt).toBeDefined()
      const expiresAt = new Date(res.body.apiKey.expiresAt)
      const expectedDate = new Date()
      expectedDate.setDate(expectedDate.getDate() + 30)

      // Check expiry is within 1 day of expected (to account for test execution time)
      const diff = Math.abs(expiresAt.getTime() - expectedDate.getTime())
      expect(diff).toBeLessThan(24 * 60 * 60 * 1000)

      // Cleanup
      await prisma.apiKey.delete({ where: { id: res.body.apiKey.id } })
    })

    it('should create API key with default scopes if not provided', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Default Scopes Key',
        })

      expect(res.status).toBe(201)
      expect(res.body.apiKey.scopes).toBe('read')

      // Cleanup
      await prisma.apiKey.delete({ where: { id: res.body.apiKey.id } })
    })

    it('should reject API key creation without name', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scopes: 'read',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request')
    })

    it('should reject API key creation with empty name', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          scopes: 'read',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request')
    })

    it('should reject API key creation with name too long', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'a'.repeat(101),
          scopes: 'read',
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid request')
    })

    it('should reject API key creation without authentication', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .send({
          name: 'Unauthenticated Key',
          scopes: 'read',
        })

      expect(res.status).toBe(401)
    })

    it('should not create API key with zero expiration days', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Zero Expiry Key',
          scopes: 'read',
          expiresInDays: 0,
        })

      expect(res.status).toBe(201)
      expect(res.body.apiKey.expiresAt).toBeNull()

      // Cleanup
      await prisma.apiKey.delete({ where: { id: res.body.apiKey.id } })
    })

    it('should not create API key with negative expiration days', async () => {
      const res = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Negative Expiry Key',
          scopes: 'read',
          expiresInDays: -1,
        })

      expect(res.status).toBe(201)
      expect(res.body.apiKey.expiresAt).toBeNull()

      // Cleanup
      await prisma.apiKey.delete({ where: { id: res.body.apiKey.id } })
    })
  })

  describe('GET /api/api-keys', () => {
    it('should list user API keys', async () => {
      const res = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.apiKeys).toBeDefined()
      expect(Array.isArray(res.body.apiKeys)).toBe(true)
      expect(res.body.apiKeys.length).toBeGreaterThan(0)

      // Verify the key we created is in the list
      const ourKey = res.body.apiKeys.find((k: any) => k.id === apiKeyId)
      expect(ourKey).toBeDefined()
      expect(ourKey.name).toBe('Test API Key')
      expect(ourKey.keyPrefix).toBeDefined()
      expect(ourKey.scopes).toBe('read')
      expect(ourKey.isActive).toBe(true)
      expect(ourKey.createdAt).toBeDefined()

      // Verify the actual key is NOT returned in list
      expect(ourKey.key).toBeUndefined()
      expect(ourKey.keyHash).toBeUndefined()
    })

    it('should include lastUsedAt and expiresAt fields in list', async () => {
      const res = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const key = res.body.apiKeys[0]
      expect(key).toHaveProperty('lastUsedAt')
      expect(key).toHaveProperty('expiresAt')
    })

    it('should return keys ordered by creation date (newest first)', async () => {
      // Create another key
      const newKeyRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Newer Key',
          scopes: 'read',
        })

      const newKeyId = newKeyRes.body.apiKey.id

      const res = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.apiKeys.length).toBeGreaterThanOrEqual(2)

      // Verify ordering (newest first)
      const dates = res.body.apiKeys.map((k: any) => new Date(k.createdAt).getTime())
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i])
      }

      // Cleanup
      await prisma.apiKey.delete({ where: { id: newKeyId } })
    })

    it('should reject listing API keys without authentication', async () => {
      const res = await request(app)
        .get('/api/api-keys')

      expect(res.status).toBe(401)
    })

    it('should only return keys belonging to the authenticated user', async () => {
      // Create another user
      const otherUserEmail = `other-user-${Date.now()}@example.com`
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherUserEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        })
      const otherUserId = otherUserRes.body.user.id
      const otherToken = otherUserRes.body.token

      // Create API key for other user
      const otherKeyRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Other User Key',
          scopes: 'read',
        })

      // List keys for original user
      const res = await request(app)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)

      // Verify other user's key is not in the list
      const otherKey = res.body.apiKeys.find((k: any) => k.id === otherKeyRes.body.apiKey.id)
      expect(otherKey).toBeUndefined()

      // Cleanup
      await prisma.apiKey.deleteMany({ where: { userId: otherUserId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } })
    })
  })

  describe('DELETE /api/api-keys/:keyId', () => {
    it('should revoke an API key', async () => {
      // Create a key to revoke
      const createRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Key to Revoke',
          scopes: 'read',
        })

      const keyId = createRes.body.apiKey.id

      // Revoke it
      const res = await request(app)
        .delete(`/api/api-keys/${keyId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('revoked successfully')

      // Verify it's marked as inactive
      const updatedKey = await prisma.apiKey.findUnique({
        where: { id: keyId },
      })
      expect(updatedKey?.isActive).toBe(false)

      // Cleanup
      await prisma.apiKey.delete({ where: { id: keyId } })
    })

    it('should reject revoking non-existent API key', async () => {
      const res = await request(app)
        .delete('/api/api-keys/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('not found')
    })

    it('should reject revoking another user\'s API key', async () => {
      // Create another user
      const otherUserEmail = `other-user-revoke-${Date.now()}@example.com`
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherUserEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        })
      const otherUserId = otherUserRes.body.user.id
      const otherToken = otherUserRes.body.token

      // Create API key for other user
      const otherKeyRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Other User Key to Protect',
          scopes: 'read',
        })

      const otherKeyId = otherKeyRes.body.apiKey.id

      // Try to revoke other user's key with our token
      const res = await request(app)
        .delete(`/api/api-keys/${otherKeyId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('not found')

      // Verify key is still active
      const key = await prisma.apiKey.findUnique({
        where: { id: otherKeyId },
      })
      expect(key?.isActive).toBe(true)

      // Cleanup
      await prisma.apiKey.deleteMany({ where: { userId: otherUserId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } })
    })

    it('should reject revoking without authentication', async () => {
      const res = await request(app)
        .delete(`/api/api-keys/${apiKeyId}`)

      expect(res.status).toBe(401)
    })
  })

  describe('API Key Authentication Middleware', () => {
    it('should authenticate requests with valid API key via x-api-key header', async () => {
      // Create a simple test route to verify authentication
      const testApp = express()
      testApp.use(express.json())

      // Import and use the authenticateApiKey middleware
      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (req, res) => {
        res.json({ userId: (req as any).user.id })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', generatedApiKey)

      expect(res.status).toBe(200)
      expect(res.body.userId).toBe(userId)
    })

    it('should authenticate requests with valid API key via Authorization header', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (req, res) => {
        res.json({ userId: (req as any).user.id })
      })

      const res = await request(testApp)
        .get('/test')
        .set('Authorization', `ApiKey ${generatedApiKey}`)

      expect(res.status).toBe(200)
      expect(res.body.userId).toBe(userId)
    })

    it('should reject requests with invalid API key', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', 'sp_invalid_key_123')

      expect(res.status).toBe(401)
      expect(res.body.error).toContain('Invalid or expired')
    })

    it('should set apiKey property on request when authenticated with API key', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (req, res) => {
        const apiKey = (req as any).apiKey
        res.json({
          hasApiKey: !!apiKey,
          scopes: apiKey?.scopes,
        })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', generatedApiKey)

      expect(res.status).toBe(200)
      expect(res.body.hasApiKey).toBe(true)
      expect(res.body.scopes).toEqual(['read'])
    })

    it('should reject requests with revoked API key', async () => {
      // Create a key to revoke
      const createRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Key to Revoke for Auth Test',
          scopes: 'read',
        })

      const revokedKey = createRes.body.apiKey.key
      const revokedKeyId = createRes.body.apiKey.id

      // Revoke it
      await request(app)
        .delete(`/api/api-keys/${revokedKeyId}`)
        .set('Authorization', `Bearer ${authToken}`)

      // Try to use revoked key
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', revokedKey)

      expect(res.status).toBe(401)
      expect(res.body.error).toContain('Invalid or expired')

      // Cleanup
      await prisma.apiKey.delete({ where: { id: revokedKeyId } })
    })

    it('should reject requests with expired API key', async () => {
      // Create an expired key by manipulating the database
      const expiredKey = await prisma.apiKey.create({
        data: {
          userId,
          name: 'Expired Key',
          keyHash: 'test_hash',
          keyPrefix: 'sp_test',
          scopes: 'read',
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          isActive: true,
        },
      })

      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', 'sp_any_key')

      expect(res.status).toBe(401)

      // Cleanup
      await prisma.apiKey.delete({ where: { id: expiredKey.id } })
    })

    it('should pass through to next middleware when no API key provided', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, (req, res) => {
        // If no API key, user should not be set
        res.json({ hasUser: !!(req as any).user })
      })

      const res = await request(testApp)
        .get('/test')

      expect(res.status).toBe(200)
      expect(res.body.hasUser).toBe(false)
    })
  })

  describe('Scope Authorization Middleware', () => {
    let readScopeKey: string
    let adminScopeKey: string

    beforeAll(async () => {
      // Create keys with different scopes
      const readRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Read Scope Key', scopes: 'read' })
      readScopeKey = readRes.body.apiKey.key

      // Create write key for setup (may be used in future tests)
      await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Write Scope Key', scopes: 'write' })

      const adminRes = await request(app)
        .post('/api/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Admin Scope Key', scopes: 'admin' })
      adminScopeKey = adminRes.body.apiKey.key
    })

    it('should allow request with matching scope', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey, requireScope } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, requireScope('read'), (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', readScopeKey)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should allow admin scope to access any resource', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey, requireScope } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, requireScope('write'), (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', adminScopeKey)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    it('should reject request with insufficient scope', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey, requireScope } = await import('./apiKeys.js')
      testApp.get('/test', authenticateApiKey, requireScope('write'), (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('x-api-key', readScopeKey)

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Insufficient scope')
    })

    it('should allow JWT-authenticated requests to bypass scope checks', async () => {
      const testApp = express()
      testApp.use(express.json())

      const { authenticateApiKey, requireScope } = await import('./apiKeys.js')
      const { requireAuth } = await import('../middleware/authMiddleware.js')

      testApp.get('/test', requireAuth, authenticateApiKey, requireScope('write'), (_req, res) => {
        res.json({ success: true })
      })

      const res = await request(testApp)
        .get('/test')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })
})

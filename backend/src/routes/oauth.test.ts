import { describe, it, expect, afterAll, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { oauthRouter } from './oauth.js'
import { prisma } from '../lib/prisma.js'
import crypto from 'crypto'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', oauthRouter)
app.use(errorHandler)

// Store original env vars to restore later
const originalEnv = { ...process.env }

describe('OAuth Routes', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env.FRONTEND_URL = 'http://localhost:5174'
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4007/api/auth/google/callback'
  })

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv }
  })

  afterAll(async () => {
    // Clean up oauth_states table
    await prisma.$executeRaw`DELETE FROM oauth_states WHERE state LIKE 'test-%'`
  })

  describe('GET /api/auth/google', () => {
    it('should initiate Google OAuth flow in production mode', async () => {
      const res = await request(app).get('/api/auth/google')

      expect(res.status).toBe(302)
      expect(res.headers.location).toBeDefined()
      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth')
      expect(res.headers.location).toContain('client_id=test-client-id.apps.googleusercontent.com')
      expect(res.headers.location).toContain('redirect_uri=')
      expect(res.headers.location).toContain('response_type=code')
      expect(res.headers.location).toContain('scope=openid+email+profile')
      expect(res.headers.location).toContain('state=')
    })

    it('should redirect to mock OAuth in development mode (no client ID)', async () => {
      process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id.apps.googleusercontent.com'

      const res = await request(app).get('/api/auth/google')

      expect(res.status).toBe(302)
      expect(res.headers.location).toBeDefined()
      expect(res.headers.location).toContain('http://localhost:5174/auth/oauth-mock')
      expect(res.headers.location).toContain('provider=google')
      expect(res.headers.location).toContain('state=')
    })

    it('should redirect to mock OAuth when client ID is not set', async () => {
      delete process.env.GOOGLE_CLIENT_ID

      const res = await request(app).get('/api/auth/google')

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/auth/oauth-mock')
    })

    it('should generate a unique state parameter', async () => {
      const res1 = await request(app).get('/api/auth/google')
      const res2 = await request(app).get('/api/auth/google')

      const state1 = new URL(res1.headers.location, 'http://example.com').searchParams.get('state')
      const state2 = new URL(res2.headers.location, 'http://example.com').searchParams.get('state')

      expect(state1).toBeDefined()
      expect(state2).toBeDefined()
      expect(state1).not.toBe(state2)
    })
  })

  describe('GET /api/auth/google/callback', () => {
    it('should redirect to login with error when OAuth error is present', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied' })

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/login?error=oauth_failed')
      expect(res.headers.location).toContain('message=access_denied')
    })

    it('should redirect to login when state is missing', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'test-code' })

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/login?error=invalid_state')
    })

    it('should redirect to login when state is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({
          code: 'test-code',
          state: 'invalid-state-token'
        })

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/login?error=invalid_state')
    })

    it('should redirect to login when code is missing', async () => {
      // Create a valid state token
      const stateId = crypto.randomUUID()
      const state = crypto.randomBytes(16).toString('hex')
      await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
        VALUES (${stateId}, ${state}, null, NOW() + INTERVAL '10 minutes')
      `

      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ state })

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/login?error=no_code')

      // Cleanup - state should already be consumed/deleted by the handler
    })

    it('should reject expired state tokens', async () => {
      // Create an expired state token
      const stateId = crypto.randomUUID()
      const state = crypto.randomBytes(16).toString('hex')
      await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
        VALUES (${stateId}, ${state}, null, NOW() - INTERVAL '1 minute')
      `

      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({
          code: 'test-code',
          state
        })

      expect(res.status).toBe(302)
      expect(res.headers.location).toContain('/login?error=invalid_state')

      // Verify expired state was cleaned up
      const results = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM oauth_states WHERE id = ${stateId}
      `
      expect(results.length).toBe(0)
    })

    it('should consume state token after use (one-time use)', async () => {
      // Create a valid state token
      const stateId = crypto.randomUUID()
      const state = crypto.randomBytes(16).toString('hex')
      await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
        VALUES (${stateId}, ${state}, null, NOW() + INTERVAL '10 minutes')
      `

      // Mock fetch to avoid actual Google API calls
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => 'token_exchange_failed'
      } as Response)

      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({
          code: 'test-code',
          state
        })

      // Should redirect with error (due to mocked fetch failure)
      expect(res.status).toBe(302)

      // Verify state was consumed
      const results = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM oauth_states WHERE id = ${stateId}
      `
      expect(results.length).toBe(0)

      vi.restoreAllMocks()
    })
  })

  describe('POST /api/auth/google/token', () => {
    const testEmail = `oauth-token-test-${Date.now()}@example.com`
    let createdUserId: string | null = null

    afterAll(async () => {
      // Cleanup test user
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {})
      }
      const user = await prisma.user.findUnique({ where: { email: testEmail } })
      if (user) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {})
      }
    })

    it('should reject request without credential', async () => {
      const res = await request(app)
        .post('/api/auth/google/token')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('credential is required')
    })

    it('should reject invalid credential format', async () => {
      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential: 'invalid-format' })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid credential format')
    })

    it('should create user and return token for valid Google credential', async () => {
      // Create a mock JWT token (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
      const payload = Buffer.from(JSON.stringify({
        sub: `google_${Date.now()}`,
        email: testEmail,
        name: 'OAuth Test User',
        picture: 'https://example.com/avatar.jpg',
        email_verified: true,
        aud: process.env.GOOGLE_CLIENT_ID
      })).toString('base64')
      const signature = Buffer.from('mock-signature').toString('base64')
      const credential = `${header}.${payload}.${signature}`

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential, clientId: process.env.GOOGLE_CLIENT_ID })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(testEmail)
      expect(res.body.user.fullName).toBe('OAuth Test User')
      expect(res.body.user.avatarUrl).toBe('https://example.com/avatar.jpg')
      expect(res.body.token).toBeDefined()

      createdUserId = res.body.user.id
    })

    it('should update existing user with OAuth provider info', async () => {
      // Create a user first
      const existingUser = await prisma.user.create({
        data: {
          email: `oauth-existing-${Date.now()}@example.com`,
          fullName: 'Existing User',
          emailVerified: false
        }
      })

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
      const payload = Buffer.from(JSON.stringify({
        sub: `google_${Date.now()}`,
        email: existingUser.email,
        name: 'Updated Name',
        picture: 'https://example.com/new-avatar.jpg',
        email_verified: true,
        aud: process.env.GOOGLE_CLIENT_ID
      })).toString('base64')
      const signature = Buffer.from('mock-signature').toString('base64')
      const credential = `${header}.${payload}.${signature}`

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential })

      expect(res.status).toBe(200)
      expect(res.body.user.id).toBe(existingUser.id)
      expect(res.body.user.email).toBe(existingUser.email)

      // Verify user was updated
      const updatedUser = await prisma.user.findUnique({ where: { id: existingUser.id } })
      expect(updatedUser?.emailVerified).toBe(true)
      expect(updatedUser?.emailVerifiedAt).toBeDefined()
      expect(updatedUser?.avatarUrl).toBe('https://example.com/new-avatar.jpg')

      // Cleanup
      await prisma.user.delete({ where: { id: existingUser.id } })
    })

    it('should reject mismatched client ID in production', async () => {
      process.env.NODE_ENV = 'production'

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
      const payload = Buffer.from(JSON.stringify({
        sub: `google_${Date.now()}`,
        email: 'test@example.com',
        aud: 'different-client-id'
      })).toString('base64')
      const signature = Buffer.from('mock-signature').toString('base64')
      const credential = `${header}.${payload}.${signature}`

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid client ID')

      process.env.NODE_ENV = 'test'
    })

    it('should allow mismatched client ID in development', async () => {
      process.env.NODE_ENV = 'development'

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
      const payload = Buffer.from(JSON.stringify({
        sub: `google_dev_${Date.now()}`,
        email: `oauth-dev-${Date.now()}@example.com`,
        name: 'Dev User',
        email_verified: true,
        aud: 'different-client-id'
      })).toString('base64')
      const signature = Buffer.from('mock-signature').toString('base64')
      const credential = `${header}.${payload}.${signature}`

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.token).toBeDefined()

      // Cleanup
      await prisma.user.delete({ where: { id: res.body.user.id } }).catch(() => {})

      process.env.NODE_ENV = 'test'
    })
  })

  describe('POST /api/auth/oauth/mock', () => {
    const mockEmail = `oauth-mock-${Date.now()}@example.com`
    let createdUserId: string | null = null

    afterAll(async () => {
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {})
      }
    })

    it('should return 404 in production mode', async () => {
      process.env.NODE_ENV = 'production'

      const res = await request(app)
        .post('/api/auth/oauth/mock')
        .send({ email: mockEmail })

      expect(res.status).toBe(404)
      expect(res.body.error.message).toContain('not found')

      process.env.NODE_ENV = 'test'
    })

    it('should reject request without email', async () => {
      const res = await request(app)
        .post('/api/auth/oauth/mock')
        .send({ provider: 'google' })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Email is required')
    })

    it('should create mock user and return token', async () => {
      const res = await request(app)
        .post('/api/auth/oauth/mock')
        .send({
          provider: 'google',
          email: mockEmail,
          name: 'Mock User'
        })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.email).toBe(mockEmail)
      expect(res.body.user.fullName).toBe('Mock User')
      expect(res.body.token).toBeDefined()

      createdUserId = res.body.user.id
    })

    it('should use email prefix as name when name not provided', async () => {
      const email = `no-name-${Date.now()}@example.com`
      const res = await request(app)
        .post('/api/auth/oauth/mock')
        .send({
          provider: 'google',
          email
        })

      expect(res.status).toBe(200)
      expect(res.body.user.fullName).toBe(email.split('@')[0])

      // Cleanup
      await prisma.user.delete({ where: { id: res.body.user.id } }).catch(() => {})
    })

    it('should default to google provider when not specified', async () => {
      const email = `default-provider-${Date.now()}@example.com`
      const res = await request(app)
        .post('/api/auth/oauth/mock')
        .send({ email })

      expect(res.status).toBe(200)
      expect(res.body.user).toBeDefined()

      // Cleanup
      await prisma.user.delete({ where: { id: res.body.user.id } }).catch(() => {})
    })
  })

  describe('OAuth State Management', () => {
    it('should clean up expired states', async () => {
      // Create an expired state
      const expiredId = crypto.randomUUID()
      const expiredState = crypto.randomBytes(16).toString('hex')
      await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
        VALUES (${expiredId}, ${expiredState}, null, NOW() - INTERVAL '1 hour')
      `

      // Create a valid state
      const validId = crypto.randomUUID()
      const validState = crypto.randomBytes(16).toString('hex')
      await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
        VALUES (${validId}, ${validState}, null, NOW() + INTERVAL '10 minutes')
      `

      // Trigger cleanup by attempting to verify a state
      await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'test', state: validState })

      // Wait a bit for async cleanup
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify expired state was deleted
      const expiredResults = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM oauth_states WHERE id = ${expiredId}
      `
      expect(expiredResults.length).toBe(0)

      // Note: validState will also be deleted as it was consumed during verification
    })

    it('should store redirect_uri with state', async () => {
      const stateId = crypto.randomUUID()
      const state = crypto.randomBytes(16).toString('hex')
      const redirectUri = 'http://localhost:5174/custom-redirect'

      await prisma.$executeRaw`
        INSERT INTO oauth_states (id, state, redirect_uri, expires_at)
        VALUES (${stateId}, ${state}, ${redirectUri}, NOW() + INTERVAL '10 minutes')
      `

      const results = await prisma.$queryRaw<Array<{ redirect_uri: string | null }>>`
        SELECT redirect_uri FROM oauth_states WHERE id = ${stateId}
      `

      expect(results[0].redirect_uri).toBe(redirectUri)

      // Cleanup
      await prisma.$executeRaw`DELETE FROM oauth_states WHERE id = ${stateId}`
    })
  })
})

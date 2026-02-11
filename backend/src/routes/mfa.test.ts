import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { mfaRouter } from './mfa.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import * as _otplib from 'otplib'
import { encrypt, decrypt } from '../lib/encryption.js'
import { errorHandler } from '../middleware/errorHandler.js'

// Mock otplib to control secret and verification
vi.mock('otplib', async () => {
  const actual = await vi.importActual('otplib')
  return {
    ...actual,
    generateSecret: vi.fn(async () => 'TESTSECRET1234567890'),
    verify: vi.fn(async ({ token }: { token: string }) => {
      // Return true for specific test codes, false otherwise
      return token === '123456' || token === '654321'
    }),
    generateURI: vi.fn(async ({ secret, issuer, label }: any) => {
      return `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`
    }),
  }
})

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/mfa', mfaRouter)
app.use(errorHandler)

describe('MFA API', () => {
  let authToken: string
  let userId: string
  const testEmail = `mfa-test-${Date.now()}@example.com`
  const testPassword = 'SecureP@ssword123!'

  beforeAll(async () => {
    // Create test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'MFA Test User',
        tosAccepted: true,
      })

    expect(regRes.status).toBe(201)
    authToken = regRes.body.token
    userId = regRes.body.user.id
  })

  afterAll(async () => {
    // Clean up test data
    if (userId) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  })

  describe('GET /api/mfa/status', () => {
    it('should return MFA disabled for new user', async () => {
      const res = await request(app)
        .get('/api/mfa/status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.mfaEnabled).toBe(false)
    })

    it('should require authentication', async () => {
      const res = await request(app).get('/api/mfa/status')

      expect(res.status).toBe(401)
    })

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/mfa/status')
        .set('Authorization', 'Bearer invalid-token')

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/mfa/setup', () => {
    it('should generate MFA secret and QR code', async () => {
      const res = await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.secret).toBe('TESTSECRET1234567890')
      expect(res.body.qrCode).toBeDefined()
      expect(res.body.qrCode).toContain('data:image/png;base64,')
      expect(res.body.otpAuthUrl).toBeDefined()
      expect(res.body.otpAuthUrl).toContain('otpauth://totp/')
      expect(res.body.otpAuthUrl).toContain(testEmail)
      expect(res.body.message).toContain('Scan the QR code')
    })

    it('should require authentication', async () => {
      const res = await request(app).post('/api/mfa/setup')

      expect(res.status).toBe(401)
    })

    it('should reject setup when MFA is already enabled', async () => {
      // First enable MFA
      await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)

      await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123456' })

      // Try to setup again
      const res = await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('already enabled')

      // Cleanup - disable MFA for next tests
      await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: testPassword })
    })

    it('should store encrypted secret in database', async () => {
      await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true },
      })

      expect(user?.twoFactorSecret).toBeDefined()

      // If encryption is enabled, secret should be encrypted
      if (process.env.ENCRYPTION_KEY) {
        expect(user?.twoFactorSecret).not.toBe('TESTSECRET1234567890')
        // Verify we can decrypt it
        const decrypted = decrypt(user!.twoFactorSecret!)
        expect(decrypted).toBe('TESTSECRET1234567890')
      }
    })
  })

  describe('POST /api/mfa/verify-setup', () => {
    beforeAll(async () => {
      // Ensure MFA is disabled
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      })

      // Setup MFA
      await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)
    })

    it('should verify valid code and enable MFA', async () => {
      const res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123456' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('enabled successfully')
      expect(res.body.backupCodes).toBeDefined()
      expect(Array.isArray(res.body.backupCodes)).toBe(true)
      expect(res.body.backupCodes.length).toBe(8)
    })

    it('should update MFA status in database', async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      })

      expect(user?.twoFactorEnabled).toBe(true)
    })

    it('should reject invalid verification code', async () => {
      // Disable and setup again
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false },
      })

      await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${authToken}`)

      const res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '000000' })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid verification code')
    })

    it('should reject verification without code', async () => {
      const res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('required')
    })

    it('should reject verification when MFA is already enabled', async () => {
      // Ensure MFA is enabled first
      const encryptedSecret = encrypt('TESTSECRET1234567890')
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })

      const res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123456' })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('already enabled')
    })

    it('should reject verification without prior setup', async () => {
      // Disable MFA and clear secret
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      })

      const res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '123456' })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('No MFA setup in progress')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/mfa/verify-setup')
        .send({ code: '123456' })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/mfa/disable', () => {
    beforeAll(async () => {
      // Ensure MFA is enabled
      const encryptedSecret = encrypt('TESTSECRET1234567890')
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })
    })

    it('should disable MFA with valid password', async () => {
      const res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: testPassword })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('disabled')
    })

    it('should clear MFA secret from database when disabled', async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, twoFactorSecret: true },
      })

      expect(user?.twoFactorEnabled).toBe(false)
      expect(user?.twoFactorSecret).toBeNull()
    })

    it('should disable MFA with valid MFA code', async () => {
      // Re-enable MFA
      const encryptedSecret = encrypt('TESTSECRET1234567890')
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })

      const res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '654321' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('disabled')
    })

    it('should reject disable without password or code', async () => {
      // Re-enable MFA
      const encryptedSecret = encrypt('TESTSECRET1234567890')
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })

      const res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('required')
    })

    it('should reject disable with invalid password', async () => {
      const res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: 'WrongPassword!' })

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Invalid')
    })

    it('should reject disable with invalid MFA code', async () => {
      const res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ code: '000000' })

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Invalid')
    })

    it('should reject disable when MFA is not enabled', async () => {
      // Disable MFA
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      })

      const res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: testPassword })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('not enabled')
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/mfa/disable')
        .send({ password: testPassword })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/mfa/verify', () => {
    beforeAll(async () => {
      // Ensure MFA is enabled
      const encryptedSecret = encrypt('TESTSECRET1234567890')
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })
    })

    it('should verify valid MFA code and return user data', async () => {
      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId,
          code: '123456',
        })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(true)
      expect(res.body.user).toBeDefined()
      expect(res.body.user.id).toBe(userId)
      expect(res.body.user.email).toBe(testEmail)
      expect(res.body.user.fullName).toBe('MFA Test User')
    })

    it('should reject invalid MFA code', async () => {
      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId,
          code: '000000',
        })

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Invalid verification code')
    })

    it('should reject verification without userId', async () => {
      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          code: '123456',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('required')
    })

    it('should reject verification without code', async () => {
      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId,
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('required')
    })

    it('should reject verification for non-existent user', async () => {
      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId: 'non-existent-user-id',
          code: '123456',
        })

      expect(res.status).toBe(404)
      expect(res.body.error.message).toContain('not found')
    })

    it('should reject verification when MFA is not enabled', async () => {
      // Disable MFA
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      })

      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId,
          code: '123456',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('not enabled')
    })

    it('should not require authentication (for login flow)', async () => {
      // Re-enable MFA
      const encryptedSecret = encrypt('TESTSECRET1234567890')
      await prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encryptedSecret,
        },
      })

      const res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId,
          code: '123456',
        })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(true)
    })
  })

  describe('MFA Full Workflow Integration', () => {
    let workflowUserId: string
    let workflowToken: string
    const workflowEmail = `mfa-workflow-${Date.now()}@example.com`

    beforeAll(async () => {
      // Create fresh user for workflow test
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: workflowEmail,
          password: testPassword,
          fullName: 'MFA Workflow User',
          tosAccepted: true,
        })

      workflowToken = regRes.body.token
      workflowUserId = regRes.body.user.id
    })

    afterAll(async () => {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: workflowUserId } })
      await prisma.user.delete({ where: { id: workflowUserId } }).catch(() => {})
    })

    it('should complete full MFA setup and verification workflow', async () => {
      // Step 1: Check initial status (should be disabled)
      let res = await request(app)
        .get('/api/mfa/status')
        .set('Authorization', `Bearer ${workflowToken}`)

      expect(res.status).toBe(200)
      expect(res.body.mfaEnabled).toBe(false)

      // Step 2: Setup MFA
      res = await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${workflowToken}`)

      expect(res.status).toBe(200)
      expect(res.body.secret).toBeDefined()

      // Step 3: Verify setup with code
      res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({ code: '123456' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.backupCodes).toBeDefined()

      // Step 4: Check status (should be enabled)
      res = await request(app)
        .get('/api/mfa/status')
        .set('Authorization', `Bearer ${workflowToken}`)

      expect(res.status).toBe(200)
      expect(res.body.mfaEnabled).toBe(true)

      // Step 5: Verify MFA code (simulating login)
      res = await request(app)
        .post('/api/mfa/verify')
        .send({
          userId: workflowUserId,
          code: '654321',
        })

      expect(res.status).toBe(200)
      expect(res.body.valid).toBe(true)

      // Step 6: Disable MFA
      res = await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({ password: testPassword })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Step 7: Verify status is disabled
      res = await request(app)
        .get('/api/mfa/status')
        .set('Authorization', `Bearer ${workflowToken}`)

      expect(res.status).toBe(200)
      expect(res.body.mfaEnabled).toBe(false)
    })

    it('should prevent double verification during setup', async () => {
      // Setup MFA
      await request(app)
        .post('/api/mfa/setup')
        .set('Authorization', `Bearer ${workflowToken}`)

      // First verification
      let res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({ code: '123456' })

      expect(res.status).toBe(200)

      // Second verification attempt should fail
      res = await request(app)
        .post('/api/mfa/verify-setup')
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({ code: '123456' })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('already enabled')

      // Cleanup
      await request(app)
        .post('/api/mfa/disable')
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({ password: testPassword })
    })
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use(errorHandler)

describe('POST /api/auth/register', () => {
  const testEmail = `test-reg-${Date.now()}@example.com`

  afterAll(async () => {
    // Clean up test user and related data
    const user = await prisma.user.findUnique({ where: { email: testEmail } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  it('should register a new user with valid data', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Test User',
        tosAccepted: true,
      })

    expect(res.status).toBe(201)
    expect(res.body.user).toBeDefined()
    expect(res.body.user.email).toBe(testEmail)
    expect(res.body.token).toBeDefined()
    expect(res.body.verificationRequired).toBe(true)
  })

  it('should reject registration without email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        password: 'SecureP@ssword123!',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('required')
  })

  it('should reject registration without password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `no-pass-${Date.now()}@example.com`,
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('required')
  })

  it('should reject weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `weak-${Date.now()}@example.com`,
        password: 'weak',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.details.errors).toBeDefined()
    expect(res.body.error.details.errors.length).toBeGreaterThan(0)
  })

  it('should reject password without uppercase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `nocase-${Date.now()}@example.com`,
        password: 'nouppercase123!',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.details.errors).toBeDefined()
    expect(res.body.error.details.errors.some((e: string) => e.toLowerCase().includes('uppercase'))).toBe(true)
  })

  it('should reject password without special character', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `nospecial-${Date.now()}@example.com`,
        password: 'NoSpecialChar123',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.details.errors).toBeDefined()
    expect(res.body.error.details.errors.some((e: string) => e.toLowerCase().includes('special'))).toBe(true)
  })

  it('should reject registration without ToS acceptance', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `no-tos-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        tosAccepted: false,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('Terms of Service')
  })

  it('should reject duplicate email registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Duplicate User',
        tosAccepted: true,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('already in use')
  })
})

describe('POST /api/auth/login', () => {
  const loginEmail = `test-login-${Date.now()}@example.com`
  const loginPassword = 'SecureP@ssword123!'

  beforeAll(async () => {
    // Create test user
    await request(app)
      .post('/api/auth/register')
      .send({
        email: loginEmail,
        password: loginPassword,
        fullName: 'Login Test User',
        tosAccepted: true,
      })
  })

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: loginEmail } })
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password: loginPassword,
      })

    expect(res.status).toBe(200)
    expect(res.body.user).toBeDefined()
    expect(res.body.token).toBeDefined()
  })

  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: loginPassword,
      })

    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('Invalid')
  })

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: loginEmail,
        password: 'WrongPassword123!',
      })

    expect(res.status).toBe(401)
    expect(res.body.error.message).toContain('Invalid')
  })

  it('should reject login without email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        password: loginPassword,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('required')
  })

  it('should reject login without password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: loginEmail,
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('required')
  })
})

describe('Password Reset Flow', () => {
  const resetEmail = `test-reset-${Date.now()}@example.com`

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: resetEmail,
        password: 'OldPassword123!',
        fullName: 'Reset Test User',
        tosAccepted: true,
      })
  })

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } })
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  it('should send reset email for existing user (always returns success)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: resetEmail })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should not reveal if email exists', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should reject reset with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'invalid-token',
        password: 'NewPassword123!',
      })

    expect(res.status).toBe(400)
    expect(res.body.error.message).toContain('Invalid')
  })
})

describe('Magic Link Authentication', () => {
  const magicEmail = `test-magic-${Date.now()}@example.com`

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        email: magicEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Magic Link User',
        tosAccepted: true,
      })
  })

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } })
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  it('should request magic link for existing user', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/request')
      .send({ email: magicEmail })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should not reveal non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/request')
      .send({ email: 'nonexistent@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.message).toContain('If an account exists')
  })

  it('should reject invalid magic link token', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/verify')
      .send({ token: 'invalid-token' })

    expect(res.status).toBe(400)
  })
})

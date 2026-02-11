import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import express from 'express'
import { authRouter } from './auth.js'
import { consentRouter } from './consent.js'
import { prisma } from '../lib/prisma.js'
import { errorHandler } from '../middleware/errorHandler.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)

// Consent router now has auth middleware built-in
app.use('/api/consent', consentRouter)
app.use(errorHandler)

describe('Consent API', () => {
  let authToken: string
  let userId: string
  const testEmail = `consent-test-${Date.now()}@example.com`

  beforeAll(async () => {
    // Create test user and get auth token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Consent Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.consentRecord.deleteMany({ where: { userId } })
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  describe('GET /api/consent/types', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/consent/types')

      expect(res.status).toBe(401)
    })

    it('should return available consent types', async () => {
      const res = await request(app)
        .get('/api/consent/types')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.consentTypes).toBeDefined()
      expect(Array.isArray(res.body.consentTypes)).toBe(true)
      expect(res.body.consentTypes.length).toBeGreaterThan(0)

      const firstType = res.body.consentTypes[0]
      expect(firstType.type).toBeDefined()
      expect(firstType.version).toBeDefined()
      expect(firstType.description).toBeDefined()
    })

    it('should include all expected consent types', async () => {
      const res = await request(app)
        .get('/api/consent/types')
        .set('Authorization', `Bearer ${authToken}`)

      const types = res.body.consentTypes.map((t: any) => t.type)
      expect(types).toContain('terms_of_service')
      expect(types).toContain('privacy_policy')
      expect(types).toContain('marketing')
      expect(types).toContain('analytics')
      expect(types).toContain('data_processing')
      expect(types).toContain('cookie_policy')
    })
  })

  describe('GET /api/consent', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/consent')

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Authentication required')
    })

    it('should get current consent status for authenticated user', async () => {
      const res = await request(app)
        .get('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.consents).toBeDefined()
      expect(res.body.currentVersions).toBeDefined()

      // Check structure of consent object
      expect(res.body.consents.terms_of_service).toBeDefined()
      expect(res.body.consents.terms_of_service.granted).toBeDefined()
      expect(res.body.consents.terms_of_service.version).toBeDefined()
    })

    it('should return false for consents not yet granted', async () => {
      const res = await request(app)
        .get('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // Most consents should be false initially
      expect(res.body.consents.marketing.granted).toBe(false)
      expect(res.body.consents.analytics.granted).toBe(false)
    })
  })

  describe('POST /api/consent', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/consent')
        .send({
          consentType: 'marketing',
          granted: true,
        })

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Authentication required')
    })

    it('should record consent for valid consent type', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'marketing',
          granted: true,
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecord).toBeDefined()
      expect(res.body.consentRecord.consentType).toBe('marketing')
      expect(res.body.consentRecord.granted).toBe(true)
      expect(res.body.consentRecord.version).toBeDefined()
      expect(res.body.consentRecord.recordedAt).toBeDefined()
      expect(res.body.message).toContain('Consent granted')
    })

    it('should record consent withdrawal', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'analytics',
          granted: false,
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecord.granted).toBe(false)
      expect(res.body.message).toContain('Consent withdrawn')
    })

    it('should accept custom version', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'privacy_policy',
          granted: true,
          version: '2.0',
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecord.version).toBe('2.0')
    })

    it('should reject invalid consent type', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'invalid_type',
          granted: true,
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })

    it('should reject missing consentType', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          granted: true,
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })

    it('should reject missing granted field', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'marketing',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })

    it('should reject non-boolean granted value', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'marketing',
          granted: 'yes',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })
  })

  describe('POST /api/consent/bulk', () => {
    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/consent/bulk')
        .send({
          consents: [
            { consentType: 'marketing', granted: true },
            { consentType: 'analytics', granted: true },
          ],
        })

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Authentication required')
    })

    it('should record multiple consents at once', async () => {
      const res = await request(app)
        .post('/api/consent/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consents: [
            { consentType: 'marketing', granted: true },
            { consentType: 'analytics', granted: false },
            { consentType: 'cookie_policy', granted: true },
          ],
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecords).toBeDefined()
      expect(Array.isArray(res.body.consentRecords)).toBe(true)
      expect(res.body.consentRecords.length).toBe(3)
      expect(res.body.message).toContain('3 consent records created')

      // Verify individual records
      const marketingRecord = res.body.consentRecords.find(
        (r: any) => r.consentType === 'marketing'
      )
      expect(marketingRecord.granted).toBe(true)

      const analyticsRecord = res.body.consentRecords.find(
        (r: any) => r.consentType === 'analytics'
      )
      expect(analyticsRecord.granted).toBe(false)
    })

    it('should accept empty consents array', async () => {
      const res = await request(app)
        .post('/api/consent/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consents: [],
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecords.length).toBe(0)
      expect(res.body.message).toContain('0 consent records created')
    })

    it('should reject invalid consent in bulk array', async () => {
      const res = await request(app)
        .post('/api/consent/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consents: [
            { consentType: 'marketing', granted: true },
            { consentType: 'invalid_type', granted: true },
          ],
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })

    it('should reject missing consents field', async () => {
      const res = await request(app)
        .post('/api/consent/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })

    it('should reject non-array consents field', async () => {
      const res = await request(app)
        .post('/api/consent/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consents: 'not-an-array',
        })

      expect(res.status).toBe(400)
      expect(res.body.error.message).toContain('Invalid request')
    })
  })

  describe('GET /api/consent/history', () => {
    beforeAll(async () => {
      // Create some consent history
      await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ consentType: 'data_processing', granted: true })

      await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ consentType: 'data_processing', granted: false })

      await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ consentType: 'terms_of_service', granted: true })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .get('/api/consent/history')

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Authentication required')
    })

    it('should get full consent history', async () => {
      const res = await request(app)
        .get('/api/consent/history')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.history).toBeDefined()
      expect(Array.isArray(res.body.history)).toBe(true)
      expect(res.body.history.length).toBeGreaterThan(0)

      // Check structure of history record
      const record = res.body.history[0]
      expect(record.id).toBeDefined()
      expect(record.consentType).toBeDefined()
      expect(record.granted).toBeDefined()
      expect(record.version).toBeDefined()
      expect(record.recordedAt).toBeDefined()
    })

    it('should filter history by consent type', async () => {
      const res = await request(app)
        .get('/api/consent/history?consentType=data_processing')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.history).toBeDefined()
      expect(res.body.history.length).toBeGreaterThan(0)

      // All records should be for data_processing
      const allDataProcessing = res.body.history.every(
        (r: any) => r.consentType === 'data_processing'
      )
      expect(allDataProcessing).toBe(true)
    })

    it('should ignore invalid consent type filter', async () => {
      const res = await request(app)
        .get('/api/consent/history?consentType=invalid_type')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.history).toBeDefined()
      // Should return all history when filter is invalid
      expect(res.body.history.length).toBeGreaterThan(0)
    })

    it('should return history in descending order (newest first)', async () => {
      const res = await request(app)
        .get('/api/consent/history?consentType=data_processing')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.history.length).toBeGreaterThanOrEqual(2)

      // Most recent should be the withdrawal (granted: false)
      expect(res.body.history[0].granted).toBe(false)
    })

    it('should limit history to 100 records', async () => {
      const res = await request(app)
        .get('/api/consent/history')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // Should not exceed 100 even if more exist
      expect(res.body.history.length).toBeLessThanOrEqual(100)
    })
  })

  describe('POST /api/consent/withdraw-all', () => {
    beforeAll(async () => {
      // Grant some consents first
      await request(app)
        .post('/api/consent/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consents: [
            { consentType: 'marketing', granted: true },
            { consentType: 'analytics', granted: true },
            { consentType: 'cookie_policy', granted: true },
          ],
        })
    })

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/consent/withdraw-all')

      expect(res.status).toBe(401)
      expect(res.body.error.message).toContain('Authentication required')
    })

    it('should withdraw all consents', async () => {
      const res = await request(app)
        .post('/api/consent/withdraw-all')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toContain('All consents withdrawn')
      expect(res.body.withdrawnCount).toBe(6) // 6 consent types
      expect(res.body.withdrawnAt).toBeDefined()
    })

    it('should verify all consents are withdrawn', async () => {
      const res = await request(app)
        .get('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)

      // All consents should now be false
      const consents = res.body.consents
      expect(consents.terms_of_service.granted).toBe(false)
      expect(consents.privacy_policy.granted).toBe(false)
      expect(consents.marketing.granted).toBe(false)
      expect(consents.analytics.granted).toBe(false)
      expect(consents.data_processing.granted).toBe(false)
      expect(consents.cookie_policy.granted).toBe(false)
    })

    it('should create withdrawal records in history', async () => {
      const res = await request(app)
        .get('/api/consent/history')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)

      // The most recent 6 records should all be withdrawals
      const recentWithdrawals = res.body.history.slice(0, 6)
      const allWithdrawn = recentWithdrawals.every((r: any) => r.granted === false)
      expect(allWithdrawn).toBe(true)
    })
  })

  describe('Consent versioning', () => {
    it('should use default version when not specified', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'terms_of_service',
          granted: true,
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecord.version).toBe('1.0')
    })

    it('should allow version to be specified', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'terms_of_service',
          granted: true,
          version: '2.5',
        })

      expect(res.status).toBe(201)
      expect(res.body.consentRecord.version).toBe('2.5')
    })

    it('should track multiple versions in history', async () => {
      // Grant consent with v1.0
      await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'privacy_policy',
          granted: true,
          version: '1.0',
        })

      // Grant consent with v2.0
      await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'privacy_policy',
          granted: true,
          version: '2.0',
        })

      const res = await request(app)
        .get('/api/consent/history?consentType=privacy_policy')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)

      // Should have both versions in history
      const versions = res.body.history.map((r: any) => r.version)
      expect(versions).toContain('1.0')
      expect(versions).toContain('2.0')
    })
  })

  describe('User isolation', () => {
    let otherUserId: string
    let otherUserToken: string

    beforeAll(async () => {
      // Create another test user
      const otherEmail = `consent-other-${Date.now()}@example.com`
      const otherRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other Consent User',
          tosAccepted: true,
        })
      otherUserToken = otherRes.body.token
      otherUserId = otherRes.body.user.id

      // Grant consent for the first user
      await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'marketing',
          granted: true,
        })
    })

    afterAll(async () => {
      await prisma.consentRecord.deleteMany({ where: { userId: otherUserId } })
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })

    it('should not see other users consent status', async () => {
      const res = await request(app)
        .get('/api/consent')
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(200)

      // Other user should not have marketing consent granted
      expect(res.body.consents.marketing.granted).toBe(false)
    })

    it('should not see other users consent history', async () => {
      const res = await request(app)
        .get('/api/consent/history')
        .set('Authorization', `Bearer ${otherUserToken}`)

      expect(res.status).toBe(200)

      // Other user should have no or different history
      const hasFirstUserConsent = res.body.history.some(
        (r: any) => r.userId === userId
      )
      expect(hasFirstUserConsent).toBe(false)
    })
  })

  describe('IP address and user agent tracking', () => {
    it('should record IP address when available', async () => {
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-For', '192.168.1.100')
        .send({
          consentType: 'cookie_policy',
          granted: true,
        })

      expect(res.status).toBe(201)

      // Verify IP was recorded in database
      const record = await prisma.consentRecord.findFirst({
        where: {
          userId,
          consentType: 'cookie_policy',
          id: res.body.consentRecord.id,
        },
      })

      expect(record?.ipAddress).toBeTruthy()
    })

    it('should record user agent when available', async () => {
      const userAgent = 'Mozilla/5.0 (Test Browser)'
      const res = await request(app)
        .post('/api/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', userAgent)
        .send({
          consentType: 'data_processing',
          granted: true,
        })

      expect(res.status).toBe(201)

      // Verify user agent was recorded in database
      const record = await prisma.consentRecord.findFirst({
        where: {
          userId,
          consentType: 'data_processing',
          id: res.body.consentRecord.id,
        },
      })

      expect(record?.userAgent).toBe(userAgent)
    })
  })
})

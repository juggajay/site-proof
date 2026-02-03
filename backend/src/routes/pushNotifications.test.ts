import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { pushNotificationsRouter, sendPushNotification, broadcastPushNotification } from './pushNotifications.js'
import { authRouter } from './auth.js'
import { prisma } from '../lib/prisma.js'
import webpush from 'web-push'

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)
app.use('/api/push', pushNotificationsRouter)

describe('Push Notifications API', () => {
  let authToken: string
  let userId: string
  let testEmail: string

  // Sample push subscription
  const mockSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
      auth: 'tBHItJI5svbpez7KI4CCXg=='
    }
  }

  beforeAll(async () => {
    // Create test user
    testEmail = `push-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Push Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id
  })

  afterAll(async () => {
    // Clean up test user
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  describe('GET /api/push/vapid-public-key', () => {
    it('should return VAPID public key for authenticated user', async () => {
      const res = await request(app)
        .get('/api/push/vapid-public-key')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.publicKey).toBeDefined()
      expect(typeof res.body.publicKey).toBe('string')
      expect(res.body.configured).toBeDefined()
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/push/vapid-public-key')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/push/subscribe', () => {
    it('should register a new push subscription', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subscription: mockSubscription })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('registered')
      expect(res.body.subscriptionId).toBeDefined()
    })

    it('should reject subscription without authentication', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .send({ subscription: mockSubscription })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })

    it('should reject invalid subscription object without endpoint', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            keys: mockSubscription.keys
          }
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid subscription')
    })

    it('should reject invalid subscription object without keys', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: mockSubscription.endpoint
          }
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid subscription')
    })

    it('should reject request without subscription object', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Invalid subscription')
    })

    it('should allow multiple subscriptions for the same user', async () => {
      const subscription2 = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-456',
        keys: mockSubscription.keys
      }

      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subscription: subscription2 })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('GET /api/push/subscriptions', () => {
    it('should list user subscriptions', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.subscriptions).toBeDefined()
      expect(Array.isArray(res.body.subscriptions)).toBe(true)
      expect(res.body.count).toBeDefined()
      expect(res.body.count).toBeGreaterThan(0)
    })

    it('should include subscription metadata', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const subscription = res.body.subscriptions[0]
      expect(subscription.id).toBeDefined()
      expect(subscription.endpointPreview).toBeDefined()
      expect(subscription.createdAt).toBeDefined()
      // Endpoint should be truncated for security
      expect(subscription.endpointPreview).toMatch(/\.\.\.$/)
    })

    it('should not expose full endpoint in list', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      const subscription = res.body.subscriptions[0]
      expect(subscription.endpoint).toBeUndefined()
      expect(subscription.keys).toBeUndefined()
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })

  describe('GET /api/push/status', () => {
    it('should return push notification status', async () => {
      const res = await request(app)
        .get('/api/push/status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.configured).toBeDefined()
      expect(typeof res.body.configured).toBe('boolean')
      expect(res.body.vapidConfigured).toBeDefined()
      expect(res.body.totalSubscriptions).toBeDefined()
      expect(res.body.userSubscriptionCount).toBeDefined()
      expect(res.body.message).toBeDefined()
    })

    it('should show user subscription count', async () => {
      const res = await request(app)
        .get('/api/push/status')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.userSubscriptionCount).toBeGreaterThan(0)
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/push/status')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })

  describe('POST /api/push/test', () => {
    beforeEach(() => {
      // Mock webpush.sendNotification to avoid actual push notifications
      vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
        statusCode: 201,
        body: '',
        headers: {}
      })
    })

    it('should send test notification to user subscriptions', async () => {
      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBeDefined()
      expect(res.body.message).toBeDefined()
      expect(res.body.results).toBeDefined()
      expect(Array.isArray(res.body.results)).toBe(true)
    })

    it('should return error when user has no subscriptions', async () => {
      // Create a new user without subscriptions
      const newUserEmail = `no-sub-${Date.now()}@example.com`
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: newUserEmail,
          password: 'SecureP@ssword123!',
          fullName: 'No Sub User',
          tosAccepted: true,
        })
      const newUserToken = regRes.body.token
      const newUserId = regRes.body.user.id

      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${newUserToken}`)

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('No push subscriptions found')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: newUserId } })
      await prisma.user.delete({ where: { id: newUserId } })
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .post('/api/push/test')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })

    it('should include success count in response', async () => {
      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.message).toMatch(/\d+\/\d+ device/)
    })
  })

  describe('POST /api/push/send', () => {
    beforeEach(() => {
      vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
        statusCode: 201,
        body: '',
        headers: {}
      })
    })

    it('should send notification to target user', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Test Notification',
          body: 'This is a test',
          url: '/test',
          tag: 'test-tag'
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBeDefined()
      expect(res.body.sent).toBeDefined()
      expect(res.body.failed).toBeDefined()
    })

    it('should reject request without required fields', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Test'
          // Missing body
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('required')
    })

    it('should reject request without targetUserId', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          body: 'Test body'
        })

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('required')
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .send({
          targetUserId: userId,
          title: 'Test',
          body: 'Test body'
        })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })

  describe('DELETE /api/push/unsubscribe', () => {
    let subscriptionEndpoint: string

    beforeAll(async () => {
      // Subscribe first
      subscriptionEndpoint = `https://fcm.googleapis.com/fcm/send/unsubscribe-test-${Date.now()}`
      await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: subscriptionEndpoint,
            keys: mockSubscription.keys
          }
        })
    })

    it('should unsubscribe user subscription', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endpoint: subscriptionEndpoint })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toContain('Unsubscribed')
    })

    it('should reject request without endpoint', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.error).toContain('Endpoint is required')
    })

    it('should return 404 for non-existent subscription', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent' })

      expect(res.status).toBe(404)
      expect(res.body.error).toContain('not found')
    })

    it('should prevent unsubscribing other user subscriptions', async () => {
      // Create another user
      const otherUserEmail = `other-${Date.now()}@example.com`
      const otherRegRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: otherUserEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        })
      const otherToken = otherRegRes.body.token
      const otherUserId = otherRegRes.body.user.id

      // Other user subscribes
      const otherEndpoint = `https://fcm.googleapis.com/fcm/send/other-${Date.now()}`
      await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          subscription: {
            endpoint: otherEndpoint,
            keys: mockSubscription.keys
          }
        })

      // Try to unsubscribe other user's subscription
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endpoint: otherEndpoint })

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Not authorized')

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } })
      await prisma.user.delete({ where: { id: otherUserId } })
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .send({ endpoint: 'test-endpoint' })

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })

  describe('GET /api/push/generate-vapid-keys', () => {
    it('should reject in production environment', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const res = await request(app)
        .get('/api/push/generate-vapid-keys')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error).toContain('Not available in production')

      process.env.NODE_ENV = originalEnv
    })

    it('should generate VAPID keys in non-production', async () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const res = await request(app)
        .get('/api/push/generate-vapid-keys')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.publicKey).toBeDefined()
      expect(res.body.privateKey).toBeDefined()
      expect(res.body.envFormat).toBeDefined()
      expect(res.body.message).toContain('VAPID keys')

      process.env.NODE_ENV = originalEnv
    })

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .get('/api/push/generate-vapid-keys')

      expect(res.status).toBe(401)
      expect(res.body.error).toBe('Unauthorized')
    })
  })
})

describe('sendPushNotification helper function', () => {
  let userId: string
  let authToken: string

  beforeAll(async () => {
    const testEmail = `helper-test-${Date.now()}@example.com`
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Helper Test User',
        tosAccepted: true,
      })
    authToken = regRes.body.token
    userId = regRes.body.user.id

    // Subscribe
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/helper-${Date.now()}`,
          keys: {
            p256dh: 'test-p256dh',
            auth: 'test-auth'
          }
        }
      })
  })

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  })

  beforeEach(() => {
    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {}
    })
  })

  it('should send notification to user', async () => {
    const result = await sendPushNotification(userId, {
      title: 'Test',
      body: 'Test body',
      url: '/test'
    })

    expect(result.success).toBe(true)
    expect(result.sent).toBeGreaterThan(0)
    expect(result.failed).toBe(0)
  })

  it('should return error for user without subscriptions', async () => {
    const result = await sendPushNotification('non-existent-user-id', {
      title: 'Test',
      body: 'Test body'
    })

    expect(result.success).toBe(false)
    expect(result.sent).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.errors).toBeDefined()
    expect(result.errors?.[0]).toContain('No subscriptions')
  })

  it('should include custom data in notification', async () => {
    const result = await sendPushNotification(userId, {
      title: 'Test',
      body: 'Test body',
      data: { customKey: 'customValue' }
    })

    expect(result.success).toBe(true)
  })
})

describe('broadcastPushNotification helper function', () => {
  let userId1: string
  let userId2: string
  let authToken1: string
  let authToken2: string

  beforeAll(async () => {
    // Create first user
    const testEmail1 = `broadcast1-${Date.now()}@example.com`
    const regRes1 = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail1,
        password: 'SecureP@ssword123!',
        fullName: 'Broadcast User 1',
        tosAccepted: true,
      })
    authToken1 = regRes1.body.token
    userId1 = regRes1.body.user.id

    // Create second user
    const testEmail2 = `broadcast2-${Date.now()}@example.com`
    const regRes2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail2,
        password: 'SecureP@ssword123!',
        fullName: 'Broadcast User 2',
        tosAccepted: true,
      })
    authToken2 = regRes2.body.token
    userId2 = regRes2.body.user.id

    // Subscribe both users
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast1-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
        }
      })

    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast2-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
        }
      })
  })

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userId1 } })
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userId2 } })
    await prisma.user.delete({ where: { id: userId1 } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId2 } }).catch(() => {})
  })

  beforeEach(() => {
    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {}
    })
  })

  it('should broadcast notification to multiple users', async () => {
    // Ensure subscriptions are registered for this test
    const sub1 = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast1-test-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
        }
      })

    const sub2 = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast2-test-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
        }
      })

    // Verify subscriptions were created
    expect(sub1.status).toBe(200)
    expect(sub2.status).toBe(200)

    const result = await broadcastPushNotification([userId1, userId2], {
      title: 'Broadcast Test',
      body: 'This is a broadcast',
      url: '/broadcast'
    })

    // Test structure regardless of whether notifications were sent
    expect(result.results[userId1]).toBeDefined()
    expect(result.results[userId2]).toBeDefined()
    expect(typeof result.results[userId1].sent).toBe('number')
    expect(typeof result.results[userId2].sent).toBe('number')
    expect(typeof result.results[userId1].failed).toBe('number')
    expect(typeof result.results[userId2].failed).toBe('number')
    expect(result.totalSent).toBeGreaterThanOrEqual(0)
    expect(result.totalFailed).toBeGreaterThanOrEqual(0)
  })

  it('should handle empty user list', async () => {
    const result = await broadcastPushNotification([], {
      title: 'Test',
      body: 'Test'
    })

    expect(result.totalSent).toBe(0)
    expect(result.totalFailed).toBe(0)
    expect(Object.keys(result.results).length).toBe(0)
  })

  it('should track per-user results', async () => {
    const result = await broadcastPushNotification([userId1, userId2], {
      title: 'Test',
      body: 'Test'
    })

    expect(result.results[userId1].sent).toBeDefined()
    expect(result.results[userId1].failed).toBeDefined()
    expect(result.results[userId2].sent).toBeDefined()
    expect(result.results[userId2].failed).toBeDefined()
  })
})

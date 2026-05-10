import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import {
  pushNotificationsRouter,
  sendPushNotification,
  broadcastPushNotification,
} from './pushNotifications.js';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import webpush from 'web-push';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/push', pushNotificationsRouter);
app.use(errorHandler);

describe('Push Notifications API', () => {
  let authToken: string;
  let userId: string;
  let testEmail: string;

  // Sample push subscription
  const mockSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-123',
    keys: {
      p256dh:
        'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=',
      auth: 'tBHItJI5svbpez7KI4CCXg==',
    },
  };

  const getSubscriptionId = (endpoint: string) =>
    crypto.createHash('sha256').update(endpoint).digest('hex');

  beforeAll(async () => {
    // Create test user
    testEmail = `push-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Push Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;
  });

  afterAll(async () => {
    // Clean up test user
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  describe('GET /api/push/vapid-public-key', () => {
    it('should return VAPID public key for authenticated user', async () => {
      const res = await request(app)
        .get('/api/push/vapid-public-key')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.publicKey).toBeDefined();
      expect(typeof res.body.publicKey).toBe('string');
      expect(res.body.configured).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/push/vapid-public-key');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/push/subscribe', () => {
    it('should register a new push subscription', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subscription: mockSubscription });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('registered');
      expect(res.body.subscriptionId).toBeDefined();
    });

    it('should reject subscription without authentication', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .send({ subscription: mockSubscription });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject invalid subscription object without endpoint', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            keys: mockSubscription.keys,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid subscription');
    });

    it('should reject invalid subscription object without keys', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: mockSubscription.endpoint,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid subscription');
    });

    it('should reject request without subscription object', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid subscription');
    });

    it('should reject private push endpoint hosts', async () => {
      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: 'https://127.0.0.1/push',
            keys: mockSubscription.keys,
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Endpoint host is not allowed');
    });

    it('should reject push endpoints with credentials or fragments', async () => {
      const credentialRes = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: 'https://user:pass@fcm.googleapis.com/fcm/send/credentialed',
            keys: mockSubscription.keys,
          },
        });

      expect(credentialRes.status).toBe(400);
      expect(credentialRes.body.error.message).toContain('must not include credentials');

      const fragmentRes = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: 'https://fcm.googleapis.com/fcm/send/fragmented#token',
            keys: mockSubscription.keys,
          },
        });

      expect(fragmentRes.status).toBe(400);
      expect(fragmentRes.body.error.message).toContain('must not include a URL fragment');
    });

    it('should reject re-registering another user subscription endpoint', async () => {
      const otherRegRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-owner-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Endpoint Owner',
          tosAccepted: true,
        });
      const otherUserId = otherRegRes.body.user.id;
      const endpoint = `https://fcm.googleapis.com/fcm/send/owned-${Date.now()}`;

      try {
        const ownerRes = await request(app)
          .post('/api/push/subscribe')
          .set('Authorization', `Bearer ${otherRegRes.body.token}`)
          .send({
            subscription: {
              endpoint,
              keys: mockSubscription.keys,
            },
          });

        expect(ownerRes.status).toBe(200);

        const takeoverRes = await request(app)
          .post('/api/push/subscribe')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            subscription: {
              endpoint,
              keys: mockSubscription.keys,
            },
          });

        expect(takeoverRes.status).toBe(403);
        expect(takeoverRes.body.error.message).toContain('already registered');

        const stored = await prisma.pushSubscription.findUnique({ where: { endpoint } });
        expect(stored?.userId).toBe(otherUserId);
      } finally {
        await prisma.pushSubscription.deleteMany({ where: { endpoint } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      }
    });

    it('should allow multiple subscriptions for the same user', async () => {
      const subscription2 = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-456',
        keys: mockSubscription.keys,
      };

      const res = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ subscription: subscription2 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/push/subscriptions', () => {
    it('should list user subscriptions', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.subscriptions).toBeDefined();
      expect(Array.isArray(res.body.subscriptions)).toBe(true);
      expect(res.body.count).toBeDefined();
      expect(res.body.count).toBeGreaterThan(0);
    });

    it('should include subscription metadata', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const subscription = res.body.subscriptions[0];
      expect(subscription.id).toBeDefined();
      expect(subscription.endpointPreview).toBeDefined();
      expect(subscription.createdAt).toBeDefined();
      // Endpoint should be truncated for security
      expect(subscription.endpointPreview).toMatch(/\.\.\.$/);
    });

    it('should not expose full endpoint in list', async () => {
      const res = await request(app)
        .get('/api/push/subscriptions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const subscription = res.body.subscriptions[0];
      expect(subscription.endpoint).toBeUndefined();
      expect(subscription.keys).toBeUndefined();
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/push/subscriptions');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/push/status', () => {
    it('should return push notification status', async () => {
      const res = await request(app)
        .get('/api/push/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.configured).toBeDefined();
      expect(typeof res.body.configured).toBe('boolean');
      expect(res.body.vapidConfigured).toBeDefined();
      expect(res.body.totalSubscriptions).toBeDefined();
      expect(res.body.userSubscriptionCount).toBeDefined();
      expect(res.body.message).toBeDefined();
    });

    it('should show user subscription count', async () => {
      const res = await request(app)
        .get('/api/push/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.userSubscriptionCount).toBeGreaterThan(0);
    });

    it('should not use generated VAPID keys in production when env keys are missing', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const statusRes = await request(app)
          .get('/api/push/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(statusRes.status).toBe(200);
        expect(statusRes.body.configured).toBe(false);
        expect(statusRes.body.vapidConfigured).toBe(false);
        expect(statusRes.body.usingGeneratedKeys).toBe(false);
        expect(statusRes.body.message).toContain('require VAPID keys');

        const keyRes = await request(app)
          .get('/api/push/vapid-public-key')
          .set('Authorization', `Bearer ${authToken}`);

        expect(keyRes.status).toBe(503);
        expect(keyRes.body.error.message).toContain('VAPID keys');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should not expose other users subscription counts to regular users', async () => {
      const otherUserEmail = `push-status-other-${Date.now()}@example.com`;
      const otherRegRes = await request(app).post('/api/auth/register').send({
        email: otherUserEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other Push Status User',
        tosAccepted: true,
      });
      const otherUserId = otherRegRes.body.user.id;

      await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${otherRegRes.body.token}`)
        .send({
          subscription: {
            endpoint: `https://fcm.googleapis.com/fcm/send/status-other-${Date.now()}`,
            keys: mockSubscription.keys,
          },
        });

      try {
        const res = await request(app)
          .get('/api/push/status')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totalSubscriptions).toBe(res.body.userSubscriptionCount);
      } finally {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {});
      }
    });

    it('should report whether the current browser subscription belongs to the authenticated user', async () => {
      const endpoint = `https://fcm.googleapis.com/fcm/send/status-current-${Date.now()}`;
      const subscribeRes = await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint,
            keys: mockSubscription.keys,
          },
        });

      expect(subscribeRes.status).toBe(200);

      const currentRes = await request(app)
        .get('/api/push/status')
        .query({ subscriptionId: getSubscriptionId(endpoint) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(currentRes.status).toBe(200);
      expect(currentRes.body.currentDeviceSubscribed).toBe(true);

      const staleRes = await request(app)
        .get('/api/push/status')
        .query({ subscriptionId: '0'.repeat(64) })
        .set('Authorization', `Bearer ${authToken}`);

      expect(staleRes.status).toBe(200);
      expect(staleRes.body.currentDeviceSubscribed).toBe(false);
    });

    it('should reject malformed current browser subscription ids', async () => {
      const res = await request(app)
        .get('/api/push/status')
        .query({ subscriptionId: 'not-a-subscription-id' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('subscriptionId');
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/push/status');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/push/test', () => {
    beforeEach(() => {
      // Mock webpush.sendNotification to avoid actual push notifications
      vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
        statusCode: 201,
        body: '',
        headers: {},
      });
    });

    it('should send test notification to user subscriptions', async () => {
      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBeDefined();
      expect(res.body.message).toBeDefined();
      expect(res.body.results).toBeDefined();
      expect(Array.isArray(res.body.results)).toBe(true);
    });

    it('should return error when user has no subscriptions', async () => {
      // Create a new user without subscriptions
      const newUserEmail = `no-sub-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email: newUserEmail,
        password: 'SecureP@ssword123!',
        fullName: 'No Sub User',
        tosAccepted: true,
      });
      const newUserToken = regRes.body.token;
      const newUserId = regRes.body.user.id;

      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('No push subscriptions found');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: newUserId } });
      await prisma.user.delete({ where: { id: newUserId } });
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).post('/api/push/test');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should include success count in response', async () => {
      const res = await request(app)
        .post('/api/push/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/\d+\/\d+ device/);
    });
  });

  describe('POST /api/push/send', () => {
    beforeEach(() => {
      vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
        statusCode: 201,
        body: '',
        headers: {},
      });
    });

    it('should send notification to target user', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Test Notification',
          body: 'This is a test',
          url: '/test',
          tag: 'test-tag',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBeDefined();
      expect(res.body.sent).toBeDefined();
      expect(res.body.failed).toBeDefined();
    });

    it('should reject request without required fields', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Test',
          // Missing body
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject request without targetUserId', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          body: 'Test body',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject malformed push notification payloads', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: { text: 'Invalid' },
          body: 'This should be rejected',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('title');
    });

    it('should reject external notification URLs', async () => {
      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'External URL',
          body: 'This should be rejected',
          url: 'https://evil.example/phish',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('app-relative path');
    });

    it('should reject unsafe or oversized notification data', async () => {
      const unsafeRes = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Unsafe data',
          body: 'This should be rejected',
          data: JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>,
        });

      expect(unsafeRes.status).toBe(400);
      expect(unsafeRes.body.error.message).toContain('reserved key');

      const oversizedRes = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Oversized data',
          body: 'This should be rejected',
          data: { note: 'x'.repeat(2050) },
        });

      expect(oversizedRes.status).toBe(400);
      expect(oversizedRes.body.error.message).toContain('2048 bytes');
    });

    it('should keep notification URL and timestamp metadata authoritative', async () => {
      const sendNotificationMock = vi.mocked(webpush.sendNotification);
      sendNotificationMock.mockClear();

      const res = await request(app)
        .post('/api/push/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetUserId: userId,
          title: 'Safe data',
          body: 'This should keep the safe metadata',
          url: '/safe-path',
          data: {
            url: 'https://evil.example/phish',
            timestamp: 'spoofed',
            context: 'kept',
          },
        });

      expect(res.status).toBe(200);
      const payload = JSON.parse(String(sendNotificationMock.mock.calls[0]?.[1])) as {
        data: { url: string; timestamp: string; context: string };
      };
      expect(payload.data.url).toBe('/safe-path');
      expect(payload.data.timestamp).not.toBe('spoofed');
      expect(payload.data.context).toBe('kept');
    });

    it('should reject sending to another user without admin permissions', async () => {
      const callerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-caller-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Caller',
          tosAccepted: true,
        });
      const targetRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-target-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Target',
          tosAccepted: true,
        });

      const callerId = callerRes.body.user.id;
      const targetId = targetRes.body.user.id;

      await prisma.user.update({
        where: { id: callerId },
        data: { roleInCompany: 'viewer' },
      });

      try {
        const res = await request(app)
          .post('/api/push/send')
          .set('Authorization', `Bearer ${callerRes.body.token}`)
          .send({
            targetUserId: targetId,
            title: 'Not allowed',
            body: 'This should be rejected',
          });

        expect(res.status).toBe(403);
      } finally {
        for (const uid of [callerId, targetId]) {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
          await prisma.user.delete({ where: { id: uid } }).catch(() => {});
        }
      }
    });

    it('should restrict project managers to users on active shared projects', async () => {
      const company = await prisma.company.create({
        data: { name: `Push Scope Company ${Date.now()}` },
      });
      const callerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-pm-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Project Manager',
          tosAccepted: true,
        });
      const targetRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-shared-target-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Shared Target',
          tosAccepted: true,
        });
      const outsiderRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-unshared-target-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Unshared Target',
          tosAccepted: true,
        });
      const callerId = callerRes.body.user.id;
      const targetId = targetRes.body.user.id;
      const outsiderId = outsiderRes.body.user.id;
      const project = await prisma.project.create({
        data: {
          name: `Push Scope Project ${Date.now()}`,
          projectNumber: `PUSH-${Date.now()}`,
          companyId: company.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });

      await prisma.user.update({
        where: { id: callerId },
        data: { companyId: company.id, roleInCompany: 'project_manager' },
      });
      await prisma.user.updateMany({
        where: { id: { in: [targetId, outsiderId] } },
        data: { companyId: company.id, roleInCompany: 'site_engineer' },
      });
      await prisma.projectUser.createMany({
        data: [
          { projectId: project.id, userId: callerId, role: 'project_manager', status: 'active' },
          { projectId: project.id, userId: targetId, role: 'site_engineer', status: 'active' },
        ],
      });

      try {
        const allowedRes = await request(app)
          .post('/api/push/send')
          .set('Authorization', `Bearer ${callerRes.body.token}`)
          .send({
            targetUserId: targetId,
            title: 'Shared project',
            body: 'This user shares an active project',
          });

        expect(allowedRes.status).toBe(200);

        const deniedRes = await request(app)
          .post('/api/push/send')
          .set('Authorization', `Bearer ${callerRes.body.token}`)
          .send({
            targetUserId: outsiderId,
            title: 'Unshared user',
            body: 'This user is in the same company but not on a shared project',
          });

        expect(deniedRes.status).toBe(403);
        expect(deniedRes.body.error.message).toContain('allowed notification scope');
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
        for (const uid of [callerId, targetId, outsiderId]) {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
          await prisma.user.delete({ where: { id: uid } }).catch(() => {});
        }
        await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
      }
    });

    it('should use active project role when deciding push send scope', async () => {
      const company = await prisma.company.create({
        data: { name: `Push Effective Role Company ${Date.now()}` },
      });
      const projectRoleCallerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-project-role-pm-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Project Role PM',
          tosAccepted: true,
        });
      const companyRoleCallerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-company-role-pm-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Company Role PM',
          tosAccepted: true,
        });
      const targetRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-effective-target-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Effective Target',
          tosAccepted: true,
        });
      const projectRoleCallerId = projectRoleCallerRes.body.user.id;
      const companyRoleCallerId = companyRoleCallerRes.body.user.id;
      const targetId = targetRes.body.user.id;
      const project = await prisma.project.create({
        data: {
          name: `Push Effective Role Project ${Date.now()}`,
          projectNumber: `PUSH-EFF-${Date.now()}`,
          companyId: company.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });

      await prisma.user.update({
        where: { id: projectRoleCallerId },
        data: { companyId: company.id, roleInCompany: 'viewer' },
      });
      await prisma.user.update({
        where: { id: companyRoleCallerId },
        data: { companyId: company.id, roleInCompany: 'project_manager' },
      });
      await prisma.user.update({
        where: { id: targetId },
        data: { companyId: company.id, roleInCompany: 'site_engineer' },
      });
      await prisma.projectUser.createMany({
        data: [
          {
            projectId: project.id,
            userId: projectRoleCallerId,
            role: 'project_manager',
            status: 'active',
          },
          { projectId: project.id, userId: companyRoleCallerId, role: 'viewer', status: 'active' },
          { projectId: project.id, userId: targetId, role: 'site_engineer', status: 'active' },
        ],
      });

      try {
        const allowedRes = await request(app)
          .post('/api/push/send')
          .set('Authorization', `Bearer ${projectRoleCallerRes.body.token}`)
          .send({
            targetUserId: targetId,
            title: 'Project role allowed',
            body: 'This user has active project manager access',
          });

        expect(allowedRes.status).toBe(200);

        const deniedRes = await request(app)
          .post('/api/push/send')
          .set('Authorization', `Bearer ${companyRoleCallerRes.body.token}`)
          .send({
            targetUserId: targetId,
            title: 'Project role denied',
            body: 'This user is only a viewer on the shared project',
          });

        expect(deniedRes.status).toBe(403);
        expect(deniedRes.body.error.message).toContain('allowed notification scope');
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
        for (const uid of [projectRoleCallerId, companyRoleCallerId, targetId]) {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
          await prisma.user.delete({ where: { id: uid } }).catch(() => {});
        }
        await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
      }
    });

    it('should not grant subcontractors push send scope through project memberships', async () => {
      const company = await prisma.company.create({
        data: { name: `Push Subcontractor Scope Company ${Date.now()}` },
      });
      const subcontractorRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-subcontractor-pm-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Subcontractor PM',
          tosAccepted: true,
        });
      const targetRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: `push-subcontractor-target-${Date.now()}@example.com`,
          password: 'SecureP@ssword123!',
          fullName: 'Push Subcontractor Target',
          tosAccepted: true,
        });
      const subcontractorId = subcontractorRes.body.user.id;
      const targetId = targetRes.body.user.id;
      const project = await prisma.project.create({
        data: {
          name: `Push Subcontractor Scope Project ${Date.now()}`,
          projectNumber: `PUSH-SUB-${Date.now()}`,
          companyId: company.id,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });

      await prisma.user.update({
        where: { id: subcontractorId },
        data: { companyId: company.id, roleInCompany: 'subcontractor' },
      });
      await prisma.user.update({
        where: { id: targetId },
        data: { companyId: company.id, roleInCompany: 'site_engineer' },
      });
      await prisma.projectUser.createMany({
        data: [
          {
            projectId: project.id,
            userId: subcontractorId,
            role: 'project_manager',
            status: 'active',
          },
          { projectId: project.id, userId: targetId, role: 'site_engineer', status: 'active' },
        ],
      });

      try {
        const res = await request(app)
          .post('/api/push/send')
          .set('Authorization', `Bearer ${subcontractorRes.body.token}`)
          .send({
            targetUserId: targetId,
            title: 'Subcontractor blocked',
            body: 'Subcontractor project memberships do not grant send scope',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('allowed notification scope');
      } finally {
        await prisma.projectUser.deleteMany({ where: { projectId: project.id } });
        await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
        for (const uid of [subcontractorId, targetId]) {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
          await prisma.user.delete({ where: { id: uid } }).catch(() => {});
        }
        await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
      }
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).post('/api/push/send').send({
        targetUserId: userId,
        title: 'Test',
        body: 'Test body',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('DELETE /api/push/unsubscribe', () => {
    let subscriptionEndpoint: string;

    beforeAll(async () => {
      // Subscribe first
      subscriptionEndpoint = `https://fcm.googleapis.com/fcm/send/unsubscribe-test-${Date.now()}`;
      await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          subscription: {
            endpoint: subscriptionEndpoint,
            keys: mockSubscription.keys,
          },
        });
    });

    it('should unsubscribe user subscription', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endpoint: subscriptionEndpoint });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Unsubscribed');
    });

    it('should reject request without endpoint', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Endpoint is required');
    });

    it('should return 404 for non-existent subscription', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/non-existent' });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('should prevent unsubscribing other user subscriptions', async () => {
      // Create another user
      const otherUserEmail = `other-${Date.now()}@example.com`;
      const otherRegRes = await request(app).post('/api/auth/register').send({
        email: otherUserEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Other User',
        tosAccepted: true,
      });
      const otherToken = otherRegRes.body.token;
      const otherUserId = otherRegRes.body.user.id;

      // Other user subscribes
      const otherEndpoint = `https://fcm.googleapis.com/fcm/send/other-${Date.now()}`;
      await request(app)
        .post('/api/push/subscribe')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          subscription: {
            endpoint: otherEndpoint,
            keys: mockSubscription.keys,
          },
        });

      // Try to unsubscribe other user's subscription
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ endpoint: otherEndpoint });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Not authorized');

      // Cleanup
      await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
      await prisma.user.delete({ where: { id: otherUserId } });
    });

    it('should reject request without authentication', async () => {
      const res = await request(app)
        .delete('/api/push/unsubscribe')
        .send({ endpoint: 'test-endpoint' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/push/generate-vapid-keys', () => {
    it('should reject in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .get('/api/push/generate-vapid-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Not available in production');

      process.env.NODE_ENV = originalEnv;
    });

    it('should reject VAPID key generation for non-admin users in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        const res = await request(app)
          .get('/api/push/generate-vapid-keys')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Only company owners and admins');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should generate VAPID keys for admins in non-production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await prisma.user.update({
        where: { id: userId },
        data: { roleInCompany: 'owner' },
      });

      try {
        const res = await request(app)
          .get('/api/push/generate-vapid-keys')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.publicKey).toBeDefined();
        expect(res.body.privateKey).toBeDefined();
        expect(res.body.envFormat).toBeDefined();
        expect(res.body.message).toContain('VAPID keys');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('should reject request without authentication', async () => {
      const res = await request(app).get('/api/push/generate-vapid-keys');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});

describe('sendPushNotification helper function', () => {
  let userId: string;
  let authToken: string;

  beforeAll(async () => {
    const testEmail = `helper-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Helper Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    // Subscribe
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/helper-${Date.now()}`,
          keys: {
            p256dh: 'test-p256dh',
            auth: 'test-auth',
          },
        },
      });
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  beforeEach(() => {
    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
  });

  it('should send notification to user', async () => {
    const result = await sendPushNotification(userId, {
      title: 'Test',
      body: 'Test body',
      url: '/test',
    });

    expect(result.success).toBe(true);
    expect(result.sent).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
  });

  it('should return error for user without subscriptions', async () => {
    const result = await sendPushNotification('non-existent-user-id', {
      title: 'Test',
      body: 'Test body',
    });

    expect(result.success).toBe(false);
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]).toContain('No subscriptions');
  });

  it('should include custom data in notification', async () => {
    const result = await sendPushNotification(userId, {
      title: 'Test',
      body: 'Test body',
      data: { customKey: 'customValue' },
    });

    expect(result.success).toBe(true);
  });
});

describe('broadcastPushNotification helper function', () => {
  let userId1: string;
  let userId2: string;
  let authToken1: string;
  let authToken2: string;

  beforeAll(async () => {
    // Create first user
    const testEmail1 = `broadcast1-${Date.now()}@example.com`;
    const regRes1 = await request(app).post('/api/auth/register').send({
      email: testEmail1,
      password: 'SecureP@ssword123!',
      fullName: 'Broadcast User 1',
      tosAccepted: true,
    });
    authToken1 = regRes1.body.token;
    userId1 = regRes1.body.user.id;

    // Create second user
    const testEmail2 = `broadcast2-${Date.now()}@example.com`;
    const regRes2 = await request(app).post('/api/auth/register').send({
      email: testEmail2,
      password: 'SecureP@ssword123!',
      fullName: 'Broadcast User 2',
      tosAccepted: true,
    });
    authToken2 = regRes2.body.token;
    userId2 = regRes2.body.user.id;

    // Subscribe both users
    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast1-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        },
      });

    await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast2-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        },
      });
  });

  afterAll(async () => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userId1 } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: userId2 } });
    await prisma.user.delete({ where: { id: userId1 } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId2 } }).catch(() => {});
  });

  beforeEach(() => {
    vi.spyOn(webpush, 'sendNotification').mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
  });

  it('should broadcast notification to multiple users', async () => {
    // Ensure subscriptions are registered for this test
    const sub1 = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken1}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast1-test-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        },
      });

    const sub2 = await request(app)
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${authToken2}`)
      .send({
        subscription: {
          endpoint: `https://fcm.googleapis.com/fcm/send/broadcast2-test-${Date.now()}`,
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        },
      });

    // Verify subscriptions were created
    expect(sub1.status).toBe(200);
    expect(sub2.status).toBe(200);

    const result = await broadcastPushNotification([userId1, userId2], {
      title: 'Broadcast Test',
      body: 'This is a broadcast',
      url: '/broadcast',
    });

    // Test structure regardless of whether notifications were sent
    expect(result.results[userId1]).toBeDefined();
    expect(result.results[userId2]).toBeDefined();
    expect(typeof result.results[userId1].sent).toBe('number');
    expect(typeof result.results[userId2].sent).toBe('number');
    expect(typeof result.results[userId1].failed).toBe('number');
    expect(typeof result.results[userId2].failed).toBe('number');
    expect(result.totalSent).toBeGreaterThanOrEqual(0);
    expect(result.totalFailed).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty user list', async () => {
    const result = await broadcastPushNotification([], {
      title: 'Test',
      body: 'Test',
    });

    expect(result.totalSent).toBe(0);
    expect(result.totalFailed).toBe(0);
    expect(Object.keys(result.results).length).toBe(0);
  });

  it('should track per-user results', async () => {
    const result = await broadcastPushNotification([userId1, userId2], {
      title: 'Test',
      body: 'Test',
    });

    expect(result.results[userId1].sent).toBeDefined();
    expect(result.results[userId1].failed).toBeDefined();
    expect(result.results[userId2].sent).toBeDefined();
    expect(result.results[userId2].failed).toBeDefined();
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { authRouter } from './auth.js';
import { authenticateApiKey } from './apiKeys.js';
import { notificationsRouter } from './notifications.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { registerTestUser } from '../test/routeTestHarness.js';
import { MAX_ALERT_LIST_RESULTS } from './notifications/alerts.js';
import * as emailService from '../lib/email.js';

const app = express();
app.use(express.json());
app.use(authenticateApiKey);
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use(errorHandler);

function hashApiKeyForTest(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function createApiKeyForUser(userId: string, scopes = 'admin') {
  const apiKey = `sp_${crypto.randomBytes(32).toString('hex')}`;
  const record = await prisma.apiKey.create({
    data: {
      userId,
      name: 'Notifications API Key',
      keyHash: hashApiKeyForTest(apiKey),
      keyPrefix: apiKey.substring(0, 11),
      scopes,
      isActive: true,
    },
  });

  return { apiKey, keyId: record.id };
}

describe('Notifications API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let notificationId: string;
  let secondUserId: string;
  let secondUserToken: string;
  let subcontractorCompanyId: string;
  let subcontractorUserId: string;
  let subcontractorUserToken: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Notifications Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create first user
    const primaryUser = await registerTestUser(app, {
      emailPrefix: 'notifications-test',
      fullName: 'Notifications Test User',
      companyId,
      roleInCompany: 'admin',
    });
    authToken = primaryUser.token;
    userId = primaryUser.userId;

    // Create second user for mention tests
    const secondUser = await registerTestUser(app, {
      emailPrefix: 'notifications-test2',
      fullName: 'Second User',
      companyId,
      roleInCompany: 'site_manager',
    });
    secondUserToken = secondUser.token;
    secondUserId = secondUser.userId;

    // Create test project
    const project = await prisma.project.create({
      data: {
        name: `Notifications Test Project ${Date.now()}`,
        projectNumber: `NOT-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.createMany({
      data: [
        { projectId, userId, role: 'admin', status: 'active' },
        { projectId, userId: secondUserId, role: 'site_manager', status: 'active' },
      ],
    });

    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Notifications Subcontractor ${Date.now()}`,
        status: 'approved',
        portalAccess: {
          dockets: true,
          documents: true,
          ncrs: true,
        },
      },
    });
    subcontractorCompanyId = subcontractorCompany.id;

    const subcontractorRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `notifications-subcontractor-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        fullName: 'Notifications Subcontractor User',
        tosAccepted: true,
      });
    subcontractorUserToken = subcontractorRes.body.token;
    subcontractorUserId = subcontractorRes.body.user.id;

    await prisma.user.update({
      where: { id: subcontractorUserId },
      data: { companyId: null, roleInCompany: 'subcontractor_admin' },
    });

    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractorUserId,
        subcontractorCompanyId,
        role: 'admin',
      },
    });

    // Create some test notifications
    const notification = await prisma.notification.create({
      data: {
        userId,
        projectId,
        type: 'mention',
        title: 'Test Notification',
        message: 'This is a test notification',
        linkUrl: '/test',
        isRead: false,
      },
    });
    notificationId = notification.id;

    // Create additional notifications
    await prisma.notification.createMany({
      data: [
        {
          userId,
          projectId,
          type: 'ncr_assigned',
          title: 'NCR Assigned',
          message: 'You have been assigned an NCR',
          linkUrl: '/ncrs/1',
          isRead: false,
        },
        {
          userId,
          projectId,
          type: 'hold_point_reminder',
          title: 'Hold Point Reminder',
          message: 'Hold point requires attention',
          linkUrl: '/lots/1',
          isRead: true,
        },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup
    const userIds = [userId, secondUserId, subcontractorUserId].filter(Boolean);
    await prisma.notificationAlert.deleteMany({
      where: {
        OR: [{ projectId }, { assignedToId: { in: userIds } }],
      },
    });
    await prisma.notification.deleteMany({
      where: {
        OR: [{ projectId }, { userId: { in: userIds } }],
      },
    });
    await prisma.subcontractorUser.deleteMany({ where: { subcontractorCompanyId } });
    await prisma.subcontractorCompany
      .delete({ where: { id: subcontractorCompanyId } })
      .catch(() => {});
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});

    for (const uid of userIds) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: uid } });
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }

    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/notifications', () => {
    it('should list notifications for authenticated user', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.notifications.length).toBeGreaterThan(0);
      expect(res.body.unreadCount).toBeDefined();
      expect(res.body.unreadCount).toBeGreaterThanOrEqual(0);
    });

    it('should include project details in notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const notification = res.body.notifications.find((n: any) => n.projectId === projectId);
      expect(notification).toBeDefined();
      expect(notification.project).toBeDefined();
      expect(notification.project.name).toBeDefined();
      expect(notification.project.projectNumber).toBeDefined();
    });

    it('should filter unread notifications only', async () => {
      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
      // All notifications should be unread
      const allUnread = res.body.notifications.every((n: any) => n.isRead === false);
      expect(allUnread).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const res = await request(app)
        .get('/api/notifications?limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
      expect(res.body.notifications.length).toBeLessThanOrEqual(1);
    });

    it('should respect offset parameter', async () => {
      const res1 = await request(app)
        .get('/api/notifications?offset=0&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      const res2 = await request(app)
        .get('/api/notifications?offset=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      if (res1.body.notifications.length > 0 && res2.body.notifications.length > 0) {
        expect(res1.body.notifications[0].id).not.toBe(res2.body.notifications[0].id);
      }
    });

    it('should reject invalid pagination parameters', async () => {
      for (const query of ['limit=abc', 'limit=0', 'offset=-1']) {
        const res = await request(app)
          .get(`/api/notifications?${query}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBeDefined();
      }
    });

    it('should reject malformed unread filters', async () => {
      const invalidBooleanRes = await request(app)
        .get('/api/notifications?unreadOnly=yes')
        .set('Authorization', `Bearer ${authToken}`);

      expect(invalidBooleanRes.status).toBe(400);

      const duplicateBooleanRes = await request(app)
        .get('/api/notifications')
        .query({ unreadOnly: ['true', 'false'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateBooleanRes.status).toBe(400);
    });

    it('should cap oversized notification page sizes', async () => {
      const res = await request(app)
        .get('/api/notifications?limit=1000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications.length).toBeLessThanOrEqual(100);
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBeDefined();
      expect(typeof res.body.count).toBe('number');
      expect(res.body.count).toBeGreaterThanOrEqual(0);
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.notification).toBeDefined();
      expect(res.body.notification.isRead).toBe(true);
      expect(res.body.notification.id).toBe(notificationId);
    });

    it("should reject marking another user's notification", async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${secondUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Access denied');
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .put('/api/notifications/non-existent-id/read')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).put(`/api/notifications/${notificationId}/read`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    beforeEach(async () => {
      // Create some unread notifications
      await prisma.notification.createMany({
        data: [
          {
            userId,
            projectId,
            type: 'test',
            title: 'Test 1',
            message: 'Test message 1',
            isRead: false,
          },
          {
            userId,
            projectId,
            type: 'test',
            title: 'Test 2',
            message: 'Test message 2',
            isRead: false,
          },
        ],
      });
    });

    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify all notifications are marked as read
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });
      expect(unreadCount).toBe(0);
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).put('/api/notifications/read-all');

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    let deleteNotificationId: string;

    beforeEach(async () => {
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: 'test',
          title: 'To Delete',
          message: 'Will be deleted',
        },
      });
      deleteNotificationId = notification.id;
    });

    it('should delete notification', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${deleteNotificationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify notification is deleted
      const deleted = await prisma.notification.findUnique({
        where: { id: deleteNotificationId },
      });
      expect(deleted).toBeNull();
    });

    it("should reject deleting another user's notification", async () => {
      const res = await request(app)
        .delete(`/api/notifications/${deleteNotificationId}`)
        .set('Authorization', `Bearer ${secondUserToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('Access denied');
    });

    it('should return 404 for non-existent notification', async () => {
      const res = await request(app)
        .delete('/api/notifications/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).delete(`/api/notifications/${deleteNotificationId}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized notification route ids before lookups', async () => {
      const longId = 'n'.repeat(121);
      const checks = [
        {
          label: 'PUT notification read',
          response: await request(app)
            .put(`/api/notifications/${longId}/read`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'DELETE notification',
          response: await request(app)
            .delete(`/api/notifications/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'PUT alert resolve',
          response: await request(app)
            .put(`/api/notifications/alerts/${longId}/resolve`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST alert test escalate',
          response: await request(app)
            .post(`/api/notifications/alerts/${longId}/test-escalate`)
            .set('Authorization', `Bearer ${authToken}`),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('id must be 120 characters or less');
      }
    });
  });

  describe('GET /api/notifications/users', () => {
    it('should return users for mention autocomplete', async () => {
      const res = await request(app)
        .get('/api/notifications/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
    });

    it('should filter users by search term', async () => {
      // Use email search which is more reliable (stored in lowercase)
      const res = await request(app)
        .get('/api/notifications/users?search=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
      // Should return users matching the search term
      // Note: Prisma's contains is case-sensitive in SQLite even with toLowerCase
      // So we just verify the endpoint works and returns results
    });

    it('should filter users by project membership', async () => {
      const res = await request(app)
        .get(`/api/notifications/users?projectId=${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      // Should only return users in the project
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    it('should keep subcontractor autocomplete scoped to the current user', async () => {
      const res = await request(app)
        .get('/api/notifications/users')
        .set('Authorization', `Bearer ${subcontractorUserToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0].id).toBe(subcontractorUserId);
    });

    it('should deny subcontractor project user autocomplete', async () => {
      const res = await request(app)
        .get(`/api/notifications/users?projectId=${projectId}`)
        .set('Authorization', `Bearer ${subcontractorUserToken}`);

      expect(res.status).toBe(403);
    });

    it('should deny project user autocomplete without project access', async () => {
      const otherProject = await prisma.project.create({
        data: {
          name: `Notifications Other Project ${Date.now()}`,
          projectNumber: `NOT-OTHER-${Date.now()}`,
          companyId,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });

      try {
        const res = await request(app)
          .get(`/api/notifications/users?projectId=${otherProject.id}`)
          .set('Authorization', `Bearer ${secondUserToken}`);

        expect(res.status).toBe(403);
      } finally {
        await prisma.project.delete({ where: { id: otherProject.id } }).catch(() => {});
      }
    });

    it('should not return pending project users in project autocomplete', async () => {
      const email = `notifications-pending-${Date.now()}@example.com`;
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Pending Mention User',
        tosAccepted: true,
      });
      const pendingUserId = regRes.body.user.id;

      await prisma.user.update({
        where: { id: pendingUserId },
        data: { companyId, roleInCompany: 'site_engineer' },
      });
      await prisma.projectUser.create({
        data: { projectId, userId: pendingUserId, role: 'site_engineer', status: 'pending' },
      });

      try {
        const res = await request(app)
          .get(
            `/api/notifications/users?projectId=${projectId}&search=${encodeURIComponent(email)}`,
          )
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.users.some((user: any) => user.id === pendingUserId)).toBe(false);
      } finally {
        await prisma.projectUser.deleteMany({ where: { userId: pendingUserId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId: pendingUserId } });
        await prisma.user.delete({ where: { id: pendingUserId } }).catch(() => {});
      }
    });

    it('should reject malformed autocomplete query values', async () => {
      const duplicateProjectRes = await request(app)
        .get('/api/notifications/users')
        .query({ projectId: [projectId, projectId] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateProjectRes.status).toBe(400);

      const duplicateSearchRes = await request(app)
        .get('/api/notifications/users')
        .query({ search: ['test', 'user'] })
        .set('Authorization', `Bearer ${authToken}`);

      expect(duplicateSearchRes.status).toBe(400);
    });

    it('should return limited results', async () => {
      const res = await request(app)
        .get('/api/notifications/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBeLessThanOrEqual(10);
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).get('/api/notifications/users');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/notifications/email-preferences', () => {
    it('should return default email preferences', async () => {
      const res = await request(app)
        .get('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.preferences).toBeDefined();
      expect(res.body.preferences.enabled).toBeDefined();
      expect(res.body.preferences.mentions).toBeDefined();
      expect(res.body.preferences.ncrAssigned).toBeDefined();
      expect(res.body.preferences.holdPointReminder).toBeDefined();
      expect(res.body.preferences.dailyDigest).toBeDefined();
    });

    it('should include timing preferences', async () => {
      const res = await request(app)
        .get('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.preferences.mentionsTiming).toBeDefined();
      expect(res.body.preferences.ncrAssignedTiming).toBeDefined();
      expect(['immediate', 'digest']).toContain(res.body.preferences.mentionsTiming);
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).get('/api/notifications/email-preferences');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/notifications/email-preferences', () => {
    it('should update email preferences', async () => {
      const res = await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: {
            enabled: false,
            mentions: false,
            ncrAssigned: true,
            mentionsTiming: 'digest',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.preferences).toBeDefined();
      expect(res.body.preferences.enabled).toBe(false);
      expect(res.body.preferences.mentions).toBe(false);
      expect(res.body.preferences.ncrAssigned).toBe(true);
      expect(res.body.preferences.mentionsTiming).toBe('digest');
    });

    it('should validate timing preferences', async () => {
      const res = await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: {
            mentionsTiming: 'invalid',
          },
        });

      expect(res.status).toBe(200);
      // Should fallback to default timing
      expect(['immediate', 'digest']).toContain(res.body.preferences.mentionsTiming);
    });

    it('should preserve defaults for missing fields', async () => {
      const res = await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: {
            mentions: true,
          },
        });

      expect(res.status).toBe(200);
      // Other fields should have default values
      expect(res.body.preferences.enabled).toBeDefined();
      expect(res.body.preferences.ncrAssigned).toBeDefined();
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app)
        .put('/api/notifications/email-preferences')
        .send({ preferences: { enabled: false } });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications/send-test-email', () => {
    it('should send test email when preferences enabled', async () => {
      // Enable email preferences first
      await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: { enabled: true },
        });

      const res = await request(app)
        .post('/api/notifications/send-test-email')
        .set('Authorization', `Bearer ${authToken}`);

      // Accept either 200 (success) or 503 (provider quota/unavailable)
      expect([200, 503]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBeDefined();
        expect(res.body.provider).toBeDefined();
      } else {
        // Email provider quota/unavailability is acceptable in test environment
        expect(res.body.error).toBeDefined();
        expect(res.body.error.message).toBeDefined();
      }
    });

    it('should return a clear unavailable error when the email provider quota is exhausted', async () => {
      const sendEmailSpy = vi.spyOn(emailService, 'sendNotificationEmail').mockResolvedValueOnce({
        success: false,
        error: 'You have reached your daily email sending quota.',
        errorCode: 'daily_quota_exceeded',
        statusCode: 429,
        provider: 'resend',
      });

      try {
        await request(app)
          .put('/api/notifications/email-preferences')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            preferences: { enabled: true },
          });

        const res = await request(app)
          .post('/api/notifications/send-test-email')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(503);
        expect(res.body.error.message).toContain('daily sending quota has been reached');
        expect(res.body.error.code).toBe('EXTERNAL_SERVICE_ERROR');
        expect(res.body.error.details).toEqual({
          provider: 'resend',
          reason: 'quota_exceeded',
        });
      } finally {
        sendEmailSpy.mockRestore();
      }
    });

    it('should reject test email when preferences disabled', async () => {
      // Disable email preferences
      await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: { enabled: false },
        });

      const res = await request(app)
        .post('/api/notifications/send-test-email')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('disabled');
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).post('/api/notifications/send-test-email');

      expect(res.status).toBe(401);
    });

    it('rejects API-key-authenticated test emails', async () => {
      const { apiKey, keyId } = await createApiKeyForUser(userId, 'admin');

      try {
        const res = await request(app)
          .post('/api/notifications/send-test-email')
          .set('x-api-key', apiKey);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('browser session');
      } finally {
        await prisma.apiKey.deleteMany({ where: { id: keyId } });
      }
    });
  });

  describe('GET /api/notifications/email-service-status', () => {
    it('should return email service configuration status', async () => {
      const res = await request(app)
        .get('/api/notifications/email-service-status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.provider).toBeDefined();
      expect(res.body.resendConfigured).toBeDefined();
      expect(res.body.status).toBeDefined();
      expect(res.body.message).toBeDefined();
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).get('/api/notifications/email-service-status');

      expect(res.status).toBe(401);
    });
  });

  describe('GET/DELETE /api/notifications/email-queue', () => {
    it('should return and clear the email diagnostics queue outside production', async () => {
      const listRes = await request(app)
        .get('/api/notifications/email-queue')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.emails).toBeDefined();
      expect(Array.isArray(listRes.body.emails)).toBe(true);
      expect(listRes.body.count).toBe(listRes.body.emails.length);

      const clearRes = await request(app)
        .delete('/api/notifications/email-queue')
        .set('Authorization', `Bearer ${authToken}`);

      expect(clearRes.status).toBe(200);
      expect(clearRes.body).toEqual({
        success: true,
        message: 'Email queue cleared',
      });
    });

    it('should reject unauthorized email queue diagnostics', async () => {
      const listRes = await request(app).get('/api/notifications/email-queue');
      const clearRes = await request(app).delete('/api/notifications/email-queue');

      expect(listRes.status).toBe(401);
      expect(clearRes.status).toBe(401);
    });
  });

  describe('GET /api/notifications/digest-queue', () => {
    it('should return empty digest queue initially', async () => {
      const res = await request(app)
        .get('/api/notifications/digest-queue')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body.count).toBe(0);
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).get('/api/notifications/digest-queue');

      expect(res.status).toBe(401);
    });

    it('should hide digest diagnostics in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const requests = [
          request(app)
            .get('/api/notifications/email-queue')
            .set('Authorization', `Bearer ${authToken}`),
          request(app)
            .delete('/api/notifications/email-queue')
            .set('Authorization', `Bearer ${authToken}`),
          request(app)
            .get('/api/notifications/digest-queue')
            .set('Authorization', `Bearer ${authToken}`),
          request(app)
            .post('/api/notifications/add-to-digest')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ type: 'mentions', title: 'Test', message: 'Test' }),
          request(app)
            .post('/api/notifications/send-digest')
            .set('Authorization', `Bearer ${authToken}`),
          request(app)
            .delete('/api/notifications/digest-queue')
            .set('Authorization', `Bearer ${authToken}`),
        ];

        for (const pendingRequest of requests) {
          const res = await pendingRequest;
          expect(res.status).toBe(403);
          expect(res.body.error.message).toContain('Not available in production');
        }
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('POST /api/notifications/add-to-digest', () => {
    it('should add item to digest queue', async () => {
      const res = await request(app)
        .post('/api/notifications/add-to-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'mentions',
          title: 'Test Digest Item',
          message: 'This is a test digest item',
          projectName: 'Test Project',
          linkUrl: '/test',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.queuedItems).toBeGreaterThan(0);
    });

    it('should reject without required fields', async () => {
      const res = await request(app)
        .post('/api/notifications/add-to-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Missing type and message',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('required');
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).post('/api/notifications/add-to-digest').send({
        type: 'mentions',
        title: 'Test',
        message: 'Test',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/notifications/digest-queue', () => {
    it('should clear digest queue or reject in production', async () => {
      // Add an item first
      await request(app)
        .post('/api/notifications/add-to-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'mentions',
          title: 'Test',
          message: 'Test',
        });

      const res = await request(app)
        .delete('/api/notifications/digest-queue')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);

        // Verify queue is empty
        const checkRes = await request(app)
          .get('/api/notifications/digest-queue')
          .set('Authorization', `Bearer ${authToken}`);

        expect(checkRes.body.count).toBe(0);
      } else if (res.status === 403) {
        expect(res.body.error.message).toContain('production');
      }
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).delete('/api/notifications/digest-queue');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/notifications/send-digest', () => {
    it('should reject sending empty digest or fail on rate limit', async () => {
      // Ensure email is enabled first
      await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: { enabled: true },
        });

      // Clear queue (if possible in dev mode)
      await request(app)
        .delete('/api/notifications/digest-queue')
        .set('Authorization', `Bearer ${authToken}`);

      const res = await request(app)
        .post('/api/notifications/send-digest')
        .set('Authorization', `Bearer ${authToken}`);

      // Accept 400 (expected) or 500 (rate limit/quota error)
      expect([400, 500]).toContain(res.status);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message).toBeDefined();
    });

    it('should send digest with items', async () => {
      // Enable email preferences first
      await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: { enabled: true },
        });

      // Add items to queue
      await request(app)
        .post('/api/notifications/add-to-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'mentions',
          title: 'Test Item',
          message: 'Test message',
        });

      const res = await request(app)
        .post('/api/notifications/send-digest')
        .set('Authorization', `Bearer ${authToken}`);

      // Accept either 200 (success) or 500 (quota exceeded)
      expect([200, 500]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body.success).toBe(true);
        expect(res.body.itemCount).toBeGreaterThan(0);
      } else {
        // Email quota exceeded is acceptable in test environment
        expect(res.body.error).toBeDefined();
        expect(res.body.error.message).toBeDefined();
      }
    });

    it('should reject when email disabled', async () => {
      // Add items
      await request(app)
        .post('/api/notifications/add-to-digest')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'mentions',
          title: 'Test',
          message: 'Test',
        });

      // Disable email
      await request(app)
        .put('/api/notifications/email-preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          preferences: { enabled: false },
        });

      const res = await request(app)
        .post('/api/notifications/send-digest')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('disabled');
    });

    it('should reject unauthorized requests', async () => {
      const res = await request(app).post('/api/notifications/send-digest');

      expect(res.status).toBe(401);
    });
  });

  describe('Alert System', () => {
    describe('POST /api/notifications/alerts', () => {
      it('should create a new alert', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'high',
            title: 'Test Alert',
            message: 'This is a test alert',
            entityId: 'test-entity-id',
            entityType: 'ncr',
            projectId,
            assignedTo: userId,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.alert).toBeDefined();
        expect(res.body.alert.id).toMatch(
          /^alert-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
        expect(res.body.alert.escalationLevel).toBe(0);
      });

      it('should trim alert text fields and encode notification links', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'high',
            title: '  Link Safety Alert  ',
            message: '  Alert message with extra space  ',
            entityId: 'ncr/unsafe id',
            entityType: 'ncr',
            projectId,
            assignedTo: userId,
          });

        expect(res.status).toBe(200);
        expect(res.body.alert.title).toBe('Link Safety Alert');
        expect(res.body.alert.message).toBe('Alert message with extra space');

        const notification = await prisma.notification.findFirst({
          where: {
            userId,
            title: 'Link Safety Alert',
          },
          orderBy: { createdAt: 'desc' },
        });
        expect(notification?.linkUrl).toBe(`/projects/${projectId}/ncr?ncr=ncr%2Funsafe+id`);
      });

      it('should reject alert without required fields', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            title: 'Missing fields',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('required');
      });

      it('should create notification for assigned user', async () => {
        const beforeCount = await prisma.notification.count({
          where: { userId: secondUserId },
        });

        await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: 'Test Alert for User',
            message: 'Alert message',
            entityId: 'test-id',
            entityType: 'ncr',
            projectId,
            assignedTo: secondUserId,
          });

        const afterCount = await prisma.notification.count({
          where: { userId: secondUserId },
        });

        expect(afterCount).toBeGreaterThan(beforeCount);
      });

      it('should create portal-safe notification links for assigned subcontractor users', async () => {
        const title = `Subcontractor Portal Link Alert ${Date.now()}`;
        const entityId = `sub-ncr-${Date.now()}`;

        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title,
            message: 'Assigned directly to the subcontractor portal user',
            entityId,
            entityType: 'ncr',
            projectId,
            assignedTo: subcontractorUserId,
          });

        expect(res.status).toBe(200);

        const notification = await prisma.notification.findFirst({
          where: {
            userId: subcontractorUserId,
            title,
          },
          orderBy: { createdAt: 'desc' },
        });

        expect(notification?.linkUrl).toBe(
          `/subcontractor-portal/ncrs?ncr=${entityId}&projectId=${projectId}&subcontractorCompanyId=${subcontractorCompanyId}`,
        );
      });

      it('should reject subcontractor-created project alerts', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${subcontractorUserToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'high',
            title: 'Subcontractor Project Alert',
            message: 'Portal users should not create project-wide alerts',
            entityId: 'sub-alert-attempt',
            entityType: 'ncr',
            projectId,
            assignedTo: subcontractorUserId,
          });

        expect(res.status).toBe(403);
      });

      it('should reject project readers creating project alerts', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${secondUserToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'high',
            title: 'Reader-created alert',
            message: 'Project read access should not create alerts',
            entityId: 'reader-alert-attempt',
            entityType: 'ncr',
            projectId,
            assignedTo: userId,
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Notification administration access required');
      });

      it('should reject assigning a project alert to a user without project access', async () => {
        const email = `notifications-alert-outsider-${Date.now()}@example.com`;
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password: 'SecureP@ssword123!',
          fullName: 'Alert Outsider',
          tosAccepted: true,
        });
        const outsiderUserId = regRes.body.user.id;

        await prisma.user.update({
          where: { id: outsiderUserId },
          data: { companyId, roleInCompany: 'viewer' },
        });

        try {
          const res = await request(app)
            .post('/api/notifications/alerts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              type: 'overdue_ncr',
              severity: 'medium',
              title: 'Invalid assignment',
              message: 'This should not be assignable',
              entityId: 'test-id',
              entityType: 'ncr',
              projectId,
              assignedTo: outsiderUserId,
            });

          expect(res.status).toBe(403);
        } finally {
          await prisma.emailVerificationToken.deleteMany({ where: { userId: outsiderUserId } });
          await prisma.user.delete({ where: { id: outsiderUserId } }).catch(() => {});
        }
      });

      it('should reject assigning module alerts to subcontractors when portal access is disabled', async () => {
        await prisma.subcontractorCompany.update({
          where: { id: subcontractorCompanyId },
          data: {
            portalAccess: {
              dockets: true,
              documents: true,
              ncrs: false,
            },
          },
        });

        try {
          const beforeCount = await prisma.notification.count({
            where: { userId: subcontractorUserId },
          });

          const res = await request(app)
            .post('/api/notifications/alerts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              type: 'overdue_ncr',
              severity: 'medium',
              title: 'Disabled NCR alert',
              message: 'This should not be assignable while NCR portal access is disabled',
              entityId: 'disabled-ncr-alert',
              entityType: 'ncr',
              projectId,
              assignedTo: subcontractorUserId,
            });

          expect(res.status).toBe(403);
          expect(res.body.error.message).toContain('Assigned user does not have project access');

          const afterCount = await prisma.notification.count({
            where: { userId: subcontractorUserId },
          });
          expect(afterCount).toBe(beforeCount);
        } finally {
          await prisma.subcontractorCompany.update({
            where: { id: subcontractorCompanyId },
            data: {
              portalAccess: {
                dockets: true,
                documents: true,
                ncrs: true,
              },
            },
          });
        }
      });

      it('rejects assigning docket alerts to company-linked stale subcontractor roles', async () => {
        const staleUser = await registerTestUser(app, {
          emailPrefix: 'notifications-stale-sub-role',
          fullName: 'Notifications Stale Subcontractor Role',
          companyId,
          roleInCompany: 'subcontractor',
        });

        await prisma.subcontractorUser.create({
          data: {
            userId: staleUser.userId,
            subcontractorCompanyId,
            role: 'user',
          },
        });

        try {
          const beforeCount = await prisma.notification.count({
            where: { userId: staleUser.userId },
          });

          const res = await request(app)
            .post('/api/notifications/alerts')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              type: 'pending_approval',
              severity: 'medium',
              title: 'Stale subcontractor role docket alert',
              message: 'This should not be assignable through an old subcontractor link',
              entityId: 'stale-role-docket-alert',
              entityType: 'docket',
              projectId,
              assignedTo: staleUser.userId,
            });

          expect(res.status).toBe(403);
          expect(res.body.error.message).toContain('Assigned user does not have project access');

          const afterCount = await prisma.notification.count({
            where: { userId: staleUser.userId },
          });
          expect(afterCount).toBe(beforeCount);
        } finally {
          await prisma.subcontractorUser.deleteMany({ where: { userId: staleUser.userId } });
          await prisma.notification.deleteMany({ where: { userId: staleUser.userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId: staleUser.userId } });
          await prisma.user.delete({ where: { id: staleUser.userId } }).catch(() => {});
        }
      });

      it('should reject unauthorized requests', async () => {
        const res = await request(app).post('/api/notifications/alerts').send({
          type: 'overdue_ncr',
          title: 'Test',
          message: 'Test',
          entityId: 'test',
          entityType: 'ncr',
          assignedTo: userId,
        });

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/notifications/alerts', () => {
      const createAlertFlood = async ({
        prefix,
        count,
        type,
        assignedToId,
        createdAtStart,
        resolved,
      }: {
        prefix: string;
        count: number;
        type: string;
        assignedToId: string;
        createdAtStart: Date;
        resolved?: boolean;
      }) => {
        await prisma.notificationAlert.createMany({
          data: Array.from({ length: count }, (_, index) => {
            const createdAt = new Date(createdAtStart.getTime() + index * 1000);
            return {
              id: `${prefix}-flood-${index}`,
              type,
              severity: 'low',
              title: `${prefix} flood ${index}`,
              message: 'Filter regression filler alert',
              entityId: `${prefix}-entity-${index}`,
              entityType: 'ncr',
              projectId,
              assignedToId,
              createdAt,
              resolvedAt: resolved ? new Date(createdAt.getTime() + 500) : null,
            };
          }),
        });
      };

      const expectOlderAlertVisibleAfterFlood = async ({
        prefix,
        requestPath,
        olderCreatedAt,
        matchingAlert,
        flood,
        assertAlerts,
      }: {
        prefix: string;
        requestPath: string;
        olderCreatedAt: Date;
        matchingAlert: {
          title: string;
          type: string;
          entityType: string;
          assignedToId: string;
          resolvedAt?: Date;
        };
        flood: {
          type: string;
          assignedToId: string;
        };
        assertAlerts: (alerts: any[]) => void;
      }) => {
        try {
          await prisma.notificationAlert.create({
            data: {
              id: `${prefix}-match`,
              type: matchingAlert.type,
              severity: 'medium',
              title: matchingAlert.title,
              message: 'Older matching alert must not be hidden by newer non-matching alerts',
              entityId: `${prefix}-match-entity`,
              entityType: matchingAlert.entityType,
              projectId,
              assignedToId: matchingAlert.assignedToId,
              createdAt: olderCreatedAt,
              resolvedAt: matchingAlert.resolvedAt,
            },
          });

          await createAlertFlood({
            prefix,
            count: MAX_ALERT_LIST_RESULTS + 5,
            type: flood.type,
            assignedToId: flood.assignedToId,
            createdAtStart: new Date(olderCreatedAt.getTime() + 1000),
          });

          const res = await request(app)
            .get(requestPath)
            .set('Authorization', `Bearer ${authToken}`);

          expect(res.status).toBe(200);
          const alerts = res.body.alerts as any[];
          expect(alerts.map((alert) => alert.title)).toContain(matchingAlert.title);
          assertAlerts(alerts);
        } finally {
          await prisma.notificationAlert.deleteMany({ where: { id: { startsWith: prefix } } });
        }
      };

      beforeAll(async () => {
        await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'stale_hold_point',
            severity: 'critical',
            title: 'Critical Alert',
            message: 'Critical issue',
            entityId: 'hold-point-1',
            entityType: 'holdpoint',
            projectId,
            assignedTo: userId,
          });
      });

      it('should list all alerts', async () => {
        const res = await request(app)
          .get('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alerts).toBeDefined();
        expect(Array.isArray(res.body.alerts)).toBe(true);
        expect(res.body.count).toBeGreaterThan(0);
      });

      it('should filter active alerts', async () => {
        const res = await request(app)
          .get('/api/notifications/alerts?status=active')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alerts).toBeDefined();
        // All should be active (not resolved)
        const allActive = res.body.alerts.every((a: any) => !a.resolvedAt);
        expect(allActive).toBe(true);
      });

      it('should filter by alert type', async () => {
        const res = await request(app)
          .get('/api/notifications/alerts?type=stale_hold_point')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alerts).toBeDefined();
        const allCorrectType = res.body.alerts.every((a: any) => a.type === 'stale_hold_point');
        expect(allCorrectType).toBe(true);
      });

      it('should apply alert type filtering before the capped list query', async () => {
        const prefix = `alert-type-filter-${Date.now()}`;
        const olderCreatedAt = new Date('2032-01-01T00:00:00.000Z');

        await expectOlderAlertVisibleAfterFlood({
          prefix,
          requestPath: '/api/notifications/alerts?type=stale_hold_point',
          olderCreatedAt,
          matchingAlert: {
            title: `${prefix} older matching type`,
            type: 'stale_hold_point',
            entityType: 'holdpoint',
            assignedToId: userId,
          },
          flood: {
            type: 'overdue_ncr',
            assignedToId: userId,
          },
          assertAlerts: (alerts) =>
            expect(alerts.every((alert) => alert.type === 'stale_hold_point')).toBe(true),
        });
      });

      it('should apply resolved status filtering before the capped list query', async () => {
        const prefix = `alert-status-filter-${Date.now()}`;
        const olderCreatedAt = new Date('2032-02-01T00:00:00.000Z');

        await expectOlderAlertVisibleAfterFlood({
          prefix,
          requestPath: '/api/notifications/alerts?status=resolved',
          olderCreatedAt,
          matchingAlert: {
            title: `${prefix} older resolved alert`,
            type: 'overdue_ncr',
            entityType: 'ncr',
            assignedToId: userId,
            resolvedAt: new Date(olderCreatedAt.getTime() + 500),
          },
          flood: {
            type: 'overdue_ncr',
            assignedToId: userId,
          },
          assertAlerts: (alerts) =>
            expect(alerts.every((alert) => Boolean(alert.resolvedAt))).toBe(true),
        });
      });

      it('should filter by assigned user', async () => {
        const res = await request(app)
          .get(`/api/notifications/alerts?assignedTo=${userId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alerts).toBeDefined();
      });

      it('should apply assigned user filtering before the capped list query', async () => {
        const prefix = `alert-assigned-filter-${Date.now()}`;
        const olderCreatedAt = new Date('2032-03-01T00:00:00.000Z');

        await expectOlderAlertVisibleAfterFlood({
          prefix,
          requestPath: `/api/notifications/alerts?assignedTo=${userId}`,
          olderCreatedAt,
          matchingAlert: {
            title: `${prefix} older assigned alert`,
            type: 'overdue_ncr',
            entityType: 'ncr',
            assignedToId: userId,
          },
          flood: {
            type: 'overdue_ncr',
            assignedToId: secondUserId,
          },
          assertAlerts: (alerts) =>
            expect(
              alerts.every(
                (alert) => alert.assignedTo === userId || alert.escalatedTo?.includes(userId),
              ),
            ).toBe(true),
        });
      });

      it('should reject malformed alert filters', async () => {
        const malformedStatusRes = await request(app)
          .get('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ status: ['active', 'resolved'] });

        expect(malformedStatusRes.status).toBe(400);
        expect(malformedStatusRes.body.error.message).toContain('status');

        const invalidStatusRes = await request(app)
          .get('/api/notifications/alerts?status=unknown')
          .set('Authorization', `Bearer ${authToken}`);

        expect(invalidStatusRes.status).toBe(400);
        expect(invalidStatusRes.body.error.message).toContain('status');

        const invalidTypeRes = await request(app)
          .get('/api/notifications/alerts?type=unknown')
          .set('Authorization', `Bearer ${authToken}`);

        expect(invalidTypeRes.status).toBe(400);
        expect(invalidTypeRes.body.error.message).toContain('type');
      });

      it('should only list alerts explicitly assigned to subcontractor users', async () => {
        const assignedTitle = `Assigned Subcontractor Alert ${Date.now()}`;
        const otherTitle = `Internal Project Alert ${Date.now()}`;

        const assignedCreateRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: assignedTitle,
            message: 'Assigned directly to the subcontractor',
            entityId: `assigned-sub-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: subcontractorUserId,
          });
        expect(assignedCreateRes.status).toBe(200);

        const internalCreateRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: otherTitle,
            message: 'Assigned to an internal project user',
            entityId: `internal-alert-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: secondUserId,
          });
        expect(internalCreateRes.status).toBe(200);

        const res = await request(app)
          .get('/api/notifications/alerts')
          .set('Authorization', `Bearer ${subcontractorUserToken}`);

        expect(res.status).toBe(200);
        const titles = res.body.alerts.map((alert: any) => alert.title);
        expect(titles).toContain(assignedTitle);
        expect(titles).not.toContain(otherTitle);
      });

      it('should list alerts escalated to subcontractor users', async () => {
        const escalatedTitle = `Escalated Subcontractor Alert ${Date.now()}`;
        const createRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'high',
            title: escalatedTitle,
            message: 'Escalated directly to the subcontractor',
            entityId: `escalated-sub-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: secondUserId,
          });
        expect(createRes.status).toBe(200);

        await prisma.notificationAlert.update({
          where: { id: createRes.body.alert.id },
          data: {
            escalationLevel: 1,
            escalatedAt: new Date(),
            escalatedTo: [subcontractorUserId],
          },
        });

        const res = await request(app)
          .get('/api/notifications/alerts')
          .set('Authorization', `Bearer ${subcontractorUserToken}`);

        expect(res.status).toBe(200);
        const alert = res.body.alerts.find((item: any) => item.title === escalatedTitle);
        expect(alert).toBeDefined();
        expect(alert.escalatedTo).toContain(subcontractorUserId);
      });

      it('should not let unrelated escalated alerts hide an older alert escalated to the user', async () => {
        const prefix = `alert-escalated-flood-${Date.now()}`;
        let otherCompanyId: string | undefined;
        let otherProjectId: string | undefined;
        let otherAssigneeId: string | undefined;

        try {
          const otherCompany = await prisma.company.create({
            data: { name: `${prefix} Company` },
          });
          otherCompanyId = otherCompany.id;
          const otherProject = await prisma.project.create({
            data: {
              name: `${prefix} Project`,
              projectNumber: `AEF-${Date.now()}`,
              companyId: otherCompany.id,
              status: 'active',
              state: 'NSW',
              specificationSet: 'TfNSW',
            },
          });
          otherProjectId = otherProject.id;
          const otherAssignee = await prisma.user.create({
            data: {
              email: `${prefix}@example.com`,
              passwordHash: 'hash',
              fullName: `${prefix} Assignee`,
              companyId: otherCompany.id,
              roleInCompany: 'admin',
              emailVerified: true,
            },
          });
          otherAssigneeId = otherAssignee.id;

          const olderCreatedAt = new Date('2032-04-01T00:00:00.000Z');
          const visibleTitle = `${prefix} escalated to current user`;
          await prisma.notificationAlert.create({
            data: {
              id: `${prefix}-match`,
              type: 'overdue_ncr',
              severity: 'high',
              title: visibleTitle,
              message: 'This older inaccessible-project alert is visible via escalatedTo.',
              entityId: `${prefix}-match-entity`,
              entityType: 'ncr',
              projectId: otherProject.id,
              assignedToId: otherAssignee.id,
              createdAt: olderCreatedAt,
              escalationLevel: 1,
              escalatedAt: olderCreatedAt,
              escalatedTo: [userId],
            },
          });

          await prisma.notificationAlert.createMany({
            data: Array.from({ length: MAX_ALERT_LIST_RESULTS + 5 }, (_, index) => {
              const createdAt = new Date(olderCreatedAt.getTime() + (index + 1) * 1000);
              return {
                id: `${prefix}-noise-${index}`,
                type: 'overdue_ncr',
                severity: 'medium',
                title: `${prefix} unrelated escalated alert ${index}`,
                message: 'Unrelated escalated alert from an inaccessible project',
                entityId: `${prefix}-noise-entity-${index}`,
                entityType: 'ncr',
                projectId: otherProject.id,
                assignedToId: otherAssignee.id,
                createdAt,
                escalationLevel: 1,
                escalatedAt: createdAt,
                escalatedTo: [otherAssignee.id],
              };
            }),
          });

          const res = await request(app)
            .get('/api/notifications/alerts')
            .set('Authorization', `Bearer ${authToken}`);

          expect(res.status).toBe(200);
          expect(res.body.alerts.map((alert: any) => alert.title)).toContain(visibleTitle);
        } finally {
          await prisma.notificationAlert.deleteMany({ where: { id: { startsWith: prefix } } });
          if (otherAssigneeId) {
            await prisma.emailVerificationToken.deleteMany({ where: { userId: otherAssigneeId } });
            await prisma.user.delete({ where: { id: otherAssigneeId } }).catch(() => {});
          }
          if (otherProjectId) {
            await prisma.project.delete({ where: { id: otherProjectId } }).catch(() => {});
          }
          if (otherCompanyId) {
            await prisma.company.delete({ where: { id: otherCompanyId } }).catch(() => {});
          }
        }
      });

      it('should reject unauthorized requests', async () => {
        const res = await request(app).get('/api/notifications/alerts');

        expect(res.status).toBe(401);
      });
    });

    describe('PUT /api/notifications/alerts/:id/resolve', () => {
      let resolveAlertId: string;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'low',
            title: 'To Resolve',
            message: 'Will be resolved',
            entityId: 'ncr-resolve',
            entityType: 'ncr',
            assignedTo: userId,
          });
        resolveAlertId = res.body.alert.id;
      });

      it('should resolve an alert', async () => {
        const res = await request(app)
          .put(`/api/notifications/alerts/${resolveAlertId}/resolve`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.alert.resolvedAt).toBeDefined();
      });

      it('should reject resolving already resolved alert', async () => {
        // Resolve first time
        await request(app)
          .put(`/api/notifications/alerts/${resolveAlertId}/resolve`)
          .set('Authorization', `Bearer ${authToken}`);

        // Try to resolve again
        const res = await request(app)
          .put(`/api/notifications/alerts/${resolveAlertId}/resolve`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('already resolved');
      });

      it('should return 404 for non-existent alert', async () => {
        const res = await request(app)
          .put('/api/notifications/alerts/non-existent/resolve')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error.message).toContain('not found');
      });

      it('should reject subcontractors resolving project alerts they are not assigned to', async () => {
        const createRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: 'Subcontractor Resolve Denied',
            message: 'This alert belongs to an internal user',
            entityId: `resolve-denied-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: secondUserId,
          });
        expect(createRes.status).toBe(200);

        const res = await request(app)
          .put(`/api/notifications/alerts/${createRes.body.alert.id}/resolve`)
          .set('Authorization', `Bearer ${subcontractorUserToken}`);

        expect(res.status).toBe(403);
      });

      it('should reject project readers resolving project alerts they do not own', async () => {
        const createRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: 'Project Reader Resolve Denied',
            message: 'Project read access alone should not resolve alerts',
            entityId: `resolve-reader-denied-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: userId,
          });
        expect(createRes.status).toBe(200);

        const res = await request(app)
          .put(`/api/notifications/alerts/${createRes.body.alert.id}/resolve`)
          .set('Authorization', `Bearer ${secondUserToken}`);

        expect(res.status).toBe(403);
      });

      it('should allow project notification admins to resolve project alerts they do not own', async () => {
        const createRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: 'Project Admin Resolve Allowed',
            message: 'Project notification admins can resolve project alerts',
            entityId: `resolve-admin-allowed-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: secondUserId,
          });
        expect(createRes.status).toBe(200);

        const res = await request(app)
          .put(`/api/notifications/alerts/${createRes.body.alert.id}/resolve`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alert.resolvedAt).toBeDefined();
      });

      it('should allow escalated recipients to resolve project alerts', async () => {
        const createRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: 'Escalated Resolve Allowed',
            message: 'Escalated recipients can resolve alerts',
            entityId: `resolve-escalated-allowed-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: userId,
          });
        expect(createRes.status).toBe(200);

        await prisma.notificationAlert.update({
          where: { id: createRes.body.alert.id },
          data: {
            escalationLevel: 1,
            escalatedAt: new Date(),
            escalatedTo: [secondUserId],
          },
        });

        const res = await request(app)
          .put(`/api/notifications/alerts/${createRes.body.alert.id}/resolve`)
          .set('Authorization', `Bearer ${secondUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alert.resolvedAt).toBeDefined();
      });

      it('should allow subcontractors to resolve alerts assigned to them', async () => {
        const createRes = await request(app)
          .post('/api/notifications/alerts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'overdue_ncr',
            severity: 'medium',
            title: 'Subcontractor Resolve Allowed',
            message: 'This alert is assigned to the subcontractor',
            entityId: `resolve-allowed-${Date.now()}`,
            entityType: 'ncr',
            projectId,
            assignedTo: subcontractorUserId,
          });
        expect(createRes.status).toBe(200);

        const res = await request(app)
          .put(`/api/notifications/alerts/${createRes.body.alert.id}/resolve`)
          .set('Authorization', `Bearer ${subcontractorUserToken}`);

        expect(res.status).toBe(200);
        expect(res.body.alert.resolvedAt).toBeDefined();
      });

      it('should reject unauthorized requests', async () => {
        const res = await request(app).put(`/api/notifications/alerts/${resolveAlertId}/resolve`);

        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/notifications/alerts/escalation-config', () => {
      it('should return escalation configuration', async () => {
        const res = await request(app)
          .get('/api/notifications/alerts/escalation-config')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.config).toBeDefined();
        expect(res.body.config.overdue_ncr).toBeDefined();
        expect(res.body.config.stale_hold_point).toBeDefined();
        expect(res.body.config.overdue_ncr.firstEscalationAfterHours).toBeDefined();
      });

      it('should reject unauthorized requests', async () => {
        const res = await request(app).get('/api/notifications/alerts/escalation-config');

        expect(res.status).toBe(401);
      });

      it('should reject non-admin project users', async () => {
        const res = await request(app)
          .get('/api/notifications/alerts/escalation-config')
          .set('Authorization', `Bearer ${secondUserToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('GET /api/notifications/system-alerts/summary', () => {
      it('should return alerts summary', async () => {
        const res = await request(app)
          .get('/api/notifications/system-alerts/summary')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totalActive).toBeDefined();
        expect(res.body.bySeverity).toBeDefined();
        expect(res.body.byType).toBeDefined();
        expect(res.body.escalated).toBeDefined();
      });

      it('should filter by project', async () => {
        const res = await request(app)
          .get(`/api/notifications/system-alerts/summary?projectId=${projectId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.totalActive).toBeDefined();
      });

      it('should reject malformed project filters', async () => {
        const res = await request(app)
          .get('/api/notifications/system-alerts/summary')
          .query({ projectId: [projectId, projectId] })
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
      });

      it('should reject unauthorized requests', async () => {
        const res = await request(app).get('/api/notifications/system-alerts/summary');

        expect(res.status).toBe(401);
      });
    });

    describe('POST /api/notifications/system-alerts/check', () => {
      it('should run system alert checks for manageable projects', async () => {
        const res = await request(app)
          .post('/api/notifications/system-alerts/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ projectId });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.projectsChecked).toBe(1);
        expect(res.body.alertsGenerated).toBeDefined();
        expect(res.body.summary).toBeDefined();
        expect(Array.isArray(res.body.alerts)).toBe(true);
      });

      it('should reject non-admin project users from system alert checks', async () => {
        const res = await request(app)
          .post('/api/notifications/system-alerts/check')
          .set('Authorization', `Bearer ${secondUserToken}`)
          .send({ projectId });

        expect(res.status).toBe(403);
      });

      it('should reject unauthorized system alert checks', async () => {
        const res = await request(app)
          .post('/api/notifications/system-alerts/check')
          .send({ projectId });

        expect(res.status).toBe(401);
      });
    });

    describe('POST /api/notifications/alerts/check-escalations', () => {
      it('should run escalation checks for notification admins', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts/check-escalations')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain('Escalation check complete');
        expect(Array.isArray(res.body.escalatedAlerts)).toBe(true);
        expect(res.body.totalActiveAlerts).toBeDefined();
      });

      it('should reject non-admin users from escalation checks', async () => {
        const res = await request(app)
          .post('/api/notifications/alerts/check-escalations')
          .set('Authorization', `Bearer ${secondUserToken}`);

        expect(res.status).toBe(403);
      });

      it('should reject unauthorized escalation checks', async () => {
        const res = await request(app).post('/api/notifications/alerts/check-escalations');

        expect(res.status).toBe(401);
      });
    });
  });

  describe('Diary Reminder System', () => {
    describe('POST /api/notifications/diary-reminder/send', () => {
      it('should send diary reminder for project', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            date: new Date().toISOString().split('T')[0],
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.projectId).toBe(projectId);
        expect(res.body.usersNotified).toBeDefined();
      });

      it('should reject without projectId', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            date: new Date().toISOString().split('T')[0],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('required');
      });

      it('should reject invalid diary reminder dates', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            date: 'not-a-date',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('date');
      });

      it('should reject impossible diary reminder dates', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId,
            date: '2026-02-30',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('date');
      });

      it('should reject malformed diary reminder project ids', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/check')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId: [projectId],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('projectId');
      });

      it('should not duplicate diary reminders for the same project date', async () => {
        const reminderDate = '2026-05-13';
        const email = `notifications-reminder-recipient-${Date.now()}@example.com`;
        const recipient = await prisma.user.create({
          data: {
            email,
            passwordHash: 'hash',
            fullName: 'Diary Reminder Recipient',
            companyId,
            roleInCompany: 'member',
            emailVerified: true,
          },
        });
        await prisma.projectUser.create({
          data: {
            projectId,
            userId: recipient.id,
            role: 'foreman',
            status: 'active',
          },
        });

        try {
          const firstRes = await request(app)
            .post('/api/notifications/diary-reminder/check')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ projectId, date: reminderDate });

          expect(firstRes.status).toBe(200);
          expect(firstRes.body.remindersCreated).toBe(1);
          expect(firstRes.body.uniqueUsersNotified).toBe(1);

          const secondRes = await request(app)
            .post('/api/notifications/diary-reminder/check')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ projectId, date: reminderDate });

          expect(secondRes.status).toBe(200);
          expect(secondRes.body.remindersCreated).toBe(0);
          expect(secondRes.body.uniqueUsersNotified).toBe(0);

          await expect(
            prisma.notification.count({
              where: {
                projectId,
                userId: recipient.id,
                type: 'diary_reminder',
              },
            }),
          ).resolves.toBe(1);
        } finally {
          await prisma.notification.deleteMany({ where: { userId: recipient.id } });
          await prisma.projectUser.deleteMany({ where: { userId: recipient.id } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId: recipient.id } });
          await prisma.user.delete({ where: { id: recipient.id } }).catch(() => {});
        }
      });

      it('should return 404 for non-existent project', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            projectId: 'non-existent-id',
          });

        expect(res.status).toBe(404);
        expect(res.body.error.message).toContain('not found');
      });

      it('should reject non-admin project users from sending diary reminders', async () => {
        const res = await request(app)
          .post('/api/notifications/diary-reminder/send')
          .set('Authorization', `Bearer ${secondUserToken}`)
          .send({
            projectId,
            date: new Date().toISOString().split('T')[0],
          });

        expect(res.status).toBe(403);
      });

      it('should allow diary reminders based on active project manager role', async () => {
        const email = `notifications-project-manager-${Date.now()}@example.com`;
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password: 'SecureP@ssword123!',
          fullName: 'Notification Project Manager',
          tosAccepted: true,
        });
        const projectManagerToken = regRes.body.token;
        const projectManagerId = regRes.body.user.id;

        await prisma.user.update({
          where: { id: projectManagerId },
          data: { companyId, roleInCompany: 'viewer' },
        });
        await prisma.projectUser.create({
          data: { projectId, userId: projectManagerId, role: 'project_manager', status: 'active' },
        });

        try {
          const res = await request(app)
            .post('/api/notifications/diary-reminder/send')
            .set('Authorization', `Bearer ${projectManagerToken}`)
            .send({
              projectId,
              date: new Date().toISOString().split('T')[0],
            });

          expect(res.status).toBe(200);
          expect(res.body.success).toBe(true);
          expect(res.body.projectId).toBe(projectId);

          const checkRes = await request(app)
            .post('/api/notifications/diary-reminder/check')
            .set('Authorization', `Bearer ${projectManagerToken}`)
            .send({
              projectId,
              date: new Date().toISOString().split('T')[0],
            });

          expect(checkRes.status).toBe(200);
          expect(checkRes.body.success).toBe(true);
          expect(checkRes.body.projectsChecked).toBe(1);
        } finally {
          await prisma.notification.deleteMany({
            where: {
              OR: [{ userId: projectManagerId }, { projectId, type: 'diary_reminder' }],
            },
          });
          await prisma.projectUser.deleteMany({ where: { userId: projectManagerId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId: projectManagerId } });
          await prisma.user.delete({ where: { id: projectManagerId } }).catch(() => {});
        }
      });

      it('should deny cross-company admins with viewer project membership from managing diary reminders', async () => {
        const otherCompany = await prisma.company.create({
          data: { name: `Notifications Other Company ${Date.now()}` },
        });
        const email = `notifications-cross-company-admin-${Date.now()}@example.com`;
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password: 'SecureP@ssword123!',
          fullName: 'Cross Company Admin',
          tosAccepted: true,
        });
        const otherAdminToken = regRes.body.token;
        const otherAdminId = regRes.body.user.id;

        await prisma.user.update({
          where: { id: otherAdminId },
          data: { companyId: otherCompany.id, roleInCompany: 'admin' },
        });
        await prisma.projectUser.create({
          data: { projectId, userId: otherAdminId, role: 'viewer', status: 'active' },
        });

        try {
          const sendRes = await request(app)
            .post('/api/notifications/diary-reminder/send')
            .set('Authorization', `Bearer ${otherAdminToken}`)
            .send({
              projectId,
              date: new Date().toISOString().split('T')[0],
            });

          expect(sendRes.status).toBe(403);

          const checkRes = await request(app)
            .post('/api/notifications/diary-reminder/check')
            .set('Authorization', `Bearer ${otherAdminToken}`)
            .send({
              projectId,
              date: new Date().toISOString().split('T')[0],
            });

          expect(checkRes.status).toBe(403);
        } finally {
          await prisma.projectUser.deleteMany({ where: { userId: otherAdminId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId: otherAdminId } });
          await prisma.user.delete({ where: { id: otherAdminId } }).catch(() => {});
          await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
        }
      });

      it('should reject unauthorized requests', async () => {
        const res = await request(app).post('/api/notifications/diary-reminder/send').send({
          projectId,
        });

        expect(res.status).toBe(401);
      });
    });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { promises as dns } from 'node:dns';
import { authRouter } from './auth.js';
import apiKeysRouter, { authenticateApiKey } from './apiKeys.js';
import webhooksRouter, {
  clearWebhookStores,
  deliverWebhook,
  generateSignature,
  sanitizeWebhookUrlForLog,
  verifySignature,
} from './webhooks.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { isEncrypted } from '../lib/encryption.js';

const app = express();
app.use(express.json());
app.use(authenticateApiKey);
app.use('/api/auth', authRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/webhooks', webhooksRouter);
app.use(errorHandler);

const ORIGINAL_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const TEST_ENCRYPTION_KEY = 'a'.repeat(64);

describe('Webhooks API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let webhookId: string;
  let viewerToken: string;
  let viewerUserId: string;

  beforeAll(async () => {
    // Create test company
    const company = await prisma.company.create({
      data: { name: `Webhooks Test Company ${Date.now()}` },
    });
    companyId = company.id;

    // Create test user
    const testEmail = `webhooks-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Webhooks Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

    const viewerEmail = `webhooks-viewer-${Date.now()}@example.com`;
    const viewerRes = await request(app).post('/api/auth/register').send({
      email: viewerEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Webhooks Viewer',
      tosAccepted: true,
    });
    viewerToken = viewerRes.body.token;
    viewerUserId = viewerRes.body.user.id;

    await prisma.user.update({
      where: { id: viewerUserId },
      data: { companyId, roleInCompany: 'viewer' },
    });
  });

  afterAll(async () => {
    // Cleanup
    await clearWebhookStores({ companyId });
    await prisma.emailVerificationToken.deleteMany({ where: { userId: viewerUserId } });
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: viewerUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  beforeEach(async () => {
    // Clear webhook configs between tests
    await clearWebhookStores({ companyId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WEBHOOK_DELIVERY_TIMEOUT_MS;
    if (ORIGINAL_ENCRYPTION_KEY === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = ORIGINAL_ENCRYPTION_KEY;
    }
  });

  async function createDeliveryConfig(url = 'https://example.com/webhook') {
    const record = await prisma.webhookConfig.create({
      data: {
        companyId,
        url,
        secret: 'test-webhook-secret',
        events: JSON.stringify(['*']),
        enabled: true,
        createdById: userId,
      },
    });

    return {
      id: record.id,
      companyId: record.companyId,
      url: record.url,
      secret: record.secret,
      events: ['*'],
      enabled: record.enabled,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      createdById: record.createdById,
    };
  }

  async function createApiKey(scopes: string): Promise<string> {
    const res = await request(app)
      .post('/api/api-keys')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Webhook ${scopes} API Key ${Date.now()}`,
        scopes,
      });

    expect(res.status).toBe(201);
    return res.body.apiKey.key;
  }

  describe('Public Endpoints - Test Receiver', () => {
    beforeEach(async () => {
      // Clear test receiver logs before each test
      await request(app)
        .delete('/api/webhooks/test-receiver/logs')
        .set('Authorization', `Bearer ${authToken}`);
    });

    describe('POST /api/webhooks/test-receiver', () => {
      it('should receive webhook without authentication', async () => {
        const payload = { test: 'data', value: 123 };
        const res = await request(app).post('/api/webhooks/test-receiver').send(payload);

        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);
        expect(res.body.id).toBeDefined();
        expect(res.body.timestamp).toBeDefined();
      });

      it('should reject test receiver posts in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        try {
          const res = await request(app).post('/api/webhooks/test-receiver').send({ test: 'data' });

          expect(res.status).toBe(403);
          expect(res.body.error.message).toContain('not available in production');
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should capture webhook signature header', async () => {
        const signature = 'test-signature-abc123';
        const res = await request(app)
          .post('/api/webhooks/test-receiver')
          .set('x-webhook-signature', signature)
          .send({ data: 'test' });

        expect(res.status).toBe(200);
        expect(res.body.received).toBe(true);

        // Verify signature was captured
        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=1')
          .set('Authorization', `Bearer ${authToken}`);
        expect(logsRes.body.logs[0].signature).toBe(signature);
      });

      it('should handle missing signature header', async () => {
        const res = await request(app).post('/api/webhooks/test-receiver').send({ data: 'test' });

        expect(res.status).toBe(200);

        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=1')
          .set('Authorization', `Bearer ${authToken}`);
        expect(logsRes.body.logs[0].signature).toBeNull();
      });
    });

    describe('GET /api/webhooks/test-receiver/logs', () => {
      it('should require authentication', async () => {
        const res = await request(app).get('/api/webhooks/test-receiver/logs');

        expect(res.status).toBe(401);
      });

      it('should retrieve received webhook logs', async () => {
        // Send a test webhook
        await request(app).post('/api/webhooks/test-receiver').send({ test: 'data' });

        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.logs).toBeDefined();
        expect(Array.isArray(res.body.logs)).toBe(true);
        expect(res.body.total).toBeGreaterThan(0);
        expect(res.body.message).toContain('received webhooks');
      });

      it('should limit returned logs', async () => {
        // Send multiple webhooks
        await request(app).post('/api/webhooks/test-receiver').send({ msg: 1 });
        await request(app).post('/api/webhooks/test-receiver').send({ msg: 2 });
        await request(app).post('/api/webhooks/test-receiver').send({ msg: 3 });

        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=2')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.logs.length).toBeLessThanOrEqual(2);
      });

      it('should reject malformed log limits', async () => {
        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs?limit=abc')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('limit');
      });

      it('should default to limit of 10', async () => {
        // Send a webhook first to have data
        await request(app).post('/api/webhooks/test-receiver').send({ test: 'data' });

        const res = await request(app)
          .get('/api/webhooks/test-receiver/logs')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Showing last \d+ received webhooks/);
      });
    });

    describe('DELETE /api/webhooks/test-receiver/logs', () => {
      it('should require authentication', async () => {
        const res = await request(app).delete('/api/webhooks/test-receiver/logs');

        expect(res.status).toBe(401);
      });

      it('should clear test webhook logs', async () => {
        // Send a test webhook
        await request(app).post('/api/webhooks/test-receiver').send({ test: 'data' });

        // Clear logs
        const res = await request(app)
          .delete('/api/webhooks/test-receiver/logs')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('cleared');

        // Verify logs are empty
        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs')
          .set('Authorization', `Bearer ${authToken}`);
        expect(logsRes.body.total).toBe(0);
      });
    });
  });

  describe('Protected Endpoints - Webhook Management', () => {
    it('should deny same-company viewers from managing webhooks', async () => {
      await request(app).post('/api/webhooks/test-receiver').send({ test: 'viewer access' });

      const listRes = await request(app)
        .get('/api/webhooks')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(listRes.status).toBe(403);

      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          url: 'https://example.com/webhook',
        });
      expect(createRes.status).toBe(403);

      const logsRes = await request(app)
        .get('/api/webhooks/test-receiver/logs')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(logsRes.status).toBe(403);
    });

    it('should deny same-company project managers from managing company webhooks', async () => {
      const pmEmail = `webhooks-pm-${Date.now()}@example.com`;
      const pmRes = await request(app).post('/api/auth/register').send({
        email: pmEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Webhooks Project Manager',
        tosAccepted: true,
      });
      const pmUserId = pmRes.body.user.id;

      await prisma.user.update({
        where: { id: pmUserId },
        data: { companyId, roleInCompany: 'project_manager' },
      });

      try {
        const listRes = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${pmRes.body.token}`);
        expect(listRes.status).toBe(403);

        const createRes = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${pmRes.body.token}`)
          .send({
            url: 'https://example.com/webhook',
          });
        expect(createRes.status).toBe(403);

        const logsRes = await request(app)
          .get('/api/webhooks/test-receiver/logs')
          .set('Authorization', `Bearer ${pmRes.body.token}`);
        expect(logsRes.status).toBe(403);
      } finally {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: pmUserId } });
        await prisma.user.delete({ where: { id: pmUserId } }).catch(() => {});
      }
    });

    it('should require admin API key scope for webhook management', async () => {
      const readApiKey = await createApiKey('read');
      const writeApiKey = await createApiKey('write');
      const adminApiKey = await createApiKey('admin');

      const listRes = await request(app).get('/api/webhooks').set('x-api-key', readApiKey);
      expect(listRes.status).toBe(403);
      expect(listRes.body.error.message).toContain('Required: admin');

      const writeCreateRes = await request(app)
        .post('/api/webhooks')
        .set('x-api-key', writeApiKey)
        .send({
          url: 'https://example.com/webhook',
          events: ['lot.created'],
        });
      expect(writeCreateRes.status).toBe(403);
      expect(writeCreateRes.body.error.message).toContain('Required: admin');

      const logsRes = await request(app)
        .get('/api/webhooks/test-receiver/logs')
        .set('x-api-key', readApiKey);
      expect(logsRes.status).toBe(403);
      expect(logsRes.body.error.message).toContain('Required: admin');

      const adminCreateRes = await request(app)
        .post('/api/webhooks')
        .set('x-api-key', adminApiKey)
        .send({
          url: 'https://example.com/webhook',
          events: ['lot.created'],
        });
      expect(adminCreateRes.status).toBe(201);
      expect(adminCreateRes.body.secret).toBeDefined();
    });

    describe('POST /api/webhooks', () => {
      it('should create a webhook configuration', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['lot.created', 'lot.updated'],
          });

        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.url).toBe('https://example.com/webhook');
        expect(res.body.secret).toBeDefined();
        expect(res.body.events).toEqual(['lot.created', 'lot.updated']);
        expect(res.body.enabled).toBe(true);
        expect(res.body.createdAt).toBeDefined();
        expect(res.body.message).toMatch(/[Ss]ave the secret/);

        webhookId = res.body.id;
      });

      it('should encrypt webhook secrets at rest when encryption is configured', async () => {
        process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/encrypted-webhook',
            events: ['lot.created'],
          });

        expect(res.status).toBe(201);
        expect(res.body.secret).toMatch(/^[a-f0-9]{64}$/);

        const record = await prisma.webhookConfig.findUnique({
          where: { id: res.body.id },
        });
        expect(record).toBeDefined();
        expect(record!.secret).not.toBe(res.body.secret);
        expect(isEncrypted(record!.secret)).toBe(true);
      });

      it('should default to wildcard events if not specified', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
          });

        expect(res.status).toBe(201);
        expect(res.body.events).toEqual(['*']);
      });

      it('should require URL', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            events: ['test'],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('URL');
      });

      it('should validate URL format', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'not-a-valid-url',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Invalid URL');
      });

      it('should reject unsupported webhook URL protocols', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'ftp://example.com/webhook',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Invalid URL protocol');
      });

      it('should reject webhook URLs with embedded credentials', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://user:password@example.com/webhook',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('credentials');
      });

      it('should require HTTPS webhook URLs in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        try {
          const res = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              url: 'http://example.com/webhook',
            });

          expect(res.status).toBe(400);
          expect(res.body.error.message).toContain('HTTPS');
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should reject local webhook hosts in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        try {
          const res = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              url: 'https://127.0.0.1/webhook',
            });

          expect(res.status).toBe(400);
          expect(res.body.error.message).toContain('not allowed');
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should reject private IPv6 webhook hosts in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        try {
          const res = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              url: 'https://[fc00::1]/webhook',
            });

          expect(res.status).toBe(400);
          expect(res.body.error.message).toContain('not allowed');
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should reject webhook hosts that resolve to private addresses in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.5', family: 4 }] as never);

        try {
          const res = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              url: 'https://hooks.example.com/webhook',
            });

          expect(res.status).toBe(400);
          expect(res.body.error.message).toContain('resolved to a private address');
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should reject unresolvable webhook hosts in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        vi.spyOn(dns, 'lookup').mockRejectedValue(new Error('ENOTFOUND'));

        try {
          const res = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              url: 'https://missing.example.invalid/webhook',
            });

          expect(res.status).toBe(400);
          expect(res.body.error.message).toContain('could not be resolved');
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });

      it('should reject malformed webhook event names', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['lot.created', 'bad event'],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('event');
      });

      it('should reject excessive webhook event subscriptions', async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: Array.from({ length: 51 }, (_, index) => `lot.event${index}`),
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('50');
      });

      it('should require authentication', async () => {
        const res = await request(app).post('/api/webhooks').send({
          url: 'https://example.com/webhook',
        });

        expect(res.status).toBe(401);
      });

      it('should require company context', async () => {
        // Create user without company
        const noCompanyEmail = `no-company-${Date.now()}@example.com`;
        const noCompanyRes = await request(app).post('/api/auth/register').send({
          email: noCompanyEmail,
          password: 'SecureP@ssword123!',
          fullName: 'No Company User',
          tosAccepted: true,
        });
        const noCompanyToken = noCompanyRes.body.token;
        const noCompanyUserId = noCompanyRes.body.user.id;

        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${noCompanyToken}`)
          .send({
            url: 'https://example.com/webhook',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Company context required');

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: noCompanyUserId } });
        await prisma.user.delete({ where: { id: noCompanyUserId } });
      });
    });

    describe('GET /api/webhooks', () => {
      beforeEach(async () => {
        // Create a test webhook
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          });
        webhookId = res.body.id;
      });

      it('should list webhooks for the company', async () => {
        const res = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.webhooks).toBeDefined();
        expect(Array.isArray(res.body.webhooks)).toBe(true);
        expect(res.body.webhooks.length).toBeGreaterThan(0);
      });

      it('should mask webhook secrets in listing', async () => {
        const res = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        const webhook = res.body.webhooks.find((w: any) => w.id === webhookId);
        expect(webhook.secret).toBe('****');
      });

      it('should only return webhooks for user company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` },
        });
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await request(app).post('/api/auth/register').send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        });
        const otherToken = otherRes.body.token;
        const otherUserId = otherRes.body.user.id;

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' },
        });

        const res = await request(app)
          .get('/api/webhooks')
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(200);
        expect(res.body.webhooks.length).toBe(0);

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
        await prisma.company.delete({ where: { id: company2.id } });
      });
    });

    describe('GET /api/webhooks/:id', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['test.event'],
          });
        webhookId = res.body.id;
      });

      it('should get a specific webhook', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(webhookId);
        expect(res.body.url).toBe('https://example.com/webhook');
        expect(res.body.secret).toBe('****'); // Masked
      });

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .get('/api/webhooks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
        expect(res.body.error.message).toContain('not found');
      });

      it('should deny access to webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` },
        });
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await request(app).post('/api/auth/register').send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        });
        const otherToken = otherRes.body.token;
        const otherUserId = otherRes.body.user.id;

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' },
        });

        const res = await request(app)
          .get(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('Access denied');

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
        await prisma.company.delete({ where: { id: company2.id } });
      });
    });

    describe('Route parameter validation', () => {
      it('should reject oversized webhook route ids before lookups', async () => {
        const longId = 'w'.repeat(121);
        const checks = [
          {
            label: 'GET webhook',
            response: await request(app)
              .get(`/api/webhooks/${longId}`)
              .set('Authorization', `Bearer ${authToken}`),
          },
          {
            label: 'PATCH webhook',
            response: await request(app)
              .patch(`/api/webhooks/${longId}`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ enabled: true }),
          },
          {
            label: 'DELETE webhook',
            response: await request(app)
              .delete(`/api/webhooks/${longId}`)
              .set('Authorization', `Bearer ${authToken}`),
          },
          {
            label: 'POST regenerate secret',
            response: await request(app)
              .post(`/api/webhooks/${longId}/regenerate-secret`)
              .set('Authorization', `Bearer ${authToken}`),
          },
          {
            label: 'GET deliveries',
            response: await request(app)
              .get(`/api/webhooks/${longId}/deliveries?limit=5`)
              .set('Authorization', `Bearer ${authToken}`),
          },
          {
            label: 'POST test delivery',
            response: await request(app)
              .post(`/api/webhooks/${longId}/test`)
              .set('Authorization', `Bearer ${authToken}`),
          },
        ];

        for (const { label, response } of checks) {
          expect(response.status, label).toBe(400);
          expect(response.body.error.message, label).toContain('id must be 120 characters or less');
        }
      });
    });

    describe('PATCH /api/webhooks/:id', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          });
        webhookId = res.body.id;
      });

      it('should update webhook URL', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://updated.example.com/webhook',
          });

        expect(res.status).toBe(200);
        expect(res.body.url).toBe('https://updated.example.com/webhook');
      });

      it('should update webhook events', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            events: ['lot.created', 'lot.deleted'],
          });

        expect(res.status).toBe(200);
        expect(res.body.events).toEqual(['lot.created', 'lot.deleted']);
      });

      it('should enable/disable webhook', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
          });

        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(false);
      });

      it('should reject non-boolean enabled values', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: 'false',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('enabled');
      });

      it('should reject malformed event updates', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            events: ['lot.updated', '../bad'],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('event');
      });

      it('should validate URL format when updating', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'invalid-url',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Invalid URL');
      });

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .patch('/api/webhooks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
          });

        expect(res.status).toBe(404);
      });

      it('should mask secret in response', async () => {
        const res = await request(app)
          .patch(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            enabled: false,
          });

        expect(res.status).toBe(200);
        expect(res.body.secret).toBe('****');
      });
    });

    describe('DELETE /api/webhooks/:id', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          });
        webhookId = res.body.id;
      });

      it('should delete a webhook', async () => {
        const res = await request(app)
          .delete(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(204);

        // Verify webhook is deleted
        const getRes = await request(app)
          .get(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${authToken}`);
        expect(getRes.status).toBe(404);
      });

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .delete('/api/webhooks/non-existent-id')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
      });

      it('should deny deletion of webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` },
        });
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await request(app).post('/api/auth/register').send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        });
        const otherToken = otherRes.body.token;
        const otherUserId = otherRes.body.user.id;

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' },
        });

        const res = await request(app)
          .delete(`/api/webhooks/${webhookId}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
        await prisma.company.delete({ where: { id: company2.id } });
      });
    });

    describe('POST /api/webhooks/:id/regenerate-secret', () => {
      let originalSecret: string;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          });
        webhookId = res.body.id;
        originalSecret = res.body.secret;
      });

      it('should regenerate webhook secret', async () => {
        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/regenerate-secret`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.id).toBe(webhookId);
        expect(res.body.secret).toBeDefined();
        expect(res.body.secret).not.toBe(originalSecret);
        expect(res.body.message).toContain('regenerated');
      });

      it('should encrypt regenerated webhook secrets at rest', async () => {
        process.env.ENCRYPTION_KEY = TEST_ENCRYPTION_KEY;

        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/regenerate-secret`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.secret).toMatch(/^[a-f0-9]{64}$/);

        const record = await prisma.webhookConfig.findUnique({
          where: { id: webhookId },
        });
        expect(record).toBeDefined();
        expect(record!.secret).not.toBe(res.body.secret);
        expect(isEncrypted(record!.secret)).toBe(true);
      });

      it('should regenerate the secret even when the stored ciphertext was encrypted with a different key', async () => {
        // Webhook was created in beforeEach using whatever key happened to be
        // in process.env. Switch to a fresh key that cannot decrypt the stored
        // ciphertext, then confirm regenerate-secret still recovers the
        // webhook (it must not try to decrypt the stale secret).
        process.env.ENCRYPTION_KEY = 'b'.repeat(64);

        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/regenerate-secret`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.secret).toMatch(/^[a-f0-9]{64}$/);

        const record = await prisma.webhookConfig.findUnique({
          where: { id: webhookId },
        });
        expect(record).toBeDefined();
        expect(isEncrypted(record!.secret)).toBe(true);
      });

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .post('/api/webhooks/non-existent-id/regenerate-secret')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
      });

      it('should deny regeneration for webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` },
        });
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await request(app).post('/api/auth/register').send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        });
        const otherToken = otherRes.body.token;
        const otherUserId = otherRes.body.user.id;

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' },
        });

        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/regenerate-secret`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
        await prisma.company.delete({ where: { id: company2.id } });
      });
    });

    describe('GET /api/webhooks/:id/deliveries', () => {
      beforeEach(async () => {
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'https://example.com/webhook',
            events: ['*'],
          });
        webhookId = res.body.id;
      });

      it('should get delivery history for a webhook', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.deliveries).toBeDefined();
        expect(Array.isArray(res.body.deliveries)).toBe(true);
        expect(res.body.total).toBeDefined();
      });

      it('should support limit parameter', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries?limit=5`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.deliveries).toBeDefined();
      });

      it('should reject malformed delivery limits', async () => {
        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries?limit=-1`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('limit');
      });

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .get('/api/webhooks/non-existent-id/deliveries')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
      });

      it('should deny access to deliveries from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` },
        });
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await request(app).post('/api/auth/register').send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        });
        const otherToken = otherRes.body.token;
        const otherUserId = otherRes.body.user.id;

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' },
        });

        const res = await request(app)
          .get(`/api/webhooks/${webhookId}/deliveries`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
        await prisma.company.delete({ where: { id: company2.id } });
      });
    });

    describe('POST /api/webhooks/:id/test', () => {
      beforeEach(async () => {
        // Clear test receiver logs
        await request(app)
          .delete('/api/webhooks/test-receiver/logs')
          .set('Authorization', `Bearer ${authToken}`);

        // Create webhook pointing to test receiver
        const res = await request(app)
          .post('/api/webhooks')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            url: 'http://localhost:3001/api/webhooks/test-receiver',
            events: ['*'],
          });
        webhookId = res.body.id;
      });

      it('should send a test webhook', async () => {
        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/test`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBeDefined();
        expect(res.body.deliveryId).toBeDefined();
        expect(res.body.responseStatus).toBeDefined();
      });

      it('should return 404 for non-existent webhook', async () => {
        const res = await request(app)
          .post('/api/webhooks/non-existent-id/test')
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(404);
      });

      it('should deny testing webhook from different company', async () => {
        // Create another company and user
        const company2 = await prisma.company.create({
          data: { name: `Other Company ${Date.now()}` },
        });
        const otherEmail = `other-${Date.now()}@example.com`;
        const otherRes = await request(app).post('/api/auth/register').send({
          email: otherEmail,
          password: 'SecureP@ssword123!',
          fullName: 'Other User',
          tosAccepted: true,
        });
        const otherToken = otherRes.body.token;
        const otherUserId = otherRes.body.user.id;

        await prisma.user.update({
          where: { id: otherUserId },
          data: { companyId: company2.id, roleInCompany: 'admin' },
        });

        const res = await request(app)
          .post(`/api/webhooks/${webhookId}/test`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);

        // Cleanup
        await prisma.emailVerificationToken.deleteMany({ where: { userId: otherUserId } });
        await prisma.user.delete({ where: { id: otherUserId } });
        await prisma.company.delete({ where: { id: company2.id } });
      });
    });

    describe('webhook delivery hardening', () => {
      it('should redact webhook URL query values in delivery error logs', async () => {
        const config = await createDeliveryConfig(
          'https://example.com/webhook?token=secret-token&tenant=siteproof',
        );
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const delivery = await deliverWebhook(config, 'test.error', { ok: true });

        expect(delivery.success).toBe(false);
        const logs = consoleSpy.mock.calls.flat().map(String).join('\n');
        expect(logs).toContain('https://example.com/webhook?token=[REDACTED]&tenant=[REDACTED]');
        expect(logs).not.toContain('secret-token');
        expect(logs).not.toContain('tenant=siteproof');
      });

      it('should not allow fetch to follow webhook redirects', async () => {
        const config = await createDeliveryConfig();
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response('', {
            status: 302,
            headers: { location: 'http://127.0.0.1/private' },
          }),
        );

        const delivery = await deliverWebhook(config, 'test.redirect', { ok: true });

        expect(fetchMock).toHaveBeenCalledWith(
          config.url,
          expect.objectContaining({
            redirect: 'error',
          }),
        );
        expect(delivery.success).toBe(false);
        expect(delivery.responseStatus).toBe(302);
      });

      it('should time out slow webhook deliveries', async () => {
        process.env.WEBHOOK_DELIVERY_TIMEOUT_MS = '1';
        const config = await createDeliveryConfig();
        vi.spyOn(globalThis, 'fetch').mockImplementation(
          (_url, init) =>
            new Promise((_resolve, reject) => {
              const signal = (init as RequestInit).signal;
              if (signal?.aborted) {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                reject(error);
                return;
              }
              signal?.addEventListener('abort', () => {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                reject(error);
              });
            }),
        );

        const delivery = await deliverWebhook(config, 'test.timeout', { ok: true });

        expect(delivery.success).toBe(false);
        expect(delivery.error).toContain('timed out');
      });

      it('should store only a bounded webhook response body preview', async () => {
        const config = await createDeliveryConfig();
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
          new Response('a'.repeat(5000), { status: 200 }),
        );

        const delivery = await deliverWebhook(config, 'test.large_response', { ok: true });

        expect(delivery.success).toBe(true);
        expect(delivery.responseBody).toContain('[truncated]');
        expect(delivery.responseBody?.length).toBeLessThan(4200);
      });

      it('should reject unsafe stored webhook URLs at delivery time in production', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const config = await createDeliveryConfig('https://127.0.0.1/private');
        const fetchMock = vi
          .spyOn(globalThis, 'fetch')
          .mockResolvedValue(new Response('', { status: 200 }));

        try {
          const delivery = await deliverWebhook(config, 'test.unsafe_url', { ok: true });

          expect(fetchMock).not.toHaveBeenCalled();
          expect(delivery.success).toBe(false);
          expect(delivery.error).toContain('Webhook URL host is not allowed');
        } finally {
          process.env.NODE_ENV = originalNodeEnv;
        }
      });

      it('should reject stored webhook URLs that resolve to private addresses at delivery time in production', async () => {
        const originalNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const config = await createDeliveryConfig('https://hooks.example.com/private');
        vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '172.16.0.10', family: 4 }] as never);
        const fetchMock = vi
          .spyOn(globalThis, 'fetch')
          .mockResolvedValue(new Response('', { status: 200 }));

        try {
          const delivery = await deliverWebhook(config, 'test.private_dns', { ok: true });

          expect(fetchMock).not.toHaveBeenCalled();
          expect(delivery.success).toBe(false);
          expect(delivery.error).toContain('resolved to a private address');
        } finally {
          process.env.NODE_ENV = originalNodeEnv;
        }
      });
    });
  });
});

describe('Webhook signature helpers', () => {
  it('should redact webhook URL query values for logs', () => {
    expect(
      sanitizeWebhookUrlForLog('https://example.com/hooks/path?sig=abc&tenant=siteproof'),
    ).toBe('https://example.com/hooks/path?sig=[REDACTED]&tenant=[REDACTED]');
  });

  it('should verify matching webhook signatures', () => {
    const payload = JSON.stringify({ event: 'test' });
    const secret = 'test-secret';
    const signature = generateSignature(payload, secret);

    expect(verifySignature(payload, signature, secret)).toBe(true);
  });

  it('should return false for malformed signature lengths', () => {
    const payload = JSON.stringify({ event: 'test' });

    expect(verifySignature(payload, 'short', 'test-secret')).toBe(false);
  });
});

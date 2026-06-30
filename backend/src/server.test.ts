import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServerApp } from './server.js';
import { prisma } from './lib/prisma.js';
import { generateToken } from './lib/auth.js';
import { resetPerformanceMetrics } from './middleware/requestLogger.js';

const app = createServerApp();

describe('server app routes', () => {
  let companyId: string;
  let ownerToken: string;
  let adminToken: string;
  let siteManagerToken: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Metrics Test Company ${Date.now()}` },
      select: { id: true },
    });
    companyId = company.id;

    async function createUser(roleInCompany: string) {
      const user = await prisma.user.create({
        data: {
          email: `metrics-${roleInCompany}-${randomUUID()}@example.com`,
          fullName: `Metrics ${roleInCompany}`,
          companyId,
          roleInCompany,
          emailVerified: true,
          tosAcceptedAt: new Date(),
        },
        select: { id: true, email: true },
      });
      createdUserIds.push(user.id);
      return {
        id: user.id,
        token: generateToken({ userId: user.id, email: user.email, role: roleInCompany }),
      };
    }

    ownerToken = (await createUser('owner')).token;
    adminToken = (await createUser('admin')).token;
    siteManagerToken = (await createUser('site_manager')).token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/metrics', () => {
    it('requires authentication', async () => {
      resetPerformanceMetrics();

      const res = await request(app).get('/api/metrics');

      expect(res.status).toBe(401);
    });

    it('rejects authenticated non-admin company roles', async () => {
      resetPerformanceMetrics();

      const res = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${siteManagerToken}`);

      expect(res.status).toBe(403);
    });

    it('allows owner and admin users to read performance metrics', async () => {
      resetPerformanceMetrics();

      const ownerRes = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${ownerToken}`);
      const adminRes = await request(app)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      for (const res of [ownerRes, adminRes]) {
        expect(res.status).toBe(200);
        expect(res.body).toEqual(
          expect.objectContaining({
            summary: expect.objectContaining({
              totalRequests: expect.any(Number),
              avgResponseTime: expect.any(Number),
              errorCount: expect.any(Number),
            }),
            slowestEndpoints: expect.any(Array),
            timestamp: expect.any(String),
          }),
        );
      }
    });
  });
});

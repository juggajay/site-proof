import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Stub auth: inject a user whose id comes from a header so the test can key its
// own row/rate-limit bucket. companyId is fixed to prove the route derives
// identity server-side, ignoring anything in the body.
vi.mock('../middleware/authMiddleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const id = (req.headers['x-test-user'] as string) || 'user-default';
    (req as unknown as { user: unknown }).user = {
      id,
      userId: id,
      email: 'u@example.com',
      fullName: 'Test User',
      roleInCompany: 'admin',
      role: 'admin',
      companyId: 'company-1',
    };
    next();
  },
}));

import { errorHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { productEventsRouter } from './productEvents.js';
import { createTestUser } from '../test/setup.js';

const app = express();
app.use(express.json());
app.use('/api/product-events', productEventsRouter);
app.use(errorHandler);

describe('POST /api/product-events', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createTestUser();
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.productEvent.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it('persists a registered batch and returns 202 with accepted count', async () => {
    const res = await request(app)
      .post('/api/product-events')
      .set('x-test-user', userId)
      .send({
        events: [
          { event: 'lot_create.opened', metadata: { activityType: 'earthworks' } },
          { event: 'lot_create.submitted' },
          { event: 'lot_create.succeeded', metadata: { usedSuggestedTemplate: true } },
        ],
      });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 3 });

    const rows = await prisma.productEvent.findMany({ where: { userId } });
    expect(rows).toHaveLength(3);
    // Identity is server-derived from the session on every row.
    expect(rows.every((r) => r.userId === userId && r.companyId === 'company-1')).toBe(true);
  });

  it('drops unknown event names but accepts the registered ones', async () => {
    const res = await request(app)
      .post('/api/product-events')
      .set('x-test-user', userId)
      .send({ events: [{ event: 'evil.injection' }, { event: 'lot_create.failed' }] });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 1 });
  });

  it('ignores userId/companyId supplied in the body', async () => {
    const res = await request(app)
      .post('/api/product-events')
      .set('x-test-user', userId)
      .send({
        events: [{ event: 'lot_create.opened', userId: 'attacker', companyId: 'attacker-co' }],
      });

    expect(res.status).toBe(202);
    expect(
      await prisma.productEvent.findMany({ where: { companyId: 'attacker-co' } }),
    ).toHaveLength(0);
  });

  it('rejects a batch larger than 20 with 400', async () => {
    const events = Array.from({ length: 21 }, () => ({ event: 'lot_create.opened' }));
    const res = await request(app)
      .post('/api/product-events')
      .set('x-test-user', userId)
      .send({ events });
    expect(res.status).toBe(400);
  });

  it('rejects an empty batch with 400', async () => {
    const res = await request(app)
      .post('/api/product-events')
      .set('x-test-user', userId)
      .send({ events: [] });
    expect(res.status).toBe(400);
  });
});

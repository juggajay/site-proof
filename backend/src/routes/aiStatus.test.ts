import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Stub auth so the test exercises the handler, not the JWT stack.
vi.mock('../middleware/authMiddleware.js', () => ({
  requireAuth: (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
    next(),
}));

import { aiStatusRouter } from './aiStatus.js';

const app = express();
app.use('/api/ai', aiStatusRouter);

describe('GET /api/ai/status', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('reports aiConfigured=true when a real key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-realkey';
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ aiConfigured: true });
  });

  it('reports aiConfigured=false when the key is missing or a placeholder', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await request(app).get('/api/ai/status')).body).toEqual({ aiConfigured: false });

    process.env.ANTHROPIC_API_KEY = 'sk-placeholder';
    expect((await request(app).get('/api/ai/status')).body).toEqual({ aiConfigured: false });
  });
});

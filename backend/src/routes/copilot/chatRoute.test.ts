import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Stub auth: inject a user (id taken from a header so each test can key its own
// rate-limit bucket; role from x-test-role so the owner/admin gate can be
// exercised — defaults to owner, the happy path). No JWT stack, no DB.
vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const role = (req.headers['x-test-role'] as string) || 'owner';
    req.user = {
      id: (req.headers['x-test-user'] as string) || 'user-default',
      userId: 'user-default',
      email: 'u@example.com',
      fullName: 'Test User',
      roleInCompany: role,
      role,
      companyId: 'company-1',
    };
    next();
  },
}));

// Keep the handler off the DB and network.
vi.mock('./chat/context.js', () => ({ buildChatContext: vi.fn(async () => 'state') }));
vi.mock('./chat/projectStatus.js', () => ({ hasInternalProjectAccess: vi.fn(async () => true) }));
vi.mock('./chat/loop.js', () => ({
  runChatModelLoop: vi.fn(async () => ({ message: 'G’day', actions: [] })),
}));

import { errorHandler } from '../../middleware/errorHandler.js';
import { hasInternalProjectAccess } from './chat/projectStatus.js';
import { chatRouter } from './chatRoute.js';

const app = express();
app.use(express.json());
app.use('/api/copilot', chatRouter);
app.use(errorHandler);

const userMessage = { role: 'user', content: 'hi' };

describe('POST /api/copilot/chat', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-realkey';
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(true);
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('returns a message and actions on the happy path', async () => {
    const res = await request(app)
      .post('/api/copilot/chat')
      .set('x-test-user', 'user-happy')
      .send({ messages: [userMessage] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'G’day', actions: [] });
  });

  it('returns 403 for roles outside owner/admin (owner decision 2026-07-16)', async () => {
    for (const role of ['project_manager', 'foreman', 'site_manager', 'subcontractor']) {
      const res = await request(app)
        .post('/api/copilot/chat')
        .set('x-test-user', `user-role-${role}`)
        .set('x-test-role', role)
        .send({ messages: [userMessage] });
      expect(res.status).toBe(403);
    }

    const admin = await request(app)
      .post('/api/copilot/chat')
      .set('x-test-user', 'user-role-admin')
      .set('x-test-role', 'admin')
      .send({ messages: [userMessage] });
    expect(admin.status).toBe(200);
  });

  it('returns 503 AI_UNAVAILABLE when no Anthropic key is configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await request(app)
      .post('/api/copilot/chat')
      .set('x-test-user', 'user-503')
      .send({ messages: [userMessage] });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('returns 404 for a project the user cannot access', async () => {
    vi.mocked(hasInternalProjectAccess).mockResolvedValue(false);
    const res = await request(app)
      .post('/api/copilot/chat')
      .set('x-test-user', 'user-404')
      .send({ projectId: 'p-forbidden', messages: [userMessage] });

    expect(res.status).toBe(404);
  });

  it('rejects a transcript longer than 20 messages', async () => {
    const messages = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x',
    }));
    // Ensure the last is a user turn so only the length rule can trip.
    messages[messages.length - 1] = userMessage;
    const res = await request(app)
      .post('/api/copilot/chat')
      .set('x-test-user', 'user-long')
      .send({ messages });

    expect(res.status).toBe(400);
  });

  it('rejects a transcript whose last message is not from the user', async () => {
    const res = await request(app)
      .post('/api/copilot/chat')
      .set('x-test-user', 'user-lastrole')
      .send({ messages: [userMessage, { role: 'assistant', content: 'hi back' }] });

    expect(res.status).toBe(400);
  });

  it('rate-limits a single user after the per-minute cap', async () => {
    let sawLimited = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post('/api/copilot/chat')
        .set('x-test-user', 'user-ratelimit')
        .send({ messages: [userMessage] });
      if (res.status === 429) {
        sawLimited = true;
        break;
      }
    }
    expect(sawLimited).toBe(true);
  });
});

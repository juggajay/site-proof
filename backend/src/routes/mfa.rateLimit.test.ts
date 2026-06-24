import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { rateLimiter } from '../middleware/rateLimiter.js';
import { mfaRouter } from './mfa.js';

// The MFA setup/verify/disable endpoints must carry the stricter AUTH rate
// limiter (audit finding: they were only under the lenient global limiter, so a
// stolen session could brute-force TOTP / backup codes with no per-account
// lockout). We mount the router behind only the global limiter and assert the
// sensitive POST routes advertise a LOWER X-RateLimit-Limit (the auth bucket)
// than the GET status route, which keeps just the global limiter. The auth
// limiter runs before requireAuth, so an unauthenticated probe still 401s
// without touching the database.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(rateLimiter);
  app.use('/api/mfa', mfaRouter);
  return app;
}

describe('MFA endpoint rate limiting', () => {
  it('applies the stricter auth limiter to setup/verify-setup/disable but not status', async () => {
    const app = buildApp();

    const status = await request(app).get('/api/mfa/status');
    const setup = await request(app).post('/api/mfa/setup').send({});
    const verifySetup = await request(app).post('/api/mfa/verify-setup').send({});
    const disable = await request(app).post('/api/mfa/disable').send({});

    // The limiter precedes requireAuth, so unauthenticated probes are rejected.
    expect(setup.status).toBe(401);
    expect(verifySetup.status).toBe(401);
    expect(disable.status).toBe(401);

    const statusLimit = Number(status.headers['x-ratelimit-limit']);
    expect(Number(setup.headers['x-ratelimit-limit'])).toBeLessThan(statusLimit);
    expect(Number(verifySetup.headers['x-ratelimit-limit'])).toBeLessThan(statusLimit);
    expect(Number(disable.headers['x-ratelimit-limit'])).toBeLessThan(statusLimit);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { httpsRedirect } from './httpsRedirect.js';

function createApp(trustProxy = false) {
  const app = express();
  if (trustProxy) {
    app.set('trust proxy', true);
  }

  app.use(httpsRedirect);
  app.get('/secure', (_req, res) => res.json({ ok: true }));

  return app;
}

describe('httpsRedirect', () => {
  const originalBackendUrl = process.env.BACKEND_URL;

  beforeEach(() => {
    process.env.BACKEND_URL = 'https://api.siteproof.example';
  });

  afterEach(() => {
    if (originalBackendUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalBackendUrl;
    }
  });

  it('does not trust a spoofed forwarded proto header by default', async () => {
    const res = await request(createApp())
      .get('/secure?projectId=project-1')
      .set('x-forwarded-proto', 'https');

    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('https://api.siteproof.example/secure?projectId=project-1');
  });

  it('allows HTTPS forwarded proto only when Express trust proxy is enabled', async () => {
    const res = await request(createApp(true)).get('/secure').set('x-forwarded-proto', 'https');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

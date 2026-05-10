import { describe, it, expect, afterAll, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { oauthRouter } from './oauth.js';
import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/api/auth', oauthRouter);
app.use(errorHandler);

// Store original env vars to restore later
const originalEnv = { ...process.env };
const testStartedAt = new Date();

function hashOAuthStateForTest(state: string): string {
  const salt = process.env.OAUTH_STATE_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${state}:${salt}`).digest('hex');
}

function hashOAuthCallbackCodeForTest(code: string): string {
  const salt = process.env.OAUTH_CALLBACK_CODE_SALT || process.env.JWT_SECRET || '';
  return crypto.createHash('sha256').update(`${code}:${salt}`).digest('hex');
}

async function createStoredOAuthState(params: {
  state: string;
  expiresAt: Date;
  redirectUri?: string | null;
}): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.oauthState.create({
    data: {
      id,
      stateHash: hashOAuthStateForTest(params.state),
      redirectUri: params.redirectUri ?? null,
      expiresAt: params.expiresAt,
    },
  });
  return id;
}

async function createStoredOAuthCallbackCode(params: {
  code: string;
  userId: string;
  provider?: string;
  expiresAt: Date;
}): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.oauthCallbackCode.create({
    data: {
      id,
      codeHash: hashOAuthCallbackCodeForTest(params.code),
      userId: params.userId,
      provider: params.provider ?? 'google',
      expiresAt: params.expiresAt,
    },
  });
  return id;
}

describe('OAuth Routes', () => {
  beforeEach(() => {
    // Reset environment variables before each test
    process.env.FRONTEND_URL = 'http://localhost:5174';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4007/api/auth/google/callback';
    delete process.env.ALLOW_MOCK_OAUTH;
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  afterAll(async () => {
    await prisma.oauthState.deleteMany({
      where: { createdAt: { gte: testStartedAt } },
    });
    await prisma.oauthCallbackCode.deleteMany({
      where: { createdAt: { gte: testStartedAt } },
    });
  });

  describe('GET /api/auth/google', () => {
    it('should initiate Google OAuth flow in production mode', async () => {
      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBeDefined();
      expect(res.headers.location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(res.headers.location).toContain('client_id=test-client-id.apps.googleusercontent.com');
      expect(res.headers.location).toContain('redirect_uri=');
      expect(res.headers.location).toContain('response_type=code');
      expect(res.headers.location).toContain('scope=openid+email+profile');
      expect(res.headers.location).toContain('state=');
    });

    it('should redirect to mock OAuth in development mode when explicitly enabled', async () => {
      process.env.GOOGLE_CLIENT_ID = 'mock-google-client-id.apps.googleusercontent.com';
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBeDefined();
      expect(res.headers.location).toContain('http://localhost:5174/auth/oauth-mock');
      expect(res.headers.location).toContain('provider=google');
      expect(res.headers.location).toContain('state=');
    });

    it('should redirect to mock OAuth when client ID is not set and mock OAuth is explicitly enabled', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/oauth-mock');
    });

    it('should redirect to login error when Google OAuth and mock OAuth are not configured', async () => {
      delete process.env.GOOGLE_CLIENT_ID;

      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=oauth_not_configured');
    });

    it('should redirect to login error when Google OAuth is not configured in production', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.GOOGLE_CLIENT_ID;

      const res = await request(app).get('/api/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=oauth_not_configured');

      process.env.NODE_ENV = 'test';
    });

    it('should generate a unique state parameter', async () => {
      const res1 = await request(app).get('/api/auth/google');
      const res2 = await request(app).get('/api/auth/google');

      const state1 = new URL(res1.headers.location, 'http://example.com').searchParams.get('state');
      const state2 = new URL(res2.headers.location, 'http://example.com').searchParams.get('state');

      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
      expect(state1).not.toBe(state2);
    });

    it('should store generated state as a hash only', async () => {
      const res = await request(app).get('/api/auth/google');
      const state = new URL(res.headers.location, 'http://example.com').searchParams.get('state');

      expect(state).toBeDefined();

      const rawMatches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM oauth_states WHERE state_hash = ${state}
      `;
      expect(rawMatches.length).toBe(0);

      const storedState = await prisma.oauthState.findUnique({
        where: { stateHash: hashOAuthStateForTest(state!) },
      });
      expect(storedState).toBeDefined();
    });
  });

  describe('GET /api/auth/google/callback', () => {
    it('should redirect to login with error when OAuth error is present', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ error: 'access_denied' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=oauth_failed');
      expect(res.headers.location).toContain('message=access_denied');
    });

    it('should reject repeated OAuth error callback parameters', async () => {
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ error: ['access_denied', 'temporarily_unavailable'] });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=oauth_failed');
      expect(res.headers.location).not.toContain('message=');
    });

    it('should redirect to login when state is missing', async () => {
      const res = await request(app).get('/api/auth/google/callback').query({ code: 'test-code' });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=invalid_state');
    });

    it('should redirect to login when state is invalid', async () => {
      const res = await request(app).get('/api/auth/google/callback').query({
        code: 'test-code',
        state: 'invalid-state-token',
      });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=invalid_state');
    });

    it('should reject repeated state callback parameters without consuming matching state', async () => {
      const state = crypto.randomBytes(16).toString('hex');
      const stateId = await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({
          code: 'test-code',
          state: [state, 'other-state'],
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=invalid_state');

      const storedState = await prisma.oauthState.findUnique({ where: { id: stateId } });
      expect(storedState).not.toBeNull();
    });

    it('should reject repeated code callback parameters without consuming state', async () => {
      const state = crypto.randomBytes(16).toString('hex');
      const stateId = await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({
          code: ['test-code', 'other-code'],
          state,
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=no_code');

      const storedState = await prisma.oauthState.findUnique({ where: { id: stateId } });
      expect(storedState).not.toBeNull();
    });

    it('should redirect to login when code is missing', async () => {
      // Create a valid state token
      const state = crypto.randomBytes(16).toString('hex');
      await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app).get('/api/auth/google/callback').query({ state });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=no_code');

      // Cleanup - state should already be consumed/deleted by the handler
    });

    it('should reject expired state tokens', async () => {
      // Create an expired state token
      const state = crypto.randomBytes(16).toString('hex');
      const stateId = await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      const res = await request(app).get('/api/auth/google/callback').query({
        code: 'test-code',
        state,
      });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=invalid_state');

      // Verify expired state was cleaned up
      const storedState = await prisma.oauthState.findUnique({ where: { id: stateId } });
      expect(storedState).toBeNull();
    });

    it('should consume state token after use (one-time use)', async () => {
      // Create a valid state token
      const state = crypto.randomBytes(16).toString('hex');
      const stateId = await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      // Mock fetch to avoid actual Google API calls
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => 'token_exchange_failed',
      } as Response);

      const res = await request(app).get('/api/auth/google/callback').query({
        code: 'test-code',
        state,
      });

      // Should redirect with error (due to mocked fetch failure)
      expect(res.status).toBe(302);

      // Verify state was consumed
      const storedState = await prisma.oauthState.findUnique({ where: { id: stateId } });
      expect(storedState).toBeNull();

      vi.restoreAllMocks();
    });

    it('should redirect with a one-time code instead of a JWT and exchange it once', async () => {
      const state = crypto.randomBytes(16).toString('hex');
      const email = `oauth-callback-${Date.now()}@example.com`;
      await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-access-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: `google-callback-${Date.now()}`,
            email,
            name: 'OAuth Callback User',
            verified_email: true,
          }),
        } as Response);

      try {
        const res = await request(app).get('/api/auth/google/callback').query({
          code: 'test-code',
          state,
        });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/auth/oauth-callback?code=');
        expect(res.headers.location).not.toContain('token=');

        const callbackUrl = new URL(res.headers.location, 'http://localhost:5174');
        const callbackCode = callbackUrl.searchParams.get('code');
        expect(callbackCode).toBeDefined();

        const rawMatches = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM oauth_callback_codes WHERE code_hash = ${callbackCode}
        `;
        expect(rawMatches.length).toBe(0);

        const storedCode = await prisma.oauthCallbackCode.findUnique({
          where: { codeHash: hashOAuthCallbackCodeForTest(callbackCode!) },
        });
        expect(storedCode).toBeDefined();

        const exchangeRes = await request(app)
          .post('/api/auth/oauth/exchange')
          .send({ code: callbackCode });

        expect(exchangeRes.status).toBe(200);
        expect(exchangeRes.body.token).toBeDefined();
        expect(exchangeRes.body.user.email).toBe(email);

        const reuseRes = await request(app)
          .post('/api/auth/oauth/exchange')
          .send({ code: callbackCode });

        expect(reuseRes.status).toBe(400);
        expect(reuseRes.body.error.message).toContain('Invalid or expired');
      } finally {
        vi.restoreAllMocks();
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
          await prisma.oauthCallbackCode.deleteMany({ where: { userId: user.id } });
          await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
        }
      }
    });

    it('should not issue callback codes for MFA-enabled OAuth users', async () => {
      const state = crypto.randomBytes(16).toString('hex');
      const email = `oauth-callback-mfa-${Date.now()}@example.com`;
      const user = await prisma.user.create({
        data: {
          email,
          fullName: 'OAuth MFA User',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      });
      await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-access-token' }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: `google-callback-mfa-${Date.now()}`,
            email,
            name: 'OAuth MFA User',
            verified_email: true,
          }),
        } as Response);

      try {
        const res = await request(app).get('/api/auth/google/callback').query({
          code: 'test-code',
          state,
        });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/login?error=mfa_required');
        expect(res.headers.location).not.toContain('/auth/oauth-callback?code=');

        const callbackCodes = await prisma.oauthCallbackCode.findMany({
          where: { userId: user.id },
        });
        expect(callbackCodes).toHaveLength(0);
      } finally {
        vi.restoreAllMocks();
        await prisma.oauthCallbackCode.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it('should redirect to login error when callback production secrets are missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.GOOGLE_CLIENT_SECRET;

      const state = crypto.randomBytes(16).toString('hex');
      await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await request(app).get('/api/auth/google/callback').query({
        code: 'test-code',
        state,
      });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/login?error=oauth_not_configured');

      process.env.NODE_ENV = 'test';
    });

    it('should not log raw Google token exchange error bodies', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const state = crypto.randomBytes(16).toString('hex');
      await createStoredOAuthState({
        state,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'client_secret=test-client-secret&id_token=header.payload.signature',
      } as Response);

      try {
        const res = await request(app).get('/api/auth/google/callback').query({
          code: 'test-code',
          state,
        });

        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/login?error=token_exchange_failed');
        const loggedOutput = consoleSpy.mock.calls.flat().map(String).join(' ');
        expect(loggedOutput).toContain('status 400 Bad Request');
        expect(loggedOutput).not.toContain('test-client-secret');
        expect(loggedOutput).not.toContain('header.payload.signature');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('POST /api/auth/oauth/exchange', () => {
    it('should reject a missing callback code', async () => {
      const res = await request(app).post('/api/auth/oauth/exchange').send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('OAuth callback code is required');
    });

    it('should reject and clean up an expired callback code', async () => {
      const user = await prisma.user.create({
        data: {
          email: `oauth-expired-code-${Date.now()}@example.com`,
          emailVerified: true,
        },
      });
      const code = crypto.randomBytes(16).toString('hex');
      const codeId = await createStoredOAuthCallbackCode({
        code,
        userId: user.id,
        expiresAt: new Date(Date.now() - 60 * 1000),
      });

      try {
        const res = await request(app).post('/api/auth/oauth/exchange').send({ code });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Invalid or expired');

        const storedCode = await prisma.oauthCallbackCode.findUnique({ where: { id: codeId } });
        expect(storedCode).toBeNull();
      } finally {
        await prisma.oauthCallbackCode.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it('should not exchange callback codes for MFA-enabled accounts', async () => {
      const user = await prisma.user.create({
        data: {
          email: `oauth-mfa-code-${Date.now()}@example.com`,
          emailVerified: true,
          twoFactorEnabled: true,
        },
      });
      const code = crypto.randomBytes(16).toString('hex');
      const codeId = await createStoredOAuthCallbackCode({
        code,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 1000),
      });

      try {
        const res = await request(app).post('/api/auth/oauth/exchange').send({ code });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('MFA verification required');
        expect(res.body.token).toBeUndefined();

        const storedCode = await prisma.oauthCallbackCode.findUnique({ where: { id: codeId } });
        expect(storedCode).toBeNull();
      } finally {
        await prisma.oauthCallbackCode.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });
  });

  describe('POST /api/auth/google/token', () => {
    const testEmail = `oauth-token-test-${Date.now()}@example.com`;
    let createdUserId: string | null = null;

    afterAll(async () => {
      // Cleanup test user
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
      }
      const user = await prisma.user.findUnique({ where: { email: testEmail } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }
    });

    it('should reject request without credential', async () => {
      const res = await request(app).post('/api/auth/google/token').send({});

      expect(res.status).toBe(400);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.body.error.message).toContain('credential is required');
    });

    it('should reject invalid credential format', async () => {
      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential: 'invalid-format' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid credential format');
    });

    it('should create user and return token for valid Google credential', async () => {
      // Create a mock JWT token (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_${Date.now()}`,
          email: testEmail,
          name: 'OAuth Test User',
          picture: 'https://example.com/avatar.jpg',
          email_verified: true,
          aud: process.env.GOOGLE_CLIENT_ID,
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential, clientId: process.env.GOOGLE_CLIENT_ID });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user.fullName).toBe('OAuth Test User');
      expect(res.body.user.avatarUrl).toBe('https://example.com/avatar.jpg');
      expect(res.body.token).toBeDefined();

      createdUserId = res.body.user.id;
    });

    it('should update existing user with OAuth provider info', async () => {
      // Create a user first
      const existingUser = await prisma.user.create({
        data: {
          email: `oauth-existing-${Date.now()}@example.com`,
          fullName: 'Existing User',
          emailVerified: false,
        },
      });

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_${Date.now()}`,
          email: existingUser.email,
          name: 'Updated Name',
          picture: 'https://example.com/new-avatar.jpg',
          email_verified: true,
          aud: process.env.GOOGLE_CLIENT_ID,
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      const res = await request(app).post('/api/auth/google/token').send({ credential });

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(existingUser.id);
      expect(res.body.user.email).toBe(existingUser.email);

      // Verify user was updated
      const updatedUser = await prisma.user.findUnique({ where: { id: existingUser.id } });
      expect(updatedUser?.emailVerified).toBe(true);
      expect(updatedUser?.emailVerifiedAt).toBeDefined();
      expect(updatedUser?.avatarUrl).toBe('https://example.com/new-avatar.jpg');

      // Cleanup
      await prisma.user.delete({ where: { id: existingUser.id } });
    });

    it('should match existing users using normalized OAuth email casing and whitespace', async () => {
      const normalizedEmail = `oauth-normalized-${Date.now()}@example.com`;
      const existingUser = await prisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: 'Normalized Existing User',
          emailVerified: false,
        },
      });

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_${Date.now()}`,
          email: ` ${normalizedEmail.toUpperCase()} `,
          name: 'Should Not Duplicate',
          picture: 'https://example.com/normalized-avatar.jpg',
          email_verified: true,
          aud: process.env.GOOGLE_CLIENT_ID,
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      try {
        const res = await request(app).post('/api/auth/google/token').send({ credential });

        expect(res.status).toBe(200);
        expect(res.body.user.id).toBe(existingUser.id);
        expect(res.body.user.email).toBe(normalizedEmail);
        expect(
          await prisma.user.findUnique({ where: { email: normalizedEmail.toUpperCase() } }),
        ).toBeNull();
      } finally {
        await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
      }
    });

    it('should not issue Google token auth for MFA-enabled existing users', async () => {
      const existingUser = await prisma.user.create({
        data: {
          email: `oauth-existing-mfa-${Date.now()}@example.com`,
          fullName: 'Existing MFA User',
          emailVerified: true,
          twoFactorEnabled: true,
        },
      });

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_${Date.now()}`,
          email: existingUser.email,
          name: 'Existing MFA User',
          email_verified: true,
          aud: process.env.GOOGLE_CLIENT_ID,
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      try {
        const res = await request(app).post('/api/auth/google/token').send({ credential });

        expect(res.status).toBe(403);
        expect(res.body.error.message).toContain('MFA verification required');
        expect(res.body.token).toBeUndefined();
      } finally {
        await prisma.user.delete({ where: { id: existingUser.id } }).catch(() => {});
      }
    });

    it('should reject mismatched client ID in production', async () => {
      process.env.NODE_ENV = 'production';

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: `google_${Date.now()}`,
          email: 'test@example.com',
          email_verified: 'true',
          iss: 'https://accounts.google.com',
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: 'different-client-id',
        }),
      } as Response);

      const credential = 'header.payload.signature';

      const res = await request(app).post('/api/auth/google/token').send({ credential });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid client ID');

      vi.restoreAllMocks();
      process.env.NODE_ENV = 'test';
    });

    it('should reject Google credentials that fail production verification', async () => {
      process.env.NODE_ENV = 'production';
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'credential=header.payload.signature&client_secret=test-client-secret',
      } as Response);

      try {
        const res = await request(app)
          .post('/api/auth/google/token')
          .send({ credential: 'header.payload.signature' });

        expect(res.status).toBe(401);
        expect(res.body.error.message).toContain('Invalid Google credential');
        const loggedOutput = consoleSpy.mock.calls.flat().map(String).join(' ');
        expect(loggedOutput).toContain('status 400 Bad Request');
        expect(loggedOutput).not.toContain('header.payload.signature');
        expect(loggedOutput).not.toContain('test-client-secret');
      } finally {
        vi.restoreAllMocks();
        process.env.NODE_ENV = 'test';
      }
    });

    it('should reject unverified Google account email', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_${Date.now()}`,
          email: `unverified-${Date.now()}@example.com`,
          email_verified: false,
          aud: 'different-client-id',
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential, clientId: 'different-client-id' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('email is not verified');
    });

    it('should reject invalid Google account email values', async () => {
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_${Date.now()}`,
          email: 'not-an-email',
          email_verified: true,
          aud: process.env.GOOGLE_CLIENT_ID,
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      const res = await request(app)
        .post('/api/auth/google/token')
        .send({ credential, clientId: process.env.GOOGLE_CLIENT_ID });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid email address');
    });

    it('should allow mismatched client ID in development', async () => {
      process.env.NODE_ENV = 'development';

      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
      const payload = Buffer.from(
        JSON.stringify({
          sub: `google_dev_${Date.now()}`,
          email: `oauth-dev-${Date.now()}@example.com`,
          name: 'Dev User',
          email_verified: true,
          aud: 'different-client-id',
        }),
      ).toString('base64');
      const signature = Buffer.from('mock-signature').toString('base64');
      const credential = `${header}.${payload}.${signature}`;

      const res = await request(app).post('/api/auth/google/token').send({ credential });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();

      // Cleanup
      await prisma.user.delete({ where: { id: res.body.user.id } }).catch(() => {});

      process.env.NODE_ENV = 'test';
    });
  });

  describe('POST /api/auth/oauth/mock', () => {
    const mockEmail = `oauth-mock-${Date.now()}@example.com`;
    let createdUserId: string | null = null;

    afterAll(async () => {
      if (createdUserId) {
        await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
      }
    });

    it('should return 404 in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const res = await request(app).post('/api/auth/oauth/mock').send({ email: mockEmail });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');

      process.env.NODE_ENV = 'test';
    });

    it('should return 404 unless mock OAuth is explicitly enabled', async () => {
      const res = await request(app).post('/api/auth/oauth/mock').send({ email: mockEmail });

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('not found');
    });

    it('should reject request without email', async () => {
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const res = await request(app).post('/api/auth/oauth/mock').send({ provider: 'google' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Email is required');
    });

    it('should create mock user and return token', async () => {
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const res = await request(app).post('/api/auth/oauth/mock').send({
        provider: 'google',
        email: mockEmail,
        name: 'Mock User',
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(mockEmail);
      expect(res.body.user.fullName).toBe('Mock User');
      expect(res.body.token).toBeDefined();

      createdUserId = res.body.user.id;
    });

    it('should use email prefix as name when name not provided', async () => {
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const email = `no-name-${Date.now()}@example.com`;
      const res = await request(app).post('/api/auth/oauth/mock').send({
        provider: 'google',
        email,
      });

      expect(res.status).toBe(200);
      expect(res.body.user.fullName).toBe(email.split('@')[0]);

      // Cleanup
      await prisma.user.delete({ where: { id: res.body.user.id } }).catch(() => {});
    });

    it('should default to google provider when not specified', async () => {
      process.env.ALLOW_MOCK_OAUTH = 'true';

      const email = `default-provider-${Date.now()}@example.com`;
      const res = await request(app).post('/api/auth/oauth/mock').send({ email });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();

      // Cleanup
      await prisma.user.delete({ where: { id: res.body.user.id } }).catch(() => {});
    });
  });

  describe('OAuth State Management', () => {
    it('should clean up expired states', async () => {
      // Create an expired state
      const expiredState = crypto.randomBytes(16).toString('hex');
      const expiredId = await createStoredOAuthState({
        state: expiredState,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      // Create a valid state
      const validState = crypto.randomBytes(16).toString('hex');
      await createStoredOAuthState({
        state: validState,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        text: async () => 'token_exchange_failed',
      } as Response);

      // Trigger cleanup by attempting to verify a state
      await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'test', state: validState });

      // Wait a bit for async cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify expired state was deleted
      const expiredRecord = await prisma.oauthState.findUnique({ where: { id: expiredId } });
      expect(expiredRecord).toBeNull();

      // Note: validState will also be deleted as it was consumed during verification
      vi.restoreAllMocks();
    });

    it('should store redirect_uri with state', async () => {
      const state = crypto.randomBytes(16).toString('hex');
      const redirectUri = 'http://localhost:5174/custom-redirect';

      const stateId = await createStoredOAuthState({
        state,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const storedState = await prisma.oauthState.findUnique({ where: { id: stateId } });
      expect(storedState?.redirectUri).toBe(redirectUri);

      // Cleanup
      await prisma.oauthState.delete({ where: { id: stateId } });
    });
  });
});

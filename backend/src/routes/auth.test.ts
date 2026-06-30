import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

vi.mock('otplib', async () => {
  const actual = await vi.importActual<typeof import('otplib')>('otplib');
  return {
    ...actual,
    verify: vi.fn(
      async ({ token, secret }: { token: string; secret: string }) =>
        token === '123456' && secret === 'TESTSECRET1234567890',
    ),
  };
});

// Mock Supabase helpers so individual avatar tests can opt into the Supabase
// branch by overriding the mock returns. By default `isSupabaseConfigured()`
// returns false (matching the vitest.config.ts env, which blanks SUPABASE_URL).
vi.mock('../lib/supabase.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/supabase.js')>('../lib/supabase.js');
  return {
    ...actual,
    isSupabaseConfigured: vi.fn(() => false),
    getSupabaseClient: vi.fn(),
  };
});

import * as supabaseLib from '../lib/supabase.js';
import { authRouter, getSafeDataExportFilename } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { encrypt } from '../lib/encryption.js';
import { needsPasswordRehash, verifyPassword, verifyToken } from '../lib/auth.js';
import { AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import { deleteMfaBackupCodes, enableMfaAndReplaceBackupCodes } from '../lib/mfaBackupCodes.js';
import * as emailService from '../lib/email.js';
import {
  authRateLimiter,
  clearFailedAuthAttempts,
  isLockedOut,
} from '../middleware/rateLimiter.js';

const mockIsSupabaseConfigured = vi.mocked(supabaseLib.isSupabaseConfigured);
const mockGetSupabaseClient = vi.mocked(supabaseLib.getSupabaseClient);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use(errorHandler);

const rateLimitedApp = express();
rateLimitedApp.use(express.json());
rateLimitedApp.use('/api/auth', authRateLimiter, authRouter);
rateLimitedApp.use(errorHandler);

const avatarUploadDir = path.join(process.cwd(), 'uploads', 'avatars');
const tinyPngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function hashAuthTokenForTest(token: string): string {
  return `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function blockFirstTwoFindFirstCalls<TArgs extends unknown[], TResult>(delegate: {
  findFirst: (...args: TArgs) => Promise<TResult>;
}) {
  const originalFindFirst = delegate.findFirst.bind(delegate);
  let reads = 0;
  let unblockReads!: () => void;
  const bothReadsStarted = new Promise<void>((resolve) => {
    unblockReads = resolve;
  });

  return vi.spyOn(delegate, 'findFirst').mockImplementation(async (...args: TArgs) => {
    const result = await originalFindFirst(...args);

    if (reads < 2) {
      reads += 1;
      if (reads === 2) {
        unblockReads();
      }
      await bothReadsStarted;
    }

    return result;
  });
}

function legacyPasswordHashForTest(password: string): string {
  const authSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
  return crypto
    .createHash('sha256')
    .update(password + authSecret)
    .digest('hex');
}

async function clearUserAuditLogs(userId: string) {
  await prisma.auditLog.deleteMany({
    where: {
      OR: [{ userId }, { entityType: 'user', entityId: userId }],
    },
  });
}

async function createActiveApiKeyForUser(userId: string, name: string) {
  const apiKey = `sp_${crypto.randomBytes(32).toString('hex')}`;
  return prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash: crypto.createHash('sha256').update(apiKey).digest('hex'),
      keyPrefix: apiKey.substring(0, 11),
      scopes: 'read',
    },
  });
}

async function expectApiKeyInactive(apiKeyId: string) {
  await expect(prisma.apiKey.findUnique({ where: { id: apiKeyId } })).resolves.toMatchObject({
    isActive: false,
  });
}

async function expectLatestUserAuditLog(userId: string, action: string) {
  const auditLog = await prisma.auditLog.findFirst({
    where: {
      entityType: 'user',
      entityId: userId,
      action,
    },
    orderBy: { createdAt: 'desc' },
  });

  expect(auditLog).toBeDefined();
  if (!auditLog) {
    throw new Error(`Expected ${action} audit log for user ${userId}`);
  }

  return {
    auditLog,
    changes: parseAuditLogChanges(auditLog.changes) as Record<string, unknown>,
  };
}

function listAvatarFiles(prefix: string) {
  if (!fs.existsSync(avatarUploadDir)) {
    return new Set<string>();
  }

  return new Set(fs.readdirSync(avatarUploadDir).filter((name) => name.startsWith(prefix)));
}

describe('getSafeDataExportFilename', () => {
  it('sanitizes unsafe characters from the download filename', () => {
    const filename = getSafeDataExportFilename(
      'bad"user\r\nname/../../x@example.com',
      new Date('2026-01-02T03:04:05.000Z'),
    );

    expect(filename).toBe(
      'siteproof-data-export-bad_user__name_.._.._x@example.com-2026-01-02.json',
    );
    for (const unsafeChar of ['<', '>', ':', '"', '/', '\\', '|', '?', '*', '\r', '\n']) {
      expect(filename).not.toContain(unsafeChar);
    }
  });
});

describe('POST /api/auth/register', () => {
  const testEmail = `test-reg-${Date.now()}@example.com`;

  afterAll(async () => {
    // Clean up test user and related data
    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await clearUserAuditLogs(user.id);
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should register a new user with valid data', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Test User',
      tosAccepted: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    expect(res.body.token).toBeDefined();
    expect(res.body.verificationRequired).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: testEmail } });
    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(verificationToken?.token).toMatch(/^sha256:[a-f0-9]{64}$/);

    const { auditLog, changes } = await expectLatestUserAuditLog(
      user!.id,
      AuditAction.USER_REGISTERED,
    );
    expect(auditLog.userId).toBe(user!.id);
    expect(changes).toEqual({
      emailVerified: { from: null, to: false },
      tosVersion: '1.0',
    });
    expect(JSON.stringify(changes)).not.toMatch(/password|token|secret/i);
  });

  it('does not leave an active verification token or claim email delivery when registration email fails', async () => {
    const email = `failed-register-email-${Date.now()}@example.com`;
    let userId: string | undefined;
    const sendSpy = vi.spyOn(emailService, 'sendVerificationEmail').mockResolvedValueOnce({
      success: false,
      error: 'Verification email provider unavailable',
      statusCode: 503,
      provider: 'resend',
    });

    try {
      const res = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Failed Register Email User',
        tosAccepted: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(email);
      expect(res.body.verificationRequired).toBe(true);
      expect(res.body.verificationEmailSent).toBe(false);
      expect(res.body.message).toContain('could not be sent');
      userId = res.body.user.id as string;

      await expect(
        prisma.emailVerificationToken.count({
          where: {
            userId,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ).resolves.toBe(0);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    } finally {
      sendSpy.mockRestore();
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('auto-verifies explicitly configured demo domains without creating a verification token', async () => {
    const previousBypassDomains = process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS;
    const email = `demo-bypass-${Date.now()}@demo.siteproof.test`;
    let userId: string | undefined;

    try {
      process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS = 'demo.siteproof.test';

      const res = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Demo Bypass User',
        tosAccepted: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.emailVerified).toBe(true);
      expect(res.body.verificationRequired).toBe(false);
      expect(res.body.message).toContain('Email verified');
      userId = res.body.user.id as string;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerifiedAt).toBeInstanceOf(Date);

      const verificationToken = await prisma.emailVerificationToken.findFirst({
        where: { userId },
      });
      expect(verificationToken).toBeNull();

      const registered = await expectLatestUserAuditLog(userId, AuditAction.USER_REGISTERED);
      expect(registered.changes).toEqual({
        emailVerified: { from: null, to: true },
        tosVersion: '1.0',
        method: 'domain_allowlist',
        domain: 'demo.siteproof.test',
      });

      const verified = await expectLatestUserAuditLog(userId, AuditAction.USER_EMAIL_VERIFIED);
      expect(verified.changes).toEqual({
        emailVerified: { from: false, to: true },
        method: 'domain_allowlist',
        domain: 'demo.siteproof.test',
      });
      expect(JSON.stringify(verified.changes)).not.toMatch(/password|token|secret/i);
    } finally {
      if (previousBypassDomains === undefined) {
        delete process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS;
      } else {
        process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS = previousBypassDomains;
      }

      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('keeps unknown domains on the normal email verification path when bypass is configured', async () => {
    const previousBypassDomains = process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS;
    const email = `normal-verification-${Date.now()}@example.com`;
    let userId: string | undefined;

    try {
      process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS = 'demo.siteproof.test';

      const res = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Normal Verification User',
        tosAccepted: true,
      });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.emailVerified).toBe(false);
      expect(res.body.verificationRequired).toBe(true);
      userId = res.body.user.id as string;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerified).toBe(false);
      expect(user?.emailVerifiedAt).toBeNull();

      const verificationToken = await prisma.emailVerificationToken.findFirst({
        where: { userId },
      });
      expect(verificationToken?.token).toMatch(/^sha256:[a-f0-9]{64}$/);

      const verifiedAudit = await prisma.auditLog.findFirst({
        where: {
          entityType: 'user',
          entityId: userId,
          action: AuditAction.USER_EMAIL_VERIFIED,
        },
      });
      expect(verifiedAudit).toBeNull();
    } finally {
      if (previousBypassDomains === undefined) {
        delete process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS;
      } else {
        process.env.VERIFICATION_BYPASS_EMAIL_DOMAINS = previousBypassDomains;
      }

      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('should reject registration without email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      password: 'SecureP@ssword123!',
      tosAccepted: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('required');
  });

  it('should reject registration without password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `no-pass-${Date.now()}@example.com`,
        tosAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('required');
  });

  it('should reject weak passwords', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `weak-${Date.now()}@example.com`,
        password: 'weak',
        tosAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.errors).toBeDefined();
    expect(res.body.error.details.errors.length).toBeGreaterThan(0);
  });

  it('should reject non-string passwords before hashing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `object-password-${Date.now()}@example.com`,
        password: { value: 'SecureP@ssword123!' },
        tosAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Password must be a string');
  });

  it('should reject passwords longer than bcrypt can verify safely', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `long-password-${Date.now()}@example.com`,
        password: `Aa1!${'x'.repeat(69)}`,
        tosAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.errors.some((e: string) => e.includes('72 bytes'))).toBe(true);
  });

  it('should reject password without uppercase', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `nocase-${Date.now()}@example.com`,
        password: 'nouppercase123!',
        tosAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.errors).toBeDefined();
    expect(
      res.body.error.details.errors.some((e: string) => e.toLowerCase().includes('uppercase')),
    ).toBe(true);
  });

  it('should reject password without special character', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `nospecial-${Date.now()}@example.com`,
        password: 'NoSpecialChar123',
        tosAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.errors).toBeDefined();
    expect(
      res.body.error.details.errors.some((e: string) => e.toLowerCase().includes('special')),
    ).toBe(true);
  });

  it('should reject registration without ToS acceptance', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `no-tos-${Date.now()}@example.com`,
        password: 'SecureP@ssword123!',
        tosAccepted: false,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Terms of Service');
  });

  it('should reject duplicate email registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Duplicate User',
      tosAccepted: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already in use');
  });

  it('should normalize email casing and whitespace during registration', async () => {
    const normalizedEmail = `normalize-${Date.now()}@example.com`;

    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: ` ${normalizedEmail.toUpperCase()} `,
          password: 'SecureP@ssword123!',
          fullName: 'Normalized User',
          tosAccepted: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe(normalizedEmail);

      const duplicateRes = await request(app).post('/api/auth/register').send({
        email: normalizedEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Duplicate Normalized User',
        tosAccepted: true,
      });

      expect(duplicateRes.status).toBe(400);
      expect(duplicateRes.body.error.message).toContain('already in use');
    } finally {
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (user) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await clearUserAuditLogs(user.id);
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });
});

describe('JWT invalidation precision', () => {
  async function expectLogoutEndpointInvalidatesImmediateToken(
    endpoint: '/api/auth/logout' | '/api/auth/logout-all-devices',
    expectedAuditChanges: Record<string, unknown>,
  ) {
    const email = `${endpoint.split('/').at(-1)}-immediate-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'SecureP@ssword123!',
      fullName: 'Immediate Logout User',
      tosAccepted: true,
    });

    const token = regRes.body.token as string;
    const userId = regRes.body.user.id as string;

    try {
      await clearUserAuditLogs(userId);

      const logoutRes = await request(app).post(endpoint).set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      const oldSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(oldSessionRes.status).toBe(401);

      const { auditLog, changes } = await expectLatestUserAuditLog(userId, AuditAction.USER_LOGOUT);
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual(expectedAuditChanges);
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  }

  it('rejects typed refresh tokens as bearer sessions', async () => {
    const email = `refresh-token-bearer-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'SecureP@ssword123!',
      fullName: 'Refresh Token Bearer User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id as string;
    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_SECRET || 'dev-secret-change-in-production',
      { expiresIn: '7d' },
    );

    try {
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(meRes.status).toBe(401);
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('rejects tokens invalidated in the same JWT iat second', async () => {
    const email = `jwt-precision-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'SecureP@ssword123!',
      fullName: 'JWT Precision User',
      tosAccepted: true,
    });

    const token = regRes.body.token as string;
    const userId = regRes.body.user.id as string;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as {
      authTime: number;
      iat: number;
    };

    try {
      expect(payload.authTime).toBeGreaterThanOrEqual(payload.iat * 1000);

      await prisma.user.update({
        where: { id: userId },
        data: { tokenInvalidatedAt: new Date(payload.authTime + 1) },
      });

      const verifiedUser = await verifyToken(token);
      expect(verifiedUser).toBeNull();
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('invalidates normal logout immediately after login', async () => {
    await expectLogoutEndpointInvalidatesImmediateToken('/api/auth/logout', {
      scope: 'current_session',
      sessionsInvalidated: true,
    });
  });

  it('keeps other active bearer sessions alive on normal logout', async () => {
    const email = `current-session-logout-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Current Session Logout User',
      tosAccepted: true,
    });

    const firstToken = regRes.body.token as string;
    const userId = regRes.body.user.id as string;

    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      const loginRes = await request(app).post('/api/auth/login').send({ email, password });
      expect(loginRes.status).toBe(200);
      const secondToken = loginRes.body.token as string;
      expect(secondToken).not.toBe(firstToken);

      await clearUserAuditLogs(userId);

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${firstToken}`);
      expect(logoutRes.status).toBe(200);

      const oldSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${firstToken}`);
      expect(oldSessionRes.status).toBe(401);

      const otherSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${secondToken}`);
      expect(otherSessionRes.status).toBe(200);
      expect(otherSessionRes.body.user.id).toBe(userId);

      const revokedToken = await prisma.revokedAuthToken.findUnique({
        where: { tokenHash: hashAuthTokenForTest(firstToken) },
      });
      expect(revokedToken?.userId).toBe(userId);
      expect(revokedToken?.tokenHash).toBe(hashAuthTokenForTest(firstToken));

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenInvalidatedAt: true },
      });
      expect(user?.tokenInvalidatedAt).toBeNull();

      const { auditLog, changes } = await expectLatestUserAuditLog(userId, AuditAction.USER_LOGOUT);
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({
        scope: 'current_session',
        sessionsInvalidated: true,
      });
    } finally {
      await prisma.revokedAuthToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('invalidates logout-all-devices immediately after login', async () => {
    await expectLogoutEndpointInvalidatesImmediateToken('/api/auth/logout-all-devices', {
      scope: 'all_devices',
      sessionsInvalidated: true,
    });
  });
});

describe('Email verification tokens', () => {
  it('audits successful email verification without storing the verification token', async () => {
    const email = `verify-audit-${Date.now()}@example.com`;
    const rawToken = `verify_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Verification Audit User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      userId = regRes.body.user.id as string;

      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.create({
        data: {
          userId,
          token: hashAuthTokenForTest(rawToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await clearUserAuditLogs(userId);

      const verifyRes = await request(app).post('/api/auth/verify-email').send({ token: rawToken });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.verified).toBe(true);

      const verifiedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { emailVerified: true, emailVerifiedAt: true },
      });
      expect(verifiedUser?.emailVerified).toBe(true);
      expect(verifiedUser?.emailVerifiedAt).toBeInstanceOf(Date);

      const { auditLog, changes } = await expectLatestUserAuditLog(
        userId,
        AuditAction.USER_EMAIL_VERIFIED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({
        emailVerified: { from: false, to: true },
        method: 'email_verification',
      });
      expect(JSON.stringify(changes)).not.toContain(rawToken);
      expect(JSON.stringify(changes)).not.toMatch(/token|secret|code/i);
    } finally {
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('allows only one concurrent email verification token consume', async () => {
    const email = `verify-race-${Date.now()}@example.com`;
    const rawToken = `verify_race_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let userId: string | undefined;
    let restoreFindFirstSpy: (() => void) | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Verification Race User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      userId = regRes.body.user.id as string;

      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.create({
        data: {
          userId,
          token: hashAuthTokenForTest(rawToken),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await clearUserAuditLogs(userId);

      const findFirstSpy = blockFirstTwoFindFirstCalls(prisma.emailVerificationToken);
      restoreFindFirstSpy = () => findFirstSpy.mockRestore();
      const responses = await Promise.all([
        request(app).post('/api/auth/verify-email').send({ token: rawToken }),
        request(app).post('/api/auth/verify-email').send({ token: rawToken }),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([200, 400]);

      const tokenRecord = await prisma.emailVerificationToken.findFirstOrThrow({
        where: { token: hashAuthTokenForTest(rawToken) },
      });
      expect(tokenRecord.usedAt).toBeInstanceOf(Date);

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'user',
          entityId: userId,
          action: AuditAction.USER_EMAIL_VERIFIED,
        },
      });
      expect(auditLogs).toHaveLength(1);
    } finally {
      restoreFindFirstSpy?.();
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('rejects plaintext verification token storage', async () => {
    const email = `verify-plaintext-token-${Date.now()}@example.com`;
    const rawToken = `verify_plaintext_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Plaintext Verification User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      userId = regRes.body.user.id as string;

      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await expect(
        prisma.emailVerificationToken.create({
          data: {
            userId,
            token: rawToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }),
      ).rejects.toThrow();

      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.emailVerified).toBe(false);
    } finally {
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('returns the same resend response for verified and unknown emails', async () => {
    const verifiedEmail = `verified-resend-${Date.now()}@example.com`;
    const unknownEmail = `unknown-resend-${Date.now()}@example.com`;
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email: verifiedEmail,
        password: 'SecureP@ssword123!',
        fullName: 'Verified Resend User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      userId = regRes.body.user.id as string;
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });

      const verifiedRes = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: verifiedEmail });
      const unknownRes = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: unknownEmail });

      expect(verifiedRes.status).toBe(200);
      expect(unknownRes.status).toBe(200);
      expect(verifiedRes.body).toEqual(unknownRes.body);
      expect(verifiedRes.body).toEqual({
        message: 'If an account exists with this email, a new verification link has been sent.',
      });
      expect(verifiedRes.body).not.toHaveProperty('alreadyVerified');
    } finally {
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('does not leave an active verification token when resend delivery fails', async () => {
    const email = `failed-resend-${Date.now()}@example.com`;
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password: 'SecureP@ssword123!',
        fullName: 'Failed Resend User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      userId = regRes.body.user.id as string;
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });

      const sendSpy = vi.spyOn(emailService, 'sendVerificationEmail').mockResolvedValueOnce({
        success: false,
        error: 'Verification email provider unavailable',
        statusCode: 503,
        provider: 'resend',
      });

      try {
        const resendRes = await request(app).post('/api/auth/resend-verification').send({ email });

        expect(resendRes.status).toBe(200);
        expect(resendRes.body).toEqual({
          message: 'If an account exists with this email, a new verification link has been sent.',
        });
        expect(sendSpy).toHaveBeenCalledTimes(1);
        await expect(
          prisma.emailVerificationToken.count({
            where: {
              userId,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
          }),
        ).resolves.toBe(0);
      } finally {
        sendSpy.mockRestore();
      }
    } finally {
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await clearUserAuditLogs(userId);
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('rate limits verification resend by target email across source IPs', async () => {
    const targetEmail = `resend-limit-${Date.now()}@example.com`;

    for (let index = 0; index < 3; index += 1) {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .set('X-Forwarded-For', `203.0.113.${index + 1}`)
        .send({ email: targetEmail });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        message: 'If an account exists with this email, a new verification link has been sent.',
      });
    }

    const limitedRes = await request(app)
      .post('/api/auth/resend-verification')
      .set('X-Forwarded-For', '203.0.113.99')
      .send({ email: targetEmail.toUpperCase() });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.error.code).toBe('RATE_LIMITED');
    expect(limitedRes.body.error.message).toContain('Too many verification email requests');
    expect(limitedRes.body.error.details.retryAfter).toBeGreaterThan(0);

    const otherEmailRes = await request(app)
      .post('/api/auth/resend-verification')
      .set('X-Forwarded-For', '203.0.113.100')
      .send({ email: `resend-limit-other-${Date.now()}@example.com` });

    expect(otherEmailRes.status).toBe(200);
  });

  it('does not report replaced verification tokens as already verified', async () => {
    const email = `verify-replaced-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const rawToken = `verify_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Verification Replaced User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      const createdUserId = regRes.body.user.id as string;
      userId = createdUserId;

      await prisma.emailVerificationToken.create({
        data: {
          userId: createdUserId,
          token: hashAuthTokenForTest(rawToken),
          usedAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const statusRes = await request(app)
        .get('/api/auth/verify-email-status')
        .query({ token: rawToken });

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.valid).toBe(false);
      expect(statusRes.body.alreadyVerified).not.toBe(true);
      expect(statusRes.body.message).toContain('used or replaced');

      const verifyRes = await request(app).post('/api/auth/verify-email').send({ token: rawToken });

      expect(verifyRes.status).toBe(400);
      expect(verifyRes.body.error.message).toContain('used or replaced');
    } finally {
      if (userId) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });
});

describe('POST /api/auth/login', () => {
  const loginEmail = `test-login-${Date.now()}@example.com`;
  const loginPassword = 'SecureP@ssword123!';

  beforeAll(async () => {
    // Create test user
    await request(app).post('/api/auth/register').send({
      email: loginEmail,
      password: loginPassword,
      fullName: 'Login Test User',
      tosAccepted: true,
    });
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: loginEmail } });
    if (user) {
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await clearUserAuditLogs(user.id);
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should login with valid credentials', async () => {
    const user = await prisma.user.findUnique({ where: { email: loginEmail } });
    expect(user).toBeDefined();
    await clearUserAuditLogs(user!.id);

    const res = await request(app).post('/api/auth/login').send({
      email: loginEmail,
      password: loginPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.token).toBeDefined();

    const { auditLog, changes } = await expectLatestUserAuditLog(user!.id, AuditAction.USER_LOGIN);
    expect(auditLog.userId).toBe(user!.id);
    expect(changes).toEqual({ method: 'password' });
    expect(JSON.stringify(changes)).not.toContain(loginPassword);
    expect(JSON.stringify(changes)).not.toMatch(/token|secret|code/i);
  });

  it('rehashes a legacy SHA256 password after successful login', async () => {
    const email = `legacy-login-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const legacyHash = legacyPasswordHashForTest(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: legacyHash,
        fullName: 'Legacy Login User',
        roleInCompany: 'admin',
        emailVerified: true,
        tosAcceptedAt: new Date(),
        tosVersion: '2026-06-01',
      },
    });

    try {
      expect(needsPasswordRehash(legacyHash)).toBe(true);

      const res = await request(app).post('/api/auth/login').send({ email, password });

      expect(res.status).toBe(200);

      const refreshedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      expect(refreshedUser?.passwordHash).toBeDefined();
      expect(refreshedUser?.passwordHash).not.toBe(legacyHash);
      expect(needsPasswordRehash(refreshedUser!.passwordHash!)).toBe(false);
      expect(verifyPassword(password, refreshedUser!.passwordHash!)).toBe(true);
    } finally {
      await clearUserAuditLogs(user.id);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it('exposes email verification state on the login payload and refreshes it via /me', async () => {
    const email = `login-verification-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';

    const registerRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Verification Login User',
      tosAccepted: true,
    });
    const userId = registerRes.body.user.id as string;

    try {
      // Default @example.com accounts are not auto-verified, so the freshly
      // registered user can sign in but is flagged unverified - this is what the
      // dismissible "verify your email" nudge keys off.
      const unverifiedLogin = await request(app).post('/api/auth/login').send({ email, password });
      expect(unverifiedLogin.status).toBe(200);
      expect(unverifiedLogin.body.user.emailVerified).toBe(false);

      const unverifiedMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${unverifiedLogin.body.token}`);
      expect(unverifiedMe.status).toBe(200);
      expect(unverifiedMe.body.user.emailVerified).toBe(false);

      // Once the address is confirmed, both hydration paths report it verified
      // so the nudge stops showing.
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      });

      const verifiedLogin = await request(app).post('/api/auth/login').send({ email, password });
      expect(verifiedLogin.status).toBe(200);
      expect(verifiedLogin.body.user.emailVerified).toBe(true);

      const verifiedMe = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${verifiedLogin.body.token}`);
      expect(verifiedMe.status).toBe(200);
      expect(verifiedMe.body.user.emailVerified).toBe(true);
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('should login with normalized email casing and whitespace', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: ` ${loginEmail.toUpperCase()} `,
        password: loginPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(loginEmail);
    expect(res.body.token).toBeDefined();
  });

  it('returns a dashboard role from active project membership when company role is generic', async () => {
    const suffix = Date.now();
    const email = `dashboard-role-${suffix}@example.com`;
    const password = 'SecureP@ssword123!';
    const company = await prisma.company.create({
      data: { name: `Auth Dashboard Role Company ${suffix}` },
    });
    const project = await prisma.project.create({
      data: {
        name: `Auth Dashboard Role Project ${suffix}`,
        projectNumber: `AUTH-DR-${suffix}`,
        companyId: company.id,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const userRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Dashboard Role User',
      tosAccepted: true,
    });
    const userId = userRes.body.user.id as string;

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { companyId: company.id, roleInCompany: 'member' },
      });
      await prisma.projectUser.create({
        data: {
          projectId: project.id,
          userId,
          role: 'quality_manager',
          status: 'active',
          acceptedAt: new Date(),
        },
      });

      const loginRes = await request(app).post('/api/auth/login').send({ email, password });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.role).toBe('member');
      expect(loginRes.body.user.dashboardRole).toBe('quality_manager');

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.role).toBe('member');
      expect(meRes.body.user.dashboardRole).toBe('quality_manager');

      await prisma.projectUser.updateMany({
        where: { projectId: project.id, userId },
        data: { role: 'viewer' },
      });

      const viewerLoginRes = await request(app).post('/api/auth/login').send({ email, password });
      expect(viewerLoginRes.status).toBe(200);
      expect(viewerLoginRes.body.user.role).toBe('member');
      expect(viewerLoginRes.body.user.dashboardRole).toBe('viewer');

      await prisma.projectUser.updateMany({
        where: { projectId: project.id, userId },
        data: { role: 'site_engineer' },
      });

      const engineerLoginRes = await request(app).post('/api/auth/login').send({ email, password });
      expect(engineerLoginRes.status).toBe(200);
      expect(engineerLoginRes.body.user.role).toBe('member');
      expect(engineerLoginRes.body.user.dashboardRole).toBe('site_engineer');
    } finally {
      await prisma.projectUser.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('does not expose subcontractor portal access for head-contractor users with stale links', async () => {
    const suffix = Date.now();
    const company = await prisma.company.create({
      data: { name: `Auth Stale Link Company ${suffix}` },
    });
    const project = await prisma.project.create({
      data: {
        name: `Auth Stale Link Project ${suffix}`,
        projectNumber: `AUTH-STL-${suffix}`,
        companyId: company.id,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId: project.id,
        companyName: `Auth Stale Link Subbie ${suffix}`,
        primaryContactName: 'Auth Stale Link User',
        primaryContactEmail: loginEmail,
        status: 'approved',
      },
    });
    const user = await prisma.user.findUnique({ where: { email: loginEmail } });
    expect(user).toBeDefined();

    try {
      await prisma.user.update({
        where: { id: user!.id },
        data: { companyId: company.id, roleInCompany: 'owner' },
      });
      await prisma.subcontractorUser.create({
        data: {
          userId: user!.id,
          subcontractorCompanyId: subcontractor.id,
          role: 'admin',
        },
      });

      const loginRes = await request(app).post('/api/auth/login').send({
        email: loginEmail,
        password: loginPassword,
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.companyId).toBe(company.id);
      expect(loginRes.body.user.hasSubcontractorPortalAccess).toBe(false);

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.hasSubcontractorPortalAccess).toBe(false);
    } finally {
      await prisma.subcontractorUser.deleteMany({ where: { userId: user!.id } });
      await prisma.subcontractorCompany.delete({ where: { id: subcontractor.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.user.update({
        where: { id: user!.id },
        data: { companyId: null, roleInCompany: 'member' },
      });
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('should reject invalid email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@example.com',
      password: loginPassword,
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('Invalid');
  });

  it('should reject wrong password', async () => {
    const user = await prisma.user.findUnique({ where: { email: loginEmail } });
    expect(user).toBeDefined();
    await clearUserAuditLogs(user!.id);

    try {
      const res = await request(app).post('/api/auth/login').send({
        email: loginEmail,
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid');

      const { auditLog, changes } = await expectLatestUserAuditLog(
        user!.id,
        AuditAction.USER_LOGIN_FAILED,
      );
      expect(auditLog.userId).toBe(user!.id);
      expect(changes).toEqual({ method: 'password', reason: 'invalid_credentials' });
      expect(JSON.stringify(changes)).not.toContain('WrongPassword123!');
      expect(JSON.stringify(changes)).not.toMatch(/token|secret|code/i);
    } finally {
      await clearUserAuditLogs(user!.id);
    }
  });

  it('should record failed login attempts and clear them after successful login', async () => {
    const sourceIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    await clearFailedAuthAttempts(sourceIp);

    for (let i = 0; i < 4; i++) {
      const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', sourceIp).send({
        email: loginEmail,
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
    }

    expect((await isLockedOut(sourceIp)).locked).toBe(false);

    const successRes = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', sourceIp)
      .send({
        email: loginEmail,
        password: loginPassword,
      });

    expect(successRes.status).toBe(200);
    expect((await isLockedOut(sourceIp)).locked).toBe(false);
  });

  it('should not clear source-level auth failures after a successful account login', async () => {
    const sourceIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    await clearFailedAuthAttempts(sourceIp);
    await clearFailedAuthAttempts(sourceIp, loginEmail);

    try {
      for (let i = 0; i < 4; i++) {
        const res = await request(rateLimitedApp)
          .post('/api/auth/login')
          .set('X-Forwarded-For', sourceIp)
          .send({
            email: loginEmail,
            password: 'WrongPassword123!',
          });

        expect(res.status).toBe(401);
      }

      const successRes = await request(rateLimitedApp)
        .post('/api/auth/login')
        .set('X-Forwarded-For', sourceIp)
        .send({
          email: loginEmail,
          password: loginPassword,
        });

      expect(successRes.status).toBe(200);

      const fifthFailureRes = await request(rateLimitedApp)
        .post('/api/auth/login')
        .set('X-Forwarded-For', sourceIp)
        .send({
          email: loginEmail,
          password: 'WrongPassword123!',
        });

      expect(fifthFailureRes.status).toBe(401);

      const blockedRes = await request(rateLimitedApp)
        .post('/api/auth/login')
        .set('X-Forwarded-For', sourceIp)
        .send({
          email: loginEmail,
          password: loginPassword,
        });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
    } finally {
      await clearFailedAuthAttempts(sourceIp);
      await clearFailedAuthAttempts(sourceIp, loginEmail);
    }
  });

  it('should block login through auth rate limiter after the lockout threshold', async () => {
    const sourceIp = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    await clearFailedAuthAttempts(sourceIp);

    for (let i = 0; i < 5; i++) {
      const res = await request(rateLimitedApp)
        .post('/api/auth/login')
        .set('X-Forwarded-For', sourceIp)
        .send({
          email: loginEmail,
          password: 'WrongPassword123!',
        });

      expect(res.status).toBe(401);
    }

    const blockedRes = await request(rateLimitedApp)
      .post('/api/auth/login')
      .set('X-Forwarded-For', sourceIp)
      .send({
        email: loginEmail,
        password: loginPassword,
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('ACCOUNT_LOCKED');

    await clearFailedAuthAttempts(sourceIp);
  });

  it('should reject login without email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      password: loginPassword,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('required');
  });

  it('should reject login without password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: loginEmail,
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('required');
  });

  it('should login with a valid MFA code when the stored secret is encrypted', async () => {
    const previousEncryptionKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    try {
      const user = await prisma.user.findUnique({ where: { email: loginEmail } });
      expect(user).toBeDefined();

      await prisma.user.update({
        where: { id: user!.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encrypt('TESTSECRET1234567890'),
        },
      });

      const challengeRes = await request(app).post('/api/auth/login').send({
        email: loginEmail,
        password: loginPassword,
      });

      expect(challengeRes.status).toBe(200);
      expect(challengeRes.body.mfaRequired).toBe(true);
      expect(challengeRes.body.userId).toBe(user!.id);
      expect(typeof challengeRes.body.mfaChallengeToken).toBe('string');

      const res = await request(app).post('/api/auth/login').send({
        email: loginEmail,
        password: loginPassword,
        mfaCode: '123456',
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
    } finally {
      const user = await prisma.user.findUnique({ where: { email: loginEmail } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
          },
        });
      }

      if (previousEncryptionKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousEncryptionKey;
      }
    }
  });

  it('should login with a valid backup code once', async () => {
    const previousEncryptionKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    try {
      const user = await prisma.user.findUnique({ where: { email: loginEmail } });
      expect(user).toBeDefined();

      await prisma.user.update({
        where: { id: user!.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encrypt('TESTSECRET1234567890'),
        },
      });
      await enableMfaAndReplaceBackupCodes(user!.id, ['ABCDEF1234']);

      const res = await request(app).post('/api/auth/login').send({
        email: loginEmail,
        password: loginPassword,
        mfaCode: 'ABCDEF1234',
      });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();

      const reuseRes = await request(app).post('/api/auth/login').send({
        email: loginEmail,
        password: loginPassword,
        mfaCode: 'ABCDEF1234',
      });

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.message).toContain('Invalid MFA code');

      const { auditLog, changes } = await expectLatestUserAuditLog(
        user!.id,
        AuditAction.USER_LOGIN_FAILED,
      );
      expect(auditLog.userId).toBe(user!.id);
      expect(changes).toEqual({ method: 'password_mfa', reason: 'invalid_mfa' });
      expect(JSON.stringify(changes)).not.toContain('ABCDEF1234');
      expect(JSON.stringify(changes)).not.toMatch(/token|secret|code/i);
    } finally {
      const user = await prisma.user.findUnique({ where: { email: loginEmail } });
      if (user) {
        await clearUserAuditLogs(user.id);
        await deleteMfaBackupCodes(user.id);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
          },
        });
      }

      if (previousEncryptionKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousEncryptionKey;
      }
    }
  });

  it('should reject malformed MFA codes before verification', async () => {
    const previousEncryptionKey = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);

    try {
      const user = await prisma.user.findUnique({ where: { email: loginEmail } });
      expect(user).toBeDefined();

      await prisma.user.update({
        where: { id: user!.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: encrypt('TESTSECRET1234567890'),
        },
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginEmail,
          password: loginPassword,
          mfaCode: { code: '123456' },
        });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toContain('Invalid MFA code');
    } finally {
      const user = await prisma.user.findUnique({ where: { email: loginEmail } });
      if (user) {
        await deleteMfaBackupCodes(user.id);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            twoFactorEnabled: false,
            twoFactorSecret: null,
          },
        });
      }

      if (previousEncryptionKey === undefined) {
        delete process.env.ENCRYPTION_KEY;
      } else {
        process.env.ENCRYPTION_KEY = previousEncryptionKey;
      }
    }
  });
});

describe('Password Reset Flow', () => {
  const resetEmail = `test-reset-${Date.now()}@example.com`;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      email: resetEmail,
      password: 'OldPassword123!',
      fullName: 'Reset Test User',
      tosAccepted: true,
    });
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await clearUserAuditLogs(user.id);
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should send reset email for existing user (always returns success)', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();
    await clearUserAuditLogs(user!.id);

    const res = await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');

    const storedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedToken?.token).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(storedToken?.purpose).toBe('password_reset');

    const { auditLog, changes } = await expectLatestUserAuditLog(
      user!.id,
      AuditAction.PASSWORD_RESET_REQUESTED,
    );
    expect(auditLog.userId).toBe(user!.id);
    expect(changes).toEqual({ method: 'email', expiresInMinutes: 60 });
    expect(JSON.stringify(changes)).not.toContain(storedToken!.token);
    expect(JSON.stringify(changes)).not.toMatch(/token|secret|password/i);

    const leakedStoredTokenRes = await request(app).post('/api/auth/reset-password').send({
      token: storedToken!.token,
      password: 'NewPassword123!',
    });

    expect(leakedStoredTokenRes.status).toBe(400);
    expect(leakedStoredTokenRes.body.error.message).toContain('Invalid');
  });

  it('should not reveal if email exists', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');
  });

  it('does not leave an active reset token when reset email delivery fails', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user!.id, purpose: 'password_reset' },
    });
    await clearUserAuditLogs(user!.id);

    const sendSpy = vi.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValueOnce({
      success: false,
      error: 'Daily email sending quota exceeded',
      errorCode: 'daily_quota_exceeded',
      statusCode: 429,
      provider: 'resend',
    });

    try {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If an account exists');
      expect(sendSpy).toHaveBeenCalledTimes(1);
      await expect(
        prisma.passwordResetToken.count({
          where: {
            userId: user!.id,
            purpose: 'password_reset',
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.auditLog.count({
          where: {
            entityType: 'user',
            entityId: user!.id,
            action: AuditAction.PASSWORD_RESET_REQUESTED,
          },
        }),
      ).resolves.toBe(0);
    } finally {
      sendSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user!.id, purpose: 'password_reset' },
      });
      await clearUserAuditLogs(user!.id);
    }
  });

  it('should reject reset with invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'invalid-token',
      password: 'NewPassword123!',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid');
  });

  it('rejects plaintext password reset and magic-link token storage', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();

    await expect(
      prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          token: `plaintext-reset-${Date.now()}`,
          purpose: 'password_reset',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.passwordResetToken.create({
        data: {
          userId: user!.id,
          token: `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          purpose: 'magic_link',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it('should reject magic-link tokens on password reset endpoints', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();

    const token = `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: hashAuthTokenForTest(token),
        purpose: 'magic_link',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token,
        password: 'NewPassword123!',
      });

      expect(resetRes.status).toBe(400);
      expect(resetRes.body.error.message).toContain('Invalid or expired reset token');

      const validateRes = await request(app).get('/api/auth/validate-reset-token').query({ token });

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.valid).toBe(false);
      expect(validateRes.body.message).toContain('Invalid or expired reset token');
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { token: hashAuthTokenForTest(token) } });
    }
  });

  it('should return a uniform validation message for invalid, used, and expired reset tokens', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();

    const unknownToken = `reset_unknown_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const usedToken = `reset_used_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const expiredToken = `reset_expired_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const createdTokenHashes = [usedToken, expiredToken].map(hashAuthTokenForTest);

    await prisma.passwordResetToken.createMany({
      data: [
        {
          userId: user!.id,
          token: hashAuthTokenForTest(usedToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(),
        },
        {
          userId: user!.id,
          token: hashAuthTokenForTest(expiredToken),
          expiresAt: new Date(Date.now() - 60 * 1000),
        },
      ],
    });

    try {
      for (const token of [unknownToken, usedToken, expiredToken]) {
        const res = await request(app).get('/api/auth/validate-reset-token').query({ token });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          valid: false,
          message: 'Invalid or expired reset token',
        });
      }
    } finally {
      await prisma.passwordResetToken.deleteMany({
        where: { token: { in: createdTokenHashes } },
      });
    }
  });

  it('should return a uniform reset-submit message for invalid, used, and expired reset tokens', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();

    const unknownToken = `reset_submit_unknown_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const usedToken = `reset_submit_used_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const expiredToken = `reset_submit_expired_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const createdTokenHashes = [usedToken, expiredToken].map(hashAuthTokenForTest);

    await prisma.passwordResetToken.createMany({
      data: [
        {
          userId: user!.id,
          token: hashAuthTokenForTest(usedToken),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          usedAt: new Date(),
        },
        {
          userId: user!.id,
          token: hashAuthTokenForTest(expiredToken),
          expiresAt: new Date(Date.now() - 60 * 1000),
        },
      ],
    });

    try {
      for (const token of [unknownToken, usedToken, expiredToken]) {
        const res = await request(app).post('/api/auth/reset-password').send({
          token,
          password: 'NewPassword123!',
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe('Invalid or expired reset token');
      }
    } finally {
      await prisma.passwordResetToken.deleteMany({
        where: { token: { in: createdTokenHashes } },
      });
    }
  });

  it('should reject weak replacement passwords during reset', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();

    const token = `reset_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: hashAuthTokenForTest(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const res = await request(app).post('/api/auth/reset-password').send({
        token,
        password: 'weakpassword',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('security requirements');
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { token: hashAuthTokenForTest(token) } });
    }
  });

  it('allows only one concurrent password reset token consume', async () => {
    const email = `reset-race-${Date.now()}@example.com`;
    const oldPassword = 'OldPassword123!';
    const firstPassword = 'FirstNewPassword123!';
    const secondPassword = 'SecondNewPassword123!';
    const token = `reset_race_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: oldPassword,
      fullName: 'Reset Race User',
      tosAccepted: true,
    });
    const userId = regRes.body.user.id as string;
    const findFirstSpy = blockFirstTwoFindFirstCalls(prisma.passwordResetToken);

    await prisma.passwordResetToken.create({
      data: {
        userId,
        token: hashAuthTokenForTest(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      await clearUserAuditLogs(userId);

      const responses = await Promise.all([
        request(app).post('/api/auth/reset-password').send({
          token,
          password: firstPassword,
        }),
        request(app).post('/api/auth/reset-password').send({
          token,
          password: secondPassword,
        }),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([200, 400]);

      const tokenRecord = await prisma.passwordResetToken.findFirstOrThrow({
        where: { token: hashAuthTokenForTest(token) },
      });
      expect(tokenRecord.usedAt).toBeInstanceOf(Date);

      const loginResponses = await Promise.all([
        request(app).post('/api/auth/login').send({ email, password: firstPassword }),
        request(app).post('/api/auth/login').send({ email, password: secondPassword }),
      ]);
      expect(loginResponses.filter((res) => res.status === 200)).toHaveLength(1);

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'user',
          entityId: userId,
          action: AuditAction.PASSWORD_CHANGED,
        },
      });
      expect(auditLogs).toHaveLength(1);
    } finally {
      findFirstSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('should invalidate existing sessions after password reset', async () => {
    const email = `reset-invalidates-session-${Date.now()}@example.com`;
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: oldPassword,
      fullName: 'Reset Session User',
      tosAccepted: true,
    });
    const userId = regRes.body.user.id;
    const oldToken = regRes.body.token;
    const resetToken = `reset_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await prisma.passwordResetToken.create({
      data: {
        userId,
        token: hashAuthTokenForTest(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const apiKeyRecord = await createActiveApiKeyForUser(userId, 'Password Reset API Key');

    try {
      await clearUserAuditLogs(userId);

      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: newPassword,
      });

      expect(resetRes.status).toBe(200);

      const [tokenRecord, resetUser] = await Promise.all([
        prisma.passwordResetToken.findFirstOrThrow({
          where: { token: hashAuthTokenForTest(resetToken) },
          select: { usedAt: true },
        }),
        prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { tokenInvalidatedAt: true },
        }),
      ]);
      expect(tokenRecord.usedAt).toBeInstanceOf(Date);
      expect(resetUser.tokenInvalidatedAt).toBeInstanceOf(Date);
      expect(resetUser.tokenInvalidatedAt!.getTime()).toBeGreaterThan(
        tokenRecord.usedAt!.getTime(),
      );

      const oldSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);

      expect(oldSessionRes.status).toBe(401);
      await expectApiKeyInactive(apiKeyRecord.id);

      const { auditLog, changes } = await expectLatestUserAuditLog(
        userId,
        AuditAction.PASSWORD_CHANGED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({
        method: 'password_reset',
        sessionsInvalidated: true,
        apiAccessRevoked: 1,
      });
      expect(JSON.stringify(changes)).not.toContain(oldPassword);
      expect(JSON.stringify(changes)).not.toContain(newPassword);
      expect(JSON.stringify(changes)).not.toContain(resetToken);
      expect(JSON.stringify(changes)).not.toMatch(/token|secret/i);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId } });
      await prisma.apiKey.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('requires ToS acceptance when a pending company invite sets a password', async () => {
    const company = await prisma.company.create({
      data: { name: `Pending Reset ToS Company ${Date.now()}` },
    });
    const invitedUser = await prisma.user.create({
      data: {
        email: `pending-reset-no-tos-${Date.now()}@example.com`,
        fullName: 'Pending Reset No ToS',
        companyId: company.id,
        roleInCompany: 'foreman',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    const resetToken = `pending_reset_no_tos_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: invitedUser.id,
        token: hashAuthTokenForTest(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const validateRes = await request(app)
        .get('/api/auth/validate-reset-token')
        .query({ token: resetToken });
      expect(validateRes.status).toBe(200);
      expect(validateRes.body).toMatchObject({ valid: true, requiresTosAcceptance: true });

      const res = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: 'NewPassword123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Terms of Service');

      const [userAfterReset, tokenAfterReset] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: invitedUser.id } }),
        prisma.passwordResetToken.findFirstOrThrow({
          where: { token: hashAuthTokenForTest(resetToken) },
        }),
      ]);
      expect(userAfterReset.passwordHash).toBeNull();
      expect(userAfterReset.tosAcceptedAt).toBeNull();
      expect(tokenAfterReset.usedAt).toBeNull();
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId: invitedUser.id } });
      await clearUserAuditLogs(invitedUser.id);
      await prisma.user.delete({ where: { id: invitedUser.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('records ToS acceptance when a pending company invite sets a password', async () => {
    const company = await prisma.company.create({
      data: { name: `Pending Reset Accept ToS Company ${Date.now()}` },
    });
    const invitedUser = await prisma.user.create({
      data: {
        email: `pending-reset-accept-tos-${Date.now()}@example.com`,
        fullName: 'Pending Reset Accept ToS',
        companyId: company.id,
        roleInCompany: 'foreman',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    const resetToken = `pending_reset_accept_tos_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: invitedUser.id,
        token: hashAuthTokenForTest(resetToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const res = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: 'NewPassword123!',
        tosAccepted: true,
      });

      expect(res.status).toBe(200);

      const [userAfterReset, tokenAfterReset] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: invitedUser.id } }),
        prisma.passwordResetToken.findFirstOrThrow({
          where: { token: hashAuthTokenForTest(resetToken) },
        }),
      ]);
      expect(userAfterReset.passwordHash).toBeTruthy();
      expect(userAfterReset.tosAcceptedAt).toBeInstanceOf(Date);
      expect(userAfterReset.tosVersion).toBe('1.0');
      expect(tokenAfterReset.usedAt).toBeInstanceOf(Date);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId: invitedUser.id } });
      await clearUserAuditLogs(invitedUser.id);
      await prisma.user.delete({ where: { id: invitedUser.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });
});

describe('Password Change', () => {
  it('should reject weak new passwords', async () => {
    const email = `change-password-weak-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Weak Change Password User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;

    try {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({
          currentPassword: password,
          newPassword: 'weakpassword',
          confirmPassword: 'weakpassword',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('security requirements');
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('should invalidate existing sessions after password change', async () => {
    const email = `change-password-session-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const newPassword = 'NewSecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Change Password Session User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;
    const oldToken = regRes.body.token;
    const apiKeyRecord = await createActiveApiKeyForUser(userId, 'Password Change API Key');

    try {
      await clearUserAuditLogs(userId);

      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({
          currentPassword: password,
          newPassword,
          confirmPassword: newPassword,
        });

      expect(changeRes.status).toBe(200);

      const oldSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);

      expect(oldSessionRes.status).toBe(401);
      await expectApiKeyInactive(apiKeyRecord.id);

      const { auditLog, changes } = await expectLatestUserAuditLog(
        userId,
        AuditAction.PASSWORD_CHANGED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({
        method: 'password_change',
        sessionsInvalidated: true,
        apiAccessRevoked: 1,
      });
      expect(JSON.stringify(changes)).not.toContain(password);
      expect(JSON.stringify(changes)).not.toContain(newPassword);
      expect(JSON.stringify(changes)).not.toMatch(/token|secret/i);
    } finally {
      await prisma.apiKey.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await clearUserAuditLogs(userId);
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });
});

describe('Test auth helper endpoints', () => {
  it('should hide the expired-token helper unless explicitly enabled', async () => {
    const previousFlag = process.env.ALLOW_TEST_AUTH_ENDPOINTS;
    delete process.env.ALLOW_TEST_AUTH_ENDPOINTS;

    try {
      const res = await request(app).post('/api/auth/test-expired-token').send({
        email: 'nobody@example.com',
        password: 'SecureP@ssword123!',
      });

      expect(res.status).toBe(404);
    } finally {
      if (previousFlag === undefined) {
        delete process.env.ALLOW_TEST_AUTH_ENDPOINTS;
      } else {
        process.env.ALLOW_TEST_AUTH_ENDPOINTS = previousFlag;
      }
    }
  });
});

describe('Magic Link Authentication', () => {
  const magicEmail = `test-magic-${Date.now()}@example.com`;

  beforeAll(async () => {
    await request(app).post('/api/auth/register').send({
      email: magicEmail,
      password: 'SecureP@ssword123!',
      fullName: 'Magic Link User',
      tosAccepted: true,
    });
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    if (user) {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
      await clearUserAuditLogs(user.id);
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should request magic link for existing user', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();
    await clearUserAuditLogs(user!.id);

    const res = await request(app).post('/api/auth/magic-link/request').send({ email: magicEmail });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');

    const storedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedToken?.token).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(storedToken?.purpose).toBe('magic_link');
    expect(storedToken?.token.startsWith('magic_')).toBe(false);

    const { auditLog, changes } = await expectLatestUserAuditLog(
      user!.id,
      AuditAction.MAGIC_LINK_REQUESTED,
    );
    expect(auditLog.userId).toBe(user!.id);
    expect(changes).toEqual({
      method: 'magic_link',
      expiresInMinutes: 15,
      redirectPreserved: false,
    });
    expect(JSON.stringify(changes)).not.toContain(storedToken!.token);
    expect(JSON.stringify(changes)).not.toMatch(/token|secret|password/i);
  });

  it('should include a safe relative redirect in the magic link email', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();
    await clearUserAuditLogs(user!.id);

    const sendSpy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValueOnce({
      success: true,
    });

    try {
      const redirect = '/subcontractor-portal/accept-invite?id=invite-1';
      const res = await request(app)
        .post('/api/auth/magic-link/request')
        .send({ email: magicEmail, redirect });

      expect(res.status).toBe(200);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const magicLinkUrl = sendSpy.mock.calls[0]?.[0]?.magicLinkUrl;
      expect(magicLinkUrl).toBeDefined();
      const parsedUrl = new URL(magicLinkUrl!);
      expect(parsedUrl.pathname).toBe('/auth/magic-link');
      expect(parsedUrl.searchParams.get('token')).toMatch(/^magic_/);
      expect(parsedUrl.searchParams.get('redirect')).toBe(redirect);

      const { changes } = await expectLatestUserAuditLog(
        user!.id,
        AuditAction.MAGIC_LINK_REQUESTED,
      );
      expect(changes).toEqual({
        method: 'magic_link',
        expiresInMinutes: 15,
        redirectPreserved: true,
      });
      expect(JSON.stringify(changes)).not.toContain(redirect);
    } finally {
      sendSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({ where: { userId: user!.id } });
      await clearUserAuditLogs(user!.id);
    }
  });

  it('should ignore unsafe magic link redirects', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();
    await clearUserAuditLogs(user!.id);

    const sendSpy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValueOnce({
      success: true,
    });

    try {
      const res = await request(app)
        .post('/api/auth/magic-link/request')
        .send({ email: magicEmail, redirect: '//evil.example/steal' });

      expect(res.status).toBe(200);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const magicLinkUrl = sendSpy.mock.calls[0]?.[0]?.magicLinkUrl;
      expect(magicLinkUrl).toBeDefined();
      const parsedUrl = new URL(magicLinkUrl!);
      expect(parsedUrl.searchParams.get('redirect')).toBeNull();

      const { changes } = await expectLatestUserAuditLog(
        user!.id,
        AuditAction.MAGIC_LINK_REQUESTED,
      );
      expect(changes).toEqual({
        method: 'magic_link',
        expiresInMinutes: 15,
        redirectPreserved: false,
      });
    } finally {
      sendSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({ where: { userId: user!.id } });
      await clearUserAuditLogs(user!.id);
    }
  });

  it('should not invalidate active password reset tokens when requesting a magic link', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();

    const resetToken = `reset_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const resetTokenHash = hashAuthTokenForTest(resetToken);
    const resetRecord = await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: resetTokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const res = await request(app)
        .post('/api/auth/magic-link/request')
        .send({ email: magicEmail });

      expect(res.status).toBe(200);

      const preservedResetToken = await prisma.passwordResetToken.findUnique({
        where: { id: resetRecord.id },
      });
      expect(preservedResetToken?.usedAt).toBeNull();

      const validateRes = await request(app)
        .get('/api/auth/validate-reset-token')
        .query({ token: resetToken });

      expect(validateRes.status).toBe(200);
      expect(validateRes.body.valid).toBe(true);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user!.id } });
    }
  });

  it('should not reveal non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/request')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');
  });

  it('does not create or send magic links for MFA-enabled accounts', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();

    const sendSpy = vi
      .spyOn(emailService, 'sendMagicLinkEmail')
      .mockResolvedValueOnce({ success: true });

    await prisma.user.update({
      where: { id: user!.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encrypt('TESTSECRET1234567890'),
      },
    });
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user!.id, purpose: 'magic_link' },
    });
    await clearUserAuditLogs(user!.id);

    try {
      const res = await request(app)
        .post('/api/auth/magic-link/request')
        .send({ email: magicEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If an account exists');
      expect(sendSpy).not.toHaveBeenCalled();
      await expect(
        prisma.passwordResetToken.count({
          where: {
            userId: user!.id,
            purpose: 'magic_link',
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.auditLog.count({
          where: {
            entityType: 'user',
            entityId: user!.id,
            action: AuditAction.MAGIC_LINK_REQUESTED,
          },
        }),
      ).resolves.toBe(0);
    } finally {
      sendSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user!.id, purpose: 'magic_link' },
      });
      await prisma.user.update({
        where: { id: user!.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
      await clearUserAuditLogs(user!.id);
    }
  });

  it('does not create or send magic links for pending company invite users', async () => {
    const company = await prisma.company.create({
      data: { name: `Pending Magic Request Company ${Date.now()}` },
    });
    const invitedUser = await prisma.user.create({
      data: {
        email: `pending-magic-request-${Date.now()}@example.com`,
        fullName: 'Pending Magic Request',
        companyId: company.id,
        roleInCompany: 'foreman',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    const sendSpy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValueOnce({
      success: true,
    });

    try {
      const res = await request(app)
        .post('/api/auth/magic-link/request')
        .send({ email: invitedUser.email });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If an account exists');
      expect(sendSpy).not.toHaveBeenCalled();
      await expect(
        prisma.passwordResetToken.count({
          where: {
            userId: invitedUser.id,
            purpose: 'magic_link',
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.auditLog.count({
          where: {
            entityType: 'user',
            entityId: invitedUser.id,
            action: AuditAction.MAGIC_LINK_REQUESTED,
          },
        }),
      ).resolves.toBe(0);
    } finally {
      sendSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({ where: { userId: invitedUser.id } });
      await clearUserAuditLogs(invitedUser.id);
      await prisma.user.delete({ where: { id: invitedUser.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('does not leave an active magic link token when email delivery fails', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user!.id, purpose: 'magic_link' },
    });
    await clearUserAuditLogs(user!.id);

    const sendSpy = vi.spyOn(emailService, 'sendMagicLinkEmail').mockResolvedValueOnce({
      success: false,
      error: 'Magic link email provider unavailable',
      statusCode: 503,
      provider: 'resend',
    });

    try {
      const res = await request(app)
        .post('/api/auth/magic-link/request')
        .send({ email: magicEmail });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('If an account exists');
      expect(sendSpy).toHaveBeenCalledTimes(1);
      await expect(
        prisma.passwordResetToken.count({
          where: {
            userId: user!.id,
            purpose: 'magic_link',
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ).resolves.toBe(0);
      await expect(
        prisma.auditLog.count({
          where: {
            entityType: 'user',
            entityId: user!.id,
            action: AuditAction.MAGIC_LINK_REQUESTED,
          },
        }),
      ).resolves.toBe(0);
    } finally {
      sendSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({
        where: { userId: user!.id, purpose: 'magic_link' },
      });
      await clearUserAuditLogs(user!.id);
    }
  });

  it('should reject invalid magic link token', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/verify')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(400);
  });

  it('should audit successful magic link login without logging the token', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();

    const token = `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: hashAuthTokenForTest(token),
        purpose: 'magic_link',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      await clearUserAuditLogs(user!.id);

      const res = await request(app).post('/api/auth/magic-link/verify').send({ token });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      const { auditLog, changes } = await expectLatestUserAuditLog(
        user!.id,
        AuditAction.USER_LOGIN,
      );
      expect(auditLog.userId).toBe(user!.id);
      expect(changes).toEqual({ method: 'magic_link' });
      expect(JSON.stringify(changes)).not.toMatch(/password|token|secret|code/i);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { token: hashAuthTokenForTest(token) } });
    }
  });

  it('rejects magic link verification for pending company invite users', async () => {
    const company = await prisma.company.create({
      data: { name: `Pending Magic Verify Company ${Date.now()}` },
    });
    const invitedUser = await prisma.user.create({
      data: {
        email: `pending-magic-verify-${Date.now()}@example.com`,
        fullName: 'Pending Magic Verify',
        companyId: company.id,
        roleInCompany: 'foreman',
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
    const token = `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: invitedUser.id,
        token: hashAuthTokenForTest(token),
        purpose: 'magic_link',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      const res = await request(app).post('/api/auth/magic-link/verify').send({ token });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('account setup');
      expect(res.body.token).toBeUndefined();

      const tokenAfterVerify = await prisma.passwordResetToken.findFirstOrThrow({
        where: { token: hashAuthTokenForTest(token) },
      });
      expect(tokenAfterVerify.usedAt).toBeInstanceOf(Date);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId: invitedUser.id } });
      await clearUserAuditLogs(invitedUser.id);
      await prisma.user.delete({ where: { id: invitedUser.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('allows only one concurrent magic link token consume', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();

    const token = `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const findFirstSpy = blockFirstTwoFindFirstCalls(prisma.passwordResetToken);

    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: hashAuthTokenForTest(token),
        purpose: 'magic_link',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      await clearUserAuditLogs(user!.id);

      const responses = await Promise.all([
        request(app).post('/api/auth/magic-link/verify').send({ token }),
        request(app).post('/api/auth/magic-link/verify').send({ token }),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([200, 400]);
      expect(responses.filter((res) => res.body.token)).toHaveLength(1);

      const tokenRecord = await prisma.passwordResetToken.findFirstOrThrow({
        where: { token: hashAuthTokenForTest(token) },
      });
      expect(tokenRecord.usedAt).toBeInstanceOf(Date);

      const auditLogs = await prisma.auditLog.findMany({
        where: {
          entityType: 'user',
          entityId: user!.id,
          action: AuditAction.USER_LOGIN,
        },
      });
      expect(auditLogs).toHaveLength(1);
    } finally {
      findFirstSpy.mockRestore();
      await prisma.passwordResetToken.deleteMany({ where: { token: hashAuthTokenForTest(token) } });
      await clearUserAuditLogs(user!.id);
    }
  });

  it('should not bypass MFA with a magic link', async () => {
    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    expect(user).toBeDefined();

    const token = `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await prisma.user.update({
      where: { id: user!.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: encrypt('TESTSECRET1234567890'),
      },
    });
    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: hashAuthTokenForTest(token),
        purpose: 'magic_link',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    try {
      const res = await request(app).post('/api/auth/magic-link/verify').send({ token });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('MFA-enabled accounts');
      expect(res.body.token).toBeUndefined();
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { token: hashAuthTokenForTest(token) } });
      await prisma.user.update({
        where: { id: user!.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    }
  });
});

describe('Profile Update', () => {
  it('should normalize profile fields and reject invalid profile values', async () => {
    const email = `profile-update-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Original Profile User',
        tosAccepted: true,
      });

      userId = regRes.body.user.id;
      const authHeader = `Bearer ${regRes.body.token}`;

      const res = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({
          fullName: '  Jane Profile  ',
          phone: '  +61 2 1234 5678  ',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.fullName).toBe('Jane Profile');
      expect(res.body.user.phone).toBe('+61 2 1234 5678');

      const badPhoneRes = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({ phone: '555-CALL-NOW' });

      expect(badPhoneRes.status).toBe(400);
      expect(badPhoneRes.body.error.message).toContain('Phone');

      const oversizedNameRes = await request(app)
        .patch('/api/auth/profile')
        .set('Authorization', authHeader)
        .send({ fullName: 'A'.repeat(121) });

      expect(oversizedNameRes.status).toBe(400);
      expect(oversizedNameRes.body.error.message).toContain('120');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.fullName).toBe('Jane Profile');
      expect(user?.phone).toBe('+61 2 1234 5678');

      const { auditLog, changes } = await expectLatestUserAuditLog(
        userId!,
        AuditAction.USER_PROFILE_UPDATED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({ changedFields: ['fullName', 'phone'] });
      expect(JSON.stringify(changes)).not.toContain('Jane Profile');
      expect(JSON.stringify(changes)).not.toContain('+61 2 1234 5678');
      expect(JSON.stringify(changes)).not.toContain(email);
    } finally {
      if (userId) {
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });
});

describe('Avatar Upload', () => {
  it('should reject unauthenticated uploads before storing files', async () => {
    const beforeFiles = listAvatarFiles('avatar-unknown-');

    const res = await request(app)
      .post('/api/auth/avatar')
      .attach('avatar', Buffer.from('fake-image'), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });

    const afterFiles = listAvatarFiles('avatar-unknown-');
    const newFiles = [...afterFiles].filter((name) => !beforeFiles.has(name));

    for (const file of newFiles) {
      fs.rmSync(path.join(avatarUploadDir, file), { force: true });
    }

    expect(res.status).toBe(401);
    expect(newFiles).toEqual([]);
  });

  it('should reject image uploads whose bytes do not match the declared type', async () => {
    const email = `avatar-invalid-content-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Avatar Invalid Content User',
        tosAccepted: true,
      });

      userId = regRes.body.user.id;
      const beforeFiles = listAvatarFiles(`avatar-${userId}-`);

      const res = await request(app)
        .post('/api/auth/avatar')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .attach('avatar', Buffer.from('not really a png'), {
          filename: 'avatar.png',
          contentType: 'image/png',
        });

      const afterFiles = listAvatarFiles(`avatar-${userId}-`);
      const newFiles = [...afterFiles].filter((name) => !beforeFiles.has(name));

      for (const file of newFiles) {
        fs.rmSync(path.join(avatarUploadDir, file), { force: true });
      }

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
      expect(newFiles).toEqual([]);
    } finally {
      if (userId) {
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('should store authenticated uploads under the requesting user id', async () => {
    const email = `avatar-upload-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    let userId: string | undefined;
    let uploadedFilename: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Avatar Upload User',
        tosAccepted: true,
      });

      userId = regRes.body.user.id;

      const res = await request(app)
        .post('/api/auth/avatar')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .attach('avatar', tinyPngBytes, {
          filename: 'avatar.svg',
          contentType: 'image/png',
        });

      uploadedFilename = res.body.avatarUrl?.split('/').pop();

      expect(res.status).toBe(200);
      expect(uploadedFilename).toMatch(new RegExp(`^avatar-${userId}-[0-9a-f-]{36}\\.png$`));
      expect(uploadedFilename).not.toContain('.svg');
      expect(fs.existsSync(path.join(avatarUploadDir, uploadedFilename!))).toBe(true);

      const { auditLog, changes } = await expectLatestUserAuditLog(
        userId!,
        AuditAction.USER_AVATAR_UPDATED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({ changedFields: ['avatarUrl'] });
      expect(JSON.stringify(changes)).not.toContain(uploadedFilename!);
      expect(JSON.stringify(changes)).not.toContain(res.body.avatarUrl);
      expect(JSON.stringify(changes)).not.toContain(email);
    } finally {
      if (uploadedFilename) {
        fs.rmSync(path.join(avatarUploadDir, uploadedFilename), { force: true });
      }
      if (userId) {
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  it('should not delete local avatar files referenced by untrusted external URLs', async () => {
    const email = `avatar-external-cleanup-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const sentinelFilename = `avatar-external-sentinel-${Date.now()}.png`;
    const sentinelPath = path.join(avatarUploadDir, sentinelFilename);
    let userId: string | undefined;

    try {
      fs.mkdirSync(avatarUploadDir, { recursive: true });
      fs.writeFileSync(sentinelPath, tinyPngBytes);

      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Avatar External Cleanup User',
        tosAccepted: true,
      });

      userId = regRes.body.user.id;
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: `https://example.com/uploads/avatars/${sentinelFilename}` },
      });

      const res = await request(app)
        .delete('/api/auth/avatar')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(200);
      expect(fs.existsSync(sentinelPath)).toBe(true);

      const { auditLog, changes } = await expectLatestUserAuditLog(
        userId!,
        AuditAction.USER_AVATAR_REMOVED,
      );
      expect(auditLog.userId).toBe(userId);
      expect(changes).toEqual({ changedFields: ['avatarUrl'] });
      expect(JSON.stringify(changes)).not.toContain(sentinelFilename);
      expect(JSON.stringify(changes)).not.toContain('example.com');
      expect(JSON.stringify(changes)).not.toContain(email);
    } finally {
      fs.rmSync(sentinelPath, { force: true });
      if (userId) {
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });

  // Supabase storage path coverage. Because `isSupabaseConfigured()` is
  // evaluated at module load to decide multer storage mode, the route file
  // always uses disk storage in tests. These tests therefore exercise the
  // *cleanup* path (DELETE handler and the replacement branch in POST) which
  // works regardless of multer mode — that is the same approach PR #5 used
  // for test certificates.
  describe('Supabase-backed avatar cleanup', () => {
    const previousSupabaseUrl = process.env.SUPABASE_URL;

    afterEach(() => {
      if (previousSupabaseUrl === undefined) {
        delete process.env.SUPABASE_URL;
      } else {
        process.env.SUPABASE_URL = previousSupabaseUrl;
      }
      mockIsSupabaseConfigured.mockReset();
      mockIsSupabaseConfigured.mockReturnValue(false);
      mockGetSupabaseClient.mockReset();
    });

    it('removes the Supabase object on DELETE when the avatarUrl points at the documents bucket', async () => {
      const email = `avatar-supabase-delete-${Date.now()}@example.com`;
      const password = 'SecureP@ssword123!';
      let userId: string | undefined;

      // Pretend Supabase is configured for this test only.
      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password,
          fullName: 'Avatar Supabase Delete User',
          tosAccepted: true,
        });
        userId = regRes.body.user.id;
        const supabaseAvatarUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/avatars/${userId}/avatar-${userId}-deadbeef.png`;

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: supabaseAvatarUrl },
        });

        const res = await request(app)
          .delete('/api/auth/avatar')
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(res.status).toBe(200);

        // Wait one tick for the awaited cleanup helper.
        await new Promise((resolve) => setImmediate(resolve));

        expect(mockRemove).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledWith([
          `avatars/${userId}/avatar-${userId}-deadbeef.png`,
        ]);

        const updated = await prisma.user.findUnique({
          where: { id: userId },
          select: { avatarUrl: true },
        });
        expect(updated?.avatarUrl).toBeNull();
      } finally {
        if (userId) {
          await prisma.auditLog.deleteMany({ where: { userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });

    it('returns and serves signed backend URLs for Supabase-backed avatars', async () => {
      const email = `avatar-supabase-signed-${Date.now()}@example.com`;
      const password = 'SecureP@ssword123!';
      let userId: string | undefined;

      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      const mockDownload = vi.fn().mockResolvedValue({
        data: new Blob([tinyPngBytes], { type: 'image/png' }),
        error: null,
      });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ download: mockDownload }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password,
          fullName: 'Avatar Supabase Signed User',
          tosAccepted: true,
        });
        userId = regRes.body.user.id;
        const storedAvatarRef = `supabase://documents/avatars/${userId}/avatar-${userId}-signed.png`;

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: storedAvatarRef },
        });

        const meRes = await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.user.avatarUrl).toContain(`/api/auth/avatar/file/${userId}?token=`);
        expect(meRes.body.user.avatarUrl).not.toContain('supabase://');
        expect(meRes.body.user.avatarUrl).not.toContain('/storage/v1/object/public/');

        const signedAvatarUrl = new URL(meRes.body.user.avatarUrl);
        const avatarRes = await request(app).get(
          `${signedAvatarUrl.pathname}${signedAvatarUrl.search}`,
        );

        expect(avatarRes.status).toBe(200);
        expect(avatarRes.headers['content-type']).toContain('image/png');
        expect(mockDownload).toHaveBeenCalledWith(`avatars/${userId}/avatar-${userId}-signed.png`);

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: `supabase://documents/avatars/${userId}/avatar-${userId}-new.png` },
        });

        const staleAvatarRes = await request(app).get(
          `${signedAvatarUrl.pathname}${signedAvatarUrl.search}`,
        );
        expect(staleAvatarRes.status).toBe(401);
      } finally {
        if (userId) {
          await prisma.auditLog.deleteMany({ where: { userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });

    it('removes the Supabase object on DELETE when the avatarUrl is a stored object reference', async () => {
      const email = `avatar-supabase-ref-delete-${Date.now()}@example.com`;
      const password = 'SecureP@ssword123!';
      let userId: string | undefined;

      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password,
          fullName: 'Avatar Supabase Ref Delete User',
          tosAccepted: true,
        });
        userId = regRes.body.user.id;
        await prisma.user.update({
          where: { id: userId },
          data: {
            avatarUrl: `supabase://documents/avatars/${userId}/avatar-${userId}-deadbeef.png`,
          },
        });

        const res = await request(app)
          .delete('/api/auth/avatar')
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(res.status).toBe(200);
        expect(mockRemove).toHaveBeenCalledWith([
          `avatars/${userId}/avatar-${userId}-deadbeef.png`,
        ]);
      } finally {
        if (userId) {
          await prisma.auditLog.deleteMany({ where: { userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });

    it('does not remove a Supabase avatar outside the current user prefix', async () => {
      const email = `avatar-supabase-other-user-${Date.now()}@example.com`;
      const password = 'SecureP@ssword123!';
      let userId: string | undefined;

      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password,
          fullName: 'Avatar Supabase Other User',
          tosAccepted: true,
        });
        userId = regRes.body.user.id;
        const otherUserAvatarUrl =
          'https://fixture-project.supabase.co/storage/v1/object/public/documents/avatars/other-user/avatar-other-user.png';

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: otherUserAvatarUrl },
        });

        const res = await request(app)
          .delete('/api/auth/avatar')
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(res.status).toBe(200);
        expect(mockRemove).not.toHaveBeenCalled();

        const updated = await prisma.user.findUnique({
          where: { id: userId },
          select: { avatarUrl: true },
        });
        expect(updated?.avatarUrl).toBeNull();
      } finally {
        if (userId) {
          await prisma.auditLog.deleteMany({ where: { userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });

    it('does not call Supabase remove when the existing avatarUrl is a local /uploads path', async () => {
      const email = `avatar-local-delete-${Date.now()}@example.com`;
      const password = 'SecureP@ssword123!';
      let userId: string | undefined;

      // Even with Supabase "configured", a local avatarUrl must not hit the bucket.
      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password,
          fullName: 'Avatar Local Delete User',
          tosAccepted: true,
        });
        userId = regRes.body.user.id;

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: '/uploads/avatars/avatar-noop.png' },
        });

        const res = await request(app)
          .delete('/api/auth/avatar')
          .set('Authorization', `Bearer ${regRes.body.token}`);

        expect(res.status).toBe(200);
        expect(mockRemove).not.toHaveBeenCalled();
      } finally {
        if (userId) {
          await prisma.auditLog.deleteMany({ where: { userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });

    it('removes the previous Supabase object when a new avatar replaces it', async () => {
      const email = `avatar-supabase-replace-${Date.now()}@example.com`;
      const password = 'SecureP@ssword123!';
      let userId: string | undefined;
      let uploadedFilename: string | undefined;

      process.env.SUPABASE_URL = 'https://fixture-project.supabase.co';
      const mockRemove = vi.fn().mockResolvedValue({ data: null, error: null });
      mockIsSupabaseConfigured.mockReturnValue(true);
      mockGetSupabaseClient.mockReturnValue({
        storage: { from: () => ({ remove: mockRemove }) },
      } as unknown as ReturnType<typeof supabaseLib.getSupabaseClient>);

      try {
        const regRes = await request(app).post('/api/auth/register').send({
          email,
          password,
          fullName: 'Avatar Supabase Replace User',
          tosAccepted: true,
        });
        userId = regRes.body.user.id;
        const oldSupabaseUrl = `https://fixture-project.supabase.co/storage/v1/object/public/documents/avatars/${userId}/avatar-${userId}-oldfile.png`;

        await prisma.user.update({
          where: { id: userId },
          data: { avatarUrl: oldSupabaseUrl },
        });

        const res = await request(app)
          .post('/api/auth/avatar')
          .set('Authorization', `Bearer ${regRes.body.token}`)
          .attach('avatar', tinyPngBytes, {
            filename: 'replacement.png',
            contentType: 'image/png',
          });

        uploadedFilename = res.body.avatarUrl?.split('/').pop();

        expect(res.status).toBe(200);

        // Wait one tick for the awaited cleanup helper.
        await new Promise((resolve) => setImmediate(resolve));

        expect(mockRemove).toHaveBeenCalledTimes(1);
        expect(mockRemove).toHaveBeenCalledWith([`avatars/${userId}/avatar-${userId}-oldfile.png`]);
      } finally {
        if (uploadedFilename) {
          fs.rmSync(path.join(avatarUploadDir, uploadedFilename), { force: true });
        }
        if (userId) {
          await prisma.auditLog.deleteMany({ where: { userId } });
          await prisma.emailVerificationToken.deleteMany({ where: { userId } });
          await prisma.user.delete({ where: { id: userId } }).catch(() => {});
        }
      }
    });
  });
});

describe('GET /api/auth/export-data', () => {
  it('rejects missing bearer authentication', async () => {
    const res = await request(app).get('/api/auth/export-data');

    expect(res.status).toBe(401);
  });

  it('rejects invalid bearer authentication', async () => {
    const res = await request(app)
      .get('/api/auth/export-data')
      .set('Authorization', 'Bearer not-a-valid-token');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('Invalid token');
  });

  it('exports privacy-relevant account records without stored secrets', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `export-data-${suffix}@example.com`;
    const password = 'SecureP@ssword123!';
    let userId: string | undefined;
    let companyId: string | undefined;
    let projectId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Export Data User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      const createdUserId = regRes.body.user.id as string;
      userId = createdUserId;

      const company = await prisma.company.create({
        data: {
          name: `Export Data Company ${suffix}`,
          subscriptionTier: 'professional',
        },
      });
      companyId = company.id;

      await prisma.user.update({
        where: { id: createdUserId },
        data: {
          companyId,
          roleInCompany: 'admin',
          avatarUrl: `https://fixture-project.supabase.co/storage/v1/object/public/documents/avatars/${createdUserId}/export-avatar.png?token=secret-avatar-token`,
          emailVerified: true,
          emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });

      const project = await prisma.project.create({
        data: {
          companyId,
          name: `Export Data Project ${suffix}`,
          projectNumber: `EXPORT-${suffix}`,
          status: 'active',
          state: 'NSW',
          specificationSet: 'TfNSW',
        },
      });
      projectId = project.id;

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: createdUserId,
          role: 'admin',
          status: 'active',
          acceptedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
      });

      const comment = await prisma.comment.create({
        data: {
          entityType: 'Project',
          entityId: projectId,
          content: 'Exported comment body',
          authorId: createdUserId,
          attachments: {
            create: {
              filename: 'export-comment-photo.jpg',
              fileUrl: `https://fixture-project.supabase.co/storage/v1/object/public/documents/comments/${projectId}/export-comment-photo.jpg?token=secret-comment-token`,
              fileSize: 1234,
              mimeType: 'image/jpeg',
            },
          },
        },
        include: { attachments: true },
      });

      const document = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          category: 'quality',
          filename: 'export-document.jpg',
          fileUrl: `https://fixture-project.supabase.co/storage/v1/object/public/documents/${projectId}/export-document.jpg?X-Amz-Signature=secret-document-signature`,
          fileSize: 4567,
          mimeType: 'image/jpeg',
          uploadedById: createdUserId,
          caption: 'Exported document caption',
          tags: JSON.stringify(['export', 'privacy']),
        },
      });

      await prisma.notification.create({
        data: {
          userId: createdUserId,
          projectId,
          type: 'mention',
          title: 'Export notification',
          message: 'Export notification message',
          linkUrl: '/projects/export',
          isRead: false,
        },
      });

      await prisma.notificationEmailPreference.create({
        data: {
          userId: createdUserId,
          enabled: true,
          mentions: false,
          dailyDigest: true,
        },
      });

      await prisma.notificationDigestItem.create({
        data: {
          userId: createdUserId,
          type: 'mention',
          title: 'Digest export title',
          message: 'Digest export message',
          projectName: project.name,
          linkUrl: '/digest/export',
        },
      });

      await prisma.notificationAlert.create({
        data: {
          id: crypto.randomUUID(),
          assignedToId: createdUserId,
          projectId,
          type: 'hold_point_overdue',
          severity: 'high',
          title: 'Export alert',
          message: 'Export alert message',
          entityId: projectId,
          entityType: 'Project',
        },
      });

      await prisma.consentRecord.create({
        data: {
          userId: createdUserId,
          consentType: 'marketing',
          version: '2026-01',
          granted: true,
          ipAddress: '203.0.113.10',
          userAgent: 'Export Test Browser',
        },
      });

      await prisma.apiKey.create({
        data: {
          userId: createdUserId,
          name: 'Export integration key',
          keyHash: 'secret-api-key-hash-should-not-export',
          keyPrefix: 'sp_live_',
          scopes: 'read,write',
          isActive: true,
        },
      });

      await prisma.pushSubscription.create({
        data: {
          id: `push-export-${suffix}`,
          userId: createdUserId,
          endpoint: `https://push.example.com/export/${suffix}/secret-push-endpoint-token`,
          p256dh: 'secret-p256dh-should-not-export',
          auth: 'secret-push-auth-should-not-export',
          userAgent: 'Export Push Browser',
        },
      });

      await prisma.scheduledReport.create({
        data: {
          projectId,
          createdById: createdUserId,
          reportType: 'lot-status',
          frequency: 'weekly',
          dayOfWeek: 1,
          timeOfDay: '09:00',
          recipients: 'export@example.com, third-party@example.com',
          isActive: true,
          nextRunAt: new Date('2026-01-05T09:00:00.000Z'),
        },
      });

      await prisma.webhookConfig.create({
        data: {
          companyId,
          createdById: createdUserId,
          url: 'https://example.com/export-webhook?token=secret-webhook-query&tenant=secret-tenant',
          secret: 'secret-webhook-value-should-not-export',
          events: JSON.stringify(['lot.updated']),
          enabled: true,
        },
      });

      await prisma.documentSignedUrlToken.create({
        data: {
          userId: createdUserId,
          documentId: document.id,
          tokenHash: 'secret-signed-url-token-hash-should-not-export',
          // Keep this fixture unexpired so parallel document tests cannot purge it.
          expiresAt: new Date('2099-01-06T00:00:00.000Z'),
        },
      });

      await prisma.syncQueue.create({
        data: {
          userId: createdUserId,
          deviceId: 'export-device',
          entityType: 'Lot',
          entityId: 'export-lot-id',
          action: 'update',
          payload: JSON.stringify({
            notes: 'offline export payload',
            fileUrl: 'https://files.example.com/documents/sync.pdf?token=secret-sync-token',
            nested: { auth: 'secret-sync-auth' },
          }),
          status: 'pending',
        },
      });
      const oversizedSyncSecret = 'oversized-secret-sync-token-should-not-export';
      const oversizedSyncBody = 'X'.repeat(25_000);
      const oversizedSyncPayload = JSON.stringify({
        notes: oversizedSyncSecret,
        body: oversizedSyncBody,
      });
      await prisma.syncQueue.create({
        data: {
          userId: createdUserId,
          deviceId: 'export-device-large',
          entityType: 'Lot',
          entityId: 'export-lot-large-payload',
          action: 'update',
          payload: oversizedSyncPayload,
          status: 'pending',
        },
      });

      const res = await request(app)
        .get('/api/auth/export-data')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('private, no-store, max-age=0');
      expect(res.headers.pragma).toBe('no-cache');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.body.user).toMatchObject({
        id: createdUserId,
        email,
        hasAvatar: true,
        twoFactorEnabled: false,
      });
      expect(res.body.exportVersion).toBe('1.2');
      expect(res.body.exportLimits).toMatchObject({
        operationalRecordLimit: 1000,
        syncPayloadMaxChars: 20000,
        truncatedCollections: {
          activityLog: false,
          notifications: false,
          notificationDigestItems: false,
          notificationAlerts: false,
          documentSignedUrlTokens: false,
          syncQueueItems: false,
        },
      });
      expect(res.body.user).not.toHaveProperty('avatarUrl');
      expect(res.body.projectMemberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'admin',
            status: 'active',
            project: expect.objectContaining({ id: projectId }),
          }),
        ]),
      );
      expect(res.body.commentsAuthored).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: comment.id,
            content: 'Exported comment body',
            attachments: [
              expect.objectContaining({
                filename: 'export-comment-photo.jpg',
                downloadUrl: `/api/comments/attachments/${comment.attachments[0]!.id}/download`,
              }),
            ],
          }),
        ]),
      );
      expect(res.body.uploadedDocuments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: document.id,
            filename: 'export-document.jpg',
            downloadUrl: `/api/documents/file/${document.id}`,
            caption: 'Exported document caption',
          }),
        ]),
      );
      expect(res.body.notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'mention',
            title: 'Export notification',
          }),
        ]),
      );
      expect(res.body.notificationEmailPreference).toMatchObject({
        enabled: true,
        mentions: false,
        dailyDigest: true,
      });
      expect(res.body.notificationDigestItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Digest export title',
            message: 'Digest export message',
          }),
        ]),
      );
      expect(res.body.notificationAlerts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'hold_point_overdue',
            severity: 'high',
            title: 'Export alert',
          }),
        ]),
      );
      expect(res.body.consentRecords).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            consentType: 'marketing',
            version: '2026-01',
            granted: true,
          }),
        ]),
      );
      expect(res.body.apiKeys).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Export integration key',
            keyPrefix: 'sp_live_',
            scopes: 'read,write',
            isActive: true,
          }),
        ]),
      );
      expect(res.body.pushSubscriptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `push-export-${suffix}`,
            endpointOrigin: 'https://push.example.com',
            userAgent: 'Export Push Browser',
          }),
        ]),
      );
      expect(res.body.scheduledReports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reportType: 'lot-status',
            frequency: 'weekly',
            recipientCount: 2,
          }),
        ]),
      );
      expect(res.body.webhookConfigsCreated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://example.com/export-webhook?token=[REDACTED]&tenant=[REDACTED]',
            events: JSON.stringify(['lot.updated']),
            enabled: true,
          }),
        ]),
      );
      expect(res.body.documentSignedUrlTokens).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentId: document.id,
          }),
        ]),
      );
      expect(res.body.syncQueueItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'export-device',
            payload: {
              notes: 'offline export payload',
              fileUrl: 'https://files.example.com/documents/sync.pdf?token=[REDACTED]',
              nested: { auth: '[REDACTED]' },
            },
            status: 'pending',
          }),
        ]),
      );
      expect(res.body.syncQueueItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            deviceId: 'export-device-large',
            payload: {
              truncated: true,
              originalLength: oversizedSyncPayload.length,
              maxExportedChars: 20000,
            },
            status: 'pending',
          }),
        ]),
      );

      const exportedJson = JSON.stringify(res.body);
      expect(exportedJson).not.toContain('secret-avatar-token');
      expect(exportedJson).not.toContain('secret-comment-token');
      expect(exportedJson).not.toContain('secret-document-signature');
      expect(exportedJson).not.toContain('secret-push-endpoint-token');
      expect(exportedJson).not.toContain('third-party@example.com');
      expect(exportedJson).not.toContain('secret-webhook-query');
      expect(exportedJson).not.toContain('secret-tenant');
      expect(exportedJson).not.toContain('secret-sync-token');
      expect(exportedJson).not.toContain('secret-sync-auth');
      expect(exportedJson).not.toContain(oversizedSyncSecret);
      expect(exportedJson).not.toContain(oversizedSyncBody);
      expect(exportedJson).not.toContain('secret-api-key-hash-should-not-export');
      expect(exportedJson).not.toContain('secret-p256dh-should-not-export');
      expect(exportedJson).not.toContain('secret-push-auth-should-not-export');
      expect(exportedJson).not.toContain('secret-webhook-value-should-not-export');
      expect(exportedJson).not.toContain('secret-signed-url-token-hash-should-not-export');
      expect(exportedJson).not.toContain(password);
      expect(res.body.apiKeys[0]).not.toHaveProperty('keyHash');
      expect(res.body.pushSubscriptions[0]).not.toHaveProperty('p256dh');
      expect(res.body.pushSubscriptions[0]).not.toHaveProperty('auth');
      expect(res.body.pushSubscriptions[0]).not.toHaveProperty('endpoint');
      expect(res.body.scheduledReports[0]).not.toHaveProperty('recipients');
      expect(res.body.webhookConfigsCreated[0]).not.toHaveProperty('secret');
      expect(res.body.documentSignedUrlTokens[0]).not.toHaveProperty('tokenHash');
      expect(res.body.commentsAuthored[0].attachments[0]).not.toHaveProperty('fileUrl');
      expect(res.body.uploadedDocuments[0]).not.toHaveProperty('fileUrl');
    } finally {
      if (userId) {
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.syncQueue.deleteMany({ where: { userId } });
        await prisma.documentSignedUrlToken.deleteMany({ where: { userId } });
        await prisma.notificationAlert.deleteMany({ where: { assignedToId: userId } });
        await prisma.notificationDigestItem.deleteMany({ where: { userId } });
        await prisma.notificationEmailPreference.deleteMany({ where: { userId } });
        await prisma.pushSubscription.deleteMany({ where: { userId } });
        await prisma.apiKey.deleteMany({ where: { userId } });
        await prisma.consentRecord.deleteMany({ where: { userId } });
        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.scheduledReport.deleteMany({ where: { createdById: userId } });
        await prisma.webhookConfig.deleteMany({ where: { createdById: userId } });
        await prisma.comment.deleteMany({ where: { authorId: userId } });
        await prisma.document.deleteMany({ where: { uploadedById: userId } });
        await prisma.projectUser.deleteMany({ where: { userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
      if (projectId) {
        await prisma.notificationAlert.deleteMany({ where: { projectId } });
        await prisma.notification.deleteMany({ where: { projectId } });
        await prisma.scheduledReport.deleteMany({ where: { projectId } });
        await prisma.document.deleteMany({ where: { projectId } });
        await prisma.projectUser.deleteMany({ where: { projectId } });
        await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
      }
      if (companyId) {
        await prisma.webhookConfig.deleteMany({ where: { companyId } });
        await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
      }
    }
  });

  it('caps operational export collections and reports truncation metadata', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `export-data-scale-${suffix}@example.com`;
    const password = 'SecureP@ssword123!';
    let userId: string | undefined;

    try {
      const regRes = await request(app).post('/api/auth/register').send({
        email,
        password,
        fullName: 'Export Data Scale User',
        tosAccepted: true,
      });

      expect(regRes.status).toBe(201);
      userId = regRes.body.user.id as string;

      await prisma.notification.createMany({
        data: Array.from({ length: 1001 }, (_, index) => ({
          userId: userId!,
          type: 'mention',
          title: `Bulk export notification ${index}`,
          message: `Bulk export notification message ${index}`,
          isRead: false,
        })),
      });

      const res = await request(app)
        .get('/api/auth/export-data')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.notifications).toHaveLength(1000);
      expect(res.body.exportLimits).toMatchObject({
        operationalRecordLimit: 1000,
        truncatedCollections: expect.objectContaining({
          notifications: true,
        }),
      });
    } finally {
      if (userId) {
        await prisma.notification.deleteMany({ where: { userId } });
        await prisma.auditLog.deleteMany({ where: { userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });
});

describe('Account Deletion', () => {
  it('should require password for password-based accounts', async () => {
    const email = `delete-missing-password-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Delete Missing Password User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;
    expect(regRes.body.user.hasPassword).toBe(true);

    try {
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.hasPassword).toBe(true);

      const res = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({ confirmEmail: email });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Password is required');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user).toBeDefined();
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('should reject malformed email confirmation values', async () => {
    const email = `delete-malformed-confirm-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Delete Malformed Confirm User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;

    try {
      const res = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({
          confirmEmail: { email },
          password,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Email confirmation');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user).toBeDefined();
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('should require company owners to transfer ownership before deleting their account', async () => {
    const email = `delete-owner-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const company = await prisma.company.create({
      data: { name: `Delete Owner Company ${Date.now()}` },
    });
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Delete Owner User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { companyId: company.id, roleInCompany: 'owner' },
    });

    try {
      const res = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({
          confirmEmail: email,
          password,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('transfer ownership');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user).toBeDefined();
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('should reject deleting the sole active project admin account', async () => {
    const email = `delete-project-admin-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const company = await prisma.company.create({
      data: { name: `Delete Project Admin Company ${Date.now()}` },
    });
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Delete Project Admin User',
      tosAccepted: true,
    });
    const userId = regRes.body.user.id;
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `Delete Project Admin Project ${Date.now()}`,
        projectNumber: `DPA-${Date.now()}`,
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { companyId: company.id, roleInCompany: 'admin' },
    });
    await prisma.projectUser.create({
      data: {
        userId,
        projectId: project.id,
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      },
    });

    try {
      const res = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({
          confirmEmail: email,
          password,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('only active project admin or project manager');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user).toBeDefined();
      expect(await prisma.projectUser.count({ where: { userId, projectId: project.id } })).toBe(1);
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.projectUser.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
    }
  });

  it('should delete password-based accounts when password and email confirmation match', async () => {
    const email = `delete-confirmed-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Delete Confirmed User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;

    const res = await request(app)
      .delete('/api/auth/delete-account')
      .set('Authorization', `Bearer ${regRes.body.token}`)
      .send({
        confirmEmail: email,
        password,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user).toBeNull();

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityType: 'user',
        entityId: userId,
        action: AuditAction.ACCOUNT_DELETION_REQUESTED,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditLog).not.toBeNull();
    if (!auditLog) {
      throw new Error('Expected account deletion audit log');
    }
    expect(auditLog.userId).toBeNull();
    const changes = parseAuditLogChanges(auditLog.changes) as Record<string, unknown>;
    expect(changes.reason).toBe('GDPR deletion request');
    expect(typeof changes.deletedAt).toBe('string');
    expect(JSON.stringify(changes)).not.toContain(email);
    expect(JSON.stringify(changes)).not.toContain('Delete Confirmed User');

    await prisma.auditLog.deleteMany({
      where: {
        entityId: userId,
        action: AuditAction.ACCOUNT_DELETION_REQUESTED,
      },
    });
  });

  it('should preserve ITP completion evidence while anonymising deleted user references', async () => {
    const timestamp = Date.now();
    const email = `delete-itp-evidence-${timestamp}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Delete ITP Evidence User',
      tosAccepted: true,
    });

    const userId = regRes.body.user.id;
    const company = await prisma.company.create({
      data: { name: `Delete ITP Evidence Company ${timestamp}` },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: `Delete ITP Evidence Project ${timestamp}`,
        projectNumber: `DEL-ITP-${timestamp}`,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    const template = await prisma.iTPTemplate.create({
      data: {
        projectId: project.id,
        name: `Delete ITP Evidence Template ${timestamp}`,
        activityType: 'Earthworks',
      },
    });
    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        sequenceNumber: 1,
        description: 'Proof rolling inspection',
        pointType: 'standard',
        evidenceRequired: 'photo',
      },
    });
    const lot = await prisma.lot.create({
      data: {
        projectId: project.id,
        lotNumber: `DEL-ITP-LOT-${timestamp}`,
        lotType: 'chainage',
        activityType: 'Earthworks',
        status: 'in_progress',
        itpTemplateId: template.id,
      },
    });
    const itpInstance = await prisma.iTPInstance.create({
      data: {
        lotId: lot.id,
        templateId: template.id,
        status: 'completed',
      },
    });
    const completedAt = new Date('2026-02-03T04:05:06.000Z');
    const verifiedAt = new Date('2026-02-03T05:06:07.000Z');
    const completion = await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: itpInstance.id,
        checklistItemId: checklistItem.id,
        status: 'passed',
        completedById: userId,
        completedAt,
        notes: 'Compaction passed with photo evidence.',
        witnessPresent: true,
        witnessName: 'Site Witness',
        witnessCompany: 'Client QA',
        verificationStatus: 'verified',
        verifiedById: userId,
        verifiedAt,
        verificationNotes: 'Reviewed before account deletion.',
      },
    });

    try {
      const res = await request(app)
        .delete('/api/auth/delete-account')
        .set('Authorization', `Bearer ${regRes.body.token}`)
        .send({
          confirmEmail: email,
          password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(deletedUser).toBeNull();

      const retainedCompletion = await prisma.iTPCompletion.findUnique({
        where: { id: completion.id },
      });
      expect(retainedCompletion).not.toBeNull();
      if (!retainedCompletion) {
        throw new Error('Expected ITP completion evidence to be retained');
      }
      expect(retainedCompletion.status).toBe('passed');
      expect(retainedCompletion.completedById).toBeNull();
      expect(retainedCompletion.verifiedById).toBeNull();
      expect(retainedCompletion.completedAt?.toISOString()).toBe(completedAt.toISOString());
      expect(retainedCompletion.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
      expect(retainedCompletion.notes).toBe('Compaction passed with photo evidence.');
      expect(retainedCompletion.verificationStatus).toBe('verified');
      expect(retainedCompletion.verificationNotes).toBe('Reviewed before account deletion.');
    } finally {
      await prisma.auditLog.deleteMany({
        where: {
          OR: [
            { userId },
            {
              entityId: userId,
              action: AuditAction.ACCOUNT_DELETION_REQUESTED,
            },
          ],
        },
      });
      await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: itpInstance.id } });
      await prisma.iTPInstance.delete({ where: { id: itpInstance.id } }).catch(() => {});
      await prisma.lot.delete({ where: { id: lot.id } }).catch(() => {});
      await prisma.iTPChecklistItem.delete({ where: { id: checklistItem.id } }).catch(() => {});
      await prisma.iTPTemplate.delete({ where: { id: template.id } }).catch(() => {});
      await prisma.project.delete({ where: { id: project.id } }).catch(() => {});
      await prisma.company.delete({ where: { id: company.id } }).catch(() => {});
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });
});

describe('Onboarding tour completion', () => {
  it('exposes onboardingCompletedAt (null for a new account) on login and /me', async () => {
    const email = `onboarding-fields-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Onboarding Fields User',
      tosAccepted: true,
    });
    const userId = regRes.body.user.id;

    try {
      // A brand-new account has not completed the tour yet.
      const loginRes = await request(app).post('/api/auth/login').send({ email, password });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.onboardingCompletedAt ?? null).toBeNull();

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${loginRes.body.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.onboardingCompletedAt ?? null).toBeNull();
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('records the completion timestamp once and does not move it on replay', async () => {
    const email = `onboarding-complete-${Date.now()}@example.com`;
    const password = 'SecureP@ssword123!';
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password,
      fullName: 'Onboarding Complete User',
      tosAccepted: true,
    });
    const userId = regRes.body.user.id;
    const token = regRes.body.token;

    try {
      const firstComplete = await request(app)
        .post('/api/auth/onboarding/complete')
        .set('Authorization', `Bearer ${token}`);
      expect(firstComplete.status).toBe(200);
      expect(typeof firstComplete.body.onboardingCompletedAt).toBe('string');
      const firstTimestamp = firstComplete.body.onboardingCompletedAt;

      // It is now persisted and surfaced through /me.
      const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.onboardingCompletedAt ?? null).not.toBeNull();

      const storedUser = await prisma.user.findUnique({ where: { id: userId } });
      expect(storedUser?.onboardingCompletedAt ?? null).not.toBeNull();

      // Replaying the tour must not move the original completion timestamp.
      const secondComplete = await request(app)
        .post('/api/auth/onboarding/complete')
        .set('Authorization', `Bearer ${token}`);
      expect(secondComplete.status).toBe(200);
      expect(new Date(secondComplete.body.onboardingCompletedAt).getTime()).toBe(
        new Date(firstTimestamp).getTime(),
      );
    } finally {
      await prisma.auditLog.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it('rejects an unauthenticated completion request', async () => {
    const res = await request(app).post('/api/auth/onboarding/complete');
    expect(res.status).toBe(401);
  });
});

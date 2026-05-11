import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
import { verifyToken } from '../lib/auth.js';
import { deleteMfaBackupCodes, enableMfaAndReplaceBackupCodes } from '../lib/mfaBackupCodes.js';
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
        await prisma.user.delete({ where: { id: user.id } });
      }
    }
  });
});

describe('JWT invalidation precision', () => {
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

  it('invalidates logout-all-devices immediately after login', async () => {
    const email = `logout-all-immediate-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email,
      password: 'SecureP@ssword123!',
      fullName: 'Immediate Logout User',
      tosAccepted: true,
    });

    const token = regRes.body.token as string;
    const userId = regRes.body.user.id as string;

    try {
      const logoutRes = await request(app)
        .post('/api/auth/logout-all-devices')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      const oldSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(oldSessionRes.status).toBe(401);
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });
});

describe('Email verification tokens', () => {
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
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should login with valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: loginEmail,
      password: loginPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.token).toBeDefined();
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

  it('should reject invalid email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@example.com',
      password: loginPassword,
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('Invalid');
  });

  it('should reject wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: loginEmail,
      password: 'WrongPassword123!',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toContain('Invalid');
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
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should send reset email for existing user (always returns success)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: resetEmail });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');

    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    const storedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedToken?.token).toMatch(/^sha256:[a-f0-9]{64}$/);

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

  it('should reject reset with invalid token', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({
      token: 'invalid-token',
      password: 'NewPassword123!',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('Invalid');
  });

  it('should reject magic-link tokens on password reset endpoints', async () => {
    const user = await prisma.user.findUnique({ where: { email: resetEmail } });
    expect(user).toBeDefined();

    const token = `magic_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await prisma.passwordResetToken.create({
      data: {
        userId: user!.id,
        token: hashAuthTokenForTest(token),
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
      expect(validateRes.body.message).toContain('Invalid reset token');
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { token: hashAuthTokenForTest(token) } });
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

    try {
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        password: newPassword,
      });

      expect(resetRes.status).toBe(200);

      const oldSessionRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${oldToken}`);

      expect(oldSessionRes.status).toBe(401);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId } });
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
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

    try {
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
    } finally {
      await prisma.emailVerificationToken.deleteMany({ where: { userId } });
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
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('should request magic link for existing user', async () => {
    const res = await request(app).post('/api/auth/magic-link/request').send({ email: magicEmail });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');

    const user = await prisma.user.findUnique({ where: { email: magicEmail } });
    const storedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user!.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(storedToken?.token).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(storedToken?.token.startsWith('magic_')).toBe(false);
  });

  it('should not reveal non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/request')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('If an account exists');
  });

  it('should reject invalid magic link token', async () => {
    const res = await request(app)
      .post('/api/auth/magic-link/verify')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(400);
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
          avatarUrl: '/uploads/avatars/export-avatar.png',
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
              fileUrl: '/uploads/comments/export-comment-photo.jpg',
              fileSize: 1234,
              mimeType: 'image/jpeg',
            },
          },
        },
      });

      const document = await prisma.document.create({
        data: {
          projectId,
          documentType: 'photo',
          category: 'quality',
          filename: 'export-document.jpg',
          fileUrl: '/uploads/documents/export-document.jpg',
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
          endpoint: `https://push.example.com/export/${suffix}`,
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
          recipients: 'export@example.com',
          isActive: true,
          nextRunAt: new Date('2026-01-05T09:00:00.000Z'),
        },
      });

      await prisma.webhookConfig.create({
        data: {
          companyId,
          createdById: createdUserId,
          url: 'https://example.com/export-webhook',
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
          expiresAt: new Date('2026-01-06T00:00:00.000Z'),
        },
      });

      await prisma.syncQueue.create({
        data: {
          userId: createdUserId,
          deviceId: 'export-device',
          entityType: 'Lot',
          entityId: 'export-lot-id',
          action: 'update',
          payload: JSON.stringify({ notes: 'offline export payload' }),
          status: 'pending',
        },
      });

      const res = await request(app)
        .get('/api/auth/export-data')
        .set('Authorization', `Bearer ${regRes.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        id: createdUserId,
        email,
        avatarUrl: '/uploads/avatars/export-avatar.png',
        twoFactorEnabled: false,
      });
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
                fileUrl: '/uploads/comments/export-comment-photo.jpg',
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
            fileUrl: '/uploads/documents/export-document.jpg',
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
            endpoint: `https://push.example.com/export/${suffix}`,
            userAgent: 'Export Push Browser',
          }),
        ]),
      );
      expect(res.body.scheduledReports).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            reportType: 'lot-status',
            frequency: 'weekly',
            recipients: 'export@example.com',
          }),
        ]),
      );
      expect(res.body.webhookConfigsCreated).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://example.com/export-webhook',
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
            payload: JSON.stringify({ notes: 'offline export payload' }),
            status: 'pending',
          }),
        ]),
      );

      const exportedJson = JSON.stringify(res.body);
      expect(exportedJson).not.toContain('secret-api-key-hash-should-not-export');
      expect(exportedJson).not.toContain('secret-p256dh-should-not-export');
      expect(exportedJson).not.toContain('secret-push-auth-should-not-export');
      expect(exportedJson).not.toContain('secret-webhook-value-should-not-export');
      expect(exportedJson).not.toContain('secret-signed-url-token-hash-should-not-export');
      expect(exportedJson).not.toContain(password);
      expect(res.body.apiKeys[0]).not.toHaveProperty('keyHash');
      expect(res.body.pushSubscriptions[0]).not.toHaveProperty('p256dh');
      expect(res.body.pushSubscriptions[0]).not.toHaveProperty('auth');
      expect(res.body.webhookConfigsCreated[0]).not.toHaveProperty('secret');
      expect(res.body.documentSignedUrlTokens[0]).not.toHaveProperty('tokenHash');
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

    await prisma.auditLog.deleteMany({
      where: {
        entityId: userId,
        action: 'account_deletion_requested',
      },
    });
  });
});

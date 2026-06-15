import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  generateExpiredToken,
  generateMfaChallengeToken,
  generateToken,
  hashPassword,
  needsPasswordRehash,
  verifyPassword,
  verifyToken,
} from '../lib/auth.js';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { decrypt } from '../lib/encryption.js';
import { verifyAndConsumeMfaBackupCode } from '../lib/mfaBackupCodes.js';
import {
  clearFailedAuthAttempts,
  getClientIp,
  isLockedOut,
  recordFailedAuthAttempt,
} from '../middleware/rateLimiter.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { hasActiveSubcontractorPortalIdentity } from '../lib/projectAccess.js';
import { resolveDashboardRoleForUser } from '../lib/dashboardRole.js';
import { createRegistrationRouter } from './auth/registrationRoutes.js';
import { createSessionPasswordRouter, createSessionRouter } from './auth/sessionRoutes.js';
import { createPasswordResetRouter } from './auth/passwordResetRoutes.js';
import { createProfileRouter } from './auth/profileRoutes.js';
import { createAccountPrivacyRouter } from './auth/accountPrivacyRoutes.js';
import { createEmailVerificationRouter } from './auth/emailVerificationRoutes.js';
import { createMagicLinkRouter } from './auth/magicLinkRoutes.js';
export { getSafeDataExportFilename } from './auth/accountPrivacyRoutes.js';

const GENERIC_RESET_TOKEN_VALIDATION_MESSAGE = 'Invalid or expired reset token';

export const authRouter = Router();

async function auditUserAuthEvent(
  req: Request,
  userId: string,
  action: string,
  changes: Record<string, unknown>,
) {
  await createAuditLog({
    userId,
    entityType: 'user',
    entityId: userId,
    action,
    changes,
    req,
  });
}

async function requireJwtAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized();
    }

    const userData = await verifyToken(authHeader.substring(7));

    if (!userData) {
      throw AppError.unauthorized('Invalid token');
    }

    req.user = {
      id: userData.userId,
      userId: userData.userId,
      email: userData.email,
      fullName: userData.fullName || null,
      roleInCompany: userData.role,
      role: userData.role,
      companyId: userData.companyId || null,
      hasSubcontractorPortalAccess: userData.hasSubcontractorPortalAccess,
      dashboardRole: userData.dashboardRole,
    };

    next();
  } catch (error) {
    next(error instanceof AppError ? error : AppError.unauthorized('Authentication failed.'));
  }
}

// Password validation schema
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_REQUIREMENTS = {
  minLength: PASSWORD_MIN_LENGTH,
  maxBytes: PASSWORD_MAX_BYTES,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ONE_TIME_TOKEN_HASH_PREFIX = 'sha256:';
const ONE_TIME_TOKEN_MAX_LENGTH = 256;
const PROFILE_FULL_NAME_MAX_LENGTH = 120;
const TOTP_CODE_PATTERN = /^\d{6}$/;
const MFA_BACKUP_CODE_PATTERN = /^[A-F0-9]{10}$/i;

function normalizeEmailInput(value: unknown): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest('Email must be a string');
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw AppError.badRequest('Email is required');
  }

  if (normalized.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(normalized)) {
    throw AppError.badRequest('Invalid email address');
  }

  return normalized;
}

function normalizePasswordInput(value: unknown, fieldName = 'Password'): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  return value;
}

function normalizeOneTimeTokenInput(value: unknown, fieldName = 'Token'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw AppError.badRequest(`${fieldName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length > ONE_TIME_TOKEN_MAX_LENGTH) {
    throw AppError.badRequest(`${fieldName} is too long`);
  }

  return normalized;
}

function isMagicLinkToken(token: string): boolean {
  return token.startsWith('magic_');
}

function normalizeMfaLoginCode(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.unauthorized('Invalid MFA code');
  }

  const normalized = value.trim().toUpperCase();
  if (!TOTP_CODE_PATTERN.test(normalized) && !MFA_BACKUP_CODE_PATTERN.test(normalized)) {
    throw AppError.unauthorized('Invalid MFA code');
  }

  return normalized;
}

function hashOneTimeToken(token: string): string {
  return `${ONE_TIME_TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`;
}

function oneTimeTokenLookup(rawToken: string) {
  const conditions = [{ token: hashOneTimeToken(rawToken) }];

  if (!rawToken.startsWith(ONE_TIME_TOKEN_HASH_PREFIX)) {
    conditions.push({ token: rawToken });
  }

  return { OR: conditions };
}

function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    errors.push(`Password must be ${PASSWORD_MAX_BYTES} bytes or fewer`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_REQUIREMENTS.requireSpecial && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}

function normalizeProfileText(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest(`${fieldName} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw AppError.badRequest(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return normalized || null;
}

authRouter.use(
  createRegistrationRouter({
    prisma,
    normalizeEmailInput,
    normalizePasswordInput,
    normalizeProfileText,
    hashOneTimeToken,
    validatePassword,
    auditUserAuthEvent,
    profileFullNameMaxLength: PROFILE_FULL_NAME_MAX_LENGTH,
  }),
);

// POST /api/auth/login
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, mfaCode } = req.body;

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }
    const normalizedEmail = normalizeEmailInput(email);
    const normalizedPassword = normalizePasswordInput(password);

    const clientIp = getClientIp(req);
    const accountLockout = await isLockedOut(clientIp, normalizedEmail);
    if (accountLockout.locked) {
      throw new AppError(
        429,
        `Too many failed attempts. Please try again in ${Math.ceil(accountLockout.remainingSeconds / 60)} minutes.`,
        'ACCOUNT_LOCKED',
        { retryAfter: accountLockout.remainingSeconds, locked: true },
      );
    }

    // Find user with MFA fields using raw SQL
    const userResult = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string;
        password_hash: string | null;
        full_name: string | null;
        role_in_company: string;
        company_id: string | null;
        email_verified: boolean;
        two_factor_enabled: number;
        two_factor_secret: string | null;
      }>
    >`SELECT id, email, password_hash, full_name, role_in_company, company_id, email_verified, two_factor_enabled, two_factor_secret FROM users WHERE LOWER(email) = ${normalizedEmail} LIMIT 1`;

    const user = userResult[0];

    if (!user) {
      await recordFailedAuthAttempt(clientIp, normalizedEmail);
      throw AppError.unauthorized('Invalid email or password');
    }

    if (!user.password_hash) {
      await recordFailedAuthAttempt(clientIp, normalizedEmail);
      await auditUserAuthEvent(req, user.id, AuditAction.USER_LOGIN_FAILED, {
        method: 'password',
        reason: 'password_unavailable',
      });
      throw AppError.unauthorized('Invalid email or password');
    }

    // Verify password
    if (!verifyPassword(normalizedPassword, user.password_hash)) {
      await recordFailedAuthAttempt(clientIp, normalizedEmail);
      await auditUserAuthEvent(req, user.id, AuditAction.USER_LOGIN_FAILED, {
        method: 'password',
        reason: 'invalid_credentials',
      });
      throw AppError.unauthorized('Invalid email or password');
    }

    const shouldUpgradePasswordHash = needsPasswordRehash(user.password_hash);
    let loginMethod = 'password';

    // Check if MFA is enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      const normalizedMfaCode = normalizeMfaLoginCode(mfaCode);
      // If MFA code provided, verify it
      if (normalizedMfaCode) {
        let isValid = false;
        if (TOTP_CODE_PATTERN.test(normalizedMfaCode)) {
          const { verify: verifyOtp } = await import('otplib');
          const mfaSecret = decrypt(user.two_factor_secret);
          const verifyResult = await verifyOtp({
            token: normalizedMfaCode,
            secret: mfaSecret,
          });
          isValid = typeof verifyResult === 'boolean' ? verifyResult : verifyResult.valid;
        }

        const backupCodeValid =
          !isValid && MFA_BACKUP_CODE_PATTERN.test(normalizedMfaCode)
            ? await verifyAndConsumeMfaBackupCode(user.id, normalizedMfaCode)
            : false;

        if (!isValid && !backupCodeValid) {
          await recordFailedAuthAttempt(clientIp, normalizedEmail);
          await auditUserAuthEvent(req, user.id, AuditAction.USER_LOGIN_FAILED, {
            method: 'password_mfa',
            reason: 'invalid_mfa',
          });
          throw AppError.unauthorized('Invalid MFA code');
        }

        loginMethod = backupCodeValid ? 'password_mfa_backup_code' : 'password_mfa_totp';
        // MFA verified, continue to generate token
      } else {
        // MFA required but no code provided
        return res.status(200).json({
          mfaRequired: true,
          userId: user.id,
          mfaChallengeToken: generateMfaChallengeToken(user.id),
          message: 'MFA verification required',
        });
      }
    }

    if (shouldUpgradePasswordHash) {
      await prisma.user.updateMany({
        where: { id: user.id, passwordHash: user.password_hash },
        data: { passwordHash: hashPassword(normalizedPassword) },
      });
    }

    // Get company name
    let companyName: string | null = null;
    if (user.company_id) {
      const companyResult = await prisma.$queryRaw<
        Array<{ name: string }>
      >`SELECT name FROM companies WHERE id = ${user.company_id}`;
      companyName = companyResult[0]?.name || null;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role_in_company,
    });

    await clearFailedAuthAttempts(clientIp, normalizedEmail);

    await auditUserAuthEvent(req, user.id, AuditAction.USER_LOGIN, {
      method: loginMethod,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_in_company,
        companyId: user.company_id,
        companyName,
        emailVerified: Boolean(user.email_verified),
        hasPassword: true,
        hasSubcontractorPortalAccess: await hasActiveSubcontractorPortalIdentity(user.id),
        dashboardRole: await resolveDashboardRoleForUser({
          userId: user.id,
          roleInCompany: user.role_in_company,
        }),
      },
      token,
    });
  }),
);

authRouter.use(
  createMagicLinkRouter({
    prisma,
    normalizeEmailInput,
    normalizeOneTimeTokenInput,
    hashOneTimeToken,
    oneTimeTokenLookup,
    isMagicLinkToken,
    auditUserAuthEvent,
  }),
);

authRouter.use(
  createSessionRouter({
    prisma,
    auditUserAuthEvent,
  }),
);

authRouter.use(
  createPasswordResetRouter({
    prisma,
    normalizeEmailInput,
    normalizePasswordInput,
    normalizeOneTimeTokenInput,
    hashOneTimeToken,
    oneTimeTokenLookup,
    validatePassword,
    isMagicLinkToken,
    auditUserAuthEvent,
    oneTimeTokenMaxLength: ONE_TIME_TOKEN_MAX_LENGTH,
    genericResetTokenValidationMessage: GENERIC_RESET_TOKEN_VALIDATION_MESSAGE,
  }),
);

authRouter.use(
  createProfileRouter({
    prisma,
    requireJwtAuth,
    normalizeProfileText,
    auditUserAuthEvent,
    profileFullNameMaxLength: PROFILE_FULL_NAME_MAX_LENGTH,
  }),
);

authRouter.use(
  createSessionPasswordRouter({
    prisma,
    normalizePasswordInput,
    validatePassword,
    auditUserAuthEvent,
  }),
);

authRouter.use(
  createEmailVerificationRouter({
    prisma,
    normalizeEmailInput,
    normalizeOneTimeTokenInput,
    hashOneTimeToken,
    oneTimeTokenLookup,
    auditUserAuthEvent,
    oneTimeTokenMaxLength: ONE_TIME_TOKEN_MAX_LENGTH,
  }),
);

// POST /api/auth/test-expired-token - Generate an expired token for testing
// Only available when explicitly enabled outside production.
authRouter.post(
  '/test-expired-token',
  asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_TEST_AUTH_ENDPOINTS !== 'true') {
      throw AppError.notFound('Resource');
    }

    const { email, password } = req.body;

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }
    const normalizedEmail = normalizeEmailInput(email);
    const normalizedPassword = normalizePasswordInput(password);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        roleInCompany: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw AppError.unauthorized('Invalid credentials');
    }

    if (!verifyPassword(normalizedPassword, user.passwordHash)) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Generate an expired token for testing
    const expiredToken = generateExpiredToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    });

    res.json({ expiredToken });
  }),
);

authRouter.use(
  createAccountPrivacyRouter({
    prisma,
    normalizePasswordInput,
  }),
);

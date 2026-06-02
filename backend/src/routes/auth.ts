import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateToken, generateExpiredToken, verifyPassword, verifyToken } from '../lib/auth.js';
import { sendMagicLinkEmail, sendVerificationEmail } from '../lib/email.js';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { decrypt } from '../lib/encryption.js';
import { verifyAndConsumeMfaBackupCode } from '../lib/mfaBackupCodes.js';
import { buildFrontendUrl } from '../lib/runtimeConfig.js';
import {
  clearFailedAuthAttempts,
  getClientIp,
  isLockedOut,
  recordFailedAuthAttempt,
  verificationResendLimiter,
} from '../middleware/rateLimiter.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../lib/projectAdminInvariant.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import { hasActiveSubcontractorPortalIdentity } from '../lib/projectAccess.js';
import { resolveDashboardRoleForUser } from '../lib/dashboardRole.js';
import { createRegistrationRouter } from './auth/registrationRoutes.js';
import { createSessionPasswordRouter, createSessionRouter } from './auth/sessionRoutes.js';
import { createPasswordResetRouter } from './auth/passwordResetRoutes.js';
import { createProfileRouter } from './auth/profileRoutes.js';

const GENERIC_RESEND_VERIFICATION_MESSAGE =
  'If an account exists with this email, a new verification link has been sent.';
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

const DATA_EXPORT_FILENAME_MAX_LENGTH = 180;

function sanitizeDownloadFilenameSegment(
  value: string,
  maxLength = DATA_EXPORT_FILENAME_MAX_LENGTH,
): string {
  return value
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || code > 126 || '<>:"/\\|?*'.includes(char) ? '_' : char;
    })
    .join('')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, maxLength);
}

export function getSafeDataExportFilename(email: string, date = new Date()): string {
  const prefix = 'siteproof-data-export-';
  const suffix = `-${date.toISOString().split('T')[0]}.json`;
  const maxEmailLength = Math.max(
    1,
    DATA_EXPORT_FILENAME_MAX_LENGTH - prefix.length - suffix.length,
  );
  const safeEmail = sanitizeDownloadFilenameSegment(email, maxEmailLength) || 'user';

  return `${prefix}${safeEmail}${suffix}`;
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
        two_factor_enabled: number;
        two_factor_secret: string | null;
      }>
    >`SELECT id, email, password_hash, full_name, role_in_company, company_id, two_factor_enabled, two_factor_secret FROM users WHERE LOWER(email) = ${normalizedEmail} LIMIT 1`;

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
          message: 'MFA verification required',
        });
      }
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

// Magic link expiry time in minutes
const MAGIC_LINK_EXPIRY_MINUTES = 15;

// POST /api/auth/magic-link/request - Request a magic link login email (Feature #1005)
authRouter.post(
  '/magic-link/request',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw AppError.badRequest('Email is required');
    }
    const normalizedEmail = normalizeEmailInput(email);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, a login link has been sent.',
      });
    }

    // Generate magic link token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    // Store token using password reset token table (reusing existing infrastructure)
    // Delete any existing tokens for this user first
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new magic link token
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashOneTimeToken(`magic_${token}`), // Prefix remains in the emailed token only.
        expiresAt,
      },
    });

    const magicLinkUrl = buildFrontendUrl(`/auth/magic-link?token=magic_${token}`);

    // Send magic link email
    await sendMagicLinkEmail({
      to: user.email,
      userName: user.fullName || undefined,
      magicLinkUrl,
      expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
    });

    await auditUserAuthEvent(req, user.id, AuditAction.MAGIC_LINK_REQUESTED, {
      method: 'magic_link',
      expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
    });

    res.json({
      message: 'If an account exists with this email, a login link has been sent.',
    });
  }),
);

// POST /api/auth/magic-link/verify - Verify magic link and login (Feature #1005)
authRouter.post(
  '/magic-link/verify',
  asyncHandler(async (req, res) => {
    const token = normalizeOneTimeTokenInput(req.body.token);

    // Only accept magic_ prefixed tokens
    if (!isMagicLinkToken(token)) {
      throw AppError.badRequest('Invalid token format');
    }

    // Find the token
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: oneTimeTokenLookup(token),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            roleInCompany: true,
            companyId: true,
            passwordHash: true,
            twoFactorEnabled: true,
            company: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw AppError.badRequest('Invalid or expired link');
    }

    // Check if token has expired
    if (tokenRecord.expiresAt < new Date()) {
      // Delete expired token
      await prisma.passwordResetToken.delete({
        where: { id: tokenRecord.id },
      });
      throw AppError.badRequest('This link has expired. Please request a new one.');
    }

    // Check if token has already been used
    if (tokenRecord.usedAt) {
      throw AppError.badRequest('This link has already been used. Please request a new one.');
    }

    if (tokenRecord.user.twoFactorEnabled) {
      await prisma.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });
      throw AppError.forbidden(
        'MFA-enabled accounts must sign in with email, password, and MFA code',
      );
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    // Generate JWT token for the user
    const authToken = generateToken({
      userId: tokenRecord.user.id,
      email: tokenRecord.user.email,
      role: tokenRecord.user.roleInCompany,
    });

    await auditUserAuthEvent(req, tokenRecord.user.id, AuditAction.USER_LOGIN, {
      method: 'magic_link',
    });

    res.json({
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        fullName: tokenRecord.user.fullName,
        role: tokenRecord.user.roleInCompany,
        companyId: tokenRecord.user.companyId,
        companyName: tokenRecord.user.company?.name || null,
        hasPassword: Boolean(tokenRecord.user.passwordHash),
      },
      token: authToken,
    });
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

// POST /api/auth/verify-email - Verify email with token
authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const token = normalizeOneTimeTokenInput(req.body.token, 'Verification token');

    // Find the token
    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: oneTimeTokenLookup(token),
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
        user: {
          select: {
            emailVerified: true,
          },
        },
      },
    });

    if (!verificationToken) {
      throw AppError.badRequest('Invalid verification token');
    }

    // Check if token has been used
    if (verificationToken.usedAt) {
      throw AppError.badRequest(
        verificationToken.user.emailVerified
          ? 'This verification token has already been used'
          : 'This verification token has already been used or replaced',
      );
    }

    // Check if token has expired
    if (verificationToken.expiresAt < new Date()) {
      throw AppError.badRequest('This verification token has expired');
    }

    // Check if user is already verified
    if (verificationToken.user.emailVerified) {
      throw AppError.badRequest('Email is already verified');
    }

    // Update user and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await auditUserAuthEvent(req, verificationToken.userId, AuditAction.USER_EMAIL_VERIFIED, {
      emailVerified: { from: false, to: true },
      method: 'email_verification',
    });

    res.json({
      message: 'Email verified successfully. You can now log in.',
      verified: true,
    });
  }),
);

// GET /api/auth/verify-email-status - Check verification status
authRouter.get(
  '/verify-email-status',
  asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: 'Token is required' });
    }
    const normalizedToken = token.trim();
    if (!normalizedToken || normalizedToken.length > ONE_TIME_TOKEN_MAX_LENGTH) {
      return res.json({ valid: false, message: 'Invalid verification token' });
    }

    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: oneTimeTokenLookup(normalizedToken),
      include: { user: { select: { email: true, emailVerified: true } } },
    });

    if (!verificationToken) {
      return res.json({ valid: false, message: 'Invalid verification token' });
    }

    if (verificationToken.usedAt) {
      if (verificationToken.user.emailVerified) {
        return res.json({
          valid: false,
          message: 'This verification token has already been used',
          alreadyVerified: true,
        });
      }

      return res.json({
        valid: false,
        message:
          'This verification token has already been used or replaced. Please request a new verification link.',
      });
    }

    if (verificationToken.expiresAt < new Date()) {
      return res.json({
        valid: false,
        message: 'This verification token has expired',
        expired: true,
      });
    }

    if (verificationToken.user.emailVerified) {
      return res.json({
        valid: false,
        message: 'Email is already verified',
        alreadyVerified: true,
      });
    }

    res.json({ valid: true, email: verificationToken.user.email });
  }),
);

// POST /api/auth/resend-verification - Resend verification email
authRouter.post(
  '/resend-verification',
  verificationResendLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw AppError.badRequest('Email is required');
    }
    const normalizedEmail = normalizeEmailInput(email);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, emailVerified: true, fullName: true },
    });

    // Always return success (don't reveal if email exists or is already verified)
    if (!user) {
      return res.json({
        message: GENERIC_RESEND_VERIFICATION_MESSAGE,
      });
    }

    if (user.emailVerified) {
      return res.json({
        message: GENERIC_RESEND_VERIFICATION_MESSAGE,
      });
    }

    // Invalidate any existing tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() }, // Mark as used to invalidate
    });

    // Generate new verification token
    const crypto = await import('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Token expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: hashOneTimeToken(verificationToken),
        expiresAt,
      },
    });

    const verifyUrl = buildFrontendUrl(`/verify-email?token=${verificationToken}`);

    // Send verification email
    await sendVerificationEmail({
      to: user.email,
      userName: user.fullName || undefined,
      verificationUrl: verifyUrl,
      expiresInHours: 24,
    });

    res.json({
      message: GENERIC_RESEND_VERIFICATION_MESSAGE,
    });
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

// GET /api/auth/export-data - GDPR compliant data export
// Returns all user data in a portable JSON format
authRouter.get(
  '/export-data',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized();
    }

    const token = authHeader.substring(7);
    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js');
    const userData = await verifyToken(token);

    if (!userData) {
      throw AppError.unauthorized('Invalid token');
    }

    const userId = userData.userId || userData.id;

    // Fetch all user-related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            abn: true,
            address: true,
          },
        },
        projectUsers: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                projectNumber: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    const [
      ncrs,
      diaries,
      itpCompletions,
      testResults,
      lotsCreated,
      auditLogs,
      commentsAuthored,
      uploadedDocuments,
      notifications,
      notificationEmailPreference,
      notificationDigestItems,
      notificationAlerts,
      consentRecords,
      apiKeys,
      pushSubscriptions,
      scheduledReports,
      webhookConfigsCreated,
      documentSignedUrlTokens,
      syncQueueItems,
    ] = await Promise.all([
      prisma.nCR.findMany({
        where: {
          OR: [{ raisedById: userId }, { responsibleUserId: userId }],
        },
        select: {
          id: true,
          ncrNumber: true,
          description: true,
          status: true,
          severity: true,
          category: true,
          raisedAt: true,
          closedAt: true,
        },
      }),
      prisma.dailyDiary.findMany({
        where: { submittedById: userId },
        select: {
          id: true,
          date: true,
          weatherConditions: true,
          temperatureMin: true,
          temperatureMax: true,
          rainfallMm: true,
          generalNotes: true,
          status: true,
          submittedAt: true,
          createdAt: true,
        },
      }),
      prisma.iTPCompletion.findMany({
        where: { completedById: userId },
        select: {
          id: true,
          completedAt: true,
          notes: true,
          checklistItem: {
            select: {
              description: true,
              sequenceNumber: true,
            },
          },
        },
      }),
      prisma.testResult.findMany({
        where: { enteredById: userId },
        select: {
          id: true,
          testType: true,
          testDate: true,
          resultValue: true,
          resultUnit: true,
          passFail: true,
          laboratoryName: true,
          laboratoryReportNumber: true,
          createdAt: true,
        },
      }),
      prisma.lot.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          lotNumber: true,
          description: true,
          activityType: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          changes: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
      prisma.comment.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          parentId: true,
          content: true,
          isEdited: true,
          editedAt: true,
          deletedAt: true,
          createdAt: true,
          updatedAt: true,
          attachments: {
            select: {
              id: true,
              filename: true,
              fileUrl: true,
              fileSize: true,
              mimeType: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.findMany({
        where: { uploadedById: userId },
        select: {
          id: true,
          projectId: true,
          lotId: true,
          documentType: true,
          category: true,
          filename: true,
          fileUrl: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
          gpsLatitude: true,
          gpsLongitude: true,
          captureTimestamp: true,
          aiClassification: true,
          caption: true,
          tags: true,
          isFavourite: true,
          version: true,
          parentDocumentId: true,
          isLatestVersion: true,
          createdAt: true,
        },
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: {
          id: true,
          projectId: true,
          type: true,
          title: true,
          message: true,
          linkUrl: true,
          isRead: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notificationEmailPreference.findUnique({
        where: { userId },
        select: {
          enabled: true,
          mentions: true,
          mentionsTiming: true,
          ncrAssigned: true,
          ncrAssignedTiming: true,
          ncrStatusChange: true,
          ncrStatusChangeTiming: true,
          holdPointReminder: true,
          holdPointReminderTiming: true,
          holdPointRelease: true,
          holdPointReleaseTiming: true,
          commentReply: true,
          commentReplyTiming: true,
          scheduledReports: true,
          scheduledReportsTiming: true,
          dailyDigest: true,
          diaryReminder: true,
          diaryReminderTiming: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.notificationDigestItem.findMany({
        where: { userId },
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          projectName: true,
          linkUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notificationAlert.findMany({
        where: { assignedToId: userId },
        select: {
          id: true,
          type: true,
          severity: true,
          title: true,
          message: true,
          entityId: true,
          entityType: true,
          projectId: true,
          createdAt: true,
          resolvedAt: true,
          escalatedAt: true,
          escalationLevel: true,
          escalatedTo: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.consentRecord.findMany({
        where: { userId },
        select: {
          id: true,
          consentType: true,
          version: true,
          granted: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pushSubscription.findMany({
        where: { userId },
        select: {
          id: true,
          endpoint: true,
          userAgent: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.scheduledReport.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          projectId: true,
          reportType: true,
          frequency: true,
          dayOfWeek: true,
          dayOfMonth: true,
          timeOfDay: true,
          recipients: true,
          isActive: true,
          lastSentAt: true,
          nextRunAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.webhookConfig.findMany({
        where: { createdById: userId },
        select: {
          id: true,
          companyId: true,
          url: true,
          events: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.documentSignedUrlToken.findMany({
        where: { userId },
        select: {
          id: true,
          documentId: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.syncQueue.findMany({
        where: { userId },
        select: {
          id: true,
          deviceId: true,
          entityType: true,
          entityId: true,
          action: true,
          payload: true,
          status: true,
          createdAt: true,
          syncedAt: true,
          conflictResolution: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Build the export data structure
    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: '1.1',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.roleInCompany,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        tosAcceptedAt: user.tosAcceptedAt,
        tosVersion: user.tosVersion,
        twoFactorEnabled: user.twoFactorEnabled,
        oauthProvider: user.oauthProvider,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            abn: user.company.abn,
            address: user.company.address,
          }
        : null,
      projectMemberships: user.projectUsers.map((pu) => ({
        role: pu.role,
        invitedAt: pu.invitedAt,
        acceptedAt: pu.acceptedAt,
        status: pu.status,
        project: pu.project,
      })),
      ncrs: ncrs,
      dailyDiaries: diaries.map((d) => ({
        id: d.id,
        date: d.date,
        weatherConditions: d.weatherConditions,
        temperatureMin: d.temperatureMin,
        temperatureMax: d.temperatureMax,
        rainfallMm: d.rainfallMm,
        notes: d.generalNotes,
        status: d.status,
        submittedAt: d.submittedAt,
        createdAt: d.createdAt,
      })),
      itpCompletions: itpCompletions.map((c) => ({
        id: c.id,
        completedAt: c.completedAt,
        notes: c.notes,
        checklistItemDescription: c.checklistItem?.description,
        checklistItemSequence: c.checklistItem?.sequenceNumber,
      })),
      testResults: testResults,
      lotsCreated: lotsCreated,
      commentsAuthored: commentsAuthored,
      uploadedDocuments: uploadedDocuments,
      notifications: notifications,
      notificationEmailPreference: notificationEmailPreference,
      notificationDigestItems: notificationDigestItems,
      notificationAlerts: notificationAlerts,
      consentRecords: consentRecords,
      apiKeys: apiKeys,
      pushSubscriptions: pushSubscriptions,
      scheduledReports: scheduledReports,
      webhookConfigsCreated: webhookConfigsCreated,
      documentSignedUrlTokens: documentSignedUrlTokens,
      syncQueueItems: syncQueueItems,
      activityLog: auditLogs,
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${getSafeDataExportFilename(user.email)}"`,
    );

    res.json(exportData);
  }),
);

// GDPR Data Deletion endpoint
authRouter.delete(
  '/delete-account',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw AppError.unauthorized();
    }

    const token = authHeader.substring(7);
    const { verifyToken } = await import('../lib/auth.js');
    const userData = await verifyToken(token);

    if (!userData) {
      throw AppError.unauthorized('Invalid token');
    }

    const userId = userData.userId || userData.id;

    // Get the confirmation password from request body
    const { password, confirmEmail } = req.body;

    if (typeof confirmEmail !== 'string' || !confirmEmail.trim()) {
      throw AppError.badRequest('Email confirmation required');
    }

    // Verify the user exists and get their data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        companyId: true,
        roleInCompany: true,
      },
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    // Verify email matches
    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw AppError.badRequest('Email confirmation does not match');
    }

    if (user.companyId && user.roleInCompany === 'owner') {
      throw AppError.forbidden(
        'Company owners must transfer ownership before deleting their account',
      );
    }

    // Verify password if the user has one set
    if (user.passwordHash && !password) {
      throw AppError.badRequest('Password is required to delete this account');
    }

    if (user.passwordHash && password) {
      const normalizedPassword = normalizePasswordInput(password);
      const isValidPassword = verifyPassword(normalizedPassword, user.passwordHash);
      if (!isValidPassword) {
        throw AppError.badRequest('Invalid password');
      }
    }

    await prisma.$transaction(async (tx) => {
      await assertCanRemoveUserFromProjectAdminRoles(user.id, { client: tx });

      // Create a non-PII audit log entry before deletion (for compliance)
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: user.id,
          action: AuditAction.ACCOUNT_DELETION_REQUESTED,
          changes: JSON.stringify({
            deletedAt: new Date().toISOString(),
            reason: 'GDPR deletion request',
          }),
          userId,
          ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      });

      // Delete all user-related data in order (respecting foreign key constraints)
      // The order matters due to foreign key relationships

      // 1. Delete ITP completions by user
      await tx.iTPCompletion.deleteMany({
        where: { completedById: userId },
      });

      // 2. Delete email verification tokens
      await tx.emailVerificationToken.deleteMany({
        where: { userId },
      });

      // 3. Delete password reset tokens
      await tx.passwordResetToken.deleteMany({
        where: { userId },
      });

      // 4. Delete project user memberships (this removes the user from all projects)
      await tx.projectUser.deleteMany({
        where: { userId },
      });

      // 5. Delete the audit log for this user (anonymize - the account_deletion audit remains)
      await tx.auditLog.updateMany({
        where: { userId },
        data: { userId: null },
      });

      // 6. Finally, delete the user record
      await tx.user.delete({
        where: { id: userId },
      });
    });

    res.json({
      success: true,
      message: 'Your account and associated data have been permanently deleted.',
    });
  }),
);

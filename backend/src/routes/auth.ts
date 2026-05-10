import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  generateToken,
  generateExpiredToken,
  getTokenAuthTime,
  hashPassword,
  verifyPassword,
  verifyToken,
} from '../lib/auth.js';
import { sendMagicLinkEmail, sendVerificationEmail, sendPasswordResetEmail } from '../lib/email.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { decrypt } from '../lib/encryption.js';
import { verifyAndConsumeMfaBackupCode } from '../lib/mfaBackupCodes.js';
import { buildApiUrl, buildFrontendUrl } from '../lib/runtimeConfig.js';
import {
  assertUploadedImageFile,
  getSafeImageExtensionForMimeType,
} from '../lib/imageValidation.js';
import {
  clearFailedAuthAttempts,
  getClientIp,
  recordFailedAuthAttempt,
} from '../middleware/rateLimiter.js';
import { logError } from '../lib/serverLogger.js';
import { ensureUploadSubdirectory, getUploadSubdirectoryPath } from '../lib/uploadPaths.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../lib/projectAdminInvariant.js';

export const authRouter = Router();

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
    };

    next();
  } catch (error) {
    next(error instanceof AppError ? error : AppError.unauthorized('Authentication failed.'));
  }
}

// Configure multer for avatar uploads
const avatarUploadDir = getUploadSubdirectoryPath('avatars');
const AVATAR_PATH_PREFIX = '/uploads/avatars/';

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

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadSubdirectory('avatars'));
    } catch (error) {
      cb(
        error instanceof Error ? error : new Error('Failed to prepare avatar upload directory'),
        '',
      );
    }
  },
  filename: (req, file, cb) => {
    const userId = req.user?.userId || 'unknown';
    const ext = getSafeImageExtensionForMimeType(file.mimetype);
    if (!ext) {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'), '');
      return;
    }
    cb(null, `avatar-${userId}-${crypto.randomUUID()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (getSafeImageExtensionForMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP are allowed.'));
    }
  },
});

function cleanupUploadedAvatar(file?: Express.Multer.File): void {
  if (file?.path && fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }
}

function deleteLocalAvatarFile(avatarUrl: string | null | undefined): void {
  if (!avatarUrl) return;

  let pathname: string;
  try {
    const baseUrl = buildApiUrl('/');
    const parsedUrl = new URL(avatarUrl, baseUrl);
    const isRelativeUploadUrl = avatarUrl.startsWith(AVATAR_PATH_PREFIX);
    if (!isRelativeUploadUrl && parsedUrl.origin !== new URL(baseUrl).origin) {
      return;
    }

    pathname = parsedUrl.pathname;
  } catch {
    return;
  }

  if (!pathname.startsWith(AVATAR_PATH_PREFIX)) {
    return;
  }

  const encodedFilename = pathname.split('/').pop();
  if (!encodedFilename) return;

  let filename: string;
  try {
    filename = decodeURIComponent(encodedFilename);
  } catch {
    return;
  }

  if (filename !== path.basename(filename) || filename.includes('/') || filename.includes('\\')) {
    return;
  }

  const uploadDir = path.resolve(avatarUploadDir);
  const avatarPath = path.resolve(uploadDir, filename);
  if (avatarPath.startsWith(`${uploadDir}${path.sep}`) && fs.existsSync(avatarPath)) {
    fs.unlinkSync(avatarPath);
  }
}

// Current ToS version - update when ToS changes
const CURRENT_TOS_VERSION = '1.0';

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
const PROFILE_PHONE_MAX_LENGTH = 40;
const PROFILE_PHONE_PATTERN = /^[0-9+().\-\s]*$/;
const SUBCONTRACTOR_INVITATION_ID_MAX_LENGTH = 120;
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

function normalizeSubcontractorInvitationId(value: unknown): string {
  if (typeof value !== 'string') {
    throw AppError.badRequest('Invitation ID must be a string');
  }

  const normalized = value.trim();
  if (!normalized) {
    throw AppError.badRequest('Invitation ID is required');
  }

  if (normalized.length > SUBCONTRACTOR_INVITATION_ID_MAX_LENGTH) {
    throw AppError.badRequest('Invitation ID is too long');
  }

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    if (code <= 31 || code === 127) {
      throw AppError.badRequest('Invitation ID contains invalid characters');
    }
  }

  return normalized;
}

function isMagicLinkToken(token: string): boolean {
  return token.startsWith('magic_');
}

function rejectMagicLinkTokenForPasswordReset(token: string): void {
  if (isMagicLinkToken(token)) {
    throw AppError.badRequest('Invalid or expired reset token');
  }
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

function normalizeProfilePhone(value: unknown): string | null | undefined {
  const normalized = normalizeProfileText(value, 'Phone', PROFILE_PHONE_MAX_LENGTH);

  if (typeof normalized === 'string' && !PROFILE_PHONE_PATTERN.test(normalized)) {
    throw AppError.badRequest('Phone may only contain numbers, spaces, and +().- characters');
  }

  return normalized;
}

// POST /api/auth/register
authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, fullName, firstName, lastName, tosAccepted } = req.body;

    if (!email || !password) {
      throw AppError.badRequest('Email and password are required');
    }
    const normalizedEmail = normalizeEmailInput(email);
    const normalizedPassword = normalizePasswordInput(password);

    // Validate password strength
    const passwordValidation = validatePassword(normalizedPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Password does not meet security requirements', {
        errors: passwordValidation.errors as unknown as Record<string, unknown>,
      });
    }

    // Require ToS acceptance
    if (!tosAccepted) {
      throw AppError.badRequest('You must accept the Terms of Service to create an account');
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw AppError.badRequest('Email already in use');
    }

    // Build full name from parts if not provided directly
    const name =
      fullName ||
      (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || null);

    // Create user with emailVerified set to false and ToS acceptance recorded
    const passwordHash = hashPassword(normalizedPassword);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        fullName: name,
        emailVerified: false,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleInCompany: true,
        emailVerified: true,
      },
    });

    // Record ToS acceptance using parameterized query
    // Use PostgreSQL NOW() function for timestamp compatibility
    await prisma.$executeRaw`UPDATE users SET tos_accepted_at = NOW(), tos_version = ${CURRENT_TOS_VERSION} WHERE id = ${user.id}`;

    // Generate email verification token
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
      to: normalizedEmail,
      userName: name || undefined,
      verificationUrl: verifyUrl,
      expiresInHours: 24,
    });

    // Generate auth token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleInCompany,
        emailVerified: user.emailVerified,
        hasPassword: true,
      },
      token,
      message: 'Account created. Please check your email to verify your account.',
      verificationRequired: true,
    });
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

    if (!user || !user.password_hash) {
      await recordFailedAuthAttempt(clientIp);
      throw AppError.unauthorized('Invalid email or password');
    }

    // Verify password
    if (!verifyPassword(normalizedPassword, user.password_hash)) {
      await recordFailedAuthAttempt(clientIp);
      throw AppError.unauthorized('Invalid email or password');
    }

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
          await recordFailedAuthAttempt(clientIp);
          throw AppError.unauthorized('Invalid MFA code');
        }
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

    await clearFailedAuthAttempts(clientIp);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role_in_company,
        companyId: user.company_id,
        companyName,
        hasPassword: true,
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

// GET /api/auth/me
authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized();
    }

    const token = authHeader.substring(7);

    // Import verifyToken dynamically to avoid circular import
    const { verifyToken } = await import('../lib/auth.js');
    const user = await verifyToken(token);

    if (!user) {
      throw AppError.unauthorized('Invalid token');
    }

    res.json({ user });
  }),
);

// POST /api/auth/logout
authRouter.post('/logout', (_req, res) => {
  // For JWT-based auth, client simply clears the token
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/logout-all-devices - Invalidate all existing sessions
authRouter.post(
  '/logout-all-devices',
  asyncHandler(async (req, res) => {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication required');
    }

    const token = authHeader.substring(7);
    const user = await verifyToken(token);

    if (!user) {
      throw AppError.unauthorized('Invalid or expired token');
    }

    // Use the app clock and current token authTime so DB clock skew cannot leave
    // the request token valid when logout happens immediately after login.
    const tokenAuthTime = getTokenAuthTime(token);
    const invalidatedAt = new Date(Math.max(Date.now(), tokenAuthTime ?? 0) + 1);
    await prisma.user.update({
      where: { id: user.userId },
      data: { tokenInvalidatedAt: invalidatedAt },
    });

    const now = invalidatedAt.toISOString();

    res.json({
      message: 'Successfully logged out from all devices',
      loggedOutAt: now,
    });
  }),
);

// POST /api/auth/forgot-password - Request a password reset
authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      throw AppError.badRequest('Email is required');
    }
    const normalizedEmail = normalizeEmailInput(email);

    // Find user - but don't reveal if email exists (security best practice)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true },
    });

    // Always respond with success message (don't reveal if email exists)
    // But only send email if user exists
    if (user) {
      // Generate a secure random token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');

      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Invalidate any existing tokens for this user
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() }, // Mark as used to invalidate
      });

      // Create new token
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashOneTimeToken(token),
          expiresAt,
        },
      });

      const resetUrl = buildFrontendUrl(`/reset-password?token=${token}`);

      // Send password reset email
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresInMinutes: 60,
      });
    }

    // Always return success (security: don't reveal if email exists)
    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  }),
);

// POST /api/auth/reset-password - Reset password with token
authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token: rawToken, password } = req.body;

    if (!rawToken || !password) {
      throw AppError.badRequest('Token and new password are required');
    }
    const token = normalizeOneTimeTokenInput(rawToken);
    rejectMagicLinkTokenForPasswordReset(token);
    const normalizedPassword = normalizePasswordInput(password, 'New password');

    // Validate password requirements
    const passwordValidation = validatePassword(normalizedPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Password does not meet security requirements', {
        errors: passwordValidation.errors as unknown as Record<string, unknown>,
      });
    }

    // Find the token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: oneTimeTokenLookup(token),
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    if (!resetToken) {
      throw AppError.badRequest('Invalid or expired reset token');
    }

    // Check if token has been used
    if (resetToken.usedAt) {
      throw AppError.badRequest('This reset token has already been used');
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      throw AppError.badRequest('This reset token has expired');
    }

    // Hash the new password
    const newPasswordHash = hashPassword(normalizedPassword);

    // Update user password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash: newPasswordHash,
          tokenInvalidatedAt: new Date(),
        },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  }),
);

// GET /api/auth/validate-reset-token - Check if a reset token is valid
authRouter.get(
  '/validate-reset-token',
  asyncHandler(async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: 'Token is required' });
    }
    const normalizedToken = token.trim();
    if (
      !normalizedToken ||
      normalizedToken.length > ONE_TIME_TOKEN_MAX_LENGTH ||
      isMagicLinkToken(normalizedToken)
    ) {
      return res.json({ valid: false, message: 'Invalid reset token' });
    }

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: oneTimeTokenLookup(normalizedToken),
    });

    if (!resetToken) {
      return res.json({ valid: false, message: 'Invalid reset token' });
    }

    if (resetToken.usedAt) {
      return res.json({ valid: false, message: 'This reset token has already been used' });
    }

    if (resetToken.expiresAt < new Date()) {
      return res.json({ valid: false, message: 'This reset token has expired' });
    }

    res.json({ valid: true });
  }),
);

// PATCH /api/auth/profile - Update user profile
authRouter.patch(
  '/profile',
  requireJwtAuth,
  asyncHandler(async (req, res) => {
    const userData = req.user!;
    const fullName = normalizeProfileText(
      req.body.fullName,
      'Full name',
      PROFILE_FULL_NAME_MAX_LENGTH,
    );
    const phone = normalizeProfilePhone(req.body.phone);

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userData.id },
      data: {
        fullName: fullName !== undefined ? fullName : undefined,
        phone: phone !== undefined ? phone : undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        roleInCompany: true,
        companyId: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        name: updatedUser.fullName,
        phone: updatedUser.phone,
        role: updatedUser.roleInCompany,
        companyId: updatedUser.companyId,
        companyName: updatedUser.company?.name || null,
      },
    });
  }),
);

// POST /api/auth/avatar - Upload user avatar (Feature #690)
authRouter.post(
  '/avatar',
  requireJwtAuth,
  avatarUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    const userData = req.user!;
    if (!req.file) {
      throw AppError.badRequest('No file uploaded');
    }

    try {
      assertUploadedImageFile(req.file);
    } catch (error) {
      cleanupUploadedAvatar(req.file);
      throw error;
    }

    // Get the old avatar to delete it later
    const oldUser = await prisma.user.findUnique({
      where: { id: userData.id },
      select: { avatarUrl: true },
    });

    const avatarUrl = buildApiUrl(`/uploads/avatars/${req.file.filename}`);

    // Update user with new avatar URL
    const updatedUser = await prisma.user.update({
      where: { id: userData.id },
      data: { avatarUrl },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        phone: true,
        roleInCompany: true,
        companyId: true,
      },
    });

    // Delete old avatar file if it exists
    if (oldUser?.avatarUrl) {
      try {
        deleteLocalAvatarFile(oldUser.avatarUrl);
      } catch (err) {
        logError('Failed to delete old avatar:', err);
      }
    }

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl: updatedUser.avatarUrl,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        name: updatedUser.fullName,
        avatarUrl: updatedUser.avatarUrl,
        phone: updatedUser.phone,
        role: updatedUser.roleInCompany,
        companyId: updatedUser.companyId,
      },
    });
  }),
);

// DELETE /api/auth/avatar - Remove user avatar
authRouter.delete(
  '/avatar',
  requireJwtAuth,
  asyncHandler(async (req, res) => {
    const userData = req.user!;
    // Get the current avatar URL to delete the file
    const user = await prisma.user.findUnique({
      where: { id: userData.id },
      select: { avatarUrl: true },
    });

    // Update user to remove avatar URL
    await prisma.user.update({
      where: { id: userData.id },
      data: { avatarUrl: null },
    });

    if (user?.avatarUrl) {
      try {
        deleteLocalAvatarFile(user.avatarUrl);
      } catch (err) {
        logError('Failed to delete avatar file:', err);
      }
    }

    res.json({ message: 'Avatar removed successfully' });
  }),
);

// POST /api/auth/change-password - Change user password (requires current password)
authRouter.post(
  '/change-password',
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

    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw AppError.badRequest(
        'Current password, new password, and confirm password are required',
      );
    }
    const normalizedCurrentPassword = normalizePasswordInput(currentPassword, 'Current password');
    const normalizedNewPassword = normalizePasswordInput(newPassword, 'New password');
    const normalizedConfirmPassword = normalizePasswordInput(confirmPassword, 'Confirm password');

    if (normalizedNewPassword !== normalizedConfirmPassword) {
      throw AppError.badRequest('New password and confirm password do not match');
    }

    const passwordValidation = validatePassword(normalizedNewPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('New password does not meet security requirements', {
        errors: passwordValidation.errors as unknown as Record<string, unknown>,
      });
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userData.userId || userData.id },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      throw AppError.notFound('User');
    }

    // Verify current password
    if (!verifyPassword(normalizedCurrentPassword, user.passwordHash)) {
      throw AppError.unauthorized('Current password is incorrect');
    }

    // Hash and update password
    const newPasswordHash = hashPassword(normalizedNewPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        tokenInvalidatedAt: new Date(),
      },
    });

    res.json({ message: 'Password changed successfully' });
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

    // Always return success (don't reveal if email exists)
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, a new verification link has been sent.',
      });
    }

    if (user.emailVerified) {
      return res.json({
        message: 'Email is already verified. You can log in.',
        alreadyVerified: true,
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
      message: 'If an account exists with this email, a new verification link has been sent.',
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

// POST /api/auth/register-and-accept-invitation - Register new user and accept subcontractor invitation
// This is a public endpoint (no auth required) for onboarding new subcontractor users
authRouter.post(
  '/register-and-accept-invitation',
  asyncHandler(async (req, res) => {
    const { email, password, fullName, invitationId, tosAccepted } = req.body;

    if (!email || !password || !invitationId) {
      throw AppError.badRequest('Email, password, and invitationId are required');
    }
    const normalizedEmail = normalizeEmailInput(email);
    const normalizedPassword = normalizePasswordInput(password);
    const normalizedInvitationId = normalizeSubcontractorInvitationId(invitationId);
    const normalizedFullName = normalizeProfileText(
      fullName,
      'Full name',
      PROFILE_FULL_NAME_MAX_LENGTH,
    );

    // Validate password strength
    const passwordValidation = validatePassword(normalizedPassword);
    if (!passwordValidation.valid) {
      throw AppError.badRequest('Password does not meet security requirements', {
        errors: passwordValidation.errors as unknown as Record<string, unknown>,
      });
    }

    // Require ToS acceptance
    if (!tosAccepted) {
      throw AppError.badRequest('You must accept the Terms of Service to create an account');
    }

    const passwordHash = hashPassword(normalizedPassword);
    const { user, subcontractor } = await prisma.$transaction(async (tx) => {
      const invitedSubcontractor = await tx.subcontractorCompany.findUnique({
        where: { id: normalizedInvitationId },
        include: {
          project: { select: { id: true, name: true } },
        },
      });

      if (!invitedSubcontractor) {
        throw AppError.notFound('Invitation not found or expired');
      }

      if (invitedSubcontractor.status !== 'pending_approval') {
        throw AppError.forbidden('This invitation is no longer active');
      }

      if (invitedSubcontractor.primaryContactEmail?.trim().toLowerCase() !== normalizedEmail) {
        throw AppError.badRequest('Email does not match the invitation');
      }

      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw AppError.badRequest(
          'An account with this email already exists. Please log in and accept the invitation.',
        );
      }

      const existingLink = await tx.subcontractorUser.findFirst({
        where: { subcontractorCompanyId: invitedSubcontractor.id },
      });

      if (existingLink) {
        throw AppError.badRequest('This invitation has already been accepted by another user');
      }

      const statusUpdate = await tx.subcontractorCompany.updateMany({
        where: { id: invitedSubcontractor.id, status: 'pending_approval' },
        data: { status: 'approved' },
      });

      if (statusUpdate.count !== 1) {
        throw AppError.badRequest('This invitation has already been accepted by another user');
      }

      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: normalizedFullName ?? invitedSubcontractor.primaryContactName ?? null,
          emailVerified: true, // Auto-verify since they're accepting an invitation
          emailVerifiedAt: new Date(),
          roleInCompany: 'subcontractor_admin',
          tosAcceptedAt: new Date(),
          tosVersion: CURRENT_TOS_VERSION,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          roleInCompany: true,
        },
      });

      await tx.subcontractorUser.create({
        data: {
          userId: createdUser.id,
          subcontractorCompanyId: invitedSubcontractor.id,
          role: 'admin', // First user is admin
        },
      });

      return { user: createdUser, subcontractor: invitedSubcontractor };
    });

    // Generate auth token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.roleInCompany,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.roleInCompany,
        hasPassword: true,
      },
      company: {
        id: subcontractor.id,
        companyName: subcontractor.companyName,
        projectId: subcontractor.projectId,
        projectName: subcontractor.project.name,
      },
      token,
      message: 'Account created and invitation accepted successfully',
    });
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
        fullName: true,
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

    await assertCanRemoveUserFromProjectAdminRoles(user.id);

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
      // Create an audit log entry before deletion (for compliance)
      await tx.auditLog.create({
        data: {
          entityType: 'user',
          entityId: user.id,
          action: 'account_deletion_requested',
          changes: JSON.stringify({
            email: user.email,
            fullName: user.fullName,
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

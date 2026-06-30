// MFA Routes (Feature #22, #420, #421)
// Two-factor authentication with TOTP (Time-based One-Time Password)

import { Router, type Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/auth.js';
import { requireBrowserSession } from '../middleware/browserSession.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { generateSecret, verify as verifyOtp, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { encrypt, decrypt } from '../lib/encryption.js';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  disableMfaAndDeleteBackupCodes,
  enableMfaAndReplaceBackupCodes,
  generateMfaBackupCodes,
  verifyAndConsumeMfaBackupCode,
} from '../lib/mfaBackupCodes.js';
import { isOtpVerifyResultValid } from '../lib/otpVerifyResult.js';
import { AuditAction, createAuditLog } from '../lib/auditLog.js';
import {
  buildMfaDisabledResponse,
  buildMfaSetupResponse,
  buildMfaSetupVerifiedResponse,
  buildMfaStatusResponse,
} from './mfa/responses.js';

export const mfaRouter = Router();

const TOTP_CODE_PATTERN = /^\d{6}$/;
const MFA_BACKUP_CODE_PATTERN = /^[A-F0-9]{10}$/i;

function getAuthenticatedUser(req: Request) {
  if (!req.user) {
    throw AppError.unauthorized();
  }

  return req.user;
}

function normalizeTotpCode(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    throw AppError.badRequest('Verification code is required');
  }

  if (typeof value !== 'string') {
    throw AppError.badRequest('Invalid verification code. Please try again.');
  }

  const normalized = value.trim();
  if (!TOTP_CODE_PATTERN.test(normalized)) {
    throw AppError.badRequest('Invalid verification code. Please try again.');
  }

  return normalized;
}

function normalizeDisableCode(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.unauthorized('Invalid password or MFA code');
  }

  const normalized = value.trim().toUpperCase();
  if (!TOTP_CODE_PATTERN.test(normalized) && !MFA_BACKUP_CODE_PATTERN.test(normalized)) {
    throw AppError.unauthorized('Invalid password or MFA code');
  }

  return normalized;
}

function normalizeDisablePassword(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw AppError.unauthorized('Invalid password or MFA code');
  }

  return value;
}

// GET /api/mfa/status - Get current MFA status for user
mfaRouter.get(
  '/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = getAuthenticatedUser(req).userId;

    // Use raw SQL to get MFA status
    const userResult = await prisma.$queryRaw<
      Array<{
        two_factor_enabled: boolean;
      }>
    >`SELECT two_factor_enabled FROM users WHERE id = ${userId}`;

    const user = userResult[0];
    if (!user) {
      throw AppError.notFound('User');
    }

    res.json(buildMfaStatusResponse(Boolean(user.two_factor_enabled)));
  }),
);

// POST /api/mfa/setup - Generate MFA secret and QR code
mfaRouter.post(
  '/setup',
  authRateLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    requireBrowserSession(req, 'MFA setup');
    const authUser = getAuthenticatedUser(req);
    const userId = authUser.userId;
    const userEmail = authUser.email;

    // Check if MFA is already enabled
    const userResult = await prisma.$queryRaw<
      Array<{
        two_factor_enabled: number;
      }>
    >`SELECT two_factor_enabled FROM users WHERE id = ${userId}`;

    const dbUser = userResult[0];
    if (!dbUser) {
      throw AppError.notFound('User');
    }

    if (dbUser.two_factor_enabled) {
      throw AppError.badRequest('MFA is already enabled. Disable it first to set up again.');
    }

    // Generate a new secret using otplib v13 functional API
    const secret = await generateSecret();

    // Encrypt the secret before storing
    const encryptedSecret = encrypt(secret);

    // Store the encrypted secret temporarily (not enabled yet until verified)
    await prisma.$executeRaw`UPDATE users SET two_factor_secret = ${encryptedSecret} WHERE id = ${userId}`;

    // Generate the otpauth URL using otplib v13 generateURI
    const otpAuthUrl = await generateURI({
      secret,
      issuer: 'SiteProof',
      label: userEmail,
    });

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    res.json(buildMfaSetupResponse(secret, qrCodeDataUrl, otpAuthUrl));
  }),
);

// POST /api/mfa/verify-setup - Verify the setup code and enable MFA
mfaRouter.post(
  '/verify-setup',
  authRateLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    requireBrowserSession(req, 'MFA setup verification');
    const userId = getAuthenticatedUser(req).userId;
    const code = normalizeTotpCode(req.body.code);

    // Get the user's pending secret
    const userResult = await prisma.$queryRaw<
      Array<{
        two_factor_secret: string | null;
        two_factor_enabled: boolean;
      }>
    >`SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ${userId}`;

    const user = userResult[0];
    if (!user) {
      throw AppError.notFound('User');
    }

    if (user.two_factor_enabled) {
      throw AppError.badRequest('MFA is already enabled');
    }

    if (!user.two_factor_secret) {
      throw AppError.badRequest('No MFA setup in progress. Please start setup first.');
    }

    // Decrypt the secret before verifying
    const decryptedSecret = decrypt(user.two_factor_secret);

    // Verify the code using otplib v13 functional API
    const isValid = isOtpVerifyResultValid(
      await verifyOtp({
        token: code,
        secret: decryptedSecret,
      }),
    );

    if (!isValid) {
      throw AppError.badRequest('Invalid verification code. Please try again.');
    }

    const backupCodes = generateMfaBackupCodes();
    await enableMfaAndReplaceBackupCodes(userId, backupCodes);
    await createAuditLog({
      userId,
      entityType: 'user',
      entityId: userId,
      action: AuditAction.MFA_ENABLED,
      changes: {
        mfaEnabled: { from: false, to: true },
        method: 'totp',
      },
      req,
    });

    res.json(buildMfaSetupVerifiedResponse(backupCodes));
  }),
);

// POST /api/mfa/disable - Disable MFA (requires password)
mfaRouter.post(
  '/disable',
  authRateLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    requireBrowserSession(req, 'MFA disable');
    const userId = getAuthenticatedUser(req).userId;
    const { password, code } = req.body;
    const normalizedPassword = normalizeDisablePassword(password);
    const normalizedCode = normalizeDisableCode(code);

    if (!normalizedPassword && !normalizedCode) {
      throw AppError.badRequest('Password or MFA code is required to disable MFA');
    }

    // Get user details
    const userResult = await prisma.$queryRaw<
      Array<{
        password_hash: string | null;
        two_factor_secret: string | null;
        two_factor_enabled: boolean;
      }>
    >`SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = ${userId}`;

    const user = userResult[0];
    if (!user) {
      throw AppError.notFound('User');
    }

    if (!user.two_factor_enabled) {
      throw AppError.badRequest('MFA is not enabled');
    }

    // Verify either password or MFA code
    let verified = false;
    let verificationMethod: 'password' | 'totp' | 'backup_code' | null = null;

    if (normalizedPassword && user.password_hash) {
      verified = verifyPassword(normalizedPassword, user.password_hash);
      if (verified) {
        verificationMethod = 'password';
      }
    }

    if (
      !verified &&
      normalizedCode &&
      TOTP_CODE_PATTERN.test(normalizedCode) &&
      user.two_factor_secret
    ) {
      // Decrypt the secret before verifying
      const decryptedSecret = decrypt(user.two_factor_secret);
      verified = isOtpVerifyResultValid(
        await verifyOtp({
          token: normalizedCode,
          secret: decryptedSecret,
        }),
      );
      if (verified) {
        verificationMethod = 'totp';
      }
    }

    if (!verified && normalizedCode && MFA_BACKUP_CODE_PATTERN.test(normalizedCode)) {
      verified = await verifyAndConsumeMfaBackupCode(userId, normalizedCode);
      if (verified) {
        verificationMethod = 'backup_code';
      }
    }

    if (!verified) {
      throw AppError.unauthorized('Invalid password or MFA code');
    }

    await disableMfaAndDeleteBackupCodes(userId);
    await createAuditLog({
      userId,
      entityType: 'user',
      entityId: userId,
      action: AuditAction.MFA_DISABLED,
      changes: {
        mfaEnabled: { from: true, to: false },
        method: verificationMethod,
      },
      req,
    });

    res.json(buildMfaDisabledResponse());
  }),
);

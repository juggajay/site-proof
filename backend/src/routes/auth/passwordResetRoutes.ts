import { Router, type Request, type Response } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';

import { hashPassword } from '../../lib/auth.js';
import { AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { revokeActiveApiKeysForUser } from '../../lib/apiKeyRevocation.js';
import { sendPasswordResetEmail } from '../../lib/email.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { logError, logWarn } from '../../lib/serverLogger.js';

const PASSWORD_RESET_TOKEN_PURPOSE = 'password_reset';
const TERMS_OF_SERVICE_VERSION = '1.0';

type PasswordResetPrismaClient = Pick<PrismaClient, 'user' | 'passwordResetToken' | '$transaction'>;

type PasswordValidation = {
  valid: boolean;
  errors: string[];
};

type PasswordResetSetupUser = {
  companyId: string | null;
  passwordHash: string | null;
  oauthProvider: string | null;
  tosAcceptedAt: Date | null;
};

type CreatePasswordResetRouterDependencies = {
  prisma: PasswordResetPrismaClient;
  normalizeEmailInput: (value: unknown) => string;
  normalizePasswordInput: (value: unknown, fieldName?: string) => string;
  normalizeOneTimeTokenInput: (value: unknown, fieldName?: string) => string;
  hashOneTimeToken: (token: string) => string;
  oneTimeTokenLookup: (rawToken: string) => Prisma.PasswordResetTokenWhereInput;
  validatePassword: (password: string) => PasswordValidation;
  isMagicLinkToken: (token: string) => boolean;
  auditUserAuthEvent: (
    req: Request,
    userId: string,
    action: string,
    changes: Record<string, unknown>,
  ) => Promise<void>;
  oneTimeTokenMaxLength: number;
  genericResetTokenValidationMessage: string;
};

function rejectMagicLinkTokenForPasswordReset(
  token: string,
  isMagicLinkToken: (token: string) => boolean,
): void {
  if (isMagicLinkToken(token)) {
    throw AppError.badRequest('Invalid or expired reset token');
  }
}

function isPendingCompanyInviteSetup(user: PasswordResetSetupUser): boolean {
  return Boolean(user.companyId && !user.passwordHash && !user.oauthProvider);
}

function respondInvalidResetTokenValidation(
  res: Response,
  reason: string,
  genericResetTokenValidationMessage: string,
) {
  logWarn('[Password Reset] Reset token validation failed', { reason });
  return res.json({ valid: false, message: genericResetTokenValidationMessage });
}

export function createPasswordResetRouter({
  prisma,
  normalizeEmailInput,
  normalizePasswordInput,
  normalizeOneTimeTokenInput,
  hashOneTimeToken,
  oneTimeTokenLookup,
  validatePassword,
  isMagicLinkToken,
  auditUserAuthEvent,
  oneTimeTokenMaxLength,
  genericResetTokenValidationMessage,
}: CreatePasswordResetRouterDependencies) {
  const passwordResetRouter = Router();

  // POST /api/auth/forgot-password - Request a password reset
  passwordResetRouter.post(
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
            purpose: PASSWORD_RESET_TOKEN_PURPOSE,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() }, // Mark as used to invalidate
        });

        // Create new token
        const resetToken = await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            token: hashOneTimeToken(token),
            purpose: PASSWORD_RESET_TOKEN_PURPOSE,
            expiresAt,
          },
        });

        const resetUrl = buildFrontendUrl(`/reset-password?token=${token}`);

        // Send password reset email
        try {
          const emailResult = await sendPasswordResetEmail({
            to: user.email,
            resetUrl,
            expiresInMinutes: 60,
          });

          if (!emailResult.success) {
            logError('[Password Reset] Failed to send email:', emailResult.error);
            await prisma.passwordResetToken.updateMany({
              where: { id: resetToken.id, usedAt: null },
              data: { usedAt: new Date() },
            });

            return res.json({
              message: 'If an account exists with this email, a password reset link has been sent.',
            });
          }
        } catch (emailError) {
          logError('[Password Reset] Failed to send email:', emailError);
          await prisma.passwordResetToken.updateMany({
            where: { id: resetToken.id, usedAt: null },
            data: { usedAt: new Date() },
          });

          return res.json({
            message: 'If an account exists with this email, a password reset link has been sent.',
          });
        }

        await auditUserAuthEvent(req, user.id, AuditAction.PASSWORD_RESET_REQUESTED, {
          method: 'email',
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
  passwordResetRouter.post(
    '/reset-password',
    asyncHandler(async (req, res) => {
      const { token: rawToken, password } = req.body;

      if (!rawToken || !password) {
        throw AppError.badRequest('Token and new password are required');
      }
      const token = normalizeOneTimeTokenInput(rawToken);
      rejectMagicLinkTokenForPasswordReset(token, isMagicLinkToken);
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
        where: {
          ...oneTimeTokenLookup(token),
          purpose: PASSWORD_RESET_TOKEN_PURPOSE,
        },
        select: {
          id: true,
          userId: true,
          token: true,
          usedAt: true,
          expiresAt: true,
          user: {
            select: {
              companyId: true,
              passwordHash: true,
              oauthProvider: true,
              tosAcceptedAt: true,
            },
          },
        },
      });

      if (!resetToken) {
        throw AppError.badRequest(genericResetTokenValidationMessage);
      }

      // Check if token has been used
      if (resetToken.usedAt) {
        throw AppError.badRequest(genericResetTokenValidationMessage);
      }

      // Check if token has expired
      if (resetToken.expiresAt < new Date()) {
        throw AppError.badRequest(genericResetTokenValidationMessage);
      }

      const requiresTosAcceptance =
        isPendingCompanyInviteSetup(resetToken.user) && !resetToken.user.tosAcceptedAt;
      if (requiresTosAcceptance && req.body.tosAccepted !== true) {
        throw AppError.badRequest('You must accept the Terms of Service to activate your account');
      }

      // Hash the new password
      const newPasswordHash = hashPassword(normalizedPassword);
      const tosAcceptedAt = requiresTosAcceptance ? new Date() : null;

      // Update user password only if this request wins the one-time token consume.
      const apiKeyRevocation = await prisma.$transaction(async (tx) => {
        const consumedAt = new Date();
        const consumeResult = await tx.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            expiresAt: { gt: consumedAt },
          },
          data: { usedAt: consumedAt },
        });

        if (consumeResult.count !== 1) {
          throw AppError.badRequest(genericResetTokenValidationMessage);
        }

        const invalidatedAt = new Date(Date.now() + 1);
        await tx.user.update({
          where: { id: resetToken.userId },
          data: {
            passwordHash: newPasswordHash,
            tokenInvalidatedAt: invalidatedAt,
            ...(tosAcceptedAt ? { tosAcceptedAt, tosVersion: TERMS_OF_SERVICE_VERSION } : {}),
          },
        });

        return revokeActiveApiKeysForUser(tx, resetToken.userId);
      });

      await auditUserAuthEvent(req, resetToken.userId, AuditAction.PASSWORD_CHANGED, {
        method: 'password_reset',
        sessionsInvalidated: true,
        ...(apiKeyRevocation.count > 0 ? { apiAccessRevoked: apiKeyRevocation.count } : {}),
      });

      res.json({
        message: 'Password has been reset successfully. You can now log in with your new password.',
      });
    }),
  );

  // GET /api/auth/validate-reset-token - Check if a reset token is valid
  passwordResetRouter.get(
    '/validate-reset-token',
    asyncHandler(async (req, res) => {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: 'Token is required' });
      }
      const normalizedToken = token.trim();
      if (
        !normalizedToken ||
        normalizedToken.length > oneTimeTokenMaxLength ||
        isMagicLinkToken(normalizedToken)
      ) {
        return respondInvalidResetTokenValidation(
          res,
          'invalid-shape',
          genericResetTokenValidationMessage,
        );
      }

      const resetToken = await prisma.passwordResetToken.findFirst({
        where: {
          ...oneTimeTokenLookup(normalizedToken),
          purpose: PASSWORD_RESET_TOKEN_PURPOSE,
        },
        select: {
          usedAt: true,
          expiresAt: true,
          user: {
            select: {
              companyId: true,
              passwordHash: true,
              oauthProvider: true,
              tosAcceptedAt: true,
            },
          },
        },
      });

      if (!resetToken) {
        return respondInvalidResetTokenValidation(
          res,
          'not-found',
          genericResetTokenValidationMessage,
        );
      }

      if (resetToken.usedAt) {
        return respondInvalidResetTokenValidation(
          res,
          'already-used',
          genericResetTokenValidationMessage,
        );
      }

      if (resetToken.expiresAt < new Date()) {
        return respondInvalidResetTokenValidation(
          res,
          'expired',
          genericResetTokenValidationMessage,
        );
      }

      res.json({
        valid: true,
        requiresTosAcceptance:
          isPendingCompanyInviteSetup(resetToken.user) && !resetToken.user.tosAcceptedAt,
      });
    }),
  );

  return passwordResetRouter;
}

import { Router, type Request } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';

import { AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { sendVerificationEmail } from '../../lib/email.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { verificationResendLimiter } from '../../middleware/rateLimiter.js';
import { upgradeLegacyEmailVerificationTokenStorage } from './legacyTokenStorage.js';

type EmailVerificationPrismaClient = Pick<
  PrismaClient,
  'emailVerificationToken' | 'user' | '$transaction'
>;

type CreateEmailVerificationRouterDependencies = {
  prisma: EmailVerificationPrismaClient;
  normalizeEmailInput: (value: unknown) => string;
  normalizeOneTimeTokenInput: (value: unknown, fieldName?: string) => string;
  hashOneTimeToken: (token: string) => string;
  oneTimeTokenLookup: (rawToken: string) => Prisma.EmailVerificationTokenWhereInput;
  auditUserAuthEvent: (
    req: Request,
    userId: string,
    action: string,
    changes: Record<string, unknown>,
  ) => Promise<void>;
  oneTimeTokenMaxLength: number;
};

const GENERIC_RESEND_VERIFICATION_MESSAGE =
  'If an account exists with this email, a new verification link has been sent.';

export function createEmailVerificationRouter({
  prisma,
  normalizeEmailInput,
  normalizeOneTimeTokenInput,
  hashOneTimeToken,
  oneTimeTokenLookup,
  auditUserAuthEvent,
  oneTimeTokenMaxLength,
}: CreateEmailVerificationRouterDependencies) {
  const emailVerificationRouter = Router();

  // POST /api/auth/verify-email - Verify email with token
  emailVerificationRouter.post(
    '/verify-email',
    asyncHandler(async (req, res) => {
      const token = normalizeOneTimeTokenInput(req.body.token, 'Verification token');

      // Find the token
      const verificationToken = await prisma.emailVerificationToken.findFirst({
        where: oneTimeTokenLookup(token),
        select: {
          id: true,
          userId: true,
          token: true,
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

      await upgradeLegacyEmailVerificationTokenStorage(
        prisma,
        verificationToken,
        token,
        hashOneTimeToken,
      );

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

      const consumedAt = new Date();

      // Verify the user only if this request wins the one-time token consume.
      await prisma.$transaction(async (tx) => {
        const consumeResult = await tx.emailVerificationToken.updateMany({
          where: {
            id: verificationToken.id,
            usedAt: null,
            expiresAt: { gt: consumedAt },
          },
          data: { usedAt: consumedAt },
        });

        if (consumeResult.count !== 1) {
          throw AppError.badRequest(
            verificationToken.user.emailVerified
              ? 'This verification token has already been used'
              : 'This verification token has already been used or replaced',
          );
        }

        await tx.user.update({
          where: { id: verificationToken.userId },
          data: {
            emailVerified: true,
            emailVerifiedAt: consumedAt,
          },
        });
      });

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
  emailVerificationRouter.get(
    '/verify-email-status',
    asyncHandler(async (req, res) => {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: 'Token is required' });
      }
      const normalizedToken = token.trim();
      if (!normalizedToken || normalizedToken.length > oneTimeTokenMaxLength) {
        return res.json({ valid: false, message: 'Invalid verification token' });
      }

      const verificationToken = await prisma.emailVerificationToken.findFirst({
        where: oneTimeTokenLookup(normalizedToken),
        include: { user: { select: { email: true, emailVerified: true } } },
      });

      if (!verificationToken) {
        return res.json({ valid: false, message: 'Invalid verification token' });
      }

      await upgradeLegacyEmailVerificationTokenStorage(
        prisma,
        verificationToken,
        normalizedToken,
        hashOneTimeToken,
      );

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
  emailVerificationRouter.post(
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

  return emailVerificationRouter;
}

import crypto from 'crypto';
import { Router } from 'express';
import type { Request } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';

import { generateToken } from '../../lib/auth.js';
import { sendMagicLinkEmail } from '../../lib/email.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { buildFrontendUrl } from '../../lib/runtimeConfig.js';
import { AuditAction } from '../../lib/auditLog.js';

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MAGIC_LINK_TOKEN_PURPOSE = 'magic_link';

type MagicLinkPrismaClient = Pick<PrismaClient, 'user' | 'passwordResetToken'>;

type OneTimeTokenLookup = (rawToken: string) => Prisma.PasswordResetTokenWhereInput;

type MagicLinkRoutesDependencies = {
  prisma: MagicLinkPrismaClient;
  normalizeEmailInput: (value: unknown) => string;
  normalizeOneTimeTokenInput: (value: unknown, fieldName?: string) => string;
  hashOneTimeToken: (token: string) => string;
  oneTimeTokenLookup: OneTimeTokenLookup;
  isMagicLinkToken: (token: string) => boolean;
  auditUserAuthEvent: (
    req: Request,
    userId: string,
    action: string,
    changes: Record<string, unknown>,
  ) => Promise<void>;
};

export function createMagicLinkRouter({
  prisma,
  normalizeEmailInput,
  normalizeOneTimeTokenInput,
  hashOneTimeToken,
  oneTimeTokenLookup,
  isMagicLinkToken,
  auditUserAuthEvent,
}: MagicLinkRoutesDependencies): Router {
  const magicLinkRouter = Router();

  // POST /api/auth/magic-link/request - Request a magic link login email (Feature #1005)
  magicLinkRouter.post(
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

      // Invalidate only existing magic-link tokens for this user.
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          purpose: MAGIC_LINK_TOKEN_PURPOSE,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      // Create new magic link token
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashOneTimeToken(`magic_${token}`), // Prefix remains in the emailed token only.
          purpose: MAGIC_LINK_TOKEN_PURPOSE,
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
  magicLinkRouter.post(
    '/magic-link/verify',
    asyncHandler(async (req, res) => {
      const token = normalizeOneTimeTokenInput(req.body.token);

      // Only accept magic_ prefixed tokens
      if (!isMagicLinkToken(token)) {
        throw AppError.badRequest('Invalid token format');
      }

      // Find the token
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: {
          ...oneTimeTokenLookup(token),
          purpose: MAGIC_LINK_TOKEN_PURPOSE,
        },
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

      const consumedAt = new Date();
      const consumeResult = await prisma.passwordResetToken.updateMany({
        where: {
          id: tokenRecord.id,
          usedAt: null,
          expiresAt: { gt: consumedAt },
        },
        data: { usedAt: consumedAt },
      });

      if (consumeResult.count !== 1) {
        throw AppError.badRequest('This link has already been used. Please request a new one.');
      }

      if (tokenRecord.user.twoFactorEnabled) {
        throw AppError.forbidden(
          'MFA-enabled accounts must sign in with email, password, and MFA code',
        );
      }

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

  return magicLinkRouter;
}

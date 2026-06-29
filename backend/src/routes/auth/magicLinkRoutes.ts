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
import { logError } from '../../lib/serverLogger.js';

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const MAGIC_LINK_TOKEN_PURPOSE = 'magic_link';

type MagicLinkPrismaClient = Pick<PrismaClient, 'user' | 'passwordResetToken'>;

type MagicLinkUserSetupState = {
  companyId: string | null;
  passwordHash: string | null;
  oauthProvider: string | null;
};

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

function normalizeMagicLinkRedirect(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, 'https://siteproof.local');
    if (parsed.origin !== 'https://siteproof.local') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function isPendingCompanyInviteSetup(user: MagicLinkUserSetupState): boolean {
  return Boolean(user.companyId && !user.passwordHash && !user.oauthProvider);
}

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
      const redirect = normalizeMagicLinkRedirect(req.body.redirect);

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          fullName: true,
          companyId: true,
          passwordHash: true,
          oauthProvider: true,
          twoFactorEnabled: true,
        },
      });

      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({
          message: 'If an account exists with this email, a login link has been sent.',
        });
      }

      if (isPendingCompanyInviteSetup(user)) {
        await prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            purpose: MAGIC_LINK_TOKEN_PURPOSE,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        return res.json({
          message: 'If an account exists with this email, a login link has been sent.',
        });
      }

      if (user.twoFactorEnabled) {
        await prisma.passwordResetToken.updateMany({
          where: {
            userId: user.id,
            purpose: MAGIC_LINK_TOKEN_PURPOSE,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

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
      const magicLinkToken = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashOneTimeToken(`magic_${token}`), // Prefix remains in the emailed token only.
          purpose: MAGIC_LINK_TOKEN_PURPOSE,
          expiresAt,
        },
      });

      const magicLinkParams = new URLSearchParams({ token: `magic_${token}` });
      if (redirect) {
        magicLinkParams.set('redirect', redirect);
      }
      const magicLinkUrl = buildFrontendUrl(`/auth/magic-link?${magicLinkParams.toString()}`);

      // Send magic link email
      try {
        const emailResult = await sendMagicLinkEmail({
          to: user.email,
          userName: user.fullName || undefined,
          magicLinkUrl,
          expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
        });

        if (!emailResult.success) {
          logError('[Magic Link] Failed to send email:', emailResult.error);
          await prisma.passwordResetToken.updateMany({
            where: { id: magicLinkToken.id, usedAt: null },
            data: { usedAt: new Date() },
          });

          return res.json({
            message: 'If an account exists with this email, a login link has been sent.',
          });
        }
      } catch (emailError) {
        logError('[Magic Link] Failed to send email:', emailError);
        await prisma.passwordResetToken.updateMany({
          where: { id: magicLinkToken.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        return res.json({
          message: 'If an account exists with this email, a login link has been sent.',
        });
      }

      await auditUserAuthEvent(req, user.id, AuditAction.MAGIC_LINK_REQUESTED, {
        method: 'magic_link',
        expiresInMinutes: MAGIC_LINK_EXPIRY_MINUTES,
        redirectPreserved: Boolean(redirect),
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
              oauthProvider: true,
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

      if (isPendingCompanyInviteSetup(tokenRecord.user)) {
        throw AppError.forbidden('Complete account setup before using magic link sign-in');
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

import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';

import { getTokenAuthTime, verifyPassword } from '../../lib/auth.js';
import { AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { assertCanRemoveUserFromProjectAdminRoles } from '../../lib/projectAdminInvariant.js';
import { removeStoredAvatar } from '../../lib/avatarStorage.js';
import { logWarn } from '../../lib/serverLogger.js';

type NormalizePasswordInput = (value: unknown, fieldName?: string) => string;

type CreateAccountDeletionRouterDependencies = {
  prisma: PrismaClient;
  normalizePasswordInput: NormalizePasswordInput;
};

const PASSWORDLESS_ACCOUNT_DELETE_MAX_TOKEN_AGE_MS = 5 * 60 * 1000;

function assertFreshPasswordlessDeletionSession(token: string) {
  const authTime = getTokenAuthTime(token);
  const now = Date.now();

  if (
    authTime === null ||
    authTime > now + 30 * 1000 ||
    now - authTime > PASSWORDLESS_ACCOUNT_DELETE_MAX_TOKEN_AGE_MS
  ) {
    throw AppError.forbidden('Please sign in again before deleting this passwordless account.');
  }
}

export function createAccountDeletionRouter({
  prisma,
  normalizePasswordInput,
}: CreateAccountDeletionRouterDependencies) {
  const accountDeletionRouter = Router();

  // GDPR Data Deletion endpoint
  accountDeletionRouter.delete(
    '/delete-account',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw AppError.unauthorized();
      }

      const token = authHeader.substring(7);
      const { verifyToken } = await import('../../lib/auth.js');
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
          avatarUrl: true,
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

      if (!user.passwordHash) {
        assertFreshPasswordlessDeletionSession(token);
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

        // 1. Preserve QA evidence while removing deleted-user attribution.
        await tx.iTPCompletion.updateMany({
          where: { completedById: userId },
          data: { completedById: null },
        });
        await tx.iTPCompletion.updateMany({
          where: { verifiedById: userId },
          data: { verifiedById: null },
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

      if (user.avatarUrl) {
        try {
          await removeStoredAvatar(user.avatarUrl, user.id);
        } catch (error) {
          logWarn('Failed to delete avatar file after account deletion:', error);
        }
      }

      res.json({
        success: true,
        message:
          'Your account has been permanently deleted. Project records that must be retained have been anonymised.',
      });
    }),
  );

  return accountDeletionRouter;
}

import { Router, type Request } from 'express';
import type { PrismaClient } from '@prisma/client';

import { getTokenAuthTime, hashPassword, verifyPassword, verifyToken } from '../../lib/auth.js';
import { AuditAction } from '../../lib/auditLog.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { revokeActiveApiKeysForUser } from '../../lib/apiKeyRevocation.js';

type PasswordValidation = {
  valid: boolean;
  errors: string[];
};

type CreateSessionRouterDependencies = {
  prisma: PrismaClient;
  auditUserAuthEvent: (
    req: Request,
    userId: string,
    action: string,
    changes: Record<string, unknown>,
  ) => Promise<void>;
};

type CreateSessionPasswordRouterDependencies = CreateSessionRouterDependencies & {
  normalizePasswordInput: (value: unknown, fieldName?: string) => string;
  validatePassword: (password: string) => PasswordValidation;
};

export function createSessionRouter({
  prisma,
  auditUserAuthEvent,
}: CreateSessionRouterDependencies) {
  const sessionRouter = Router();

  async function invalidateBearerSession(req: Request) {
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

    return { invalidatedAt, userId: user.userId };
  }

  // GET /api/auth/me
  sessionRouter.get(
    '/me',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw AppError.unauthorized();
      }

      const token = authHeader.substring(7);

      // Import verifyToken dynamically to avoid circular import
      const { verifyToken } = await import('../../lib/auth.js');
      const user = await verifyToken(token);

      if (!user) {
        throw AppError.unauthorized('Invalid token');
      }

      res.json({ user });
    }),
  );

  // POST /api/auth/logout
  sessionRouter.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const { invalidatedAt, userId } = await invalidateBearerSession(req);

      await auditUserAuthEvent(req, userId, AuditAction.USER_LOGOUT, {
        scope: 'all_devices',
        requestedScope: 'current_session',
        sessionsInvalidated: true,
      });

      res.json({
        message: 'Logged out successfully',
        loggedOutAt: invalidatedAt.toISOString(),
      });
    }),
  );

  // POST /api/auth/logout-all-devices - Invalidate all existing sessions
  sessionRouter.post(
    '/logout-all-devices',
    asyncHandler(async (req, res) => {
      const { invalidatedAt, userId } = await invalidateBearerSession(req);
      const apiKeyRevocation = await revokeActiveApiKeysForUser(prisma, userId);

      await auditUserAuthEvent(req, userId, AuditAction.USER_LOGOUT, {
        scope: 'all_devices',
        sessionsInvalidated: true,
        ...(apiKeyRevocation.count > 0 ? { apiAccessRevoked: apiKeyRevocation.count } : {}),
      });

      const now = invalidatedAt.toISOString();

      res.json({
        message: 'Successfully logged out from all devices',
        loggedOutAt: now,
      });
    }),
  );

  return sessionRouter;
}

export function createSessionPasswordRouter({
  prisma,
  normalizePasswordInput,
  validatePassword,
  auditUserAuthEvent,
}: CreateSessionPasswordRouterDependencies) {
  const sessionPasswordRouter = Router();

  // POST /api/auth/change-password - Change user password (requires current password)
  sessionPasswordRouter.post(
    '/change-password',
    asyncHandler(async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw AppError.unauthorized();
      }

      const token = authHeader.substring(7);

      // Import verifyToken dynamically to avoid circular import
      const { verifyToken } = await import('../../lib/auth.js');
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
      const apiKeyRevocation = await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: newPasswordHash,
            tokenInvalidatedAt: new Date(),
          },
        });

        return revokeActiveApiKeysForUser(tx, user.id);
      });

      await auditUserAuthEvent(req, user.id, AuditAction.PASSWORD_CHANGED, {
        method: 'password_change',
        sessionsInvalidated: true,
        ...(apiKeyRevocation.count > 0 ? { apiAccessRevoked: apiKeyRevocation.count } : {}),
      });

      res.json({ message: 'Password changed successfully' });
    }),
  );

  return sessionPasswordRouter;
}

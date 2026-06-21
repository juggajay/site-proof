import type { PrismaClient } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from '../../middleware/errorHandler.js';
import { removeStoredAvatar } from '../../lib/avatarStorage.js';
import { createAccountDeletionRouter } from './accountDeletionRoutes.js';

vi.mock('../../lib/auth.js', () => ({
  verifyPassword: vi.fn(() => true),
  verifyToken: vi.fn(async () => ({ userId: 'deleted-user-id' })),
}));

vi.mock('../../lib/projectAdminInvariant.js', () => ({
  assertCanRemoveUserFromProjectAdminRoles: vi.fn(),
}));

vi.mock('../../lib/avatarStorage.js', () => ({
  removeStoredAvatar: vi.fn(async () => undefined),
}));

describe('createAccountDeletionRouter', () => {
  it('anonymises ITP completion user references instead of deleting QA evidence', async () => {
    vi.mocked(removeStoredAvatar).mockClear();
    const tx = {
      auditLog: {
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      emailVerificationToken: {
        deleteMany: vi.fn(),
      },
      iTPCompletion: {
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      passwordResetToken: {
        deleteMany: vi.fn(),
      },
      projectUser: {
        deleteMany: vi.fn(),
      },
      user: {
        delete: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback) => callback(tx)),
      user: {
        findUnique: vi.fn(async () => ({
          id: 'deleted-user-id',
          email: 'delete-user@example.com',
          avatarUrl: '/uploads/avatars/avatar-deleted-user-id-owned.png',
          passwordHash: null,
          companyId: null,
          roleInCompany: null,
        })),
      },
    } as unknown as PrismaClient;

    const app = express();
    app.use(express.json());
    app.use(
      '/api/auth',
      createAccountDeletionRouter({
        prisma,
        normalizePasswordInput: (value) => String(value),
      }),
    );
    app.use(errorHandler);

    const res = await request(app)
      .delete('/api/auth/delete-account')
      .set('Authorization', 'Bearer valid-token')
      .send({ confirmEmail: 'delete-user@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe(
      'Your account has been permanently deleted. Project records that must be retained have been anonymised.',
    );
    expect(tx.iTPCompletion.deleteMany).not.toHaveBeenCalled();
    expect(tx.iTPCompletion.updateMany).toHaveBeenNthCalledWith(1, {
      where: { completedById: 'deleted-user-id' },
      data: { completedById: null },
    });
    expect(tx.iTPCompletion.updateMany).toHaveBeenNthCalledWith(2, {
      where: { verifiedById: 'deleted-user-id' },
      data: { verifiedById: null },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'deleted-user-id' } });
    expect(removeStoredAvatar).toHaveBeenCalledWith(
      '/uploads/avatars/avatar-deleted-user-id-owned.png',
      'deleted-user-id',
    );
  });
});

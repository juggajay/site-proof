import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const prisma = {
    holdPoint: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    holdPointReleaseToken: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    projectUser: {
      findMany: vi.fn(),
    },
  };

  return {
    prisma,
    createAuditLog: vi.fn(),
    sendHPChaseEmail: vi.fn(),
  };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mocks.prisma }));

vi.mock('../../middleware/authMiddleware.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      id: 'admin-user',
      userId: 'admin-user',
      email: 'admin@example.com',
      fullName: 'Admin User',
      roleInCompany: 'admin',
      role: 'admin',
      companyId: 'company-1',
    };
    next();
  },
}));

vi.mock('../../lib/email.js', () => ({
  sendHPChaseEmail: mocks.sendHPChaseEmail,
  sendHPReleaseConfirmationEmail: vi.fn(),
}));

vi.mock('../notifications.js', () => ({
  sendNotificationIfEnabled: vi.fn(),
}));

vi.mock('../../lib/auditLog.js', () => ({
  AuditAction: {
    HP_CHASED: 'HP_CHASED',
    HP_RELEASED: 'HP_RELEASED',
  },
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('./access.js', () => ({
  HP_REQUEST_ROLES: ['admin', 'project_manager', 'site_manager', 'foreman'],
  requireHoldPointReadAccess: vi.fn(),
  requireProjectRole: vi.fn(),
}));

vi.mock('./escalationRoutes.js', async () => {
  const { Router } = await import('express');
  return { holdPointEscalationRouter: Router() };
});

import { holdPointActionRouter } from './actionRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/holdpoints', holdPointActionRouter);

describe('hold point chase action route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.holdPoint.findUnique.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      description: 'Footing inspection',
      notificationSentAt: new Date('2026-06-01T00:00:00.000Z'),
      notificationSentTo: 'site-team@example.com',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      lot: {
        id: 'lot-1',
        lotNumber: 'LOT-1',
        projectId: 'project-1',
        project: {
          id: 'project-1',
          name: 'Bridge Upgrade',
          settings: null,
        },
      },
    });
    mocks.prisma.holdPoint.update.mockResolvedValue({
      id: 'hp-1',
      chaseCount: 2,
    });
    mocks.prisma.holdPointReleaseToken.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.holdPointReleaseToken.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.projectUser.findMany.mockResolvedValue([]);
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.sendHPChaseEmail.mockResolvedValue({ success: true });
  });

  it('renews an expired external token recipient with a public release link', async () => {
    const expiredTokenRecipient = {
      recipientEmail: 'external.super@example.com',
      recipientName: 'External Superintendent',
    };

    mocks.prisma.holdPointReleaseToken.findMany.mockImplementation(
      async (args: { where?: { expiresAt?: unknown } }) => {
        if (args.where?.expiresAt) {
          return [];
        }

        return [expiredTokenRecipient];
      },
    );

    const res = await request(app).post('/api/holdpoints/hp-1/chase');

    expect(res.status).toBe(200);
    expect(mocks.sendHPChaseEmail).toHaveBeenCalledOnce();

    const emailPayload = mocks.sendHPChaseEmail.mock.calls[0][0];
    expect(emailPayload.to).toBe('external.super@example.com');
    expect(emailPayload.releaseUrl).toMatch(/^http:\/\/localhost:5174\/hp-release\/[a-f0-9]{64}$/);
    expect(emailPayload.evidencePackageUrl).toBe(`${emailPayload.releaseUrl}#evidence-package`);
    expect(emailPayload.releaseUrl).not.toContain('/projects/');
    expect(emailPayload.evidencePackageUrl).not.toContain('/evidence-preview');

    const tokenCreatePayload = mocks.prisma.holdPointReleaseToken.createMany.mock.calls[0][0];
    expect(tokenCreatePayload.data).toHaveLength(1);
    expect(tokenCreatePayload.data[0]).toMatchObject({
      holdPointId: 'hp-1',
      recipientEmail: 'external.super@example.com',
      recipientName: 'External Superintendent',
    });
    expect(tokenCreatePayload.data[0].token).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(tokenCreatePayload.data[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(mocks.prisma.holdPointReleaseToken.deleteMany).toHaveBeenCalledWith({
      where: {
        holdPointId: 'hp-1',
        recipientEmail: 'external.super@example.com',
        usedAt: null,
        token: { not: tokenCreatePayload.data[0].token },
      },
    });
  });

  it('keeps old external tokens valid when the chase email send fails', async () => {
    mocks.prisma.holdPointReleaseToken.findMany.mockResolvedValue([
      {
        recipientEmail: 'external.super@example.com',
        recipientName: 'External Superintendent',
      },
    ]);
    mocks.sendHPChaseEmail.mockResolvedValue({ success: false, error: 'provider rejected' });

    const res = await request(app).post('/api/holdpoints/hp-1/chase');

    expect(res.status).toBe(200);
    expect(mocks.prisma.holdPointReleaseToken.createMany).toHaveBeenCalledOnce();
    expect(mocks.sendHPChaseEmail).toHaveBeenCalledOnce();
    expect(mocks.prisma.holdPointReleaseToken.deleteMany).not.toHaveBeenCalled();
  });
});

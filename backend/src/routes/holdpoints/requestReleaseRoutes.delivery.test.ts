import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    holdPoint: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    holdPointReleaseToken: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    iTPCompletion: {
      upsert: vi.fn(),
    },
    iTPCompletionAttachment: {
      createMany: vi.fn(),
    },
  };

  return {
    tx,
    prisma: {
      lot: { findUnique: vi.fn() },
      user: { findUnique: vi.fn() },
      projectUser: { findMany: vi.fn() },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
    sendHPReleaseRequestEmail: vi.fn(),
    createAuditLog: vi.fn(),
    requireLotReadAccess: vi.fn(),
    requireProjectRole: vi.fn(),
    requireSuperintendentApprovalRecipients: vi.fn(),
    emitHoldPointWebhookEvent: vi.fn(),
  };
});

vi.mock('../../lib/prisma.js', () => ({ prisma: mocks.prisma }));

vi.mock('../../lib/email.js', () => ({
  sendHPReleaseRequestEmail: mocks.sendHPReleaseRequestEmail,
}));

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

vi.mock('../../lib/auditLog.js', () => ({
  AuditAction: {
    HP_RELEASE_REQUESTED: 'hp_release_requested',
  },
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('./access.js', () => ({
  HP_REQUEST_ROLES: ['admin'],
  requireLotReadAccess: mocks.requireLotReadAccess,
  requireProjectRole: mocks.requireProjectRole,
}));

vi.mock('./superintendentRecipients.js', () => ({
  requireSuperintendentApprovalRecipients: mocks.requireSuperintendentApprovalRecipients,
}));

vi.mock('./webhookEvents.js', () => ({
  emitHoldPointWebhookEvent: mocks.emitHoldPointWebhookEvent,
}));

import { errorHandler } from '../../middleware/errorHandler.js';
import { holdPointRequestReleaseRouter } from './requestReleaseRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/holdpoints', holdPointRequestReleaseRouter);
app.use(errorHandler);

function releaseReadyLot() {
  return {
    id: 'lot-1',
    projectId: 'project-1',
    lotNumber: 'LOT-1',
    project: {
      id: 'project-1',
      name: 'Bridge Upgrade',
      settings: null,
      workingDays: '1,2,3,4,5',
    },
    itpInstance: {
      id: 'itp-1',
      template: {
        checklistItems: [
          {
            id: 'item-1',
            description: 'Footing inspection',
            pointType: 'hold_point',
            responsibleParty: 'contractor',
            sequenceNumber: 1,
          },
        ],
      },
      completions: [],
    },
    holdPoints: [
      {
        id: 'hp-1',
        status: 'pending',
      },
    ],
  };
}

describe('hold point request-release delivery failure', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.lot.findUnique.mockResolvedValue(releaseReadyLot());
    mocks.prisma.user.findUnique.mockResolvedValue({
      fullName: 'Admin User',
      email: 'admin@example.com',
    });
    mocks.requireProjectRole.mockResolvedValue('admin');
    mocks.requireSuperintendentApprovalRecipients.mockImplementation(
      async (_projectId, _settings, recipients) => recipients,
    );
    mocks.tx.holdPoint.update.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      itpChecklistItem: { id: 'item-1' },
    });
    mocks.tx.holdPoint.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.holdPoint.findUnique.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      itpChecklistItem: { id: 'item-1' },
    });
    mocks.tx.holdPoint.create.mockResolvedValue({
      id: 'hp-created',
      status: 'notified',
      itpChecklistItem: { id: 'item-1' },
    });
    mocks.tx.holdPointReleaseToken.deleteMany.mockResolvedValue({ count: 1 });
    mocks.tx.holdPointReleaseToken.createMany.mockResolvedValue({ count: 1 });
    mocks.tx.document.findMany.mockResolvedValue([]);
    mocks.tx.iTPCompletion.upsert.mockResolvedValue({ id: 'completion-1' });
    mocks.tx.iTPCompletionAttachment.createMany.mockResolvedValue({ count: 0 });
    mocks.sendHPReleaseRequestEmail.mockResolvedValue({
      success: true,
      messageId: 'mock-message',
      provider: 'mock',
    });
  });

  it('returns 502 but still audits the committed request when every email delivery fails', async () => {
    mocks.sendHPReleaseRequestEmail.mockResolvedValueOnce({
      success: false,
      error: 'Resend rejected the message',
      provider: 'resend',
    });

    const res = await request(app).post('/api/holdpoints/request-release').send({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      notificationSentTo: 'superintendent@example.com',
    });

    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe('Failed to send hold point release request email');
    expect(mocks.sendHPReleaseRequestEmail).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog.mock.calls[0][0].changes.emailDelivery).toEqual({
      sent: 0,
      failed: 1,
    });
  });

  it('returns success with a delivery warning when at least one committed release link was emailed', async () => {
    const events: string[] = [];
    mocks.prisma.$transaction.mockImplementationOnce(async (callback) => {
      events.push('transaction:start');
      const result = await callback(mocks.tx);
      events.push('transaction:commit');
      return result;
    });
    mocks.sendHPReleaseRequestEmail.mockImplementation(async ({ to }: { to: string }) => {
      events.push(`email:${to}`);
      if (to === 'second@example.com') {
        return {
          success: false,
          error: 'Resend rejected the second message',
          provider: 'resend',
        };
      }

      return {
        success: true,
        messageId: `mock-${to}`,
        provider: 'mock',
      };
    });

    const res = await request(app).post('/api/holdpoints/request-release').send({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      notificationSentTo: 'first@example.com, second@example.com',
    });

    expect(res.status).toBe(200);
    expect(res.body.emailDelivery).toEqual({
      sent: 1,
      failed: 1,
      warning: 'Some release request emails could not be sent.',
    });
    expect(events).toEqual([
      'transaction:start',
      'transaction:commit',
      'email:first@example.com',
      'email:second@example.com',
    ]);
    expect(mocks.tx.holdPointReleaseToken.createMany).toHaveBeenCalledOnce();
    expect(mocks.sendHPReleaseRequestEmail).toHaveBeenCalledTimes(2);
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog.mock.calls[0][0].changes.emailDelivery).toEqual({
      sent: 1,
      failed: 1,
    });
  });

  it('uses the secure external release link as the primary email CTA', async () => {
    const res = await request(app).post('/api/holdpoints/request-release').send({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      notificationSentTo: 'superintendent@example.com',
    });

    expect(res.status).toBe(200);
    expect(mocks.sendHPReleaseRequestEmail).toHaveBeenCalledOnce();
    const emailPayload = mocks.sendHPReleaseRequestEmail.mock.calls[0][0];
    expect(emailPayload.releaseUrl).toMatch(/^http:\/\/localhost:5174\/hp-release\/[a-f0-9]{64}$/);
    expect(emailPayload.evidencePackageUrl).toBe(`${emailPayload.releaseUrl}#evidence-package`);
    expect(emailPayload.releaseUrl).not.toContain('/projects/');
    expect(emailPayload.secureReleaseUrl).toBeUndefined();
  });

  it('attaches request evidence documents inside the committed request transaction', async () => {
    mocks.tx.document.findMany.mockResolvedValueOnce([{ id: 'doc-1' }, { id: 'doc-2' }]);
    mocks.tx.iTPCompletionAttachment.createMany.mockResolvedValueOnce({ count: 2 });

    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .send({
        lotId: 'lot-1',
        itpChecklistItemId: 'item-1',
        notificationSentTo: 'superintendent@example.com',
        evidenceDocumentIds: ['doc-1', 'doc-2', 'doc-1'],
      });

    expect(res.status).toBe(200);
    expect(mocks.tx.document.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['doc-1', 'doc-2'] },
        projectId: 'project-1',
        lotId: 'lot-1',
      },
      select: { id: true },
    });
    expect(mocks.tx.iTPCompletion.upsert).toHaveBeenCalledWith({
      where: {
        itpInstanceId_checklistItemId: {
          itpInstanceId: 'itp-1',
          checklistItemId: 'item-1',
        },
      },
      update: {},
      create: {
        itpInstanceId: 'itp-1',
        checklistItemId: 'item-1',
        status: 'pending',
      },
      select: { id: true },
    });
    expect(mocks.tx.iTPCompletionAttachment.createMany).toHaveBeenCalledWith({
      data: [
        { completionId: 'completion-1', documentId: 'doc-1' },
        { completionId: 'completion-1', documentId: 'doc-2' },
      ],
      skipDuplicates: true,
    });
  });

  it('does not re-notify a hold point that becomes released before the transaction writes', async () => {
    mocks.tx.holdPoint.updateMany.mockResolvedValueOnce({ count: 0 });
    mocks.tx.holdPoint.findUnique.mockResolvedValueOnce({
      id: 'hp-1',
      status: 'released',
      itpChecklistItem: { id: 'item-1' },
    });

    const res = await request(app).post('/api/holdpoints/request-release').send({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      notificationSentTo: 'superintendent@example.com',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('This hold point has already been released.');
    expect(mocks.tx.holdPointReleaseToken.deleteMany).not.toHaveBeenCalled();
    expect(mocks.tx.holdPointReleaseToken.createMany).not.toHaveBeenCalled();
    expect(mocks.sendHPReleaseRequestEmail).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
});

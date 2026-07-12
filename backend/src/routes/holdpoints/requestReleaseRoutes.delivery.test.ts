import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    holdPoint: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    holdPointReleaseToken: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    holdPointReleaseBatch: {
      create: vi.fn(),
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
    sendEmail: vi.fn(),
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
  sendEmail: mocks.sendEmail,
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

function releaseReadyBatchLot() {
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
          {
            id: 'item-2',
            description: 'Deck pour inspection',
            pointType: 'hold_point',
            responsibleParty: 'contractor',
            sequenceNumber: 2,
          },
        ],
      },
      completions: [
        {
          checklistItemId: 'item-1',
          status: 'completed',
          completedAt: new Date('2026-07-01T00:00:00.000Z'),
        },
      ],
    },
    holdPoints: [
      {
        id: 'hp-1',
        itpChecklistItemId: 'item-1',
        status: 'pending',
      },
    ],
  };
}

function expectSuccessfulTwoItemBatchResponse(res: {
  status: number;
  body: { holdPoints: unknown[] };
}) {
  expect(res.status).toBe(200);
  expect(res.body.holdPoints).toEqual([
    expect.objectContaining({ id: 'hp-1' }),
    expect.objectContaining({ id: 'hp-created-2' }),
  ]);
  expect(mocks.tx.holdPointReleaseToken.createMany).toHaveBeenCalledTimes(2);
  // Every per-hold-point token is linked to the batch it belongs to.
  for (const call of mocks.tx.holdPointReleaseToken.createMany.mock.calls) {
    expect(call[0].data[0]).toMatchObject({ batchId: 'batch-1' });
  }
  expect(mocks.sendEmail).toHaveBeenCalledOnce();
  expect(mocks.sendEmail.mock.calls[0][0].text).toContain('Footing inspection');
  expect(mocks.sendEmail.mock.calls[0][0].text).toContain('Deck pour inspection');
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
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'lot-1' }]);
    mocks.tx.holdPoint.update.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      itpChecklistItem: { id: 'item-1' },
    });
    mocks.tx.holdPoint.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.holdPoint.findFirst.mockResolvedValue({ id: 'hp-1' });
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
    mocks.tx.holdPointReleaseBatch.create.mockResolvedValue({ id: 'batch-1' });
    mocks.tx.document.findMany.mockResolvedValue([]);
    mocks.tx.iTPCompletion.upsert.mockResolvedValue({ id: 'completion-1' });
    mocks.tx.iTPCompletionAttachment.createMany.mockResolvedValue({ count: 0 });
    mocks.sendHPReleaseRequestEmail.mockResolvedValue({
      success: true,
      messageId: 'mock-message',
      provider: 'mock',
    });
    mocks.sendEmail.mockResolvedValue({
      success: true,
      messageId: 'mock-batch-message',
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

  it('prevents a second concurrent request from creating a duplicate hold point / token / email', async () => {
    mocks.prisma.lot.findUnique.mockResolvedValueOnce({
      ...releaseReadyLot(),
      holdPoints: [],
    });
    mocks.tx.holdPoint.findFirst.mockResolvedValueOnce({ id: 'hp-1' });

    const res = await request(app).post('/api/holdpoints/request-release').send({
      lotId: 'lot-1',
      itpChecklistItemId: 'item-1',
      notificationSentTo: 'superintendent@example.com',
    });

    expect(res.status).toBe(409);
    expect(mocks.tx.$queryRaw).toHaveBeenCalled();
    expect(mocks.tx.holdPoint.create).not.toHaveBeenCalled();
    expect(mocks.tx.holdPointReleaseToken.createMany).not.toHaveBeenCalled();
    expect(mocks.sendHPReleaseRequestEmail).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('sends one consolidated batch email while preserving per-hold-point rows, tokens, audits, and evidence', async () => {
    mocks.prisma.lot.findUnique.mockResolvedValueOnce(releaseReadyBatchLot());
    mocks.tx.holdPoint.findUnique
      .mockResolvedValueOnce({
        id: 'hp-1',
        status: 'notified',
        itpChecklistItem: { id: 'item-1' },
      })
      .mockResolvedValueOnce({
        id: 'hp-created-2',
        status: 'notified',
        itpChecklistItem: { id: 'item-2' },
      });
    mocks.tx.holdPoint.create.mockResolvedValueOnce({
      id: 'hp-created-2',
      status: 'notified',
      description: 'Deck pour inspection',
      itpChecklistItemId: 'item-2',
      itpChecklistItem: { id: 'item-2' },
    });
    mocks.tx.document.findMany.mockImplementation(async (args) => {
      const ids = (args.where?.id as { in?: string[] } | undefined)?.in ?? [];
      return ids.map((id) => ({ id }));
    });
    mocks.tx.iTPCompletion.upsert.mockImplementation(async (args) => {
      const itemId = args.where?.itpInstanceId_checklistItemId?.checklistItemId;
      return { id: `completion-${itemId}` };
    });

    const res = await request(app)
      .post('/api/holdpoints/request-release/batch')
      .send({
        lotId: 'lot-1',
        items: [
          { itpChecklistItemId: 'item-1', evidenceDocumentIds: ['doc-item-1'] },
          { itpChecklistItemId: 'item-2' },
        ],
        sharedEvidenceDocumentIds: ['doc-shared'],
        // Dynamic future date: the route enforces a minimum working-day notice
        // period from "now", so a hardcoded date becomes a time bomb the day
        // the calendar catches up to it (this one failed on 2026-07-10).
        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        scheduledTime: '09:30',
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Site Reviewer',
      });

    expectSuccessfulTwoItemBatchResponse(res);
    expect(mocks.tx.holdPointReleaseToken.createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(mocks.tx.holdPointReleaseToken.createMany.mock.calls[1][0].data).toHaveLength(1);
    expect(mocks.tx.iTPCompletionAttachment.createMany).toHaveBeenCalledWith({
      data: [
        { completionId: 'completion-item-1', documentId: 'doc-shared' },
        { completionId: 'completion-item-1', documentId: 'doc-item-1' },
      ],
      skipDuplicates: true,
    });
    expect(mocks.tx.iTPCompletionAttachment.createMany).toHaveBeenCalledWith({
      data: [{ completionId: 'completion-item-2', documentId: 'doc-shared' }],
      skipDuplicates: true,
    });
    expect(mocks.createAuditLog).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'reviewer@example.com',
      subject: '[CIVOS] Bridge Upgrade: 2 hold points ready for release review — Lot LOT-1',
    });
    // One secure batch link, no per-hold-point secure links.
    expect(mocks.tx.holdPointReleaseBatch.create).toHaveBeenCalledOnce();
    const batchEmailText = mocks.sendEmail.mock.calls[0][0].text as string;
    const batchEmailHtml = mocks.sendEmail.mock.calls[0][0].html as string;
    expect(batchEmailText).toContain('/hp-release/batch/');
    // No per-hold-point /hp-release/<64hex> secure links (batch links are
    // /hp-release/batch/<hex> and do not match this pattern).
    expect(batchEmailHtml.match(/\/hp-release\/[a-f0-9]{64}/g)).toBeNull();
    expect(batchEmailText.match(/\/hp-release\/[a-f0-9]{64}/g)).toBeNull();
    expect(mocks.sendHPReleaseRequestEmail).not.toHaveBeenCalled();
  });

  it('allows a batch review package to include hold points with incomplete preceding checklist items', async () => {
    mocks.prisma.lot.findUnique.mockResolvedValueOnce({
      ...releaseReadyBatchLot(),
      itpInstance: {
        ...releaseReadyBatchLot().itpInstance,
        completions: [],
      },
    });
    mocks.tx.holdPoint.findUnique.mockReset();
    mocks.tx.holdPoint.findUnique.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      itpChecklistItem: { id: 'item-1' },
    });
    mocks.tx.holdPoint.create.mockResolvedValueOnce({
      id: 'hp-created-2',
      status: 'notified',
      description: 'Deck pour inspection',
      itpChecklistItemId: 'item-2',
      itpChecklistItem: { id: 'item-2' },
    });

    const res = await request(app)
      .post('/api/holdpoints/request-release/batch')
      .send({
        lotId: 'lot-1',
        items: [{ itpChecklistItemId: 'item-1' }, { itpChecklistItemId: 'item-2' }],
        recipientEmail: 'reviewer@example.com',
        recipientName: 'Site Reviewer',
      });

    expectSuccessfulTwoItemBatchResponse(res);
  });

  it('rejects a batch when any selected hold point is already released before writing tokens', async () => {
    mocks.prisma.lot.findUnique.mockResolvedValueOnce({
      ...releaseReadyBatchLot(),
      holdPoints: [
        { id: 'hp-1', itpChecklistItemId: 'item-1', status: 'pending' },
        { id: 'hp-2', itpChecklistItemId: 'item-2', status: 'released' },
      ],
    });

    const res = await request(app)
      .post('/api/holdpoints/request-release/batch')
      .send({
        lotId: 'lot-1',
        items: [{ itpChecklistItemId: 'item-1' }, { itpChecklistItemId: 'item-2' }],
        recipientEmail: 'reviewer@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('This hold point has already been released.');
    expect(mocks.tx.holdPointReleaseToken.createMany).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('rejects duplicate hold point items in a batch before loading the lot', async () => {
    const res = await request(app)
      .post('/api/holdpoints/request-release/batch')
      .send({
        lotId: 'lot-1',
        items: [{ itpChecklistItemId: 'item-1' }, { itpChecklistItemId: ' item-1 ' }],
        recipientEmail: 'reviewer@example.com',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Validation failed');
    expect(mocks.prisma.lot.findUnique).not.toHaveBeenCalled();
    expect(mocks.tx.holdPointReleaseToken.createMany).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('reports a saved batch request clearly when the consolidated email fails after commit', async () => {
    mocks.prisma.lot.findUnique.mockResolvedValueOnce(releaseReadyBatchLot());
    mocks.tx.holdPoint.findUnique.mockResolvedValueOnce({
      id: 'hp-1',
      status: 'notified',
      itpChecklistItem: { id: 'item-1' },
    });
    mocks.sendEmail.mockResolvedValueOnce({
      success: false,
      error: 'Resend rejected the batch email',
      provider: 'resend',
    });

    const res = await request(app)
      .post('/api/holdpoints/request-release/batch')
      .send({
        lotId: 'lot-1',
        items: [{ itpChecklistItemId: 'item-1' }],
        recipientEmail: 'reviewer@example.com',
      });

    expect(res.status).toBe(502);
    expect(res.body.error.message).toBe(
      'Batch release request was saved but the consolidated email could not be sent.',
    );
    expect(res.body.error.details).toEqual({
      requestCreated: true,
      emailDelivery: { sent: 0, failed: 1 },
    });
    expect(mocks.tx.holdPointReleaseToken.createMany).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog).toHaveBeenCalledOnce();
    expect(mocks.createAuditLog.mock.calls[0][0].changes.emailDelivery).toEqual({
      sent: 0,
      failed: 1,
    });
  });
});

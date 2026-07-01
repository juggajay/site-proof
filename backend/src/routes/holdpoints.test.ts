import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { AuditAction, parseAuditLogChanges } from '../lib/auditLog.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { holdpointsRouter } from './holdpoints.js';
import { clearEmailQueue, getQueuedEmails } from '../lib/email.js';
import { registerTestUser as registerSharedTestUser } from '../test/routeTestHarness.js';
import { buildTemplateSnapshot } from './itp/helpers/templateSnapshot.js';
import { projectTimeZoneFromState, zonedWallClockToUtc } from '../lib/projectTimeZone.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const TEST_PASSWORD = 'SecureP@ssword123!';

function hashHoldPointReleaseTokenForTest(token: string): string {
  return `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

async function registerTestUser(fullName: string, roleInCompany: string, companyId: string | null) {
  return registerSharedTestUser(app, {
    fullName,
    roleInCompany,
    companyId,
    password: TEST_PASSWORD,
  });
}

async function cleanupTestUser(userId: string) {
  await prisma.projectUser.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

type WebhookDeliveryForTest = Awaited<ReturnType<typeof prisma.webhookDelivery.findMany>>[number];

function deliveryPayloadContains(delivery: WebhookDeliveryForTest, value: string) {
  return JSON.stringify(delivery.payload).includes(value);
}

async function waitForWebhookDeliveries(
  webhookId: string,
  expectedCount: number,
  matcher?: (delivery: WebhookDeliveryForTest) => boolean,
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { deliveredAt: 'asc' },
    });

    if (deliveries.length >= expectedCount && (!matcher || deliveries.some(matcher))) {
      return deliveries;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { deliveredAt: 'asc' },
  });
}

describe('Hold Points API', () => {
  let authToken: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let templateId: string;
  let lotId: string;
  let checklistItemId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `HP Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const primaryUser = await registerTestUser('HP Test User', 'admin', companyId);
    authToken = primaryUser.token;
    userId = primaryUser.userId;

    const project = await prisma.project.create({
      data: {
        name: `HP Test Project ${Date.now()}`,
        projectNumber: `HP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId, role: 'admin', status: 'active' },
    });

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Hold Point Test Template',
        activityType: 'Earthworks',
      },
    });
    templateId = template.id;

    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'Hold Point Item',
        pointType: 'hold_point',
        sequenceNumber: 1,
      },
    });
    checklistItemId = checklistItem.id;

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `HP-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId,
        status: 'not_started',
      },
    });
  });

  afterAll(async () => {
    await prisma.holdPointReleaseToken.deleteMany({
      where: { holdPoint: { itpChecklistItem: { templateId } } },
    });
    await prisma.holdPoint.deleteMany({ where: { itpChecklistItem: { templateId } } });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId } } });
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  describe('GET /api/holdpoints/project/:projectId', () => {
    it('should list hold points for project', async () => {
      const res = await request(app)
        .get(`/api/holdpoints/project/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.holdPoints).toBeDefined();
      expect(Array.isArray(res.body.holdPoints)).toBe(true);
    });

    it('returns the bounded full register in one response when all=true', async () => {
      const res = await request(app)
        .get(`/api/holdpoints/project/${projectId}?all=true`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.holdPoints).toBeDefined();
      expect(Array.isArray(res.body.holdPoints)).toBe(true);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 5000,
        hasNextPage: false,
      });
    });
  });

  describe('GET /api/holdpoints/lot/:lotId/item/:itemId', () => {
    it('should get hold point for specific lot and item', async () => {
      const res = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it('uses the assigned ITP snapshot for detail and evidence after live template edits', async () => {
      const template = await prisma.iTPTemplate.create({
        data: {
          projectId,
          name: 'Snapshot Hold Point Template',
          activityType: 'Earthworks',
          checklistItems: {
            create: [
              {
                sequenceNumber: 1,
                description: 'Snapshot prerequisite',
                pointType: 'standard',
                responsibleParty: 'contractor',
              },
              {
                sequenceNumber: 2,
                description: 'Snapshot hold point',
                pointType: 'hold_point',
                responsibleParty: 'contractor',
              },
            ],
          },
        },
        include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
      });
      const snapshot = buildTemplateSnapshot(template);
      const snapshotHoldPointItem = template.checklistItems[1];

      const snapshotLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `HP-SNAPSHOT-${Date.now()}`,
          status: 'not_started',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      await prisma.iTPInstance.create({
        data: {
          templateId: template.id,
          lotId: snapshotLot.id,
          templateSnapshot: JSON.stringify(snapshot),
          status: 'not_started',
        },
      });
      const holdPoint = await prisma.holdPoint.create({
        data: {
          lotId: snapshotLot.id,
          itpChecklistItemId: snapshotHoldPointItem.id,
          pointType: 'hold_point',
          description: 'Snapshot hold point',
          status: 'pending',
        },
      });

      await prisma.iTPTemplate.update({
        where: { id: template.id },
        data: { name: 'Live Template After Assignment' },
      });
      await prisma.iTPChecklistItem.update({
        where: { id: snapshotHoldPointItem.id },
        data: { description: 'Live mutated hold point' },
      });
      const liveOnlyHoldPoint = await prisma.iTPChecklistItem.create({
        data: {
          templateId: template.id,
          sequenceNumber: 3,
          description: 'Live-only hold point',
          pointType: 'hold_point',
          responsibleParty: 'contractor',
        },
      });

      const detailRes = await request(app)
        .get(`/api/holdpoints/lot/${snapshotLot.id}/item/${snapshotHoldPointItem.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.holdPoint.description).toBe('Snapshot hold point');

      const liveOnlyDetailRes = await request(app)
        .get(`/api/holdpoints/lot/${snapshotLot.id}/item/${liveOnlyHoldPoint.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(liveOnlyDetailRes.status).toBe(404);

      const liveOnlyRequestRes = await request(app)
        .post('/api/holdpoints/request-release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lotId: snapshotLot.id,
          itpChecklistItemId: liveOnlyHoldPoint.id,
          notificationSentTo: 'snapshot-reviewer@example.com',
        });

      expect(liveOnlyRequestRes.status).toBe(400);
      expect(liveOnlyRequestRes.body.error.message).toContain('Item is not release-gated');

      const evidenceRes = await request(app)
        .get(`/api/holdpoints/${holdPoint.id}/evidence-package`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(evidenceRes.status).toBe(200);
      expect(evidenceRes.body.evidencePackage.itpTemplate.name).toBe(
        'Snapshot Hold Point Template',
      );
      expect(evidenceRes.body.evidencePackage.checklist).toEqual(
        expect.arrayContaining([expect.objectContaining({ description: 'Snapshot hold point' })]),
      );
      expect(JSON.stringify(evidenceRes.body.evidencePackage.checklist)).not.toContain(
        'Live mutated hold point',
      );
      expect(JSON.stringify(evidenceRes.body.evidencePackage.checklist)).not.toContain(
        'Live-only hold point',
      );
    });
  });

  describe('Route parameter validation', () => {
    it('should reject oversized hold point route parameters before lookups', async () => {
      const longId = 'h'.repeat(121);
      const longToken = 't'.repeat(513);
      const checks = [
        {
          label: 'GET project hold points',
          response: await request(app)
            .get(`/api/holdpoints/project/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET project working hours',
          response: await request(app)
            .get(`/api/holdpoints/project/${longId}/working-hours`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET lot item lotId',
          response: await request(app)
            .get(`/api/holdpoints/lot/${longId}/item/${checklistItemId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET lot item itemId',
          response: await request(app)
            .get(`/api/holdpoints/lot/${lotId}/item/${longId}`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST release',
          response: await request(app)
            .post(`/api/holdpoints/${longId}/release`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ releasedByName: 'HP Test User' }),
        },
        {
          label: 'POST chase',
          response: await request(app)
            .post(`/api/holdpoints/${longId}/chase`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'POST escalate',
          response: await request(app)
            .post(`/api/holdpoints/${longId}/escalate`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({}),
        },
        {
          label: 'POST resolve escalation',
          response: await request(app)
            .post(`/api/holdpoints/${longId}/resolve-escalation`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET evidence package',
          response: await request(app)
            .get(`/api/holdpoints/${longId}/evidence-package`)
            .set('Authorization', `Bearer ${authToken}`),
        },
        {
          label: 'GET public token',
          response: await request(app).get(`/api/holdpoints/public/${longToken}`),
        },
        {
          label: 'POST public token release',
          response: await request(app)
            .post(`/api/holdpoints/public/${longToken}/release`)
            .send({ releasedByName: 'HP Test User' }),
        },
      ];

      for (const { label, response } of checks) {
        expect(response.status, label).toBe(400);
        expect(response.body.error.message, label).toContain('is too long');
      }
    });
  });

  describe('POST /api/holdpoints/request-release', () => {
    async function createRequestReleaseLot(label: string) {
      const lot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `HP-REQUEST-${label}-${Date.now()}`,
          status: 'in_progress',
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });

      await prisma.iTPInstance.create({
        data: {
          templateId,
          lotId: lot.id,
          status: 'in_progress',
        },
      });

      return lot;
    }

    async function createRequestEvidenceDocument(
      documentLotId: string,
      filename = 'request-release-evidence.pdf',
    ) {
      return prisma.document.create({
        data: {
          projectId,
          lotId: documentLotId,
          uploadedById: userId,
          filename,
          fileUrl: `/uploads/documents/${filename}`,
          mimeType: 'application/pdf',
          fileSize: 1234,
          documentType: 'hold_point_request_evidence',
          category: 'itp_evidence',
        },
      });
    }

    async function cleanupRequestReleaseLot(lotIdToDelete: string, holdPointIdToDelete?: string) {
      if (holdPointIdToDelete) {
        await prisma.holdPointReleaseToken.deleteMany({
          where: { holdPointId: holdPointIdToDelete },
        });
        await prisma.holdPoint.delete({ where: { id: holdPointIdToDelete } }).catch(() => {});
      }
      await prisma.iTPInstance.deleteMany({ where: { lotId: lotIdToDelete } });
      await prisma.lot.delete({ where: { id: lotIdToDelete } }).catch(() => {});
    }

    async function createTerminalHoldPoint(status: 'released' | 'completed') {
      const lot = await createRequestReleaseLot(status);
      const holdPoint = await prisma.holdPoint.create({
        data: {
          lotId: lot.id,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          description: `${status} hold point`,
          status,
          notificationSentAt: new Date('2026-01-19T00:00:00.000Z'),
          notificationSentTo: 'old-reviewer@example.com',
          scheduledDate: new Date('2026-01-20T00:00:00.000Z'),
          scheduledTime: '09:30',
          releasedAt: status === 'released' ? new Date('2026-01-20T02:00:00.000Z') : null,
          releasedByName: status === 'released' ? 'Original Reviewer' : null,
          releaseNotes: 'Existing terminal state',
        },
      });

      await prisma.holdPointReleaseToken.create({
        data: {
          holdPointId: holdPoint.id,
          token: hashHoldPointReleaseTokenForTest(`terminal-${status}-${Date.now()}`),
          recipientEmail: 'old-reviewer@example.com',
          recipientName: 'Old Reviewer',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });

      return { lot, holdPoint };
    }

    it('rejects release requests for terminal hold points without changing state or tokens', async () => {
      for (const status of ['released', 'completed'] as const) {
        clearEmailQueue();
        const { lot, holdPoint } = await createTerminalHoldPoint(status);

        try {
          const res = await request(app)
            .post('/api/holdpoints/request-release')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              lotId: lot.id,
              itpChecklistItemId: checklistItemId,
              notificationSentTo: 'new-reviewer@example.com',
            });

          expect(res.status, status).toBe(400);
          expect(res.body.error.message, status).toContain(
            status === 'released' ? 'already been released' : 'already been completed',
          );

          const unchangedHoldPoint = await prisma.holdPoint.findUniqueOrThrow({
            where: { id: holdPoint.id },
          });
          expect(unchangedHoldPoint.status, status).toBe(status);
          expect(unchangedHoldPoint.notificationSentTo, status).toBe('old-reviewer@example.com');
          expect(unchangedHoldPoint.scheduledTime, status).toBe('09:30');
          expect(unchangedHoldPoint.releaseNotes, status).toBe('Existing terminal state');

          const tokens = await prisma.holdPointReleaseToken.findMany({
            where: { holdPointId: holdPoint.id },
          });
          expect(tokens, status).toHaveLength(1);
          expect(tokens[0].recipientEmail, status).toBe('old-reviewer@example.com');
          expect(getQueuedEmails(), status).toHaveLength(0);
        } finally {
          await cleanupRequestReleaseLot(lot.id, holdPoint.id);
        }
      }
    });

    it('rejects release requests with no valid recipient before creating hold point state', async () => {
      clearEmailQueue();
      const lot = await createRequestReleaseLot('no-recipient');

      try {
        const res = await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            lotId: lot.id,
            itpChecklistItemId: checklistItemId,
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('At least one valid hold point release recipient');

        const holdPoint = await prisma.holdPoint.findFirst({
          where: { lotId: lot.id, itpChecklistItemId: checklistItemId },
        });
        expect(holdPoint).toBeNull();
        expect(getQueuedEmails()).toHaveLength(0);
      } finally {
        await cleanupRequestReleaseLot(lot.id);
      }
    });

    it('triggers a hold point release-request webhook after committing tokens', async () => {
      clearEmailQueue();
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => Promise.resolve(new Response('accepted', { status: 200 })));
      const webhook = await prisma.webhookConfig.create({
        data: {
          companyId,
          url: 'https://example.com/siteproof-hold-point-events',
          secret: 'test-webhook-secret',
          events: JSON.stringify(['hold_point.release_requested']),
          enabled: true,
          createdById: userId,
        },
      });
      const lot = await createRequestReleaseLot('webhook-requested');
      let holdPointIdToDelete: string | undefined;

      try {
        const res = await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            lotId: lot.id,
            itpChecklistItemId: checklistItemId,
            notificationSentTo: 'webhook-reviewer@example.com',
          });

        expect(res.status).toBe(200);
        holdPointIdToDelete = res.body.holdPoint.id;

        const deliveries = await waitForWebhookDeliveries(webhook.id, 1, (delivery) =>
          Boolean(delivery.success && deliveryPayloadContains(delivery, holdPointIdToDelete ?? '')),
        );
        const delivery = deliveries.find((item) =>
          Boolean(item.success && deliveryPayloadContains(item, holdPointIdToDelete ?? '')),
        );
        expect(delivery).toBeDefined();
        expect(delivery).toMatchObject({
          event: 'hold_point.release_requested',
          success: true,
          responseStatus: 200,
        });
        expect(delivery?.payload).toMatchObject({
          event: 'hold_point.release_requested',
          data: {
            holdPointId: holdPointIdToDelete,
            projectId,
            lotId: lot.id,
            lotNumber: lot.lotNumber,
            itpChecklistItemId: checklistItemId,
            status: 'notified',
            actorUserId: userId,
            action: 'release_requested',
            recipientCount: 1,
            emailDelivery: {
              sent: 1,
              failed: 0,
            },
            noticePeriodOverride: false,
          },
        });
        const serializedPayload = JSON.stringify(delivery?.payload);
        expect(serializedPayload).not.toContain('webhook-reviewer@example.com');
        expect(serializedPayload).not.toContain('/hp-release/');
        expect(serializedPayload).not.toContain('sha256:');
        expect(fetchMock).toHaveBeenCalled();
      } finally {
        if (!holdPointIdToDelete) {
          const createdHoldPoint = await prisma.holdPoint.findFirst({
            where: { lotId: lot.id, itpChecklistItemId: checklistItemId },
            select: { id: true },
          });
          holdPointIdToDelete = createdHoldPoint?.id;
        }
        await prisma.webhookDelivery.deleteMany({ where: { webhookId: webhook.id } });
        await prisma.webhookConfig.delete({ where: { id: webhook.id } }).catch(() => {});
        await cleanupRequestReleaseLot(lot.id, holdPointIdToDelete);
        fetchMock.mockRestore();
      }
    });

    it('attaches uploaded request evidence to a pending ITP completion', async () => {
      clearEmailQueue();
      const lot = await createRequestReleaseLot('request-evidence');
      const firstEvidence = await createRequestEvidenceDocument(lot.id, 'request-evidence-1.pdf');
      const secondEvidence = await createRequestEvidenceDocument(lot.id, 'request-evidence-2.pdf');
      let holdPointIdToDelete: string | undefined;

      try {
        const res = await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            lotId: lot.id,
            itpChecklistItemId: checklistItemId,
            notificationSentTo: 'evidence-reviewer@example.com',
            evidenceDocumentIds: [firstEvidence.id, secondEvidence.id, firstEvidence.id],
          });

        expect(res.status).toBe(200);
        holdPointIdToDelete = res.body.holdPoint.id;

        const itpInstance = await prisma.iTPInstance.findUniqueOrThrow({
          where: { lotId: lot.id },
          select: { id: true },
        });
        const completion = await prisma.iTPCompletion.findUniqueOrThrow({
          where: {
            itpInstanceId_checklistItemId: {
              itpInstanceId: itpInstance.id,
              checklistItemId,
            },
          },
        });
        expect(completion.status).toBe('pending');

        const attachments = await prisma.iTPCompletionAttachment.findMany({
          where: { completionId: completion.id },
          select: { documentId: true },
        });
        expect(attachments.map((attachment) => attachment.documentId).sort()).toEqual(
          [firstEvidence.id, secondEvidence.id].sort(),
        );
      } finally {
        await prisma.document.deleteMany({
          where: { id: { in: [firstEvidence.id, secondEvidence.id] } },
        });
        if (!holdPointIdToDelete) {
          const createdHoldPoint = await prisma.holdPoint.findFirst({
            where: { lotId: lot.id, itpChecklistItemId: checklistItemId },
            select: { id: true },
          });
          holdPointIdToDelete = createdHoldPoint?.id;
        }
        await cleanupRequestReleaseLot(lot.id, holdPointIdToDelete);
      }
    });

    it('rejects request evidence documents from another lot', async () => {
      clearEmailQueue();
      const lot = await createRequestReleaseLot('request-evidence-wrong-lot');
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `HP-REQUEST-OTHER-${Date.now()}`,
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const evidenceDocument = await createRequestEvidenceDocument(
        otherLot.id,
        'wrong-lot-request-evidence.pdf',
      );

      try {
        const res = await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            lotId: lot.id,
            itpChecklistItemId: checklistItemId,
            notificationSentTo: 'wrong-lot-reviewer@example.com',
            evidenceDocumentIds: [evidenceDocument.id],
          });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Evidence documents');
        await expect(
          prisma.holdPoint.count({
            where: { lotId: lot.id, itpChecklistItemId: checklistItemId },
          }),
        ).resolves.toBe(0);
        expect(getQueuedEmails()).toHaveLength(0);
      } finally {
        await prisma.document.delete({ where: { id: evidenceDocument.id } }).catch(() => {});
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
        await cleanupRequestReleaseLot(lot.id);
      }
    });

    it('honours minimum notice days saved by project settings UI', async () => {
      clearEmailQueue();
      const lot = await createRequestReleaseLot('ui-minimum-notice');
      const originalProject = await prisma.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { settings: true, workingDays: true },
      });
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(9, 0, 0, 0);

      await prisma.project.update({
        where: { id: projectId },
        data: {
          settings: JSON.stringify({ hpMinimumNoticeDays: 5 }),
          workingDays: '0,1,2,3,4,5,6',
        },
      });

      try {
        const res = await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            lotId: lot.id,
            itpChecklistItemId: checklistItemId,
            scheduledDate: scheduledDate.toISOString(),
            notificationSentTo: 'notice-reviewer@example.com',
          });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('NOTICE_PERIOD_WARNING');
        expect(res.body.error.details.minimumNoticeDays).toBe(5);
        expect(res.body.error.message).toContain('minimum 5 working days notice');
        await expect(
          prisma.holdPoint.count({
            where: { lotId: lot.id, itpChecklistItemId: checklistItemId },
          }),
        ).resolves.toBe(0);
        expect(getQueuedEmails()).toHaveLength(0);
      } finally {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            settings: originalProject.settings,
            workingDays: originalProject.workingDays,
          },
        });
        await cleanupRequestReleaseLot(lot.id);
      }
    });
  });

  describe('POST /api/holdpoints/:id/release', () => {
    async function createReleaseReadyHoldPoint(status = 'notified') {
      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          status,
        },
      });

      const itpInstance = await prisma.iTPInstance.findUniqueOrThrow({
        where: { lotId },
        select: { id: true },
      });
      const completion = await prisma.iTPCompletion.upsert({
        where: {
          itpInstanceId_checklistItemId: {
            itpInstanceId: itpInstance.id,
            checklistItemId,
          },
        },
        update: {
          status: 'completed',
          completedById: null,
          completedAt: null,
          notes: null,
          signatureUrl: null,
          witnessPresent: null,
          witnessName: null,
          witnessCompany: null,
          verificationStatus: 'none',
          verifiedById: null,
          verifiedAt: null,
          verificationNotes: null,
          gpsLatitude: null,
          gpsLongitude: null,
        },
        create: {
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'completed',
        },
      });

      return { holdPoint: hp, completion };
    }

    async function createReleaseEvidenceDocument(
      documentLotId: string,
      filename = 'manual-release-email.pdf',
    ) {
      return prisma.document.create({
        data: {
          projectId,
          lotId: documentLotId,
          uploadedById: userId,
          filename,
          fileUrl: `/uploads/documents/${filename}`,
          mimeType: 'application/pdf',
          fileSize: 1234,
          documentType: 'hold_point_release_evidence',
          category: 'itp_evidence',
        },
      });
    }

    function emailReleasePayload(overrides: Record<string, unknown> = {}) {
      return {
        releasedByName: 'Email Release Reviewer',
        releasedByOrg: 'Superintendent Team',
        releaseDate: '2026-01-21',
        releaseTime: '10:30',
        releaseMethod: 'email',
        releaseNotes: 'Email confirmation received',
        signatureDataUrl: null,
        ...overrides,
      };
    }

    function postRelease(holdPointId: string, payload: Record<string, unknown>) {
      return request(app)
        .post(`/api/holdpoints/${holdPointId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(payload);
    }

    let holdPointId: string;
    let completionId: string;

    beforeAll(async () => {
      const { holdPoint, completion } = await createReleaseReadyHoldPoint('notified');
      holdPointId = holdPoint.id;
      completionId = completion.id;
    });

    it('should reject invalid release date inputs without releasing the hold point', async () => {
      const res = await postRelease(holdPointId, {
        releasedByName: 'HP Test User',
        releasedByOrg: 'SiteProof QA',
        releaseDate: '2026-02-30T10:00:00Z',
        releaseNotes: 'Invalid release date',
      });

      expect(res.status).toBe(400);

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.status).toBe('notified');
      expect(holdPoint.releasedAt).toBeNull();
    });

    it('rejects manual release before the hold point has been requested', async () => {
      const { holdPoint: hp } = await createReleaseReadyHoldPoint('pending');

      try {
        const res = await postRelease(hp.id, {
          releasedByName: 'Premature Releaser',
          releasedByOrg: 'SiteProof QA',
          releaseDate: '2026-01-20',
          releaseTime: '09:15',
          releaseNotes: 'Should not skip request release',
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Request hold point release');

        const unchanged = await prisma.holdPoint.findUniqueOrThrow({ where: { id: hp.id } });
        expect(unchanged.status).toBe('pending');
        expect(unchanged.releasedAt).toBeNull();
      } finally {
        await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
      }
    });

    it('should release hold point with notes', async () => {
      const res = await postRelease(holdPointId, {
        releasedByName: 'HP Test User',
        releasedByOrg: 'SiteProof QA',
        releaseDate: '2026-01-20',
        releaseTime: '09:15',
        releaseNotes: 'Approved by QM',
        signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      });

      // M84: the release wall-clock is interpreted in the project's timezone
      // (NSW -> Australia/Sydney, AEDT +11 in January), not the server's.
      const expectedReleasedAt = zonedWallClockToUtc(
        2026,
        1,
        20,
        9,
        15,
        projectTimeZoneFromState('NSW'),
      );
      expect(res.status).toBe(200);
      expect(res.body.holdPoint).toBeDefined();
      expect(res.body.holdPoint.status).toBe('released');
      expect(new Date(res.body.holdPoint.releasedAt).getTime()).toBe(expectedReleasedAt.getTime());
      expect(res.body.holdPoint.releaseSignatureUrl).toBe(
        'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      );

      const completion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
      });
      expect(completion.verificationStatus).toBe('verified');
      expect(completion.verifiedById).toBe(userId);
      expect(completion.verifiedAt).toBeInstanceOf(Date);
      // I1-core: releasing the hold point also completes the ITP item.
      expect(completion.status).toBe('completed');
      expect(completion.completedAt).toBeInstanceOf(Date);
      expect(completion.completedById).toBe(userId);
    });

    it('creates a completed + verified completion when releasing a never-ticked hold point', async () => {
      // Fresh checklist item + hold point with NO pre-existing ITPCompletion.
      const itpInstance = await prisma.iTPInstance.findUniqueOrThrow({
        where: { lotId },
        select: { id: true, templateId: true },
      });
      const freshItem = await prisma.iTPChecklistItem.create({
        data: {
          templateId: itpInstance.templateId,
          sequenceNumber: 9001,
          description: 'Never-ticked hold point',
          pointType: 'hold_point',
          responsibleParty: 'superintendent',
        },
      });
      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: freshItem.id,
          pointType: 'hold_point',
          status: 'notified',
        },
      });

      const before = await prisma.iTPCompletion.findFirst({
        where: { itpInstanceId: itpInstance.id, checklistItemId: freshItem.id },
      });
      expect(before).toBeNull();

      const res = await postRelease(hp.id, {
        releasedByName: 'Superintendent Releaser',
        releasedByOrg: 'Client Company',
        releaseDate: '2026-01-22',
        releaseTime: '11:00',
        releaseNotes: 'Released without prior tick',
      });

      expect(res.status).toBe(200);
      expect(res.body.holdPoint.status).toBe('released');

      const created = await prisma.iTPCompletion.findFirstOrThrow({
        where: { itpInstanceId: itpInstance.id, checklistItemId: freshItem.id },
      });
      expect(created.status).toBe('completed');
      expect(created.completedAt).toBeInstanceOf(Date);
      expect(created.completedById).toBe(userId);
      expect(created.verificationStatus).toBe('verified');
      expect(created.verifiedById).toBe(userId);
      expect(created.verifiedAt).toBeInstanceOf(Date);
    });

    it('does not overwrite a failed ITP completion when recording hold point release', async () => {
      const { holdPoint: hp, completion } = await createReleaseReadyHoldPoint();
      await prisma.iTPCompletion.update({
        where: { id: completion.id },
        data: {
          status: 'failed',
          verificationStatus: 'none',
          completedAt: null,
          completedById: null,
          verifiedAt: null,
          verifiedById: null,
        },
      });

      try {
        const res = await postRelease(hp.id, emailReleasePayload());

        expect(res.status).toBe(409);
        expect(res.body.error.message).toContain('Failed ITP hold-point items must be resubmitted');

        const unchangedCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
          where: { id: completion.id },
        });
        expect(unchangedCompletion.status).toBe('failed');
        expect(unchangedCompletion.verificationStatus).toBe('none');
        expect(unchangedCompletion.verifiedAt).toBeNull();

        const unchangedHoldPoint = await prisma.holdPoint.findUniqueOrThrow({
          where: { id: hp.id },
        });
        expect(unchangedHoldPoint.status).toBe('notified');
        expect(unchangedHoldPoint.releasedAt).toBeNull();
      } finally {
        await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
        await prisma.iTPCompletion.delete({ where: { id: completion.id } }).catch(() => {});
      }
    });

    it('should accept email confirmation release with no signature data', async () => {
      const { holdPoint: hp } = await createReleaseReadyHoldPoint();

      const res = await postRelease(hp.id, emailReleasePayload());

      expect(res.status).toBe(200);
      expect(res.body.holdPoint.status).toBe('released');
      expect(res.body.holdPoint.releaseMethod).toBe('email');
      expect(res.body.holdPoint.releaseSignatureUrl).toBeNull();
    });

    it('triggers a hold point released webhook after authenticated release', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() => Promise.resolve(new Response('accepted', { status: 200 })));
      const webhook = await prisma.webhookConfig.create({
        data: {
          companyId,
          url: 'https://example.com/siteproof-hold-point-release-events',
          secret: 'test-webhook-secret',
          events: JSON.stringify(['hold_point.released']),
          enabled: true,
          createdById: userId,
        },
      });
      const { holdPoint: hp, completion } = await createReleaseReadyHoldPoint();

      try {
        const res = await postRelease(hp.id, emailReleasePayload());

        expect(res.status).toBe(200);

        const deliveries = await waitForWebhookDeliveries(webhook.id, 1, (delivery) =>
          Boolean(delivery.success && deliveryPayloadContains(delivery, hp.id)),
        );
        const delivery = deliveries.find((item) =>
          Boolean(item.success && deliveryPayloadContains(item, hp.id)),
        );
        expect(delivery).toBeDefined();
        expect(delivery).toMatchObject({
          event: 'hold_point.released',
          success: true,
          responseStatus: 200,
        });
        expect(delivery?.payload).toMatchObject({
          event: 'hold_point.released',
          data: {
            holdPointId: hp.id,
            projectId,
            lotId,
            lotNumber: expect.any(String),
            itpChecklistItemId: checklistItemId,
            status: 'released',
            actorUserId: userId,
            action: 'released',
            releaseSource: 'authenticated',
            releaseMethod: 'email',
            releasedByName: 'Email Release Reviewer',
            releasedByOrg: 'Superintendent Team',
            releaseEvidenceDocumentId: null,
            hasReleaseNotes: true,
          },
        });
        const serializedPayload = JSON.stringify(delivery?.payload);
        expect(serializedPayload).not.toContain('data:image');
        expect(serializedPayload).not.toContain('/hp-release/');
        expect(serializedPayload).not.toContain('external@example.com');
        expect(fetchMock).toHaveBeenCalled();
      } finally {
        await prisma.webhookDelivery.deleteMany({ where: { webhookId: webhook.id } });
        await prisma.webhookConfig.delete({ where: { id: webhook.id } }).catch(() => {});
        await prisma.iTPCompletion.delete({ where: { id: completion.id } }).catch(() => {});
        await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
        fetchMock.mockRestore();
      }
    });

    it('allows only one authenticated release when two users release the same hold point together', async () => {
      const { holdPoint: hp, completion } = await createReleaseReadyHoldPoint();
      const originalFindUnique = prisma.holdPoint.findUnique.bind(prisma.holdPoint);
      let releaseReads = 0;
      let unblockReleaseReads!: () => void;
      const releaseReadsBarrier = new Promise<void>((resolve) => {
        unblockReleaseReads = resolve;
      });
      const findUniqueSpy = vi.spyOn(prisma.holdPoint, 'findUnique').mockImplementation(((args) => {
        return originalFindUnique(args).then(async (result) => {
          if (args?.where?.id === hp.id && releaseReads < 2) {
            releaseReads += 1;
            if (releaseReads === 2) {
              unblockReleaseReads();
            }
            await releaseReadsBarrier;
          }
          return result;
        }) as ReturnType<typeof prisma.holdPoint.findUnique>;
      }) as Parameters<typeof findUniqueSpy.mockImplementation>[0]);

      try {
        clearEmailQueue();
        await prisma.notification.deleteMany({ where: { projectId, type: 'hold_point_release' } });
        const projectUserCount = await prisma.projectUser.count({
          where: { projectId, status: 'active' },
        });

        const [firstRes, secondRes] = await Promise.all([
          postRelease(hp.id, {
            releasedByName: 'First Releaser',
            releasedByOrg: 'Client Company',
            releaseDate: '2026-01-24',
            releaseTime: '09:00',
            releaseNotes: 'First release wins',
          }),
          postRelease(hp.id, {
            releasedByName: 'Second Releaser',
            releasedByOrg: 'Client Company',
            releaseDate: '2026-01-24',
            releaseTime: '10:00',
            releaseNotes: 'Second release should not overwrite',
          }),
        ]);

        const statuses = [firstRes.status, secondRes.status].sort();
        expect(statuses).toEqual([200, 400]);
        const successRes = [firstRes, secondRes].find((res) => res.status === 200);
        const rejectedRes = [firstRes, secondRes].find((res) => res.status === 400);
        expect(successRes?.body.holdPoint.status).toBe('released');
        expect(rejectedRes?.body.error.message).toContain('already been released');

        const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: hp.id } });
        expect(holdPoint.releasedByName).toBe(successRes?.body.holdPoint.releasedByName);
        expect(holdPoint.releaseNotes).toBe(successRes?.body.holdPoint.releaseNotes);

        const releaseAudits = await prisma.auditLog.findMany({
          where: { entityId: hp.id, action: AuditAction.HP_RELEASED },
        });
        expect(releaseAudits).toHaveLength(1);

        const completions = await prisma.iTPCompletion.findMany({
          where: { id: completion.id },
        });
        expect(completions).toHaveLength(1);

        const notifications = await prisma.notification.findMany({
          where: { projectId, type: 'hold_point_release' },
        });
        expect(notifications).toHaveLength(projectUserCount);
      } finally {
        findUniqueSpy.mockRestore();
        await prisma.notification.deleteMany({ where: { projectId, type: 'hold_point_release' } });
        await prisma.iTPCompletion.delete({ where: { id: completion.id } }).catch(() => {});
        await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
        clearEmailQueue();
      }
    });

    it('records and attaches same-lot manual release evidence documents', async () => {
      const { holdPoint: hp, completion } = await createReleaseReadyHoldPoint();
      const evidenceDocument = await createReleaseEvidenceDocument(lotId);

      const res = await postRelease(
        hp.id,
        emailReleasePayload({
          signatureDataUrl: undefined,
          releaseEvidenceDocumentId: evidenceDocument.id,
        }),
      );

      expect(res.status).toBe(200);
      const auditLog = await prisma.auditLog.findFirst({
        where: { entityId: hp.id, action: AuditAction.HP_RELEASED },
        orderBy: { createdAt: 'desc' },
      });
      const changes = parseAuditLogChanges(auditLog?.changes ?? null) as Record<string, unknown>;
      expect(changes).toMatchObject({
        releaseMethod: 'email',
        releaseEvidenceDocumentId: evidenceDocument.id,
        releaseEvidenceFilename: 'manual-release-email.pdf',
      });

      const attachment = await prisma.iTPCompletionAttachment.findUnique({
        where: {
          completionId_documentId: {
            completionId: completion.id,
            documentId: evidenceDocument.id,
          },
        },
      });
      expect(attachment).not.toBeNull();
    });

    it('rejects manual release evidence documents from another lot', async () => {
      const { holdPoint: hp } = await createReleaseReadyHoldPoint();
      const otherLot = await prisma.lot.create({
        data: {
          projectId,
          lotNumber: `HP-OTHER-${Date.now()}`,
          lotType: 'chainage',
          activityType: 'Earthworks',
        },
      });
      const evidenceDocument = await createReleaseEvidenceDocument(
        otherLot.id,
        'wrong-lot-release-email.pdf',
      );

      try {
        const res = await postRelease(
          hp.id,
          emailReleasePayload({
            signatureDataUrl: undefined,
            releaseEvidenceDocumentId: evidenceDocument.id,
          }),
        );

        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Release evidence document');
        const unchanged = await prisma.holdPoint.findUniqueOrThrow({ where: { id: hp.id } });
        expect(unchanged.status).toBe('notified');
      } finally {
        await prisma.document.delete({ where: { id: evidenceDocument.id } }).catch(() => {});
        await prisma.lot.delete({ where: { id: otherLot.id } }).catch(() => {});
      }
    });

    it('notifies the team and emails confirmations when the release toggle is on (default)', async () => {
      const { holdPoint: hp, completion } = await createReleaseReadyHoldPoint();

      // A foreman receives the Feature #948 contractor confirmation email
      // (direct `to:` send), so it proves both the in-app and the confirmation
      // email paths run when the category is on. The project has no stored
      // settings, so the toggle defaults to enabled.
      const foreman = await registerTestUser('HP Release Foreman On', 'user', companyId);
      await prisma.projectUser.create({
        data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
      });

      try {
        clearEmailQueue();
        const res = await request(app)
          .post(`/api/holdpoints/${hp.id}/release`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            releasedByName: 'Toggle On Releaser',
            releasedByOrg: 'SiteProof QA',
            releaseDate: '2026-01-23',
            releaseTime: '12:00',
            releaseNotes: 'Team should be notified',
          });

        expect(res.status).toBe(200);
        expect(res.body.holdPoint.status).toBe('released');

        // In-app records are created for the project team.
        const notifications = await prisma.notification.findMany({
          where: { projectId, type: 'hold_point_release' },
        });
        expect(notifications.length).toBeGreaterThan(0);

        // The foreman confirmation email (Feature #948) is sent.
        const confirmationToForeman = getQueuedEmails().some((email) => email.to === foreman.email);
        expect(confirmationToForeman).toBe(true);
      } finally {
        await prisma.notification.deleteMany({ where: { projectId, type: 'hold_point_release' } });
        await prisma.iTPCompletion.delete({ where: { id: completion.id } }).catch(() => {});
        await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
        await prisma.projectUser.deleteMany({ where: { projectId, userId: foreman.userId } });
        await cleanupTestUser(foreman.userId);
        clearEmailQueue();
      }
    });

    it('suppresses hold point release notifications and emails when the project toggle is off', async () => {
      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          status: 'notified',
        },
      });

      // A foreman on the project would normally receive the Feature #948
      // contractor confirmation email — a direct `to:` send that bypasses the
      // per-user email preference system. The project toggle is the only seam
      // that can suppress it, so this proves it is gated too.
      const foreman = await registerTestUser('HP Release Foreman Off', 'user', companyId);
      await prisma.projectUser.create({
        data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
      });

      // Admin turned the "Hold Point Releases" category off for this project.
      await prisma.project.update({
        where: { id: projectId },
        data: {
          settings: JSON.stringify({ notificationPreferences: { holdPointReleases: false } }),
        },
      });

      try {
        clearEmailQueue();
        const res = await request(app)
          .post(`/api/holdpoints/${hp.id}/release`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            releasedByName: 'Toggle Off Releaser',
            releasedByOrg: 'SiteProof QA',
            releaseDate: '2026-01-22',
            releaseTime: '11:00',
            releaseNotes: 'Should not notify the team',
          });

        // The release still succeeds; only the team notifications are suppressed.
        expect(res.status).toBe(200);
        expect(res.body.holdPoint.status).toBe('released');

        const notifications = await prisma.notification.findMany({
          where: { projectId, type: 'hold_point_release' },
        });
        expect(notifications).toHaveLength(0);

        // Neither the per-user release emails nor the Feature #948 confirmation
        // emails are sent. Suppressing one but not the other would be a new lie.
        expect(getQueuedEmails()).toHaveLength(0);
      } finally {
        await prisma.project.update({
          where: { id: projectId },
          data: { settings: null },
        });
        await prisma.notification.deleteMany({ where: { projectId, type: 'hold_point_release' } });
        await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
        await prisma.projectUser.deleteMany({ where: { projectId, userId: foreman.userId } });
        await cleanupTestUser(foreman.userId);
        clearEmailQueue();
      }
    });

    it('should reject releasing an already released hold point', async () => {
      const res = await request(app)
        .post(`/api/holdpoints/${holdPointId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          releasedByName: 'Second Releaser',
          releasedByOrg: 'SiteProof QA',
          releaseNotes: 'This should not replace the original release',
        });

      expect(res.status).toBe(400);

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.releasedByName).toBe('HP Test User');
      expect(holdPoint.releaseNotes).toBe('Approved by QM');
    });

    it('should keep company admin release rights when project membership is lower', async () => {
      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          status: 'notified',
        },
      });

      await prisma.projectUser.updateMany({
        where: { projectId, userId },
        data: { role: 'viewer' },
      });

      try {
        const res = await request(app)
          .post(`/api/holdpoints/${hp.id}/release`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            releasedByName: 'Company Admin Releaser',
            releasedByOrg: 'SiteProof QA',
            releaseNotes: 'Company admin should not be downgraded by project membership',
          });

        expect(res.status).toBe(200);
        expect(res.body.holdPoint.status).toBe('released');
      } finally {
        await prisma.projectUser.updateMany({
          where: { projectId, userId },
          data: { role: 'admin' },
        });
      }
    });
  });
});

describe('Hold Points API access control', () => {
  let companyId: string;
  let projectId: string;
  let adminToken: string;
  let adminUserId: string;
  let lotId: string;
  let unassignedLotId: string;
  let checklistItemId: string;
  let holdPointId: string;
  let unassignedHoldPointId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Hold Points Company ${Date.now()}` },
    });
    companyId = company.id;

    const admin = await registerTestUser('Hold Points Admin', 'admin', companyId);
    adminToken = admin.token;
    adminUserId = admin.userId;
    createdUserIds.push(adminUserId);

    const project = await prisma.project.create({
      data: {
        name: `Hold Points Project ${Date.now()}`,
        projectNumber: `HP-ACCESS-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
        settings: JSON.stringify({
          hpRecipients: [{ email: 'internal-hp-reviewer@example.com' }],
          hpApprovalRequirement: 'superintendent',
        }),
        workingHoursStart: '06:30',
        workingHoursEnd: '16:30',
        workingDays: '1,2,3,4,5',
      },
    });
    projectId = project.id;

    await prisma.projectUser.create({
      data: { projectId, userId: adminUserId, role: 'admin', status: 'active' },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `HP-ACCESS-LOT-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: `HP Access Template ${Date.now()}`,
        activityType: 'Earthworks',
        checklistItems: {
          create: {
            sequenceNumber: 1,
            description: 'Hold point release',
            pointType: 'hold_point',
            responsibleParty: 'contractor',
            evidenceRequired: 'none',
          },
        },
      },
      include: { checklistItems: true },
    });
    checklistItemId = template.checklistItems[0].id;

    await prisma.iTPInstance.create({
      data: {
        lotId,
        templateId: template.id,
        status: 'in_progress',
      },
    });

    const holdPoint = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        description: 'Hold point release',
        status: 'notified',
      },
    });
    holdPointId = holdPoint.id;

    const unassignedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `HP-HIDDEN-LOT-${Date.now()}`,
        status: 'in_progress',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    unassignedLotId = unassignedLot.id;

    await prisma.iTPInstance.create({
      data: {
        lotId: unassignedLotId,
        templateId: template.id,
        status: 'in_progress',
      },
    });

    const unassignedHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId: unassignedLotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        description: 'Hidden hold point release',
        status: 'notified',
      },
    });
    unassignedHoldPointId = unassignedHoldPoint.id;
  });

  afterAll(async () => {
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lot: { projectId } } } });
    await prisma.holdPoint.deleteMany({ where: { lot: { projectId } } });
    await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lotId } } });
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.projectUser.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    for (const userId of createdUserIds) {
      await cleanupTestUser(userId);
    }
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('allows active project users to list hold points', async () => {
    const res = await request(app)
      .get(`/api/holdpoints/project/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.holdPoints).toHaveLength(2);
    expect(res.body.holdPoints.some((hp: any) => hp.id === holdPointId)).toBe(true);
    expect(res.body.holdPoints.some((hp: any) => hp.id === unassignedHoldPointId)).toBe(true);
  });

  it('scopes subcontractor hold point access to assigned lots without request-only metadata', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Hold Points Subcontractor ${Date.now()}`,
        status: 'approved',
        portalAccess: { holdPoints: true, itps: true },
      },
    });
    const subcontractor = await registerTestUser(
      'Hold Points Subcontractor',
      'subcontractor',
      null,
    );
    createdUserIds.push(subcontractor.userId);

    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });

    try {
      const unassignedListRes = await request(app)
        .get(`/api/holdpoints/project/${projectId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(unassignedListRes.status).toBe(200);
      expect(unassignedListRes.body.holdPoints).toHaveLength(0);

      await prisma.lotSubcontractorAssignment.create({
        data: {
          projectId,
          lotId,
          subcontractorCompanyId: subcontractorCompany.id,
          status: 'active',
        },
      });

      const listRes = await request(app)
        .get(`/api/holdpoints/project/${projectId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.holdPoints).toHaveLength(1);
      expect(listRes.body.holdPoints[0].id).toBe(holdPointId);
      expect(listRes.body.holdPoints.some((hp: any) => hp.id === unassignedHoldPointId)).toBe(
        false,
      );

      const detailRes = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.canRequestRelease).toBe(false);
      expect(detailRes.body.defaultRecipients).toEqual([]);

      const unassignedDetailRes = await request(app)
        .get(`/api/holdpoints/lot/${unassignedLotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(unassignedDetailRes.status).toBe(403);

      const evidenceRes = await request(app)
        .get(`/api/holdpoints/${holdPointId}/evidence-package`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(evidenceRes.status).toBe(403);

      const previewRes = await request(app)
        .post('/api/holdpoints/preview-evidence-package')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ lotId, itpChecklistItemId: checklistItemId });
      expect(previewRes.status).toBe(403);

      await prisma.projectUser.create({
        data: {
          projectId,
          userId: subcontractor.userId,
          role: 'project_manager',
          status: 'active',
        },
      });

      const requestReleaseRes = await request(app)
        .post('/api/holdpoints/request-release')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ lotId, itpChecklistItemId: checklistItemId });
      expect(requestReleaseRes.status).toBe(403);
      expect(requestReleaseRes.body.error.message).toContain('request hold point release');

      const workingHoursRes = await request(app)
        .get(`/api/holdpoints/project/${projectId}/working-hours`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(workingHoursRes.status).toBe(403);

      const calculateRes = await request(app)
        .post('/api/holdpoints/calculate-notification-time')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ projectId, requestedDateTime: new Date().toISOString() });
      expect(calculateRes.status).toBe(403);
      expect(calculateRes.body.error.message).toContain('calculate hold point notification times');
    } finally {
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.projectUser.deleteMany({
        where: { projectId, userId: subcontractor.userId },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
    }
  });

  it('rejects subcontractor direct hold point reads when portal access is disabled', async () => {
    const subcontractorCompany = await prisma.subcontractorCompany.create({
      data: {
        projectId,
        companyName: `Hold Points Portal Disabled ${Date.now()}`,
        status: 'approved',
        portalAccess: { holdPoints: false },
      },
    });
    const subcontractor = await registerTestUser(
      'Hold Points Portal Blocked',
      'subcontractor',
      null,
    );

    await prisma.subcontractorUser.create({
      data: {
        userId: subcontractor.userId,
        subcontractorCompanyId: subcontractorCompany.id,
        role: 'user',
      },
    });
    await prisma.lotSubcontractorAssignment.create({
      data: {
        projectId,
        lotId,
        subcontractorCompanyId: subcontractorCompany.id,
        status: 'active',
      },
    });

    try {
      const listRes = await request(app)
        .get(`/api/holdpoints/project/${projectId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(listRes.status).toBe(403);
      expect(listRes.body.error.message).toContain('Hold points portal access is not enabled');

      const directDetailRes = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(directDetailRes.status).toBe(403);
      expect(directDetailRes.body.error.message).toContain(
        'Hold points portal access is not enabled',
      );

      const requestReleaseRes = await request(app)
        .post('/api/holdpoints/request-release')
        .set('Authorization', `Bearer ${subcontractor.token}`)
        .send({ lotId, itpChecklistItemId: checklistItemId });
      expect(requestReleaseRes.status).toBe(403);
      expect(requestReleaseRes.body.error.message).toContain(
        'Hold points portal access is not enabled',
      );

      await prisma.subcontractorCompany.update({
        where: { id: subcontractorCompany.id },
        data: { portalAccess: { holdPoints: true } },
      });

      const allowedDetailRes = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${subcontractor.token}`);
      expect(allowedDetailRes.status).toBe(200);
      expect(allowedDetailRes.body.holdPoint.id).toBe(holdPointId);
    } finally {
      await prisma.lotSubcontractorAssignment.deleteMany({
        where: { subcontractorCompanyId: subcontractorCompany.id },
      });
      await prisma.subcontractorUser.deleteMany({ where: { userId: subcontractor.userId } });
      await prisma.subcontractorCompany
        .delete({ where: { id: subcontractorCompany.id } })
        .catch(() => {});
      await cleanupTestUser(subcontractor.userId);
    }
  });

  it('sends release requests to explicitly entered notification recipients', async () => {
    clearEmailQueue();
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId } });
    const staleToken = `stale-token-${Date.now()}`;
    const qaReviewer = await registerTestUser('Hold Points QA Reviewer', 'viewer', companyId);
    const inspectorReviewer = await registerTestUser(
      'Hold Points Inspector Reviewer',
      'viewer',
      companyId,
    );
    createdUserIds.push(qaReviewer.userId, inspectorReviewer.userId);

    await prisma.projectUser.createMany({
      data: [
        {
          projectId,
          userId: qaReviewer.userId,
          role: 'superintendent',
          status: 'active',
        },
        {
          projectId,
          userId: inspectorReviewer.userId,
          role: 'project_manager',
          status: 'active',
        },
      ],
    });
    clearEmailQueue();

    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: hashHoldPointReleaseTokenForTest(staleToken),
        recipientEmail: 'old-reviewer@example.com',
        recipientName: 'Old Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lotId,
        itpChecklistItemId: checklistItemId,
        notificationSentTo: `${qaReviewer.email}; ${inspectorReviewer.email}, ${qaReviewer.email}`,
      });

    expect(res.status).toBe(200);
    expect(res.body.holdPoint.notificationSentTo).toBe(
      `${qaReviewer.email}, ${inspectorReviewer.email}`,
    );

    const tokens = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId },
      select: { recipientEmail: true, token: true },
      orderBy: { recipientEmail: 'asc' },
    });
    expect(tokens.map((token) => token.recipientEmail)).toEqual(
      [inspectorReviewer.email, qaReviewer.email].sort(),
    );
    expect(tokens.every((token) => /^sha256:[a-f0-9]{64}$/.test(token.token))).toBe(true);
    expect(tokens.map((token) => token.token)).not.toContain(
      hashHoldPointReleaseTokenForTest(staleToken),
    );

    const queuedEmails = getQueuedEmails();
    expect(queuedEmails.map((email) => email.to).sort()).toEqual(
      [inspectorReviewer.email, qaReviewer.email].sort(),
    );

    const rawToken = queuedEmails
      .map((email) => email.text?.match(/\/hp-release\/([a-f0-9]{64})/)?.[1])
      .find(Boolean);
    expect(rawToken).toBeDefined();
    expect(tokens.map((token) => token.token)).not.toContain(rawToken);

    const tokenEmail = queuedEmails.find((email) =>
      email.text?.includes(`/hp-release/${rawToken}`),
    );
    expect(tokenEmail?.text).toContain(
      `View evidence package: http://localhost:5174/hp-release/${rawToken}#evidence-package`,
    );
    expect(tokenEmail?.html).toContain(
      `href="http://localhost:5174/hp-release/${rawToken}#evidence-package"`,
    );
    expect(tokenEmail?.text).not.toContain('/evidence-preview');
    expect(tokenEmail?.html).not.toContain('/evidence-preview');

    const publicRes = await request(app).get(`/api/holdpoints/public/${rawToken!}`);
    expect(publicRes.status).toBe(200);

    const storedHashRes = await request(app).get(
      `/api/holdpoints/public/${encodeURIComponent(tokens[0].token)}`,
    );
    expect(storedHashRes.status).toBe(404);
  });

  it('allows superintendent-responsible verification items through the hold-point release flow', async () => {
    clearEmailQueue();
    const existingItem = await prisma.iTPChecklistItem.findUniqueOrThrow({
      where: { id: checklistItemId },
      select: { templateId: true },
    });
    const releaseItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId: existingItem.templateId,
        description: 'Superintendent verification release',
        pointType: 'verification',
        responsibleParty: 'superintendent',
        sequenceNumber: 0,
        evidenceRequired: 'none',
      },
    });
    const superintendent = await registerTestUser(
      'Hold Points Superintendent Verification Reviewer',
      'viewer',
      companyId,
    );
    createdUserIds.push(superintendent.userId);

    await prisma.projectUser.create({
      data: {
        projectId,
        userId: superintendent.userId,
        role: 'superintendent',
        status: 'active',
      },
    });

    try {
      const detailRes = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${releaseItem.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.holdPoint.itpChecklistItemId).toBe(releaseItem.id);

      const requestReleaseRes = await request(app)
        .post('/api/holdpoints/request-release')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lotId,
          itpChecklistItemId: releaseItem.id,
          notificationSentTo: superintendent.email,
        });
      expect(requestReleaseRes.status).toBe(200);
      expect(requestReleaseRes.body.holdPoint.itpChecklistItemId).toBe(releaseItem.id);

      const holdPoint = await prisma.holdPoint.findFirst({
        where: { lotId, itpChecklistItemId: releaseItem.id },
      });
      expect(holdPoint?.status).toBe('notified');
      expect(getQueuedEmails().some((email) => email.to === superintendent.email)).toBe(true);
    } finally {
      await prisma.holdPointReleaseToken.deleteMany({
        where: { holdPoint: { itpChecklistItemId: releaseItem.id } },
      });
      await prisma.holdPoint.deleteMany({ where: { itpChecklistItemId: releaseItem.id } });
      await prisma.iTPCompletion.deleteMany({ where: { checklistItemId: releaseItem.id } });
      await prisma.iTPChecklistItem.delete({ where: { id: releaseItem.id } }).catch(() => {});
    }
  });

  it('sends chase reminders for token recipients with public evidence links', async () => {
    clearEmailQueue();
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId } });
    const externalReviewer = await registerTestUser(
      'Hold Points External Chase Reviewer',
      'viewer',
      companyId,
    );
    createdUserIds.push(externalReviewer.userId);

    await prisma.projectUser.create({
      data: {
        projectId,
        userId: externalReviewer.userId,
        role: 'superintendent',
        status: 'active',
      },
    });

    const requestReleaseRes = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lotId,
        itpChecklistItemId: checklistItemId,
        notificationSentTo: externalReviewer.email,
      });
    expect(requestReleaseRes.status).toBe(200);
    expect(await prisma.holdPointReleaseToken.count({ where: { holdPointId } })).toBe(1);

    clearEmailQueue();
    const chaseRes = await request(app)
      .post(`/api/holdpoints/${holdPointId}/chase`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(chaseRes.status).toBe(200);

    const chaseEmail = getQueuedEmails().find((email) => email.to === externalReviewer.email);
    expect(chaseEmail).toBeDefined();

    const chaseToken = chaseEmail?.text?.match(/\/hp-release\/([a-f0-9]{64})/)?.[1];
    expect(chaseToken).toBeDefined();
    expect(chaseEmail?.text).toContain(
      `View evidence package: http://localhost:5174/hp-release/${chaseToken}#evidence-package`,
    );
    expect(chaseEmail?.html).toContain(
      `href="http://localhost:5174/hp-release/${chaseToken}#evidence-package"`,
    );
    expect(chaseEmail?.text).not.toContain('/evidence-preview');
    expect(chaseEmail?.html).not.toContain('/evidence-preview');

    const publicRes = await request(app).get(`/api/holdpoints/public/${chaseToken!}`);
    expect(publicRes.status).toBe(200);
  });

  it('rejects explicit release request recipients who cannot approve superintendent-only hold points', async () => {
    clearEmailQueue();
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId } });
    const foreman = await registerTestUser('Hold Points Request Foreman', 'foreman', companyId);
    createdUserIds.push(foreman.userId);
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });
    clearEmailQueue();

    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${foreman.token}`)
      .send({
        lotId,
        itpChecklistItemId: checklistItemId,
        notificationSentTo: foreman.email,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('superintendent approval');
    await expect(prisma.holdPointReleaseToken.count({ where: { holdPointId } })).resolves.toBe(0);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('rejects invalid notification recipient lists', async () => {
    clearEmailQueue();

    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lotId,
        itpChecklistItemId: checklistItemId,
        notificationSentTo: 'qa@example.com, not-an-email',
      });

    expect(res.status).toBe(400);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('rejects invalid release request schedule inputs without side effects', async () => {
    clearEmailQueue();
    const tokenCountBefore = await prisma.holdPointReleaseToken.count({ where: { holdPointId } });
    const invalidBodies = [
      {
        lotId,
        itpChecklistItemId: checklistItemId,
        scheduledDate: '2026-02-30',
        notificationSentTo: 'date-reviewer@example.com',
      },
      {
        lotId,
        itpChecklistItemId: checklistItemId,
        scheduledDate: '2026-02-30T10:00:00Z',
        notificationSentTo: 'datetime-reviewer@example.com',
      },
      {
        lotId,
        itpChecklistItemId: checklistItemId,
        scheduledTime: '25:61',
        notificationSentTo: 'time-reviewer@example.com',
      },
      {
        lotId,
        itpChecklistItemId: checklistItemId,
        noticePeriodOverride: true,
        notificationSentTo: 'override-reviewer@example.com',
      },
    ];

    for (const body of invalidBodies) {
      const res = await request(app)
        .post('/api/holdpoints/request-release')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

      expect(res.status).toBe(400);
    }

    const tokenCountAfter = await prisma.holdPointReleaseToken.count({ where: { holdPointId } });
    expect(tokenCountAfter).toBe(tokenCountBefore);
    expect(getQueuedEmails()).toHaveLength(0);
  });

  it('rejects invalid notification timing requests instead of throwing server errors', async () => {
    const res = await request(app)
      .post('/api/holdpoints/calculate-notification-time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectId, requestedDateTime: 'not-a-date' });

    expect(res.status).toBe(400);

    const invalidCalendarDateTimeRes = await request(app)
      .post('/api/holdpoints/calculate-notification-time')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ projectId, requestedDateTime: '2026-02-30T10:00:00Z' });

    expect(invalidCalendarDateTimeRes.status).toBe(400);
  });

  it('rejects same-company users without active project access from listing hold points', async () => {
    const user = await registerTestUser('Hold Points Same Company Viewer', 'viewer', companyId);
    createdUserIds.push(user.userId);

    const res = await request(app)
      .get(`/api/holdpoints/project/${projectId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(403);
  });

  it('rejects company project managers without active project membership from requesting release', async () => {
    const user = await registerTestUser('Hold Points Rogue PM', 'project_manager', companyId);
    createdUserIds.push(user.userId);

    const res = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ lotId, itpChecklistItemId: checklistItemId });

    expect(res.status).toBe(403);
  });

  it('rejects active viewers from releasing hold points', async () => {
    const user = await registerTestUser('Hold Points Project Viewer', 'viewer', companyId);
    createdUserIds.push(user.userId);
    await prisma.projectUser.create({
      data: { projectId, userId: user.userId, role: 'viewer', status: 'active' },
    });

    const res = await request(app)
      .post(`/api/holdpoints/${holdPointId}/release`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        releasedByName: 'Unauthorized Viewer',
        releasedByOrg: 'SiteProof QA',
        releaseMethod: 'digital',
      });

    expect(res.status).toBe(403);

    const holdPoint = await prisma.holdPoint.findUnique({ where: { id: holdPointId } });
    expect(holdPoint?.status).toBe('notified');
  });

  it('escalates and resolves hold points with notifications and audit history', async () => {
    const qualityManager = await registerTestUser('Hold Points Quality Manager', 'user', companyId);
    createdUserIds.push(qualityManager.userId);
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: qualityManager.userId,
        role: 'quality_manager',
        status: 'active',
      },
    });

    const hp = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        description: 'Escalation coverage hold point',
        status: 'notified',
      },
    });

    try {
      const escalateRes = await request(app)
        .post(`/api/holdpoints/${hp.id}/escalate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          escalatedTo: 'quality_manager',
          escalationReason: 'Release is blocking the lot.',
        });

      expect(escalateRes.status).toBe(200);
      expect(escalateRes.body.message).toBe('Hold point escalated successfully');
      expect(escalateRes.body.holdPoint).toMatchObject({
        id: hp.id,
        isEscalated: true,
        escalatedById: adminUserId,
        escalatedTo: 'quality_manager',
        escalationReason: 'Release is blocking the lot.',
      });
      expect(
        escalateRes.body.notifiedUsers.some(
          (user: { email: string; role: string }) =>
            user.email === qualityManager.email && user.role === 'quality_manager',
        ),
      ).toBe(true);

      const notifications = await prisma.notification.findMany({
        where: {
          projectId,
          type: 'hold_point_escalation',
          linkUrl: { contains: hp.id },
        },
      });
      expect(
        notifications.some((notification) => notification.userId === qualityManager.userId),
      ).toBe(true);

      const escalateAudit = await prisma.auditLog.findFirst({
        where: { entityId: hp.id, action: AuditAction.HP_ESCALATED },
      });
      expect(escalateAudit?.userId).toBe(adminUserId);
      expect(parseAuditLogChanges(escalateAudit?.changes ?? null)).toMatchObject({
        escalatedTo: 'quality_manager',
        escalationReason: 'Release is blocking the lot.',
      });

      const resolveRes = await request(app)
        .post(`/api/holdpoints/${hp.id}/resolve-escalation`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.message).toBe('Escalation resolved');
      expect(resolveRes.body.holdPoint).toMatchObject({
        id: hp.id,
        isEscalated: true,
        escalationResolved: true,
      });

      const resolvedHoldPoint = await prisma.holdPoint.findUniqueOrThrow({
        where: { id: hp.id },
      });
      expect(resolvedHoldPoint.isEscalated).toBe(true);
      expect(resolvedHoldPoint.escalationResolved).toBe(true);
      expect(resolvedHoldPoint.escalationResolvedAt).not.toBeNull();

      const resolveAudit = await prisma.auditLog.findFirst({
        where: { entityId: hp.id, action: AuditAction.HP_ESCALATION_RESOLVED },
      });
      expect(resolveAudit?.userId).toBe(adminUserId);
      expect(parseAuditLogChanges(resolveAudit?.changes ?? null)).toMatchObject({
        escalationResolved: true,
      });

      const duplicateResolveRes = await request(app)
        .post(`/api/holdpoints/${hp.id}/resolve-escalation`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(duplicateResolveRes.status).toBe(400);
      expect(duplicateResolveRes.body.error.message).toContain('not currently escalated');
      await expect(
        prisma.auditLog.count({
          where: { entityId: hp.id, action: AuditAction.HP_ESCALATION_RESOLVED },
        }),
      ).resolves.toBe(1);
    } finally {
      await prisma.notification.deleteMany({
        where: { projectId, type: 'hold_point_escalation', linkUrl: { contains: hp.id } },
      });
      await prisma.auditLog.deleteMany({ where: { entityId: hp.id } });
      await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
    }
  });

  it('rejects resolving hold points that were never escalated', async () => {
    const hp = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        description: 'Never escalated hold point',
        status: 'notified',
      },
    });

    try {
      const res = await request(app)
        .post(`/api/holdpoints/${hp.id}/resolve-escalation`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('not currently escalated');

      const unchangedHoldPoint = await prisma.holdPoint.findUniqueOrThrow({
        where: { id: hp.id },
      });
      expect(unchangedHoldPoint.isEscalated).toBe(false);
      expect(unchangedHoldPoint.escalationResolved).toBe(false);
      expect(unchangedHoldPoint.escalationResolvedAt).toBeNull();
    } finally {
      await prisma.holdPoint.delete({ where: { id: hp.id } }).catch(() => {});
    }
  });

  it('rejects chasing or escalating released hold points', async () => {
    const releasedHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        description: 'Released hold point',
        status: 'released',
        releasedAt: new Date(),
      },
    });

    try {
      const chaseRes = await request(app)
        .post(`/api/holdpoints/${releasedHoldPoint.id}/chase`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(chaseRes.status).toBe(400);

      const escalateRes = await request(app)
        .post(`/api/holdpoints/${releasedHoldPoint.id}/escalate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ escalationReason: 'Should not escalate released work' });
      expect(escalateRes.status).toBe(400);

      const unchangedHoldPoint = await prisma.holdPoint.findUniqueOrThrow({
        where: { id: releasedHoldPoint.id },
      });
      expect(unchangedHoldPoint.chaseCount).toBe(0);
      expect(unchangedHoldPoint.isEscalated).toBe(false);
    } finally {
      await prisma.holdPoint.delete({ where: { id: releasedHoldPoint.id } }).catch(() => {});
    }
  });

  it('rejects unreadable hold point evidence packages', async () => {
    const otherCompany = await prisma.company.create({
      data: { name: `Hold Points Other Company ${Date.now()}` },
    });
    const outsider = await registerTestUser('Hold Points Outsider', 'admin', otherCompany.id);

    try {
      const res = await request(app)
        .get(`/api/holdpoints/${holdPointId}/evidence-package`)
        .set('Authorization', `Bearer ${outsider.token}`);

      expect(res.status).toBe(403);
    } finally {
      await cleanupTestUser(outsider.userId);
      await prisma.company.delete({ where: { id: otherCompany.id } }).catch(() => {});
    }
  });
});

describe('Hold Point Token Release', () => {
  let companyId: string;
  let projectId: string;
  let lotId: string;
  let templateId: string;
  let checklistItemId: string;
  let completionId: string;
  let holdPointId: string;
  let releaseToken: string;
  let evidenceDocumentId: string;
  let evidenceFilePath: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Token Test Company ${Date.now()}` },
    });
    companyId = company.id;

    const project = await prisma.project.create({
      data: {
        name: `Token Test Project ${Date.now()}`,
        projectNumber: `TOK-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const template = await prisma.iTPTemplate.create({
      data: {
        projectId,
        name: 'Token Test Template',
        activityType: 'Earthworks',
      },
    });
    templateId = template.id;

    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId,
        description: 'External Hold Point',
        pointType: 'hold_point',
        sequenceNumber: 1,
      },
    });
    checklistItemId = checklistItem.id;
    const templateSnapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });

    const lot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TOK-LOT-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    lotId = lot.id;

    const itpInstance = await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId,
        templateSnapshot: JSON.stringify(buildTemplateSnapshot(templateSnapshotSource)),
        status: 'not_started',
      },
    });
    await prisma.iTPTemplate.update({
      where: { id: templateId },
      data: { name: 'Live Mutated Token Template' },
    });
    await prisma.iTPChecklistItem.update({
      where: { id: checklistItemId },
      data: { description: 'Live Mutated External Hold Point' },
    });
    const completion = await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: itpInstance.id,
        checklistItemId,
        status: 'completed',
      },
    });
    completionId = completion.id;
    const evidenceFilename = `public-hp-evidence-${Date.now()}.pdf`;
    const evidenceUploadDir = path.join(process.cwd(), 'uploads', 'documents');
    evidenceFilePath = path.join(evidenceUploadDir, evidenceFilename);
    fs.mkdirSync(evidenceUploadDir, { recursive: true });
    fs.writeFileSync(evidenceFilePath, Buffer.from('%PDF-1.4 public hold point evidence'));
    const evidenceDocument = await prisma.document.create({
      data: {
        projectId,
        lotId,
        documentType: 'photo',
        category: 'itp_evidence',
        filename: 'release-evidence.pdf',
        fileUrl: `/uploads/documents/${evidenceFilename}`,
        mimeType: 'application/pdf',
      },
    });
    evidenceDocumentId = evidenceDocument.id;
    await prisma.iTPCompletionAttachment.create({
      data: {
        completionId,
        documentId: evidenceDocument.id,
      },
    });

    const hp = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: 'pending',
      },
    });
    holdPointId = hp.id;

    const rawToken = `test-token-${Date.now()}`;
    const token = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: hashHoldPointReleaseTokenForTest(rawToken),
        recipientEmail: 'external@example.com',
        recipientName: 'External Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    expect(token.token).toMatch(/^sha256:[a-f0-9]{64}$/);
    releaseToken = rawToken;
  });

  afterAll(async () => {
    await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId } });
    await prisma.holdPoint.deleteMany({ where: { lotId } });
    await prisma.iTPCompletionAttachment.deleteMany({ where: { completionId } });
    await prisma.document.deleteMany({ where: { id: evidenceDocumentId } });
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
    if (evidenceFilePath) {
      fs.rmSync(evidenceFilePath, { force: true });
    }
  });

  it('should get hold point by public token', async () => {
    const res = await request(app).get(`/api/holdpoints/public/${releaseToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evidencePackage).toBeDefined();
    expect(res.body.evidencePackage.holdPoint).toBeDefined();
    expect(res.body.evidencePackage.itpTemplate.name).toBe('Token Test Template');
    expect(res.body.evidencePackage.checklist).toEqual(
      expect.arrayContaining([expect.objectContaining({ description: 'External Hold Point' })]),
    );
    expect(JSON.stringify(res.body.evidencePackage.checklist)).not.toContain(
      'Live Mutated External Hold Point',
    );
    expect(res.body.evidencePackage.checklist[0].attachments[0]).toMatchObject({
      documentId: evidenceDocumentId,
      filename: 'release-evidence.pdf',
    });
    expect(JSON.stringify(res.body.evidencePackage)).not.toContain('/uploads/documents/');
    expect(res.body.tokenInfo).toBeDefined();
  });

  it('should download only documents scoped to the public evidence package', async () => {
    const res = await request(app).get(
      `/api/holdpoints/public/${releaseToken}/documents/${evidenceDocumentId}?disposition=inline`,
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('inline');

    const deniedRes = await request(app).get(
      `/api/holdpoints/public/${releaseToken}/documents/not-in-package`,
    );
    expect(deniedRes.status).toBe(403);
  });

  it('should reject plaintext public token storage', async () => {
    const plaintextToken = `plaintext-token-${Date.now()}`;

    await expect(
      prisma.holdPointReleaseToken.create({
        data: {
          holdPointId,
          token: plaintextToken,
          recipientEmail: 'plaintext-external@example.com',
          recipientName: 'Plaintext External Reviewer',
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      }),
    ).rejects.toThrow();
  });

  it('should reject public release tokens for ineligible recipients on superintendent-only projects', async () => {
    const originalProject = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { settings: true },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { settings: JSON.stringify({ hpApprovalRequirement: 'superintendent' }) },
    });

    try {
      const res = await request(app).post(`/api/holdpoints/public/${releaseToken}/release`).send({
        releasedByName: 'External Reviewer',
        releasedByOrg: 'Client Company',
        signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      });

      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain('superintendent approval');

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.status).not.toBe('released');

      const usedToken = await prisma.holdPointReleaseToken.findFirstOrThrow({
        where: { holdPointId },
      });
      expect(usedToken.usedAt).toBeNull();

      const completion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
      });
      expect(completion.verificationStatus).toBe('none');
      expect(completion.verifiedAt).toBeNull();
    } finally {
      await prisma.project.update({
        where: { id: projectId },
        data: { settings: originalProject.settings },
      });
      await prisma.holdPoint.update({
        where: { id: holdPointId },
        data: {
          status: 'pending',
          releasedAt: null,
          releasedByName: null,
          releasedByOrg: null,
          releaseMethod: null,
          releaseSignatureUrl: null,
          releaseNotes: null,
        },
      });
      await prisma.holdPointReleaseToken.updateMany({
        where: { holdPointId },
        data: {
          usedAt: null,
          releasedByName: null,
          releasedByOrg: null,
          releaseSignatureUrl: null,
          releaseNotes: null,
        },
      });
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
        },
      });
    }
  });

  it('rejects an unused public release token for a completed hold point without consuming it', async () => {
    const completedLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TOK-COMPLETE-LOT-${Date.now()}`,
        status: 'completed',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const completedTemplateSnapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    const completedItpInstance = await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId: completedLot.id,
        templateSnapshot: JSON.stringify(buildTemplateSnapshot(completedTemplateSnapshotSource)),
        status: 'completed',
      },
    });
    const completedHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId: completedLot.id,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: 'completed',
      },
    });
    const rawCompletedToken = `completed-public-token-${Date.now()}`;
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: completedHoldPoint.id,
        token: hashHoldPointReleaseTokenForTest(rawCompletedToken),
        recipientEmail: 'completed-public-external@example.com',
        recipientName: 'Completed Public Reviewer',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    try {
      const publicRes = await request(app).get(`/api/holdpoints/public/${rawCompletedToken}`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.evidencePackage.holdPoint.status).toBe('completed');
      expect(publicRes.body.tokenInfo.canRelease).toBe(false);

      const releaseRes = await request(app)
        .post(`/api/holdpoints/public/${rawCompletedToken}/release`)
        .send({
          releasedByName: 'Completed Public Reviewer',
          releasedByOrg: 'Client Company',
          signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
        });

      expect(releaseRes.status).toBe(400);
      expect(releaseRes.body.error.message).toContain('already been completed');

      const unchangedHoldPoint = await prisma.holdPoint.findUniqueOrThrow({
        where: { id: completedHoldPoint.id },
      });
      expect(unchangedHoldPoint.status).toBe('completed');
      expect(unchangedHoldPoint.releasedAt).toBeNull();

      const unusedToken = await prisma.holdPointReleaseToken.findFirstOrThrow({
        where: { holdPointId: completedHoldPoint.id },
      });
      expect(unusedToken.usedAt).toBeNull();
      expect(unusedToken.releasedByName).toBeNull();
    } finally {
      await prisma.holdPointReleaseToken.deleteMany({
        where: { holdPointId: completedHoldPoint.id },
      });
      await prisma.holdPoint.delete({ where: { id: completedHoldPoint.id } }).catch(() => {});
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: completedItpInstance.id },
      });
      await prisma.iTPInstance.delete({ where: { id: completedItpInstance.id } }).catch(() => {});
      await prisma.lot.delete({ where: { id: completedLot.id } }).catch(() => {});
    }
  });

  it('does not overwrite a failed ITP completion when public token releases a hold point', async () => {
    const rawFailedToken = `failed-public-token-${Date.now()}`;
    const failedToken = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: hashHoldPointReleaseTokenForTest(rawFailedToken),
        recipientEmail: 'failed-public-external@example.com',
        recipientName: 'Failed Public Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    await prisma.iTPCompletion.update({
      where: { id: completionId },
      data: {
        status: 'failed',
        verificationStatus: 'none',
        completedAt: null,
        verifiedAt: null,
        verifiedById: null,
      },
    });

    try {
      const res = await request(app).post(`/api/holdpoints/public/${rawFailedToken}/release`).send({
        releasedByName: 'Failed Public Reviewer',
        releasedByOrg: 'Client Company',
        releaseNotes: 'Should not overwrite the failed ITP outcome',
        signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toContain('Failed ITP hold-point items must be resubmitted');

      const unchangedCompletion = await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completionId },
      });
      expect(unchangedCompletion.status).toBe('failed');
      expect(unchangedCompletion.verificationStatus).toBe('none');
      expect(unchangedCompletion.verifiedAt).toBeNull();

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.status).not.toBe('released');

      const storedToken = await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { id: failedToken.id },
      });
      expect(storedToken.usedAt).toBeNull();
    } finally {
      await prisma.holdPointReleaseToken.delete({ where: { id: failedToken.id } }).catch(() => {});
      await prisma.holdPoint.update({
        where: { id: holdPointId },
        data: {
          status: 'pending',
          releasedAt: null,
          releasedByName: null,
          releasedByOrg: null,
          releaseMethod: null,
          releaseSignatureUrl: null,
          releaseNotes: null,
        },
      });
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          status: 'completed',
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
        },
      });
    }
  });

  it('should reject a public release token that expires between lookup and consume', async () => {
    const rawRaceToken = `expiry-race-token-${Date.now()}`;
    const raceToken = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: hashHoldPointReleaseTokenForTest(rawRaceToken),
        recipientEmail: 'expiry-race@example.com',
        recipientName: 'Expiry Race Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    let middlewareActive = true;

    prisma.$use(async (params, next) => {
      if (
        middlewareActive &&
        params.model === 'HoldPointReleaseToken' &&
        params.action === 'updateMany' &&
        (params.args?.where as { id?: string } | undefined)?.id === raceToken.id
      ) {
        middlewareActive = false;
        await prisma.holdPointReleaseToken.update({
          where: { id: raceToken.id },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
      }

      return next(params);
    });

    try {
      const res = await request(app).post(`/api/holdpoints/public/${rawRaceToken}/release`).send({
        releasedByName: 'Expiry Race Reviewer',
        releasedByOrg: 'Client Company',
        releaseNotes: 'Should be rejected because the token expired during consume',
        signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      });

      expect(res.status).toBe(410);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');

      const storedToken = await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { id: raceToken.id },
      });
      expect(storedToken.usedAt).toBeNull();

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.status).not.toBe('released');
    } finally {
      middlewareActive = false;
      await prisma.holdPointReleaseToken.delete({ where: { id: raceToken.id } }).catch(() => {});
      await prisma.holdPoint.update({
        where: { id: holdPointId },
        data: {
          status: 'pending',
          releasedAt: null,
          releasedByName: null,
          releasedByOrg: null,
          releaseMethod: null,
          releaseSignatureUrl: null,
          releaseNotes: null,
        },
      });
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
        },
      });
    }
  });

  it('should bind public release identity to the token recipient when present', async () => {
    const rawIdentityToken = `identity-token-${Date.now()}`;
    const identityToken = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: hashHoldPointReleaseTokenForTest(rawIdentityToken),
        recipientEmail: 'named-superintendent@example.com',
        recipientName: 'Named Superintendent',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    try {
      const res = await request(app)
        .post(`/api/holdpoints/public/${rawIdentityToken}/release`)
        .send({
          releasedByName: 'Imposter Name',
          releasedByOrg: 'Client Company',
          releaseNotes: 'Approved externally',
          signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
        });

      expect(res.status).toBe(200);
      expect(res.body.holdPoint.releasedByName).toBe('Named Superintendent');

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.releasedByName).toBe('Named Superintendent');

      const usedToken = await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { id: identityToken.id },
      });
      expect(usedToken.releasedByName).toBe('Named Superintendent');
    } finally {
      await prisma.holdPointReleaseToken
        .delete({ where: { id: identityToken.id } })
        .catch(() => {});
      await prisma.holdPoint.update({
        where: { id: holdPointId },
        data: {
          status: 'pending',
          releasedAt: null,
          releasedByName: null,
          releasedByOrg: null,
          releaseMethod: null,
          releaseSignatureUrl: null,
          releaseNotes: null,
        },
      });
      await prisma.iTPCompletion.update({
        where: { id: completionId },
        data: {
          verificationStatus: 'none',
          verifiedAt: null,
          verifiedById: null,
        },
      });
    }
  });

  it('creates the ITP completion when a public token releases a never-ticked hold point', async () => {
    const freshLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TOK-FRESH-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const templateSnapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    const freshInstance = await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId: freshLot.id,
        templateSnapshot: JSON.stringify(buildTemplateSnapshot(templateSnapshotSource)),
        status: 'not_started',
      },
    });
    const freshHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId: freshLot.id,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: 'pending',
      },
    });
    const rawFreshToken = `fresh-public-token-${Date.now()}`;
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: freshHoldPoint.id,
        token: hashHoldPointReleaseTokenForTest(rawFreshToken),
        recipientEmail: 'fresh-external@example.com',
        recipientName: 'Fresh External Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    try {
      const before = await prisma.iTPCompletion.findUnique({
        where: {
          itpInstanceId_checklistItemId: {
            itpInstanceId: freshInstance.id,
            checklistItemId,
          },
        },
      });
      expect(before).toBeNull();

      const res = await request(app).post(`/api/holdpoints/public/${rawFreshToken}/release`).send({
        releasedByName: 'Fresh External Reviewer',
        releasedByOrg: 'Client Company',
        releaseNotes: 'Approved from secure link before anyone ticked the ITP item',
        signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      });

      expect(res.status).toBe(200);
      expect(res.body.holdPoint.status).toBe('released');

      const created = await prisma.iTPCompletion.findUniqueOrThrow({
        where: {
          itpInstanceId_checklistItemId: {
            itpInstanceId: freshInstance.id,
            checklistItemId,
          },
        },
      });
      expect(created.status).toBe('completed');
      expect(created.completedAt).toBeInstanceOf(Date);
      expect(created.completedById).toBeNull();
      expect(created.verificationStatus).toBe('verified');
      expect(created.verifiedAt).toBeInstanceOf(Date);
      expect(created.verifiedById).toBeNull();

      const updatedLot = await prisma.lot.findUniqueOrThrow({ where: { id: freshLot.id } });
      expect(updatedLot.status).toBe('completed');
      const updatedInstance = await prisma.iTPInstance.findUniqueOrThrow({
        where: { id: freshInstance.id },
      });
      expect(updatedInstance.status).toBe('completed');
    } finally {
      await prisma.holdPointReleaseToken.deleteMany({ where: { holdPointId: freshHoldPoint.id } });
      await prisma.holdPoint.delete({ where: { id: freshHoldPoint.id } }).catch(() => {});
      await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: freshInstance.id } });
      await prisma.iTPInstance.delete({ where: { id: freshInstance.id } }).catch(() => {});
      await prisma.lot.delete({ where: { id: freshLot.id } }).catch(() => {});
    }
  });

  it('suppresses public release notifications and emails when the project toggle is off', async () => {
    const originalProject = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { settings: true },
    });
    const foreman = await registerTestUser('HP Public Release Foreman Off', 'user', companyId);
    const publicToggleHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: 'pending',
      },
    });
    const rawToggleToken = `toggle-public-token-${Date.now()}`;
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: publicToggleHoldPoint.id,
        token: hashHoldPointReleaseTokenForTest(rawToggleToken),
        recipientEmail: 'toggle-public-external@example.com',
        recipientName: 'Toggle Public External Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: {
        settings: JSON.stringify({ notificationPreferences: { holdPointReleases: false } }),
      },
    });

    try {
      clearEmailQueue();
      const res = await request(app).post(`/api/holdpoints/public/${rawToggleToken}/release`).send({
        releasedByName: 'Toggle Public External Reviewer',
        releasedByOrg: 'Client Company',
        releaseNotes: 'Project toggle should suppress team notifications',
        signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      });

      expect(res.status).toBe(200);
      expect(res.body.holdPoint.status).toBe('released');

      const notifications = await prisma.notification.findMany({
        where: { projectId, type: 'hold_point_release' },
      });
      expect(notifications).toHaveLength(0);
      expect(getQueuedEmails()).toHaveLength(0);
    } finally {
      await prisma.project.update({
        where: { id: projectId },
        data: { settings: originalProject.settings },
      });
      await prisma.notification.deleteMany({ where: { projectId, type: 'hold_point_release' } });
      await prisma.holdPointReleaseToken.deleteMany({
        where: { holdPointId: publicToggleHoldPoint.id },
      });
      await prisma.holdPoint.delete({ where: { id: publicToggleHoldPoint.id } }).catch(() => {});
      await prisma.projectUser.deleteMany({ where: { projectId, userId: foreman.userId } });
      await cleanupTestUser(foreman.userId);
      clearEmailQueue();
    }
  });

  it('formats public release confirmation email timestamps in the project timezone', async () => {
    const originalProject = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { state: true, settings: true },
    });
    const foreman = await registerTestUser('HP Public Release WA Foreman', 'user', companyId);
    const timezoneLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TOK-WA-TZ-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const templateSnapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    const timezoneItpInstance = await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId: timezoneLot.id,
        templateSnapshot: JSON.stringify(buildTemplateSnapshot(templateSnapshotSource)),
        status: 'not_started',
      },
    });
    const timezoneHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId: timezoneLot.id,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: 'pending',
      },
    });
    const rawTimezoneToken = `timezone-public-token-${Date.now()}`;
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: timezoneHoldPoint.id,
        token: hashHoldPointReleaseTokenForTest(rawTimezoneToken),
        recipientEmail: 'timezone-public-external@example.com',
        recipientName: 'Timezone Public External Reviewer',
        expiresAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    });
    await prisma.projectUser.create({
      data: { projectId, userId: foreman.userId, role: 'foreman', status: 'active' },
    });
    await prisma.project.update({
      where: { id: projectId },
      data: { state: 'WA', settings: null },
    });

    const releasedAt = new Date('2026-01-01T17:30:00.000Z');
    const expectedReleasedAtDisplay = releasedAt.toLocaleString('en-AU', {
      timeZone: projectTimeZoneFromState('WA'),
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    try {
      clearEmailQueue();
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(releasedAt);

      const res = await request(app)
        .post(`/api/holdpoints/public/${rawTimezoneToken}/release`)
        .send({
          releasedByName: 'Timezone Public External Reviewer',
          releasedByOrg: 'Client Company',
          releaseNotes: 'Project timezone should be used',
          signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
        });

      expect(res.status).toBe(200);

      const confirmationEmail = getQueuedEmails().find(
        (email) => email.to === foreman.email && email.text?.includes('RELEASE DETAILS'),
      );
      expect(confirmationEmail?.text).toContain(`Released At: ${expectedReleasedAtDisplay}`);
    } finally {
      vi.useRealTimers();
      await prisma.project.update({
        where: { id: projectId },
        data: {
          state: originalProject.state,
          settings: originalProject.settings,
        },
      });
      await prisma.notification.deleteMany({ where: { projectId, type: 'hold_point_release' } });
      await prisma.holdPointReleaseToken.deleteMany({
        where: { holdPointId: timezoneHoldPoint.id },
      });
      await prisma.holdPoint.delete({ where: { id: timezoneHoldPoint.id } }).catch(() => {});
      await prisma.iTPCompletion.deleteMany({
        where: { itpInstanceId: timezoneItpInstance.id },
      });
      await prisma.iTPInstance.delete({ where: { id: timezoneItpInstance.id } }).catch(() => {});
      await prisma.lot.delete({ where: { id: timezoneLot.id } }).catch(() => {});
      await prisma.projectUser.deleteMany({ where: { projectId, userId: foreman.userId } });
      await cleanupTestUser(foreman.userId);
      clearEmailQueue();
    }
  });

  it('triggers a hold point released webhook after public secure-link release', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('accepted', { status: 200 })));
    const webhook = await prisma.webhookConfig.create({
      data: {
        companyId,
        url: 'https://example.com/siteproof-public-hold-point-release-events',
        secret: 'test-webhook-secret',
        events: JSON.stringify(['hold_point.released']),
        enabled: true,
      },
    });
    const webhookLot = await prisma.lot.create({
      data: {
        projectId,
        lotNumber: `TOK-WEBHOOK-${Date.now()}`,
        status: 'not_started',
        lotType: 'chainage',
        activityType: 'Earthworks',
      },
    });
    const templateSnapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
      where: { id: templateId },
      include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
    });
    const webhookInstance = await prisma.iTPInstance.create({
      data: {
        templateId,
        lotId: webhookLot.id,
        templateSnapshot: JSON.stringify(buildTemplateSnapshot(templateSnapshotSource)),
        status: 'not_started',
      },
    });
    const webhookHoldPoint = await prisma.holdPoint.create({
      data: {
        lotId: webhookLot.id,
        itpChecklistItemId: checklistItemId,
        pointType: 'hold_point',
        status: 'pending',
      },
    });
    const rawWebhookToken = `webhook-public-token-${Date.now()}`;
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: webhookHoldPoint.id,
        token: hashHoldPointReleaseTokenForTest(rawWebhookToken),
        recipientEmail: 'public-webhook-external@example.com',
        recipientName: 'Public Webhook External Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    try {
      const res = await request(app)
        .post(`/api/holdpoints/public/${rawWebhookToken}/release`)
        .send({
          releasedByName: 'Submitted Public Name',
          releasedByOrg: 'Client Company',
          releaseNotes: 'Approved from secure link',
          signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
        });

      expect(res.status).toBe(200);
      expect(res.body.holdPoint.status).toBe('released');

      const deliveries = await waitForWebhookDeliveries(webhook.id, 1, (delivery) =>
        Boolean(delivery.success && deliveryPayloadContains(delivery, webhookHoldPoint.id)),
      );
      const delivery = deliveries.find((item) =>
        Boolean(item.success && deliveryPayloadContains(item, webhookHoldPoint.id)),
      );
      expect(delivery).toBeDefined();
      expect(delivery).toMatchObject({
        event: 'hold_point.released',
        success: true,
        responseStatus: 200,
      });
      expect(delivery?.payload).toMatchObject({
        event: 'hold_point.released',
        data: {
          holdPointId: webhookHoldPoint.id,
          projectId,
          lotId: webhookLot.id,
          lotNumber: webhookLot.lotNumber,
          itpChecklistItemId: checklistItemId,
          status: 'released',
          actorUserId: null,
          action: 'released',
          releaseSource: 'public_secure_link',
          releaseMethod: 'secure_link',
          releasedByName: 'Public Webhook External Reviewer',
          releasedByOrg: 'Client Company',
          releaseEvidenceDocumentId: null,
          hasReleaseNotes: true,
        },
      });
      const serializedPayload = JSON.stringify(delivery?.payload);
      expect(serializedPayload).not.toContain('public-webhook-external@example.com');
      expect(serializedPayload).not.toContain(rawWebhookToken);
      expect(serializedPayload).not.toContain('/hp-release/');
      expect(serializedPayload).not.toContain('sha256:');
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      await prisma.webhookDelivery.deleteMany({ where: { webhookId: webhook.id } });
      await prisma.webhookConfig.delete({ where: { id: webhook.id } }).catch(() => {});
      await prisma.holdPointReleaseToken.deleteMany({
        where: { holdPointId: webhookHoldPoint.id },
      });
      await prisma.holdPoint.delete({ where: { id: webhookHoldPoint.id } }).catch(() => {});
      await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: webhookInstance.id } });
      await prisma.iTPInstance.delete({ where: { id: webhookInstance.id } }).catch(() => {});
      await prisma.lot.delete({ where: { id: webhookLot.id } }).catch(() => {});
      fetchMock.mockRestore();
    }
  });

  it('should release hold point via public token', async () => {
    const res = await request(app).post(`/api/holdpoints/public/${releaseToken}/release`).send({
      releasedByName: 'External Reviewer',
      releasedByOrg: 'Client Company',
      releaseNotes: 'Approved externally',
      signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
    });

    expect(res.status).toBe(200);
    expect(res.body.holdPoint.status).toBe('released');
    expect(res.body.holdPoint.releaseNotes).toBe('Approved externally');

    const usedToken = await prisma.holdPointReleaseToken.findFirstOrThrow({
      where: { holdPointId },
    });
    expect(usedToken.usedAt).toBeInstanceOf(Date);
    expect(usedToken.releaseNotes).toBe('Approved externally');

    const completion = await prisma.iTPCompletion.findUniqueOrThrow({
      where: { id: completionId },
    });
    expect(completion.verificationStatus).toBe('verified');
    expect(completion.verifiedAt).toBeInstanceOf(Date);
    // I1-core: the tokenised release also completes the ITP item. There is no
    // authenticated user on the public path, so completedById / verifiedById
    // stay null — attribution lives on the HoldPoint.
    expect(completion.status).toBe('completed');
    expect(completion.completedAt).toBeInstanceOf(Date);
    expect(completion.completedById).toBeNull();
    expect(completion.verifiedById).toBeNull();
  });

  it('should reopen a used public release token as read-only evidence', async () => {
    const res = await request(app).get(`/api/holdpoints/public/${releaseToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evidencePackage.holdPoint.status).toBe('released');
    expect(res.body.tokenInfo.canRelease).toBe(false);
    expect(res.body.evidencePackage.checklist[0].attachments[0]).toMatchObject({
      documentId: evidenceDocumentId,
      filename: 'release-evidence.pdf',
    });
  });

  it('should reject reuse of a public release token', async () => {
    const res = await request(app).post(`/api/holdpoints/public/${releaseToken}/release`).send({
      releasedByName: 'External Reviewer',
      releasedByOrg: 'Client Company',
      signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
    });

    expect(res.status).toBe(410);
  });
});

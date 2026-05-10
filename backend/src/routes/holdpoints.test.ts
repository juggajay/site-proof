import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { authRouter } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { holdpointsRouter } from './holdpoints.js';
import { clearEmailQueue, getQueuedEmails } from '../lib/email.js';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const TEST_PASSWORD = 'SecureP@ssword123!';

function hashHoldPointReleaseTokenForTest(token: string): string {
  return `sha256:${crypto.createHash('sha256').update(token).digest('hex')}`;
}

async function registerTestUser(fullName: string, roleInCompany: string, companyId: string) {
  const email = `${fullName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    fullName,
    tosAccepted: true,
  });

  await prisma.user.update({
    where: { id: res.body.user.id },
    data: { companyId, roleInCompany },
  });

  return { token: res.body.token as string, userId: res.body.user.id as string };
}

async function cleanupTestUser(userId: string) {
  await prisma.projectUser.deleteMany({ where: { userId } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
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

    const testEmail = `hp-test-${Date.now()}@example.com`;
    const regRes = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: TEST_PASSWORD,
      fullName: 'HP Test User',
      tosAccepted: true,
    });
    authToken = regRes.body.token;
    userId = regRes.body.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { companyId, roleInCompany: 'admin' },
    });

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
  });

  describe('GET /api/holdpoints/lot/:lotId/item/:itemId', () => {
    it('should get hold point for specific lot and item', async () => {
      const res = await request(app)
        .get(`/api/holdpoints/lot/${lotId}/item/${checklistItemId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 404]).toContain(res.status);
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

  describe('POST /api/holdpoints/:id/release', () => {
    let holdPointId: string;
    let completionId: string;

    beforeAll(async () => {
      const hp = await prisma.holdPoint.create({
        data: {
          lotId,
          itpChecklistItemId: checklistItemId,
          pointType: 'hold_point',
          status: 'pending',
        },
      });
      holdPointId = hp.id;

      const itpInstance = await prisma.iTPInstance.findUniqueOrThrow({
        where: { lotId },
        select: { id: true },
      });
      const completion = await prisma.iTPCompletion.create({
        data: {
          itpInstanceId: itpInstance.id,
          checklistItemId,
          status: 'completed',
        },
      });
      completionId = completion.id;
    });

    it('should reject invalid release date inputs without releasing the hold point', async () => {
      const res = await request(app)
        .post(`/api/holdpoints/${holdPointId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          releasedByName: 'HP Test User',
          releaseDate: '2026-02-30T10:00:00Z',
          releaseNotes: 'Invalid release date',
        });

      expect(res.status).toBe(400);

      const holdPoint = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPointId } });
      expect(holdPoint.status).toBe('pending');
      expect(holdPoint.releasedAt).toBeNull();
    });

    it('should release hold point with notes', async () => {
      const res = await request(app)
        .post(`/api/holdpoints/${holdPointId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          releasedByName: 'HP Test User',
          releaseDate: '2026-01-20',
          releaseTime: '09:15',
          releaseNotes: 'Approved by QM',
          signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
        });

      const expectedReleasedAt = new Date(2026, 0, 20, 9, 15, 0, 0);
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
    });

    it('should reject releasing an already released hold point', async () => {
      const res = await request(app)
        .post(`/api/holdpoints/${holdPointId}/release`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          releasedByName: 'Second Releaser',
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
          status: 'pending',
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
      companyId,
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
      companyId,
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
        notificationSentTo: 'qa@example.com; inspector@example.com, qa@example.com',
      });

    expect(res.status).toBe(200);
    expect(res.body.holdPoint.notificationSentTo).toBe('qa@example.com, inspector@example.com');

    const tokens = await prisma.holdPointReleaseToken.findMany({
      where: { holdPointId },
      select: { recipientEmail: true, token: true },
      orderBy: { recipientEmail: 'asc' },
    });
    expect(tokens.map((token) => token.recipientEmail)).toEqual([
      'inspector@example.com',
      'qa@example.com',
    ]);
    expect(tokens.every((token) => /^sha256:[a-f0-9]{64}$/.test(token.token))).toBe(true);
    expect(tokens.map((token) => token.token)).not.toContain(
      hashHoldPointReleaseTokenForTest(staleToken),
    );

    const queuedEmails = getQueuedEmails();
    expect(queuedEmails.map((email) => email.to).sort()).toEqual([
      'inspector@example.com',
      'qa@example.com',
    ]);

    const rawToken = queuedEmails
      .map((email) => email.text?.match(/\/hp-release\/([a-f0-9]{64})/)?.[1])
      .find(Boolean);
    expect(rawToken).toBeDefined();
    expect(tokens.map((token) => token.token)).not.toContain(rawToken);

    const publicRes = await request(app).get(`/api/holdpoints/public/${rawToken!}`);
    expect(publicRes.status).toBe(200);

    const storedHashRes = await request(app).get(
      `/api/holdpoints/public/${encodeURIComponent(tokens[0].token)}`,
    );
    expect(storedHashRes.status).toBe(404);
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
        releaseMethod: 'digital',
      });

    expect(res.status).toBe(403);

    const holdPoint = await prisma.holdPoint.findUnique({ where: { id: holdPointId } });
    expect(holdPoint?.status).toBe('notified');
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
        status: 'not_started',
      },
    });
    const completion = await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: itpInstance.id,
        checklistItemId,
        status: 'completed',
      },
    });
    completionId = completion.id;

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
    await prisma.iTPInstance.deleteMany({ where: { lotId } });
    await prisma.lot.deleteMany({ where: { projectId } });
    await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
    await prisma.iTPTemplate.deleteMany({ where: { projectId } });
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
    await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
  });

  it('should get hold point by public token', async () => {
    const res = await request(app).get(`/api/holdpoints/public/${releaseToken}`);

    expect(res.status).toBe(200);
    expect(res.body.evidencePackage).toBeDefined();
    expect(res.body.evidencePackage.holdPoint).toBeDefined();
    expect(res.body.tokenInfo).toBeDefined();
  });

  it('should keep legacy plaintext public tokens valid until expiry', async () => {
    const legacyToken = `legacy-token-${Date.now()}`;
    const legacyRecord = await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId,
        token: legacyToken,
        recipientEmail: 'legacy-external@example.com',
        recipientName: 'Legacy External Reviewer',
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    try {
      const res = await request(app).get(`/api/holdpoints/public/${legacyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.evidencePackage).toBeDefined();
    } finally {
      await prisma.holdPointReleaseToken.delete({ where: { id: legacyRecord.id } }).catch(() => {});
    }
  });

  it('should release hold point via public token', async () => {
    const res = await request(app).post(`/api/holdpoints/public/${releaseToken}/release`).send({
      releasedByName: 'External Reviewer',
      releasedByOrg: 'Client Company',
      releaseNotes: 'Approved externally',
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
  });

  it('should reject reuse of a public release token', async () => {
    const res = await request(app).post(`/api/holdpoints/public/${releaseToken}/release`).send({
      releasedByName: 'External Reviewer',
      releasedByOrg: 'Client Company',
    });

    expect(res.status).toBe(410);
  });
});

import crypto from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { buildTemplateSnapshot } from '../itp/helpers/templateSnapshot.js';
import { holdpointsRouter } from '../holdpoints.js';
import {
  executePublicHoldPointRejection,
  loadPublicDecisionToken,
} from './publicDecisionExecution.js';

vi.mock('../../lib/email.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/email.js')>()),
  sendHPReleaseConfirmationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendHPReleaseRequestEmail: vi.fn().mockResolvedValue({ success: true, provider: 'test' }),
}));

vi.mock('./webhookEvents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./webhookEvents.js')>()),
  emitHoldPointWebhookEvent: vi.fn(),
}));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `hp-public-decisions-${Date.now()}`;
const signatureDataUrl = 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=';
const rejectionReason = 'The submitted evidence does not demonstrate specification compliance.';

let companyId: string;
let projectId: string;
let templateId: string;
let requesterId: string;
let requesterToken: string;
let qualityManagerId: string;
let superintendentId: string;
let superintendentToken: string;
let sequence = 0;

function hashToken(raw: string) {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

async function createFixture(
  options: {
    authorityClass?: 'principal' | 'contractor_internal';
    bindToken?: boolean;
    recipientEmail?: string;
    status?: string;
    withCompletion?: boolean;
  } = {},
) {
  sequence += 1;
  const item = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: `Decision item ${sequence}`,
      pointType: 'hold_point',
      sequenceNumber: sequence,
    },
  });
  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-LOT-${sequence}`,
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'Earthworks',
    },
  });
  const snapshotSource = await prisma.iTPTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { checklistItems: { orderBy: { sequenceNumber: 'asc' } } },
  });
  const instance = await prisma.iTPInstance.create({
    data: {
      templateId,
      lotId: lot.id,
      templateSnapshot: JSON.stringify(buildTemplateSnapshot(snapshotSource)),
      status: 'in_progress',
    },
  });
  if (options.withCompletion) {
    await prisma.iTPCompletion.create({
      data: {
        itpInstanceId: instance.id,
        checklistItemId: item.id,
        status: 'completed',
        verificationStatus: 'none',
      },
    });
  }
  const authorityClass = options.authorityClass ?? 'principal';
  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId: lot.id,
      itpChecklistItemId: item.id,
      pointType: 'hold_point',
      description: `Decision hold point ${sequence}`,
      status: options.status ?? 'notified',
      authorityClass,
    },
  });
  const round = await prisma.holdPointDecisionRound.create({
    data: {
      holdPointId: holdPoint.id,
      roundNumber: 1,
      authorityClass,
      requestedById: requesterId,
      recipientEmail: options.recipientEmail ?? `${tag}-authority@example.com`,
      recipientName: 'Named Authority',
    },
  });
  await prisma.holdPoint.update({
    where: { id: holdPoint.id },
    data: { currentRoundId: round.id },
  });
  const raw = `${tag}-token-${sequence}-${crypto.randomBytes(4).toString('hex')}`;
  const token = await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId: holdPoint.id,
      decisionRoundId: options.bindToken === false ? null : round.id,
      recipientEmail: options.recipientEmail ?? `${tag}-authority@example.com`,
      recipientName: 'Named Authority',
      token: hashToken(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return { item, lot, instance, holdPoint, round, raw, token };
}

function reject(raw: string) {
  return request(app)
    .post(`/api/holdpoints/public/${raw}/reject`)
    .send({ name: 'Submitted Name', org: 'Principal Org', reason: rejectionReason });
}

function conditionalRelease(raw: string) {
  return request(app)
    .post(`/api/holdpoints/public/${raw}/release-with-conditions`)
    .send({
      name: 'Submitted Name',
      org: 'Principal Org',
      conditions: ['Repair the edge before the next lift', 'Submit a closure photograph'],
      notes: 'Permission to proceed is conditional.',
      signatureDataUrl,
    });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Company ${tag}` } });
  companyId = company.id;

  const requester = await registerTestUser(app, {
    emailPrefix: `${tag}-requester`,
    fullName: 'Requesting PM',
    companyId,
    roleInCompany: 'admin',
  });
  requesterId = requester.userId;
  requesterToken = requester.token;
  const qm = await registerTestUser(app, {
    emailPrefix: `${tag}-qm`,
    fullName: 'Quality Manager',
    companyId,
    roleInCompany: 'member',
  });
  qualityManagerId = qm.userId;
  const superintendent = await registerTestUser(app, {
    emailPrefix: `${tag}-superintendent`,
    fullName: 'Project Superintendent',
    companyId,
    roleInCompany: 'member',
  });
  superintendentId = superintendent.userId;
  superintendentToken = superintendent.token;

  const project = await prisma.project.create({
    data: {
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      companyId,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;
  await prisma.projectUser.createMany({
    data: [
      { projectId, userId: requesterId, role: 'project_manager', status: 'active' },
      { projectId, userId: qualityManagerId, role: 'quality_manager', status: 'active' },
      { projectId, userId: superintendentId, role: 'superintendent', status: 'active' },
    ],
  });
  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Template ${tag}`, activityType: 'Earthworks' },
  });
  templateId = template.id;
});

afterEach(async () => {
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
  await prisma.project.update({
    where: { id: projectId },
    data: { settings: null, hpInternalReleaserIds: [] },
  });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lot: { projectId } } } });
  await prisma.holdPoint.deleteMany({ where: { lot: { projectId } } });
  await prisma.nCR.deleteMany({ where: { projectId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstance: { lot: { projectId } } } });
  await prisma.iTPInstance.deleteMany({ where: { lot: { projectId } } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
});

afterAll(async () => {
  await prisma.iTPTemplate.deleteMany({ where: { id: templateId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { id: projectId } });
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: [requesterId, qualityManagerId, superintendentId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [requesterId, qualityManagerId, superintendentId] } },
  });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('public hold-point rejection', () => {
  it('atomically decides the round, raises and links the NCR, links the lot, flips lot/HP state, resets chase, and notifies requester + QMs', async () => {
    const fixture = await createFixture();
    await prisma.holdPoint.update({
      where: { id: fixture.holdPoint.id },
      data: { chaseCount: 3, lastChasedAt: new Date(), notificationSentAt: new Date() },
    });

    const response = await reject(fixture.raw);
    expect(response.status).toBe(200);

    const round = await prisma.holdPointDecisionRound.findUniqueOrThrow({
      where: { id: fixture.round.id },
      include: { linkedNcr: { include: { ncrLots: true } } },
    });
    expect(round).toMatchObject({
      outcome: 'rejected',
      decidedByName: 'Named Authority',
      decisionReason: rejectionReason,
      decisionMethod: 'public_token',
    });
    expect(round.linkedNcr).toMatchObject({ category: 'other', raisedById: null, status: 'open' });
    expect(round.linkedNcr?.description.startsWith('[AUTHORITY-ORIGINATED')).toBe(true);
    expect(round.linkedNcr?.ncrLots).toEqual([expect.objectContaining({ lotId: fixture.lot.id })]);
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: fixture.lot.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'ncr_raised' });
    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: fixture.holdPoint.id },
        select: { status: true, chaseCount: true, lastChasedAt: true, notificationSentAt: true },
      }),
    ).toEqual({ status: 'pending', chaseCount: 0, lastChasedAt: null, notificationSentAt: null });
    expect(
      await prisma.notification.findMany({
        where: { projectId, type: 'hold_point_rejection' },
        select: { userId: true },
        orderBy: { userId: 'asc' },
      }),
    ).toEqual([requesterId, qualityManagerId].sort().map((userId) => ({ userId })));
  });

  it('rolls the round decision back when a failure is forced after the guarded decide', async () => {
    const fixture = await createFixture();
    const releaseToken = await loadPublicDecisionToken(fixture.raw);
    if (!releaseToken) throw new Error('test token missing');

    await expect(
      executePublicHoldPointRejection({
        releaseToken,
        reason: rejectionReason,
        testHooks: { afterRoundDecide: () => Promise.reject(new Error('forced crash window')) },
      }),
    ).rejects.toThrow('forced crash window');

    expect(
      await prisma.holdPointDecisionRound.findUniqueOrThrow({
        where: { id: fixture.round.id },
        select: { outcome: true, linkedNcrId: true },
      }),
    ).toEqual({ outcome: null, linkedNcrId: null });
    expect(await prisma.nCR.count({ where: { projectId } })).toBe(0);
    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: fixture.holdPoint.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'notified' });
    expect(
      await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { id: fixture.token.id },
        select: { usedAt: true },
      }),
    ).toEqual({ usedAt: null });
  });

  it('retries the whole decision transaction after an NCR-number P2002 collision', async () => {
    const fixture = await createFixture();
    const releaseToken = await loadPublicDecisionToken(fixture.raw);
    if (!releaseToken) throw new Error('test token missing');
    let attempts = 0;

    const result = await executePublicHoldPointRejection({
      releaseToken,
      reason: rejectionReason,
      testHooks: {
        afterRoundDecide: () => {
          attempts += 1;
          if (attempts === 1) {
            throw Object.assign(new Error('simulated NCR number collision'), {
              code: 'P2002',
              meta: { target: ['project_id', 'ncr_number'] },
            });
          }
        },
      },
    });

    expect(attempts).toBe(2);
    expect(result.ncr.ncrNumber).toMatch(/^NCR-\d+$/);
    expect(await prisma.nCR.count({ where: { projectId } })).toBe(1);
  });

  it('refuses a second decide and never creates a second NCR', async () => {
    const fixture = await createFixture();
    expect((await reject(fixture.raw)).status).toBe(200);
    expect((await reject(fixture.raw)).status).not.toBe(200);
    expect(await prisma.nCR.count({ where: { projectId } })).toBe(1);
  });

  it('re-checks recipient eligibility at decision time', async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { settings: JSON.stringify({ hpApprovalRequirement: 'superintendent' }) },
    });
    const fixture = await createFixture({ recipientEmail: 'not-eligible@example.com' });
    const response = await reject(fixture.raw);
    expect(response.status).toBe(403);
    expect(
      await prisma.holdPointDecisionRound.findUniqueOrThrow({
        where: { id: fixture.round.id },
        select: { outcome: true },
      }),
    ).toEqual({ outcome: null });
  });
});

describe('public conditional release and decision races', () => {
  it('writes ordered conditions, releases the HP, and completes the ITP item without verification', async () => {
    const fixture = await createFixture();
    const response = await conditionalRelease(fixture.raw);
    expect(response.status).toBe(200);

    const round = await prisma.holdPointDecisionRound.findUniqueOrThrow({
      where: { id: fixture.round.id },
      include: { conditions: { orderBy: { sequence: 'asc' } } },
    });
    expect(round.outcome).toBe('released_with_conditions');
    expect(
      round.conditions.map(({ sequence: conditionSequence, text }) => ({
        sequence: conditionSequence,
        text,
      })),
    ).toEqual([
      { sequence: 1, text: 'Repair the edge before the next lift' },
      { sequence: 2, text: 'Submit a closure photograph' },
    ]);
    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: fixture.holdPoint.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'released' });
    expect(
      await prisma.iTPCompletion.findUniqueOrThrow({
        where: {
          itpInstanceId_checklistItemId: {
            itpInstanceId: fixture.instance.id,
            checklistItemId: fixture.item.id,
          },
        },
        select: { status: true, verificationStatus: true, verifiedAt: true },
      }),
    ).toEqual({ status: 'completed', verificationStatus: 'none', verifiedAt: null });
  });

  it('lets exactly one of release and reject win the shared round', async () => {
    const fixture = await createFixture();
    const secondRaw = `${tag}-race-release-${sequence}`;
    await prisma.holdPointReleaseToken.create({
      data: {
        holdPointId: fixture.holdPoint.id,
        decisionRoundId: fixture.round.id,
        recipientEmail: `${tag}-authority@example.com`,
        recipientName: 'Named Authority',
        token: hashToken(secondRaw),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const [releaseResponse, rejectResponse] = await Promise.all([
      request(app).post(`/api/holdpoints/public/${secondRaw}/release`).send({
        releasedByName: 'Submitted Name',
        releasedByOrg: 'Principal Org',
        signatureDataUrl,
      }),
      reject(fixture.raw),
    ]);
    expect(
      [releaseResponse.status, rejectResponse.status].filter((status) => status === 200),
    ).toHaveLength(1);
    const round = await prisma.holdPointDecisionRound.findUniqueOrThrow({
      where: { id: fixture.round.id },
      select: { outcome: true },
    });
    expect(['released', 'rejected']).toContain(round.outcome);
    expect(await prisma.nCR.count({ where: { projectId } })).toBe(
      round.outcome === 'rejected' ? 1 : 0,
    );
  });
});

describe('public token round revocation', () => {
  it('refuses decided, superseded, and used tokens on GET', async () => {
    const decided = await createFixture();
    await prisma.holdPointDecisionRound.update({
      where: { id: decided.round.id },
      data: { outcome: 'released', decidedAt: new Date() },
    });
    expect((await request(app).get(`/api/holdpoints/public/${decided.raw}`)).status).toBe(410);

    const superseded = await createFixture();
    const nextRound = await prisma.holdPointDecisionRound.create({
      data: { holdPointId: superseded.holdPoint.id, roundNumber: 2 },
    });
    await prisma.holdPoint.update({
      where: { id: superseded.holdPoint.id },
      data: { currentRoundId: nextRound.id },
    });
    expect((await request(app).get(`/api/holdpoints/public/${superseded.raw}`)).status).toBe(410);

    const used = await createFixture();
    await prisma.holdPointReleaseToken.update({
      where: { id: used.token.id },
      data: { usedAt: new Date() },
    });
    expect((await request(app).get(`/api/holdpoints/public/${used.raw}`)).status).toBe(410);
  });

  it('lazy-binds a legacy null-round token to the HP current open round', async () => {
    const fixture = await createFixture({ bindToken: false });
    expect((await reject(fixture.raw)).status).toBe(200);
    expect(
      await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { id: fixture.token.id },
        select: { decisionRoundId: true },
      }),
    ).toEqual({ decisionRoundId: fixture.round.id });
  });
});

describe('re-request and authenticated authority gates', () => {
  it('blocks an open rejection NCR, then requires and stores the response after closure', async () => {
    const fixture = await createFixture();
    expect((await reject(fixture.raw)).status).toBe(200);
    const round = await prisma.holdPointDecisionRound.findUniqueOrThrow({
      where: { id: fixture.round.id },
      select: { linkedNcrId: true },
    });
    const payload = {
      lotId: fixture.lot.id,
      itpChecklistItemId: fixture.item.id,
      notificationSentTo: 'next-authority@example.com',
      responseToPriorRejection: 'The rejected work was rectified and new evidence is attached.',
    };
    expect(
      (
        await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${requesterToken}`)
          .send(payload)
      ).status,
    ).toBe(400);

    await prisma.nCR.update({ where: { id: round.linkedNcrId! }, data: { status: 'closed' } });
    expect(
      (
        await request(app)
          .post('/api/holdpoints/request-release')
          .set('Authorization', `Bearer ${requesterToken}`)
          .send({ ...payload, responseToPriorRejection: undefined })
      ).status,
    ).toBe(400);
    const response = await request(app)
      .post('/api/holdpoints/request-release')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(payload);
    expect(response.status).toBe(200);
    const latestRound = await prisma.holdPointDecisionRound.findFirstOrThrow({
      where: { holdPointId: fixture.holdPoint.id },
      orderBy: { roundNumber: 'desc' },
      select: { roundNumber: true, responseToPriorRejection: true },
    });
    expect(latestRound).toEqual({
      roundNumber: 2,
      responseToPriorRejection: payload.responseToPriorRejection,
    });
  });

  it('returns 403 for a principal-class in-app release, including superintendent role', async () => {
    const fixture = await createFixture({ authorityClass: 'principal' });
    const response = await request(app)
      .post(`/api/holdpoints/${fixture.holdPoint.id}/release`)
      .set('Authorization', `Bearer ${superintendentToken}`)
      .send({ releasedByName: 'Project Superintendent', releasedByOrg: 'Principal' });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain('release-link flow');
  });

  it('enforces nominated releasers for contractor-internal HPs when the project list is non-empty', async () => {
    await prisma.project.update({
      where: { id: projectId },
      data: { hpInternalReleaserIds: [requesterId] },
    });
    const denied = await createFixture({ authorityClass: 'contractor_internal' });
    expect(
      (
        await request(app)
          .post(`/api/holdpoints/${denied.holdPoint.id}/release`)
          .set('Authorization', `Bearer ${superintendentToken}`)
          .send({ releasedByName: 'Superintendent', releasedByOrg: 'Contractor' })
      ).status,
    ).toBe(403);

    const allowed = await createFixture({ authorityClass: 'contractor_internal' });
    const response = await request(app)
      .post(`/api/holdpoints/${allowed.holdPoint.id}/release`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ releasedByName: 'Nominated PM', releasedByOrg: 'Contractor' });
    expect(response.status).toBe(200);
    expect(
      await prisma.holdPointDecisionRound.findUniqueOrThrow({
        where: { id: allowed.round.id },
        select: { outcome: true, decisionMethod: true },
      }),
    ).toEqual({ outcome: 'released', decisionMethod: 'authenticated' });
  });
});

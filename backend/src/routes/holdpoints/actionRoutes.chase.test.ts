import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const prisma = {
    holdPoint: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    holdPointReleaseToken: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    projectUser: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    auditLog: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
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
    HP_RELEASE_REQUESTED: 'hp_release_requested',
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

import { errorHandler } from '../../middleware/errorHandler.js';
import { holdPointActionRouter } from './actionRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/holdpoints', holdPointActionRouter);
app.use(errorHandler);

const GENERATION_START = new Date('2026-06-01T00:00:00.000Z');

describe('hold point chase action route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.holdPoint.findUnique.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      description: 'Footing inspection',
      chaseCount: 1,
      lastChasedAt: null,
      notificationSentAt: GENERATION_START,
      notificationSentTo: 'site-team@example.com',
      createdAt: GENERATION_START,
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
    // Wave E2 §4.2.2: the reservation is an atomic conditional `updateMany`,
    // and only `count === 1` licenses a send.
    mocks.prisma.holdPoint.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.holdPoint.findUniqueOrThrow.mockResolvedValue({
      id: 'hp-1',
      chaseCount: 2,
    });
    // §4.2.4: the durable requester comes from the `HP_RELEASE_REQUESTED` audit
    // row for the current generation, not from the recipient list.
    mocks.prisma.auditLog.findFirst.mockResolvedValue({ userId: 'requester-user' });
    mocks.prisma.user.findUnique.mockResolvedValue({
      email: 'rita@example.com',
      fullName: 'Rita Requester',
    });
    mocks.prisma.projectUser.findFirst.mockResolvedValue({ id: 'pu-1' });
    mocks.prisma.holdPointReleaseToken.createMany.mockResolvedValue({ count: 1 });
    mocks.prisma.holdPointReleaseToken.deleteMany.mockResolvedValue({ count: 1 });
    mocks.prisma.projectUser.findMany.mockResolvedValue([]);
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.sendHPChaseEmail.mockResolvedValue({ success: true });
  });

  it('mints a public release link for a live external token recipient', async () => {
    mocks.prisma.holdPointReleaseToken.findMany.mockResolvedValue([
      { recipientEmail: 'external.super@example.com', recipientName: 'External Superintendent' },
    ]);

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
        // A batch review-room token shares this hold point AND this address, and
        // the public batch routes reach their hold points through it — the chase
        // must never delete a room CIVOS already sent. See H3 in
        // `docs/reviews/fable-deep-review-2026-07-28.md`; the DB-level proof is
        // in `holdPointChaseAutomation.db.test.ts`.
        batchId: null,
        token: { not: tokenCreatePayload.data[0].token },
      },
    });
  });

  // Wave E2 / E.0 verdict row 3d, `[E-B6]`. This test previously asserted the
  // OPPOSITE — it was named "renews an expired external token recipient" and
  // locked in the defect: the resolver filtered on `usedAt: null` only, so an
  // expired capability seeded new chases indefinitely (retention is off outside
  // production, so literally forever). The tier-1 query now carries
  // `expiresAt: { gt: now }` and an expired token resolves nothing.
  it('never resolves an EXPIRED token as a live recipient; falls to notificationSentTo', async () => {
    mocks.prisma.holdPointReleaseToken.findMany.mockImplementation(
      async (args: { where?: { expiresAt?: unknown } }) => {
        // Only the expired row exists, so the live-token query returns nothing.
        if (args.where?.expiresAt) return [];
        return [
          {
            recipientEmail: 'external.super@example.com',
            recipientName: 'External Superintendent',
          },
        ];
      },
    );

    const res = await request(app).post('/api/holdpoints/hp-1/chase');

    expect(res.status).toBe(200);
    // The tier-1 query is expiry-filtered.
    const tierOneCall = mocks.prisma.holdPointReleaseToken.findMany.mock.calls.find(
      (call) => call[0]?.where?.expiresAt,
    );
    expect(tierOneCall).toBeDefined();
    expect(tierOneCall![0].where.expiresAt).toEqual({ gt: expect.any(Date) });

    // Tier 2: the durable record of who was actually asked.
    expect(mocks.sendHPChaseEmail).toHaveBeenCalledOnce();
    expect(mocks.sendHPChaseEmail.mock.calls[0][0].to).toBe('site-team@example.com');
    // NOT the internal project-user fallback.
    expect(mocks.prisma.projectUser.findMany).not.toHaveBeenCalled();
  });

  it('keeps old external tokens valid and removes the new token when the chase email send fails', async () => {
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
    const tokenCreatePayload = mocks.prisma.holdPointReleaseToken.createMany.mock.calls[0][0];
    expect(mocks.prisma.holdPointReleaseToken.deleteMany).toHaveBeenCalledWith({
      where: {
        holdPointId: 'hp-1',
        recipientEmail: 'external.super@example.com',
        usedAt: null,
        token: tokenCreatePayload.data[0].token,
      },
    });
    expect(mocks.prisma.holdPointReleaseToken.deleteMany).not.toHaveBeenCalledWith({
      where: {
        holdPointId: 'hp-1',
        recipientEmail: 'external.super@example.com',
        usedAt: null,
        batchId: null,
        token: { not: tokenCreatePayload.data[0].token },
      },
    });

    // `[E-j]` / E.0 item 13 clause 2: a FAILED send does not consume an
    // attempt, so the reservation is refunded.
    expect(mocks.prisma.holdPoint.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { chaseCount: { decrement: 1 }, lastChasedAt: null },
      }),
    );
  });

  it('reserves atomically and never writes chaseCount with a bare update', async () => {
    mocks.prisma.holdPointReleaseToken.findMany.mockResolvedValue([]);

    await request(app).post('/api/holdpoints/hp-1/chase');

    const reservation = mocks.prisma.holdPoint.updateMany.mock.calls[0][0];
    expect(reservation.where).toMatchObject({
      id: 'hp-1',
      status: { in: ['notified'] },
      chaseCount: { lt: 3 },
      // An IDENTITY, not a floor. `gte` admitted a NEWER generation: a
      // re-request rewrites `notificationSentAt` and resets the counters, so a
      // reservation carried from the superseded generation passed every clause
      // (L1 of the 2026-07-28 deep review).
      notificationSentAt: { equals: GENERATION_START },
    });
    expect(reservation.where.OR).toEqual([
      { lastChasedAt: null },
      { lastChasedAt: { lt: expect.any(Date) } },
    ]);
    expect(reservation.data).toEqual({
      chaseCount: { increment: 1 },
      lastChasedAt: expect.any(Date),
    });
    // The pre-E2 read-then-write is gone.
    expect(mocks.prisma.holdPoint.update).not.toHaveBeenCalled();
  });

  it('refuses the chase when the reservation is lost (cap spent, cooldown live, or a race)', async () => {
    mocks.prisma.holdPoint.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.holdPoint.findUnique.mockResolvedValueOnce({
      id: 'hp-1',
      status: 'notified',
      description: 'Footing inspection',
      chaseCount: 3,
      lastChasedAt: null,
      notificationSentAt: GENERATION_START,
      notificationSentTo: 'site-team@example.com',
      createdAt: GENERATION_START,
      lot: {
        id: 'lot-1',
        lotNumber: 'LOT-1',
        projectId: 'project-1',
        project: { id: 'project-1', name: 'Bridge Upgrade', settings: null },
      },
    });
    // The follow-up describe-the-failure read.
    mocks.prisma.holdPoint.findUnique.mockResolvedValueOnce({
      status: 'notified',
      chaseCount: 3,
      lastChasedAt: null,
    });

    const res = await request(app).post('/api/holdpoints/hp-1/chase');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('HP_CHASE_UNAVAILABLE');
    expect(mocks.sendHPChaseEmail).not.toHaveBeenCalled();
  });

  // L2 of the 2026-07-28 deep review. The digest clamped and this path did not,
  // and the two numbers land in the same sentence of the same email. Both now
  // call `daysSinceRequest` in `chaseCore`.
  it('never prints a negative age for a future-dated request', async () => {
    const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
    mocks.prisma.holdPoint.findUnique.mockResolvedValue({
      id: 'hp-1',
      status: 'notified',
      description: 'Footing inspection',
      chaseCount: 1,
      lastChasedAt: null,
      notificationSentAt: tomorrow,
      notificationSentTo: 'site-team@example.com',
      createdAt: GENERATION_START,
      lot: {
        id: 'lot-1',
        lotNumber: 'LOT-1',
        projectId: 'project-1',
        project: { id: 'project-1', name: 'Bridge Upgrade', settings: null },
      },
    });
    mocks.prisma.holdPointReleaseToken.findMany.mockResolvedValue([]);

    await request(app).post('/api/holdpoints/hp-1/chase');

    // PROOF OF CATCH: unclamped this is -2 (measured), and the superintendent
    // reads "awaiting release for -2 days".
    expect(mocks.sendHPChaseEmail.mock.calls[0][0].daysSinceRequest).toBe(0);
  });

  it('threads the resolved requester into "Requested By" and replyTo, never the recipient', async () => {
    mocks.prisma.holdPointReleaseToken.findMany.mockResolvedValue([
      { recipientEmail: 'external.super@example.com', recipientName: 'External Superintendent' },
    ]);

    await request(app).post('/api/holdpoints/hp-1/chase');

    const payload = mocks.sendHPChaseEmail.mock.calls[0][0];
    expect(payload.requestedBy).toBe('Rita Requester');
    expect(payload.replyTo).toBe('rita@example.com');
    expect(payload.requestedBy).not.toBe(payload.to);
  });
});

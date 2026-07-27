// F0.4b PR 3 — the hold-point RELEASE decisions (authenticated + public
// single-token) as they behave once routed through `recordDecision`
// (execution spec §11 F0.4b PR 3, §12).
//
// A separate suite from `routes/holdpoints.test.ts` for the same two reasons
// PR 1 and PR 2 split theirs out: `READINESS_SNAPSHOTS_ENABLED` is flipped per
// test, and the webhook dispatcher is mocked so "exactly one post-commit
// signal" is a synchronous count rather than a poll against delivery rows.
//
// DB-backed on purpose: serializable retry, the optimistic guards and the
// token double-spend race are PostgreSQL behaviours.
// `src/test/databaseSafety.ts` keeps this on the local disposable database.

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import {
  HOLD_POINT_RELEASE_REQUIREMENT_SET,
  decodeHoldPointReleaseResult,
} from '../../lib/readiness/requirements/holdPointRelease.v1.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { NO_RULESET_SUFFICIENCY } from '../../test/sufficiencySnapshots.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { holdpointsRouter } from '../holdpoints.js';

// Partial mock: only the post-commit signal is replaced, so the count of
// dispatched webhook events is directly observable.
vi.mock('./webhookEvents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./webhookEvents.js')>()),
  emitHoldPointWebhookEvent: vi.fn(),
}));

// Fault injection for the in-transaction audit write. `vi.hoisted` because
// vitest hoists `vi.mock` above every `const` in this file, so the factory
// would otherwise close over a value in its temporal dead zone.
const auditFault = vi.hoisted(() => ({ pending: false }));

vi.mock('../../lib/auditLog.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/auditLog.js')>();
  return {
    ...actual,
    writeAuditLogInTransaction: vi.fn(
      async (...args: Parameters<typeof actual.writeAuditLogInTransaction>) => {
        if (auditFault.pending) {
          auditFault.pending = false;
          throw new Error('audit store unavailable');
        }
        return actual.writeAuditLogInTransaction(...args);
      },
    ),
  };
});

const { emitHoldPointWebhookEvent } = await import('./webhookEvents.js');
const emitHoldPointWebhookEventMock = vi.mocked(emitHoldPointWebhookEvent);

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `hp-decision-${Date.now()}`;
const TOKEN_RECIPIENT_EMAIL = `${tag}-superintendent@example.com`;
const TOKEN_RECIPIENT_NAME = 'Named Superintendent';

let releaserToken: string;
let releaserId: string;
let companyId: string;
let projectId: string;
let templateId: string;
let lotId: string;
let itpInstanceId: string;

function enableSnapshots(): void {
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
}

function disableSnapshots(): void {
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
}

function hashReleaseToken(raw: string): string {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

let holdPointSequence = 0;

/**
 * `hold_points` enforces unique(lotId, itpChecklistItemId), so every hold point
 * gets its own fresh checklist item on the shared template.
 */
async function createReleasableHoldPoint(suffix: string, status = 'notified') {
  holdPointSequence += 1;
  const checklistItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: `Release decision item ${suffix}`,
      pointType: 'hold_point',
      sequenceNumber: holdPointSequence,
    },
  });

  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: checklistItem.id,
      pointType: 'hold_point',
      description: `Release decision hold point ${suffix}`,
      status,
    },
  });

  const completion = await prisma.iTPCompletion.create({
    data: {
      itpInstanceId,
      checklistItemId: checklistItem.id,
      status: 'completed',
      verificationStatus: 'none',
    },
  });

  return { holdPoint, checklistItem, completion };
}

async function createReleaseToken(holdPointId: string, suffix: string) {
  const raw = `${tag}-${suffix}-${holdPointSequence}`;
  const token = await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId,
      token: hashReleaseToken(raw),
      recipientEmail: TOKEN_RECIPIENT_EMAIL,
      recipientName: TOKEN_RECIPIENT_NAME,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
  return { raw, token };
}

function releasePayload(overrides: Record<string, unknown> = {}) {
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

function postAuthenticatedRelease(holdPointId: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/holdpoints/${holdPointId}/release`)
    .set('Authorization', `Bearer ${releaserToken}`)
    .send(releasePayload(overrides));
}

function postPublicRelease(rawToken: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/holdpoints/public/${rawToken}/release`)
    .send({
      releasedByName: 'Submitted Free Text Name',
      releasedByOrg: 'Client Company',
      releaseNotes: 'Approved externally',
      // The public schema requires a captured signature.
      signatureDataUrl: 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=',
      ...overrides,
    });
}

async function auditRows(holdPointId: string, action: string) {
  return prisma.auditLog.findMany({ where: { projectId, entityId: holdPointId, action } });
}

async function auditChanges(holdPointId: string, action: string) {
  const rows = await auditRows(holdPointId, action);
  expect(rows).toHaveLength(1);
  return JSON.parse(rows[0].changes ?? '{}') as Record<string, unknown>;
}

async function snapshotRows(holdPointId: string) {
  return prisma.requirementEvaluation.findMany({ where: { projectId, entityId: holdPointId } });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const releaser = await registerTestUser(app, {
    emailPrefix: `${tag}-releaser`,
    fullName: 'HP Decision Releaser',
    companyId,
    roleInCompany: 'admin',
  });
  releaserToken = releaser.token;
  releaserId = releaser.userId;

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

  await prisma.projectUser.create({
    data: { projectId, userId: releaserId, role: 'admin', status: 'active' },
  });

  const template = await prisma.iTPTemplate.create({
    data: { projectId, name: `Template ${tag}`, activityType: 'Earthworks' },
  });
  templateId = template.id;

  const lot = await prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-LOT`,
      status: 'in_progress',
      lotType: 'chainage',
      activityType: 'Earthworks',
    },
  });
  lotId = lot.id;

  const itpInstance = await prisma.iTPInstance.create({
    data: { templateId, lotId, status: 'in_progress' },
  });
  itpInstanceId = itpInstance.id;
});

beforeEach(() => {
  emitHoldPointWebhookEventMock.mockClear();
});

afterEach(async () => {
  disableSnapshots();
  auditFault.pending = false;
  vi.restoreAllMocks();
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
});

afterAll(async () => {
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
  await prisma.iTPInstance.deleteMany({ where: { lotId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.emailVerificationToken.deleteMany({ where: { userId: releaserId } });
  await prisma.user.delete({ where: { id: releaserId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('Hold point release decisions — feature flag (spec §9 rollout step 2)', () => {
  it('releases authenticated with NO snapshot row and a snapshotSkipped audit marker when disabled', async () => {
    disableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('auth-flag-off');

    const res = await postAuthenticatedRelease(holdPoint.id);

    expect(res.status).toBe(200);
    expect(res.body.holdPoint.status).toBe('released');
    expect(await snapshotRows(holdPoint.id)).toHaveLength(0);
    expect(await auditChanges(holdPoint.id, AuditAction.HP_RELEASED)).toMatchObject({
      decisionKind: 'release',
      snapshotSkipped: true,
    });
  });

  it('releases by public token with NO snapshot row and a snapshotSkipped audit marker when disabled', async () => {
    disableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('public-flag-off');
    const { raw } = await createReleaseToken(holdPoint.id, 'flag-off');

    const res = await postPublicRelease(raw);

    expect(res.status).toBe(200);
    expect(await snapshotRows(holdPoint.id)).toHaveLength(0);
    expect(await auditChanges(holdPoint.id, AuditAction.HP_PUBLIC_RELEASED)).toMatchObject({
      decisionKind: 'release',
      snapshotSkipped: true,
    });
  });

  it('writes a hold_point_release.v1 snapshot and drops the marker when enabled', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('auth-flag-on');

    expect((await postAuthenticatedRelease(holdPoint.id)).status).toBe(200);

    const rows = await snapshotRows(holdPoint.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: 'hold_point',
      projectId,
      requirementSet: HOLD_POINT_RELEASE_REQUIREMENT_SET,
      resultSchemaVersion: 1,
      decisionKind: 'release',
      auditAction: AuditAction.HP_RELEASED,
    });

    const [audit] = await auditRows(holdPoint.id, AuditAction.HP_RELEASED);
    expect(rows[0].auditLogId).toBe(audit.id);
    expect(JSON.parse(audit.changes ?? '{}').snapshotSkipped).toBeUndefined();
  });
});

describe('Hold point release decisions — actor derivation (spec §5 [R3.1], review R7)', () => {
  it('records the authenticated release under the session user, not the typed-in name', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('auth-actor');

    expect((await postAuthenticatedRelease(holdPoint.id)).status).toBe(200);

    const [row] = await snapshotRows(holdPoint.id);
    expect(row).toMatchObject({
      actorKind: 'user',
      actorUserId: releaserId,
      actorTokenId: null,
      // The free-text field-signatory name is provenance on the audit row, NEVER
      // actor identity.
      actorLabel: null,
    });
    expect(await auditChanges(holdPoint.id, AuditAction.HP_RELEASED)).toMatchObject({
      releasedByName: 'Email Release Reviewer',
      releaseMethod: 'email',
    });
  });

  it('records the public release under the token ROW, labelled with the recipient NAME', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('public-actor');
    const { raw, token } = await createReleaseToken(holdPoint.id, 'actor');

    expect((await postPublicRelease(raw)).status).toBe(200);

    const [row] = await snapshotRows(holdPoint.id);
    expect(row).toMatchObject({
      actorKind: 'external_token',
      actorUserId: null,
      actorTokenId: token.id,
      actorLabel: TOKEN_RECIPIENT_NAME,
      decisionKind: 'release',
      auditAction: AuditAction.HP_PUBLIC_RELEASED,
    });

    // The recipient's EMAIL never reaches the snapshot row, and the audit row's
    // `tokenRecipient` key stays inside `sanitizeAuditChanges`'s /token/i
    // pattern so it is stored redacted.
    expect(JSON.stringify(row)).not.toContain(TOKEN_RECIPIENT_EMAIL);
    const changes = await auditChanges(holdPoint.id, AuditAction.HP_PUBLIC_RELEASED);
    expect(changes.tokenRecipient).toBe('[REDACTED]');
    expect(JSON.stringify(changes)).not.toContain(TOKEN_RECIPIENT_EMAIL);
    // Token identity wins over the submitted free text (unchanged behaviour).
    expect(changes.releasedByName).toBe(TOKEN_RECIPIENT_NAME);
    expect(changes.submittedReleasedByName).toBe('Submitted Free Text Name');
  });
});

describe('Hold point release decisions — recorded readiness (spec §11 F0.4b PR 3)', () => {
  it('records a lot-clearing release with no blocking reason codes', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('only-hp');

    expect((await postAuthenticatedRelease(holdPoint.id)).status).toBe(200);

    const [row] = await snapshotRows(holdPoint.id);
    expect(decodeHoldPointReleaseResult(row)).toEqual({
      released: true,
      reasonCodes: [],
      // C1.2 (§5.2): the release records the advisory verdict. WARN only — the
      // reason codes above are unchanged by it, at any sufficiency state.
      sufficiency: NO_RULESET_SUFFICIENCY,
    });
  });

  it('records unreleased_hold_points when the lot still has outstanding hold points', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('with-sibling');
    await createReleasableHoldPoint('sibling-outstanding');

    expect((await postAuthenticatedRelease(holdPoint.id)).status).toBe(200);

    const [row] = await snapshotRows(holdPoint.id);
    expect(decodeHoldPointReleaseResult(row)).toEqual({
      released: true,
      reasonCodes: ['unreleased_hold_points'],
      sufficiency: NO_RULESET_SUFFICIENCY,
    });
    // Single releases carry no batch correlation — that grain is PR 4's.
    expect(decodeHoldPointReleaseResult(row)).not.toHaveProperty('batchId');
  });

  it('records the same readiness shape through the public door', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('public-readiness');
    await createReleasableHoldPoint('public-sibling');
    const { raw } = await createReleaseToken(holdPoint.id, 'readiness');

    expect((await postPublicRelease(raw)).status).toBe(200);

    const [row] = await snapshotRows(holdPoint.id);
    expect(decodeHoldPointReleaseResult(row)).toEqual({
      released: true,
      reasonCodes: ['unreleased_hold_points'],
      sufficiency: NO_RULESET_SUFFICIENCY,
    });
  });
});

describe('Hold point release decisions — audit integrity (spec §9 [R3.1-R1])', () => {
  // The audit row used to be a post-commit best-effort `createAuditLog` that
  // swallowed its own failures: a hold point could be released, its ITP item
  // reconciled and (publicly) its token burned with nothing recording why. It
  // is now written INSIDE the decision transaction.
  it('rolls the authenticated release AND its ITP reconciliation back when the decision record fails', async () => {
    enableSnapshots();
    const { holdPoint, completion } = await createReleasableHoldPoint('auth-audit-fail');

    auditFault.pending = true;
    const res = await postAuthenticatedRelease(holdPoint.id);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');

    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: holdPoint.id },
        select: { status: true, releasedAt: true },
      }),
    ).toMatchObject({ status: 'notified', releasedAt: null });
    expect(
      await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completion.id },
        select: { verificationStatus: true, verifiedAt: true },
      }),
    ).toMatchObject({ verificationStatus: 'none', verifiedAt: null });
    expect(await snapshotRows(holdPoint.id)).toHaveLength(0);
    expect(emitHoldPointWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rolls the public release back INCLUDING the token claim when the decision record fails', async () => {
    enableSnapshots();
    const { holdPoint, completion } = await createReleasableHoldPoint('public-audit-fail');
    const { raw, token } = await createReleaseToken(holdPoint.id, 'audit-fail');

    auditFault.pending = true;
    const res = await postPublicRelease(raw);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');

    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: holdPoint.id },
        select: { status: true, releasedAt: true },
      }),
    ).toMatchObject({ status: 'notified', releasedAt: null });
    expect(
      await prisma.iTPCompletion.findUniqueOrThrow({
        where: { id: completion.id },
        select: { verificationStatus: true },
      }),
    ).toMatchObject({ verificationStatus: 'none' });
    // The single-use token must NOT be burned by a decision that never
    // committed, or the recipient is locked out of a release that never happened.
    expect(
      await prisma.holdPointReleaseToken.findUniqueOrThrow({
        where: { id: token.id },
        select: { usedAt: true, releasedByName: true },
      }),
    ).toMatchObject({ usedAt: null, releasedByName: null });
    expect(await snapshotRows(holdPoint.id)).toHaveLength(0);
    expect(emitHoldPointWebhookEventMock).not.toHaveBeenCalled();

    // And the link still works afterwards.
    auditFault.pending = false;
    expect((await postPublicRelease(raw)).status).toBe(200);
  });
});

describe('Hold point release decisions — concurrency (spec §12)', () => {
  it('lets exactly one of two concurrent authenticated releases win', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('auth-race');

    const results = await Promise.all([
      postAuthenticatedRelease(holdPoint.id, { releasedByName: 'Racer A' }),
      postAuthenticatedRelease(holdPoint.id, { releasedByName: 'Racer B' }),
    ]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    // The loser is rejected, never silently accepted: 400 when it lost before
    // the transaction opened or against the optimistic guard, 409 when the
    // serializable retries were exhausted.
    expect([400, 409]).toContain(statuses[1]);

    expect(await auditRows(holdPoint.id, AuditAction.HP_RELEASED)).toHaveLength(1);
    expect(await snapshotRows(holdPoint.id)).toHaveLength(1);
    expect(emitHoldPointWebhookEventMock.mock.calls.length).toBeLessThanOrEqual(1);

    const stored = await prisma.holdPoint.findUniqueOrThrow({ where: { id: holdPoint.id } });
    expect(stored.status).toBe('released');
    const winner = results.find((res) => res.status === 200);
    expect(stored.releasedByName).toBe(winner?.body.holdPoint.releasedByName);
  });

  it('lets one secure link be spent exactly once under a double-spend race', async () => {
    enableSnapshots();
    const { holdPoint } = await createReleasableHoldPoint('token-race');
    const { raw, token } = await createReleaseToken(holdPoint.id, 'double-spend');

    const results = await Promise.all([postPublicRelease(raw), postPublicRelease(raw)]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    // 410 is the route's own already-used/expired token response (unchanged
    // semantics); 409 is `recordDecision` exhausting its serializable retries.
    expect([400, 409, 410]).toContain(statuses[1]);

    const spent = await prisma.holdPointReleaseToken.findUniqueOrThrow({
      where: { id: token.id },
      select: { usedAt: true, releasedByName: true },
    });
    expect(spent.usedAt).not.toBeNull();
    expect(spent.releasedByName).toBe(TOKEN_RECIPIENT_NAME);

    expect(await auditRows(holdPoint.id, AuditAction.HP_PUBLIC_RELEASED)).toHaveLength(1);
    expect(await snapshotRows(holdPoint.id)).toHaveLength(1);
    expect(emitHoldPointWebhookEventMock.mock.calls.length).toBeLessThanOrEqual(1);
    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: holdPoint.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: 'released' });
  });
});

// Benchmark field-flow tickets T2 (QR release link) and T3 (approver verbs).
//
// DB-backed on purpose: the load-bearing claims are about persisted state — a
// minted token really opens the public release door, a rejection really does
// NOT complete the ITP item, and the token really is single-use afterwards.
// `src/test/databaseSafety.ts` keeps this on the local disposable database.

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { holdpointsRouter } from '../holdpoints.js';
import { QR_RELEASE_LINK_EXPIRY_MINUTES } from './releaseLinkRoutes.js';

vi.mock('./webhookEvents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./webhookEvents.js')>()),
  emitHoldPointWebhookEvent: vi.fn(),
}));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `hp-field-flow-${Date.now()}`;
const RECIPIENT_EMAIL = `${tag}-superintendent@example.com`;
const RECIPIENT_NAME = 'Named Superintendent';
const SIGNATURE = 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=';
const REJECTION_REASON = 'Compaction results do not meet the specified 95% RDD for this layer.';
const CONDITIONS = 'Released subject to the 28-day break result being submitted before overlay.';

let requesterToken: string;
let requesterId: string;
let companyId: string;
let projectId: string;
let templateId: string;
let lotId: string;
let itpInstanceId: string;
let holdPointSequence = 0;

function hashReleaseToken(raw: string): string {
  return `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;
}

/** `hold_points` is unique on (lotId, itpChecklistItemId) — fresh item each time. */
async function createHoldPoint(suffix: string, status = 'notified') {
  holdPointSequence += 1;
  const checklistItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: `Field flow item ${suffix}`,
      pointType: 'hold_point',
      sequenceNumber: holdPointSequence,
    },
  });

  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: checklistItem.id,
      pointType: 'hold_point',
      description: `Field flow hold point ${suffix}`,
      status,
      notificationSentTo: status === 'notified' ? RECIPIENT_EMAIL : null,
      notificationSentAt: status === 'notified' ? new Date() : null,
    },
  });

  return { holdPoint, checklistItem };
}

async function createEmailedToken(holdPointId: string, suffix: string) {
  const raw = `${tag}-${suffix}-${holdPointSequence}`;
  const token = await prisma.holdPointReleaseToken.create({
    data: {
      holdPointId,
      token: hashReleaseToken(raw),
      recipientEmail: RECIPIENT_EMAIL,
      recipientName: RECIPIENT_NAME,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });
  return { raw, token };
}

function postReleaseLink(holdPointId: string) {
  return request(app)
    .post(`/api/holdpoints/${holdPointId}/release-link`)
    .set('Authorization', `Bearer ${requesterToken}`)
    .send({});
}

function postPublicDecision(rawToken: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/holdpoints/public/${rawToken}/release`)
    .send({
      releasedByName: 'Submitted Free Text Name',
      releasedByOrg: 'Client Company',
      signatureDataUrl: SIGNATURE,
      ...overrides,
    });
}

function tokenFromReleaseUrl(releaseUrl: string): string {
  const match = /\/hp-release\/([0-9a-f]{64})$/.exec(releaseUrl);
  expect(match, `release URL did not carry a raw token: ${releaseUrl}`).not.toBeNull();
  return match![1];
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const requester = await registerTestUser(app, {
    emailPrefix: `${tag}-requester`,
    fullName: 'Field Flow Requester',
    companyId,
    roleInCompany: 'admin',
  });
  requesterToken = requester.token;
  requesterId = requester.userId;

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
    data: { projectId, userId: requesterId, role: 'admin', status: 'active' },
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
  vi.clearAllMocks();
});

afterEach(async () => {
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.iTPInstance.deleteMany({ where: { lotId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.deleteMany({ where: { companyId } });
  await prisma.user.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
});

describe('T2 — POST /api/holdpoints/:id/release-link', () => {
  it('mints a fresh secure link for the invited authority, storing only its hash', async () => {
    const { holdPoint } = await createHoldPoint('mint');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    const response = await postReleaseLink(holdPoint.id);

    expect(response.status).toBe(200);
    expect(response.body.recipientEmail).toBe(RECIPIENT_EMAIL);
    expect(response.body.recipientName).toBe(RECIPIENT_NAME);

    const rawToken = tokenFromReleaseUrl(response.body.releaseUrl);
    const stored = await prisma.holdPointReleaseToken.findUnique({
      where: { token: hashReleaseToken(rawToken) },
    });
    expect(stored).not.toBeNull();
    expect(stored!.holdPointId).toBe(holdPoint.id);
    expect(stored!.recipientEmail).toBe(RECIPIENT_EMAIL);
    // The raw token is never persisted anywhere.
    expect(stored!.token).not.toContain(rawToken);

    // Short-lived by design: the QR is for the approver standing right there.
    const lifetimeMinutes = (stored!.expiresAt.getTime() - Date.now()) / 60_000;
    expect(lifetimeMinutes).toBeGreaterThan(QR_RELEASE_LINK_EXPIRY_MINUTES - 2);
    expect(lifetimeMinutes).toBeLessThanOrEqual(QR_RELEASE_LINK_EXPIRY_MINUTES);

    // The emailed link keeps working — minting is additive, not a revocation.
    const emailedStillLive = await prisma.holdPointReleaseToken.findUnique({
      where: { id: emailed.token.id },
    });
    expect(emailedStillLive?.usedAt).toBeNull();
  });

  it('audits every mint, because the link is release-capable and leaves the app', async () => {
    const { holdPoint } = await createHoldPoint('audit');
    await createEmailedToken(holdPoint.id, 'emailed');

    await postReleaseLink(holdPoint.id);

    const rows = await prisma.auditLog.findMany({
      where: { entityId: holdPoint.id, action: AuditAction.HP_RELEASE_LINK_MINTED },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(requesterId);

    const changes = JSON.parse(rows[0].changes ?? '{}') as Record<string, unknown>;
    expect(changes).toMatchObject({
      lotId,
      expiryMinutes: QR_RELEASE_LINK_EXPIRY_MINUTES,
    });
    // Both recipient keys match sanitizeAuditChanges' /token/i pattern and are
    // therefore stored redacted — the accountability this row carries is WHO
    // put a release-capable link on screen, not who it addressed.
    expect(changes.tokenRecipient).toBe('[REDACTED]');
    expect(changes.tokenRecipientName).toBe('[REDACTED]');
    expect(JSON.stringify(changes)).not.toContain(RECIPIENT_EMAIL);
  });

  it('refuses to mint before a release has been requested', async () => {
    const { holdPoint } = await createHoldPoint('not-requested', 'pending');

    const response = await postReleaseLink(holdPoint.id);

    expect(response.status).toBe(400);
    expect(response.body.error.details.code).toBe('HP_RELEASE_NOT_REQUESTED');
    expect(await prisma.holdPointReleaseToken.count({ where: { holdPointId: holdPoint.id } })).toBe(
      0,
    );
  });

  it('refuses to mint for an already-released hold point', async () => {
    const { holdPoint } = await createHoldPoint('released', 'released');

    const response = await postReleaseLink(holdPoint.id);

    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('already been released');
  });

  it('refuses when no authority is on record at all', async () => {
    const { holdPoint } = await createHoldPoint('no-recipient');
    await prisma.holdPoint.update({
      where: { id: holdPoint.id },
      data: { notificationSentTo: null },
    });

    const response = await postReleaseLink(holdPoint.id);

    expect(response.status).toBe(400);
    expect(response.body.error.details.code).toBe('HP_NO_RELEASE_RECIPIENT');
  });

  it('denies a user with no access to the project', async () => {
    const { holdPoint } = await createHoldPoint('outsider');
    const outsiderCompany = await prisma.company.create({ data: { name: `Outsider ${tag}` } });
    const outsider = await registerTestUser(app, {
      emailPrefix: `${tag}-outsider`,
      fullName: 'Outsider',
      companyId: outsiderCompany.id,
      roleInCompany: 'admin',
    });

    const response = await request(app)
      .post(`/api/holdpoints/${holdPoint.id}/release-link`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({});

    expect(response.status).toBe(403);
    expect(await prisma.holdPointReleaseToken.count({ where: { holdPointId: holdPoint.id } })).toBe(
      0,
    );

    await prisma.user.deleteMany({ where: { companyId: outsiderCompany.id } });
    await prisma.company.deleteMany({ where: { id: outsiderCompany.id } });
  });

  it('rejects an unauthenticated caller', async () => {
    const { holdPoint } = await createHoldPoint('anon');

    const response = await request(app)
      .post(`/api/holdpoints/${holdPoint.id}/release-link`)
      .send({});

    expect(response.status).toBe(401);
  });

  it('releasing through the minted link writes the same register record as the emailed one', async () => {
    const { holdPoint, checklistItem } = await createHoldPoint('end-to-end');
    await createEmailedToken(holdPoint.id, 'emailed');

    const mint = await postReleaseLink(holdPoint.id);
    const rawToken = tokenFromReleaseUrl(mint.body.releaseUrl);

    const release = await postPublicDecision(rawToken, { releaseNotes: 'Released on site.' });

    expect(release.status).toBe(200);
    expect(release.body.holdPoint.status).toBe('released');

    const released = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(released).toMatchObject({
      status: 'released',
      // Identity is locked to the invited recipient, not the submitted free text.
      releasedByName: RECIPIENT_NAME,
      releaseMethod: 'secure_link',
      releaseNotes: 'Released on site.',
    });
    expect(released!.releasedAt).not.toBeNull();
    expect(released!.releaseSignatureUrl).toBe(SIGNATURE);

    // The ITP item it gates is reconciled, exactly as on the emailed door.
    const completion = await prisma.iTPCompletion.findUnique({
      where: {
        itpInstanceId_checklistItemId: {
          itpInstanceId,
          checklistItemId: checklistItem.id,
        },
      },
    });
    expect(completion).toMatchObject({ status: 'completed', verificationStatus: 'verified' });

    const audit = await prisma.auditLog.findMany({
      where: { entityId: holdPoint.id, action: AuditAction.HP_PUBLIC_RELEASED },
    });
    expect(audit).toHaveLength(1);
  });
});

describe('T3 — approver verbs on the public release door', () => {
  it('rejects a hold point without releasing it or completing its ITP item', async () => {
    const { holdPoint, checklistItem } = await createHoldPoint('reject');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    const response = await postPublicDecision(emailed.raw, {
      decision: 'reject',
      releaseNotes: REJECTION_REASON,
    });

    expect(response.status).toBe(200);
    expect(response.body.holdPoint).toMatchObject({
      status: 'rejected',
      releasedAt: null,
      releasedByName: null,
      releaseNotes: REJECTION_REASON,
    });

    const rejected = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(rejected).toMatchObject({ status: 'rejected', releaseNotes: REJECTION_REASON });
    // No release column may be written: an evidence document that printed
    // "Released by ..." for a rejected hold point would state something untrue.
    expect(rejected!.releasedAt).toBeNull();
    expect(rejected!.releasedByName).toBeNull();
    expect(rejected!.releaseMethod).toBeNull();
    expect(rejected!.releaseSignatureUrl).toBeNull();

    // The gated checklist item stays unsatisfied.
    const completion = await prisma.iTPCompletion.findUnique({
      where: {
        itpInstanceId_checklistItemId: { itpInstanceId, checklistItemId: checklistItem.id },
      },
    });
    expect(completion).toBeNull();
  });

  it('records who rejected on the token row and in the audit trail', async () => {
    const { holdPoint } = await createHoldPoint('reject-audit');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    await postPublicDecision(emailed.raw, {
      decision: 'reject',
      releaseNotes: REJECTION_REASON,
    });

    const usedToken = await prisma.holdPointReleaseToken.findUnique({
      where: { id: emailed.token.id },
    });
    expect(usedToken!.usedAt).not.toBeNull();
    expect(usedToken!.releasedByName).toBe(RECIPIENT_NAME);
    expect(usedToken!.releaseSignatureUrl).toBe(SIGNATURE);
    expect(usedToken!.releaseNotes).toBe(REJECTION_REASON);

    const audit = await prisma.auditLog.findMany({
      where: { entityId: holdPoint.id, action: AuditAction.HP_PUBLIC_REJECTED },
    });
    expect(audit).toHaveLength(1);
    const changes = JSON.parse(audit[0].changes ?? '{}') as Record<string, unknown>;
    expect(changes.rejectedByName).toBe(RECIPIENT_NAME);
    expect(changes.submittedRejectedByName).toBe('Submitted Free Text Name');
    expect(JSON.stringify(changes)).not.toContain(RECIPIENT_EMAIL);
  });

  it('tells the crew the work came back, with the reason', async () => {
    const { holdPoint } = await createHoldPoint('reject-notify');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    await postPublicDecision(emailed.raw, {
      decision: 'reject',
      releaseNotes: REJECTION_REASON,
    });

    const notifications = await prisma.notification.findMany({
      where: { projectId, type: 'hold_point_rejected' },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(requesterId);
    expect(notifications[0].message).toContain(REJECTION_REASON);
    expect(notifications[0].message).toContain('NOT released');
    expect(holdPoint.id).toBeTruthy();
  });

  it('burns the token, so a rejection cannot be re-submitted as a release', async () => {
    const { holdPoint } = await createHoldPoint('reject-replay');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    await postPublicDecision(emailed.raw, {
      decision: 'reject',
      releaseNotes: REJECTION_REASON,
    });

    const replay = await postPublicDecision(emailed.raw);
    expect(replay.status).toBe(410);

    const stillRejected = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(stillRejected!.status).toBe('rejected');
  });

  it('refuses a rejection with no usable reason', async () => {
    const { holdPoint } = await createHoldPoint('reject-no-reason');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    const response = await postPublicDecision(emailed.raw, {
      decision: 'reject',
      releaseNotes: 'nope',
    });

    expect(response.status).toBe(400);

    const untouched = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(untouched!.status).toBe('notified');
    const unusedToken = await prisma.holdPointReleaseToken.findUnique({
      where: { id: emailed.token.id },
    });
    expect(unusedToken!.usedAt).toBeNull();
  });

  it('releases with conditions, keeping the conditions on the record', async () => {
    const { holdPoint, checklistItem } = await createHoldPoint('conditional');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    const response = await postPublicDecision(emailed.raw, {
      decision: 'release_with_conditions',
      releaseNotes: CONDITIONS,
    });

    expect(response.status).toBe(200);
    expect(response.body.holdPoint.status).toBe('released');

    const released = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(released).toMatchObject({
      status: 'released',
      releasedByName: RECIPIENT_NAME,
      releaseNotes: CONDITIONS,
    });

    const completion = await prisma.iTPCompletion.findUnique({
      where: {
        itpInstanceId_checklistItemId: { itpInstanceId, checklistItemId: checklistItem.id },
      },
    });
    expect(completion).toMatchObject({ status: 'completed' });
  });

  it('refuses a conditional release whose conditions were never written down', async () => {
    const { holdPoint } = await createHoldPoint('conditional-empty');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    const response = await postPublicDecision(emailed.raw, {
      decision: 'release_with_conditions',
    });

    expect(response.status).toBe(400);
    const untouched = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(untouched!.status).toBe('notified');
  });

  it('still releases when no decision is sent, so an older client is unaffected', async () => {
    const { holdPoint } = await createHoldPoint('default-verb');
    const emailed = await createEmailedToken(holdPoint.id, 'emailed');

    const response = await postPublicDecision(emailed.raw);

    expect(response.status).toBe(200);
    const released = await prisma.holdPoint.findUnique({ where: { id: holdPoint.id } });
    expect(released!.status).toBe('released');
  });
});

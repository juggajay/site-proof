// F0.4b PR 4 — the public BATCH hold-point release as ONE decision with N
// `hold_point` snapshot rows under ONE audit row (execution spec §11 F0.4b
// PR 4 `[R3.1-R4]`, §12).
//
// Split from `publicBatchRoutes.test.ts` for the same reasons PR 3 split its
// suite out: `READINESS_SNAPSHOTS_ENABLED` is flipped per test, and the webhook
// dispatcher is mocked so post-commit signals are a synchronous count.
//
// DB-backed on purpose: all-or-nothing rollback, the serializable retry and the
// batch-link double-spend race are PostgreSQL behaviours.
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
import { holdpointsRouter } from '../holdpoints.js';

vi.mock('./webhookEvents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./webhookEvents.js')>()),
  emitHoldPointWebhookEvent: vi.fn(),
}));

// Fault injection for the in-transaction audit write. `vi.hoisted` because
// vitest hoists `vi.mock` above every `const` in this file.
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
app.use('/api/holdpoints', holdpointsRouter);
app.use(errorHandler);

const tag = `hp-batch-decision-${Date.now()}`;
const RECIPIENT_EMAIL = `${tag}-reviewer@example.com`;
const RECIPIENT_NAME = 'Named Batch Reviewer';
const SIGNATURE_DATA_URL = 'data:image/png;base64,ZmFrZS1zaWduYXR1cmU=';

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

let sequence = 0;

/** `hold_points` enforces unique(lotId, itpChecklistItemId) — one item each. */
async function createBatchHoldPoint(suffix: string, status = 'notified') {
  sequence += 1;
  const checklistItem = await prisma.iTPChecklistItem.create({
    data: {
      templateId,
      description: `Batch decision item ${suffix}`,
      pointType: 'hold_point',
      sequenceNumber: sequence,
    },
  });

  const holdPoint = await prisma.holdPoint.create({
    data: {
      lotId,
      itpChecklistItemId: checklistItem.id,
      pointType: 'hold_point',
      description: `Batch decision hold point ${suffix}`,
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

/**
 * A review-room batch link over `holdPoints`, with one per-hold-point release
 * token each — the shape POST /request-release/batch produces.
 */
async function createBatchLink(holdPoints: { id: string }[], suffix: string) {
  sequence += 1;
  const raw = `${tag}-batch-${suffix}-${sequence}`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const batch = await prisma.holdPointReleaseBatch.create({
    data: {
      lotId,
      recipientEmail: RECIPIENT_EMAIL,
      recipientName: RECIPIENT_NAME,
      token: hashReleaseToken(raw),
      expiresAt,
    },
  });

  const tokens = [];
  for (const holdPoint of holdPoints) {
    tokens.push(
      await prisma.holdPointReleaseToken.create({
        data: {
          holdPointId: holdPoint.id,
          batchId: batch.id,
          recipientEmail: RECIPIENT_EMAIL,
          recipientName: RECIPIENT_NAME,
          token: hashReleaseToken(`${raw}-${holdPoint.id}`),
          expiresAt,
        },
      }),
    );
  }

  return { raw, batch, tokens };
}

function postBatchRelease(rawToken: string, holdPointIds: string[]) {
  return request(app).post(`/api/holdpoints/public/batch/${rawToken}/release`).send({
    holdPointIds,
    releasedByName: 'Submitted Free Text Name',
    releasedByOrg: 'Client Company',
    releaseNotes: 'Batch approved externally',
    signatureDataUrl: SIGNATURE_DATA_URL,
  });
}

async function auditRows() {
  return prisma.auditLog.findMany({
    where: { projectId, action: AuditAction.HP_PUBLIC_RELEASED },
  });
}

async function snapshotRows() {
  return prisma.requirementEvaluation.findMany({
    where: { projectId },
    orderBy: { entityId: 'asc' },
  });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

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
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
  await prisma.holdPointReleaseBatch.deleteMany({ where: { lotId } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
});

afterAll(async () => {
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.holdPointReleaseToken.deleteMany({ where: { holdPoint: { lotId } } });
  await prisma.holdPointReleaseBatch.deleteMany({ where: { lotId } });
  await prisma.holdPoint.deleteMany({ where: { lotId } });
  await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId } });
  await prisma.iTPInstance.deleteMany({ where: { lotId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.iTPChecklistItem.deleteMany({ where: { templateId } });
  await prisma.iTPTemplate.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('HP batch release decision — feature flag (spec §9 rollout step 2)', () => {
  it('releases with NO snapshot rows and ONE snapshotSkipped audit row when disabled', async () => {
    disableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('flag-off-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('flag-off-2');
    const { raw } = await createBatchLink([hp1, hp2], 'flag-off');

    const res = await postBatchRelease(raw, [hp1.id, hp2.id]);

    expect(res.status).toBe(200);
    expect(res.body.released).toHaveLength(2);
    expect(await snapshotRows()).toHaveLength(0);

    // Still ONE audit row, not N — the collapse is the decision grain, not the
    // flag. The flag only controls whether snapshots accompany it.
    const audits = await auditRows();
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].changes ?? '{}')).toMatchObject({
      decisionKind: 'release',
      snapshotSkipped: true,
      batchSize: 2,
    });
  });

  it('writes ONE hold_point snapshot row per released hold point when enabled', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('flag-on-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('flag-on-2');
    const { raw, batch } = await createBatchLink([hp1, hp2], 'flag-on');

    expect((await postBatchRelease(raw, [hp1.id, hp2.id])).status).toBe(200);

    const audits = await auditRows();
    expect(audits).toHaveLength(1);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(2);
    // N rows, ONE audit row — the aggregate+members shape `[R3.1-R4]`.
    expect(new Set(rows.map((row) => row.auditLogId))).toEqual(new Set([audits[0].id]));
    for (const row of rows) {
      expect(row).toMatchObject({
        entityType: 'hold_point',
        projectId,
        requirementSet: HOLD_POINT_RELEASE_REQUIREMENT_SET,
        resultSchemaVersion: 1,
        decisionKind: 'release',
        auditAction: AuditAction.HP_PUBLIC_RELEASED,
      });
      // Every row decodes, and carries the batch correlation PR 0 built for it.
      expect(decodeHoldPointReleaseResult(row)).toMatchObject({
        released: true,
        batchId: batch.id,
        batchSize: 2,
      });
    }
    expect(JSON.parse(audits[0].changes ?? '{}').snapshotSkipped).toBeUndefined();
  });

  it('keys the snapshot rows on the released hold point ids, not the anchor', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('entity-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('entity-2');
    const { holdPoint: hp3 } = await createBatchHoldPoint('entity-3');
    // Four in the link, three released — the snapshot set must track the
    // RELEASED set, not the batch's membership.
    const { holdPoint: hp4 } = await createBatchHoldPoint('entity-unreleased');
    const { raw } = await createBatchLink([hp1, hp2, hp3, hp4], 'entity-ids');

    expect((await postBatchRelease(raw, [hp1.id, hp2.id, hp3.id])).status).toBe(200);

    const rows = await snapshotRows();
    expect(new Set(rows.map((row) => row.entityId))).toEqual(new Set([hp1.id, hp2.id, hp3.id]));
    // One decision, one lot picture: hp4 is still outstanding, so every row
    // records it — and no row counts its own batch siblings as blockers.
    for (const row of rows) {
      expect(decodeHoldPointReleaseResult(row).reasonCodes).toEqual(['unreleased_hold_points']);
    }
  });

  it('records no blocking reason codes when the batch clears the lot', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('clears-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('clears-2');
    const { raw, batch } = await createBatchLink([hp1, hp2], 'clears');

    expect((await postBatchRelease(raw, [hp1.id, hp2.id])).status).toBe(200);

    for (const row of await snapshotRows()) {
      expect(decodeHoldPointReleaseResult(row)).toEqual({
        released: true,
        reasonCodes: [],
        batchId: batch.id,
        batchSize: 2,
      });
    }
  });
});

describe('HP batch release decision — actor and audit changes (spec §5 [R3.1])', () => {
  it('records the batch under a real token ROW, labelled with the recipient NAME', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('actor-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('actor-2');
    const { raw, tokens } = await createBatchLink([hp1, hp2], 'actor');

    expect((await postBatchRelease(raw, [hp1.id, hp2.id])).status).toBe(200);

    const rows = await snapshotRows();
    expect(rows).toHaveLength(2);
    const batchTokenIds = new Set(tokens.map((token) => token.id));
    for (const row of rows) {
      expect(row).toMatchObject({
        actorKind: 'external_token',
        actorUserId: null,
        actorLabel: RECIPIENT_NAME,
      });
      // One decision has one actor: every row shares the SAME token row id, and
      // it is a real row from this batch.
      expect(row.actorTokenId).toBe(rows[0].actorTokenId);
      expect(batchTokenIds.has(row.actorTokenId!)).toBe(true);
      // The recipient's EMAIL never reaches a snapshot row.
      expect(JSON.stringify(row)).not.toContain(RECIPIENT_EMAIL);
    }
  });

  it('carries the batch correlation on the audit row without leaking the recipient email', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('changes-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('changes-2');
    const { raw, batch, tokens } = await createBatchLink([hp1, hp2], 'changes');

    expect((await postBatchRelease(raw, [hp1.id, hp2.id])).status).toBe(200);

    const [audit] = await auditRows();
    const changes = JSON.parse(audit.changes ?? '{}') as Record<string, unknown>;
    expect(changes).toMatchObject({
      decisionKind: 'release',
      batchId: batch.id,
      batchSize: 2,
      releasedHoldPointIds: [hp1.id, hp2.id],
      releaseLinkIds: tokens.map((token) => token.id),
      releaseMethod: 'secure_link',
      // Token identity wins over the submitted free text (unchanged behaviour).
      releasedByName: RECIPIENT_NAME,
      submittedReleasedByName: 'Submitted Free Text Name',
    });
    // `tokenRecipient` stays inside sanitizeAuditChanges' /token/i pattern...
    expect(changes.tokenRecipient).toBe('[REDACTED]');
    expect(JSON.stringify(changes)).not.toContain(RECIPIENT_EMAIL);
    // ...while `releaseLinkIds` deliberately does NOT, or the correlation the
    // collapsed row exists to carry would be stored as the string [REDACTED].
    expect(changes.releaseLinkIds).not.toBe('[REDACTED]');
  });
});

describe('HP batch release decision — all-or-nothing (spec §12)', () => {
  it('rolls the WHOLE batch back when the decision record fails', async () => {
    enableSnapshots();
    const { holdPoint: hp1, completion: completion1 } = await createBatchHoldPoint('audit-fail-1');
    const { holdPoint: hp2, completion: completion2 } = await createBatchHoldPoint('audit-fail-2');
    const { raw, tokens } = await createBatchLink([hp1, hp2], 'audit-fail');

    auditFault.pending = true;
    const res = await postBatchRelease(raw, [hp1.id, hp2.id]);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');

    // No hold point released...
    const holdPoints = await prisma.holdPoint.findMany({ where: { id: { in: [hp1.id, hp2.id] } } });
    expect(holdPoints.every((hp) => hp.status === 'notified')).toBe(true);
    expect(holdPoints.every((hp) => hp.releasedAt === null)).toBe(true);
    // ...no ITP completion reconciled...
    const completions = await prisma.iTPCompletion.findMany({
      where: { id: { in: [completion1.id, completion2.id] } },
    });
    expect(completions.every((c) => c.verificationStatus === 'none')).toBe(true);
    // ...and no single-use token burned, or the reviewer is locked out of a
    // release that never happened.
    const stored = await prisma.holdPointReleaseToken.findMany({
      where: { id: { in: tokens.map((token) => token.id) } },
    });
    expect(stored.every((token) => token.usedAt === null)).toBe(true);

    expect(await auditRows()).toHaveLength(0);
    expect(await snapshotRows()).toHaveLength(0);
    expect(emitHoldPointWebhookEventMock).not.toHaveBeenCalled();

    // The batch link still works afterwards.
    auditFault.pending = false;
    expect((await postBatchRelease(raw, [hp1.id, hp2.id])).status).toBe(200);
  });

  it('fails the entire batch when one member is ineligible, releasing none', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('mixed-eligible');
    // Already released: the pre-transaction eligibility check rejects the whole
    // request, exactly as before the decision adoption.
    const { holdPoint: hp2 } = await createBatchHoldPoint('mixed-ineligible', 'released');
    const { raw, tokens } = await createBatchLink([hp1, hp2], 'mixed');

    const res = await postBatchRelease(raw, [hp1.id, hp2.id]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('already been released');

    expect(
      await prisma.holdPoint.findUniqueOrThrow({
        where: { id: hp1.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: 'notified' });
    const stored = await prisma.holdPointReleaseToken.findMany({
      where: { id: { in: tokens.map((token) => token.id) } },
    });
    expect(stored.every((token) => token.usedAt === null)).toBe(true);
    expect(await auditRows()).toHaveLength(0);
    expect(await snapshotRows()).toHaveLength(0);
    expect(emitHoldPointWebhookEventMock).not.toHaveBeenCalled();
  });
});

describe('HP batch release decision — concurrency (spec §12)', () => {
  it('lets one batch link be spent exactly once, under exactly one audit row', async () => {
    enableSnapshots();
    const { holdPoint: hp1 } = await createBatchHoldPoint('race-1');
    const { holdPoint: hp2 } = await createBatchHoldPoint('race-2');
    const { raw, tokens } = await createBatchLink([hp1, hp2], 'race');

    const results = await Promise.all([
      postBatchRelease(raw, [hp1.id, hp2.id]),
      postBatchRelease(raw, [hp1.id, hp2.id]),
    ]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    // The loser is rejected, never silently accepted: 400 when it lost the
    // pre-transaction eligibility check or an optimistic guard, 410 against the
    // route's already-used token response, 409 when `recordDecision` exhausted
    // its serializable retries (the new surface, spec §9 `[R3.1-R1]`).
    expect([400, 409, 410]).toContain(statuses[1]);

    const stored = await prisma.holdPointReleaseToken.findMany({
      where: { id: { in: tokens.map((token) => token.id) } },
    });
    expect(stored).toHaveLength(2);
    // Burned exactly once, by the winner, under the batch recipient identity.
    expect(stored.every((token) => token.usedAt !== null)).toBe(true);
    expect(stored.every((token) => token.releasedByName === RECIPIENT_NAME)).toBe(true);

    expect(await auditRows()).toHaveLength(1);
    expect(await snapshotRows()).toHaveLength(2);
    expect(
      await prisma.holdPoint.count({
        where: { id: { in: [hp1.id, hp2.id] }, status: 'released' },
      }),
    ).toBe(2);
  });
});

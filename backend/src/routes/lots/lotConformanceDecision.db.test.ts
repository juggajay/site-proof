// F0.4b PR 1 — the lot conformance decisions (conform / force-conform /
// de-conform) as they behave once routed through `recordDecision`
// (execution spec §11 F0.4b PR 1, §12).
//
// A separate suite from `routes/lots.test.ts` for two reasons the big file
// cannot give: `READINESS_SNAPSHOTS_ENABLED` is flipped per test, and the
// webhook dispatcher is mocked so "exactly one post-commit signal" is a
// synchronous count rather than a poll against delivery rows.
//
// DB-backed on purpose: serializable retry and the new optimistic guard are
// PostgreSQL behaviours. `src/test/databaseSafety.ts` keeps this on the local
// disposable database.

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import {
  LOT_CONFORMANCE_REQUIREMENT_SET,
  decodeLotConformanceResult,
} from '../../lib/readiness/requirements/lotConformance.v1.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { NSW_UNCLASSIFIED_SUFFICIENCY } from '../../test/sufficiencySnapshots.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { lotsRouter } from '../lots.js';

// Partial mock: only the post-commit signal is replaced, so the count of
// dispatched webhook events is directly observable.
vi.mock('./webhookEvents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./webhookEvents.js')>()),
  emitLotWebhookEvent: vi.fn(),
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

const { emitLotWebhookEvent } = await import('./webhookEvents.js');
const emitLotWebhookEventMock = vi.mocked(emitLotWebhookEvent);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/lots', lotsRouter);
app.use(errorHandler);

const tag = `lot-decision-${Date.now()}`;

let authToken: string;
let userId: string;
let companyId: string;
let projectId: string;

function enableSnapshots(): void {
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
}

function disableSnapshots(): void {
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
}

async function createLot(suffix: string, status = 'in_progress') {
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-${suffix}`,
      lotType: 'roadworks',
      activityType: 'Earthworks',
      status,
    },
  });
}

function conform(lotId: string, body: Record<string, unknown> = {}) {
  return request(app)
    .post(`/api/lots/${lotId}/conform`)
    .set('Authorization', `Bearer ${authToken}`)
    .send(body);
}

function overrideStatus(lotId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/lots/${lotId}/override-status`)
    .set('Authorization', `Bearer ${authToken}`)
    .send(body);
}

async function auditRows(lotId: string, action: string) {
  return prisma.auditLog.findMany({ where: { projectId, entityId: lotId, action } });
}

async function auditChanges(lotId: string, action: string) {
  const rows = await auditRows(lotId, action);
  expect(rows).toHaveLength(1);
  return JSON.parse(rows[0].changes ?? '{}') as Record<string, unknown>;
}

async function snapshotRows(lotId: string) {
  return prisma.requirementEvaluation.findMany({ where: { projectId, entityId: lotId } });
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const user = await registerTestUser(app, {
    emailPrefix: tag,
    fullName: 'Lot Decision Tester',
    companyId,
    roleInCompany: 'admin',
  });
  authToken = user.token;
  userId = user.userId;

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
    data: { projectId, userId, role: 'admin', status: 'active' },
  });
});

beforeEach(() => {
  emitLotWebhookEventMock.mockClear();
});

afterEach(async () => {
  disableSnapshots();
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('lot conformance decisions — feature flag (spec §9 rollout step 2)', () => {
  it('conforms with NO snapshot row and a snapshotSkipped audit marker when disabled', async () => {
    disableSnapshots();
    const lot = await createLot('flag-off');

    const res = await conform(lot.id, { force: true, reason: 'No ITP on this lot yet' });

    expect(res.status).toBe(200);
    expect(res.body.lot.status).toBe('conformed');
    expect(await snapshotRows(lot.id)).toHaveLength(0);
    expect(await auditChanges(lot.id, AuditAction.LOT_FORCE_CONFORMED)).toMatchObject({
      decisionKind: 'override',
      snapshotSkipped: true,
    });
  });

  it('writes a lot_conformance.v1 snapshot and drops the marker when enabled', async () => {
    enableSnapshots();
    const lot = await createLot('flag-on');

    const res = await conform(lot.id, { force: true, reason: 'No ITP on this lot yet' });
    expect(res.status).toBe(200);

    const rows = await snapshotRows(lot.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: 'lot',
      projectId,
      requirementSet: LOT_CONFORMANCE_REQUIREMENT_SET,
      resultSchemaVersion: 1,
      decisionKind: 'override',
      auditAction: AuditAction.LOT_FORCE_CONFORMED,
      actorKind: 'user',
      actorUserId: userId,
    });

    const [audit] = await auditRows(lot.id, AuditAction.LOT_FORCE_CONFORMED);
    expect(rows[0].auditLogId).toBe(audit.id);
    expect(JSON.parse(audit.changes ?? '{}').snapshotSkipped).toBeUndefined();
  });
});

describe('lot conformance decisions — recorded readiness (spec §11 F0.4b PR 1)', () => {
  it('records the override, its reason and the blocking codes on a force-conform', async () => {
    enableSnapshots();
    const lot = await createLot('force-snapshot');

    // No ITP assigned -> the conform gate blocks, so force is the only way
    // through and the snapshot must say exactly that.
    expect((await conform(lot.id)).status).toBe(400);

    const res = await conform(lot.id, {
      force: true,
      reason: 'Client accepted as-built deviation',
    });
    expect(res.status).toBe(200);

    const [row] = await snapshotRows(lot.id);
    expect(decodeLotConformanceResult(row)).toEqual({
      conformable: false,
      overridden: true,
      blockingReasonCodes: ['no_itp_assigned'],
      reason: 'Client accepted as-built deviation',
      sufficiency: NSW_UNCLASSIFIED_SUFFICIENCY,
    });
  });

  it('records a de-conform as an override carrying its reason', async () => {
    enableSnapshots();
    const lot = await createLot('de-conform');
    expect((await conform(lot.id, { force: true, reason: 'Force first' })).status).toBe(200);
    await prisma.requirementEvaluation.deleteMany({ where: { entityId: lot.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: lot.id } });

    const res = await overrideStatus(lot.id, {
      status: 'in_progress',
      reason: 'Defect found post-conformance',
    });
    expect(res.status).toBe(200);

    const [row] = await snapshotRows(lot.id);
    expect(row.decisionKind).toBe('override');
    expect(decodeLotConformanceResult(row)).toMatchObject({
      overridden: true,
      reason: 'Defect found post-conformance',
    });

    // The conformance stamp really was cleared, in the same transaction.
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: lot.id },
        select: { status: true, conformedAt: true, conformanceOverriddenAt: true },
      }),
    ).toMatchObject({ status: 'in_progress', conformedAt: null, conformanceOverriddenAt: null });

    expect(await auditChanges(lot.id, AuditAction.LOT_STATUS_CHANGED)).toMatchObject({
      decisionKind: 'override',
      conformanceReset: true,
    });
  });

  it('records a plain (non-forced) conform as an approval with no blockers', async () => {
    enableSnapshots();
    // A lot with an ITP whose single item is complete and needs no test:
    // the gate passes, so no force and no override.
    const template = await prisma.iTPTemplate.create({
      data: { projectId, name: `Tmpl ${tag}`, activityType: 'Earthworks' },
    });
    const checklistItem = await prisma.iTPChecklistItem.create({
      data: {
        templateId: template.id,
        sequenceNumber: 1,
        description: 'Visual check',
        pointType: 'standard',
        evidenceRequired: 'none',
      },
    });
    const lot = await createLot('approval');
    const instance = await prisma.iTPInstance.create({
      data: { lotId: lot.id, templateId: template.id, status: 'in_progress' },
    });
    await prisma.iTPCompletion.create({
      data: { itpInstanceId: instance.id, checklistItemId: checklistItem.id, status: 'completed' },
    });

    try {
      const res = await conform(lot.id);
      expect(res.status).toBe(200);

      const [row] = await snapshotRows(lot.id);
      expect(row.decisionKind).toBe('approval');
      expect(decodeLotConformanceResult(row)).toEqual({
        conformable: true,
        overridden: false,
        blockingReasonCodes: [],
        sufficiency: NSW_UNCLASSIFIED_SUFFICIENCY,
      });
      const changes = await auditChanges(lot.id, AuditAction.LOT_STATUS_CHANGED);
      expect(changes).toMatchObject({ decisionKind: 'approval' });
      // Preserved from before the adoption: `force` is the optional zod field,
      // so an unforced conform serialises it away rather than writing `false`.
      expect(changes.force).toBeUndefined();
    } finally {
      await prisma.iTPCompletion.deleteMany({ where: { itpInstanceId: instance.id } });
      await prisma.iTPInstance.deleteMany({ where: { lotId: lot.id } });
      await prisma.iTPChecklistItem.deleteMany({ where: { templateId: template.id } });
      await prisma.iTPTemplate.delete({ where: { id: template.id } }).catch(() => {});
    }
  });
});

describe('lot conformance decisions — concurrency (spec §12, new optimistic guard)', () => {
  // BEHAVIOUR CHANGE PIN (F0.4b PR 1): conform previously issued a bare
  // `prisma.lot.update({ where: { id } })` with the "already conformed" check
  // done in a separate earlier query, so two simultaneous conforms could BOTH
  // return 200 and both write an audit row. The decision's optimistic guard
  // (`status: { notIn: ['conformed','claimed'] }`) makes exactly one win.
  it('lets exactly one of two concurrent conforms win', async () => {
    enableSnapshots();
    const lot = await createLot('race');

    const results = await Promise.all([
      conform(lot.id, { force: true, reason: 'Concurrent conform A' }),
      conform(lot.id, { force: true, reason: 'Concurrent conform B' }),
    ]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    // The loser is rejected, never silently accepted: 400 when it lost before
    // the transaction opened, 409 when it lost inside it (optimistic guard or
    // exhausted serializable retries).
    expect([400, 409]).toContain(statuses[1]);

    // Exactly one decision was recorded, and exactly one post-commit signal.
    expect(await auditRows(lot.id, AuditAction.LOT_FORCE_CONFORMED)).toHaveLength(1);
    expect(await snapshotRows(lot.id)).toHaveLength(1);
    expect(emitLotWebhookEventMock.mock.calls.length).toBeLessThanOrEqual(1);

    const conformed = await prisma.lot.findUniqueOrThrow({
      where: { id: lot.id },
      select: { status: true },
    });
    expect(conformed.status).toBe('conformed');
  });

  it('lets exactly one of two concurrent de-conforms win', async () => {
    enableSnapshots();
    const lot = await createLot('race-deconform');
    expect((await conform(lot.id, { force: true, reason: 'Force first' })).status).toBe(200);
    await prisma.requirementEvaluation.deleteMany({ where: { entityId: lot.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: lot.id } });
    emitLotWebhookEventMock.mockClear();

    const results = await Promise.all([
      overrideStatus(lot.id, { status: 'in_progress', reason: 'Concurrent de-conform A' }),
      overrideStatus(lot.id, { status: 'on_hold', reason: 'Concurrent de-conform B' }),
    ]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);

    expect(await auditRows(lot.id, AuditAction.LOT_STATUS_CHANGED)).toHaveLength(1);
    expect(await snapshotRows(lot.id)).toHaveLength(1);
    expect(emitLotWebhookEventMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe('lot conformance decisions — audit integrity (spec §9 [R3.1-R1])', () => {
  // The audit row used to be a post-commit best-effort `createAuditLog` that
  // swallowed its own failures: a lot could be conformed with no audit trail.
  // It is now written INSIDE the decision transaction, so the two commit
  // together or not at all.
  it('rolls the status change back when the decision record cannot be written', async () => {
    enableSnapshots();
    const lot = await createLot('audit-hard-fail');

    auditFault.pending = true;
    const res = await conform(lot.id, { force: true, reason: 'Audit write will fail' });
    auditFault.pending = false;

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');

    // Nothing survived: no status change, no snapshot, no webhook.
    expect(
      await prisma.lot.findUniqueOrThrow({ where: { id: lot.id }, select: { status: true } }),
    ).toMatchObject({ status: 'in_progress' });
    expect(await snapshotRows(lot.id)).toHaveLength(0);
    expect(emitLotWebhookEventMock).not.toHaveBeenCalled();
  });
});

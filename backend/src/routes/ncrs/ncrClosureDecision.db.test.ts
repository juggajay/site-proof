// F0.4b PR 2 — the NCR closure decisions (close / close-by-concession /
// qm-approve) as they behave once routed through `recordDecision`
// (execution spec §11 F0.4b PR 2, §12).
//
// A separate suite from `routes/ncrs.test.ts` for two reasons the big file
// cannot give: `READINESS_SNAPSHOTS_ENABLED` is flipped per test, and the
// webhook dispatcher is mocked so "exactly one post-commit signal" is a
// synchronous count rather than a poll against delivery rows.
//
// DB-backed on purpose: serializable retry, the optimistic guards and the
// in-transaction lot cascade are PostgreSQL behaviours.
// `src/test/databaseSafety.ts` keeps this on the local disposable database.

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import {
  NCR_CLOSURE_REQUIREMENT_SET,
  decodeNcrClosureResult,
} from '../../lib/readiness/requirements/ncrClosure.v1.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import { ncrsRouter } from './index.js';

// Partial mock: only the post-commit signal is replaced, so the count of
// dispatched webhook events is directly observable.
vi.mock('./webhookEvents.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./webhookEvents.js')>()),
  emitNcrWebhookEvent: vi.fn(),
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

const { emitNcrWebhookEvent } = await import('./webhookEvents.js');
const emitNcrWebhookEventMock = vi.mocked(emitNcrWebhookEvent);

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/ncrs', ncrsRouter);
app.use(errorHandler);

const tag = `ncr-decision-${Date.now()}`;

let closerToken: string;
let closerId: string;
let qmToken: string;
let qmId: string;
let companyId: string;
let projectId: string;

function enableSnapshots(): void {
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
}

function disableSnapshots(): void {
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
}

let ncrSequence = 0;

async function createNcr(
  suffix: string,
  overrides: Record<string, unknown> = {},
  options: { withEvidence?: boolean } = {},
) {
  ncrSequence += 1;
  const ncr = await prisma.nCR.create({
    data: {
      projectId,
      ncrNumber: `${tag}-${ncrSequence}-${suffix}`,
      description: `Decision suite ${suffix}`,
      category: 'Workmanship',
      severity: 'minor',
      status: 'verification',
      raisedById: closerId,
      ...overrides,
    },
  });

  if (options.withEvidence !== false) {
    await addEvidence(ncr.id);
  }

  return ncr;
}

async function addEvidence(ncrId: string, evidenceType = 'photo') {
  const filename = `${tag}-${ncrId}-${evidenceType}.jpg`;
  const document = await prisma.document.create({
    data: {
      projectId,
      documentType: 'ncr_evidence',
      category: 'ncr_evidence',
      filename,
      fileUrl: `/uploads/documents/${filename}`,
      uploadedById: closerId,
    },
  });
  return prisma.nCREvidence.create({
    data: { ncrId, documentId: document.id, evidenceType },
  });
}

async function createLot(suffix: string, status: string) {
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

function close(ncrId: string, body: Record<string, unknown> = {}, token = closerToken) {
  return request(app)
    .post(`/api/ncrs/${ncrId}/close`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

function qmApprove(ncrId: string, token = qmToken) {
  return request(app).post(`/api/ncrs/${ncrId}/qm-approve`).set('Authorization', `Bearer ${token}`);
}

async function auditRows(ncrId: string, action: string) {
  return prisma.auditLog.findMany({ where: { projectId, entityId: ncrId, action } });
}

async function auditChanges(ncrId: string, action: string) {
  const rows = await auditRows(ncrId, action);
  expect(rows).toHaveLength(1);
  return JSON.parse(rows[0].changes ?? '{}') as Record<string, unknown>;
}

async function snapshotRows(ncrId: string) {
  return prisma.requirementEvaluation.findMany({ where: { projectId, entityId: ncrId } });
}

/**
 * Runs `during` after the route's PRE-TRANSACTION `prisma.nCR.findUnique`
 * resolves but before the decision transaction opens. The transaction's own
 * reads go through the `tx` client, which this spy does not intercept — so the
 * two reads genuinely see different data.
 */
function pauseAfterPreTransactionRead(ncrId: string, during: () => Promise<void>) {
  const originalFindUnique = prisma.nCR.findUnique.bind(prisma.nCR);
  let fired = false;

  const spy = vi.spyOn(prisma.nCR, 'findUnique');
  spy.mockImplementation(((args: Parameters<typeof originalFindUnique>[0]) =>
    originalFindUnique(args).then(async (result: unknown) => {
      if (!fired && args?.where?.id === ncrId) {
        fired = true;
        await during();
      }
      return result;
    })) as Parameters<typeof spy.mockImplementation>[0]);

  return spy;
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const closer = await registerTestUser(app, {
    emailPrefix: `${tag}-closer`,
    fullName: 'NCR Decision Closer',
    companyId,
    roleInCompany: 'admin',
  });
  closerToken = closer.token;
  closerId = closer.userId;

  const qm = await registerTestUser(app, {
    emailPrefix: `${tag}-qm`,
    fullName: 'NCR Decision QM',
    companyId,
    roleInCompany: 'member',
  });
  qmToken = qm.token;
  qmId = qm.userId;

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
      { projectId, userId: closerId, role: 'admin', status: 'active' },
      { projectId, userId: qmId, role: 'quality_manager', status: 'active' },
    ],
  });
});

beforeEach(() => {
  emitNcrWebhookEventMock.mockClear();
});

afterEach(async () => {
  disableSnapshots();
  vi.restoreAllMocks();
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.nCR.deleteMany({ where: { projectId } });
  await prisma.document.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.nCR.deleteMany({ where: { projectId } });
  await prisma.document.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  for (const userId of [closerId, qmId]) {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('NCR closure decisions — feature flag (spec §9 rollout step 2)', () => {
  it('closes with NO snapshot row and a snapshotSkipped audit marker when disabled', async () => {
    disableSnapshots();
    const ncr = await createNcr('flag-off');

    const res = await close(ncr.id, { verificationNotes: 'Rectification verified' });

    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('closed');
    expect(await snapshotRows(ncr.id)).toHaveLength(0);
    expect(await auditChanges(ncr.id, AuditAction.NCR_STATUS_CHANGED)).toMatchObject({
      decisionKind: 'closure',
      snapshotSkipped: true,
    });
  });

  it('grants QM approval with NO snapshot row and a snapshotSkipped marker when disabled', async () => {
    disableSnapshots();
    const ncr = await createNcr('qm-flag-off', {
      severity: 'major',
      qmApprovalRequired: true,
    });

    expect((await qmApprove(ncr.id)).status).toBe(200);

    expect(await snapshotRows(ncr.id)).toHaveLength(0);
    expect(await auditChanges(ncr.id, AuditAction.NCR_QM_APPROVED)).toMatchObject({
      decisionKind: 'approval',
      snapshotSkipped: true,
    });
  });

  it('writes an ncr_closure.v1 snapshot and drops the marker when enabled', async () => {
    enableSnapshots();
    const ncr = await createNcr('flag-on');

    expect((await close(ncr.id, { verificationNotes: 'Rectification verified' })).status).toBe(200);

    const rows = await snapshotRows(ncr.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: 'ncr',
      projectId,
      requirementSet: NCR_CLOSURE_REQUIREMENT_SET,
      resultSchemaVersion: 1,
      decisionKind: 'closure',
      auditAction: AuditAction.NCR_STATUS_CHANGED,
      actorKind: 'user',
      actorUserId: closerId,
    });

    const [audit] = await auditRows(ncr.id, AuditAction.NCR_STATUS_CHANGED);
    expect(rows[0].auditLogId).toBe(audit.id);
    expect(JSON.parse(audit.changes ?? '{}').snapshotSkipped).toBeUndefined();
  });
});

describe('NCR closure decisions — recorded readiness (spec §11 F0.4b PR 2)', () => {
  it('records a plain close as a closure with no blockers', async () => {
    enableSnapshots();
    const ncr = await createNcr('plain-close');

    expect((await close(ncr.id, { verificationNotes: 'Verified on site' })).status).toBe(200);

    const [row] = await snapshotRows(ncr.id);
    expect(row.decisionKind).toBe('closure');
    expect(decodeNcrClosureResult(row)).toEqual({
      closed: true,
      byConcession: false,
      serious: false,
      blockingReasonCodes: [],
      affectedLotCount: 0,
      reason: 'Verified on site',
    });
  });

  it('records a close-by-concession as byConcession with its justification', async () => {
    enableSnapshots();
    const ncr = await createNcr('concession', { severity: 'major', qmApprovalRequired: false });

    const res = await close(ncr.id, {
      withConcession: true,
      concessionJustification: 'Client accepted the as-built deviation',
      concessionRiskAssessment: 'No structural impact',
      clientApprovalReference: 'EMAIL-2026-07-26',
    });
    expect(res.status).toBe(200);
    expect(res.body.ncr.status).toBe('closed_concession');

    const [row] = await snapshotRows(ncr.id);
    expect(row.decisionKind).toBe('concession');
    expect(decodeNcrClosureResult(row)).toEqual({
      closed: true,
      byConcession: true,
      // `severity === 'major'` is the canonical seriousness predicate (spec §2).
      serious: true,
      blockingReasonCodes: [],
      affectedLotCount: 0,
      reason: 'Client accepted the as-built deviation',
    });
    expect(await auditChanges(ncr.id, AuditAction.NCR_STATUS_CHANGED)).toMatchObject({
      decisionKind: 'concession',
      withConcession: true,
    });
  });

  it('records a QM approval as an approval that has NOT closed the NCR', async () => {
    enableSnapshots();
    const ncr = await createNcr('qm-approval', {
      severity: 'major',
      qmApprovalRequired: true,
    });

    expect((await qmApprove(ncr.id)).status).toBe(200);

    const [row] = await snapshotRows(ncr.id);
    expect(row).toMatchObject({
      decisionKind: 'approval',
      auditAction: AuditAction.NCR_QM_APPROVED,
      actorUserId: qmId,
    });
    expect(decodeNcrClosureResult(row)).toEqual({
      closed: false,
      byConcession: false,
      serious: true,
      blockingReasonCodes: [],
      affectedLotCount: 0,
    });
  });

  it('reports lots another open NCR still blocks as open_ncrs, and cascades the rest', async () => {
    enableSnapshots();
    const clearedLot = await createLot('cascade-cleared', 'ncr_raised');
    const blockedLot = await createLot('cascade-blocked', 'ncr_raised');
    const ncr = await createNcr('cascade');
    const otherNcr = await createNcr('cascade-other', { status: 'open' }, { withEvidence: false });
    await prisma.nCRLot.createMany({
      data: [
        { ncrId: ncr.id, lotId: clearedLot.id },
        { ncrId: ncr.id, lotId: blockedLot.id },
        { ncrId: otherNcr.id, lotId: blockedLot.id },
      ],
    });

    expect((await close(ncr.id, { verificationNotes: 'Verified' })).status).toBe(200);

    const [row] = await snapshotRows(ncr.id);
    expect(decodeNcrClosureResult(row)).toMatchObject({
      affectedLotCount: 2,
      blockingReasonCodes: ['open_ncrs'],
    });

    // Only the lot with no other open NCR was cleared.
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: clearedLot.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: 'in_progress' });
    expect(
      await prisma.lot.findUniqueOrThrow({
        where: { id: blockedLot.id },
        select: { status: true },
      }),
    ).toMatchObject({ status: 'ncr_raised' });
  });
});

describe('NCR closure decisions — no stale reads (spec §11 F0.4b PR 2)', () => {
  // BEHAVIOUR CHANGE PIN: before PR 2 the in-transaction lot cascade decided
  // each lot's next status from the route's PRE-TRANSACTION read of
  // `ncr.ncrLots[].lot.status`. A lot conformed between that read and the
  // transaction was therefore cascaded back to `in_progress` on stale data.
  // `evaluate(tx)` re-reads the lots inside the decision, so the conform wins.
  it('cascades on the lot status read inside the transaction, not the pre-read', async () => {
    enableSnapshots();
    const lot = await createLot('stale-read', 'ncr_raised');
    const ncr = await createNcr('stale-read');
    await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId: lot.id } });

    const spy = pauseAfterPreTransactionRead(ncr.id, async () => {
      await prisma.lot.update({ where: { id: lot.id }, data: { status: 'conformed' } });
    });

    try {
      expect((await close(ncr.id, { verificationNotes: 'Verified' })).status).toBe(200);
    } finally {
      spy.mockRestore();
    }

    // Stale-read behaviour would have written 'in_progress' over the conform.
    expect(
      await prisma.lot.findUniqueOrThrow({ where: { id: lot.id }, select: { status: true } }),
    ).toMatchObject({ status: 'conformed' });
  });

  it('rejects the close when the rectification evidence is removed mid-decision', async () => {
    enableSnapshots();
    const ncr = await createNcr('evidence-race');

    const spy = pauseAfterPreTransactionRead(ncr.id, async () => {
      await prisma.nCREvidence.deleteMany({ where: { ncrId: ncr.id } });
    });

    let res;
    try {
      res = await close(ncr.id, { verificationNotes: 'Evidence pulled underneath us' });
    } finally {
      spy.mockRestore();
    }

    // The in-transaction guard (`ncrEvidence: { some: {} }`) catches what the
    // pre-transaction read could not see.
    expect([400, 409]).toContain(res.status);
    expect(
      await prisma.nCR.findUniqueOrThrow({ where: { id: ncr.id }, select: { status: true } }),
    ).toMatchObject({ status: 'verification' });
    expect(await auditRows(ncr.id, AuditAction.NCR_STATUS_CHANGED)).toHaveLength(0);
    expect(await snapshotRows(ncr.id)).toHaveLength(0);
    expect(emitNcrWebhookEventMock).not.toHaveBeenCalled();
  });
});

describe('NCR closure decisions — concurrency (spec §12)', () => {
  it('lets exactly one of two concurrent closes win', async () => {
    enableSnapshots();
    const lot = await createLot('race-lot', 'ncr_raised');
    const ncr = await createNcr('race');
    await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId: lot.id } });

    const results = await Promise.all([
      close(ncr.id, { verificationNotes: 'Concurrent close A' }),
      close(ncr.id, { verificationNotes: 'Concurrent close B' }),
    ]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    // The loser is rejected, never silently accepted: 400 when it lost before
    // the transaction opened, 409 when it lost inside it (optimistic guard or
    // exhausted serializable retries).
    expect([400, 409]).toContain(statuses[1]);

    expect(await auditRows(ncr.id, AuditAction.NCR_STATUS_CHANGED)).toHaveLength(1);
    expect(await snapshotRows(ncr.id)).toHaveLength(1);
    expect(emitNcrWebhookEventMock.mock.calls.length).toBeLessThanOrEqual(1);

    expect(
      await prisma.nCR.findUniqueOrThrow({ where: { id: ncr.id }, select: { status: true } }),
    ).toMatchObject({ status: 'closed' });
    expect(
      await prisma.lot.findUniqueOrThrow({ where: { id: lot.id }, select: { status: true } }),
    ).toMatchObject({ status: 'in_progress' });
  });

  it('lets exactly one of two concurrent QM approvals win', async () => {
    enableSnapshots();
    const ncr = await createNcr('qm-race', { severity: 'major', qmApprovalRequired: true });

    const results = await Promise.all([qmApprove(ncr.id), qmApprove(ncr.id)]);
    const statuses = results.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(200);
    expect([400, 409]).toContain(statuses[1]);

    expect(await auditRows(ncr.id, AuditAction.NCR_QM_APPROVED)).toHaveLength(1);
    expect(await snapshotRows(ncr.id)).toHaveLength(1);
    expect(
      await prisma.nCR.findUniqueOrThrow({
        where: { id: ncr.id },
        select: { qmApprovedById: true },
      }),
    ).toMatchObject({ qmApprovedById: qmId });
  });
});

describe('NCR closure decisions — audit integrity (spec §9 [R3.1-R1])', () => {
  // The audit row used to be a post-commit best-effort `createAuditLog` that
  // swallowed its own failures: an NCR could be closed with no audit trail, and
  // its lots cascaded with nothing recording why. It is now written INSIDE the
  // decision transaction, so they commit together or not at all.
  it('rolls the close AND its lot cascade back when the decision record fails', async () => {
    enableSnapshots();
    const lot = await createLot('audit-fail-lot', 'ncr_raised');
    const ncr = await createNcr('audit-hard-fail');
    await prisma.nCRLot.create({ data: { ncrId: ncr.id, lotId: lot.id } });

    auditFault.pending = true;
    const res = await close(ncr.id, { verificationNotes: 'Audit write will fail' });
    auditFault.pending = false;

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');

    // Nothing survived: the NCR is still open, the lot is still ncr_raised.
    expect(
      await prisma.nCR.findUniqueOrThrow({
        where: { id: ncr.id },
        select: { status: true, closedAt: true },
      }),
    ).toMatchObject({ status: 'verification', closedAt: null });
    expect(
      await prisma.lot.findUniqueOrThrow({ where: { id: lot.id }, select: { status: true } }),
    ).toMatchObject({ status: 'ncr_raised' });
    expect(await snapshotRows(ncr.id)).toHaveLength(0);
    expect(emitNcrWebhookEventMock).not.toHaveBeenCalled();
  });

  it('rolls the QM approval back when the decision record fails', async () => {
    enableSnapshots();
    const ncr = await createNcr('qm-audit-hard-fail', {
      severity: 'major',
      qmApprovalRequired: true,
    });

    auditFault.pending = true;
    const res = await qmApprove(ncr.id);
    auditFault.pending = false;

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');
    expect(
      await prisma.nCR.findUniqueOrThrow({
        where: { id: ncr.id },
        select: { qmApprovedAt: true, qmApprovedById: true },
      }),
    ).toMatchObject({ qmApprovedAt: null, qmApprovedById: null });
    expect(await snapshotRows(ncr.id)).toHaveLength(0);
  });
});

// The before/after evidence gate as the route enforces it (benchmark T6).
describe('close: after-evidence gate', () => {
  it('blocks a clean close when the only evidence is a before photo', async () => {
    const ncr = await createNcr('before-only', {}, { withEvidence: false });
    await addEvidence(ncr.id, 'before_photo');

    const res = await close(ncr.id, { verificationNotes: 'Looks fine from here' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      'Add at least one photo of the completed rectification before closing.',
    );
    expect(res.body.error.details.code).toBe('NCR_MISSING_AFTER_EVIDENCE');
    expect(
      await prisma.nCR.findUniqueOrThrow({ where: { id: ncr.id }, select: { status: true } }),
    ).toMatchObject({ status: 'verification' });
  });

  it('allows the close once an after photo is attached', async () => {
    const ncr = await createNcr('before-then-after', {}, { withEvidence: false });
    await addEvidence(ncr.id, 'before_photo');
    expect((await close(ncr.id, { verificationNotes: 'Too early' })).status).toBe(400);

    await addEvidence(ncr.id, 'after_photo');

    expect((await close(ncr.id, { verificationNotes: 'Rectification verified' })).status).toBe(200);
    expect(
      await prisma.nCR.findUniqueOrThrow({ where: { id: ncr.id }, select: { status: true } }),
    ).toMatchObject({ status: 'closed' });
  });

  it('still closes a legacy NCR whose evidence predates the before/after split', async () => {
    // `createNcr` attaches plain `photo` evidence, exactly as pre-T6 records carry.
    const ncr = await createNcr('legacy-evidence');

    expect((await close(ncr.id, { verificationNotes: 'Verified' })).status).toBe(200);
    expect(
      await prisma.nCR.findUniqueOrThrow({ where: { id: ncr.id }, select: { status: true } }),
    ).toMatchObject({ status: 'closed' });
  });

  it('exempts a concession close — an accepted defect has no rectification photo', async () => {
    const ncr = await createNcr('concession-before-only', {}, { withEvidence: false });
    await addEvidence(ncr.id, 'before_photo');

    const res = await close(ncr.id, {
      withConcession: true,
      concessionJustification: 'Accepted as constructed; within tolerance for this element.',
      concessionRiskAssessment: 'No structural or durability risk over the design life.',
    });

    expect(res.status).toBe(200);
    expect(
      await prisma.nCR.findUniqueOrThrow({ where: { id: ncr.id }, select: { status: true } }),
    ).toMatchObject({ status: 'closed_concession' });
  });
});

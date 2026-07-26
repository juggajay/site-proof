// F0.4b PR 5 — claim create as ONE inclusion decision with a MULTI-GRAIN
// snapshot: 1 aggregate `claim` row + N `claim_lot` rows (ClaimedLot.id) + M
// `claim_variation` rows (Variation.id), all under ONE audit row (execution spec
// §11 F0.4b PR 5, §3 `[R3-3]`, §12).
//
// A separate suite from `routes/claims.test.ts` for the reasons PR 2–4 split
// theirs out: `READINESS_SNAPSHOTS_ENABLED` is flipped per test, and the
// in-transaction audit write is fault-injected so all-or-nothing rollback is
// directly observable.
//
// DB-backed on purpose: the serializable retry, `SELECT … FOR UPDATE`, the
// `(projectId, requestKey)` unique index and the claim-number collision are all
// PostgreSQL behaviours. `src/test/databaseSafety.ts` keeps this on the local
// disposable database.

import express from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AuditAction } from '../../lib/auditLog.js';
import { prisma } from '../../lib/prisma.js';
import { MEMBER_RESULT_MAX_BYTES } from '../../lib/readiness/recordDecision.js';
import {
  CLAIM_MEMBER_REQUIREMENT_SET,
  decodeClaimMemberResult,
} from '../../lib/readiness/requirements/claimMember.v1.js';
import {
  CLAIM_READINESS_REQUIREMENT_SET,
  decodeClaimReadinessResult,
} from '../../lib/readiness/requirements/claimReadiness.v1.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import claimsRouter from '../claims.js';
import { lotStatusTimelineRouter } from '../lotStatusTimeline.js';
import { CLAIM_LOTS_MAX } from './workflowValidation.js';

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

const app = express();
// 10mb, not the 100kb default: the `.max(5000)` rejection test posts a body just
// over the bound, which would otherwise 413 before zod ever saw it.
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/projects', claimsRouter);
// The map time scrubber reads the collapsed decision row, so its route is part
// of what this suite covers.
app.use('/api/projects', lotStatusTimelineRouter);
app.use(errorHandler);

const tag = `claim-decision-${Date.now()}`;

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

let sequence = 0;

async function createConformedLot(budgetAmount: number) {
  sequence += 1;
  return prisma.lot.create({
    data: {
      projectId,
      lotNumber: `${tag}-LOT-${sequence}`,
      status: 'conformed',
      lotType: 'chainage',
      activityType: 'Earthworks',
      budgetAmount,
      conformedAt: new Date(),
      conformedById: userId,
    },
  });
}

async function createApprovedVariation(approvedAmount: number) {
  sequence += 1;
  return prisma.variation.create({
    data: {
      projectId,
      variationNumber: `${tag}-VAR-${sequence}`,
      title: `Variation ${sequence}`,
      status: 'approved',
      approvedAmount,
      createdById: userId,
    },
  });
}

type ClaimBody = {
  lots?: { lotId: string; percentageComplete: number }[];
  variationIds?: string[];
  requestKey?: string;
};

function postClaim(body: ClaimBody) {
  return request(app)
    .post(`/api/projects/${projectId}/claims`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({ periodStart: '2025-09-01', periodEnd: '2025-09-30', ...body });
}

function claimLot(lotId: string, percentageComplete: number, requestKey?: string) {
  return postClaim({
    lots: [{ lotId, percentageComplete }],
    ...(requestKey ? { requestKey } : {}),
  });
}

async function auditRows() {
  return prisma.auditLog.findMany({
    where: { projectId, action: AuditAction.CLAIM_CREATED },
    orderBy: { createdAt: 'asc' },
  });
}

async function lotStatusAuditRows(lotId: string) {
  return prisma.auditLog.findMany({
    where: { projectId, entityType: 'lot', entityId: lotId },
  });
}

async function snapshotRows() {
  return prisma.requirementEvaluation.findMany({
    where: { projectId },
    orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }],
  });
}

async function rowsOfType(entityType: string) {
  return (await snapshotRows()).filter((row) => row.entityType === entityType);
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const user = await registerTestUser(app, {
    emailPrefix: 'claim-decision',
    fullName: 'Claim Decision User',
    companyId,
    roleInCompany: 'project_manager',
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
    data: { projectId, userId, role: 'project_manager', status: 'active' },
  });
});

afterEach(async () => {
  disableSnapshots();
  auditFault.pending = false;
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
  await prisma.variation.deleteMany({ where: { projectId } });
  await prisma.progressClaim.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { projectId } });
  await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId } });
  await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
  await prisma.variation.deleteMany({ where: { projectId } });
  await prisma.progressClaim.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
});

describe('claim inclusion decision — feature flag (spec §9 rollout step 2)', () => {
  it('creates the claim with NO snapshot rows and ONE snapshotSkipped audit row when disabled', async () => {
    disableSnapshots();
    const lot = await createConformedLot(100000);

    const res = await claimLot(lot.id, 40);

    expect(res.status).toBe(201);
    expect(await snapshotRows()).toHaveLength(0);

    const audits = await auditRows();
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].changes ?? '{}')).toMatchObject({
      decisionKind: 'inclusion',
      snapshotSkipped: true,
      claimNumber: 1,
      lotCount: 1,
      variationCount: 0,
    });
  });

  it('writes the aggregate + one row per member when enabled', async () => {
    enableSnapshots();
    const lot = await createConformedLot(100000);

    const res = await claimLot(lot.id, 40);
    expect(res.status).toBe(201);

    const audits = await auditRows();
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].changes ?? '{}').snapshotSkipped).toBeUndefined();

    const rows = await snapshotRows();
    expect(rows).toHaveLength(2);
    // Aggregate + members under the SAME audit row — the whole point of the
    // multi-grain shape (`[R3.1-R4]`).
    expect(new Set(rows.map((row) => row.auditLogId))).toEqual(new Set([audits[0].id]));

    const [aggregate] = await rowsOfType('claim');
    expect(aggregate).toMatchObject({
      entityId: res.body.claim.id,
      projectId,
      requirementSet: CLAIM_READINESS_REQUIREMENT_SET,
      resultSchemaVersion: 1,
      decisionKind: 'inclusion',
      auditAction: AuditAction.CLAIM_CREATED,
      actorKind: 'user',
      actorUserId: userId,
      actorTokenId: null,
      // Replay stays on the existing `(projectId, requestKey)` machinery, so
      // `recordDecision` is never given a requestKey to persist (`[R3.1-B2]`).
      requestKey: null,
    });
    expect(decodeClaimReadinessResult(aggregate)).toEqual({
      memberCounts: { total: 1, lots: 1, variations: 0, ready: 1, blocked: 0 },
      totalClaimedValue: 40000,
      blockingReasonCounts: {},
    });
  });
});

describe('claim inclusion decision — multi-grain snapshots (spec §3 [R3-3])', () => {
  it('keys claim_lot rows on ClaimedLot.id and claim_variation rows on Variation.id', async () => {
    enableSnapshots();
    const lotA = await createConformedLot(100000);
    const lotB = await createConformedLot(50000);
    const variation = await createApprovedVariation(1250.5);

    const res = await postClaim({
      lots: [
        { lotId: lotA.id, percentageComplete: 25 },
        { lotId: lotB.id, percentageComplete: 100 },
      ],
      variationIds: [variation.id],
    });
    expect(res.status).toBe(201);
    const claimId = res.body.claim.id as string;

    // 1 aggregate + 2 claim_lot + 1 claim_variation = 4 rows, one audit row.
    const rows = await snapshotRows();
    expect(rows).toHaveLength(4);
    expect(await auditRows()).toHaveLength(1);

    const claimedLots = await prisma.claimedLot.findMany({ where: { claimId } });
    expect(claimedLots).toHaveLength(2);

    const lotRows = await rowsOfType('claim_lot');
    expect(lotRows).toHaveLength(2);
    // The ClaimedLot JOIN row id, NOT the lot id — the same lot can be claimed
    // across several claims, so the lot id is not unique per decision.
    expect(new Set(lotRows.map((row) => row.entityId))).toEqual(
      new Set(claimedLots.map((row) => row.id)),
    );
    expect(lotRows.map((row) => row.entityId)).not.toContain(lotA.id);

    const variationRows = await rowsOfType('claim_variation');
    expect(variationRows).toHaveLength(1);
    // Variations have no join row — they link back via `Variation.claimedInId`.
    expect(variationRows[0].entityId).toBe(variation.id);

    for (const row of [...lotRows, ...variationRows]) {
      expect(row).toMatchObject({
        requirementSet: CLAIM_MEMBER_REQUIREMENT_SET,
        resultSchemaVersion: 1,
        decisionKind: 'inclusion',
        auditAction: AuditAction.CLAIM_CREATED,
        projectId,
      });
      // Every member row decodes, and stays inside the hard 1 KB budget.
      expect(decodeClaimMemberResult(row).ready).toBe(true);
      expect(Buffer.byteLength(JSON.stringify(row.result), 'utf8')).toBeLessThanOrEqual(
        MEMBER_RESULT_MAX_BYTES,
      );
    }

    const byClaimedLotId = new Map(claimedLots.map((row) => [row.id, row.lotId]));
    const memberByLotId = new Map(
      lotRows.map((row) => [byClaimedLotId.get(row.entityId), decodeClaimMemberResult(row)]),
    );
    expect(memberByLotId.get(lotA.id)).toEqual({
      memberType: 'lot',
      ready: true,
      blockingReasonCodes: [],
      claimedValue: 25000,
      claimedPercentage: 25,
    });
    expect(memberByLotId.get(lotB.id)).toEqual({
      memberType: 'lot',
      ready: true,
      blockingReasonCodes: [],
      claimedValue: 50000,
      claimedPercentage: 100,
    });
    expect(decodeClaimMemberResult(variationRows[0])).toEqual({
      memberType: 'variation',
      ready: true,
      blockingReasonCodes: [],
      claimedValue: 1250.5,
    });

    // The aggregate is COUNTS AND TOTALS ONLY, derived from the member verdicts
    // — never a member-id array (`[R3.1-B3]`).
    const [aggregate] = await rowsOfType('claim');
    expect(decodeClaimReadinessResult(aggregate)).toEqual({
      memberCounts: { total: 3, lots: 2, variations: 1, ready: 3, blocked: 0 },
      totalClaimedValue: 76250.5,
      blockingReasonCounts: {},
    });
    const aggregateJson = JSON.stringify(aggregate.result);
    for (const memberId of [...claimedLots.map((row) => row.id), variation.id]) {
      expect(aggregateJson).not.toContain(memberId);
    }
  });

  it('records the cumulative percentage a second partial claim reaches', async () => {
    enableSnapshots();
    const lot = await createConformedLot(100000);

    expect((await claimLot(lot.id, 30)).status).toBe(201);
    await prisma.requirementEvaluation.deleteMany({ where: { projectId } });
    expect((await claimLot(lot.id, 45)).status).toBe(201);

    const [member] = await rowsOfType('claim_lot');
    // 30% already claimed + this claim's 45% = 75% cumulative, on a claim whose
    // own increment value is $45,000.
    expect(decodeClaimMemberResult(member)).toMatchObject({
      claimedValue: 45000,
      claimedPercentage: 75,
    });
  });
});

describe('claim inclusion decision — audit collapse (spec §11 [R3.1-R4])', () => {
  it('replaces the per-lot lot_status_changed rows with one decision row', async () => {
    enableSnapshots();
    const lotA = await createConformedLot(10000);
    const lotB = await createConformedLot(20000);

    const res = await postClaim({
      lots: [
        { lotId: lotA.id, percentageComplete: 100 },
        { lotId: lotB.id, percentageComplete: 50 },
      ],
    });
    expect(res.status).toBe(201);

    // Exactly ONE audit row for the whole decision...
    const audits = await auditRows();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: 'progress_claim', entityId: res.body.claim.id });
    // ...and no per-lot rows at all, for the fully claimed lot or the partial one.
    expect(await lotStatusAuditRows(lotA.id)).toHaveLength(0);
    expect(await lotStatusAuditRows(lotB.id)).toHaveLength(0);

    // The deleted loop's information, preserved and correlated: only lotA went
    // to 100%, and only lotA flipped to `claimed`.
    expect(JSON.parse(audits[0].changes ?? '{}')).toEqual({
      decisionKind: 'inclusion',
      claimNumber: 1,
      totalClaimedAmount: 20000,
      lotCount: 2,
      variationCount: 0,
      fullyClaimedLotIds: [lotA.id],
    });
    expect(await prisma.lot.findUniqueOrThrow({ where: { id: lotA.id } })).toMatchObject({
      status: 'claimed',
      claimedInId: res.body.claim.id,
    });
    expect(await prisma.lot.findUniqueOrThrow({ where: { id: lotB.id } })).toMatchObject({
      status: 'conformed',
      claimedInId: null,
    });
  });

  it('still feeds the map time scrubber the conformed -> claimed transition', async () => {
    const lot = await createConformedLot(10000);
    expect((await claimLot(lot.id, 100)).status).toBe(201);

    const timeline = await request(app)
      .get(`/api/projects/${projectId}/lots/status-timeline`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(timeline.status).toBe(200);
    const entry = timeline.body.lots.find((item: { lotId: string }) => item.lotId === lot.id);
    // The per-lot audit rows are gone, so the scrubber now reads the transition
    // out of the decision row's `fullyClaimedLotIds`.
    expect(entry.events).toEqual([expect.objectContaining({ from: 'conformed', to: 'claimed' })]);
  });
});

describe('claim inclusion decision — all-or-nothing (spec §12)', () => {
  it('rolls the WHOLE claim back when the decision record fails', async () => {
    enableSnapshots();
    const lot = await createConformedLot(100000);
    const variation = await createApprovedVariation(500);

    auditFault.pending = true;
    const res = await postClaim({
      lots: [{ lotId: lot.id, percentageComplete: 100 }],
      variationIds: [variation.id],
    });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SNAPSHOT_WRITE_FAILED');

    // No claim, no members, no status flips, no audit row, no snapshots.
    expect(await prisma.progressClaim.count({ where: { projectId } })).toBe(0);
    expect(await prisma.claimedLot.count({ where: { lotId: lot.id } })).toBe(0);
    expect(await prisma.lot.findUniqueOrThrow({ where: { id: lot.id } })).toMatchObject({
      status: 'conformed',
      claimedInId: null,
    });
    expect(await prisma.variation.findUniqueOrThrow({ where: { id: variation.id } })).toMatchObject(
      {
        status: 'approved',
        claimedInId: null,
      },
    );
    expect(await auditRows()).toHaveLength(0);
    expect(await snapshotRows()).toHaveLength(0);

    // ...and the same request works immediately afterwards.
    auditFault.pending = false;
    const retry = await postClaim({
      lots: [{ lotId: lot.id, percentageComplete: 100 }],
      variationIds: [variation.id],
    });
    expect(retry.status).toBe(201);
    expect(await snapshotRows()).toHaveLength(3);
  });
});

describe('claim inclusion decision — replay stays on the existing machinery ([R3.1-B2])', () => {
  it('replays a same-requestKey create without a second claim, audit row or snapshot set', async () => {
    enableSnapshots();
    const lot = await createConformedLot(100000);
    const requestKey = '55555555-5555-4555-8555-555555555555';

    const first = await claimLot(lot.id, 50, requestKey);
    expect(first.status).toBe(201);
    expect(await snapshotRows()).toHaveLength(2);

    const replay = await claimLot(lot.id, 50, requestKey);
    expect(replay.status).toBe(201);
    expect(replay.body.claim.id).toBe(first.body.claim.id);

    // The F-03 double-billing guarantee: one claim, one increment...
    expect(await prisma.progressClaim.count({ where: { projectId, requestKey } })).toBe(1);
    expect(await prisma.claimedLot.count({ where: { lotId: lot.id } })).toBe(1);
    // ...one audit row, and the snapshots are NOT written a second time.
    expect(await auditRows()).toHaveLength(1);
    expect(await snapshotRows()).toHaveLength(2);
  });

  it('converges concurrent same-key creates to one claim and one audit row', async () => {
    enableSnapshots();
    const lot = await createConformedLot(100000);
    const requestKey = '66666666-6666-4666-8666-666666666666';

    const responses = await Promise.all([
      claimLot(lot.id, 50, requestKey),
      claimLot(lot.id, 50, requestKey),
    ]);

    // Both callers get the winner's claim — losing the write race is not an
    // error when the key already names a committed claim.
    expect(responses.map((res) => res.status)).toEqual([201, 201]);
    expect(new Set(responses.map((res) => res.body.claim.id)).size).toBe(1);

    expect(await prisma.progressClaim.count({ where: { projectId, requestKey } })).toBe(1);
    expect(await prisma.claimedLot.count({ where: { lotId: lot.id } })).toBe(1);
    expect(await auditRows()).toHaveLength(1);
    expect(await snapshotRows()).toHaveLength(2);
  });
});

describe('claim inclusion decision — concurrency (spec §12)', () => {
  it('lets one of two concurrent creates over the same lot win', async () => {
    enableSnapshots();
    const lot = await createConformedLot(100000);

    const responses = await Promise.all([claimLot(lot.id, 100), claimLot(lot.id, 100)]);
    const statuses = responses.map((res) => res.status).sort((a, b) => a - b);

    expect(statuses[0]).toBe(201);
    // The loser is rejected, never silently accepted: 400 from the cumulative
    // guard or an optimistic count guard, 409 when `recordDecision` exhausted
    // its serializable retries (the new surface, spec §9 `[R3.1-R1]`).
    expect([400, 409]).toContain(statuses[1]);

    expect(await prisma.progressClaim.count({ where: { projectId } })).toBe(1);
    expect(await prisma.claimedLot.count({ where: { lotId: lot.id } })).toBe(1);
    // Exactly one audit row and one complete snapshot set — the loser left
    // nothing behind.
    expect(await auditRows()).toHaveLength(1);
    expect(await snapshotRows()).toHaveLength(2);
  });

  it('converges concurrent creates over DIFFERENT lots on distinct claim numbers', async () => {
    // The claim-number collision path: both creates read the same current max
    // inside their transactions, so one hits the `(projectId, claimNumber)`
    // unique index. It is re-thrown as a write conflict, and `recordDecision`'s
    // retry — the ONE retry classifier — re-runs `evaluate` for a fresh number.
    enableSnapshots();
    const lotA = await createConformedLot(10000);
    const lotB = await createConformedLot(20000);

    const responses = await Promise.all([claimLot(lotA.id, 100), claimLot(lotB.id, 100)]);
    expect(responses.map((res) => res.status)).toEqual([201, 201]);

    const claims = await prisma.progressClaim.findMany({
      where: { projectId },
      orderBy: { claimNumber: 'asc' },
    });
    expect(claims.map((claim) => claim.claimNumber)).toEqual([1, 2]);
    expect(await auditRows()).toHaveLength(2);
    // Two decisions, each with its own aggregate + one member.
    expect(await rowsOfType('claim')).toHaveLength(2);
    expect(await rowsOfType('claim_lot')).toHaveLength(2);
  });

  it('retries a claim-number collision under recordDecision and converges', async () => {
    // The above test races two creates, which under Serializable may abort on
    // 40001 before either reaches the unique index. This one forces the
    // `(projectId, claimNumber)` P2002 DETERMINISTICALLY, so the classification
    // path (P2002 on claim number -> write conflict -> `recordDecision` retry ->
    // fresh `evaluate` -> fresh number) is genuinely exercised.
    //
    // `nextval` is non-transactional, so the counter survives the rolled-back
    // first attempt: attempt 1 is forced onto the existing claim's number and
    // collides; attempt 2 inserts unmolested.
    enableSnapshots();
    const existingLot = await createConformedLot(10000);
    expect((await claimLot(existingLot.id, 100)).status).toBe(201);

    const lot = await createConformedLot(20000);
    await prisma.$executeRaw`CREATE SEQUENCE test_pr5_claim_collision_seq`;
    await prisma.$executeRaw`
      CREATE OR REPLACE FUNCTION test_pr5_force_claim_number()
      RETURNS trigger AS $$
      BEGIN
        IF nextval('test_pr5_claim_collision_seq') = 1 THEN
          NEW.claim_number := 1;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    await prisma.$executeRaw`
      CREATE TRIGGER test_pr5_force_claim_number_trigger
      BEFORE INSERT ON progress_claims
      FOR EACH ROW
      EXECUTE FUNCTION test_pr5_force_claim_number()
    `;

    try {
      const res = await claimLot(lot.id, 100);

      // No 409, no 500: the collision was reclassified and retried, not surfaced.
      expect(res.status).toBe(201);
      expect(res.body.claim.claimNumber).toBe(2);
    } finally {
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS test_pr5_force_claim_number_trigger ON progress_claims
      `;
      await prisma.$executeRaw`DROP FUNCTION IF EXISTS test_pr5_force_claim_number()`;
      await prisma.$executeRaw`DROP SEQUENCE IF EXISTS test_pr5_claim_collision_seq`;
    }

    // Two claims, two audit rows, two complete snapshot sets — the rolled-back
    // attempt left no audit row and no orphan snapshots behind.
    expect(await prisma.progressClaim.count({ where: { projectId } })).toBe(2);
    expect(await auditRows()).toHaveLength(2);
    expect(await rowsOfType('claim')).toHaveLength(2);
    expect(await rowsOfType('claim_lot')).toHaveLength(2);
    expect(await prisma.claimedLot.count({ where: { lotId: lot.id } })).toBe(1);
  });
});

describe('claim inclusion decision — claim size bound (spec §3)', () => {
  it(`rejects a claim over ${CLAIM_LOTS_MAX} lots before any work happens`, async () => {
    const lot = await createConformedLot(1000);
    const lots = Array.from({ length: CLAIM_LOTS_MAX + 1 }, () => ({
      lotId: lot.id,
      percentageComplete: 1,
    }));

    const res = await postClaim({ lots });

    expect(res.status).toBe(400);
    // The stable message rides in the zod issue list, where every other claim
    // field-level rejection on this route puts it.
    expect(res.body.error.details.issues).toEqual([
      expect.objectContaining({
        path: ['lots'],
        message: `lots cannot contain more than ${CLAIM_LOTS_MAX} items`,
      }),
    ]);
    expect(await prisma.progressClaim.count({ where: { projectId } })).toBe(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it(`accepts a claim at exactly ${CLAIM_LOTS_MAX} lots through validation`, async () => {
    // Not a 400 from the `.max()` — it fails later, on the duplicate-lot guard,
    // which proves the bound itself let it through.
    const lot = await createConformedLot(1000);
    const lots = Array.from({ length: CLAIM_LOTS_MAX }, () => ({
      lotId: lot.id,
      percentageComplete: 1,
    }));

    const res = await postClaim({ lots });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Duplicate lots cannot be added to the same claim');
  });
});

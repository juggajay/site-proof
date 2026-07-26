// DB-backed acceptance tests for `recordDecision` (execution spec §12, the
// F0.4a-relevant subset). These run against the LOCAL disposable test database
// only — `src/test/databaseSafety.ts` refuses anything else.
//
// Everything here is exercised against real PostgreSQL on purpose: the three
// properties under test (atomicity, serializable retry, DB-enforced uniqueness)
// are database behaviours. A mocked Prisma client would prove nothing about any
// of them.

import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { AppError } from '../AppError.js';
import { prisma } from '../prisma.js';
import {
  CLAIM_MEMBER_REQUIREMENT_SET,
  CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
  buildClaimMemberResultV1,
  decodeClaimMemberResult,
  type ClaimMemberResultV1,
} from './requirements/claimMember.v1.js';
import {
  CLAIM_READINESS_REQUIREMENT_SET,
  CLAIM_READINESS_RESULT_SCHEMA_VERSION,
  buildClaimReadinessResultV1,
  decodeClaimReadinessResult,
} from './requirements/claimReadiness.v1.js';
import {
  DecisionSnapshotInput,
  MAX_DECISION_ATTEMPTS,
  MEMBER_RESULT_MAX_BYTES,
  SNAPSHOT_CHUNK_SIZE,
  readinessSnapshotsEnabled,
  recordDecision,
} from './recordDecision.js';

const tag = `rec-dec-${Date.now()}`;

let companyId: string;
let userId: string;
let projectId: string;
let otherProjectId: string;
let lotId: string;
let otherProjectLotId: string;
let claimId: string;
let testResultId: string;

function enableSnapshots(): void {
  process.env.READINESS_SNAPSHOTS_ENABLED = 'true';
}

function disableSnapshots(): void {
  delete process.env.READINESS_SNAPSHOTS_ENABLED;
}

/** A minimal single-lot decision: evaluate reads the lot, mutate conforms it. */
function lotDecision(overrides: Partial<Parameters<typeof recordDecision>[0]> = {}) {
  return {
    projectId,
    entityType: 'lot' as const,
    entityId: lotId,
    decisionKind: 'approval' as const,
    auditAction: 'lot_conformed',
    actor: { kind: 'user' as const, userId },
    evaluate: async (tx: Parameters<NonNullable<typeof overrides.evaluate>>[0]) =>
      tx.lot.findUniqueOrThrow({ where: { id: lotId }, select: { id: true, status: true } }),
    mutate: async (tx: Parameters<NonNullable<typeof overrides.evaluate>>[0]) =>
      tx.lot.update({ where: { id: lotId }, data: { status: 'conformed' } }),
    snapshots: (): DecisionSnapshotInput[] => [
      {
        entityType: 'lot',
        entityId: lotId,
        requirementSet: 'lot_conformance.v1',
        resultSchemaVersion: 1,
        result: { ready: true, blockingReasonCodes: [] },
      },
    ],
    ...overrides,
  } as Parameters<typeof recordDecision>[0];
}

async function snapshotRowsForProject() {
  return prisma.requirementEvaluation.findMany({ where: { projectId } });
}

async function auditRowsForLot() {
  return prisma.auditLog.findMany({ where: { projectId, entityId: lotId } });
}

/** A rolled-back decision leaves neither a snapshot nor an audit row behind. */
async function expectDecisionNotPersisted() {
  expect(await snapshotRowsForProject()).toHaveLength(0);
  expect(await auditRowsForLot()).toHaveLength(0);
}

beforeAll(async () => {
  const company = await prisma.company.create({ data: { name: `Co ${tag}` } });
  companyId = company.id;

  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.com`,
      passwordHash: '$2a$12$test',
      fullName: 'Decision Tester',
      roleInCompany: 'admin',
      companyId,
      emailVerified: true,
    },
  });
  userId = user.id;

  const project = await prisma.project.create({
    data: {
      companyId,
      name: `Project ${tag}`,
      projectNumber: `P-${tag}`,
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  projectId = project.id;

  const otherProject = await prisma.project.create({
    data: {
      companyId,
      name: `Other ${tag}`,
      projectNumber: `P2-${tag}`,
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  otherProjectId = otherProject.id;

  const lot = await prisma.lot.create({
    data: { projectId, lotNumber: `LOT-${tag}`, lotType: 'earthworks', activityType: 'fill' },
  });
  lotId = lot.id;

  const otherLot = await prisma.lot.create({
    data: {
      projectId: otherProjectId,
      lotNumber: `LOT2-${tag}`,
      lotType: 'earthworks',
      activityType: 'fill',
    },
  });
  otherProjectLotId = otherLot.id;

  const claim = await prisma.progressClaim.create({
    data: {
      projectId,
      claimNumber: 1,
      claimPeriodStart: new Date('2026-07-01'),
      claimPeriodEnd: new Date('2026-07-31'),
    },
  });
  claimId = claim.id;

  // Related evidence: the row the serializable-conflict tests fight over.
  const testResult = await prisma.testResult.create({
    data: { projectId, lotId, testType: 'compaction', status: 'entered', passFail: 'pending' },
  });
  testResultId = testResult.id;
});

afterEach(async () => {
  disableSnapshots();
  await prisma.requirementEvaluation.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.auditLog.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  // Claims minted by the create-style decisions below (the seeded `claimId` stays).
  await prisma.claimedLot.deleteMany({ where: { claim: { projectId } } });
  await prisma.progressClaim.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] }, id: { not: claimId } },
  });
  await prisma.lot.update({ where: { id: lotId }, data: { status: 'not_started' } });
  await prisma.testResult.update({
    where: { id: testResultId },
    data: { status: 'entered', passFail: 'pending' },
  });
});

afterAll(async () => {
  await prisma.requirementEvaluation.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.auditLog.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.testResult.deleteMany({ where: { projectId } });
  await prisma.progressClaim.deleteMany({
    where: { projectId: { in: [projectId, otherProjectId] } },
  });
  await prisma.lot.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.company.delete({ where: { id: companyId } });
});

describe('READINESS_SNAPSHOTS_ENABLED', () => {
  it('defaults to false when unset and only accepts explicit affirmatives', () => {
    disableSnapshots();
    expect(readinessSnapshotsEnabled()).toBe(false);

    process.env.READINESS_SNAPSHOTS_ENABLED = 'false';
    expect(readinessSnapshotsEnabled()).toBe(false);

    process.env.READINESS_SNAPSHOTS_ENABLED = 'TRUE';
    expect(readinessSnapshotsEnabled()).toBe(true);

    process.env.READINESS_SNAPSHOTS_ENABLED = '1';
    expect(readinessSnapshotsEnabled()).toBe(true);

    disableSnapshots();
  });
});

describe('recordDecision — feature flag (spec §9)', () => {
  it('skips snapshot inserts and stamps snapshotSkipped when disabled', async () => {
    disableSnapshots();

    const outcome = await recordDecision(lotDecision());

    expect(outcome.replayed).toBe(false);
    expect(outcome.snapshotIds).toEqual([]);
    expect(await snapshotRowsForProject()).toHaveLength(0);

    const audits = await auditRowsForLot();
    expect(audits).toHaveLength(1);
    const changes = JSON.parse(audits[0].changes ?? '{}');
    expect(changes).toMatchObject({ decisionKind: 'approval', snapshotSkipped: true });

    // The decision itself still happened — "behaves exactly as today".
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    expect(lot.status).toBe('conformed');
  });

  it('writes the snapshot and omits snapshotSkipped when enabled', async () => {
    enableSnapshots();

    const outcome = await recordDecision(lotDecision());

    expect(outcome.snapshotIds).toHaveLength(1);
    const rows = await snapshotRowsForProject();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityType: 'lot',
      entityId: lotId,
      decisionKind: 'approval',
      auditAction: 'lot_conformed',
      requirementSet: 'lot_conformance.v1',
      resultSchemaVersion: 1,
      actorKind: 'user',
      actorUserId: userId,
      auditLogId: outcome.auditLogId,
    });

    const audits = await auditRowsForLot();
    const changes = JSON.parse(audits[0].changes ?? '{}');
    expect(changes.decisionKind).toBe('approval');
    expect(changes.snapshotSkipped).toBeUndefined();
  });
});

describe('recordDecision — atomicity (spec §6, fault injection)', () => {
  it('rolls back the entity mutation AND the audit row when the snapshot insert fails', async () => {
    enableSnapshots();

    // Force the snapshot write to fail without touching production code: a
    // second snapshot row for the same (auditLogId, entityType, entityId) is
    // rejected by the DB unique index mid-insert.
    await expect(
      recordDecision(
        lotDecision({
          snapshots: (): DecisionSnapshotInput[] => [
            {
              entityType: 'lot',
              entityId: lotId,
              requirementSet: 'lot_conformance.v1',
              resultSchemaVersion: 1,
              result: { ready: true },
            },
            {
              entityType: 'lot',
              entityId: lotId,
              requirementSet: 'lot_conformance.v1',
              resultSchemaVersion: 1,
              result: { ready: true, duplicate: true },
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 500, code: 'SNAPSHOT_WRITE_FAILED' });

    await expectDecisionNotPersisted();
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    expect(lot.status).toBe('not_started');
  });

  it('rejects a member snapshot whose result exceeds the 1KB compact-verdict budget', async () => {
    enableSnapshots();

    await expect(
      recordDecision(
        lotDecision({
          snapshots: (): DecisionSnapshotInput[] => [
            {
              entityType: 'claim_lot',
              entityId: randomUUID(),
              requirementSet: 'claim_member.v1',
              resultSchemaVersion: 1,
              result: { evidenceDump: 'x'.repeat(MEMBER_RESULT_MAX_BYTES + 1) },
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 500, code: 'SNAPSHOT_WRITE_FAILED' });

    await expectDecisionNotPersisted();
  });

  it('propagates a caller mutate failure unchanged and leaves nothing behind', async () => {
    enableSnapshots();

    await expect(
      recordDecision(
        lotDecision({
          mutate: async () => {
            throw AppError.badRequest('Lot is already claimed');
          },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expectDecisionNotPersisted();
  });
});

describe('recordDecision — serializable isolation and bounded retry (spec §3 [R3-2])', () => {
  it('actually runs the decision transaction at SERIALIZABLE isolation', async () => {
    enableSnapshots();
    let observed = '';

    await recordDecision(
      lotDecision({
        evaluate: async (tx) => {
          const [{ transaction_isolation }] = await tx.$queryRaw<
            Array<{ transaction_isolation: string }>
          >`SHOW transaction_isolation`;
          observed = transaction_isolation;
          return { observed };
        },
      }),
    );

    expect(observed).toBe('serializable');
  });

  it('retries after a concurrent RELATED-evidence write and succeeds on a fresh evaluation', async () => {
    enableSnapshots();
    const attempts: Array<{ passFail: string }> = [];

    const outcome = await recordDecision(
      lotDecision({
        evaluate: async (tx) => {
          // Read the related evidence (the readiness input) inside our tx.
          const before = await tx.testResult.findUniqueOrThrow({ where: { id: testResultId } });
          attempts.push({ passFail: before.passFail });

          if (attempts.length === 1) {
            // A separate connection reads the same predicate and writes into
            // it, then commits. Our transaction goes on to write the same
            // predicate too -> rw-antidependency cycle -> SSI aborts us.
            await conflictingRelatedEvidenceWrite('fail');
          }
          return { passFail: before.passFail };
        },
        mutate: async (tx) => {
          await tx.testResult.update({
            where: { id: testResultId },
            data: { resultUnit: `attempt-${attempts.length}` },
          });
          return tx.lot.update({ where: { id: lotId }, data: { status: 'conformed' } });
        },
        snapshots: (evaluation): DecisionSnapshotInput[] => [
          {
            entityType: 'lot',
            entityId: lotId,
            requirementSet: 'lot_conformance.v1',
            resultSchemaVersion: 1,
            result: { observedPassFail: (evaluation as { passFail: string }).passFail },
          },
        ],
      }),
    );

    // Two attempts: the first aborted, the second re-read the evidence.
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(attempts[0].passFail).toBe('pending');
    expect(attempts[attempts.length - 1].passFail).toBe('fail');

    // The persisted snapshot reflects the FRESH evaluation, not the stale one.
    const rows = await snapshotRowsForProject();
    expect(rows).toHaveLength(1);
    expect(rows[0].result).toMatchObject({ observedPassFail: 'fail' });
    expect(rows[0].auditLogId).toBe(outcome.auditLogId);
    expect(await auditRowsForLot()).toHaveLength(1);
  });

  it('gives up with 409 DECISION_CONFLICT when the conflicter never stops', async () => {
    enableSnapshots();
    let attempts = 0;

    await expect(
      recordDecision(
        lotDecision({
          evaluate: async (tx) => {
            attempts += 1;
            const before = await tx.testResult.findUniqueOrThrow({ where: { id: testResultId } });
            await conflictingRelatedEvidenceWrite(attempts % 2 === 0 ? 'pending' : 'fail');
            return { passFail: before.passFail };
          },
          mutate: async (tx) => {
            await tx.testResult.update({
              where: { id: testResultId },
              data: { resultUnit: `attempt-${attempts}` },
            });
            return tx.lot.update({ where: { id: lotId }, data: { status: 'conformed' } });
          },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409, code: 'DECISION_CONFLICT' });

    expect(attempts).toBe(MAX_DECISION_ATTEMPTS);
    await expectDecisionNotPersisted();
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    expect(lot.status).toBe('not_started');
  });
});

/**
 * A committed serializable transaction that reads the same predicate our
 * decision reads and writes into it. Reading before it writes is what creates
 * the second rw-antidependency edge, so PostgreSQL SSI detects a cycle and
 * aborts whichever transaction commits last (ours).
 */
async function conflictingRelatedEvidenceWrite(passFail: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.testResult.findMany({ where: { lotId }, select: { id: true, passFail: true } });
      await tx.testResult.update({ where: { id: testResultId }, data: { passFail } });
    },
    { isolationLevel: 'Serializable' },
  );
}

describe('recordDecision — request-key replay (spec §6)', () => {
  it('returns the original decision and writes nothing on a repeated key', async () => {
    enableSnapshots();
    const requestKey = `key-${randomUUID()}`;

    const first = await recordDecision(lotDecision({ requestKey }));
    expect(first.replayed).toBe(false);
    expect(first.snapshotIds).toHaveLength(1);

    await prisma.lot.update({ where: { id: lotId }, data: { status: 'not_started' } });

    const second = await recordDecision(lotDecision({ requestKey }));

    expect(second.replayed).toBe(true);
    expect(second.auditLogId).toBe(first.auditLogId);
    expect(second.snapshotIds).toEqual(first.snapshotIds);
    expect(second.mutation).toBeUndefined();
    // The replayed ids point at the ORIGINAL rows (spec §6). The outcome carries
    // ids rather than hydrated rows, so the content check reads them back.
    const replayedRows = await prisma.requirementEvaluation.findMany({
      where: { id: { in: second.snapshotIds } },
    });
    expect(replayedRows[0].result).toMatchObject({ ready: true });

    // Zero new rows, and `mutate` never ran (the lot stayed reset).
    expect(await snapshotRowsForProject()).toHaveLength(1);
    expect(await auditRowsForLot()).toHaveLength(1);
    const lot = await prisma.lot.findUniqueOrThrow({ where: { id: lotId } });
    expect(lot.status).toBe('not_started');
  });

  it('treats a different key as a new decision', async () => {
    enableSnapshots();

    await recordDecision(lotDecision({ requestKey: `key-${randomUUID()}` }));
    const second = await recordDecision(lotDecision({ requestKey: `key-${randomUUID()}` }));

    expect(second.replayed).toBe(false);
    expect(await snapshotRowsForProject()).toHaveLength(2);
  });

  it('does not replay while the flag is disabled — replay is snapshot-backed', async () => {
    // Documented consequence of spec §9 step 2: with no snapshot rows there is
    // nothing to key a replay off, so decisions behave exactly as today.
    // Routes needing idempotency in the disabled window keep their own
    // (ProgressClaim.requestKey, etc.).
    disableSnapshots();
    const requestKey = `key-${randomUUID()}`;

    const first = await recordDecision(lotDecision({ requestKey }));
    const second = await recordDecision(lotDecision({ requestKey }));

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(false);
    expect(await auditRowsForLot()).toHaveLength(2);
  });
});

describe('recordDecision — cross-project guard (spec §6)', () => {
  it('rejects an entity from another project with 400 before the transaction opens', async () => {
    enableSnapshots();
    let evaluated = false;

    await expect(
      recordDecision(
        lotDecision({
          entityId: otherProjectLotId,
          evaluate: async () => {
            evaluated = true;
            return {};
          },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(evaluated).toBe(false);
    expect(await snapshotRowsForProject()).toHaveLength(0);
  });

  it('rejects an unknown entity id with 400', async () => {
    enableSnapshots();

    await expect(recordDecision(lotDecision({ entityId: randomUUID() }))).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('recordDecision — claim aggregate + members (spec §3 [R3-3])', () => {
  const MEMBER_COUNT = 1_200;

  it('writes the aggregate plus every member across more than two createMany chunks', async () => {
    enableSnapshots();
    const memberIds = Array.from({ length: MEMBER_COUNT }, () => randomUUID());
    expect(Math.ceil(MEMBER_COUNT / SNAPSHOT_CHUNK_SIZE)).toBeGreaterThan(2);

    const outcome = await recordDecision({
      projectId,
      entityType: 'claim',
      entityId: claimId,
      decisionKind: 'inclusion',
      auditAction: 'claim_created',
      actor: { kind: 'system', label: 'claim-worker' },
      evaluate: async () => ({ memberIds }),
      mutate: async (tx) =>
        tx.progressClaim.update({ where: { id: claimId }, data: { status: 'submitted' } }),
      snapshots: (evaluation): DecisionSnapshotInput[] => [
        {
          entityType: 'claim',
          entityId: claimId,
          requirementSet: 'claim_readiness.v1',
          resultSchemaVersion: 1,
          result: { memberCount: evaluation.memberIds.length, totalClaimedAmount: 12345 },
        },
        ...evaluation.memberIds.map((id) => ({
          entityType: 'claim_lot' as const,
          entityId: id,
          requirementSet: 'claim_member.v1',
          resultSchemaVersion: 1,
          result: { ready: true, blockingReasonCodes: [], claimedValue: 100 },
        })),
      ],
    });

    expect(outcome.snapshotIds).toHaveLength(MEMBER_COUNT + 1);

    const aggregate = await prisma.requirementEvaluation.findMany({
      where: { projectId, entityType: 'claim' },
    });
    expect(aggregate).toHaveLength(1);
    expect(aggregate[0]).toMatchObject({
      decisionKind: 'inclusion',
      actorKind: 'system',
      actorLabel: 'claim-worker',
      actorUserId: null,
    });
    expect(aggregate[0].result).toMatchObject({ memberCount: MEMBER_COUNT });

    const members = await prisma.requirementEvaluation.findMany({
      where: { projectId, entityType: 'claim_lot' },
      select: { entityId: true, result: true, auditLogId: true },
    });
    expect(members).toHaveLength(MEMBER_COUNT);
    expect(new Set(members.map((m) => m.entityId))).toEqual(new Set(memberIds));
    expect(new Set(members.map((m) => m.auditLogId))).toEqual(new Set([outcome.auditLogId]));

    // Every member row honours the compact-verdict budget.
    for (const member of members) {
      expect(Buffer.byteLength(JSON.stringify(member.result), 'utf8')).toBeLessThanOrEqual(
        MEMBER_RESULT_MAX_BYTES,
      );
    }

    await prisma.progressClaim.update({ where: { id: claimId }, data: { status: 'draft' } });
  }, 60_000);
});

describe('recordDecision — entityCreatedByMutate (spec §11 F0.4b PR 0 [R3.1-B1])', () => {
  /**
   * Claim create, as PR 5 will call it: the route mints the claim id, `mutate`
   * creates the claim AND its members inside the decision transaction, and the
   * snapshots are built by the PR 0 requirement-set builders.
   */
  function claimCreateDecision(options: {
    newClaimId: string;
    createInProjectId?: string;
    entityCreatedByMutate?: true;
    requestKey?: string;
    snapshotsOverride?: (member: ClaimMemberResultV1) => DecisionSnapshotInput[];
  }) {
    const claimedLotId = randomUUID();
    return {
      projectId,
      entityType: 'claim' as const,
      entityId: options.newClaimId,
      decisionKind: 'inclusion' as const,
      auditAction: 'claim_created',
      actor: { kind: 'user' as const, userId },
      ...(options.entityCreatedByMutate ? { entityCreatedByMutate: true as const } : {}),
      ...(options.requestKey ? { requestKey: options.requestKey } : {}),
      evaluate: async (tx: Prisma.TransactionClient) => {
        const lot = await tx.lot.findUniqueOrThrow({
          where: { id: lotId },
          select: { id: true, status: true },
        });
        return {
          claimedLotId,
          member: buildClaimMemberResultV1({
            memberType: 'lot',
            items:
              lot.status === 'conformed' ? [] : [{ code: 'not_conformed', blocksAction: true }],
            claimedValue: 5000,
          }),
        };
      },
      mutate: async (tx: Prisma.TransactionClient, evaluation: { claimedLotId: string }) => {
        const claim = await tx.progressClaim.create({
          data: {
            id: options.newClaimId,
            projectId: options.createInProjectId ?? projectId,
            claimNumber: Math.floor(Math.random() * 1_000_000) + 100,
            claimPeriodStart: new Date('2026-08-01'),
            claimPeriodEnd: new Date('2026-08-31'),
          },
        });
        await tx.claimedLot.create({
          data: { id: evaluation.claimedLotId, claimId: claim.id, lotId, amountClaimed: 5000 },
        });
        return claim;
      },
      snapshots: (evaluation: {
        claimedLotId: string;
        member: ClaimMemberResultV1;
      }): DecisionSnapshotInput[] =>
        options.snapshotsOverride?.(evaluation.member) ?? [
          {
            entityType: 'claim',
            entityId: options.newClaimId,
            requirementSet: CLAIM_READINESS_REQUIREMENT_SET,
            resultSchemaVersion: CLAIM_READINESS_RESULT_SCHEMA_VERSION,
            result: buildClaimReadinessResultV1([evaluation.member]),
          },
          {
            entityType: 'claim_lot',
            entityId: evaluation.claimedLotId,
            requirementSet: CLAIM_MEMBER_REQUIREMENT_SET,
            resultSchemaVersion: CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
            result: evaluation.member,
          },
        ],
    } as Parameters<typeof recordDecision>[0];
  }

  it('records a decision whose entity is minted by mutate, with aggregate + member snapshots', async () => {
    enableSnapshots();
    const newClaimId = randomUUID();

    const outcome = await recordDecision(
      claimCreateDecision({ newClaimId, entityCreatedByMutate: true }),
    );

    expect(outcome.replayed).toBe(false);
    expect(outcome.snapshotIds).toHaveLength(2);

    // The entity really was created by the decision.
    const claim = await prisma.progressClaim.findUniqueOrThrow({ where: { id: newClaimId } });
    expect(claim.projectId).toBe(projectId);

    const rows = await prisma.requirementEvaluation.findMany({
      where: { auditLogId: outcome.auditLogId },
      orderBy: { entityType: 'asc' },
    });
    expect(rows.map((row) => row.entityType)).toEqual(['claim', 'claim_lot']);
    expect(rows[0]).toMatchObject({
      entityId: newClaimId,
      requirementSet: CLAIM_READINESS_REQUIREMENT_SET,
      decisionKind: 'inclusion',
      actorKind: 'user',
    });
    expect(decodeClaimReadinessResult(rows[0]).memberCounts).toMatchObject({
      total: 1,
      lots: 1,
      blocked: 1,
    });
    expect(rows[1].requirementSet).toBe(CLAIM_MEMBER_REQUIREMENT_SET);
    expect(decodeClaimMemberResult(rows[1])).toMatchObject({
      memberType: 'lot',
      ready: false,
      blockingReasonCodes: ['not_conformed'],
      claimedValue: 5000,
    });

    // One audit row for the whole decision, carrying the decision kind.
    const audits = await prisma.auditLog.findMany({ where: { projectId, entityId: newClaimId } });
    expect(audits).toHaveLength(1);
    expect(JSON.parse(audits[0].changes ?? '{}')).toMatchObject({ decisionKind: 'inclusion' });
  });

  // REGRESSION PIN (direction 1): the option is opt-in. Without it, a decision
  // on an entity that does not exist yet still fails 400 before the transaction
  // opens, and neither `evaluate` nor `mutate` runs.
  it('without the option, a not-yet-existing entity still 400s pre-transaction', async () => {
    enableSnapshots();
    const newClaimId = randomUUID();
    let evaluated = false;

    await expect(
      recordDecision({
        ...claimCreateDecision({ newClaimId }),
        evaluate: async () => {
          evaluated = true;
          return {
            claimedLotId: randomUUID(),
            member: buildClaimMemberResultV1({ memberType: 'lot', claimedValue: 0 }),
          };
        },
      } as Parameters<typeof recordDecision>[0]),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(evaluated).toBe(false);
    expect(await prisma.progressClaim.findUnique({ where: { id: newClaimId } })).toBeNull();
    expect(await snapshotRowsForProject()).toHaveLength(0);
  });

  // REGRESSION PIN (direction 2): the project-scope check is DEFERRED, not
  // dropped. A decision that mints its entity in another project fails 400 from
  // inside the transaction and rolls the created rows back.
  it('with the option, an entity minted in another project 400s and rolls back', async () => {
    enableSnapshots();
    const newClaimId = randomUUID();

    await expect(
      recordDecision(
        claimCreateDecision({
          newClaimId,
          entityCreatedByMutate: true,
          createInProjectId: otherProjectId,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await prisma.progressClaim.findUnique({ where: { id: newClaimId } })).toBeNull();
    expect(await snapshotRowsForProject()).toHaveLength(0);
    expect(await prisma.auditLog.findMany({ where: { entityId: newClaimId } })).toHaveLength(0);
  });

  // REGRESSION PIN (both directions) for the requestKey-persistability assert:
  // skipped with the option (the route owns its own replay per [R3.1-B2]),
  // enforced without it.
  it('skips the requestKey-persistability assert only when the option is set', async () => {
    enableSnapshots();
    // Snapshots deliberately cover ONLY the member, never the decided claim.
    const memberOnly = (member: ClaimMemberResultV1): DecisionSnapshotInput[] => [
      {
        entityType: 'claim_lot',
        entityId: randomUUID(),
        requirementSet: CLAIM_MEMBER_REQUIREMENT_SET,
        resultSchemaVersion: CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
        result: member,
      },
    ];

    const allowed = await recordDecision(
      claimCreateDecision({
        newClaimId: randomUUID(),
        entityCreatedByMutate: true,
        requestKey: `key-${randomUUID()}`,
        snapshotsOverride: memberOnly,
      }),
    );
    expect(allowed.snapshotIds).toHaveLength(1);

    // Same shape on an EXISTING entity without the option: still a hard failure.
    await expect(
      recordDecision(
        lotDecision({
          requestKey: `key-${randomUUID()}`,
          snapshots: (): DecisionSnapshotInput[] => [
            {
              entityType: 'claim_lot',
              entityId: randomUUID(),
              requirementSet: CLAIM_MEMBER_REQUIREMENT_SET,
              resultSchemaVersion: CLAIM_MEMBER_RESULT_SCHEMA_VERSION,
              result: { ready: true },
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 500, code: 'SNAPSHOT_WRITE_FAILED' });
  });
});

describe('requirement_evaluations — DB-enforced integrity (spec §3)', () => {
  it('rejects a second snapshot for the same (auditLogId, entityType, entityId)', async () => {
    enableSnapshots();
    const outcome = await recordDecision(lotDecision());

    await expect(
      prisma.requirementEvaluation.create({
        data: {
          projectId,
          entityType: 'lot',
          entityId: lotId,
          decisionKind: 'approval',
          auditAction: 'lot_conformed',
          requirementSet: 'lot_conformance.v1',
          resultSchemaVersion: 1,
          result: {},
          actorKind: 'user',
          actorUserId: userId,
          auditLogId: outcome.auditLogId,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('blocks deletion of an audit row a snapshot references (Restrict)', async () => {
    enableSnapshots();
    const outcome = await recordDecision(lotDecision());

    await expect(
      prisma.auditLog.delete({ where: { id: outcome.auditLogId } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});

describe('resultSchemaVersion decoding (spec §12)', () => {
  // A reader that dispatches on the version column keeps decoding v1 rows after
  // the shape moves on — the whole point of the column.
  type V1 = { ready: boolean; blockingReasonCodes: string[] };
  type V2 = { verdict: 'ready' | 'blocked'; reasons: string[] };

  function decode(row: { resultSchemaVersion: number; result: unknown }): V2 {
    switch (row.resultSchemaVersion) {
      case 1: {
        const v1 = row.result as V1;
        return {
          verdict: v1.ready ? 'ready' : 'blocked',
          reasons: v1.blockingReasonCodes,
        };
      }
      case 2:
        return row.result as V2;
      default:
        throw new Error(`Unknown resultSchemaVersion ${row.resultSchemaVersion}`);
    }
  }

  it('decodes a persisted v1 row through a v2-aware reader', async () => {
    enableSnapshots();
    await recordDecision(
      lotDecision({
        snapshots: (): DecisionSnapshotInput[] => [
          {
            entityType: 'lot',
            entityId: lotId,
            requirementSet: 'lot_conformance.v1',
            resultSchemaVersion: 1,
            result: { ready: false, blockingReasonCodes: ['open_ncrs'] },
          },
        ],
      }),
    );

    const [row] = await snapshotRowsForProject();
    expect(row.resultSchemaVersion).toBe(1);
    expect(decode(row)).toEqual({ verdict: 'blocked', reasons: ['open_ncrs'] });

    // And a v2 row round-trips through the same reader.
    expect(decode({ resultSchemaVersion: 2, result: { verdict: 'ready', reasons: [] } })).toEqual({
      verdict: 'ready',
      reasons: [],
    });
    expect(() => decode({ resultSchemaVersion: 99, result: {} })).toThrow();
  });
});

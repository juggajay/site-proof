// F0.4a — one atomic decision write (execution spec §3, §5, §6, §9).
//
// A "decision" is the moment the system records a human/automated judgement
// about an entity's readiness: conform, force-conform, hold-point release, NCR
// closure, claim inclusion. Today each route writes its entity columns and its
// audit row separately. `recordDecision` makes those one transaction and adds a
// third member: an immutable `RequirementEvaluation` snapshot of what readiness
// looked like at the decision point.
//
// Three properties this exists to guarantee:
//   1. ATOMICITY — entity columns + audit row + snapshot(s) commit together or
//      not at all. There is no "decided but unaudited" and no "audited but
//      unsnapshotted" state (spec §3 `[R2-1]`).
//   2. CONCURRENCY — the transaction runs at Serializable isolation with bounded
//      retries, so RELATED evidence changing mid-decision (a TestResult flipping
//      to fail, an NCR opening) cannot commit a decision made on stale readiness.
//      An entity-row optimistic guard alone cannot see those (spec §3 `[R3-2]`).
//   3. NO SIDE EFFECTS — `recordDecision` NEVER dispatches notifications, emails
//      or webhooks. It returns; the ROUTE dispatches after the commit returns.
//      A rolled-back or retried attempt therefore can never have produced a
//      user-visible signal (spec §3, §6).
//
// This module is deliberately generic: `evaluate` / `mutate` / `snapshots` are
// caller-supplied so route adoption (F0.4b) does not need to teach this file
// about lots, hold points, NCRs or claims. F0.4a ships it with NO call sites.
//
// Flag: `READINESS_SNAPSHOTS_ENABLED` (default FALSE — spec §9 rollout step 2).
// Disabled, decisions behave exactly as today and the audit row carries
// `changes.snapshotSkipped: true` so the evidence gap is itself countable.
// Enabled, a snapshot failure blocks the decision (spec §9 step 4).

import { randomInt } from 'node:crypto';
import { AuditLog, Prisma } from '@prisma/client';
import { Request } from 'express';

import { AppError, ErrorCodes } from '../AppError.js';
import { writeAuditLogInTransaction } from '../auditLog.js';
import { prisma } from '../prisma.js';

/**
 * Decision semantics. Orthogonal to the audit ACTION vocabulary — existing
 * actions (`hp_released`, `lot_force_conformed`, …) are untouched and keep
 * their consumers; `decisionKind` is the new dimension (spec §2).
 */
export type DecisionKind =
  | 'approval'
  | 'release'
  | 'closure'
  | 'concession'
  | 'override'
  | 'waiver'
  | 'inclusion';

/**
 * Snapshot grains. `claim_lot` rows key on `ClaimedLot.id` (NOT the lot id);
 * `claim_variation` rows key on `Variation.id` — there is no claim-variation
 * join row (variations link via `Variation.claimedInId`) (spec §3 `[R3-3]`).
 */
export type DecisionEntityType =
  | 'lot'
  | 'hold_point'
  | 'ncr'
  | 'claim'
  | 'claim_lot'
  | 'claim_variation';

/**
 * Who decided.
 *
 * SECURITY (spec §5 `[R2-5]`): the actor is derived SERVER-SIDE by the calling
 * route — `user` from the authenticated session, `external_token` only from the
 * existing hold-point token-validation path, `system` only from in-process
 * automation. It is NEVER read from a request body. `tokenId` is the
 * `HoldPointReleaseToken` ROW id; tokens are sha256-hashed at rest and the raw
 * token never reaches a snapshot.
 */
export type DecisionActor =
  | { kind: 'user'; userId: string }
  | { kind: 'external_token'; tokenId: string; label?: string }
  | { kind: 'system'; label: string };

export interface DecisionSnapshotInput {
  entityType: DecisionEntityType;
  entityId: string;
  /** Named, versioned requirement set the evaluation ran (spec §2). */
  requirementSet: string;
  /** Bump when `result`'s shape changes; readers dispatch on this column. */
  resultSchemaVersion: number;
  result: Prisma.InputJsonValue;
}

export interface RecordDecisionInput<TEvaluation, TMutation> {
  projectId: string;
  /** The DECIDED entity — audit target, replay key, cross-project check. */
  entityType: DecisionEntityType;
  entityId: string;
  decisionKind: DecisionKind;
  /** An EXISTING `AuditAction` value — no new audit vocabulary (spec §2). */
  auditAction: string;
  /** `AuditLog.entityType` when it differs from the snapshot grain. */
  auditEntityType?: string;
  actor: DecisionActor;
  /** Opaque client idempotency key. Never interpreted (spec §7). */
  requestKey?: string;
  /**
   * The decided entity does not exist yet — `mutate` CREATES it inside the
   * transaction (claim create; spec §11 F0.4b PR 0 `[R3.1-B1]`). The caller
   * mints `entityId` itself and passes it to its `create`, so the audit row and
   * snapshots still key on the real id.
   *
   * Two pre-transaction checks are inapplicable and are skipped:
   *  - the {@link ENTITY_PROJECT_SCOPE} existence check — nothing to find yet.
   *    It is NOT dropped: the same project-scoped count re-runs on `tx` AFTER
   *    `mutate`, so a route that mints its entity in the wrong project still
   *    fails, and fails inside the transaction that rolls it back.
   *  - {@link assertRequestKeyIsPersistable} — these routes keep their own
   *    replay mechanism through F0.4b (claim create's `(projectId, requestKey)`
   *    unique + P2002 race path), and `recordDecision`'s snapshot-backed replay
   *    is inert while the flag is off anyway (spec §9 step 2 `[R3.1-B2]`).
   */
  entityCreatedByMutate?: true;
  /** Merged into `AuditLog.changes` alongside `decisionKind`. */
  auditChanges?: Record<string, unknown>;
  req?: Request;
  /** Reads readiness inputs. Re-run FRESH on every retry attempt. */
  evaluate: (tx: Prisma.TransactionClient) => Promise<TEvaluation>;
  /** Entity-column updates. Caller-owned so this lib stays domain-free. */
  mutate: (tx: Prisma.TransactionClient, evaluation: TEvaluation) => Promise<TMutation>;
  /** Rows to persist: a single entity, or a claim aggregate + its members. */
  snapshots: (evaluation: TEvaluation) => DecisionSnapshotInput[];
}

export interface DecisionOutcome<TMutation> {
  auditLogId: string;
  /**
   * Ids of the persisted `RequirementEvaluation` rows — the whole decision
   * (aggregate + members), and on replay the ORIGINAL rows' ids (spec §6).
   *
   * IDS, not rows: no caller reads snapshot row CONTENT off the outcome (the
   * routes read `mutation`), and returning 5,001 hydrated rows from a
   * 5,000-member claim decision cost measurable latency for nothing. Read the
   * rows back by id (or by `auditLogId`) if a consumer ever needs them.
   */
  snapshotIds: string[];
  /** True when a matching `requestKey` replayed an earlier decision. */
  replayed: boolean;
  /** `mutate`'s return. Undefined on replay — nothing was mutated. */
  mutation?: TMutation;
}

/**
 * Spec §3 `[R3-2]`: bounded attempts, fresh evaluation each attempt.
 *
 * Raised 3 → 5 together with {@link serializationBackoffMs}. Three IMMEDIATE
 * attempts is not a retry policy — see that function for why.
 */
export const MAX_DECISION_ATTEMPTS = 5;

/** Base of the full-jitter backoff. Small: a decision is an interactive request. */
export const DECISION_RETRY_BASE_DELAY_MS = 25;

/** Cap, so five attempts can never add more than ~0.8 s to a request. */
export const DECISION_RETRY_MAX_DELAY_MS = 400;

/**
 * Delay before re-running a serialization-failed decision, as FULL JITTER:
 * uniform in `[0, min(base * 2^(attempt-1), cap))`.
 *
 * Retrying a 40001 with ZERO delay is the defect this replaces. Two decisions
 * that conflict re-enter their transactions in lockstep, take the same predicate
 * locks in the same order at the same instant, and conflict again — so all three
 * attempts burn inside a few milliseconds and a perfectly serializable pair of
 * decisions ends as a spurious 409 `DECISION_CONFLICT`. Observed directly: a
 * `[FLAKE-PROBE]` on this catch printed two `claim` decisions failing attempts
 * 1, 2 and 3 in exact lockstep.
 *
 * The randomness is the whole point — equal fixed delays would keep them in
 * lockstep. Full jitter is the AWS "Exponential Backoff and Jitter" default and
 * the one that de-correlates competing retriers best.
 *
 * Why this is not just a test fix: PostgreSQL SSI conflicts are PHYSICAL, not
 * logical. Predicate locks escalate tuple → page → relation
 * (`max_pred_locks_per_page` defaults to 2), so two decisions touching disjoint
 * rows of a small table still conflict. Small tables are the CI test database;
 * they are also a young project's `progress_claims`, `hold_points` and
 * `requirement_evaluations`. The zero-delay retry loop under-served both.
 *
 * `crypto.randomInt`, not `Math.random`: the productionReadiness guardrail bans
 * Math.random in backend runtime code (frontend/e2e/productionReadiness.spec.ts
 * "backend runtime identifiers avoid Math.random"); stdlib randomInt gives the
 * same uniform [0, ceiling) draw. Nothing asserts on the delay.
 */
export function serializationBackoffMs(attempt: number): number {
  const ceiling = Math.min(
    DECISION_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    DECISION_RETRY_MAX_DELAY_MS,
  );
  return randomInt(ceiling);
}

/**
 * Spec §3 `[R3-3]`: member rows carry a COMPACT VERDICT, never an evidence
 * dump — the full detail stays request-time computable from the same
 * predicates. 5,000 members × 1 KB is the benchmarked ceiling.
 */
export const MEMBER_RESULT_MAX_BYTES = 1024;

/** Backstop for aggregate/single-entity rows (spec §6 snapshot size guard). */
export const RESULT_MAX_BYTES = 64 * 1024;

/**
 * Spec §3 `[R3-3]`: a single 5,001-row `createMany` risks the PostgreSQL bind
 * parameter limit (15 columns × 5,001 rows ≫ 65,535). Chunk it.
 */
export const SNAPSHOT_CHUNK_SIZE = 500;

/**
 * Prisma's interactive-transaction default is 5s, which the spec's benchmarked
 * ceiling (a 5,000-member claim decision, p95 < 2s target) sits uncomfortably
 * close to. 15s leaves headroom without letting a wedged decision hold a
 * serializable transaction open indefinitely.
 *
 * ponytail: one knob, not a config surface. If claim decisions ever legitimately
 * exceed this, the fix is chunking the DECISION, not raising the timeout again.
 */
export const DECISION_TRANSACTION_TIMEOUT_MS = 15_000;

const MEMBER_ENTITY_TYPES = new Set<DecisionEntityType>(['claim_lot', 'claim_variation']);

/**
 * Spec §9 step 2: default FALSE everywhere, including production. Enabling is
 * an explicit, logged rollout step — never an implicit environment default.
 */
export function readinessSnapshotsEnabled(): boolean {
  const configured = process.env.READINESS_SNAPSHOTS_ENABLED?.trim().toLowerCase();
  return configured === 'true' || configured === '1' || configured === 'yes';
}

/**
 * Prisma reports a serialization failure as P2034, but a 40001 raised inside a
 * raw query (the `FOR UPDATE` locks some decision paths use) can surface as an
 * unknown request error instead. Match both — treating a real conflict as a
 * hard failure would surface a 500 where a retry was correct.
 */
function isSerializationFailure(error: unknown): boolean {
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate?.code === 'P2034') return true;
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  return message.includes('40001') || message.includes('could not serialize access');
}

const sleep = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

function snapshotWriteFailed(error: unknown): AppError {
  return new AppError(
    500,
    'Failed to record the decision snapshot',
    ErrorCodes.SNAPSHOT_WRITE_FAILED,
    { cause: error instanceof Error ? error.message : String(error) },
    // Not operational: this is a defect or an infrastructure fault, so it
    // reaches Sentry rather than being logged as an expected 4xx-ish warning.
    false,
  );
}

/**
 * Spec §6: the decided entity must exist AND belong to `projectId`. One
 * project-scoped count per grain — asking "is it in this project?" instead of
 * "which project is it in?" collapses the two failure modes into one 400 and
 * avoids confirming that an id exists in someone else's project.
 *
 * Only the DECIDED entity is checked. Claim member rows inherit the aggregate's
 * project; per-member checks would be 5,000 extra queries for no extra safety.
 *
 * Takes its client so the SAME check serves both call sites: before the
 * transaction normally, and on `tx` after `mutate` when the entity is created
 * by the decision itself (`entityCreatedByMutate`).
 */
const ENTITY_PROJECT_SCOPE: Record<
  DecisionEntityType,
  (client: Prisma.TransactionClient, entityId: string, projectId: string) => Promise<number>
> = {
  lot: (db, id, projectId) => db.lot.count({ where: { id, projectId } }),
  hold_point: (db, id, projectId) => db.holdPoint.count({ where: { id, lot: { projectId } } }),
  ncr: (db, id, projectId) => db.nCR.count({ where: { id, projectId } }),
  claim: (db, id, projectId) => db.progressClaim.count({ where: { id, projectId } }),
  claim_lot: (db, id, projectId) => db.claimedLot.count({ where: { id, claim: { projectId } } }),
  claim_variation: (db, id, projectId) => db.variation.count({ where: { id, projectId } }),
};

async function assertEntityInProject(
  client: Prisma.TransactionClient,
  entityType: DecisionEntityType,
  entityId: string,
  projectId: string,
): Promise<void> {
  if ((await ENTITY_PROJECT_SCOPE[entityType](client, entityId, projectId)) === 0) {
    throw AppError.badRequest(
      `Cannot record a decision: ${entityType} ${entityId} is not in project ${projectId}`,
      { entityType, entityId, projectId },
    );
  }
}

/**
 * Runs regardless of the flag. An oversized snapshot is a caller defect, and
 * catching it during the flag-disabled window is the whole point of shipping
 * disabled first — deferring the check to flip day would surface the defect in
 * production instead of in the callers' tests.
 */
function assertSnapshotSizes(rows: DecisionSnapshotInput[]): void {
  for (const row of rows) {
    const limit = MEMBER_ENTITY_TYPES.has(row.entityType)
      ? MEMBER_RESULT_MAX_BYTES
      : RESULT_MAX_BYTES;
    const size = Buffer.byteLength(JSON.stringify(row.result ?? null), 'utf8');
    if (size > limit) {
      throw new AppError(
        500,
        `Readiness snapshot for ${row.entityType} ${row.entityId} is ${size} bytes, over the ${limit}-byte budget`,
        ErrorCodes.SNAPSHOT_WRITE_FAILED,
        { entityType: row.entityType, entityId: row.entityId, size, limit },
        false,
      );
    }
  }
}

/**
 * Without a snapshot row for the decided entity the requestKey is never
 * persisted, so a repeat would re-run the decision instead of replaying it.
 * Fail loudly rather than ship a silent idempotency hole — this is a caller
 * defect, not a runtime condition.
 */
function assertRequestKeyIsPersistable(
  rows: DecisionSnapshotInput[],
  entityType: DecisionEntityType,
  entityId: string,
  requestKey?: string,
): void {
  if (!requestKey) return;
  if (rows.some((row) => row.entityType === entityType && row.entityId === entityId)) return;
  throw snapshotWriteFailed(
    new Error(
      `requestKey supplied but no snapshot row covers the decided ${entityType} ${entityId}`,
    ),
  );
}

function actorColumns(actor: DecisionActor) {
  switch (actor.kind) {
    case 'user':
      return { actorKind: 'user', actorUserId: actor.userId, actorTokenId: null, actorLabel: null };
    case 'external_token':
      return {
        actorKind: 'external_token',
        actorUserId: null,
        actorTokenId: actor.tokenId,
        actorLabel: actor.label ?? null,
      };
    case 'system':
      return {
        actorKind: 'system',
        actorUserId: null,
        actorTokenId: null,
        actorLabel: actor.label,
      };
  }
}

async function findReplay<TMutation>(
  entityType: DecisionEntityType,
  entityId: string,
  requestKey: string,
): Promise<DecisionOutcome<TMutation> | null> {
  const existing = await prisma.requirementEvaluation.findFirst({
    where: { entityType, entityId, requestKey },
  });
  if (!existing) return null;

  // Return the WHOLE decision (aggregate + members), not just the matched row —
  // the caller's original response was built from all of them.
  const snapshots = await prisma.requirementEvaluation.findMany({
    where: { auditLogId: existing.auditLogId },
    orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }],
    select: { id: true },
  });

  return {
    auditLogId: existing.auditLogId,
    snapshotIds: snapshots.map((row) => row.id),
    replayed: true,
  };
}

/**
 * Returns the persisted row IDS, not the rows: `createManyAndReturn`'s default
 * RETURNING clause hands back all 15 columns of every row — including the
 * `result` JSON that was just sent — and at the 5,000-member ceiling that
 * payload was hydrated into 5,001 objects no caller ever read (measured 699ms
 * across 11 chunks, docs/plans/f0-5-benchmark-results-2026-07-26.md).
 * `select: { id: true }` keeps `snapshotIds`, which IS read, and drops the rest.
 *
 * ponytail: not plain `createMany` — that returns only a count, and `snapshotIds`
 * would then have to be minted client-side, moving id generation off the schema
 * default for no further win.
 */
async function insertSnapshots(
  tx: Prisma.TransactionClient,
  rows: Prisma.RequirementEvaluationCreateManyInput[],
): Promise<string[]> {
  const createdIds: string[] = [];
  for (let start = 0; start < rows.length; start += SNAPSHOT_CHUNK_SIZE) {
    const chunk = rows.slice(start, start + SNAPSHOT_CHUNK_SIZE);
    const created = await tx.requirementEvaluation.createManyAndReturn({
      data: chunk,
      select: { id: true },
    });
    for (const row of created) createdIds.push(row.id);
  }
  return createdIds;
}

/**
 * The audit row + its snapshots, written as one unit. Any non-conflict failure
 * here becomes `SNAPSHOT_WRITE_FAILED` and rolls the whole decision back —
 * never an anonymous 500 (spec §3 `[R3-small]`).
 */
async function writeDecisionRecords<TEvaluation, TMutation>(
  tx: Prisma.TransactionClient,
  input: RecordDecisionInput<TEvaluation, TMutation>,
  rows: DecisionSnapshotInput[],
  snapshotsEnabled: boolean,
): Promise<{ auditLog: AuditLog; createdIds: string[] }> {
  const { projectId, entityType, entityId, decisionKind, auditAction, actor, requestKey } = input;

  try {
    const auditLog = await writeAuditLogInTransaction(tx, {
      projectId,
      userId: actor.kind === 'user' ? actor.userId : undefined,
      entityType: input.auditEntityType ?? entityType,
      entityId,
      action: auditAction,
      changes: {
        ...input.auditChanges,
        decisionKind,
        ...(snapshotsEnabled ? {} : { snapshotSkipped: true }),
      },
      req: input.req,
    });

    if (!snapshotsEnabled) return { auditLog, createdIds: [] };

    const createdIds = await insertSnapshots(
      tx,
      rows.map((row) => ({
        projectId,
        entityType: row.entityType,
        entityId: row.entityId,
        decisionKind,
        auditAction,
        requirementSet: row.requirementSet,
        resultSchemaVersion: row.resultSchemaVersion,
        result: row.result,
        requestKey: requestKey ?? null,
        auditLogId: auditLog.id,
        ...actorColumns(actor),
      })),
    );
    return { auditLog, createdIds };
  } catch (error) {
    // A serialization failure belongs to the retry loop; everything else is a
    // genuine audit/snapshot write fault.
    if (isSerializationFailure(error)) throw error;
    throw snapshotWriteFailed(error);
  }
}

/**
 * Record a decision atomically.
 *
 * @throws AppError 400 when the decided entity is missing or belongs to another
 *   project (checked before the transaction opens — or, with
 *   `entityCreatedByMutate`, immediately after `mutate` inside it).
 * @throws AppError 409 `DECISION_CONFLICT` when {@link MAX_DECISION_ATTEMPTS}
 *   serialization retries are exhausted — the client refreshes readiness and
 *   re-decides.
 * @throws AppError 500 `SNAPSHOT_WRITE_FAILED` when the audit or snapshot write
 *   fails for a non-conflict reason. The whole transaction rolls back.
 *
 * Errors from `evaluate` and `mutate` propagate unchanged — a caller's own
 * validation (`AppError.badRequest`, an optimistic-guard 409) keeps its status.
 *
 * The caller MUST dispatch notifications only after this promise resolves.
 */
export async function recordDecision<TEvaluation, TMutation>(
  input: RecordDecisionInput<TEvaluation, TMutation>,
): Promise<DecisionOutcome<TMutation>> {
  const { projectId, entityType, entityId, requestKey, evaluate, mutate, snapshots } = input;

  const snapshotsEnabled = readinessSnapshotsEnabled();

  if (!input.entityCreatedByMutate) {
    await assertEntityInProject(prisma, entityType, entityId, projectId);
  }

  if (requestKey) {
    const replay = await findReplay<TMutation>(entityType, entityId, requestKey);
    if (replay) return replay;
  }

  for (let attempt = 1; attempt <= MAX_DECISION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const evaluation = await evaluate(tx);
          const mutation = await mutate(tx, evaluation);

          // The check the pre-transaction one could not perform: the entity now
          // exists, so verify the decision minted it in the project it claims.
          if (input.entityCreatedByMutate) {
            await assertEntityInProject(tx, entityType, entityId, projectId);
          }

          const rows = snapshots(evaluation);
          assertSnapshotSizes(rows);
          if (!input.entityCreatedByMutate) {
            assertRequestKeyIsPersistable(rows, entityType, entityId, requestKey);
          }

          const { auditLog, createdIds } = await writeDecisionRecords(
            tx,
            input,
            rows,
            snapshotsEnabled,
          );

          return {
            auditLogId: auditLog.id,
            snapshotIds: createdIds,
            replayed: false,
            mutation,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: DECISION_TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      if (attempt < MAX_DECISION_ATTEMPTS) {
        await sleep(serializationBackoffMs(attempt));
        continue;
      }
      throw new AppError(
        409,
        'This decision conflicted with a concurrent change. Refresh and try again.',
        ErrorCodes.DECISION_CONFLICT,
        { entityType, entityId, attempts: MAX_DECISION_ATTEMPTS },
      );
    }
  }

  // Unreachable: the loop either returns or throws.
  throw snapshotWriteFailed(new Error('decision retry loop exited without a result'));
}

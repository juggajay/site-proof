// Wave D `D1c.1` — legal hold: place, release, and the consultation contract
// (spec `docs/plans/wave-d-handover-spec-2026-07-28.md` Rev 3 §7.6, §10.4,
// §10.5, `[DR2-B5]`). **AT-148**.
//
// APPEND-ONLY, and that is not a stylistic preference. A mutable
// `onLegalHold` boolean on `FolioIssue` would be an `UPDATE` on a table whose
// trigger REJECTS `UPDATE` (§7.1) — the naive fix contradicts the invariant it
// is meant to support. So a hold and its release are both events, and the
// sequence is the record: an artefact is on hold when its MOST RECENT ROW is
// `placed`.
//
// `assertNotOnHold` is §10.4's and §10.5's contract as a function. Its
// consumers — the deletion procedure and the retention sweeper — arrive in
// `D1c.2`; the contract ships here so that when they do, "consult the hold"
// is one import rather than a re-derivation of "most recent row wins" in two
// places that could disagree.

import { AppError } from '../AppError.js';
import { prisma } from '../prisma.js';

/** §7.6's `artifactType` vocabulary. */
export const LEGAL_HOLD_ARTIFACT_TYPES = ['folio_issue', 'handover_export'] as const;
export type LegalHoldArtifactType = (typeof LEGAL_HOLD_ARTIFACT_TYPES)[number];

export const LEGAL_HOLD_ACTIONS = ['placed', 'released'] as const;
export type LegalHoldAction = (typeof LEGAL_HOLD_ACTIONS)[number];

type PrismaClientLike = typeof prisma;

export interface LegalHoldEvent {
  readonly id: string;
  readonly action: string;
  readonly reason: string;
  readonly actorId: string | null;
  readonly createdAt: Date;
}

export interface LegalHoldEventInput {
  projectId: string;
  artifactType: LegalHoldArtifactType;
  artifactId: string;
  reason: string;
  actorId: string | null;
  /** Injectable clock, like every other `now` in this folder. `createdAt` is
   * `TIMESTAMP(3)`, so two events appended in one millisecond are genuinely
   * indistinguishable to the "latest row wins" read — see the tiebreak in
   * {@link latestLegalHoldEvent}. */
  at?: Date;
  client?: PrismaClientLike;
}

async function appendHoldEvent(
  action: LegalHoldAction,
  params: LegalHoldEventInput,
): Promise<LegalHoldEvent> {
  if (params.reason.trim().length === 0) {
    // §7.6 makes `reason` NOT NULL, and an empty string satisfies the column
    // while defeating the only question the table exists to answer.
    throw AppError.badRequest('A legal hold requires a stated reason');
  }

  const row = await (params.client ?? prisma).artifactLegalHold.create({
    data: {
      projectId: params.projectId,
      artifactType: params.artifactType,
      artifactId: params.artifactId,
      action,
      reason: params.reason.trim(),
      actorId: params.actorId,
      ...(params.at ? { createdAt: params.at } : {}),
    },
    select: { id: true, action: true, reason: true, actorId: true, createdAt: true },
  });

  return row;
}

export function placeLegalHold(params: LegalHoldEventInput): Promise<LegalHoldEvent> {
  return appendHoldEvent('placed', params);
}

export function releaseLegalHold(params: LegalHoldEventInput): Promise<LegalHoldEvent> {
  return appendHoldEvent('released', params);
}

/**
 * The latest event for one artefact, or `null` when it has never been held.
 *
 * ORDER: `createdAt DESC`, then `placed` before `released` on an exact tie.
 * The tiebreak is deliberate and it fails SAFE — two events in the same
 * millisecond is a race whose true order the table cannot recover, and reading
 * "held" from an ambiguous pair refuses a deletion that may have been legal,
 * where the other choice permits a deletion that may have been unlawful. Ids
 * are uuids, so they carry no ordering to break the tie with.
 */
export async function latestLegalHoldEvent(
  artifactType: LegalHoldArtifactType,
  artifactId: string,
  client: PrismaClientLike = prisma,
): Promise<LegalHoldEvent | null> {
  const rows = await client.artifactLegalHold.findMany({
    where: { artifactType, artifactId },
    orderBy: [{ createdAt: 'desc' }, { action: 'asc' }],
    take: 1,
    select: { id: true, action: true, reason: true, actorId: true, createdAt: true },
  });

  return rows[0] ?? null;
}

/** §7.6: "on hold when its most recent row is `placed`". */
export async function isOnHold(
  artifactType: LegalHoldArtifactType,
  artifactId: string,
  client: PrismaClientLike = prisma,
): Promise<boolean> {
  const latest = await latestLegalHoldEvent(artifactType, artifactId, client);
  return latest?.action === 'placed';
}

/**
 * §10.4 and §10.5's consultation contract, in one place.
 *
 * "The sweeper and the deletion procedure both consult it and REFUSE while a
 * hold stands." A deletion path that forgets to call this is a bug that only
 * shows up in a courtroom, so it is a throwing assertion rather than a boolean
 * a caller can drop on the floor.
 */
export async function assertNotOnHold(
  artifactType: LegalHoldArtifactType,
  artifactId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const latest = await latestLegalHoldEvent(artifactType, artifactId, client);
  if (latest?.action !== 'placed') return;

  throw new AppError(
    409,
    'This artefact is under legal hold and cannot be deleted or expired until the hold is released.',
    'ARTIFACT_ON_LEGAL_HOLD',
    { placedAt: latest.createdAt.toISOString(), reason: latest.reason },
  );
}

/**
 * The sweeper's bulk form (§10.5). Same rule, one query instead of N — the
 * retention sweep looks at every expired artefact on a cadence, and N round
 * trips per sweep is the shape that gets quietly dropped later.
 *
 * Returns the subset of `artifactIds` that are currently held.
 */
export async function filterHeldArtifactIds(
  artifactType: LegalHoldArtifactType,
  artifactIds: readonly string[],
  client: PrismaClientLike = prisma,
): Promise<Set<string>> {
  if (artifactIds.length === 0) return new Set();

  const rows = await client.artifactLegalHold.findMany({
    where: { artifactType, artifactId: { in: [...artifactIds] } },
    orderBy: [{ createdAt: 'desc' }, { action: 'asc' }],
    select: { artifactId: true, action: true },
  });

  const held = new Set<string>();
  const seen = new Set<string>();
  for (const row of rows) {
    // Rows arrive newest-first, so the FIRST row seen per artefact is its
    // latest event — the same "most recent row wins" rule as the single read.
    if (seen.has(row.artifactId)) continue;
    seen.add(row.artifactId);
    if (row.action === 'placed') held.add(row.artifactId);
  }
  return held;
}

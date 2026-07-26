// F0.4b PR 0 — plumbing shared by the five requirement-set modules
// (execution spec §11 F0.4b PR 0 `[R3.1-B3]`).
//
// Every set needs the same two things: turn engine readiness items into a
// compact, stable list of reason codes, and decode a persisted snapshot by its
// `resultSchemaVersion`. Five copies of both would be five places to drift.

import { isReadinessReasonCode, type ReadinessReasonCode } from '../contracts/reasonCodes.js';

/**
 * The engine item shape the builders read. Structural on purpose — callers pass
 * `EvidenceReadinessItem`s (or `ReadinessBucket.blockers`) straight through,
 * with no adapter and no import cycle into the engine.
 */
export interface ReadinessItemLike {
  code: string;
  blocksAction?: boolean;
}

/**
 * The persisted columns a decoder reads. Matches `RequirementEvaluation` (and
 * `DecisionSnapshotInput`) without importing Prisma types into a pure module.
 */
export interface SnapshotResultRow {
  requirementSet?: string;
  resultSchemaVersion: number;
  result: unknown;
}

/**
 * Blocking codes from `items`, narrowed to the set's own vocabulary, deduped and
 * sorted.
 *
 * Sorted because snapshots are compared and diffed as evidence: engine item
 * ORDER is a presentation concern that must not change a stored payload's bytes.
 *
 * `allowed` is each set's slice of the closed F0.3 vocabulary
 * (`contracts/reasonCodes.ts`) — a code outside it is a code this decision does
 * not speak, and is dropped rather than silently widening the payload's type.
 */
export function blockingReasonCodes<TCode extends ReadinessReasonCode>(
  items: readonly ReadinessItemLike[],
  allowed: readonly TCode[],
): TCode[] {
  const permitted = new Set<string>(allowed);
  const found = new Set<TCode>();
  for (const item of items) {
    if (item.blocksAction === false) continue;
    if (!isReadinessReasonCode(item.code)) continue;
    if (permitted.has(item.code)) found.add(item.code as TCode);
  }
  return [...found].sort();
}

/**
 * Version dispatch. Today every set is at version 1, so this is a passthrough —
 * the point is that the DISPATCH exists at every call site now, so shipping a
 * v2 payload is an added `case`, never a hunt for readers that assumed v1
 * (spec §12, "snapshot JSON version decoding").
 */
export function decodeAtVersion1<T>(row: SnapshotResultRow, requirementSet: string): T {
  if (row.resultSchemaVersion === 1) return row.result as T;
  throw new Error(
    `Unsupported ${requirementSet} resultSchemaVersion ${row.resultSchemaVersion} — add a decoder case`,
  );
}

/**
 * Free-text provenance (an override or concession reason) is the one unbounded
 * field a decision can carry. The AuditLog row keeps the full text; the snapshot
 * keeps enough to read the verdict without risking the size budget.
 */
export const REASON_TEXT_MAX_CHARS = 500;

export function truncateReasonText(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= REASON_TEXT_MAX_CHARS
    ? trimmed
    : `${trimmed.slice(0, REASON_TEXT_MAX_CHARS - 1)}…`;
}

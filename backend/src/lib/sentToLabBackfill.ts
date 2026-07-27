// Wave C2 Phase 3 (spec §4.2) — recover `TestResult.sentToLabAt` from the
// status-change audit stream.
//
// THE PREDICATE IS `changes.newStatus` [C2R-B4]. `POST /:id/status` writes
// `changes: { previousStatus, newStatus }` (workflowRoutes.ts). There is no
// `changes.status` key on TEST_RESULT_STATUS_CHANGED — a backfill keyed on it
// would match zero rows and report success. (`changes: { status: 'verified' }`
// does exist, but on the separate TEST_RESULT_VERIFIED action.)
//
// HONESTY: this will match approximately nothing today. `at_lab` was unreachable
// from every user interface for the life of the product until Wave C2 Phase 2, so
// the only rows that ever entered it came from direct API calls or test fixtures.
// It ships because a wrong predicate that silently succeeds is worse than no
// backfill, and because after Phase 2 the audit stream is the recovery path for a
// lost column — not because there is history to recover.

export type StatusChangeAuditRow = {
  entityId: string;
  changes: string | null;
  createdAt: Date;
};

function isAtLabTransition(changes: string | null): boolean {
  if (!changes) return false;
  try {
    const parsed: unknown = JSON.parse(changes);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { newStatus?: unknown }).newStatus === 'at_lab'
    );
  } catch {
    return false;
  }
}

/**
 * Earliest `at_lab` transition per test result. Rows may arrive in any order.
 */
export function planSentToLabBackfill(rows: StatusChangeAuditRow[]): Map<string, Date> {
  const earliest = new Map<string, Date>();
  for (const row of rows) {
    if (!isAtLabTransition(row.changes)) continue;
    const current = earliest.get(row.entityId);
    if (!current || row.createdAt < current) {
      earliest.set(row.entityId, row.createdAt);
    }
  }
  return earliest;
}

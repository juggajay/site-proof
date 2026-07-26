/**
 * Wave B `[WBR2-3]` §3.1.1 — the ImportBatch state machine.
 *
 *   uploaded ──> parsed ──> mapped ──> dry_run ──> review ──> applied ──> rolled_back
 *                             ^           |           |
 *                             +-----------+           +--> cancelled
 *                           (re-map: the reviewer changes the field map and
 *                            re-runs the dry-run — the expected loop)
 *
 *   any non-terminal state ──> failed     (failedReason REQUIRED)
 *   any non-terminal state ──> cancelled  (reviewer abandons, or the GC sweep)
 *
 * `status` is a PROJECTION of the batch's proposal, never an independent source
 * of truth: `review → applied` happens only through `decideProposal`.
 */
import { AppError } from '../../../lib/AppError.js';

export const IMPORT_BATCH_STATUSES = [
  'uploaded',
  'parsed',
  'mapped',
  'dry_run',
  'review',
  'applied',
  'rolled_back',
  'cancelled',
  'failed',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

/** No transition leaves these — a new attempt is a NEW batch, which keeps the
 *  audit trail append-only. */
export const TERMINAL_IMPORT_BATCH_STATUSES: ReadonlySet<ImportBatchStatus> = new Set([
  'rolled_back',
  'cancelled',
  'failed',
]);

const LEGAL_TRANSITIONS: Record<ImportBatchStatus, ImportBatchStatus[]> = {
  uploaded: ['parsed', 'failed', 'cancelled'],
  parsed: ['mapped', 'failed', 'cancelled'],
  mapped: ['dry_run', 'failed', 'cancelled'],
  // Re-map is the reviewer's normal iteration loop: see the counts, fix the
  // mapping, look again.
  dry_run: ['mapped', 'review', 'failed', 'cancelled'],
  review: ['applied', 'failed', 'cancelled'],
  applied: ['rolled_back'],
  rolled_back: [],
  cancelled: [],
  failed: [],
};

export function isImportBatchStatus(value: string): value is ImportBatchStatus {
  return (IMPORT_BATCH_STATUSES as readonly string[]).includes(value);
}

export function isTerminalImportBatchStatus(status: string): boolean {
  return isImportBatchStatus(status) && TERMINAL_IMPORT_BATCH_STATUSES.has(status);
}

/**
 * Refuse an illegal transition, and refuse `failed` without a reason — a batch
 * may not sit in `failed` with a null reason, because the reconciliation view
 * renders that reason verbatim.
 */
export function assertBatchTransition(
  from: string,
  to: ImportBatchStatus,
  failedReason?: string | null,
): void {
  if (!isImportBatchStatus(from)) {
    throw AppError.badRequest(`Unknown import status "${from}".`, {
      code: 'IMPORT_BATCH_STATE_INVALID',
    });
  }
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    throw AppError.badRequest(`This import cannot go from ${from} to ${to}.`, {
      code: 'IMPORT_BATCH_TRANSITION_ILLEGAL',
    });
  }
  if (to === 'failed' && !failedReason?.trim()) {
    throw AppError.badRequest('A failed import must record why it failed.', {
      code: 'IMPORT_BATCH_FAILED_REASON_REQUIRED',
    });
  }
}

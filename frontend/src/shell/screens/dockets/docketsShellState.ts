/**
 * docketsShellState.ts — Pure state derivation for the Dockets approval shell.
 *
 * SINGLE SOURCE OF TRUTH for the shell surface's:
 *   - status-filter list + semantics (mirrors the existing approvals filter),
 *   - pending-first card ordering,
 *   - the mono hours-summary line for a docket card,
 *   - the state-bearing Approve button label ("Approve — 48 labour + 16 plant"),
 *   - reject/query reason-required validation,
 *   - the approve hours-adjustment payload decision.
 *
 * Every function here is pure — no React, no fetch — so the screens stay thin and
 * these decisions are exhaustively unit-tested.
 *
 * Parity note: the approve/reject/query PAYLOADS and ENDPOINTS are NOT redefined
 * here — they come verbatim from pages/dockets/docketActionData.ts
 * (buildDocketActionPayload / buildDocketActionPath / resolveDocketActionEndpoint),
 * which is the source of truth shared with the desktop + mobile modal flows.
 */

import type { Docket } from '@/pages/dockets/docketApprovalsData';

// ── Filter list + semantics ──────────────────────────────────────────────────

/** The status-filter options, pending-first to match the foreman's default job. */
export type DocketFilterKey = 'pending_approval' | 'approved' | 'rejected' | 'all';

export interface DocketFilter {
  key: DocketFilterKey;
  label: string;
}

export const DOCKET_FILTERS: DocketFilter[] = [
  { key: 'pending_approval', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/**
 * Filter submitted dockets by the active chip. Mirrors DocketApprovalsPage:
 * drafts are always excluded from the approvals surface (they belong to the
 * subbie portal), and `all` shows every submitted docket. Returns a new array.
 */
export function filterSubmittedDockets(dockets: Docket[], filter: DocketFilterKey): Docket[] {
  const submitted = dockets.filter((d) => d.status !== 'draft');
  if (filter === 'all') return submitted;
  return submitted.filter((d) => d.status === filter);
}

/** Count of dockets still awaiting approval — drives the header badge + chip. */
export function pendingDocketCount(dockets: Docket[]): number {
  return dockets.filter((d) => d.status === 'pending_approval').length;
}

// ── Card ordering ────────────────────────────────────────────────────────────

const STATUS_RANK: Record<Docket['status'], number> = {
  pending_approval: 0,
  queried: 1,
  rejected: 2,
  approved: 3,
  draft: 4,
};

/**
 * Order docket cards pending-first (then queried, rejected, approved), and within
 * a status the newest submission first, with a stable docket-number tiebreak.
 * Returns a new array; does not mutate the input.
 */
export function sortDocketsForShell(dockets: Docket[]): Docket[] {
  return [...dockets].sort((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 99;
    const rb = STATUS_RANK[b.status] ?? 99;
    if (ra !== rb) return ra - rb;

    // Newer submission first (null submittedAt sinks to the bottom of its group).
    const ta = a.submittedAt ? Date.parse(a.submittedAt) : 0;
    const tb = b.submittedAt ? Date.parse(b.submittedAt) : 0;
    if (ta !== tb) return tb - ta;

    return a.docketNumber.localeCompare(b.docketNumber, undefined, { numeric: true });
  });
}

// ── Status pill ──────────────────────────────────────────────────────────────

export type DocketPillTone = 'attention' | 'bad' | 'good' | 'neutral';

const DOCKET_STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  queried: 'Queried',
  draft: 'Draft',
};

export function docketStatusLabel(status: string): string {
  return DOCKET_STATUS_LABELS[status] ?? status;
}

export function docketStatusTone(status: string): DocketPillTone {
  switch (status) {
    case 'pending_approval':
    case 'queried':
      return 'attention';
    case 'rejected':
      return 'bad';
    case 'approved':
      return 'good';
    default:
      return 'neutral';
  }
}

// ── Hours formatting ─────────────────────────────────────────────────────────

/**
 * Render hours for the mock's mono figures: whole hours stay clean ("48"),
 * decimals are preserved ("7.5"), and non-finite values fall back to "0".
 * `String(48)` already yields "48" (no trailing ".0"), so no extra trimming is
 * needed beyond the finite guard.
 */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '0';
  return String(hours);
}

/**
 * The state-bearing primary Approve label, e.g. "Approve — 48 labour + 16 plant".
 * Uses the submitted hours (what the foreman is approving by default).
 */
export function approveButtonLabel(docket: Pick<Docket, 'labourHours' | 'plantHours'>): string {
  const labour = formatHours(docket.labourHours || 0);
  const plant = formatHours(docket.plantHours || 0);
  return `Approve — ${labour} labour + ${plant} plant`;
}

// ── Reason validation (reject / query) ───────────────────────────────────────

/**
 * Whether a reject/query reason is sufficient to submit. Mirrors the modal:
 * query requires non-empty `questions`; reject requires a non-empty reason
 * (the modal disables its submit button when the notes are blank for both).
 */
export function isReasonValid(reason: string): boolean {
  return reason.trim().length > 0;
}

/**
 * issuesShellState.ts — Pure state derivation for the Issues (NCRs & defects) shell.
 *
 * SINGLE SOURCE OF TRUTH for the shell surface's:
 *   - Open/Closed/All filter list + semantics (mapped onto the existing NCR
 *     status vocabulary: open · investigating · rectification · verification ·
 *     closed · closed_concession),
 *   - open-first card ordering (newest first within a group),
 *   - the severity + status pill labels and tones,
 *   - the "respond" permission decision (foreman may respond ONLY when he is the
 *     NCR's responsibleUserId — research doc 14).
 *
 * Every function here is pure — no React, no fetch — so the screens stay thin and
 * these decisions are exhaustively unit-tested. The respond/create/evidence
 * PAYLOADS and ENDPOINTS are NOT redefined here; those come verbatim from the
 * existing pages/ncr logic reused by the screens.
 */

import type { NCR } from '@/pages/ncr/types';

// ── Filter list + semantics ──────────────────────────────────────────────────

/** Foreman-facing filter chips. "Open" = anything not yet closed. */
export type IssueFilterKey = 'open' | 'closed' | 'all';

export interface IssueFilter {
  key: IssueFilterKey;
  label: string;
}

export const ISSUE_FILTERS: IssueFilter[] = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

/** Statuses that count as "closed" for the foreman's open/closed split. */
const CLOSED_STATUSES = new Set(['closed', 'closed_concession']);

/** Whether an NCR is in a closed (terminal) state. */
export function isClosedNcr(ncr: Pick<NCR, 'status'>): boolean {
  return CLOSED_STATUSES.has(ncr.status);
}

/**
 * Filter NCRs by the active chip. `open` shows every non-closed NCR (open,
 * investigating, rectification, verification); `closed` shows the terminal ones;
 * `all` shows everything. Returns a new array; does not mutate the input.
 */
export function filterIssues(ncrs: NCR[], filter: IssueFilterKey): NCR[] {
  if (filter === 'all') return [...ncrs];
  if (filter === 'closed') return ncrs.filter((n) => isClosedNcr(n));
  return ncrs.filter((n) => !isClosedNcr(n));
}

/** Count of still-open NCRs — drives the header sub-line and Open chip badge. */
export function openIssueCount(ncrs: NCR[]): number {
  return ncrs.filter((n) => !isClosedNcr(n)).length;
}

// ── Card ordering ────────────────────────────────────────────────────────────

const STATUS_RANK: Record<string, number> = {
  open: 0,
  investigating: 1,
  rectification: 2,
  verification: 3,
  closed: 4,
  closed_concession: 5,
};

/**
 * Order issue cards open-first (then through the workflow toward closed), and
 * within a status the newest raised first, with a stable NCR-number tiebreak.
 * Returns a new array; does not mutate the input.
 */
export function sortIssuesForShell(ncrs: NCR[]): NCR[] {
  return [...ncrs].sort((a, b) => {
    const ra = STATUS_RANK[a.status] ?? 99;
    const rb = STATUS_RANK[b.status] ?? 99;
    if (ra !== rb) return ra - rb;

    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (ta !== tb) return tb - ta;

    return a.ncrNumber.localeCompare(b.ncrNumber, undefined, { numeric: true });
  });
}

// ── Status + severity pills ──────────────────────────────────────────────────

export type IssuePillTone = 'attention' | 'bad' | 'good' | 'neutral';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  rectification: 'Rectification',
  verification: 'Verification',
  closed: 'Closed',
  closed_concession: 'Closed (concession)',
};

export function issueStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function issueStatusTone(status: string): IssuePillTone {
  switch (status) {
    case 'open':
      return 'bad';
    case 'investigating':
    case 'rectification':
    case 'verification':
      return 'attention';
    case 'closed':
    case 'closed_concession':
      return 'good';
    default:
      return 'neutral';
  }
}

export function issueSeverityLabel(severity: string): string {
  return severity === 'major' ? 'Major' : 'Minor';
}

/** Major defects read as a hard "bad" tone; minor stays neutral. */
export function issueSeverityTone(severity: string): IssuePillTone {
  return severity === 'major' ? 'bad' : 'neutral';
}

// ── Respond permission (research doc 14, BINDING) ────────────────────────────

/**
 * Whether THIS foreman may respond to THIS NCR. True only when he is the NCR's
 * responsibleUserId AND the NCR is still open enough to respond to (not closed).
 * The foreman NEVER closes and never runs QM actions — those affordances are
 * deliberately absent from the whole surface. We surface "Respond" only when he
 * is actually responsible, so we never show an affordance he can't use.
 */
export function canForemanRespond(
  ncr: Pick<NCR, 'responsibleUserId' | 'status'>,
  currentUserId: string | null | undefined,
): boolean {
  if (!currentUserId) return false;
  if (!ncr.responsibleUserId) return false;
  if (isClosedNcr(ncr)) return false;
  return ncr.responsibleUserId === currentUserId;
}

/**
 * Shared human-readable status labels for user-facing UI.
 *
 * Maps raw DB-ish status enums (lots, NCRs, dockets, readiness) to plain-English
 * labels so the same status reads identically across every surface — instead of
 * leaking `awaiting_test` / `ncr_raised` / `closed_concession` to the field with,
 * at best, a single underscore replaced.
 *
 * Use `formatStatusLabel(status)` anywhere a status string is shown to a user.
 * Unknown statuses fall back to a safe Title Case of the words, so an underscore
 * is never rendered to a user even if a new enum value appears.
 *
 * This is the A2 foundation from the mobile-UX plan; future PRs can reuse this
 * helper to remove the remaining inline `.replace('_', ' ')` usages.
 */

/**
 * Canonical raw-enum → human-label map.
 *
 * Lot labels mirror `LOT_STATUS_OVERVIEW_ITEMS` (`lib/lotStatusOverview.ts`) and
 * `lots/constants.ts`; NCR statuses mirror `ncrStatusColors` (`pages/ncr/constants.ts`);
 * docket statuses mirror the docket-approvals labels. Keys are normalized (lowercase,
 * spaces/hyphens collapsed to underscores) so lookups are surface-agnostic.
 */
export const STATUS_LABELS: Record<string, string> = {
  // Lot workflow statuses
  not_started: 'Not Started',
  in_progress: 'In Progress',
  awaiting_test: 'Awaiting Test',
  hold_point: 'Hold Point',
  ncr_raised: 'NCR Raised',
  on_hold: 'On Hold',
  pending: 'Pending',
  completed: 'Completed',
  conformed: 'Conformed',
  claimed: 'Claimed',

  // NCR workflow statuses
  open: 'Open',
  investigating: 'Investigating',
  rectification: 'Rectification',
  verification: 'Verification',
  closed: 'Closed',
  closed_concession: 'Closed (Concession)',

  // Docket approval statuses
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  queried: 'Queried',

  // Claim lifecycle statuses
  proposed: 'Proposed',
  submitted: 'Submitted',
  certified: 'Certified',
  disputed: 'Disputed',
  paid: 'Paid',
  partially_paid: 'Partially Paid',

  // Readiness reason codes (Needs Attention rows). These are `reasonCode` values
  // from the backend's closed vocabulary
  // (`lib/readiness/contracts/reasonCodes.ts`), not statuses — but they are the
  // same problem: a raw enum reaching a user. Only the codes the shipped
  // producers emit are listed; the Title Case fallback covers the rest safely,
  // except acronyms like NCR, which is why `ncr_overdue` must be explicit.
  ncr_overdue: 'NCR Overdue',
  hold_point_overdue: 'Hold Point Overdue',
  unreleased_hold_points: 'Hold Points Not Released',

  // Claim-member reason codes (Wave F F1's blocked-value groups). Listed for
  // the same reason as `ncr_overdue`: the Title Case fallback renders "Itp" and
  // "Ncrs". The rest of `CLAIM_MEMBER_REASON_CODES` falls back safely.
  itp_incomplete: 'ITP Checklist Incomplete',
  no_itp: 'No ITP Assigned',
  unreleased_itp_hold_points: 'ITP Hold Points Not Released',
  open_major_ncrs: 'Open Major NCRs',
  open_minor_ncrs: 'Open Minor NCRs',

  // Handover export job statuses (Wave D §7.4:
  // `queued|snapshotting|processing|complete|failed|cancelled`). Only
  // `snapshotting` differs from what the Title Case fallback would produce —
  // the rest are listed so a reader can see the whole vocabulary in one place,
  // and so a future rename cannot silently fall back to the raw enum.
  queued: 'Queued',
  snapshotting: 'Preparing',
  processing: 'Processing',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',

  // Delivery docket evidence (Wave C5-b). "Not filed in CIVOS" is deliberate:
  // "NO DOCKET" accuses the foreman of not having one, when the usual truth is
  // that the supplier's docket exists on paper and nobody has uploaded it yet.
  // The register's whole job is to get that file in, so the label names the
  // missing action, not a missing document.
  delivery_docket_filed: 'Docket filed',
  delivery_docket_not_filed: 'Not filed in CIVOS',
  delivery_no_lot: 'No lot linked',

  // Hold point / subcontractor admin statuses
  requested: 'Requested',
  released: 'Released',
  suspended: 'Suspended',
  removed: 'Removed',
  inactive: 'Inactive',
};

export interface FormatStatusLabelOptions {
  /** Returned when the status is empty / null / undefined. Defaults to '-'. */
  fallback?: string;
}

/** Normalize a raw status into a map lookup key (lowercase, `_`-delimited). */
function toLookupKey(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

/** Title-case arbitrary status text without leaking underscores/hyphens. */
function toTitleCase(status: string): string {
  return status
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert a raw status enum to a plain-English label for display.
 *
 * @param status  Raw status from the API (e.g. `closed_concession`, `awaiting_test`).
 * @param options `fallback` controls the empty/nullish result (defaults to `'-'`).
 */
export function formatStatusLabel(
  status: string | null | undefined,
  options: FormatStatusLabelOptions = {},
): string {
  const { fallback = '-' } = options;
  if (!status || !status.trim()) {
    return fallback;
  }

  const known = STATUS_LABELS[toLookupKey(status)];
  if (known) {
    return known;
  }

  return toTitleCase(status);
}

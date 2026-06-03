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

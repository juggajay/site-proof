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

  // Wave C5-a — the TRANSIENT states of a docket photo captured on a phone, on
  // the way to `delivery_docket_filed`. They exist because filing a docket is a
  // four-step chain (create the delivery, relink the queued photo to its server
  // id, upload the file, PATCH the evidence link) and any step can be the one
  // still outstanding. The two settled states above are reused verbatim rather
  // than re-spelled — a second "Filed"/"Not filed" pair would drift.
  //
  // The word "Attached" appears nowhere: it reads as done, and a photo sitting
  // in the offline queue is not done. Nothing may read `delivery_docket_filed`
  // until the server has answered the PATCH.
  delivery_docket_saved_on_device: 'Saved on device',
  delivery_docket_uploading: 'Uploading',
  delivery_docket_filing_failed: 'Filing failed',

  // Hold point / subcontractor admin statuses
  requested: 'Requested',
  released: 'Released',
  release_refused: 'Release refused',
  released_with_conditions: 'Released with conditions',
  hp_conditions_open: 'Release conditions not yet satisfied',
  suspended: 'Suspended',
  removed: 'Removed',
  inactive: 'Inactive',

  // ---------------------------------------------------------------------
  // Wave C5-c — survey records. Every key here is PREFIXED, and that is not
  // decoration.
  //
  // This map is flat and global: a bare `accepted` key would relabel Wave G5's
  // `NcrTemplateProposal.status` (`'open'|'accepted'|'rejected'`,
  // `backend/prisma/schema.prisma:2027`), which renders through this same
  // helper and means something entirely different. Prefixed keys are distinct by
  // construction, so a survey vocabulary cannot reach a surface that never
  // asked for it. Callers go through `surveyStatusLabel` /
  // `surveyVerdictLabel` in `pages/lots/lib/surveyRecords.ts` rather than
  // hand-assembling the prefix.
  // ---------------------------------------------------------------------

  // CIVOS's OWN workflow state — what the business did with the record. The
  // backend's closed vocabulary is `requested|received|returned_for_correction`
  // (`backend/src/routes/surveys/statusWorkflow.ts`). These are the only survey
  // strings entitled to a status colour.
  //
  // The `in_progress`, `accepted` and `rejected` keys were REMOVED in the
  // 2026-07-31 restructure rather than left as harmless spares: they were
  // reached only through `surveyStatusLabel()`, which builds `survey_${status}`
  // from a vocabulary that no longer contains them, and a label for a state the
  // backend cannot store is a label that will one day get rendered by mistake.
  //
  // "Report received" says what CIVOS did: it received a report. It does NOT say
  // the report was accepted — acceptance is the hold-point release and the lot
  // conformance, and the wording is load-bearing on that point.
  //
  // `superseded` is not a stored status — it is `supersededById !== null` — but
  // it is rendered as one, so it is spelled out here rather than title-cased by
  // accident.
  survey_requested: 'Requested',
  survey_received: 'Report received',
  survey_returned_for_correction: 'Returned for correction',
  survey_superseded: 'Superseded',

  // The SURVEYOR'S stated verdict (`surveyorVerdict`), NOT a CIVOS status —
  // the single most important distinction on the lot page. This is a
  // transcription of what a third-party professional wrote on their own report.
  // It is rendered as an attributed quotation, never as a coloured badge: a
  // green "Conforms" chip reads as CIVOS finding the lot conformant, which
  // CIVOS has neither the measurements nor the standing to do.
  //
  // The strings match `SURVEY_VERDICT_LABEL` in
  // `backend/src/routes/folio/assemble.ts` exactly, so the lot page and the
  // issued folio PDF quote the same surveyor in the same words.
  survey_verdict_conforms: 'Conforms',
  survey_verdict_does_not_conform: 'Does not conform',
  survey_verdict_qualified: 'Qualified',
  survey_verdict_not_stated: 'The report states no verdict',

  // ---------------------------------------------------------------------
  // Wave G G1 — revision governance. Prefixed for the same reason the survey
  // block is: a bare `acknowledged` or `current` key would be claimed by the
  // first other vocabulary that wants it.
  //
  // The first four are derived from the four distinct `RevisionAcknowledgement`
  // timestamps, which the model keeps separate because "we sent it", "they
  // opened it" and "they said yes" are three different contractual facts. All
  // four need explicit entries: the Title Case fallback renders the first as
  // "Revision Acknowledged" and cannot produce a comma at all.
  //
  // "Opened, Not Acknowledged" is spelled out and never abbreviated — the whole
  // point of the state is that it is NOT an acknowledgement, and a shortened
  // chip is exactly where that distinction would be lost.
  // ---------------------------------------------------------------------
  revision_acknowledged: 'Acknowledged',
  revision_opened_not_acknowledged: 'Opened, Not Acknowledged',
  revision_notified_not_opened: 'Notified, Not Opened',
  revision_recipient_recorded: 'Recorded as a Recipient',

  // The revision-state pill on a governed record (the drawing register card and
  // the doc sheet). `superseded` is not a stored status — it is
  // `supersededById !== null` — but it is rendered as one.
  revision_current: 'Current',
  revision_superseded: 'Superseded',
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

export interface HoldPointStatusSource {
  status: string;
  latestRound?: {
    outcome: string | null;
    ncrNumber: string | null;
    ncrStatus: string | null;
    openConditionCount: number;
  } | null;
}

export function getHoldPointStatusKey(holdPoint: HoldPointStatusSource): string {
  if (holdPoint.latestRound?.outcome === 'rejected' || holdPoint.status === 'rejected') {
    return 'release_refused';
  }
  if (
    holdPoint.latestRound?.outcome === 'released_with_conditions' &&
    holdPoint.latestRound.openConditionCount > 0
  ) {
    return 'released_with_conditions';
  }
  return holdPoint.status;
}

export function formatHoldPointStatusLabel(holdPoint: HoldPointStatusSource): string {
  const round = holdPoint.latestRound;
  if (round?.outcome === 'rejected' || holdPoint.status === 'rejected') {
    const ncr = round?.ncrNumber ? ` — ${round.ncrNumber}` : '';
    const status = round?.ncrStatus
      ? ` ${formatStatusLabel(round.ncrStatus).toLowerCase()}`
      : round?.ncrNumber
        ? ' open'
        : '';
    return `${STATUS_LABELS.release_refused}${ncr}${status}`;
  }
  if (round?.outcome === 'released_with_conditions' && round.openConditionCount > 0) {
    return `Released — ${round.openConditionCount} condition${round.openConditionCount === 1 ? '' : 's'} open`;
  }
  return formatStatusLabel(holdPoint.status);
}

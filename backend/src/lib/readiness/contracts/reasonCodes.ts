// F0.3 consumer contracts — the canonical `reasonCode` vocabulary.
//
// A `reasonCode` on any readiness consumer (ActionAssignment, test sufficiency,
// hold-point package, handover readiness) is a STABLE, machine-readable string
// sourced from the existing readiness engine's item `code` values — NOT invented
// per consumer (execution spec §2, ActionAssignment row `[R2-6]`/`[R3-small]`).
//
// The vocabulary below is exactly the set of `code:` literals the shipped engine
// emits — `backend/src/lib/evidenceReadiness.ts` (conformance / claim /
// management-prep item builders + already-* short circuits) and
// `backend/src/lib/evidenceReadiness/claimReview.ts`. It is deduplicated: codes
// that appear in both surfaces (`itp_incomplete`, `unreleased_hold_points`,
// `released_hold_points`, `pending_tests`) are single entries.
//
// Provenance ties every code to the predicate in the F0.1 library
// (`../predicates.ts`) that computes the underlying signal, so a future
// implementation cannot silently reason-code an item the predicates don't back.
// Codes with no dedicated predicate (bucket-state short circuits, count-only
// management-prep items) are tagged `engine` with the emitting builder.
//
// Foundation map §5 (A1–A5). Execution spec §2, §4.

/**
 * Every readiness item code the engine emits today. This is the closed
 * vocabulary — consumer `reasonCode` fields narrow to subsets of this, never
 * beyond it. If the engine gains a code, add it here (and its provenance) in the
 * same change; the contract test fails otherwise.
 */
export const READINESS_REASON_CODES = [
  // conformance items (evidenceReadiness.ts buildConformanceItems)
  'no_itp_assigned',
  'itp_incomplete',
  'no_passing_verified_test',
  'open_ncrs',
  'na_hold_point_not_released',
  'conformance_prerequisites_met',
  // claim items (evidenceReadiness.ts buildClaimItems) + already-* short circuits
  'lot_already_claimed',
  'lot_already_conformed',
  'already_claimed',
  'partially_claimed',
  'not_conformed',
  'conformance_no_longer_current',
  'conformance_overridden',
  'missing_budget',
  'unreleased_hold_points',
  'pending_tests',
  'released_hold_points',
  'approved_dockets',
  'diary_entries',
  'documents',
  'photos',
  // management-prep items (evidenceReadiness.ts buildManagementPrepItems)
  'missing_request_evidence',
  'missing_hold_point_recipients',
  'management_only_items',
  'release_gated_hold_points',
  'field_actionable_items',
  // claim-evidence review items (claimReview.ts)
  'itp_complete',
  'no_itp',
  'unreleased_itp_hold_points',
  'no_tests',
  'failed_tests',
  'passing_tests',
  'open_major_ncrs',
  'open_minor_ncrs',
  'ncrs_closed',
  'no_photos',
  'low_photo_evidence',
  'photo_evidence',
] as const;

export type ReadinessReasonCode = (typeof READINESS_REASON_CODES)[number];

/**
 * Provenance for every code: the predicate export in `../predicates.ts` that
 * computes the underlying signal, plus the emitting engine builder. `predicate:
 * 'engine'` means the code is a bucket-state short circuit or a count-only item
 * with no dedicated predicate — those are engine-owned, not predicate-owned.
 *
 * The contract test asserts (a) every code has an entry, (b) every non-`engine`
 * predicate name is a real export of the predicate library — so the mapping
 * cannot cite a predicate that does not exist.
 */
export const REASON_CODE_PROVENANCE: Record<
  ReadinessReasonCode,
  { predicate: string; source: string }
> = {
  no_itp_assigned: { predicate: 'lotConformable', source: 'buildConformanceItems (itpAssigned)' },
  itp_incomplete: {
    predicate: 'lotConformable',
    source: 'buildConformanceItems / claimReview (itpCompleted)',
  },
  no_passing_verified_test: {
    predicate: 'testPassing',
    source: 'buildConformanceItems (hasPassingTest)',
  },
  open_ncrs: { predicate: 'ncrOpen', source: 'buildConformanceItems (noOpenNcrs)' },
  na_hold_point_not_released: {
    predicate: 'holdPointReleased',
    source: 'buildConformanceItems (noNaHoldPointBypass)',
  },
  conformance_prerequisites_met: {
    predicate: 'lotConformable',
    source: 'buildConformanceItems (positive)',
  },
  lot_already_claimed: {
    predicate: 'lotClaimEligible',
    source: 'evidenceReadiness already-claimed short circuit',
  },
  lot_already_conformed: {
    predicate: 'lotConformable',
    source: 'evidenceReadiness already-conformed short circuit',
  },
  already_claimed: { predicate: 'lotClaimEligible', source: 'buildClaimItems' },
  partially_claimed: {
    predicate: 'lotClaimEligible',
    source: 'buildClaimItems (cumulative claimed %)',
  },
  not_conformed: { predicate: 'lotClaimEligible', source: 'buildClaimItems' },
  conformance_no_longer_current: {
    predicate: 'lotClaimEligible',
    source: 'buildClaimItems (post-conformance regression)',
  },
  conformance_overridden: {
    predicate: 'lotConformable',
    source: 'buildClaimItems (override provenance)',
  },
  missing_budget: { predicate: 'lotClaimEligible', source: 'buildClaimItems (commercial budget)' },
  unreleased_hold_points: {
    predicate: 'holdPointReleased',
    source: 'buildClaimItems / claimReview (advisory)',
  },
  pending_tests: {
    predicate: 'testPendingByStatus',
    source: 'buildClaimItems (readRoutes/qualityRoutes count)',
  },
  released_hold_points: {
    predicate: 'holdPointReleased',
    source: 'buildClaimItems / claimReview (positive)',
  },
  approved_dockets: {
    predicate: 'engine',
    source: 'buildManagementPrepItems (count, hardcoded 0 today — spec §13.4)',
  },
  diary_entries: {
    predicate: 'engine',
    source: 'buildManagementPrepItems (count, hardcoded 0 today — spec §13.4)',
  },
  documents: { predicate: 'engine', source: 'buildManagementPrepItems (count)' },
  photos: { predicate: 'engine', source: 'buildManagementPrepItems (count)' },
  missing_request_evidence: { predicate: 'engine', source: 'buildManagementPrepItems' },
  missing_hold_point_recipients: { predicate: 'engine', source: 'buildManagementPrepItems' },
  management_only_items: { predicate: 'engine', source: 'buildManagementPrepItems' },
  release_gated_hold_points: { predicate: 'holdPointReleased', source: 'buildManagementPrepItems' },
  field_actionable_items: { predicate: 'engine', source: 'buildManagementPrepItems' },
  itp_complete: { predicate: 'engine', source: 'claimReview (positive)' },
  no_itp: { predicate: 'engine', source: 'claimReview (no ITP instance)' },
  unreleased_itp_hold_points: {
    predicate: 'holdPointReleased',
    source: 'claimReview (completion-keyed)',
  },
  no_tests: { predicate: 'testPassing', source: 'claimReview (no passing tests)' },
  failed_tests: { predicate: 'testPassing', source: 'claimReview (failed)' },
  passing_tests: { predicate: 'testPassing', source: 'claimReview (positive)' },
  open_major_ncrs: {
    predicate: 'ncrSeriousIncludingCritical',
    source: 'claimReview (severity major/critical)',
  },
  open_minor_ncrs: { predicate: 'ncrOpen', source: 'claimReview (open, not serious)' },
  ncrs_closed: { predicate: 'ncrOpen', source: 'claimReview (positive)' },
  no_photos: { predicate: 'engine', source: 'claimReview (photo heuristic)' },
  low_photo_evidence: { predicate: 'engine', source: 'claimReview (photo heuristic)' },
  photo_evidence: { predicate: 'engine', source: 'claimReview (positive)' },
};

/** Type guard: is `value` a member of the closed reasonCode vocabulary? */
export function isReadinessReasonCode(value: string): value is ReadinessReasonCode {
  return (READINESS_REASON_CODES as readonly string[]).includes(value);
}

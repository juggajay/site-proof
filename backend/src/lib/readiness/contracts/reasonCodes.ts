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
  // test-sufficiency items (Wave C1 — lib/readiness/sufficiency/evaluate.ts).
  // Added WITH their provenance in the same change, as L26-27 requires.
  'insufficient_test_count',
  'test_sufficiency_unknown',
  'lot_exceeds_max_lot_size',
  'tests_unlinked_to_itp_item',
  'test_sufficiency_met',
  // ball-in-court overdue signals (Wave A4 — alert engine, not a readiness
  // builder: `lib/notificationAutomation/systemAutomation.ts`). Both are
  // date-passed states, so a consumer can set `isOverdue` from a code rather
  // than re-deriving the threshold. Added WITH provenance in the same change.
  'ncr_overdue',
  'hold_point_overdue',
  // revision governance (Wave G G1 — `evidenceReadiness.ts`
  // buildGoverningRevisionItems). Added WITH provenance in the same change, as
  // L26-27 requires. Advisory by construction: `severity: 'warning'` ∧
  // `blocksAction: false`, and deliberately NOT a member of
  // HANDOVER_BLOCKING_REASON_CODES — spec §1.7 E4, AT-G3/AT-G4.
  'governing_revision_superseded',
  // Wave C5.1 — delivery traceability (lib/evidenceReadiness/deliveryItems.ts).
  // Support severity, `blocksAction: false`, and deliberately NOT a member of
  // `HANDOVER_BLOCKING_REASON_CODES` (`[C5S-B5]`).
  'delivery_not_lot_linked',
  // Wave C5.2 — survey lifecycle (lib/evidenceReadiness/surveyItems.ts).
  // `warning`, `blocksAction: false`, and NOT a handover blocker (`[C5S-B5]`).
  'survey_not_accepted',
] as const;

export type ReadinessReasonCode = (typeof READINESS_REASON_CODES)[number];

/**
 * Wave D `D1a-respec` (spec §4.1.1, `[DR2-B2]`). The quality-closeout blocking
 * vocabulary, as RUNTIME DATA — a declared SUBSET of `READINESS_REASON_CODES`,
 * not a second vocabulary. It lives here, beside the registry, under the same
 * header rule: a code is added here in the same change that makes an emitter
 * produce it, and the contract test fails otherwise.
 *
 * `HandoverReasonCode` (`./futureConsumers.ts`) derives from this array. Before
 * `D1a-respec` it was a hand-listed `Extract<>` — a hand-list wearing a
 * derivation's clothes, which is why `insufficient_test_count` could ship as a
 * live blocking item and stay absent from the union for two waves.
 *
 * Scope, stated because the name does not carry it: this is the QUALITY
 * closeout scope (conformance, ITP, tests, hold points, NCRs). The commercial
 * blockers `buildClaimItems` emits with the same `severity`/`blocksAction`
 * shape — `already_claimed`, `missing_budget`, `conformance_no_longer_current` —
 * are deliberately OUT (spec §4.2, `[DR-A1]`: D1a is renamed "quality closeout
 * readiness" precisely so it stops implying the commercial dimension).
 * `not_conformed` is in because a lot that is not conformed is not handed over,
 * whichever surface says so.
 *
 * The two members no shipped emitter produces with `blocksAction: true` are
 * marked below with the emitter that DOES produce them and its blocksAction
 * value, so the divergence is recorded rather than discovered (spec §4.1.2).
 */
export const HANDOVER_BLOCKING_REASON_CODES = [
  // buildConformanceBlockerItems — all six, `severity: 'blocker'` ∧
  // `blocksAction: true`. This function IS the `lotConformable` gate, so this
  // half of the set is emitter-enumerated by AT-138(b), not hand-maintained.
  'no_itp_assigned',
  'itp_incomplete',
  'no_passing_verified_test',
  'open_ncrs',
  'na_hold_point_not_released',
  // Wave C1's blocking sufficiency item — live at
  // `evidenceReadiness/conformanceItems.ts` and absent from the pre-D1a-respec
  // union. `[DR-B2]`'s named defect.
  'insufficient_test_count',
  // buildClaimItems — `severity: 'blocker'` ∧ `blocksAction: true`.
  'not_conformed',
  // Emitted `severity: 'blocker'` ∧ `blocksAction: FALSE` by the surfaces that
  // ship today: `open_major_ncrs` by claimReview (an advisory review surface,
  // which never hard-blocks), `unreleased_hold_points` by buildClaimItems
  // (advisory on the claim card). D1a treats both as closeout blockers because
  // an open major NCR or an unreleased hold point is not handed over — so
  // AT-138(b) asserts membership-of-emitted, never emitted-equals-set.
  'open_major_ncrs',
  'unreleased_hold_points',
] as const satisfies readonly ReadinessReasonCode[];

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
    // F0.2b unified NCR seriousness onto `ncrSerious` (severity === 'major').
    // The emitter at `evidenceReadiness/claimReview.ts:224` filters open NCRs
    // with `ncrSerious`; this entry named the superseded
    // `ncrSeriousIncludingCritical` (severity in {major, critical}) until now.
    // No real-data difference — 'critical' is not a schema severity — but the
    // provenance registry's whole job is to be authoritative about which
    // predicate backs a code, so a stale name here is the defect.
    predicate: 'ncrSerious',
    source: 'claimReview (open ∧ severity major)',
  },
  open_minor_ncrs: { predicate: 'ncrOpen', source: 'claimReview (open, not serious)' },
  ncrs_closed: { predicate: 'ncrOpen', source: 'claimReview (positive)' },
  no_photos: { predicate: 'engine', source: 'claimReview (photo heuristic)' },
  low_photo_evidence: { predicate: 'engine', source: 'claimReview (photo heuristic)' },
  photo_evidence: { predicate: 'engine', source: 'claimReview (positive)' },
  insufficient_test_count: {
    predicate: 'testCountSufficient',
    source: 'sufficiency/evaluate (rule state insufficient; blocks only per §5.1.2)',
  },
  test_sufficiency_met: {
    predicate: 'testCountSufficient',
    source: 'sufficiency/evaluate (positive)',
  },
  tests_unlinked_to_itp_item: {
    predicate: 'testMatchesItem',
    source: 'sufficiency/evaluate (passing tests no rule could attribute)',
  },
  test_sufficiency_unknown: {
    predicate: 'engine',
    source: 'sufficiency/evaluate (UnknownCause — a MISSING INPUT, not a predicate signal)',
  },
  lot_exceeds_max_lot_size: {
    predicate: 'engine',
    source: 'sufficiency/evaluate (lot-size advisory, §3.3 — arithmetic, no predicate)',
  },
  ncr_overdue: {
    predicate: 'ncrOverdue',
    source:
      'systemAutomation overdue-NCR pass (systemAutomation.ts:194-197 — open ∧ dueDate < now)',
  },
  hold_point_overdue: {
    // NAMING TRAP, twice over.
    //
    // 1. The alert this comes from is typed `stale_hold_point`, but its query
    //    is the OVERDUE definition — scheduled-date based, not the dashboards'
    //    createdAt aging (`holdPointStagnant`, 7d). A4 decision D2 takes the
    //    scheduled-date semantics, and that has not changed.
    // 2. Until Wave E1 this record named `holdPointOverdue` — and the alert
    //    engine never imported it. It carried an inline literal of the same two
    //    statuses (['requested','scheduled']), neither of which any production
    //    path writes together with a scheduledDate, so the alert could not
    //    fire. E1 repointed the literal onto `holdPointAwaitingRelease` /
    //    `AWAITING_RELEASE_HOLD_POINT_STATUSES` (= ['notified'], what the
    //    request-release paths actually write) and this record with it.
    //    `holdPointOverdue` still exists and still has two LIVE consumers —
    //    `statsRoute.ts:89` and `actionAssignments.ts:135` — which are
    //    dashboards, not the alert engine. Wave E spec §0.3, §4.1.4.
    predicate: 'holdPointAwaitingRelease',
    source:
      'systemAutomation stale_hold_point pass (systemAutomation.ts — status in AWAITING_RELEASE_HOLD_POINT_STATUSES ∧ scheduledDate past, within the 30-day horizon)',
  },
  governing_revision_superseded: {
    // No predicate: the signal is a join, not a computation. An ACTIVE
    // `LotGoverningRevision` whose target row carries a non-null
    // `superseded_by_id` — `lib/revisionGovernance.ts`
    // `loadSupersededGoverningRevisions`. Nothing in `predicates.ts` reads
    // either table, and inventing a predicate wrapper around one `findMany`
    // would make the registry cite a function that adds nothing.
    predicate: 'engine',
    source: 'buildGoverningRevisionItems (Wave G G1, spec §1.3(d))',
  },
  delivery_not_lot_linked: {
    // Engine-owned count-only item: a plain `lotId IS NULL` count over the
    // project's deliveries, with no dedicated predicate behind it.
    predicate: 'engine',
    source: 'buildUnlinkedDeliveryItem (delivery register, C5.1)',
  },
  survey_not_accepted: {
    // Engine-owned count-only item: a count of survey records on the lot whose
    // status is not `accepted`. No predicate; C5 computes no verdict.
    predicate: 'engine',
    source: 'buildSurveyNotAcceptedItem (lot survey list, C5.2)',
  },
};

/** Type guard: is `value` a member of the closed reasonCode vocabulary? */
export function isReadinessReasonCode(value: string): value is ReadinessReasonCode {
  return (READINESS_REASON_CODES as readonly string[]).includes(value);
}

/**
 * The same narrowing for the closeout subset (Wave D `D1a`), so a consumer
 * filtering emitted codes down to the handover vocabulary narrows through one
 * checked guard rather than asserting the type at each call site.
 *
 * The return type is spelled out rather than imported as `HandoverReasonCode`:
 * that alias lives in `./futureConsumers.ts`, which imports THIS file, and it is
 * defined as exactly this expression.
 */
export function isHandoverReasonCode(
  value: string,
): value is (typeof HANDOVER_BLOCKING_REASON_CODES)[number] {
  return (HANDOVER_BLOCKING_REASON_CODES as readonly string[]).includes(value);
}

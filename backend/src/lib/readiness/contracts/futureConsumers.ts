// F0.3 consumer contracts — test sufficiency, hold-point packages, handover
// readiness (the three future consumers other than My Work).
//
// The six consumers (execution spec §1): lot readiness + claim readiness are
// LIVE and characterization-pinned (F0.2a). The four FUTURE consumers are
// My Work (./actionAssignment.ts), plus the three below.
//
// The spec NAMES these three (§1) and fixes the reasonCode vocabulary (§2, §4),
// but does not fully specify their payloads. So each contract below is the
// MINIMUM the spec states: a scoped verdict over a subset of the reasonCode
// vocabulary. Extensions genuinely undecided are marked with a spec-§13 comment
// rather than invented here.

// `HANDOVER_BLOCKING_REASON_CODES` is a runtime `as const` array, imported
// type-only (spec §4.1.1): `typeof X[number]` erases at build, so this stays a
// type-only edge like the rest.
import type { HANDOVER_BLOCKING_REASON_CODES, ReadinessReasonCode } from './reasonCodes.js';
// Type-only (erased at build): no runtime edge from the contracts to the engine.
import type { RuleSufficiency, SufficiencyState } from '../sufficiency/types.js';
import type { SufficiencyEvaluation } from '../sufficiency/evaluate.js';
import type { ConformancePrerequisiteSnapshot } from '../../evidenceReadiness/core.js';

// ---------------------------------------------------------------------------
// Test sufficiency (foundation map §3b, §5 A3). Predicates: testPassing,
// testPendingByStatus, testPendingNotFailNotVerified, testMatchesItem.
// ---------------------------------------------------------------------------

/**
 * The reasonCodes the test-sufficiency consumer may emit — subset of the
 * vocabulary. WIDENED by Wave C1 with the five quantitative codes [C1R-2]: this
 * is an `Extract<>`, so before the widening it could not carry
 * `insufficient_test_count` at all (the union would resolve to `never`).
 */
export type TestReasonCode = Extract<
  ReadinessReasonCode,
  | 'no_passing_verified_test'
  | 'no_tests'
  | 'failed_tests'
  | 'pending_tests'
  | 'passing_tests'
  // Wave C1 (spec §4.2.1)
  | 'insufficient_test_count'
  | 'test_sufficiency_unknown'
  | 'lot_exceeds_max_lot_size'
  | 'tests_unlinked_to_itp_item'
  | 'test_sufficiency_met'
>;

export interface TestSufficiencyVerdict {
  /** 'lot' (lot-wide) or 'itp_item' (a single checklist item's test requirement). */
  subjectType: 'lot' | 'itp_item';
  subjectId: string;
  /**
   * All required tests passing+verified (testPassing) — the sufficiency gate.
   * Wave C1 quantifies it: true iff EVERY resolved rule is 'satisfied'. An
   * `unknown` verdict is `false` — unknown never reads as satisfied (§4.2.1).
   */
  sufficient: boolean;
  reasonCodes: TestReasonCode[];
  /**
   * Wave C1 additions (spec §4.2.1). OPTIONAL, not required, so the shipped
   * four-key fixture in `contracts.test.ts` keeps compiling; the real evaluator
   * ALWAYS populates both, asserted by §14 AT-2.
   */
  state?: SufficiencyState;
  rules?: RuleSufficiency[];
  // spec §13-open: outstanding-test detail (the engine item's `outstandingTests[]`
  // shape) is not pinned here — the A? consumer that renders per-test rows extends
  // this when built. Minimum contract = sufficient + reasonCodes.
}

// ---------------------------------------------------------------------------
// Hold-point packages (foundation map §3a, §5 A2). Predicates: holdPointReleased,
// holdPointTerminal, holdPointOverdue, holdPointStagnant, holdPointAwaitingRelease
// (Wave E1 — the alert engine's, keyed on `notified`). A "package" today is the
// partial HoldPointReleaseBatch "review room" concept (spec §3a).
// ---------------------------------------------------------------------------

export type HoldPointReasonCode = Extract<
  ReadinessReasonCode,
  | 'unreleased_hold_points'
  | 'na_hold_point_not_released'
  | 'unreleased_itp_hold_points'
  | 'released_hold_points'
  | 'release_gated_hold_points'
  | 'missing_hold_point_recipients'
>;

export interface HoldPointPackageVerdict {
  /** A single hold point, or a release batch ("review room") grouping several. */
  subjectType: 'hold_point' | 'release_batch';
  subjectId: string;
  /** Every hold point in scope is released (holdPointReleased). */
  released: boolean;
  reasonCodes: HoldPointReasonCode[];
  // spec §13-open: full evidence-package composition (evidencePackageUrl,
  // recipient completeness, signature capture) is a D1 concern — not pinned here.
}

// ---------------------------------------------------------------------------
// Handover readiness (execution spec §1). Composite: conformance + hold points +
// NCRs + tests all clear across a lot (or a whole project's lots).
// ---------------------------------------------------------------------------

/**
 * Wave D `D1a-respec` (spec §4.1.1, `[DR2-B2]`): DERIVED from the runtime
 * subset registry, not hand-listed. Was an `Extract<>` over eight literals,
 * which nothing could enumerate and which silently omitted
 * `insufficient_test_count`.
 */
export type HandoverReasonCode = (typeof HANDOVER_BLOCKING_REASON_CODES)[number];

export interface HandoverReadinessVerdict {
  subjectType: 'lot' | 'project';
  subjectId: string;
  /** No outstanding blocking codes across the handover scope. */
  ready: boolean;
  reasonCodes: HandoverReasonCode[];
  // spec §13-open (§13.4): docket/diary inputs (approved_dockets, diary_entries)
  // are hardcoded 0 in the engine today — whether handover requires them is a
  // "wire or drop" product decision, not settled here.
}

/**
 * Wave D `D1a-respec` §4.1.2 — the complete batched input snapshot D1a reads,
 * per lot, in ONE pass. Defined before anything reads it, because `[DR-B2]`'s
 * finding was that D1a is NOT a mapper over `checkConformancePrerequisitesBatch`:
 * that batch fetches neither NCR severity nor the normal hold-point count.
 *
 * Types only — D1a builds the query. Every field names the shipped definition it
 * must reproduce, so a later implementation cannot pick a different one quietly.
 */
export interface LotCloseoutReadinessSnapshot {
  lotId: string;
  lotNumber: string;
  /** `Lot.status` — feeds `not_conformed`. */
  status: string;
  /** §4.1.3: null on either end means the lot is UNPLACED, never area-matched. */
  chainageStart: number | null;
  chainageEnd: number | null;
  /** §4.1.4: null means fold confidence `family`/`none` — the lot is UNCLASSIFIED. */
  activitySlug: string | null;
  /**
   * `checkConformancePrerequisites` (the lot page's own call,
   * `routes/lots/qualityRoutes.ts`). Feeds `no_itp_assigned`, `itp_incomplete`,
   * `no_passing_verified_test`, `open_ncrs`, `na_hold_point_not_released` and
   * `insufficient_test_count` via `buildConformanceBlockerItems`.
   */
  prerequisites: ConformancePrerequisiteSnapshot;
  /**
   * Open NCRs at MAJOR severity — feeds `open_major_ncrs`.
   *
   * DIVERGENCE, recorded per §4.1.2 rather than silently resolved. The spec
   * cites "the `claimReview.ts:230` definition"; that emitter now filters with
   * `ncrSerious` (`severity === 'major'`) after the F0.2b unification, while
   * `REASON_CODE_PROVENANCE.open_major_ncrs` still records the superseded
   * `ncrSeriousIncludingCritical`. `critical` is not a schema severity, so the
   * two agree on all real data. D1a takes `ncrSerious` — the shipped emitter's
   * predicate, which is what a user comparing screens actually sees.
   */
  openMajorNcrCount: number;
  /**
   * The NORMAL unreleased hold-point count — `holdPoint.count({ lotId, status:
   * { not: 'released' } })`, the lot page's definition
   * (`routes/lots/qualityRoutes.ts`), NOT the N/A-bypass subset that feeds
   * `na_hold_point_not_released`. Feeds `unreleased_hold_points`.
   */
  unreleasedHoldPoints: number;
  /**
   * The sufficiency evaluation, or null on a project that resolves no authority
   * ruleset. `prerequisites.sufficiencyBlocks` is the blocking half; this is
   * carried so the blocker item can name the shortfall rules.
   */
  sufficiency: SufficiencyEvaluation | null;
}

/**
 * The `GET /api/projects/:projectId/closeout-readiness` payload (D1a, spec
 * §4.1.3–4.1.4). The two escape counts are the point: a chainage or activity
 * filter that silently drops the lots it cannot place is a filter that lies,
 * and unchainaged / unclassified lots are ordinary in this codebase. **AT-139.**
 */
export interface CloseoutReadinessResponse {
  /** One row per in-scope lot, plus exactly one `subjectType: 'project'` aggregate. */
  verdicts: HandoverReadinessVerdict[];
  /** In-scope lots excluded by an `areaId` filter for want of a chainage. */
  unplacedLots: number;
  /** In-scope lots excluded by an `activitySlug` filter for want of a slug. */
  unclassifiedLots: number;
}

// Shared readiness predicate library (F0.1).
//
// Pure, DB-free, single-sourced predicates for the "missing / blocked /
// overdue / ready" vocabulary that today lives inlined across the readiness
// engine, the claim-evidence review, the conformance gate, the alert engine
// and the dashboards. Style mirrors `evidenceReadiness/core.ts`: no Prisma
// client, no I/O — every predicate takes plain rows/DTOs.
//
// Governing rule for F0.1 (execution spec §2, §11): this library NAMES the
// existing behaviour, it does not unify it. Where call sites diverge today,
// each divergent computation is kept as a DISTINCT named predicate with a doc
// comment recording which call site it came from and why it differs. F0.2 is
// what decides (with characterization sign-off) whether a divergence collapses.
//
// F0.1: this library is intentionally unused by production code — adopted by
// call sites in F0.2. If fallow flags these exports as unused, that is
// expected-by-design for this phase.
//
// Foundation map: docs/plans/f0-readiness-foundation-map-2026-07-24.md §5
// (A1–A5 tension points). Execution spec: docs/plans/f0-execution-spec-2026-07-24.md §2.

import { isPendingTestResultStatus } from '../testResultStatus.js';

/**
 * The Wave C1 sufficiency evaluator's boolean limb, re-exported so
 * `REASON_CODE_PROVENANCE` can cite a real predicate-library export for
 * `insufficient_test_count` / `test_sufficiency_met` (`contracts.test.ts:59-64`)
 * instead of dishonestly tagging them `'engine'` (C1 spec §4.3).
 *
 * Re-exported from `sufficiency/counts.ts`, not `sufficiency/evaluate.ts` as the
 * spec §4.3 snippet writes it: `evaluate.ts` imports `testPassing`/`testFailing`
 * from THIS file, so re-exporting out of it would make predicates ↔ evaluate a
 * circular import. `counts.ts` is the leaf that holds the same function.
 */
export { testCountSufficient } from './sufficiency/counts.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Coerce a Date | ISO string | null into a Date, or null when absent/invalid. */
function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// Hold points — 5 distinct signals today (foundation map §5 A2). Each current
// call site maps to exactly ONE of these.
// ---------------------------------------------------------------------------

export interface HoldPointStatusRow {
  status: string;
}

export interface HoldPointSchedulingRow extends HoldPointStatusRow {
  scheduledDate?: Date | string | null;
}

export interface HoldPointAgingRow extends HoldPointStatusRow {
  createdAt?: Date | string | null;
}

/**
 * Canonical conformance gate: a hold point counts as released ONLY when its
 * status is exactly 'released'.
 *
 * Call sites (map §5 A2#1): `conformancePrerequisites.ts:528-534`
 * (release lookup), `qualityRoutes.ts:250-251` (readiness counts),
 * `readRoutes.ts:246-249` (claim-readiness counts), `claimReview.ts:98`
 * (`status !== 'released'` → unreleased). This is the strict signal;
 * 'completed' does NOT satisfy it (see holdPointTerminal for the looser one).
 */
export function holdPointReleased(holdPoint: HoldPointStatusRow): boolean {
  return holdPoint.status === 'released';
}

/**
 * Management-prep terminal signal: a hold point is "done" for management
 * preparation when it is released OR completed
 * (`TERMINAL_HOLD_POINT_STATUSES = {'released','completed'}`).
 *
 * Call site (map §5 A2#4): `qualityRoutes.ts:45,141,153`. Diverges from
 * {@link holdPointReleased} on exactly `status === 'completed'`: terminal → true,
 * released → false. Conformance never accepts 'completed'; management prep does.
 */
export function holdPointTerminal(holdPoint: HoldPointStatusRow): boolean {
  return holdPoint.status === 'released' || holdPoint.status === 'completed';
}

/**
 * Statuses the DASHBOARDS treat as awaiting action for overdue detection.
 *
 * NOT the alert engine's — Wave E §0.3 established that the alert engine never
 * imported this constant at all: it carried an inline literal of the same two
 * values, and E1 repointed that literal onto
 * {@link AWAITING_RELEASE_HOLD_POINT_STATUSES}. This constant is deliberately
 * left at its old value because it has two LIVE production consumers that are
 * counting screens, not reminders: `statsRoute.ts:9,:89` (`/api/dashboard/stats`)
 * and `actionAssignments.ts:18,:135` (the My Work `hold_point_overdue` reason
 * code and the "Review hold point" vs "Release hold point" button label).
 * Changing it silently moves both. Wave E spec §3.2, §4.1.2.
 */
export const OVERDUE_HOLD_POINT_STATUSES = ['requested', 'scheduled'] as const;

/**
 * Dashboard "overdue hold point" signal: awaiting a scheduled inspection whose
 * scheduled date has passed by more than one day.
 *
 * Definition (map §5 A2#5): `status in ['requested','scheduled'] &&
 * scheduledDate < now - 1 day`. The Prisma `scheduledDate: { lt: threshold }`
 * filter excludes nulls, so a hold point with no scheduledDate is never overdue.
 *
 * `'requested'` has exactly one production writer (`sampleProjectRoute.ts:197`)
 * and it never sets `scheduledDate`, and `'scheduled'` has no writer at all —
 * so this predicate matches nothing the current code can create. That is why
 * the alert engine's copy of it was dead, and why E1 moved the alert engine
 * onto {@link holdPointReleaseOverdue} instead. See Wave E spec §3.
 *
 * Diverges from {@link holdPointStagnant} on ALL THREE axes: status set,
 * date column (scheduledDate here vs createdAt there) and threshold (1d vs 7d).
 * Diverges from {@link holdPointReleaseOverdue} on the status set only.
 */
export function holdPointOverdue(holdPoint: HoldPointSchedulingRow, now: Date): boolean {
  if (!(OVERDUE_HOLD_POINT_STATUSES as readonly string[]).includes(holdPoint.status)) {
    return false;
  }
  const scheduled = toDate(holdPoint.scheduledDate);
  if (!scheduled) return false;
  return scheduled.getTime() < now.getTime() - DAY_MS;
}

/**
 * The status a hold point actually carries while it waits on an external
 * release decision — the one the request-release paths write
 * (`requestReleaseRoutes.ts:349` batch, `:823` single).
 *
 * Wave E `[E-B1]`: this is the SINGLE definition of "awaiting release". The
 * alert creator (`systemAutomation.ts`) and its auto-resolver
 * (`systemAlertResolution.ts`) both import it, so they can never disagree
 * again. Anything that needs "is this hold point still waiting on the super?"
 * imports this — it does not write a fifth list.
 */
export const AWAITING_RELEASE_HOLD_POINT_STATUSES = ['notified'] as const;

/**
 * Is this hold point waiting on an external release decision?
 *
 * Wave E spec §4.1.2. Deliberately status-only: the caller decides whether
 * "waiting" is also "late" ({@link holdPointReleaseOverdue}).
 */
export function holdPointAwaitingRelease(holdPoint: HoldPointStatusRow): boolean {
  return (AWAITING_RELEASE_HOLD_POINT_STATUSES as readonly string[]).includes(holdPoint.status);
}

/**
 * Alert-engine "stale hold point" signal, corrected: awaiting an external
 * release decision whose scheduled date has passed by more than one day.
 *
 * Same shape and the same one-day threshold as {@link holdPointOverdue} — the
 * ONLY difference is the status set, and that difference is the whole of Wave
 * E1: `holdPointOverdue`'s statuses are never written together with a
 * `scheduledDate`, so the alert that used them could not fire (spec §3.1).
 *
 * The Prisma `scheduledDate: { lt: threshold }` filter excludes nulls, and so
 * does this predicate: a hold point with no scheduled date is never overdue,
 * before or after E1. That is why the 9 legacy `requested` rows in production
 * (all with a NULL `scheduled_date`) are matched by neither the old predicate
 * nor the new one, and no data migration was needed.
 */
export function holdPointReleaseOverdue(holdPoint: HoldPointSchedulingRow, now: Date): boolean {
  if (!holdPointAwaitingRelease(holdPoint)) return false;
  const scheduled = toDate(holdPoint.scheduledDate);
  if (!scheduled) return false;
  return scheduled.getTime() < now.getTime() - DAY_MS;
}

/** Statuses the dashboards treat as not-yet-actioned for aging detection. */
export const STAGNANT_HOLD_POINT_STATUSES = ['pending', 'scheduled', 'requested'] as const;

/**
 * Dashboard "stale hold point" aging signal: not-yet-actioned for more than
 * seven days since creation.
 *
 * Definition (map §5 A2#5, `portfolio.ts:235-243`, `statsRoute.ts:131-140`):
 * `status in ['pending','scheduled','requested'] && created_at < now - 7 days`.
 * See {@link holdPointOverdue} for the (different) alert-engine definition.
 */
export function holdPointStagnant(holdPoint: HoldPointAgingRow, now: Date): boolean {
  if (!(STAGNANT_HOLD_POINT_STATUSES as readonly string[]).includes(holdPoint.status)) {
    return false;
  }
  const created = toDate(holdPoint.createdAt);
  if (!created) return false;
  return created.getTime() < now.getTime() - 7 * DAY_MS;
}

// ---------------------------------------------------------------------------
// Tests — 4+ predicates today (foundation map §5 A3).
// ---------------------------------------------------------------------------

export interface TestResultRow {
  passFail: string;
  status: string;
}

export interface TestMatchTarget {
  itpChecklistItemId?: string | null;
  testType: string;
}

export interface TestMatchItem {
  id: string;
  testType?: string | null;
}

/**
 * A test result is passing evidence only when it has PASSED and reached the
 * terminal 'verified' status.
 *
 * Call sites (map §5 A3): `conformancePrerequisites.ts:281-287,455-457`
 * (conformance, item-matched), `claimReview.ts:139` and
 * `claims/evidenceRoutes.ts:238` (claim, lot-wide). Same boolean everywhere —
 * this one is NOT divergent, it is single-sourced here.
 */
export function testPassing(test: TestResultRow): boolean {
  return test.passFail === 'pass' && test.status === 'verified';
}

/**
 * A test result is FAILING evidence only when it has FAILED and reached the
 * terminal 'verified' status — the exact status-qualified mirror of
 * {@link testPassing} (Wave C1 spec §3.4.2 `[C1R-B8]`).
 *
 * Symmetry is load-bearing for the frequency-regime state machine: an
 * unqualified `passFail === 'fail'` would let a REJECTED or never-verified
 * failure permanently reset a frequency stream while a pass must clear
 * verification to count. `TestResult.status` defaults to 'requested' and the
 * table carries `rejectedById`/`rejectedAt`/`rejectionReason`
 * (`schema.prisma:846-853`), so unverified failures are a real population.
 */
export function testFailing(test: TestResultRow): boolean {
  return test.passFail === 'fail' && test.status === 'verified';
}

/**
 * CANONICAL "pending test" (execution spec §2, §12): status is in the whitelist
 * `PENDING_TEST_RESULT_STATUSES` {pending, submitted, requested, at_lab,
 * results_received, entered}. F0.2b unified every call site onto this, retiring
 * the not-fail-not-verified variant below.
 *
 * Call sites (map §5 A3): `qualityRoutes.ts:255`, `readRoutes.ts:255-257`
 * (lot-readiness / claim-readiness), plus (F0.2b) `claimReview.ts` and
 * `claims/evidenceRoutes.ts`. Reuses `isPendingTestResultStatus` so the
 * whitelist stays single-sourced.
 *
 * DIVERGES from {@link testPendingNotFailNotVerified} on the edge statuses:
 *  - a FAILED test in a whitelisted status (e.g. passFail='fail', status='entered')
 *    → this predicate TRUE, the not-fail-not-verified variant FALSE.
 *  - a non-fail test in a non-whitelisted, non-verified status (e.g. status
 *    'rejected' or '') → this predicate FALSE, the variant TRUE.
 */
export function testPendingByStatus(test: TestResultRow): boolean {
  return isPendingTestResultStatus(test.status);
}

/**
 * @deprecated F0.2b unified pending-test semantics onto {@link testPendingByStatus}
 * (the `PENDING_TEST_RESULT_STATUSES` whitelist). No production call site uses
 * this any more; kept only so the divergence stays named/testable until the
 * F0.2b pending-test PR is approved, then removed.
 *
 * "Pending test" as claim-evidence review previously defined it: anything that
 * has not failed and is not yet verified —
 * `passFail !== 'fail' && status !== 'verified'` (map §5 A3). See
 * {@link testPendingByStatus} for the exact inputs where the two disagree.
 */
export function testPendingNotFailNotVerified(test: TestResultRow): boolean {
  return test.passFail !== 'fail' && test.status !== 'verified';
}

function normalizeTestType(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

/**
 * Does a test result satisfy an ITP checklist item's test requirement?
 * A direct `itpChecklistItemId` link is strongest; a case-insensitive
 * `testType` match is the legacy/manual fallback.
 *
 * F1.2 correction `[F1C-C2]`: this docstring used to say it "mirrors
 * `conformancePrerequisites.ts:261-270` `testResultMatchesItem` … F0.2 unifies
 * to a single source". Both claims were false. There is no
 * `testResultMatchesItem` anywhere in that file (`:259-270` is
 * `getNaHoldPointSignoffItemIds`), and the unification ALREADY HAPPENED —
 * `conformancePrerequisites.ts:3` imports THIS function and calls it at `:290`,
 * `:313` and `:320`. Nothing is re-stated anywhere.
 *
 * WARNING: this matcher and the sufficiency attribution rule
 * (`sufficiency/testCategories.ts` `candidateCategories`) are DELIBERATELY
 * different as of F1. This one gates conformance for every tenant in every
 * state, including projects with no sufficiency pack; that one only counts
 * within a resolved pack. Do NOT "unify" them because they look alike —
 * unifying LOOSENS a shipped gate: lots that cannot be conformed today would
 * become conformable, on every project, with no direction in which it makes a
 * gate stricter. See docs/plans/
 * test-type-canonicalization-spec-2026-07-27.md §19, which specifies that
 * change as its own slice with its own characterization corpus, its own
 * enumerated moved-lot list and Jay's separate sign-off. Deleting this comment
 * is the marker that the two matchers converged deliberately (§19.4).
 */
export function testMatchesItem(item: TestMatchItem, test: TestMatchTarget): boolean {
  if (test.itpChecklistItemId === item.id) {
    return true;
  }
  const requiredTestType = normalizeTestType(item.testType);
  return Boolean(requiredTestType) && normalizeTestType(test.testType) === requiredTestType;
}

// ---------------------------------------------------------------------------
// NCRs (foundation map §5 A4). `ncrOpen` and overdue are consistent already;
// seriousness drifts three ways.
// ---------------------------------------------------------------------------

export interface NcrRow {
  status: string;
  severity?: string | null;
  category?: string | null;
  dueDate?: Date | string | null;
}

/**
 * Exported (Wave D `D1a`) so a Prisma `notIn` can bind to the SAME value
 * {@link ncrOpen} tests, keeping the query and the predicate from drifting —
 * the pattern F0.2a already used for {@link SERIOUS_NCR_SEVERITY} and the
 * stagnant hold-point statuses.
 */
export const CLOSED_NCR_STATUSES = ['closed', 'closed_concession'];

/**
 * An NCR is open unless it has reached a closed status. Consistent across every
 * call site today (map §5 A4): `status notIn ['closed','closed_concession']`.
 */
export function ncrOpen(ncr: Pick<NcrRow, 'status'>): boolean {
  return !CLOSED_NCR_STATUSES.includes(ncr.status);
}

/**
 * Prisma-compatible filter for hold points whose CURRENT decision round is a
 * conditional release with at least one condition not yet recorded satisfied.
 *
 * Keep this as data rather than a second status vocabulary: both conformance
 * and ITP lot progression bind their queries to this exact object, so an old
 * conditional round or an unconditional release cannot drift into either
 * gate.
 */
export const OPEN_HOLD_POINT_CONDITIONS_WHERE = {
  currentRound: {
    is: {
      outcome: 'released_with_conditions',
      conditions: {
        some: { recordedSatisfiedAt: null },
      },
    },
  },
} as const;

/**
 * An NCR is overdue when it is still open and its due date has passed.
 * Consistent across call sites (map §5 A4): `dueDate < now && not closed`
 * (`portfolio.ts` groupBy, `systemAutomation.ts` overdue-NCR pass).
 */
export function ncrOverdue(ncr: Pick<NcrRow, 'status' | 'dueDate'>, now: Date): boolean {
  if (!ncrOpen(ncr)) return false;
  const due = toDate(ncr.dueDate);
  if (!due) return false;
  return due.getTime() < now.getTime();
}

/**
 * How many FULL days have elapsed since a due date — the quantitative limb of
 * {@link ncrOverdue}, and the single source for every "N days overdue" string.
 *
 * Deliberately a UNIFICATION, not a naming (contra the F0.1 header rule): the
 * dashboard widget and the A4 Needs Attention screen were rendering the same
 * NCR as "42 days overdue" and "41 days overdue" on the same page load, because
 * the backend widget used `Math.ceil` (`statsRoute.ts`, `projectOverviewRoute.ts`)
 * while the screen used `Math.floor` (`NeedsAttentionPage.tsx` `timeChip`).
 * One fact cannot have two numbers, so the divergence collapses here.
 *
 * FLOOR wins, and the legacy `ceil` is demonstrably wrong rather than merely
 * different. NCR due dates are midnight-anchored, and the overdue query is
 * `dueDate < now`, so an NCR due TODAY is already in the feed a second after
 * midnight — where `ceil` reports "1 day overdue" for something not yet a day
 * late, and overstates the calendar-day difference by one for every row except
 * the exact-midnight instant. `floor` reports the full days actually elapsed,
 * which equals the calendar-day difference for midnight-anchored dates.
 *
 * Returns 0 for an absent due date and never returns a negative — a row that is
 * not yet due is 0 days overdue, not -3.
 */
export function daysOverdue(dueDate: Date | string | null | undefined, now: Date): number {
  const due = toDate(dueDate);
  if (!due) return 0;
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / DAY_MS));
}

/**
 * The canonical severity value that marks an NCR as "serious" (execution spec
 * §2). Exported so DB-level `where` filters that cannot consume a row predicate
 * can bind to the SAME value {@link ncrSerious} tests, keeping the query and the
 * predicate from drifting (mirrors how F0.2a bound dashboards to
 * {@link STAGNANT_HOLD_POINT_STATUSES}).
 */
export const SERIOUS_NCR_SEVERITY = 'major';

/**
 * CANONICAL seriousness (execution spec §2): `severity === 'major'`. This is the
 * single definition F0 unifies toward. F0.2b migrated all call sites onto this;
 * the two drifted variants below are DEPRECATED and retained only until both
 * F0.2b unification PRs are approved.
 */
export function ncrSerious(ncr: Pick<NcrRow, 'severity'>): boolean {
  return ncr.severity === SERIOUS_NCR_SEVERITY;
}

/**
 * @deprecated F0.2b unified NCR seriousness onto {@link ncrSerious}
 * (`severity === 'major'`). No production call site uses this any more; kept
 * only so the divergence stays named/testable until the F0.2b NCR PR is
 * approved, then removed.
 *
 * claimReview variant (map §5 A4, `claimReview.ts:206-207`):
 * `severity in ['major','critical']`. `'critical'` is not a documented severity
 * value (schema: minor | major) → the critical branch is effectively dead.
 * DIVERGES from {@link ncrSerious} only on `severity === 'critical'`
 * (this → true, canonical → false).
 */
export function ncrSeriousIncludingCritical(ncr: Pick<NcrRow, 'severity'>): boolean {
  return ncr.severity === 'major' || ncr.severity === 'critical';
}

/**
 * @deprecated F0.2b unified NCR seriousness onto {@link ncrSerious}
 * (`severity === 'major'`). The dashboards now filter by severity (bound to
 * {@link SERIOUS_NCR_SEVERITY}); this category-keyed variant has no production
 * call site and is kept only until the F0.2b NCR PR is approved, then removed.
 *
 * Dashboard variant (map §5 A4, `portfolio.ts:218`,
 * `projectManagerDashboardRoute.ts:118`): keyed "major NCR" off the freeform
 * `category` column (`category === 'major'`) rather than `severity`. DIVERGES
 * from {@link ncrSerious} whenever a lot's `category` and `severity` disagree on
 * the value 'major'.
 */
export function ncrSeriousByCategory(ncr: Pick<NcrRow, 'category'>): boolean {
  return ncr.category === 'major';
}

// ---------------------------------------------------------------------------
// Lot-level composites (foundation map §5 A1).
// ---------------------------------------------------------------------------

/**
 * The conformance prerequisites shape the authoritative gate consumes — a
 * structural subset of `ConformancePrerequisites` from
 * `conformancePrerequisites.ts` and `ConformancePrerequisiteSnapshot` from
 * `evidenceReadiness/core.ts`, so either assigns directly.
 */
export interface ConformablePrerequisites {
  itpAssigned: boolean;
  itpCompleted: boolean;
  testRequired: boolean;
  hasPassingTest: boolean;
  noOpenNcrs: boolean;
  /** False while a current conditional-release round has an open condition. */
  noOpenHoldPointConditions?: boolean;
  noNaHoldPointBypass?: boolean;
  /**
   * Wave C1 (spec §5.1.1, §5.1.2). ALREADY mode- and status-folded by the
   * sufficiency evaluator: true only at `Project.testSufficiencyMode === 'block'`
   * on a CONFIRMED ruleset with a real shortfall. The predicate stays a pure
   * function of prerequisites — it never reads the mode itself.
   *
   * OPTIONAL with a `false` default precisely so every pre-C1 caller and every
   * permutation in `predicates.parity.test.ts` behaves identically.
   */
  sufficiencyBlocks?: boolean;
}

/**
 * Authoritative "lot is conformable" composition (map §5 A1#1, the `canConform`
 * from `conformancePrerequisites.ts:472-477`). Composed from the SAME parts
 * `computeConformanceResult` computes, so feeding it `result.prerequisites`
 * reproduces `result.canConform` exactly (see predicates.parity.test.ts).
 *
 * The three looser "lot ready" definitions (auto-progression map §5 A1#2,
 * mobile-shell `deriveLotReadinessLine` A1#3, already-conformed subset A1#4)
 * are deliberately NOT collapsed into this in F0.1.
 */
export function lotConformable(prerequisites: ConformablePrerequisites): boolean {
  return (
    prerequisites.itpAssigned &&
    prerequisites.itpCompleted &&
    (!prerequisites.testRequired || prerequisites.hasPassingTest) &&
    prerequisites.noOpenNcrs &&
    (prerequisites.noOpenHoldPointConditions ?? true) &&
    (prerequisites.noNaHoldPointBypass ?? true) &&
    !(prerequisites.sufficiencyBlocks ?? false)
  );
}

export interface LotClaimEligibilityInput {
  status: string;
  claimedInId?: string | null;
  /**
   * Output of `getClaimBlockingReasonsForConformedLot` — the post-conformance
   * regression reasons (open NCRs, unreleased N/A hold points, and, when not
   * overridden, ITP/test gaps). Empty means no regression.
   */
  conformanceBlockingReasons: string[];
  canViewCommercial: boolean;
  budgetAmount: number | null;
}

/**
 * "Lot can be selected for a progress claim" — mirrors exactly the
 * action-blocking (`blocksAction: true`) items `buildClaimItems`
 * (`evidenceReadiness.ts:218-390`) emits: `already_claimed`, `not_conformed`,
 * `conformance_no_longer_current`, and `missing_budget`. The `unreleased_hold_points`
 * and `pending_tests` items are advisory (`blocksAction: false`) and do NOT
 * gate eligibility, so they are not consulted here.
 */
export function lotClaimEligible(input: LotClaimEligibilityInput): boolean {
  if (input.status === 'claimed' || input.claimedInId) return false;
  if (input.status !== 'conformed') return false;
  if (input.conformanceBlockingReasons.length > 0) return false;
  if (input.canViewCommercial && input.budgetAmount === null) return false;
  return true;
}

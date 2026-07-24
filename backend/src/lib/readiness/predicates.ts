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

/** Statuses the alert engine treats as awaiting action for overdue detection. */
export const OVERDUE_HOLD_POINT_STATUSES = ['requested', 'scheduled'] as const;

/**
 * Alert-engine "stale hold point" signal: awaiting a scheduled inspection whose
 * scheduled date has passed by more than one day.
 *
 * Definition (map §5 A2#5, `systemAutomation.ts:274-280`):
 * `status in ['requested','scheduled'] && scheduledDate < now - 1 day`.
 * The Prisma `scheduledDate: { lt: threshold }` filter excludes nulls, so a
 * hold point with no scheduledDate is never overdue.
 *
 * Diverges from {@link holdPointStagnant} on ALL THREE axes: status set,
 * date column (scheduledDate here vs createdAt there) and threshold (1d vs 7d).
 */
export function holdPointOverdue(holdPoint: HoldPointSchedulingRow, now: Date): boolean {
  if (!(OVERDUE_HOLD_POINT_STATUSES as readonly string[]).includes(holdPoint.status)) {
    return false;
  }
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
 * "Pending test" by the status whitelist (`PENDING_TEST_RESULT_STATUSES`):
 * status in {pending, submitted, requested, at_lab, results_received, entered}.
 *
 * Call sites (map §5 A3): `qualityRoutes.ts:255`, `readRoutes.ts:255-257`
 * (the lot-readiness / claim-readiness `pendingTests` count). Reuses
 * `isPendingTestResultStatus` so the whitelist stays single-sourced.
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
 * "Pending test" as claim-evidence review defines it: anything that has not
 * failed and is not yet verified.
 *
 * Definition (map §5 A3, `claimReview.ts:135-137`, `evidenceRoutes.ts:242`):
 * `passFail !== 'fail' && status !== 'verified'`. This is the
 * "candidate behaviour change" the spec flags (§2, §12) for migration to
 * {@link testPendingByStatus}. F0.1 keeps BOTH so the divergence is named and
 * characterization-testable; F0.2 decides. See {@link testPendingByStatus} for
 * the exact inputs where the two disagree.
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
 * Mirrors `conformancePrerequisites.ts:261-270` `testResultMatchesItem`
 * (not exported there — F0.1 must not modify that file, so the logic is
 * re-stated here; F0.2 unifies to a single source).
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

const CLOSED_NCR_STATUSES = ['closed', 'closed_concession'];

/**
 * An NCR is open unless it has reached a closed status. Consistent across every
 * call site today (map §5 A4): `status notIn ['closed','closed_concession']`.
 */
export function ncrOpen(ncr: Pick<NcrRow, 'status'>): boolean {
  return !CLOSED_NCR_STATUSES.includes(ncr.status);
}

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
 * CANONICAL seriousness (execution spec §2): `severity === 'major'`. This is the
 * single definition F0 unifies toward, retiring the two drifted variants below.
 */
export function ncrSerious(ncr: Pick<NcrRow, 'severity'>): boolean {
  return ncr.severity === 'major';
}

/**
 * claimReview variant (map §5 A4, `claimReview.ts:206-207`):
 * `severity in ['major','critical']`. `'critical'` is not a documented severity
 * value (schema: minor | major) → the critical branch is effectively dead.
 * Kept as a named predicate so the characterization corpus can pin the
 * before/after when F0.2 retires it. DIVERGES from {@link ncrSerious} only on
 * `severity === 'critical'` (this → true, canonical → false).
 */
export function ncrSeriousIncludingCritical(ncr: Pick<NcrRow, 'severity'>): boolean {
  return ncr.severity === 'major' || ncr.severity === 'critical';
}

/**
 * Dashboard variant (map §5 A4, `portfolio.ts:218`,
 * `projectManagerDashboardRoute.ts:118`): keys "major NCR" off the freeform
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
  noNaHoldPointBypass?: boolean;
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
    (prerequisites.noNaHoldPointBypass ?? true)
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

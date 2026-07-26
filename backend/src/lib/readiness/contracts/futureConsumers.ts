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

import type { ReadinessReasonCode } from './reasonCodes.js';

// ---------------------------------------------------------------------------
// Test sufficiency (foundation map §3b, §5 A3). Predicates: testPassing,
// testPendingByStatus, testPendingNotFailNotVerified, testMatchesItem.
// ---------------------------------------------------------------------------

/** The reasonCodes the test-sufficiency consumer may emit — subset of the vocabulary. */
export type TestReasonCode = Extract<
  ReadinessReasonCode,
  'no_passing_verified_test' | 'no_tests' | 'failed_tests' | 'pending_tests' | 'passing_tests'
>;

export interface TestSufficiencyVerdict {
  /** 'lot' (lot-wide) or 'itp_item' (a single checklist item's test requirement). */
  subjectType: 'lot' | 'itp_item';
  subjectId: string;
  /** All required tests passing+verified (testPassing) — the sufficiency gate. */
  sufficient: boolean;
  reasonCodes: TestReasonCode[];
  // spec §13-open: outstanding-test detail (the engine item's `outstandingTests[]`
  // shape) is not pinned here — the A? consumer that renders per-test rows extends
  // this when built. Minimum contract = sufficient + reasonCodes.
}

// ---------------------------------------------------------------------------
// Hold-point packages (foundation map §3a, §5 A2). Predicates: holdPointReleased,
// holdPointTerminal, holdPointOverdue, holdPointStagnant. A "package" today is the
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

export type HandoverReasonCode = Extract<
  ReadinessReasonCode,
  | 'no_itp_assigned'
  | 'itp_incomplete'
  | 'no_passing_verified_test'
  | 'open_ncrs'
  | 'open_major_ncrs'
  | 'na_hold_point_not_released'
  | 'unreleased_hold_points'
  | 'not_conformed'
>;

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

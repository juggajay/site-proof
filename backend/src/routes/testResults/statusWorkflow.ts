/**
 * Test-result status workflow maps, extracted verbatim from
 * backend/src/routes/testResults.ts (testResults refactor map).
 *
 * Pure reference data: the allowed status-transition graph (Feature #196) and
 * the human-readable status labels. No DB, auth, or HTTP concerns live here —
 * the status (POST /:id/status) and workflow (GET /:id/workflow) route handlers
 * still own transition validation and the AppError details payload; they just
 * read these maps.
 */

// Valid status workflow transitions (Feature #196)
//
// The original linear chain was:
//   requested -> at_lab -> results_received -> entered -> verified
//
// Ticket T2: the intermediate lab-handling states (At Lab / Results Received)
// are now OPTIONAL. The enum values are kept intact so existing rows already
// parked in any of them still transition forward, but the map is widened
// *additively* so a test that already has a recorded result + certificate can
// reach 'entered' in a single step (then 'verified' in one more). Nothing is
// removed — every original edge is still present.
//
// Reaching 'entered' is still gated by `hasRecordedResult()` in the route layer
// (RESULT_REQUIRED), so a short-path jump only succeeds once a real result value
// and a real pass/fail outcome have been recorded.
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['at_lab', 'results_received', 'entered'],
  at_lab: ['results_received', 'entered'],
  results_received: ['entered'],
  entered: ['verified'],
  verified: [], // Terminal state
};

// Status labels for display
export const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  at_lab: 'At Lab',
  results_received: 'Results Received',
  entered: 'Entered',
  verified: 'Verified',
};

// Ticket T2: a test result only carries a real result once it has BOTH a
// non-empty numeric result value AND a definitive pass/fail outcome. A blank
// value or a 'pending' (or any non pass/fail) outcome does not count — those are
// exactly the empty rows the old "Enter Results" no-op produced. The route layer
// uses this to block moving a test to 'entered' or 'verified' without real data.
export function hasRecordedResult(testResult: {
  resultValue: unknown;
  passFail: unknown;
}): boolean {
  return (
    testResult.resultValue !== null &&
    testResult.resultValue !== undefined &&
    (testResult.passFail === 'pass' || testResult.passFail === 'fail')
  );
}

// AppError code thrown when a test is moved to 'entered'/'verified' before a
// real result value + pass/fail outcome have been recorded.
export const RESULT_REQUIRED_CODE = 'RESULT_REQUIRED';

// User-facing message for the RESULT_REQUIRED gate.
export const RESULT_REQUIRED_MESSAGE =
  'Record a result value and a pass/fail outcome before this test can be entered or verified.';

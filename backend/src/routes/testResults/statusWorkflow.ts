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
// requested -> at_lab -> results_received -> entered -> verified
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['at_lab'],
  at_lab: ['results_received'],
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

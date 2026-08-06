/**
 * Constants for Lot-related pages and components.
 * Extracted from LotDetailPage.tsx for reusability.
 */

import { API_URL } from '@/lib/config';

// The lot-detail tab strip moved to ./lotWorkspaceTabs.ts in DG-4a: five
// top-level tabs, with the seven content views behind them.

// Pass/fail color classes for test results
export const testPassFailColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  pass: 'bg-muted text-muted-foreground',
  fail: 'bg-destructive/10 text-destructive',
};

// Status color classes for test result workflow status
export const testStatusColors: Record<string, string> = {
  requested: 'bg-muted text-muted-foreground',
  entered: 'bg-muted text-muted-foreground',
  verified: 'bg-muted text-muted-foreground',
};

// The lot page's NCRs tab used to keep its own NCR colour map, which disagreed
// with the register's. Both now read `lib/statusColors.ts`.
export { getNcrStatusBadgeClass } from '@/lib/statusColors';

// Severity color classes for NCRs
export const severityColors: Record<string, string> = {
  minor: 'bg-warning/10 text-warning',
  major: 'bg-destructive text-destructive-foreground',
};

// Workflow statuses only. Conformance and claim terminal states are controlled
// through Evidence Readiness, Force Conform, and progress claims.
export const LOT_OVERRIDE_STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'awaiting_test', label: 'Awaiting Test' },
  { value: 'hold_point', label: 'Hold Point' },
  { value: 'ncr_raised', label: 'NCR Raised' },
  { value: 'completed', label: 'Completed' },
];

export { API_URL };

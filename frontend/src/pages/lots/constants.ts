/**
 * Constants for Lot-related pages and components.
 * Extracted from LotDetailPage.tsx for reusability.
 */

import type { LotTab, TabConfig } from './types';
import { API_URL } from '@/lib/config';

// Tab configuration for lot detail page
export const LOT_TABS: TabConfig[] = [
  { id: 'itp', label: 'ITP Checklist' },
  { id: 'tests', label: 'Test Results' },
  { id: 'ncrs', label: 'NCRs' },
  { id: 'photos', label: 'Photos' },
  { id: 'documents', label: 'Documents' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
];

// Foreman-first tab order. The field-execution tabs (ITP checklist, Photos,
// NCRs) come first so a foreman on a narrow (390px) screen reaches the work they
// do most without scrolling the strip. No tab is removed — secondary tabs follow
// in their original order.
export const FOREMAN_TAB_PRIORITY: LotTab[] = ['itp', 'photos', 'ncrs'];

// Return the lot-detail tabs ordered for a given role. Foreman gets the
// field-first order; every other role (and unknown/undefined roles) keeps the
// default order. Pure and total: all tabs are always returned, never dropped.
export function getLotTabsForRole(role: string | undefined | null): TabConfig[] {
  if (role !== 'foreman') return LOT_TABS;

  const prioritized = FOREMAN_TAB_PRIORITY.map((id) =>
    LOT_TABS.find((tab) => tab.id === id),
  ).filter((tab): tab is TabConfig => tab !== undefined);
  const rest = LOT_TABS.filter((tab) => !FOREMAN_TAB_PRIORITY.includes(tab.id));

  return [...prioritized, ...rest];
}

// Status color classes for lot status badges
export const lotStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
};

// Pass/fail color classes for test results
export const testPassFailColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
};

// Status color classes for test result workflow status
export const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  entered: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
};

// Status color classes for NCR workflow status
export const ncrStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  rectification: 'bg-orange-100 text-orange-800',
  verification: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  closed_concession: 'bg-green-100 text-green-700',
};

// Severity color classes for NCRs
export const severityColors: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-800',
  major: 'bg-red-500 text-white',
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

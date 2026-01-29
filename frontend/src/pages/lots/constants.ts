/**
 * Constants for Lot-related pages and components.
 * Extracted from LotDetailPage.tsx for reusability.
 */

import type { TabConfig } from './types'

// Tab configuration for lot detail page
export const LOT_TABS: TabConfig[] = [
  { id: 'itp', label: 'ITP Checklist' },
  { id: 'tests', label: 'Test Results' },
  { id: 'ncrs', label: 'NCRs' },
  { id: 'photos', label: 'Photos' },
  { id: 'documents', label: 'Documents' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
]

// Status color classes for lot status badges
export const lotStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  on_hold: 'bg-red-100 text-red-800',
}

// Pass/fail color classes for test results
export const testPassFailColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pass: 'bg-green-100 text-green-800',
  fail: 'bg-red-100 text-red-800',
}

// Status color classes for test result workflow status
export const testStatusColors: Record<string, string> = {
  requested: 'bg-gray-100 text-gray-800',
  entered: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
}

// Status color classes for NCR workflow status
export const ncrStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  rectification: 'bg-orange-100 text-orange-800',
  verification: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  closed_concession: 'bg-green-100 text-green-700',
}

// Severity color classes for NCRs
export const severityColors: Record<string, string> = {
  minor: 'bg-yellow-100 text-yellow-800',
  major: 'bg-red-500 text-white',
}

// API base URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

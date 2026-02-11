/**
 * Constants for NCR-related pages and components.
 * Extracted from NCRPage.tsx for reusability.
 */

// Status color classes for NCR status badges
export const ncrStatusColors: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  rectification: 'bg-orange-100 text-orange-800',
  verification: 'bg-blue-100 text-blue-800',
  closed: 'bg-green-100 text-green-800',
  closed_concession: 'bg-green-100 text-green-700',
}

// Default fallback status color
export const DEFAULT_STATUS_COLOR = 'bg-gray-100 text-gray-800'

// NCR category options for the create form
export const NCR_CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'workmanship', label: 'Workmanship' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'process', label: 'Process' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
] as const

// Root cause category options for the respond form
export const ROOT_CAUSE_CATEGORIES = [
  { value: 'human_error', label: 'Human Error' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'materials', label: 'Materials' },
  { value: 'process', label: 'Process' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
] as const

/**
 * Returns the CSS class names for a given NCR status badge.
 */
export function getStatusBadgeColor(status: string): string {
  return ncrStatusColors[status] ?? DEFAULT_STATUS_COLOR
}

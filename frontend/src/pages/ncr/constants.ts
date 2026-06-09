/**
 * Constants for NCR-related pages and components.
 * Extracted from NCRPage.tsx for reusability.
 */

// Status color classes for NCR status badges
export const ncrStatusColors: Record<string, string> = {
  open: 'bg-destructive/10 text-destructive',
  investigating: 'bg-muted text-muted-foreground',
  rectification: 'bg-muted text-muted-foreground',
  verification: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
  closed_concession: 'bg-muted text-muted-foreground',
};

// Default fallback status color
export const DEFAULT_STATUS_COLOR = 'bg-muted text-foreground';

// NCR category options for the create form
export const NCR_CATEGORIES = [
  { value: 'materials', label: 'Materials' },
  { value: 'workmanship', label: 'Workmanship' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'process', label: 'Process' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
] as const;

// Root cause category options for the respond form
export const ROOT_CAUSE_CATEGORIES = [
  { value: 'human_error', label: 'Human Error' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'materials', label: 'Materials' },
  { value: 'process', label: 'Process' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * Returns the CSS class names for a given NCR status badge.
 */
export function getStatusBadgeColor(status: string): string {
  return ncrStatusColors[status] ?? DEFAULT_STATUS_COLOR;
}

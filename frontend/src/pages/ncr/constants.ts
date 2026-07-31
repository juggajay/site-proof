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

// NCR category options for the create form, and root-cause options for the
// respond form. Wave G G5 (spec §5.2 gap 1) made these a server-enforced
// vocabulary, so the lists now live in `@/lib/ncrVocabulary` — the frontend
// mirror of `backend/src/lib/ncrVocabulary.ts`, with a pinned-equality drift
// test on each side. Re-exported here so the existing import sites keep working
// and there is exactly one list, not two that agree by luck.
export {
  NCR_CATEGORIES,
  NCR_ROOT_CAUSE_CATEGORIES as ROOT_CAUSE_CATEGORIES,
} from '@/lib/ncrVocabulary';

/**
 * Returns the CSS class names for a given NCR status badge.
 */
export function getStatusBadgeColor(status: string): string {
  return ncrStatusColors[status] ?? DEFAULT_STATUS_COLOR;
}

import { getCalendarDaysSince } from '@/lib/localDate';
import type { HoldPoint, StatusFilter } from '../types';

export function formatHoldPointDate(value: string | null | undefined): string {
  if (!value) return '-';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return date.toLocaleDateString('en-AU');
}

/** Check if HP is overdue (Feature #190) */
export function isOverdue(hp: HoldPoint): boolean {
  if (hp.status !== 'notified') return false;
  if (!hp.scheduledDate) return false;
  const scheduled = new Date(hp.scheduledDate);
  if (!Number.isFinite(scheduled.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return scheduled < today;
}

/**
 * Backend default minimum notice for hold-point release requests, in days
 * (see backend/src/routes/holdpoints/requestReleaseRoutes.ts —
 * `projectSettings.holdPointMinimumNoticeDays ?? 1`). The project-level
 * override is not part of the register list payload, so the register derives
 * notice expiry with this default.
 */
export const DEFAULT_HP_MINIMUM_NOTICE_DAYS = 1;

/**
 * True when an awaiting-release hold point's notice window has fully elapsed:
 * the authority was notified (`notificationSentAt`), at least
 * `minimumNoticeDays` calendar days have passed since (Australia/Sydney
 * calendar days via getCalendarDaysSince, so a UTC timestamp near midnight
 * never lands on the wrong day), and the hold point still isn't released.
 * These are the "chase now" items for a quality manager.
 */
export function isNoticeExpired(
  hp: HoldPoint,
  referenceDate: Date | string = new Date(),
  minimumNoticeDays: number = DEFAULT_HP_MINIMUM_NOTICE_DAYS,
): boolean {
  if (hp.status !== 'notified') return false;
  if (!hp.notificationSentAt) return false;
  return getCalendarDaysSince(hp.notificationSentAt, referenceDate) >= minimumNoticeDays;
}

export function getStatusBadge(status: string): string {
  const styles: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    notified: 'bg-warning/10 text-warning',
    released: 'bg-muted text-muted-foreground',
  };
  return styles[status] || styles.pending;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    notified: 'Awaiting Release',
    released: 'Released',
    // Register-only view (StatusFilter), never a backend hold-point status:
    // awaiting release with the notice window elapsed.
    'notice-expired': 'Notice Expired',
  };
  return labels[status] || status;
}

/**
 * Empty-state copy shared by the desktop table and the mobile list when the
 * active search/status filter matches nothing.
 */
export function buildFilterEmptyStateMessage(
  statusFilter: StatusFilter,
  searchQuery: string,
): string {
  const query = searchQuery.trim();
  const statusClause =
    statusFilter === 'all' ? '' : ` with status "${getStatusLabel(statusFilter)}"`;

  if (query) {
    return `No hold points matching "${query}"${statusClause} found. Try a different search or status filter.`;
  }
  return `No hold points${statusClause} found. Try selecting a different status filter.`;
}

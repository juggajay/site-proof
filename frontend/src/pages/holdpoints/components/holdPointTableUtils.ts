import { getCalendarDaysSince } from '@/lib/localDate';
import type { HoldPoint, StatusFilter } from '../types';
import { formatHoldPointStatusLabel, getHoldPointStatusKey } from '@/lib/statusLabels';
import { getHoldPointStatusBadgeClass } from '@/lib/statusColors';

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

/**
 * The instant this hold point started waiting on someone: the release request
 * going out (`notificationSentAt`), else the hold point appearing on the
 * register (`createdAt`). Null once released — nobody is waiting any more.
 * Sorting compares these timestamps directly; ordering by them is identical to
 * ordering by whole days waited, without an Intl call per comparison.
 */
export function getWaitingSince(hp: HoldPoint): string | null {
  if (hp.status === 'released') return null;
  return hp.notificationSentAt || hp.createdAt || null;
}

/**
 * Whole calendar days (Australia/Sydney) this hold point has been waiting.
 * Null once released. This is the register's ageing column: the number a
 * quality manager sorts by to find what has been sitting the longest.
 */
export function getWaitingDays(
  hp: HoldPoint,
  referenceDate: Date | string = new Date(),
): number | null {
  const since = getWaitingSince(hp);
  if (!since) return null;
  return Math.max(0, getCalendarDaysSince(since, referenceDate));
}

export function getStatusBadge(holdPoint: HoldPoint): string {
  return getHoldPointStatusBadgeClass(getHoldPointStatusKey(holdPoint));
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    notified: 'Awaiting Release',
    released: 'Released',
    // Register-only view (StatusFilter), never a backend hold-point status:
    // awaiting release with the notice window elapsed.
    'notice-expired': 'Notice Expired',
    refused: 'Release Refused',
    'conditions-open': 'Conditions Open',
  };
  return labels[status] || status;
}

export function getHoldPointStatusLabel(holdPoint: HoldPoint): string {
  return formatHoldPointStatusLabel(holdPoint);
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

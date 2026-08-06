/**
 * Shared read model for the grouped notifications endpoint
 * (GET /api/notifications/grouped), used by both surfaces that render it:
 * NotificationsPage and the header bell dropdown. Both must agree on counts and
 * on ordering, so they share these types and helpers rather than each keeping a
 * copy.
 *
 * The backend owns the triage and the grouping — see
 * backend/src/routes/notifications/triage.ts. Nothing here re-derives them.
 */

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
  project?: {
    id: string;
    name: string;
    projectNumber: string;
  } | null;
}

/**
 * "Read" is read — `isRead` records that a row was opened, which is not evidence
 * that the work behind it happened. Do not relabel this "Actioned"/"Done".
 */
export type TriageCategory = 'needs_action' | 'fyi' | 'read';

export interface NotificationGroup {
  key: string;
  type: string;
  category: TriageCategory;
  /** Members, newest first. `[0]` is the row the group summarises. */
  notifications: Notification[];
}

export interface GroupedNotificationsResponse {
  groups: NotificationGroup[];
  unreadCount: number;
  windowSize: number;
  truncated: boolean;
}

export const GROUPED_NOTIFICATIONS_URL = '/api/notifications/grouped';

/** Internal app paths only — never navigate to a link a notification supplies verbatim. */
export function getSafeInternalPath(linkUrl: string | null): string | null {
  const trimmed = linkUrl?.trim();
  if (
    !trimmed ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    containsControlCharacter(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 31 || codePoint === 127);
  });
}

export function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return 'Scheduled';
  }
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Backend titles suffix the project name ("ESCALATED: Missing Daily Diary:
 * Demo Walkthrough 2026") and the meta line under the row prints it again.
 * Drop the echo from the title; the meta line stays the one place it is stated.
 * No-op when the title does not end in the project name.
 */
export function stripProjectEcho(title: string, projectName: string | null | undefined): string {
  if (!projectName) return title;
  const suffix = `: ${projectName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

/** The unread member ids a group held at render time. */
export function unreadIdsIn(group: NotificationGroup): string[] {
  return group.notifications.filter((notification) => !notification.isRead).map((n) => n.id);
}

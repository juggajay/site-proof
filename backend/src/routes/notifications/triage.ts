/**
 * Notification triage: the ONE place that decides whether a notification type
 * asks the recipient to do something, and the ONE place that decides when two
 * notifications are repeats of each other.
 *
 * Used by the grouped read endpoint (groupedRoutes.ts). Deliberately pure — no
 * Express, no Prisma — so it is unit-testable and so `triageDrift.test.ts` can
 * assert that every notification `type` literal the backend produces is
 * classified here.
 *
 * The three buckets are "Needs action", "FYI" and "Read". The third is READ, not
 * "Actioned"/"Done": `Notification.isRead` records that a row was opened, which
 * is not evidence that the underlying work happened. Do not relabel it.
 */

export type TriageCategory = 'needs_action' | 'fyi' | 'read';

/**
 * Every notification `type` the backend writes to the `notifications` table,
 * mapped to whether it asks the recipient to act.
 *
 * `needs_action` means the recipient personally has something to do: approve,
 * respond, verify, rectify, attend, or file. `fyi` means the event is already
 * settled and the row is a record of it.
 *
 * ADDING A NOTIFICATION TYPE: add it here. `triageDrift.test.ts` fails the build
 * if a type literal exists in backend source and is missing from this map.
 */
export const NOTIFICATION_TRIAGE: Record<string, 'needs_action' | 'fyi'> = {
  // Escalated alerts — an escalation exists precisely because nobody acted.
  alert_escalation: 'needs_action',
  alert_overdue_ncr: 'needs_action',
  alert_stale_hold_point: 'needs_action',

  // Diary — the recipient still has to write or submit the diary.
  diary_reminder: 'needs_action',
  diary_missing_alert: 'needs_action',

  // Dockets — pending/queried/rejected all await someone's next move.
  docket_pending: 'needs_action',
  docket_queried: 'needs_action',
  docket_query_response: 'needs_action',
  docket_rejected: 'needs_action',
  docket_backlog_alert: 'needs_action',
  docket_approved: 'fyi',

  // Hold points.
  hold_point_escalation: 'needs_action',
  hold_point_release: 'fyi',
  hold_point_rejection: 'needs_action',
  hold_point_conditional_release: 'needs_action',

  // ITP.
  itp_rejection: 'needs_action',
  itp_subbie_completion: 'needs_action',
  itp_verification: 'fyi',
  witness_point_approaching: 'needs_action',

  // NCRs.
  ncr_raised: 'needs_action',
  ncr_assigned: 'needs_action',
  ncr_redirect: 'needs_action',
  ncr_revision_requested: 'needs_action',
  ncr_rectification_rejected: 'needs_action',
  ncr_response_accepted: 'fyi',

  // Test results.
  test_result_rejected: 'needs_action',
  test_result_received: 'fyi',

  // Lots, mentions, subcontractor rates, team membership.
  lot_assigned: 'needs_action',
  mention: 'needs_action',
  rate_counter: 'needs_action',
  rate_approved: 'fyi',
  team_invitation: 'needs_action',
  role_change: 'fyi',
  project_removal: 'fyi',

  // Claims are a record of a commercial outcome, not a task.
  claim_certified: 'fyi',
  claim_paid: 'fyi',
};

/**
 * String literals that the drift scan picks up from notification source files
 * but that are NOT written to `Notification.type`. Listed so the scan can stay
 * deliberately wide (a wide scan is what makes it hard to sneak a new type past
 * it) without polluting the classifier above.
 */
export const NON_NOTIFICATION_TYPE_LITERALS: Record<string, string> = {
  // ActiveAlert.type values. The notification written for an alert is
  // `alert_${alertType}` (alerts.ts), which IS classified above.
  overdue_ncr: 'ActiveAlert.type',
  stale_hold_point: 'ActiveAlert.type',
  // Web-push test payload (pushNotifications.ts), never a notification row.
  test: 'push test payload',
};

/** Unknown types are shown, never hidden — the drift test is the real guard. */
export function triageCategory(notification: { type: string; isRead: boolean }): TriageCategory {
  if (notification.isRead) return 'read';
  return NOTIFICATION_TRIAGE[notification.type] ?? 'fyi';
}

const CATEGORY_ORDER: Record<TriageCategory, number> = {
  needs_action: 0,
  fyi: 1,
  read: 2,
};

/**
 * Link paths that identify no entity — a project root or an app-level landing
 * page. Two notifications that both fall back to one of these are not evidence
 * of the same thing happening twice, so they are never collapsed.
 */
const GENERIC_LINK_PATHS = new Set(['/dashboard', '/subcontractor-portal', '/notifications']);
const PROJECT_ROOT_PATH = /^\/projects\/[^/]+$/;

/**
 * The entity a notification points at, or null when it points at nothing
 * specific (and so must never be grouped).
 *
 * Query parameters are part of the identity, NOT stripped. `links.ts` puts most
 * entity ids in the query string — `/projects/X/ncr?ncr=<id>`,
 * `?holdPoint=<id>`, `?docket=<id>`, `?test=<id>` — so keying on the path alone
 * would collapse escalations for DIFFERENT NCRs in one project into a single
 * row. Params are sorted so a re-ordered query string still matches. The
 * fragment is dropped; it addresses a position, not an entity.
 */
export function notificationEntityKey(linkUrl: string | null | undefined): string | null {
  const trimmed = linkUrl?.trim();
  // Only internal absolute paths. `//host` is protocol-relative (external).
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }

  const withoutFragment = trimmed.split('#')[0];
  const [path, query = ''] = withoutFragment.split('?');

  if (GENERIC_LINK_PATHS.has(path) || PROJECT_ROOT_PATH.test(path)) {
    return null;
  }

  const params = Array.from(new URLSearchParams(query).entries())
    .map(([name, value]) => `${name}=${value}`)
    .sort();

  return params.length > 0 ? `${path}?${params.join('&')}` : path;
}

export interface GroupableNotification {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  linkUrl: string | null;
  projectId: string | null;
}

export interface NotificationGroup<TNotification extends GroupableNotification> {
  key: string;
  type: string;
  category: TriageCategory;
  /** Members, newest first. `[0]` is the row rendered as the group's summary. */
  notifications: TNotification[];
}

/**
 * Collapse repeats into one group each.
 *
 * A group is (type, projectId, isRead, entity). `isRead` is part of the key so a
 * group never straddles two sections, which also keeps "mark this group read" a
 * closed set of unread ids. A notification whose link identifies no entity is
 * its own group of one.
 *
 * Input is expected newest-first; member order is preserved, and groups come
 * back ordered by category then by their newest member.
 */
export function groupNotifications<TNotification extends GroupableNotification>(
  notifications: TNotification[],
): NotificationGroup<TNotification>[] {
  const groups: NotificationGroup<TNotification>[] = [];
  const byKey = new Map<string, NotificationGroup<TNotification>>();

  for (const notification of notifications) {
    const entityKey = notificationEntityKey(notification.linkUrl);
    const category = triageCategory(notification);
    const key =
      entityKey === null
        ? `ungrouped:${notification.id}`
        : // JSON, not a delimiter join: any separator character could in principle
          // appear inside a link path and merge two distinct groups.
          JSON.stringify([notification.type, notification.projectId ?? '', category, entityKey]);

    const existing = byKey.get(key);
    if (existing) {
      existing.notifications.push(notification);
      continue;
    }

    const group: NotificationGroup<TNotification> = {
      key,
      type: notification.type,
      category,
      notifications: [notification],
    };
    byKey.set(key, group);
    groups.push(group);
  }

  return groups.sort((a, b) => {
    const byCategory = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (byCategory !== 0) return byCategory;
    return b.notifications[0].createdAt.getTime() - a.notifications[0].createdAt.getTime();
  });
}

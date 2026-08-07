import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ChevronDown,
  Clock,
  Settings,
  Trash2,
  User,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { createMutationErrorHandler } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import {
  GROUPED_NOTIFICATIONS_URL,
  formatRelativeTime,
  getSafeInternalPath,
  stripProjectEcho,
  unreadIdsIn,
  type GroupedNotificationsResponse,
  type Notification,
  type NotificationGroup,
  type TriageCategory,
} from '@/lib/notificationGroups';
import { Button } from '@/components/ui/button';

type NotificationFilter = 'all' | 'unread' | 'mention' | 'alert';

/**
 * "Read" is read, not "Actioned" — `isRead` records that a row was opened, which
 * is not evidence the work behind it happened. The backend owns the same three
 * labels in routes/notifications/triage.ts.
 */
const SECTIONS: { category: TriageCategory; label: string; hint: string }[] = [
  { category: 'needs_action', label: 'Needs action', hint: 'Waiting on you' },
  { category: 'fyi', label: 'FYI', hint: 'No action required' },
  { category: 'read', label: 'Read', hint: 'Already opened' },
];

function getFilterLabel(filter: NotificationFilter): string {
  if (filter === 'mention') return 'mention';
  if (filter === 'alert') return 'alert';
  return filter;
}

function matchesFilter(group: NotificationGroup, filter: NotificationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return group.category !== 'read';

  const type = group.type.toLowerCase();
  if (filter === 'alert') {
    return type === 'warning' || type.includes('alert');
  }
  return type === filter;
}

function getNotificationIcon(type: string) {
  const normalizedType = type.toLowerCase();
  if (normalizedType === 'warning' || normalizedType.includes('alert')) {
    return <AlertCircle className="h-5 w-5 text-warning" />;
  }
  if (normalizedType === 'success') {
    return <CheckCircle className="h-5 w-5 text-success" />;
  }
  if (normalizedType === 'mention') {
    return <User className="h-5 w-5 text-primary" />;
  }
  return <Clock className="h-5 w-5 text-primary" />;
}

function formatProjectMeta(notification: Notification): string {
  return notification.project
    ? ` · ${notification.project.name} · ${notification.project.projectNumber}`
    : '';
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // The grouped endpoint triages and collapses over a bounded recent window and
  // is deliberately unpaginated — see routes/notifications/groupedRoutes.ts.
  // Its key sits under queryKeys.notifications so the existing mutations'
  // prefix invalidation already refreshes it.
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: [...queryKeys.notifications, 'grouped'],
    queryFn: () => apiFetch<GroupedNotificationsResponse>(GROUPED_NOTIFICATIONS_URL),
    refetchInterval: 60000,
  });

  const groups = data?.groups ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const visibleGroups = groups.filter((group) => matchesFilter(group, filter));

  const invalidateNotifications = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
  };

  /**
   * Marks EXACTLY the ids passed in — the members this group had when it was
   * rendered. Deliberately not a "mark everything matching this group" call:
   * a server-side predicate would also swallow notifications that arrived
   * between render and click.
   */
  const markReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) =>
      Promise.all(
        notificationIds.map((id) => apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' })),
      ),
    onSuccess: invalidateNotifications,
    onError: createMutationErrorHandler('Failed to mark notification as read'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiFetch('/api/notifications/read-all', { method: 'PUT' }),
    onSuccess: invalidateNotifications,
    onError: createMutationErrorHandler('Failed to mark all notifications as read'),
  });

  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/api/notifications/${notificationId}`, { method: 'DELETE' }),
    onSuccess: invalidateNotifications,
    onError: createMutationErrorHandler('Failed to delete notification'),
  });

  const toggleExpanded = (key: string) => {
    setExpandedKeys((keys) =>
      keys.includes(key) ? keys.filter((entry) => entry !== key) : [...keys, key],
    );
  };

  const handleOpenGroup = (group: NotificationGroup) => {
    const latest = group.notifications[0];
    const safeLinkUrl = getSafeInternalPath(latest.linkUrl);

    const unreadIds = unreadIdsIn(group);
    if (unreadIds.length > 0) {
      markReadMutation.mutate(unreadIds);
    }

    if (safeLinkUrl) {
      navigate(safeLinkUrl);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review project alerts, mentions, and workflow updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button
            onClick={() => markAllReadMutation.mutate()}
            disabled={unreadCount === 0 || markAllReadMutation.isLoading}
          >
            Mark all as read
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap gap-2 border-b p-3">
          {(['all', 'unread', 'mention', 'alert'] as const).map((nextFilter) => (
            <button
              key={nextFilter}
              onClick={() => setFilter(nextFilter)}
              aria-pressed={filter === nextFilter}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                filter === nextFilter
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {nextFilter === 'mention'
                ? '@Mentions'
                : nextFilter === 'alert'
                  ? 'Alerts'
                  : nextFilter}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading notifications...
          </div>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-sm text-destructive">
            <p>Notifications could not be loaded.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void refetch()}
            >
              Try again
            </Button>
          </div>
        ) : visibleGroups.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">No notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === 'all'
                ? 'You are caught up.'
                : `No ${getFilterLabel(filter)} notifications match this view.`}
            </p>
          </div>
        ) : (
          SECTIONS.map(({ category, label, hint }) => {
            const sectionGroups = visibleGroups.filter((group) => group.category === category);
            if (sectionGroups.length === 0) return null;

            return (
              <section key={category} aria-label={label}>
                <div className="flex items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-2">
                  <h2 className="text-sm font-semibold">
                    {label}{' '}
                    <span className="font-normal text-muted-foreground">
                      ({sectionGroups.length})
                    </span>
                  </h2>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </div>
                <ul className="divide-y">
                  {sectionGroups.map((group) => (
                    <NotificationGroupRow
                      key={group.key}
                      group={group}
                      isExpanded={expandedKeys.includes(group.key)}
                      onToggleExpanded={() => toggleExpanded(group.key)}
                      onOpen={() => handleOpenGroup(group)}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      isDeleting={deleteMutation.isLoading}
                    />
                  ))}
                </ul>
              </section>
            );
          })
        )}

        {data?.truncated && (
          <div className="border-t p-3 text-center text-xs text-muted-foreground">
            Showing recent notifications (latest {data.windowSize}). Older notifications are not
            grouped here.
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationGroupRow({
  group,
  isExpanded,
  onToggleExpanded,
  onOpen,
  onDelete,
  isDeleting,
}: {
  group: NotificationGroup;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onOpen: () => void;
  onDelete: (notificationId: string) => void;
  isDeleting: boolean;
}) {
  const latest = group.notifications[0];
  const count = group.notifications.length;
  const isCollapsedGroup = count > 1;
  const isUnread = group.category !== 'read';

  return (
    <li className={`px-4 py-3 ${isUnread ? 'bg-primary/5' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="mt-1 flex-shrink-0">{getNotificationIcon(group.type)}</span>
        {/* The text runs the full width of the card. It used to share the row
            with an 8px unread dot and the delete icon, which reserved a ~90px
            gutter and starved the title to ~215px on a phone — three-line titles
            and date tokens split mid-value. The dot is now inline before the
            title and delete sits in the meta row. */}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={onOpen} className="block w-full text-left">
            <span className="flex items-start gap-2">
              {isUnread && (
                <span
                  className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1 font-medium">
                {stripProjectEcho(latest.title, latest.project?.name)}
                {isCollapsedGroup && (
                  <span className="ml-2 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    ×{count}
                  </span>
                )}
              </span>
            </span>
            {latest.message && (
              <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                {latest.message}
              </span>
            )}
          </button>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {isCollapsedGroup ? 'latest ' : ''}
              {formatRelativeTime(latest.createdAt)}
              {formatProjectMeta(latest)}
            </span>
            {isCollapsedGroup ? (
              <button
                type="button"
                onClick={onToggleExpanded}
                aria-expanded={isExpanded}
                className="-my-2 -mr-2 flex h-11 flex-shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? 'Hide' : `Show all ${count}`}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Delete notification"
                title="Delete notification"
                onClick={() => onDelete(latest.id)}
                disabled={isDeleting}
                className="-my-2 -mr-2 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {isCollapsedGroup && isExpanded && (
        <GroupMembers group={group} onDelete={onDelete} isDeleting={isDeleting} />
      )}
    </li>
  );
}

/** The individual notifications behind a collapsed group, newest first. */
function GroupMembers({
  group,
  onDelete,
  isDeleting,
}: {
  group: NotificationGroup;
  onDelete: (notificationId: string) => void;
  isDeleting: boolean;
}) {
  return (
    <ul className="mt-2 space-y-1 border-l pl-4">
      {group.notifications.map((notification) => (
        <li key={notification.id} className="flex items-center justify-between gap-2 py-1">
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {formatRelativeTime(notification.createdAt)}
            {notification.message ? ` · ${notification.message}` : ''}
          </span>
          <button
            type="button"
            aria-label="Delete notification"
            title="Delete notification"
            onClick={() => onDelete(notification.id)}
            disabled={isDeleting}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

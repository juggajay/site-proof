import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Bell, CheckCircle, Clock, Settings, Trash2, User } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { createMutationErrorHandler } from '@/lib/errorHandling';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/button';

interface Notification {
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

type NotificationFilter = 'all' | 'unread' | 'mention' | 'alert';

interface NotificationsPage {
  notifications: Notification[];
  unreadCount: number;
}

const NOTIFICATIONS_PAGE_LIMIT = 100;

function buildNotificationsRequestUrl(offset: number, unreadOnly: boolean): string {
  const params = new URLSearchParams({
    limit: String(NOTIFICATIONS_PAGE_LIMIT),
    offset: String(offset),
  });
  if (unreadOnly) {
    params.set('unreadOnly', 'true');
  }
  return `/api/notifications?${params.toString()}`;
}

function getSafeInternalPath(linkUrl: string | null): string | null {
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

function getFilterLabel(filter: NotificationFilter): string {
  if (filter === 'mention') return 'mention';
  if (filter === 'alert') return 'alert';
  return filter;
}

function matchesFilter(notification: Notification, filter: NotificationFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unread') return !notification.isRead;

  const type = notification.type.toLowerCase();
  if (filter === 'alert') {
    return type === 'warning' || type.includes('alert');
  }
  return type === filter;
}

function formatRelativeTime(timestamp: string): string {
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

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  // The 'unread' tab is pushed down to the server (the backend supports
  // limit/offset/unreadOnly). 'mention'/'alert' are type filters with no
  // server-side equivalent, so they stay client-side over the loaded pages.
  const serverUnreadOnly = filter === 'unread';

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: [...queryKeys.notifications, { unreadOnly: serverUnreadOnly }],
      queryFn: ({ pageParam = 0 }) =>
        apiFetch<NotificationsPage>(buildNotificationsRequestUrl(pageParam, serverUnreadOnly)),
      // A full page implies there may be more; the next page starts after every
      // row we have already loaded.
      getNextPageParam: (lastPage, allPages) =>
        lastPage.notifications.length === NOTIFICATIONS_PAGE_LIMIT
          ? allPages.length * NOTIFICATIONS_PAGE_LIMIT
          : undefined,
      refetchInterval: 60000,
    });

  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;
  const filteredNotifications = notifications.filter((notification) =>
    matchesFilter(notification, filter),
  );

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
    },
    onError: createMutationErrorHandler('Failed to mark notification as read'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiFetch('/api/notifications/read-all', { method: 'PUT' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
    },
    onError: createMutationErrorHandler('Failed to mark all notifications as read'),
  });

  const deleteMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiFetch(`/api/notifications/${notificationId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount });
    },
    onError: createMutationErrorHandler('Failed to delete notification'),
  });

  const handleOpenNotification = (notification: Notification) => {
    const safeLinkUrl = getSafeInternalPath(notification.linkUrl);

    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
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
        ) : filteredNotifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold">No notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === 'all'
                ? 'You are caught up.'
                : hasNextPage
                  ? `No ${getFilterLabel(filter)} notifications in the loaded results. Load more to keep searching.`
                  : `No ${getFilterLabel(filter)} notifications match this view.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {filteredNotifications.map((notification) => (
              <li
                key={notification.id}
                className={`flex items-stretch ${notification.isRead ? '' : 'bg-primary/5'}`}
              >
                <button
                  type="button"
                  onClick={() => handleOpenNotification(notification)}
                  className="flex min-w-0 flex-1 items-start gap-4 px-4 py-4 text-left hover:bg-muted/60"
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">{notification.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </span>
                    {notification.message && (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {notification.message}
                      </span>
                    )}
                    {notification.project && (
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {notification.project.name} · {notification.project.projectNumber}
                      </span>
                    )}
                  </span>
                  {!notification.isRead && (
                    <span className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Delete notification"
                  title="Delete notification"
                  onClick={() => deleteMutation.mutate(notification.id)}
                  disabled={deleteMutation.isLoading}
                  className="flex flex-shrink-0 items-center px-4 text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {hasNextPage && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

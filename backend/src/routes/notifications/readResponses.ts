export function buildNotificationsListResponse<TNotification>(
  notifications: TNotification[],
  unreadCount: number,
) {
  return {
    notifications,
    unreadCount,
  };
}

export function buildUnreadCountResponse(count: number) {
  return { count };
}

export function buildNotificationReadResponse<TNotification>(notification: TNotification) {
  return { notification };
}

export function buildNotificationSuccessResponse() {
  return { success: true };
}

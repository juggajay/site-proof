import { describe, expect, it } from 'vitest';
import {
  buildNotificationReadResponse,
  buildNotificationSuccessResponse,
  buildNotificationsListResponse,
  buildUnreadCountResponse,
} from './readResponses.js';

describe('notification read response helpers', () => {
  it('preserves the notifications list response shape', () => {
    const notifications = [{ id: 'notification-1', isRead: false }];

    expect(buildNotificationsListResponse(notifications, 7)).toEqual({
      notifications,
      unreadCount: 7,
    });
  });

  it('preserves the unread-count response shape', () => {
    expect(buildUnreadCountResponse(3)).toEqual({ count: 3 });
  });

  it('wraps the updated notification after mark-read', () => {
    const notification = { id: 'notification-2', isRead: true };

    expect(buildNotificationReadResponse(notification)).toEqual({ notification });
  });

  it('preserves success-only responses for read-all and delete actions', () => {
    expect(buildNotificationSuccessResponse()).toEqual({ success: true });
  });
});

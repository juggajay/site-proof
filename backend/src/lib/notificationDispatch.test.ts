import { describe, expect, it, vi } from 'vitest';

import {
  buildNotificationCreateData,
  createNotification,
  createNotificationsForRecipients,
  dedupeRecipientIds,
  dispatchNotificationPush,
} from './notificationDispatch.js';

describe('buildNotificationCreateData', () => {
  it('passes through the provided fields', () => {
    expect(
      buildNotificationCreateData({
        userId: 'user-1',
        projectId: 'project-1',
        type: 'mention',
        title: 'You were mentioned',
        message: 'See the comment',
        linkUrl: '/projects/project-1',
      }),
    ).toEqual({
      userId: 'user-1',
      projectId: 'project-1',
      type: 'mention',
      title: 'You were mentioned',
      message: 'See the comment',
      linkUrl: '/projects/project-1',
    });
  });

  it('defaults the optional nullable columns to null', () => {
    expect(
      buildNotificationCreateData({ userId: 'user-1', type: 'role_change', title: 'Role changed' }),
    ).toEqual({
      userId: 'user-1',
      projectId: null,
      type: 'role_change',
      title: 'Role changed',
      message: null,
      linkUrl: null,
    });
  });
});

describe('dedupeRecipientIds', () => {
  it('removes duplicates and empty/nullish ids while preserving first-seen order', () => {
    expect(dedupeRecipientIds(['a', 'b', 'a', '', null, undefined, 'c', 'b'])).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns an empty array for no valid recipients', () => {
    expect(dedupeRecipientIds([null, undefined, ''])).toEqual([]);
  });
});

describe('createNotification', () => {
  it('writes a single notification through the provided client', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'n1' });
    const client = { notification: { create } } as never;

    await createNotification(
      { userId: 'user-1', type: 'team_invitation', title: 'Invited', projectId: 'p1' },
      client,
    );

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        projectId: 'p1',
        type: 'team_invitation',
        title: 'Invited',
        message: null,
        linkUrl: null,
      },
    });
  });
});

describe('createNotificationsForRecipients', () => {
  it('creates one notification per unique recipient', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const client = { notification: { createMany } } as never;

    const result = await createNotificationsForRecipients(
      ['a', 'a', 'b'],
      { type: 'hold_point_released', title: 'Released', projectId: 'p1', linkUrl: '/x' },
      client,
    );

    expect(result).toEqual({ count: 2 });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'a',
          projectId: 'p1',
          type: 'hold_point_released',
          title: 'Released',
          message: null,
          linkUrl: '/x',
        },
        {
          userId: 'b',
          projectId: 'p1',
          type: 'hold_point_released',
          title: 'Released',
          message: null,
          linkUrl: '/x',
        },
      ],
    });
  });

  it('does not touch the database when there are no recipients', async () => {
    const createMany = vi.fn();
    const client = { notification: { createMany } } as never;

    const result = await createNotificationsForRecipients(
      [null, ''],
      { type: 't', title: 'T' },
      client,
    );

    expect(result).toEqual({ count: 0 });
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('dispatchNotificationPush (G4 web-push fan-out)', () => {
  it('sends a push with the notification mapped to the push payload', async () => {
    const send = vi.fn().mockResolvedValue({ success: true, sent: 1, failed: 0 });

    await dispatchNotificationPush(
      { userId: 'user-1', title: 'Released', message: 'HP-1 released', linkUrl: '/projects/p1' },
      send,
    );

    expect(send).toHaveBeenCalledWith('user-1', {
      title: 'Released',
      body: 'HP-1 released',
      url: '/projects/p1',
    });
  });

  it('falls back to the title for the body and omits a missing url', async () => {
    const send = vi.fn().mockResolvedValue({ success: false, sent: 0, failed: 0 });

    await dispatchNotificationPush({ userId: 'user-1', title: 'Role Changed' }, send);

    expect(send).toHaveBeenCalledWith('user-1', {
      title: 'Role Changed',
      body: 'Role Changed',
      url: undefined,
    });
  });

  it('never throws when the push sender fails (best-effort)', async () => {
    const send = vi.fn().mockRejectedValue(new Error('push transport down'));

    await expect(
      dispatchNotificationPush({ userId: 'user-1', title: 'X', message: 'Y' }, send),
    ).resolves.toBeUndefined();
  });
});

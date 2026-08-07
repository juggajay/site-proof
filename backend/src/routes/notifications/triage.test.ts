import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_TRIAGE,
  groupNotifications,
  notificationEntityKey,
  triageCategory,
  type GroupableNotification,
} from './triage.js';

let sequence = 0;

function notification(overrides: Partial<GroupableNotification> = {}): GroupableNotification {
  sequence += 1;
  return {
    id: `n${sequence}`,
    type: 'alert_escalation',
    isRead: false,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    linkUrl: '/projects/p1/diary',
    projectId: 'p1',
    ...overrides,
  };
}

describe('triageCategory', () => {
  it('puts read notifications in Read regardless of type', () => {
    expect(triageCategory({ type: 'alert_escalation', isRead: true })).toBe('read');
    expect(triageCategory({ type: 'claim_paid', isRead: true })).toBe('read');
  });

  it('splits unread notifications by the curated map', () => {
    expect(triageCategory({ type: 'alert_escalation', isRead: false })).toBe('needs_action');
    expect(triageCategory({ type: 'claim_paid', isRead: false })).toBe('fyi');
  });

  it('shows an unclassified type rather than hiding it', () => {
    expect(triageCategory({ type: 'not_in_the_map_yet', isRead: false })).toBe('fyi');
  });

  it('classifies every type as exactly needs_action or fyi', () => {
    for (const [type, category] of Object.entries(NOTIFICATION_TRIAGE)) {
      expect([type, category]).toEqual([type, expect.stringMatching(/^(needs_action|fyi)$/)]);
    }
  });
});

describe('notificationEntityKey', () => {
  it('keeps query parameters, because links.ts puts entity ids there', () => {
    expect(notificationEntityKey('/projects/p1/ncr?ncr=abc')).toBe('/projects/p1/ncr?ncr=abc');
    expect(notificationEntityKey('/projects/p1/ncr?ncr=xyz')).not.toBe(
      notificationEntityKey('/projects/p1/ncr?ncr=abc'),
    );
  });

  it('normalises parameter order and drops the fragment', () => {
    expect(notificationEntityKey('/projects/p1/tests?test=t1&tab=results#row-4')).toBe(
      notificationEntityKey('/projects/p1/tests?tab=results&test=t1'),
    );
  });

  it('returns null for links that identify nothing', () => {
    expect(notificationEntityKey(null)).toBeNull();
    expect(notificationEntityKey('')).toBeNull();
    expect(notificationEntityKey('   ')).toBeNull();
    expect(notificationEntityKey('/dashboard')).toBeNull();
    expect(notificationEntityKey('/subcontractor-portal')).toBeNull();
    expect(notificationEntityKey('/projects/p1')).toBeNull();
  });

  it('returns null for anything that is not an internal absolute path', () => {
    expect(notificationEntityKey('https://evil.example/projects/p1/diary')).toBeNull();
    expect(notificationEntityKey('//evil.example/projects/p1/diary')).toBeNull();
  });
});

describe('groupNotifications', () => {
  it('collapses repeats of the same alert on the same entity', () => {
    const groups = groupNotifications([
      notification({ id: 'a', createdAt: new Date('2026-08-05T10:00:00.000Z') }),
      notification({ id: 'b', createdAt: new Date('2026-08-04T10:00:00.000Z') }),
      notification({ id: 'c', createdAt: new Date('2026-08-03T10:00:00.000Z') }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].notifications.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    // Newest member is the one the row summarises.
    expect(groups[0].notifications[0].id).toBe('a');
  });

  it('never merges different entities behind the same path', () => {
    const groups = groupNotifications([
      notification({ id: 'ncr1', linkUrl: '/projects/p1/ncr?ncr=one' }),
      notification({ id: 'ncr2', linkUrl: '/projects/p1/ncr?ncr=two' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('never merges across projects', () => {
    const groups = groupNotifications([
      notification({ id: 'p1', projectId: 'p1', linkUrl: '/projects/p1/diary' }),
      notification({ id: 'p2', projectId: 'p2', linkUrl: '/projects/p2/diary' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('never merges different types', () => {
    const groups = groupNotifications([
      notification({ id: 'a', type: 'alert_escalation' }),
      notification({ id: 'b', type: 'diary_reminder' }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('never merges read with unread', () => {
    const groups = groupNotifications([
      notification({ id: 'unread', isRead: false }),
      notification({ id: 'read', isRead: true }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.category)).toEqual(['needs_action', 'read']);
  });

  it('leaves null and generic linkUrl rows ungrouped, one row each', () => {
    const groups = groupNotifications([
      notification({ id: 'a', linkUrl: null }),
      notification({ id: 'b', linkUrl: null }),
      notification({ id: 'c', linkUrl: '/dashboard' }),
      notification({ id: 'd', linkUrl: '/projects/p1' }),
    ]);

    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.notifications.length === 1)).toBe(true);
  });

  it('orders needs-action first, then FYI, then read', () => {
    const groups = groupNotifications([
      notification({ id: 'read', isRead: true, linkUrl: '/projects/p1/diary' }),
      notification({ id: 'fyi', type: 'claim_paid', linkUrl: '/projects/p1/claims?claim=c1' }),
      notification({ id: 'action', type: 'mention', linkUrl: '/projects/p1/lots/l1' }),
    ]);

    expect(groups.map((group) => group.notifications[0].id)).toEqual(['action', 'fyi', 'read']);
    expect(groups.map((group) => group.category)).toEqual(['needs_action', 'fyi', 'read']);
  });

  it('orders groups within a category by their newest member', () => {
    const groups = groupNotifications([
      notification({
        id: 'older',
        linkUrl: '/projects/p1/lots/l1',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
      notification({
        id: 'newer',
        linkUrl: '/projects/p1/lots/l2',
        createdAt: new Date('2026-08-06T00:00:00.000Z'),
      }),
    ]);

    expect(groups.map((group) => group.notifications[0].id)).toEqual(['newer', 'older']);
  });

  it('gives every group a stable, distinct key', () => {
    const groups = groupNotifications([
      notification({ id: 'a', linkUrl: '/projects/p1/lots/l1' }),
      notification({ id: 'b', linkUrl: '/projects/p1/lots/l2' }),
      notification({ id: 'c', linkUrl: null }),
    ]);

    const keys = groups.map((group) => group.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

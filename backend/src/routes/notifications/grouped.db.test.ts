/**
 * DB-backed coverage for GET /api/notifications/grouped, plus a characterization
 * test proving the pre-existing GET /api/notifications response shape did NOT
 * change — other consumers (subcontractor dashboards, badge counts) read it.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

import { notificationsRouter } from '../notifications.js';
import { authRouter } from '../auth.js';
import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { GROUPED_NOTIFICATION_WINDOW } from './groupedRoutes.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/notifications', notificationsRouter);
app.use(errorHandler);

interface GroupedResponse {
  groups: {
    key: string;
    type: string;
    category: 'needs_action' | 'fyi' | 'read';
    notifications: { id: string; title: string; createdAt: string }[];
  }[];
  unreadCount: number;
  windowSize: number;
  truncated: boolean;
}

describe('GET /api/notifications/grouped', () => {
  let token: string;
  let userId: string;
  let companyId: string;
  let projectId: string;
  let otherProjectId: string;

  const at = (isoDay: string) => new Date(`2026-08-${isoDay}T02:00:00.000Z`);

  async function seed(
    rows: {
      type: string;
      title: string;
      linkUrl: string | null;
      createdAt: Date;
      isRead?: boolean;
      projectId?: string | null;
    }[],
  ) {
    for (const row of rows) {
      await prisma.notification.create({
        data: {
          userId,
          projectId: row.projectId === undefined ? projectId : row.projectId,
          type: row.type,
          title: row.title,
          message: null,
          linkUrl: row.linkUrl,
          isRead: row.isRead ?? false,
          createdAt: row.createdAt,
        },
      });
    }
  }

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { name: `Grouped Notifications Co ${Date.now()}` },
    });
    companyId = company.id;

    const user = await registerTestUser(app, {
      emailPrefix: 'grouped-notifications',
      fullName: 'Grouped Notifications User',
      companyId,
      roleInCompany: 'admin',
    });
    token = user.token;
    userId = user.userId;

    const project = await prisma.project.create({
      data: {
        name: `Grouped Project ${Date.now()}`,
        projectNumber: `GRP-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    projectId = project.id;

    const other = await prisma.project.create({
      data: {
        name: `Grouped Project B ${Date.now()}`,
        projectNumber: `GRPB-${Date.now()}`,
        companyId,
        status: 'active',
        state: 'NSW',
        specificationSet: 'TfNSW',
      },
    });
    otherProjectId = other.id;

    await prisma.projectUser.createMany({
      data: [
        { projectId, userId, role: 'admin', status: 'active' },
        { projectId: otherProjectId, userId, role: 'admin', status: 'active' },
      ],
    });

    await seed([
      // Five identical escalations on one entity — the defect this collapses.
      {
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${projectId}/diary`,
        createdAt: at('05'),
      },
      {
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${projectId}/diary`,
        createdAt: at('04'),
      },
      {
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${projectId}/diary`,
        createdAt: at('03'),
      },
      {
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${projectId}/diary`,
        createdAt: at('02'),
      },
      {
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${projectId}/diary`,
        createdAt: at('01'),
      },
      // Two escalations on DIFFERENT NCRs — same path, different query id.
      {
        type: 'alert_escalation',
        title: 'ESCALATED: NCR one',
        linkUrl: `/projects/${projectId}/ncr?ncr=one`,
        createdAt: at('06'),
      },
      {
        type: 'alert_escalation',
        title: 'ESCALATED: NCR two',
        linkUrl: `/projects/${projectId}/ncr?ncr=two`,
        createdAt: at('06'),
      },
      // Same type + same relative path but a different project.
      {
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${otherProjectId}/diary`,
        createdAt: at('07'),
        projectId: otherProjectId,
      },
      // FYI, read, and two ungroupable rows.
      {
        type: 'claim_paid',
        title: 'Claim paid',
        linkUrl: `/projects/${projectId}/claims?claim=c1`,
        createdAt: at('08'),
      },
      {
        type: 'alert_escalation',
        title: 'Already opened',
        linkUrl: `/projects/${projectId}/diary`,
        createdAt: at('09'),
        isRead: true,
      },
      { type: 'claim_paid', title: 'No link A', linkUrl: null, createdAt: at('10') },
      { type: 'claim_paid', title: 'No link B', linkUrl: null, createdAt: at('11') },
    ]);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.projectUser.deleteMany({ where: { userId } });
    await prisma.project.deleteMany({ where: { companyId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
  });

  async function fetchGrouped(): Promise<GroupedResponse> {
    const res = await request(app)
      .get('/api/notifications/grouped')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body as GroupedResponse;
  }

  it('requires authentication', async () => {
    const res = await request(app).get('/api/notifications/grouped');
    expect(res.status).toBe(401);
  });

  it('collapses repeated alerts on one entity into a single group', async () => {
    const body = await fetchGrouped();
    const diaryGroup = body.groups.find(
      (group) =>
        group.notifications[0].title === 'ESCALATED: Missing Daily Diary' &&
        group.notifications.length > 1,
    );

    expect(diaryGroup).toBeDefined();
    expect(diaryGroup!.notifications).toHaveLength(5);
    expect(diaryGroup!.category).toBe('needs_action');
    // Newest first — the row's "latest" timestamp.
    expect(new Date(diaryGroup!.notifications[0].createdAt).toISOString()).toBe(
      at('05').toISOString(),
    );
  });

  it('never merges different entities behind the same path', async () => {
    const body = await fetchGrouped();
    const ncrGroups = body.groups.filter((group) =>
      group.notifications[0].title.startsWith('ESCALATED: NCR'),
    );

    expect(ncrGroups).toHaveLength(2);
    expect(ncrGroups.every((group) => group.notifications.length === 1)).toBe(true);
  });

  it('never merges the same alert across projects', async () => {
    const body = await fetchGrouped();
    const diaryGroups = body.groups.filter(
      (group) =>
        group.notifications[0].title === 'ESCALATED: Missing Daily Diary' &&
        group.category === 'needs_action',
    );

    // One group of five in project A, one group of one in project B.
    expect(diaryGroups.map((group) => group.notifications.length).sort()).toEqual([1, 5]);
  });

  it('leaves null-linkUrl rows ungrouped', async () => {
    const body = await fetchGrouped();
    const noLinkGroups = body.groups.filter((group) =>
      group.notifications[0].title.startsWith('No link'),
    );

    expect(noLinkGroups).toHaveLength(2);
    expect(noLinkGroups.every((group) => group.notifications.length === 1)).toBe(true);
  });

  it('orders needs-action groups before FYI and read, and reports the window', async () => {
    const body = await fetchGrouped();
    const categories = body.groups.map((group) => group.category);
    const rank = { needs_action: 0, fyi: 1, read: 2 } as const;

    expect(categories).toEqual([...categories].sort((a, b) => rank[a] - rank[b]));
    expect(categories).toContain('read');
    expect(body.windowSize).toBe(GROUPED_NOTIFICATION_WINDOW);
    expect(body.truncated).toBe(false);
  });

  it('agrees with the unread count the bell badge reads', async () => {
    const body = await fetchGrouped();
    const countRes = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);

    expect(body.unreadCount).toBe(countRes.body.count);
    // And with the members it actually returned (nothing unread is hidden).
    const unreadMembers = body.groups
      .filter((group) => group.category !== 'read')
      .reduce((total, group) => total + group.notifications.length, 0);
    expect(unreadMembers).toBe(body.unreadCount);
  });

  it('marks exactly the ids a group held, leaving a newer arrival unread', async () => {
    const before = await fetchGrouped();
    const target = before.groups.find((group) => group.notifications.length === 5)!;
    const capturedIds = target.notifications.map((notification) => notification.id);

    // A sixth escalation lands on the same entity AFTER the group was rendered.
    const latecomer = await prisma.notification.create({
      data: {
        userId,
        projectId,
        type: 'alert_escalation',
        title: 'ESCALATED: Missing Daily Diary',
        linkUrl: `/projects/${projectId}/diary`,
        isRead: false,
        createdAt: at('12'),
      },
    });

    for (const id of capturedIds) {
      const res = await request(app)
        .put(`/api/notifications/${id}/read`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    }

    const stillUnread = await prisma.notification.findUnique({ where: { id: latecomer.id } });
    expect(stillUnread!.isRead).toBe(false);

    const markedRead = await prisma.notification.count({
      where: { id: { in: capturedIds }, isRead: true },
    });
    expect(markedRead).toBe(capturedIds.length);

    // Restore for any later test in this file.
    await prisma.notification.delete({ where: { id: latecomer.id } });
    await prisma.notification.updateMany({
      where: { id: { in: capturedIds } },
      data: { isRead: false },
    });
  });

  it('leaves the existing list endpoint response shape unchanged', async () => {
    // Characterization: the keys other consumers read. Adding a key here means
    // the old endpoint changed — which this PR must not do.
    const res = await request(app)
      .get('/api/notifications?limit=5&offset=0')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['notifications', 'unreadCount']);
    expect(Object.keys(res.body.notifications[0]).sort()).toEqual([
      'createdAt',
      'id',
      'isRead',
      'linkUrl',
      'message',
      'project',
      'projectId',
      'title',
      'type',
      'userId',
    ]);
    expect(typeof res.body.unreadCount).toBe('number');
    // Still paginated exactly as before; the grouped endpoint did not touch it.
    expect(res.body.notifications).toHaveLength(5);
  });
});

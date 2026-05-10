import { afterEach, describe, expect, it, vi } from 'vitest';
import * as email from './email.js';
import { clearEmailQueue, getQueuedEmails } from './email.js';
import {
  processAlertEscalations,
  processDocketBacklogAlerts,
  processDueDiaryReminders,
  processSystemAlerts,
} from './notificationAutomation.js';
import { prisma } from './prisma.js';

type AutomationUser = {
  id: string;
  email: string;
};

type AutomationFixture = {
  companyId: string;
  projectId: string;
  users: AutomationUser[];
};

async function createAutomationFixture(
  projectRoles: Array<{ role: string; companyRole?: string; label: string }>,
): Promise<AutomationFixture & { projectName: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const company = await prisma.company.create({
    data: {
      name: `Notification Automation Company ${suffix}`,
      subscriptionTier: 'professional',
    },
  });
  const project = await prisma.project.create({
    data: {
      name: `Notification Automation Project ${suffix}`,
      projectNumber: `NJA-${suffix}`,
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
      workingHoursEnd: '17:00',
      workingDays: '1,2,3,4,5',
    },
  });

  const users: AutomationUser[] = [];
  for (const projectRole of projectRoles) {
    const user = await prisma.user.create({
      data: {
        email: `notification-automation-${projectRole.label}-${suffix}@example.com`,
        passwordHash: 'hash',
        fullName: `Automation ${projectRole.label}`,
        companyId: company.id,
        roleInCompany: projectRole.companyRole ?? 'member',
        emailVerified: true,
      },
    });
    users.push({ id: user.id, email: user.email });
    await prisma.projectUser.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: projectRole.role,
        status: 'active',
      },
    });
  }

  return {
    companyId: company.id,
    projectId: project.id,
    projectName: project.name,
    users,
  };
}

async function cleanupAutomationFixture(fixture: AutomationFixture): Promise<void> {
  const userIds = fixture.users.map((user) => user.id);
  await prisma.notificationDigestItem.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.notificationEmailPreference.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.project.delete({ where: { id: fixture.projectId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.company.delete({ where: { id: fixture.companyId } }).catch(() => {});
}

afterEach(() => {
  clearEmailQueue();
});

describe('notification automation jobs', () => {
  it('creates daily diary reminders once per project date', async () => {
    const fixture = await createAutomationFixture([
      { role: 'foreman', label: 'foreman' },
      { role: 'project_manager', companyRole: 'admin', label: 'manager' },
    ]);
    const now = new Date(2026, 4, 11, 18, 0, 0, 0);
    const targetDate = new Date(now);
    targetDate.setHours(0, 0, 0, 0);
    const expectedDateKey = targetDate.toISOString().split('T')[0]!;

    try {
      const result = await processDueDiaryReminders({
        now,
        projectIds: [fixture.projectId],
      });

      expect(result.projectsChecked).toBe(1);
      expect(result.remindersCreated).toBe(1);
      expect(result.usersNotified).toBe(2);

      const notifications = await prisma.notification.findMany({
        where: { projectId: fixture.projectId, type: 'diary_reminder' },
      });
      expect(notifications).toHaveLength(2);
      expect(notifications[0]!.message).toContain(expectedDateKey);
      expect(getQueuedEmails()).toHaveLength(2);

      clearEmailQueue();
      const secondRun = await processDueDiaryReminders({
        now,
        projectIds: [fixture.projectId],
      });
      expect(secondRun.remindersCreated).toBe(0);
      expect(secondRun.usersNotified).toBe(0);
      expect(getQueuedEmails()).toHaveLength(0);

      await expect(
        prisma.notification.count({
          where: { projectId: fixture.projectId, type: 'diary_reminder' },
        }),
      ).resolves.toBe(2);
    } finally {
      await cleanupAutomationFixture(fixture);
    }
  });

  it('keeps in-app reminders and counts email delivery failures', async () => {
    const fixture = await createAutomationFixture([
      { role: 'foreman', label: 'foreman' },
      { role: 'project_manager', companyRole: 'admin', label: 'manager' },
    ]);
    const now = new Date(2026, 4, 11, 18, 0, 0, 0);
    const emailSpy = vi.spyOn(email, 'sendNotificationEmail').mockResolvedValue({
      success: false,
      error: 'Email delivery is not configured',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const result = await processDueDiaryReminders({
        now,
        projectIds: [fixture.projectId],
      });

      expect(result.remindersCreated).toBe(1);
      expect(result.inAppCreated).toBe(2);
      expect(result.usersNotified).toBe(2);
      expect(result.emailsSent).toBe(0);
      expect(result.emailsQueued).toBe(0);
      expect(result.emailsFailed).toBe(2);
      await expect(
        prisma.notification.count({
          where: { projectId: fixture.projectId, type: 'diary_reminder' },
        }),
      ).resolves.toBe(2);
      expect(errorSpy).toHaveBeenCalledWith(
        '[Notification Automation] Email delivery failed',
        expect.objectContaining({
          notificationType: 'diaryReminder',
          error: 'Email delivery is not configured',
        }),
      );
    } finally {
      emailSpy.mockRestore();
      errorSpy.mockRestore();
      await cleanupAutomationFixture(fixture);
    }
  });

  it('creates one daily docket backlog alert per project', async () => {
    const fixture = await createAutomationFixture([
      { role: 'foreman', label: 'foreman' },
      { role: 'project_manager', companyRole: 'admin', label: 'manager' },
    ]);
    const now = new Date(2026, 4, 12, 10, 0, 0, 0);
    const subcontractor = await prisma.subcontractorCompany.create({
      data: {
        projectId: fixture.projectId,
        companyName: `Automation Subcontractor ${Date.now()}`,
        status: 'approved',
      },
    });

    await prisma.dailyDocket.create({
      data: {
        projectId: fixture.projectId,
        subcontractorCompanyId: subcontractor.id,
        date: new Date(2026, 4, 9, 0, 0, 0, 0),
        status: 'pending_approval',
        submittedAt: new Date(now.getTime() - 49 * 60 * 60 * 1000),
      },
    });

    try {
      const result = await processDocketBacklogAlerts({
        now,
        projectIds: [fixture.projectId],
      });

      expect(result.overdueDockets).toBe(1);
      expect(result.projectsWithBacklog).toBe(1);
      expect(result.alertsCreated).toBe(1);
      expect(result.usersNotified).toBe(2);
      expect(getQueuedEmails()).toHaveLength(2);

      clearEmailQueue();
      const secondRun = await processDocketBacklogAlerts({
        now,
        projectIds: [fixture.projectId],
      });
      expect(secondRun.overdueDockets).toBe(1);
      expect(secondRun.alertsCreated).toBe(0);
      expect(getQueuedEmails()).toHaveLength(0);

      await expect(
        prisma.notification.count({
          where: { projectId: fixture.projectId, type: 'docket_backlog_alert' },
        }),
      ).resolves.toBe(2);
    } finally {
      await cleanupAutomationFixture(fixture);
    }
  });

  it('assigns system NCR alerts to a deterministic project owner when the NCR has no responsible user', async () => {
    const fixture = await createAutomationFixture([
      { role: 'project_manager', companyRole: 'admin', label: 'manager' },
    ]);
    const manager = fixture.users[0]!;
    const now = new Date(2026, 4, 12, 10, 0, 0, 0);

    await prisma.dailyDiary.create({
      data: {
        projectId: fixture.projectId,
        date: new Date(2026, 4, 11, 0, 0, 0, 0),
        status: 'submitted',
        submittedById: manager.id,
        submittedAt: new Date(2026, 4, 11, 17, 0, 0, 0),
      },
    });
    const ncr = await prisma.nCR.create({
      data: {
        projectId: fixture.projectId,
        ncrNumber: 'NCR-AUTO-001',
        description: 'Unresolved issue past its due date',
        category: 'quality',
        status: 'open',
        raisedById: manager.id,
        dueDate: new Date(2026, 4, 10, 10, 0, 0, 0),
      },
    });

    try {
      const result = await processSystemAlerts({
        now,
        projectIds: [fixture.projectId],
      });

      expect(result.projectsChecked).toBe(1);
      expect(result.overdueNcrAlerts).toBe(1);
      expect(result.missingDiaryAlerts).toBe(0);

      const alert = await prisma.notificationAlert.findFirst({
        where: { projectId: fixture.projectId, type: 'overdue_ncr', entityId: ncr.id },
      });
      expect(alert?.assignedToId).toBe(manager.id);

      await expect(
        prisma.notification.count({
          where: { projectId: fixture.projectId, type: 'alert_overdue_ncr', userId: manager.id },
        }),
      ).resolves.toBe(1);

      const secondRun = await processSystemAlerts({
        now,
        projectIds: [fixture.projectId],
      });
      expect(secondRun.overdueNcrAlerts).toBe(0);
    } finally {
      await cleanupAutomationFixture(fixture);
    }
  });

  it('escalates due unresolved alerts once and notifies escalation recipients', async () => {
    const fixture = await createAutomationFixture([
      { role: 'foreman', label: 'foreman' },
      { role: 'project_manager', companyRole: 'admin', label: 'manager' },
    ]);
    const foreman = fixture.users[0]!;
    const manager = fixture.users[1]!;
    const now = new Date(2026, 4, 12, 12, 0, 0, 0);
    const alert = await prisma.notificationAlert.create({
      data: {
        id: `alert-automation-${Date.now()}`,
        type: 'overdue_ncr',
        severity: 'medium',
        title: 'NCR AUTO is overdue',
        message: 'NCR AUTO has not been closed.',
        entityId: 'ncr-auto-escalation',
        entityType: 'ncr',
        projectId: fixture.projectId,
        assignedToId: foreman.id,
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        escalationLevel: 0,
      },
    });

    try {
      const result = await processAlertEscalations({
        now,
        alertIds: [alert.id],
      });

      expect(result.alertsChecked).toBe(1);
      expect(result.escalated).toBe(1);
      expect(result.usersNotified).toBe(1);
      expect(getQueuedEmails()).toHaveLength(1);

      const updatedAlert = await prisma.notificationAlert.findUnique({ where: { id: alert.id } });
      expect(updatedAlert?.escalationLevel).toBe(1);
      expect(updatedAlert?.escalatedTo).toEqual([manager.id]);

      await expect(
        prisma.notification.count({
          where: { projectId: fixture.projectId, type: 'alert_escalation', userId: manager.id },
        }),
      ).resolves.toBe(1);

      clearEmailQueue();
      const secondRun = await processAlertEscalations({
        now,
        alertIds: [alert.id],
      });
      expect(secondRun.escalated).toBe(0);
      expect(getQueuedEmails()).toHaveLength(0);
    } finally {
      await cleanupAutomationFixture(fixture);
    }
  });
});

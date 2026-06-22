import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearEmailQueue, getQueuedEmails } from './email.js';
import { prisma } from './prisma.js';
import {
  calculateNextScheduledReportRunAt,
  processDueScheduledReports,
} from './scheduledReports.js';

type ScheduledReportProjectOptions = {
  subscriptionTier?: string;
  projectStatus?: string;
};

type DueScheduleOverrides = {
  frequency?: string;
  recipients?: string;
  includeProjectName?: boolean;
};

type FailingScheduleOptions = Omit<DueScheduleOverrides, 'includeProjectName'> & {
  failureCount?: number;
};

type RecipientUserOptions = {
  companyId: string;
  projectId: string;
  roleInCompany?: string;
  projectRole?: string;
  projectUserStatus?: string;
  createProjectMembership?: boolean;
  preferences?: {
    enabled?: boolean;
    scheduledReports?: boolean;
    scheduledReportsTiming?: string;
    dailyDigest?: boolean;
  };
};

type RecipientScheduleFixtureOptions = Omit<RecipientUserOptions, 'companyId' | 'projectId'> & {
  recipients?: (email: string) => string;
};

const SCHEDULE_FAILURE_NOW = new Date(2026, 4, 10, 9, 30, 0, 0);
const SCHEDULE_RETRY_DELAY_MS = 5 * 60 * 1000;

async function createScheduledReportProject({
  subscriptionTier = 'professional',
  projectStatus = 'active',
}: ScheduledReportProjectOptions = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const company = await prisma.company.create({
    data: {
      name: `Scheduled Processor Company ${suffix}`,
      subscriptionTier,
    },
  });
  const project = await prisma.project.create({
    data: {
      name: `Scheduled Processor Project ${suffix}`,
      projectNumber: `SCHPROC-${suffix}`,
      companyId: company.id,
      status: projectStatus,
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });

  return { company, project };
}

async function cleanupProject(projectId: string, companyId: string) {
  await prisma.scheduledReport.deleteMany({ where: { projectId } });
  await prisma.lot.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } }).catch(() => {});
  await prisma.company.delete({ where: { id: companyId } }).catch(() => {});
}

function buildDueScheduleData(
  projectId: string,
  dueAt: Date,
  { frequency = 'daily', recipients = 'recipient@example.com' }: DueScheduleOverrides = {},
) {
  return {
    projectId,
    reportType: 'lot-status',
    frequency,
    timeOfDay: '09:00',
    recipients,
    nextRunAt: dueAt,
    isActive: true,
  };
}

async function expectScheduleNotSent(scheduleId: string, dueAt: Date) {
  const unchangedSchedule = await prisma.scheduledReport.findUnique({
    where: { id: scheduleId },
  });
  expect(unchangedSchedule?.lastSentAt).toBeNull();
  expect(unchangedSchedule?.nextRunAt?.toISOString()).toBe(dueAt.toISOString());
}

async function createDueSchedule(
  projectId: string,
  dueAt: Date,
  { includeProjectName = false, ...overrides }: DueScheduleOverrides = {},
) {
  const data = buildDueScheduleData(projectId, dueAt, overrides);
  if (includeProjectName) {
    return prisma.scheduledReport.create({
      data,
      include: {
        project: {
          select: {
            name: true,
            companyId: true,
            company: { select: { subscriptionTier: true } },
          },
        },
      },
    });
  }

  return prisma.scheduledReport.create({ data });
}

async function createDueScheduleFixture(
  projectOptions: ScheduledReportProjectOptions = {},
  scheduleOptions: DueScheduleOverrides = {},
) {
  const { company, project } = await createScheduledReportProject(projectOptions);
  const now = new Date(2026, 4, 10, 9, 30, 0, 0);
  const dueAt = new Date(now.getTime() - 60_000);
  const schedule = await createDueSchedule(project.id, dueAt, scheduleOptions);

  return { company, project, now, dueAt, schedule };
}

async function createFailingDueSchedule(
  projectId: string,
  { failureCount, ...scheduleOptions }: FailingScheduleOptions = {},
) {
  return prisma.scheduledReport.create({
    data: {
      ...buildDueScheduleData(
        projectId,
        new Date(SCHEDULE_FAILURE_NOW.getTime() - 60_000),
        scheduleOptions,
      ),
      ...(failureCount === undefined ? {} : { failureCount }),
    },
  });
}

function processFailingSchedule(scheduleId: string) {
  return processDueScheduledReports({
    now: SCHEDULE_FAILURE_NOW,
    scheduleIds: [scheduleId],
    retryDelayMs: SCHEDULE_RETRY_DELAY_MS,
  });
}

async function getScheduledReport(scheduleId: string) {
  return prisma.scheduledReport.findUnique({
    where: { id: scheduleId },
  });
}

async function createRecipientUser({
  companyId,
  projectId,
  roleInCompany = 'member',
  projectRole = 'project_manager',
  projectUserStatus = 'active',
  createProjectMembership = true,
  preferences,
}: RecipientUserOptions) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const user = await prisma.user.create({
    data: {
      email: `scheduled-recipient-${suffix}@example.com`,
      fullName: `Scheduled Recipient ${suffix}`,
      companyId,
      roleInCompany,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  if (createProjectMembership) {
    await prisma.projectUser.create({
      data: {
        projectId,
        userId: user.id,
        role: projectRole,
        status: projectUserStatus,
        acceptedAt: projectUserStatus === 'active' ? new Date() : null,
      },
    });
  }

  if (preferences) {
    await prisma.notificationEmailPreference.create({
      data: {
        userId: user.id,
        ...preferences,
      },
    });
  }

  return user;
}

async function createRecipientScheduleFixture({
  recipients,
  ...userOptions
}: RecipientScheduleFixtureOptions) {
  const { company, project } = await createScheduledReportProject();
  const now = new Date(2026, 4, 10, 9, 30, 0, 0);
  const dueAt = new Date(now.getTime() - 60_000);
  const user = await createRecipientUser({
    companyId: company.id,
    projectId: project.id,
    ...userOptions,
  });
  const schedule = await createDueSchedule(project.id, dueAt, {
    recipients: recipients ? recipients(user.email) : user.email,
  });

  return { company, project, now, dueAt, user, schedule };
}

async function cleanupRecipientScheduleFixture({
  company,
  project,
  user,
}: Awaited<ReturnType<typeof createRecipientScheduleFixture>>) {
  await prisma.user.deleteMany({ where: { id: user.id } });
  await cleanupProject(project.id, company.id);
}

function expectSingleSentResult(
  result: Awaited<ReturnType<typeof processDueScheduledReports>>,
  recipients = 1,
) {
  expect(result.processed).toBe(1);
  expect(result.sent).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.results[0]).toMatchObject({ status: 'sent', recipients });
}

function expectQueuedEmailRecipients(recipients: string[]) {
  const queuedEmails = getQueuedEmails();
  expect(queuedEmails).toHaveLength(1);
  expect(queuedEmails[0]!.to).toEqual(recipients);
  return queuedEmails[0]!;
}

function expectSingleSkippedNoEmail(
  result: Awaited<ReturnType<typeof processDueScheduledReports>>,
) {
  expect(result.processed).toBe(1);
  expect(result.sent).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.results[0]).toMatchObject({
    status: 'skipped',
    error: 'No eligible scheduled report recipients',
  });
  expect(getQueuedEmails()).toHaveLength(0);
}

async function expectScheduleAdvanced(scheduleId: string, now: Date, sent: boolean) {
  const updatedSchedule = await getScheduledReport(scheduleId);
  if (sent) {
    expect(updatedSchedule?.lastSentAt?.toISOString()).toBe(now.toISOString());
  } else {
    expect(updatedSchedule?.lastSentAt).toBeNull();
  }
  expect(updatedSchedule?.nextRunAt?.getTime()).toBeGreaterThan(now.getTime());
  return updatedSchedule;
}

function expectFailedDeliveryResult(
  result: Awaited<ReturnType<typeof processDueScheduledReports>>,
  {
    disabled,
    error,
    failureCount,
    nextRunAtIsUndefined = false,
  }: {
    disabled?: number;
    error: string;
    failureCount?: number;
    nextRunAtIsUndefined?: boolean;
  },
) {
  expect(result.processed).toBe(1);
  expect(result.sent).toBe(0);
  expect(result.failed).toBe(1);
  if (disabled !== undefined) {
    expect(result.disabled).toBe(disabled);
  }
  expect(result.results[0]!.error).toContain(error);
  if (failureCount !== undefined) {
    expect(result.results[0]!.failureCount).toBe(failureCount);
  }
  if (nextRunAtIsUndefined) {
    expect(result.results[0]!.nextRunAt).toBeUndefined();
  }
  expect(getQueuedEmails()).toHaveLength(0);
}

async function expectRetriedScheduleState(scheduleId: string, error?: string) {
  const updatedSchedule = await getScheduledReport(scheduleId);
  expect(updatedSchedule?.lastSentAt).toBeNull();
  expect(updatedSchedule?.nextRunAt?.toISOString()).toBe(
    new Date(SCHEDULE_FAILURE_NOW.getTime() + SCHEDULE_RETRY_DELAY_MS).toISOString(),
  );
  if (error) {
    expect(updatedSchedule?.isActive).toBe(true);
    expect(updatedSchedule?.failureCount).toBe(1);
    expect(updatedSchedule?.lastFailureAt?.toISOString()).toBe(SCHEDULE_FAILURE_NOW.toISOString());
    expect(updatedSchedule?.lastFailureReason).toContain(error);
  }
}

async function expectDisabledScheduleState(scheduleId: string, error: string) {
  const updatedSchedule = await getScheduledReport(scheduleId);
  expect(updatedSchedule?.isActive).toBe(false);
  expect(updatedSchedule?.failureCount).toBe(3);
  expect(updatedSchedule?.lastFailureAt?.toISOString()).toBe(SCHEDULE_FAILURE_NOW.toISOString());
  expect(updatedSchedule?.lastFailureReason).toContain(error);
  expect(updatedSchedule?.nextRunAt).toBeNull();
}

async function expectDueScheduleSuppressed(projectOptions: ScheduledReportProjectOptions) {
  const { company, project, now, dueAt, schedule } = await createDueScheduleFixture(projectOptions);
  try {
    const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

    expect(result.sent).toBe(0);
    expect(getQueuedEmails()).toEqual([]);

    await expectScheduleNotSent(schedule.id, dueAt);
  } finally {
    await cleanupProject(project.id, company.id);
  }
}

afterEach(async () => {
  clearEmailQueue();
  if (process.env.DATABASE_URL) {
    await prisma.notificationDigestItem.deleteMany({ where: { type: 'scheduledReports' } });
  }
});

describe('calculateNextScheduledReportRunAt', () => {
  it('schedules daily reports later today or tomorrow', () => {
    const beforeRun = new Date(2026, 4, 10, 8, 0, 0, 0);
    const afterRun = new Date(2026, 4, 10, 10, 0, 0, 0);

    const today = calculateNextScheduledReportRunAt('daily', null, null, '09:00', beforeRun);
    const tomorrow = calculateNextScheduledReportRunAt('daily', null, null, '09:00', afterRun);

    expect(today.getDate()).toBe(10);
    expect(today.getHours()).toBe(9);
    expect(today.getMinutes()).toBe(0);
    expect(tomorrow.getDate()).toBe(11);
    expect(tomorrow.getHours()).toBe(9);
    expect(tomorrow.getMinutes()).toBe(0);
  });

  it('clamps monthly runs to the last day of shorter months', () => {
    const afterJanuaryRun = new Date(2026, 0, 31, 10, 0, 0, 0);
    const nextRun = calculateNextScheduledReportRunAt(
      'monthly',
      null,
      31,
      '09:00',
      afterJanuaryRun,
    );

    expect(nextRun.getFullYear()).toBe(2026);
    expect(nextRun.getMonth()).toBe(1);
    expect(nextRun.getDate()).toBe(28);
    expect(nextRun.getHours()).toBe(9);
    expect(nextRun.getMinutes()).toBe(0);
  });
});

describe('processDueScheduledReports', () => {
  it('claims due schedules, sends a PDF report email, and advances nextRunAt', async () => {
    const { company, project } = await createScheduledReportProject();
    const now = new Date(2026, 4, 10, 9, 30, 0, 0);

    await prisma.lot.create({
      data: {
        projectId: project.id,
        lotNumber: 'LOT-SCHED-001',
        lotType: 'roadworks',
        description: 'Scheduled report lot',
        status: 'conformed',
        activityType: 'Earthworks',
      },
    });

    const schedule = await prisma.scheduledReport.create({
      data: {
        projectId: project.id,
        reportType: 'lot-status',
        frequency: 'daily',
        timeOfDay: '09:00',
        recipients: 'recipient@example.com,second@example.com',
        nextRunAt: new Date(now.getTime() - 60_000),
        isActive: true,
      },
    });

    try {
      clearEmailQueue();

      const result = await processDueScheduledReports({
        now,
        scheduleIds: [schedule.id],
        lockMs: 60_000,
        retryDelayMs: 60_000,
      });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);

      const queuedEmail = expectQueuedEmailRecipients([
        'recipient@example.com',
        'second@example.com',
      ]);
      expect(queuedEmail.subject).toContain('Scheduled Report');
      expect(queuedEmail.text).toContain('View report online:');
      expect(queuedEmail.attachments).toHaveLength(1);
      const attachment = queuedEmail.attachments![0]!;
      expect(attachment.filename).toContain('Lot_Status_Report');
      expect(attachment.contentType).toBe('application/pdf');
      expect(Buffer.isBuffer(attachment.content)).toBe(true);
      expect((attachment.content as Buffer).toString('utf8', 0, 8)).toMatch(/^%PDF-1\./);

      const updatedSchedule = await prisma.scheduledReport.findUnique({
        where: { id: schedule.id },
      });
      expect(updatedSchedule?.lastSentAt?.toISOString()).toBe(now.toISOString());
      expect(updatedSchedule?.nextRunAt?.getTime()).toBeGreaterThan(now.getTime());

      const secondRun = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });
      expect(secondRun.processed).toBe(0);
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('suppresses opted-out app recipients while preserving external recipients', async () => {
    const fixture = await createRecipientScheduleFixture({
      preferences: { scheduledReports: false },
      recipients: (email) => `${email},external-recipient@example.com`,
    });
    const { now, schedule, user } = fixture;

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });
      expectSingleSentResult(result);

      expectQueuedEmailRecipients(['external-recipient@example.com']);

      const digestItems = await prisma.notificationDigestItem.findMany({
        where: { userId: user.id },
      });
      expect(digestItems).toHaveLength(0);

      await expectScheduleAdvanced(schedule.id, now, true);
    } finally {
      await cleanupRecipientScheduleFixture(fixture);
    }
  });

  it('advances the schedule without email when the only known recipient has email disabled', async () => {
    const fixture = await createRecipientScheduleFixture({
      preferences: { enabled: false },
    });
    const { now, schedule } = fixture;

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });
      expectSingleSkippedNoEmail(result);

      const updatedSchedule = await expectScheduleAdvanced(schedule.id, now, false);
      expect(updatedSchedule?.failureCount).toBe(0);
      expect(updatedSchedule?.lastFailureAt).toBeNull();
      expect(updatedSchedule?.lastFailureReason).toBeNull();
    } finally {
      await cleanupRecipientScheduleFixture(fixture);
    }
  });

  it('queues digest items instead of immediate email for digest-timed recipients', async () => {
    const fixture = await createRecipientScheduleFixture({
      preferences: { scheduledReportsTiming: 'digest', dailyDigest: true },
    });
    const { now, project, schedule, user } = fixture;

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });
      expectSingleSentResult(result);
      expect(getQueuedEmails()).toHaveLength(0);

      const digestItems = await prisma.notificationDigestItem.findMany({
        where: { userId: user.id, type: 'scheduledReports' },
      });
      expect(digestItems).toHaveLength(1);
      expect(digestItems[0]).toMatchObject({
        title: `Scheduled report ready: Lot Status Report - ${project.name}`,
        projectName: project.name,
      });
      expect(digestItems[0]!.linkUrl).toContain(
        `/projects/${encodeURIComponent(project.id)}/reports`,
      );

      await expectScheduleAdvanced(schedule.id, now, true);
    } finally {
      await cleanupRecipientScheduleFixture(fixture);
    }
  });

  it('does not send to known recipients who no longer have active project access', async () => {
    const fixture = await createRecipientScheduleFixture({
      projectUserStatus: 'removed',
    });
    const { now, schedule } = fixture;

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });
      expectSingleSkippedNoEmail(result);
      await expectScheduleAdvanced(schedule.id, now, false);
    } finally {
      await cleanupRecipientScheduleFixture(fixture);
    }
  });

  it('sends to same-company admins even without explicit project membership', async () => {
    const fixture = await createRecipientScheduleFixture({
      roleInCompany: 'admin',
      createProjectMembership: false,
    });
    const { now, schedule, user } = fixture;

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });
      expectSingleSentResult(result);

      expectQueuedEmailRecipients([user.email]);
    } finally {
      await cleanupRecipientScheduleFixture(fixture);
    }
  });

  it('does not send due schedules for basic-tier companies', async () => {
    const { company, project, now, schedule } = await createDueScheduleFixture({
      subscriptionTier: 'basic',
    });
    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.results[0]?.error).toContain('Professional or Enterprise');
      expect(getQueuedEmails()).toEqual([]);

      await expectScheduleAdvanced(schedule.id, now, false);
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('normalizes paid tier values before delivering due schedules', async () => {
    const { company, project, now, schedule } = await createDueScheduleFixture({
      subscriptionTier: ' Professional ',
    });

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(1);
      expect(result.failed).toBe(0);
      expect(getQueuedEmails()).toHaveLength(1);
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('does not send due schedules for archived projects', async () => {
    await expectDueScheduleSuppressed({ projectStatus: 'archived' });
  });

  it('does not send if a schedule becomes ineligible after due-schedule selection', async () => {
    const { company, project, now, dueAt, schedule } = await createDueScheduleFixture(
      {},
      { includeProjectName: true },
    );

    const findManySpy = vi
      .spyOn(prisma.scheduledReport, 'findMany')
      .mockResolvedValueOnce([schedule]);

    try {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'archived' },
      });

      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.sent).toBe(0);
      expect(getQueuedEmails()).toHaveLength(0);

      await expectScheduleNotSent(schedule.id, dueAt);
    } finally {
      findManySpy.mockRestore();
      await cleanupProject(project.id, company.id);
    }
  });

  it('retries invalid due schedules without sending email', async () => {
    const { company, project } = await createScheduledReportProject();

    const schedule = await createFailingDueSchedule(project.id, { frequency: 'fortnightly' });

    try {
      const result = await processFailingSchedule(schedule.id);

      expectFailedDeliveryResult(result, { error: 'frequency' });
      await expectRetriedScheduleState(schedule.id);
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('retries schedules with invalid stored recipients without sending email', async () => {
    const { company, project } = await createScheduledReportProject();

    const schedule = await createFailingDueSchedule(project.id, {
      recipients: 'recipient@example.com,not-an-email',
    });

    try {
      const result = await processFailingSchedule(schedule.id);

      expectFailedDeliveryResult(result, {
        disabled: 0,
        error: 'valid email addresses',
        failureCount: 1,
      });
      await expectRetriedScheduleState(schedule.id, 'valid email addresses');
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('disables repeatedly failing schedules instead of retrying forever', async () => {
    const { company, project } = await createScheduledReportProject();

    const schedule = await createFailingDueSchedule(project.id, {
      recipients: 'not-an-email',
      failureCount: 2,
    });

    try {
      const result = await processFailingSchedule(schedule.id);

      expectFailedDeliveryResult(result, {
        disabled: 1,
        error: 'valid email addresses',
        failureCount: 3,
        nextRunAtIsUndefined: true,
      });
      expect(result.results[0]).toMatchObject({
        status: 'disabled',
        failureCount: 3,
      });
      await expectDisabledScheduleState(schedule.id, 'valid email addresses');
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });
});

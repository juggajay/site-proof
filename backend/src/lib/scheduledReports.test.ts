import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as email from './email.js';
import { clearEmailQueue, getQueuedEmails } from './email.js';
import { prisma } from './prisma.js';
import {
  calculateNextScheduledReportRunAt,
  canSendClaimedScheduledReportRecipientDelivery,
  processDueScheduledReports,
} from './scheduledReports.js';
import { calculateScheduledReportArtifactSha256 } from './scheduledReports/artifacts.js';
import { buildScheduledReportDocument } from './scheduledReports/reportDocument.js';
import { resolveUploadPath } from './uploadPaths.js';

type ScheduledReportProjectOptions = {
  subscriptionTier?: string;
  projectStatus?: string;
  projectState?: string;
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
  projectState = 'NSW',
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
      state: projectState,
      specificationSet: 'TfNSW',
    },
  });

  return { company, project };
}

async function cleanupProject(projectId: string, companyId: string) {
  const artifactRuns = await prisma.scheduledReportRun.findMany({
    where: { projectId, artifactFileUrl: { not: null } },
    select: { artifactFileUrl: true },
  });

  await Promise.all(
    artifactRuns.map(async ({ artifactFileUrl }) => {
      if (!artifactFileUrl?.startsWith('uploads/')) return;

      try {
        await fs.promises.unlink(resolveUploadPath(artifactFileUrl, 'scheduled-reports'));
      } catch {
        // Best-effort cleanup for local test artifacts.
      }
    }),
  );

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
  expect(queuedEmails).toHaveLength(recipients.length);
  expect(queuedEmails.map((email) => email.to)).toEqual(recipients);
  for (const queuedEmail of queuedEmails) {
    expect(Array.isArray(queuedEmail.to)).toBe(false);
  }
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
    const beforeRun = new Date('2026-05-10T08:00:00.000Z');
    const afterRun = new Date('2026-05-10T10:00:00.000Z');

    const today = calculateNextScheduledReportRunAt('daily', null, null, '09:00', beforeRun, 'UTC');
    const tomorrow = calculateNextScheduledReportRunAt(
      'daily',
      null,
      null,
      '09:00',
      afterRun,
      'UTC',
    );

    expect(today.toISOString()).toBe('2026-05-10T09:00:00.000Z');
    expect(tomorrow.toISOString()).toBe('2026-05-11T09:00:00.000Z');
  });

  it('schedules reports from the project timezone rather than the server timezone', () => {
    const perthMorning = new Date('2026-06-15T00:30:00.000Z'); // 08:30 in Perth
    const nextRun = calculateNextScheduledReportRunAt(
      'daily',
      null,
      null,
      '09:00',
      perthMorning,
      'Australia/Perth',
    );

    expect(nextRun.toISOString()).toBe('2026-06-15T01:00:00.000Z');
  });

  it('uses the project timezone DST offset for summer schedules', () => {
    const sydneySummerMorning = new Date('2026-01-14T21:00:00.000Z'); // 08:00 AEDT
    const nextRun = calculateNextScheduledReportRunAt(
      'daily',
      null,
      null,
      '09:00',
      sydneySummerMorning,
      'Australia/Sydney',
    );

    expect(nextRun.toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('clamps monthly runs to the last day of shorter months', () => {
    const afterJanuaryRun = new Date('2026-01-31T10:00:00.000Z');
    const nextRun = calculateNextScheduledReportRunAt(
      'monthly',
      null,
      31,
      '09:00',
      afterJanuaryRun,
      'UTC',
    );

    expect(nextRun.toISOString()).toBe('2026-02-28T09:00:00.000Z');
  });
});

describe('processDueScheduledReports', () => {
  it('labels scheduled report row samples with the displayed and total counts', async () => {
    const { company, project } = await createScheduledReportProject();

    try {
      await prisma.lot.createMany({
        data: Array.from({ length: 51 }, (_, index) => ({
          projectId: project.id,
          lotNumber: `LOT-SAMPLE-${String(index + 1).padStart(3, '0')}`,
          lotType: 'roadworks',
          description: `Scheduled report lot ${index + 1}`,
          status: 'conformed',
          activityType: 'Earthworks',
        })),
      });

      const document = await buildScheduledReportDocument(
        {
          id: 'schedule-sample-count',
          projectId: project.id,
          reportType: 'lot-status',
          frequency: 'daily',
          dayOfWeek: null,
          dayOfMonth: null,
          timeOfDay: '09:00',
          recipients: 'recipient@example.com',
          nextRunAt: null,
          failureCount: 0,
          project: {
            name: project.name,
            companyId: company.id,
            company: { subscriptionTier: company.subscriptionTier },
          },
        },
        new Date('2026-06-21T09:30:00.000Z'),
      );

      expect(document.lines).toContain('Lot sample (showing first 50 of 51 lots)');
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

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
      expect(queuedEmail.text).toContain('/reports/scheduled-runs/');
      expect(queuedEmail.text).not.toContain('uploads/scheduled-reports');
      expect(queuedEmail.text).not.toContain('supabase://');
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

  it('refuses to send a claimed delivery after the schedule is paused or deleted', async () => {
    const { company, project, now, schedule } = await createDueScheduleFixture();
    const run = await prisma.scheduledReportRun.create({
      data: {
        scheduleId: schedule.id,
        projectId: project.id,
        reportType: 'lot-status',
        status: 'processing',
        recipientCount: 1,
        generatedAt: now,
      },
    });
    const delivery = await prisma.scheduledReportRecipientDelivery.create({
      data: {
        runId: run.id,
        scheduleId: schedule.id,
        projectId: project.id,
        recipient: 'claimed@example.com',
        recipientKind: 'email',
        status: 'sending',
        retryable: false,
        attemptCount: 1,
        lastAttemptAt: now,
        lockedUntil: new Date(now.getTime() + 60_000),
      },
    });

    try {
      await expect(canSendClaimedScheduledReportRecipientDelivery(delivery.id)).resolves.toBe(true);

      await prisma.scheduledReport.update({
        where: { id: schedule.id },
        data: { isActive: false },
      });
      await expect(canSendClaimedScheduledReportRecipientDelivery(delivery.id)).resolves.toBe(
        false,
      );

      await prisma.scheduledReport.delete({ where: { id: schedule.id } });
      await expect(canSendClaimedScheduledReportRecipientDelivery(delivery.id)).resolves.toBe(
        false,
      );
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('does not resurrect a cancelled run when the schedule changes during provider delivery', async () => {
    const { company, project, now, schedule } = await createDueScheduleFixture();
    const cancellationReason = 'Schedule paused while provider call was in flight';
    const sendSpy = vi.spyOn(email, 'sendScheduledReportEmail').mockImplementation(async () => {
      const activeRun = await prisma.scheduledReportRun.findFirst({
        where: { scheduleId: schedule.id },
        select: { id: true },
      });

      if (!activeRun) {
        throw new Error('Expected scheduled report run to exist before provider send');
      }

      await prisma.scheduledReport.update({
        where: { id: schedule.id },
        data: { isActive: false },
      });
      await prisma.scheduledReportRecipientDelivery.updateMany({
        where: { scheduleId: schedule.id, status: 'sending' },
        data: {
          status: 'cancelled',
          retryable: false,
          lockedUntil: null,
          nextAttemptAt: null,
          errorReason: cancellationReason,
        },
      });
      await prisma.scheduledReportRun.updateMany({
        where: { id: activeRun.id, status: 'processing' },
        data: {
          status: 'cancelled',
          completedAt: now,
          errorReason: cancellationReason,
        },
      });

      return {
        success: true,
        messageId: 'provider-accepted-before-cancellation-was-observed',
        provider: 'mock',
      };
    });

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.results[0]).toMatchObject({
        status: 'skipped',
        error: 'Schedule was cancelled before delivery completed',
      });
      expect(sendSpy).toHaveBeenCalledTimes(1);

      const cancelledRun = await prisma.scheduledReportRun.findFirst({
        where: { scheduleId: schedule.id },
        include: { deliveries: true },
      });
      expect(cancelledRun).toMatchObject({
        status: 'cancelled',
        sentCount: 0,
        failedCount: 0,
        errorReason: cancellationReason,
      });
      expect(cancelledRun?.deliveries[0]).toMatchObject({
        status: 'cancelled',
        retryable: false,
        errorReason: cancellationReason,
      });

      const pausedSchedule = await prisma.scheduledReport.findUnique({
        where: { id: schedule.id },
      });
      expect(pausedSchedule).toMatchObject({
        isActive: false,
        lastSentAt: null,
        failureCount: 0,
      });
    } finally {
      sendSpy.mockRestore();
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
      expect(digestItems[0]!.linkUrl).toContain('/reports/scheduled-runs/');
      expect(digestItems[0]!.linkUrl).toContain('/artifact');

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

  it('advances delivered schedules using the project state timezone', async () => {
    const { company, project } = await createScheduledReportProject({ projectState: 'WA' });
    const now = new Date('2026-06-15T01:30:00.000Z'); // 09:30 in Perth
    const schedule = await createDueSchedule(project.id, new Date(now.getTime() - 60_000), {
      recipients: 'perth-recipient@example.com',
    });

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expectSingleSentResult(result);
      expect(result.results[0]?.nextRunAt).toBe('2026-06-16T01:00:00.000Z');

      const updatedSchedule = await getScheduledReport(schedule.id);
      expect(updatedSchedule?.nextRunAt?.toISOString()).toBe('2026-06-16T01:00:00.000Z');
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('retries only recipients who missed a scheduled report after a partial delivery failure', async () => {
    const { company, project, now, schedule } = await createDueScheduleFixture(
      {},
      { recipients: 'sent-recipient@example.com,failed-recipient@example.com' },
    );
    const sendSpy = vi
      .spyOn(email, 'sendScheduledReportEmail')
      .mockImplementation(async ({ to }) =>
        to === 'failed-recipient@example.com'
          ? { success: false, error: 'temporary provider failure' }
          : { success: true, messageId: 'sent-ok', provider: 'mock' },
      );

    try {
      const result = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]?.status).toBe('failed');
      expect(result.results[0]?.error).toContain('temporary provider failure');
      const firstAttemptRecipients = sendSpy.mock.calls.map(([data]) => data.to);
      expect(firstAttemptRecipients).toHaveLength(2);
      expect(firstAttemptRecipients).toEqual(
        expect.arrayContaining(['sent-recipient@example.com', 'failed-recipient@example.com']),
      );
      const firstAttemptPdf = sendSpy.mock.calls[0]?.[0].pdfBuffer;
      expect(Buffer.isBuffer(firstAttemptPdf)).toBe(true);
      const partiallyDeliveredSchedule = await getScheduledReport(schedule.id);
      expect(partiallyDeliveredSchedule?.lastSentAt).toBeNull();
      expect(partiallyDeliveredSchedule?.failureCount).toBe(1);
      expect(partiallyDeliveredSchedule?.nextRunAt?.getTime()).toBeGreaterThan(now.getTime());
      const partialRun = await prisma.scheduledReportRun.findFirst({
        where: { scheduleId: schedule.id },
        include: { deliveries: { orderBy: { recipient: 'asc' } } },
      });
      expect(partialRun).toMatchObject({
        status: 'partial_failed',
        sentCount: 1,
        failedCount: 1,
      });
      expect(partialRun?.artifactFileUrl).toContain('scheduled-reports');
      expect(partialRun?.artifactReportName).toBe(`Lot Status Report - ${project.name}`);
      expect(partialRun?.artifactFilename).toContain('Lot Status Report');
      expect(partialRun?.artifactFilename).toMatch(/\.pdf$/);
      expect(partialRun?.artifactMimeType).toBe('application/pdf');
      expect(partialRun?.artifactFileSize).toBe((firstAttemptPdf as Buffer).length);
      expect(partialRun?.artifactSha256).toBe(
        calculateScheduledReportArtifactSha256(firstAttemptPdf as Buffer),
      );
      expect(
        partialRun?.deliveries.map((delivery) => ({
          recipient: delivery.recipient,
          status: delivery.status,
          retryable: delivery.retryable,
        })),
      ).toEqual([
        { recipient: 'failed-recipient@example.com', status: 'failed', retryable: true },
        { recipient: 'sent-recipient@example.com', status: 'sent', retryable: false },
      ]);

      await prisma.lot.create({
        data: {
          projectId: project.id,
          lotNumber: 'LOT-CHANGED-BEFORE-RETRY',
          lotType: 'roadworks',
          status: 'conforming',
          activityType: 'Changed live data',
        },
      });

      sendSpy.mockImplementation(async () => ({
        success: true,
        messageId: 'retry-ok',
        provider: 'mock',
      }));
      sendSpy.mockClear();
      const retryNow = partiallyDeliveredSchedule!.nextRunAt!;
      const secondRun = await processDueScheduledReports({
        now: retryNow,
        scheduleIds: [schedule.id],
      });
      expectSingleSentResult(secondRun, 1);
      expect(sendSpy.mock.calls.map(([data]) => data.to)).toEqual(['failed-recipient@example.com']);
      const retryPdf = sendSpy.mock.calls[0]?.[0].pdfBuffer;
      expect(Buffer.isBuffer(retryPdf)).toBe(true);
      expect(Buffer.compare(retryPdf as Buffer, firstAttemptPdf as Buffer)).toBe(0);
      expect(calculateScheduledReportArtifactSha256(retryPdf as Buffer)).toBe(
        partialRun?.artifactSha256,
      );
      expect(sendSpy.mock.calls[0]?.[0].viewReportUrl).toContain(
        `/reports/scheduled-runs/${partialRun?.id}/artifact`,
      );

      const completedSchedule = await getScheduledReport(schedule.id);
      expect(completedSchedule?.lastSentAt?.toISOString()).toBe(retryNow.toISOString());
      expect(completedSchedule?.failureCount).toBe(0);
      const completedRun = await prisma.scheduledReportRun.findFirst({
        where: { scheduleId: schedule.id },
        include: { deliveries: { orderBy: { recipient: 'asc' } } },
      });
      expect(completedRun).toMatchObject({
        status: 'sent',
        sentCount: 2,
        failedCount: 0,
        artifactFileUrl: partialRun?.artifactFileUrl,
        artifactSha256: partialRun?.artifactSha256,
      });
      expect(completedRun?.deliveries.every((delivery) => delivery.status === 'sent')).toBe(true);
    } finally {
      sendSpy.mockRestore();
      await cleanupProject(project.id, company.id);
    }
  });

  it('suppresses retry delivery when a known recipient loses project access', async () => {
    const fixture = await createRecipientScheduleFixture({});
    const { now, project, schedule, user } = fixture;
    const sendSpy = vi.spyOn(email, 'sendScheduledReportEmail').mockResolvedValue({
      success: false,
      error: 'temporary provider failure',
      provider: 'mock',
    });

    try {
      const firstRun = await processDueScheduledReports({ now, scheduleIds: [schedule.id] });

      expect(firstRun.failed).toBe(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      await prisma.projectUser.updateMany({
        where: { projectId: project.id, userId: user.id },
        data: { status: 'removed' },
      });

      sendSpy.mockClear();
      sendSpy.mockResolvedValue({
        success: true,
        messageId: 'should-not-send',
        provider: 'mock',
      });

      const failedSchedule = await getScheduledReport(schedule.id);
      const retryRun = await processDueScheduledReports({
        now: failedSchedule!.nextRunAt!,
        scheduleIds: [schedule.id],
      });

      expect(retryRun.processed).toBe(1);
      expect(retryRun.sent).toBe(0);
      expect(retryRun.failed).toBe(0);
      expect(retryRun.skipped).toBe(1);
      expect(sendSpy).not.toHaveBeenCalled();
      expect(retryRun.results[0]).toMatchObject({
        status: 'skipped',
        error: 'No eligible scheduled report recipients',
      });

      const completedRun = await prisma.scheduledReportRun.findFirst({
        where: { scheduleId: schedule.id },
        include: { deliveries: true },
      });
      expect(completedRun).toMatchObject({
        status: 'cancelled',
        errorReason: 'No eligible scheduled report recipients',
      });
      expect(completedRun?.deliveries[0]).toMatchObject({
        status: 'suppressed',
        retryable: false,
        errorReason: 'Scheduled report recipient no longer has project report access',
      });
    } finally {
      sendSpy.mockRestore();
      await cleanupRecipientScheduleFixture(fixture);
    }
  });

  it('adopts a stored run artifact after metadata persistence failed', async () => {
    const { company, project } = await createScheduledReportProject();
    const retryNow = new Date('2026-05-10T09:30:00.000Z');
    const generatedAt = new Date('2026-05-10T09:00:00.000Z');
    const schedule = await createDueSchedule(project.id, new Date(retryNow.getTime() - 60_000), {
      recipients: 'artifact-retry@example.com',
    });
    const run = await prisma.scheduledReportRun.create({
      data: {
        scheduleId: schedule.id,
        projectId: project.id,
        reportType: 'lot-status',
        status: 'processing',
        recipientCount: 1,
        generatedAt,
        deliveries: {
          create: {
            scheduleId: schedule.id,
            projectId: project.id,
            recipient: 'artifact-retry@example.com',
            recipientKind: 'email',
            status: 'failed',
            retryable: true,
            attemptCount: 1,
            nextAttemptAt: new Date(retryNow.getTime() - 60_000),
            errorReason: 'Metadata update failed after artifact upload',
          },
        },
      },
    });
    const artifactFileUrl = `uploads/scheduled-reports/${project.id}/${schedule.id}/${run.id}.pdf`;
    const artifactPath = resolveUploadPath(artifactFileUrl, 'scheduled-reports');
    const storedPdf = Buffer.from('%PDF-1.4\npreviously committed scheduled artifact\n%%EOF');
    const sendSpy = vi.spyOn(email, 'sendScheduledReportEmail').mockResolvedValue({
      success: true,
      messageId: 'artifact-retry-ok',
      provider: 'mock',
    });

    try {
      await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
      await fs.promises.writeFile(artifactPath, storedPdf);

      await prisma.lot.create({
        data: {
          projectId: project.id,
          lotNumber: 'LOT-LIVE-DATA-CHANGED',
          lotType: 'roadworks',
          status: 'conforming',
          activityType: 'Changed live data',
        },
      });

      const result = await processDueScheduledReports({
        now: retryNow,
        scheduleIds: [schedule.id],
      });

      expectSingleSentResult(result, 1);
      expect(sendSpy).toHaveBeenCalledTimes(1);
      const emailPayload = sendSpy.mock.calls[0]?.[0];
      expect(emailPayload).toBeDefined();
      if (!emailPayload) {
        throw new Error('Scheduled report email was not sent');
      }
      const emailPdfBuffer = emailPayload.pdfBuffer;
      expect(emailPdfBuffer).toBeDefined();
      if (!emailPdfBuffer) {
        throw new Error('Scheduled report email did not include a PDF buffer');
      }
      expect(Buffer.compare(emailPdfBuffer, storedPdf)).toBe(0);

      const completedRun = await prisma.scheduledReportRun.findUnique({
        where: { id: run.id },
      });
      expect(completedRun).toMatchObject({
        status: 'sent',
        artifactFileUrl,
        artifactFileSize: storedPdf.length,
        artifactSha256: calculateScheduledReportArtifactSha256(storedPdf),
      });
    } finally {
      sendSpy.mockRestore();
      await fs.promises.unlink(artifactPath).catch(() => {});
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

import { afterEach, describe, expect, it } from 'vitest';
import { clearEmailQueue, getQueuedEmails } from './email.js';
import { prisma } from './prisma.js';
import {
  calculateNextScheduledReportRunAt,
  processDueScheduledReports,
} from './scheduledReports.js';

async function createScheduledReportProject() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const company = await prisma.company.create({
    data: {
      name: `Scheduled Processor Company ${suffix}`,
      subscriptionTier: 'professional',
    },
  });
  const project = await prisma.project.create({
    data: {
      name: `Scheduled Processor Project ${suffix}`,
      projectNumber: `SCHPROC-${suffix}`,
      companyId: company.id,
      status: 'active',
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

afterEach(() => {
  clearEmailQueue();
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

      const queuedEmails = getQueuedEmails();
      expect(queuedEmails).toHaveLength(1);
      expect(queuedEmails[0]!.to).toEqual(['recipient@example.com', 'second@example.com']);
      expect(queuedEmails[0]!.subject).toContain('Scheduled Report');
      expect(queuedEmails[0]!.text).toContain('View report online:');
      expect(queuedEmails[0]!.attachments).toHaveLength(1);
      const attachment = queuedEmails[0]!.attachments![0]!;
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

  it('retries invalid due schedules without sending email', async () => {
    const { company, project } = await createScheduledReportProject();
    const now = new Date(2026, 4, 10, 9, 30, 0, 0);
    const retryDelayMs = 5 * 60 * 1000;

    const schedule = await prisma.scheduledReport.create({
      data: {
        projectId: project.id,
        reportType: 'lot-status',
        frequency: 'fortnightly',
        timeOfDay: '09:00',
        recipients: 'recipient@example.com',
        nextRunAt: new Date(now.getTime() - 60_000),
        isActive: true,
      },
    });

    try {
      const result = await processDueScheduledReports({
        now,
        scheduleIds: [schedule.id],
        retryDelayMs,
      });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]!.error).toContain('frequency');
      expect(getQueuedEmails()).toHaveLength(0);

      const updatedSchedule = await prisma.scheduledReport.findUnique({
        where: { id: schedule.id },
      });
      expect(updatedSchedule?.lastSentAt).toBeNull();
      expect(updatedSchedule?.nextRunAt?.toISOString()).toBe(
        new Date(now.getTime() + retryDelayMs).toISOString(),
      );
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });

  it('retries schedules with invalid stored recipients without sending email', async () => {
    const { company, project } = await createScheduledReportProject();
    const now = new Date(2026, 4, 10, 9, 30, 0, 0);
    const retryDelayMs = 5 * 60 * 1000;

    const schedule = await prisma.scheduledReport.create({
      data: {
        projectId: project.id,
        reportType: 'lot-status',
        frequency: 'daily',
        timeOfDay: '09:00',
        recipients: 'recipient@example.com,not-an-email',
        nextRunAt: new Date(now.getTime() - 60_000),
        isActive: true,
      },
    });

    try {
      const result = await processDueScheduledReports({
        now,
        scheduleIds: [schedule.id],
        retryDelayMs,
      });

      expect(result.processed).toBe(1);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0]!.error).toContain('valid email addresses');
      expect(getQueuedEmails()).toHaveLength(0);

      const updatedSchedule = await prisma.scheduledReport.findUnique({
        where: { id: schedule.id },
      });
      expect(updatedSchedule?.lastSentAt).toBeNull();
      expect(updatedSchedule?.nextRunAt?.toISOString()).toBe(
        new Date(now.getTime() + retryDelayMs).toISOString(),
      );
    } finally {
      await cleanupProject(project.id, company.id);
    }
  });
});

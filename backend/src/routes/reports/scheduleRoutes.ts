import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AuditAction, createAuditLog } from '../../lib/auditLog.js';
import {
  SCHEDULED_REPORT_FREQUENCIES,
  SCHEDULED_REPORT_TYPES,
  MAX_SCHEDULED_REPORT_RECIPIENTS,
  MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH,
  MAX_SCHEDULED_REPORTS_PER_PROJECT,
  calculateNextScheduledReportRunAt,
} from '../../lib/scheduledReports.js';
import { projectTimeZoneFromState } from '../../lib/projectTimeZone.js';
import {
  buildScheduledReportDeletedResponse,
  buildScheduledReportResponse,
  buildScheduledReportsResponse,
} from '../reportResponses.js';
import { sendScheduledReportArtifactFile } from '../../lib/scheduledReports/artifacts.js';

const scheduledReportTypeSchema = z.enum(SCHEDULED_REPORT_TYPES);
const scheduledReportFrequencySchema = z.enum(SCHEDULED_REPORT_FREQUENCIES);
const scheduledReportEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());
const scheduledReportTimeOfDaySchema = z
  .string()
  .max(5)
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const INCOMPLETE_SCHEDULED_REPORT_RUN_STATUSES = ['processing', 'failed', 'partial_failed'];
const INCOMPLETE_SCHEDULED_REPORT_DELIVERY_STATUSES = ['pending', 'sending', 'failed'];

type ScheduledReportFrequency = z.infer<typeof scheduledReportFrequencySchema>;
type ScheduledReportType = z.infer<typeof scheduledReportTypeSchema>;
type AuthUser = NonNullable<Express.Request['user']>;
type ScheduledReportCapacityClient = {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
  scheduledReport: {
    count: (args: { where: { projectId: string } }) => Promise<number>;
  };
};

type ScheduledReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  requireScheduledReportAccess: (
    user: AuthUser | undefined,
    projectId: string,
    options?: { requireWritable?: boolean },
  ) => Promise<string | null>;
  requireScheduledReportArtifactAccess: (
    user: AuthUser | undefined,
    projectId: string,
  ) => Promise<unknown>;
};

type ScheduledReportAuditSource = {
  reportType: string;
  frequency: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
  recipients: string;
  isActive: boolean;
};

type ScheduledReportRunSummarySource = {
  id: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  digestCount: number;
  suppressedCount: number;
  errorReason: string | null;
  generatedAt: Date;
  completedAt: Date | null;
  deliveries?: Array<{
    status: string;
    retryable: boolean;
    nextAttemptAt: Date | null;
  }>;
};

function buildScheduledReportRunSummary(run: ScheduledReportRunSummarySource) {
  const retryableFailedDeliveries =
    run.deliveries?.filter((delivery) => delivery.status === 'failed' && delivery.retryable) ?? [];
  const nextRetryAt =
    retryableFailedDeliveries
      .map((delivery) => delivery.nextAttemptAt)
      .filter((value): value is Date => Boolean(value))
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

  return {
    id: run.id,
    status: run.status,
    recipientCount: run.recipientCount,
    sentCount: run.sentCount,
    failedCount: run.failedCount,
    digestCount: run.digestCount,
    suppressedCount: run.suppressedCount,
    errorReason: run.errorReason,
    generatedAt: run.generatedAt,
    completedAt: run.completedAt,
    retryableFailedCount: retryableFailedDeliveries.length,
    nextRetryAt,
  };
}

function parseScheduleRouteId(
  value: unknown,
  parseRequiredString: ScheduledReportRouterDependencies['parseRequiredString'],
): string {
  return parseRequiredString(value, 'id', 128);
}

function parseScheduledReportType(value: unknown): ScheduledReportType {
  const result = scheduledReportTypeSchema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest('reportType must be lot-status, ncr, test, or diary');
  }

  return result.data;
}

function parseScheduledReportFrequency(value: unknown): ScheduledReportFrequency {
  const result = scheduledReportFrequencySchema.safeParse(value);
  if (!result.success) {
    throw AppError.badRequest('frequency must be daily, weekly, or monthly');
  }

  return result.data;
}

function parseScheduleInteger(value: unknown, fieldName: string, min: number, max: number): number {
  const parsedValue =
    typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : value;

  if (
    typeof parsedValue !== 'number' ||
    !Number.isInteger(parsedValue) ||
    parsedValue < min ||
    parsedValue > max
  ) {
    throw AppError.badRequest(`${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsedValue;
}

function parseTimeOfDay(value: unknown): string {
  const candidate = value === undefined || value === null || value === '' ? '09:00' : value;
  const result = scheduledReportTimeOfDaySchema.safeParse(candidate);
  if (!result.success) {
    throw AppError.badRequest('timeOfDay must use HH:mm format');
  }

  return result.data;
}

function normalizeScheduledReportRecipients(value: unknown): string {
  let rawRecipients: string[];

  if (typeof value === 'string') {
    if (value.length > MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH) {
      throw AppError.badRequest('recipients is too long');
    }

    rawRecipients = value.split(/[,;\n]/);
  } else if (Array.isArray(value)) {
    if (value.length > MAX_SCHEDULED_REPORT_RECIPIENTS) {
      throw AppError.badRequest(
        `recipients cannot include more than ${MAX_SCHEDULED_REPORT_RECIPIENTS} entries`,
      );
    }

    rawRecipients = value.flatMap((recipient) => {
      if (typeof recipient !== 'string') {
        throw AppError.badRequest('recipients must be a string or an array of email addresses');
      }

      if (recipient.length > MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH) {
        throw AppError.badRequest('recipients is too long');
      }

      return recipient.split(/[,;\n]/);
    });
  } else {
    throw AppError.badRequest('recipients must be a string or an array of email addresses');
  }

  const trimmedRecipients = rawRecipients.map((recipient) => recipient.trim()).filter(Boolean);

  if (trimmedRecipients.length === 0) {
    throw AppError.badRequest('recipients must include at least one email address');
  }

  const normalizedRecipients: string[] = [];
  for (const recipient of trimmedRecipients) {
    const result = scheduledReportEmailSchema.safeParse(recipient);
    if (!result.success) {
      throw AppError.badRequest('recipients must contain valid email addresses');
    }

    normalizedRecipients.push(result.data);
  }

  const uniqueRecipients = Array.from(new Set(normalizedRecipients));
  if (uniqueRecipients.length > MAX_SCHEDULED_REPORT_RECIPIENTS) {
    throw AppError.badRequest(
      `recipients cannot include more than ${MAX_SCHEDULED_REPORT_RECIPIENTS} email addresses`,
    );
  }

  return uniqueRecipients.join(',');
}

function parseNormalizedRecipientEmails(recipients: string): string[] {
  return recipients
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

function getRecipientDomains(emails: string[]): string[] {
  return Array.from(
    new Set(emails.map((email) => email.split('@')[1] ?? '').filter((domain) => domain.length > 0)),
  ).sort((left, right) => left.localeCompare(right));
}

async function buildScheduledReportAuditChanges(schedule: ScheduledReportAuditSource) {
  const recipientEmails = parseNormalizedRecipientEmails(schedule.recipients);
  const appRecipients =
    recipientEmails.length === 0
      ? []
      : await prisma.user.findMany({
          where: { email: { in: recipientEmails } },
          select: { email: true },
        });
  const appRecipientEmails = new Set(
    appRecipients.map((recipient) => recipient.email.toLowerCase()),
  );
  const appRecipientCount = recipientEmails.filter((email) => appRecipientEmails.has(email)).length;

  return {
    reportType: schedule.reportType,
    frequency: schedule.frequency,
    dayOfWeek: schedule.dayOfWeek,
    dayOfMonth: schedule.dayOfMonth,
    timeOfDay: schedule.timeOfDay,
    isActive: schedule.isActive,
    recipientCount: recipientEmails.length,
    appRecipientCount,
    externalRecipientCount: recipientEmails.length - appRecipientCount,
    recipientDomains: getRecipientDomains(recipientEmails),
  };
}

async function lockScheduledReportForUpdate(
  client: Prisma.TransactionClient,
  scheduleId: string,
): Promise<void> {
  await client.$queryRaw`
    SELECT id
    FROM scheduled_reports
    WHERE id = ${scheduleId}
    FOR UPDATE
  `;
}

async function cancelIncompleteScheduledReportRuns(
  client: Prisma.TransactionClient,
  scheduleId: string,
): Promise<void> {
  const now = new Date();
  const reason = 'Schedule configuration changed before retry completed';

  await client.scheduledReportRecipientDelivery.updateMany({
    where: {
      scheduleId,
      status: { in: INCOMPLETE_SCHEDULED_REPORT_DELIVERY_STATUSES },
    },
    data: {
      status: 'cancelled',
      retryable: false,
      lockedUntil: null,
      nextAttemptAt: null,
      errorReason: reason,
    },
  });

  await client.scheduledReportRun.updateMany({
    where: {
      scheduleId,
      status: { in: INCOMPLETE_SCHEDULED_REPORT_RUN_STATUSES },
    },
    data: {
      status: 'cancelled',
      completedAt: now,
      errorReason: reason,
    },
  });
}

function normalizeScheduleTiming(input: {
  frequency: ScheduledReportFrequency;
  dayOfWeek: unknown;
  dayOfMonth: unknown;
  timeOfDay: unknown;
}): {
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string;
} {
  const timeOfDay = parseTimeOfDay(input.timeOfDay);
  const dayOfWeek =
    input.frequency === 'weekly'
      ? input.dayOfWeek === undefined || input.dayOfWeek === null || input.dayOfWeek === ''
        ? 1
        : parseScheduleInteger(input.dayOfWeek, 'dayOfWeek', 0, 6)
      : null;
  const dayOfMonth =
    input.frequency === 'monthly'
      ? input.dayOfMonth === undefined || input.dayOfMonth === null || input.dayOfMonth === ''
        ? 1
        : parseScheduleInteger(input.dayOfMonth, 'dayOfMonth', 1, 31)
      : null;

  return {
    dayOfWeek,
    dayOfMonth,
    timeOfDay,
  };
}

function parseScheduleIsActive(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw AppError.badRequest('isActive must be a boolean');
  }

  return value;
}

export async function assertScheduledReportCapacity(
  client: ScheduledReportCapacityClient,
  projectId: string,
): Promise<void> {
  await client.$queryRaw`
    SELECT id
    FROM projects
    WHERE id = ${projectId}
    FOR UPDATE
  `;

  const existingScheduleCount = await client.scheduledReport.count({ where: { projectId } });
  if (existingScheduleCount >= MAX_SCHEDULED_REPORTS_PER_PROJECT) {
    throw AppError.badRequest(
      `Projects cannot have more than ${MAX_SCHEDULED_REPORTS_PER_PROJECT} scheduled reports`,
    );
  }
}

export function createScheduledReportRouter({
  parseRequiredString,
  requireScheduledReportAccess,
  requireScheduledReportArtifactAccess,
}: ScheduledReportRouterDependencies) {
  const scheduledReportRouter = Router();

  scheduledReportRouter.use(requireAuth);

  // GET /api/reports/scheduled-runs/:runId/artifact - Download an immutable run PDF
  scheduledReportRouter.get(
    '/scheduled-runs/:runId/artifact',
    asyncHandler(async (req, res) => {
      const runId = parseRequiredString(req.params.runId, 'runId', 128);

      const run = await prisma.scheduledReportRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          scheduleId: true,
          projectId: true,
          artifactFileUrl: true,
          artifactReportName: true,
          artifactFilename: true,
          artifactMimeType: true,
          artifactFileSize: true,
          artifactSha256: true,
        },
      });

      if (!run || !run.artifactFileUrl) {
        throw AppError.notFound('Scheduled report artifact');
      }

      await requireScheduledReportArtifactAccess(req.user, run.projectId);
      await sendScheduledReportArtifactFile(run, res);
    }),
  );

  // GET /api/reports/schedules - List scheduled reports for a project
  scheduledReportRouter.get(
    '/schedules',
    asyncHandler(async (req, res) => {
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      const projectState = await requireScheduledReportAccess(req.user, projectId, {
        requireWritable: true,
      });
      const projectTimeZone = projectTimeZoneFromState(projectState);

      const schedules = await prisma.scheduledReport.findMany({
        where: { projectId },
        include: {
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              recipientCount: true,
              sentCount: true,
              failedCount: true,
              digestCount: true,
              suppressedCount: true,
              errorReason: true,
              generatedAt: true,
              completedAt: true,
              deliveries: {
                where: {
                  status: 'failed',
                  retryable: true,
                },
                select: {
                  status: true,
                  retryable: true,
                  nextAttemptAt: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: MAX_SCHEDULED_REPORTS_PER_PROJECT,
      });
      const responseSchedules = schedules.map(({ runs, ...schedule }) => ({
        ...schedule,
        latestRun: runs[0] ? buildScheduledReportRunSummary(runs[0]) : null,
      }));

      res.json(
        buildScheduledReportsResponse(
          responseSchedules,
          MAX_SCHEDULED_REPORTS_PER_PROJECT,
          projectTimeZone,
        ),
      );
    }),
  );

  // POST /api/reports/schedules - Create a new scheduled report
  scheduledReportRouter.post(
    '/schedules',
    asyncHandler(async (req, res) => {
      const { reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients } = req.body;
      const projectId = parseRequiredString(req.body.projectId, 'projectId');
      const userId = req.user?.id;

      if (reportType === undefined || frequency === undefined || recipients === undefined) {
        throw AppError.badRequest('projectId, reportType, frequency, and recipients are required');
      }
      const projectState = await requireScheduledReportAccess(req.user, projectId, {
        requireWritable: true,
      });

      const normalizedReportType = parseScheduledReportType(reportType);
      const normalizedFrequency = parseScheduledReportFrequency(frequency);
      const normalizedRecipients = normalizeScheduledReportRecipients(recipients);
      const scheduleTiming = normalizeScheduleTiming({
        frequency: normalizedFrequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
      });
      // Calculate next run time
      const nextRunAt = calculateNextScheduledReportRunAt(
        normalizedFrequency,
        scheduleTiming.dayOfWeek,
        scheduleTiming.dayOfMonth,
        scheduleTiming.timeOfDay,
        new Date(),
        projectTimeZoneFromState(projectState),
      );

      const schedule = await prisma.$transaction(async (tx) => {
        await assertScheduledReportCapacity(tx, projectId);

        return tx.scheduledReport.create({
          data: {
            projectId,
            reportType: normalizedReportType,
            frequency: normalizedFrequency,
            dayOfWeek: scheduleTiming.dayOfWeek,
            dayOfMonth: scheduleTiming.dayOfMonth,
            timeOfDay: scheduleTiming.timeOfDay,
            recipients: normalizedRecipients,
            nextRunAt,
            createdById: userId,
            isActive: true,
          },
        });
      });

      await createAuditLog({
        projectId,
        userId,
        entityType: 'scheduled_report',
        entityId: schedule.id,
        action: AuditAction.SCHEDULED_REPORT_CREATED,
        changes: await buildScheduledReportAuditChanges(schedule),
        req,
      });

      res
        .status(201)
        .json(buildScheduledReportResponse(schedule, projectTimeZoneFromState(projectState)));
    }),
  );

  // PUT /api/reports/schedules/:id - Update a scheduled report
  scheduledReportRouter.put(
    '/schedules/:id',
    asyncHandler(async (req, res) => {
      const id = parseScheduleRouteId(req.params.id, parseRequiredString);
      const { reportType, frequency, dayOfWeek, dayOfMonth, timeOfDay, recipients, isActive } =
        req.body;

      // Check if schedule exists
      const existing = await prisma.scheduledReport.findUnique({
        where: { id },
      });

      if (!existing) {
        throw AppError.notFound('Scheduled report');
      }
      const projectState = await requireScheduledReportAccess(req.user, existing.projectId, {
        requireWritable: true,
      });
      const projectTimeZone = projectTimeZoneFromState(projectState);

      const updateData: Prisma.ScheduledReportUpdateInput = {};

      if (reportType !== undefined) {
        updateData.reportType = parseScheduledReportType(reportType);
      }

      if (recipients !== undefined) {
        updateData.recipients = normalizeScheduledReportRecipients(recipients);
      }

      if (isActive !== undefined) {
        updateData.isActive = parseScheduleIsActive(isActive);
      }

      const shouldCancelIncompleteRuns =
        reportType !== undefined ||
        frequency !== undefined ||
        dayOfWeek !== undefined ||
        dayOfMonth !== undefined ||
        timeOfDay !== undefined ||
        recipients !== undefined;
      const shouldResetFailureState = shouldCancelIncompleteRuns || isActive === true;

      if (
        frequency !== undefined ||
        dayOfWeek !== undefined ||
        dayOfMonth !== undefined ||
        timeOfDay !== undefined
      ) {
        const normalizedFrequency =
          frequency === undefined
            ? parseScheduledReportFrequency(existing.frequency)
            : parseScheduledReportFrequency(frequency);
        const scheduleTiming = normalizeScheduleTiming({
          frequency: normalizedFrequency,
          dayOfWeek: dayOfWeek === undefined ? existing.dayOfWeek : dayOfWeek,
          dayOfMonth: dayOfMonth === undefined ? existing.dayOfMonth : dayOfMonth,
          timeOfDay: timeOfDay === undefined ? existing.timeOfDay : timeOfDay,
        });

        updateData.frequency = normalizedFrequency;
        updateData.dayOfWeek = scheduleTiming.dayOfWeek;
        updateData.dayOfMonth = scheduleTiming.dayOfMonth;
        updateData.timeOfDay = scheduleTiming.timeOfDay;
        updateData.nextRunAt = calculateNextScheduledReportRunAt(
          normalizedFrequency,
          scheduleTiming.dayOfWeek,
          scheduleTiming.dayOfMonth,
          scheduleTiming.timeOfDay,
          new Date(),
          projectTimeZone,
        );
      }

      if (shouldResetFailureState) {
        updateData.failureCount = 0;
        updateData.lastFailureAt = null;
        updateData.lastFailureReason = null;
      }

      if (
        isActive === true &&
        updateData.nextRunAt === undefined &&
        (!existing.nextRunAt || existing.nextRunAt <= new Date())
      ) {
        const normalizedFrequency = parseScheduledReportFrequency(existing.frequency);
        updateData.nextRunAt = calculateNextScheduledReportRunAt(
          normalizedFrequency,
          existing.dayOfWeek,
          existing.dayOfMonth,
          existing.timeOfDay,
          new Date(),
          projectTimeZone,
        );
      }

      const schedule = await prisma.$transaction(async (tx) => {
        await lockScheduledReportForUpdate(tx, id);

        if (shouldCancelIncompleteRuns) {
          await cancelIncompleteScheduledReportRuns(tx, id);
        }

        return tx.scheduledReport.update({
          where: { id },
          data: updateData,
        });
      });

      await createAuditLog({
        projectId: schedule.projectId,
        userId: req.user?.id,
        entityType: 'scheduled_report',
        entityId: schedule.id,
        action: AuditAction.SCHEDULED_REPORT_UPDATED,
        changes: await buildScheduledReportAuditChanges(schedule),
        req,
      });

      res.json(buildScheduledReportResponse(schedule, projectTimeZone));
    }),
  );

  // DELETE /api/reports/schedules/:id - Delete a scheduled report
  scheduledReportRouter.delete(
    '/schedules/:id',
    asyncHandler(async (req, res) => {
      const id = parseScheduleRouteId(req.params.id, parseRequiredString);

      // Check if schedule exists
      const existing = await prisma.scheduledReport.findUnique({
        where: { id },
      });

      if (!existing) {
        throw AppError.notFound('Scheduled report');
      }
      await requireScheduledReportAccess(req.user, existing.projectId, { requireWritable: true });

      await prisma.scheduledReport.delete({
        where: { id },
      });

      await createAuditLog({
        projectId: existing.projectId,
        userId: req.user?.id,
        entityType: 'scheduled_report',
        entityId: existing.id,
        action: AuditAction.SCHEDULED_REPORT_DELETED,
        changes: await buildScheduledReportAuditChanges(existing),
        req,
      });

      res.json(buildScheduledReportDeletedResponse());
    }),
  );

  return scheduledReportRouter;
}

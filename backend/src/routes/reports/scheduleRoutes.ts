import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { AppError } from '../../lib/AppError.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import {
  SCHEDULED_REPORT_FREQUENCIES,
  SCHEDULED_REPORT_TYPES,
  MAX_SCHEDULED_REPORT_RECIPIENTS,
  MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH,
  MAX_SCHEDULED_REPORTS_PER_PROJECT,
  calculateNextScheduledReportRunAt,
} from '../../lib/scheduledReports.js';
import {
  buildScheduledReportDeletedResponse,
  buildScheduledReportResponse,
  buildScheduledReportsResponse,
} from '../reportResponses.js';

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

type ScheduledReportFrequency = z.infer<typeof scheduledReportFrequencySchema>;
type ScheduledReportType = z.infer<typeof scheduledReportTypeSchema>;
type AuthUser = NonNullable<Express.Request['user']>;

type ScheduledReportRouterDependencies = {
  parseRequiredString: (value: unknown, fieldName: string, maxLength?: number) => string;
  requireScheduledReportAccess: (user: AuthUser | undefined, projectId: string) => Promise<void>;
};

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

export function createScheduledReportRouter({
  parseRequiredString,
  requireScheduledReportAccess,
}: ScheduledReportRouterDependencies) {
  const scheduledReportRouter = Router();

  scheduledReportRouter.use(requireAuth);

  // GET /api/reports/schedules - List scheduled reports for a project
  scheduledReportRouter.get(
    '/schedules',
    asyncHandler(async (req, res) => {
      const projectId = parseRequiredString(req.query.projectId, 'projectId');

      await requireScheduledReportAccess(req.user, projectId);

      const schedules = await prisma.scheduledReport.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: MAX_SCHEDULED_REPORTS_PER_PROJECT,
      });

      res.json(buildScheduledReportsResponse(schedules, MAX_SCHEDULED_REPORTS_PER_PROJECT));
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
      await requireScheduledReportAccess(req.user, projectId);

      const normalizedReportType = parseScheduledReportType(reportType);
      const normalizedFrequency = parseScheduledReportFrequency(frequency);
      const normalizedRecipients = normalizeScheduledReportRecipients(recipients);
      const scheduleTiming = normalizeScheduleTiming({
        frequency: normalizedFrequency,
        dayOfWeek,
        dayOfMonth,
        timeOfDay,
      });
      const existingScheduleCount = await prisma.scheduledReport.count({ where: { projectId } });
      if (existingScheduleCount >= MAX_SCHEDULED_REPORTS_PER_PROJECT) {
        throw AppError.badRequest(
          `Projects cannot have more than ${MAX_SCHEDULED_REPORTS_PER_PROJECT} scheduled reports`,
        );
      }

      // Calculate next run time
      const nextRunAt = calculateNextScheduledReportRunAt(
        normalizedFrequency,
        scheduleTiming.dayOfWeek,
        scheduleTiming.dayOfMonth,
        scheduleTiming.timeOfDay,
      );

      const schedule = await prisma.scheduledReport.create({
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

      res.status(201).json(buildScheduledReportResponse(schedule));
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
      await requireScheduledReportAccess(req.user, existing.projectId);

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
        );
      }

      const schedule = await prisma.scheduledReport.update({
        where: { id },
        data: updateData,
      });

      res.json(buildScheduledReportResponse(schedule));
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
      await requireScheduledReportAccess(req.user, existing.projectId);

      await prisma.scheduledReport.delete({
        where: { id },
      });

      res.json(buildScheduledReportDeletedResponse());
    }),
  );

  return scheduledReportRouter;
}

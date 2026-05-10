import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../lib/AppError.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { sendSupportRequestEmail } from '../lib/email.js';
import { sanitizeLogText } from '../lib/logSanitization.js';
import { logError } from '../lib/serverLogger.js';

export const supportRouter = Router();

const DEFAULT_SUPPORT_EMAIL = 'support@siteproof.com.au';
const SUPPORT_CATEGORIES = ['general', 'technical', 'billing', 'feature', 'bug'] as const;

const optionalTrimmedString = (maxLength: number, fieldName: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().max(maxLength, `${fieldName} must be ${maxLength} characters or less`).optional(),
  );

const optionalEmail = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().email('userEmail must be a valid email address').max(254, 'userEmail must be 254 characters or less').optional());

const supportRequestSchema = z.object({
  subject: z
    .string({
      required_error: 'Subject is required',
      invalid_type_error: 'Subject is required',
    })
    .trim()
    .min(1, 'Subject is required')
    .max(160, 'Subject must be 160 characters or less'),
  message: z
    .string({
      required_error: 'Message is required',
      invalid_type_error: 'Message is required',
    })
    .trim()
    .min(1, 'Message is required')
    .max(5000, 'Message must be 5000 characters or less'),
  category: z.preprocess(
    (value) => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z
      .enum(SUPPORT_CATEGORIES, {
        errorMap: () => ({ message: 'Invalid support category' }),
      })
      .optional()
      .default('general'),
  ),
  userEmail: optionalEmail,
  userName: optionalTrimmedString(120, 'userName'),
});

const clientErrorReportSchema = z.object({
  message: z
    .string({
      required_error: 'Error message is required',
      invalid_type_error: 'Error message is required',
    })
    .trim()
    .min(1, 'Error message is required')
    .max(1000, 'Error message must be 1000 characters or less'),
  name: optionalTrimmedString(120, 'name'),
  stack: optionalTrimmedString(6000, 'stack'),
  componentStack: optionalTrimmedString(6000, 'componentStack'),
  path: optionalTrimmedString(500, 'path'),
  userAgent: optionalTrimmedString(500, 'userAgent'),
  timestamp: optionalTrimmedString(64, 'timestamp'),
});

function getValidationMessage(error: z.ZodError): string {
  const requiredIssue = error.issues.find((issue) => {
    const field = String(issue.path[0]);
    return (
      (field === 'subject' || field === 'message') &&
      (issue.code === 'invalid_type' ||
        (issue.code === 'too_small' && 'minimum' in issue && issue.minimum === 1))
    );
  });

  if (requiredIssue) {
    return 'Subject and message are required';
  }

  return error.issues[0]?.message || 'Invalid support request';
}

function getClientErrorValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid client error report';
}

function generateSupportTicketId(prefix = 'SP'): string {
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${datePrefix}-${randomSuffix}`;
}

function buildClientErrorSubject(report: z.infer<typeof clientErrorReportSchema>): string {
  const errorName = report.name || 'Error';
  const messagePrefix = report.message.slice(0, 90);
  return `Client error: ${errorName} - ${messagePrefix}`.slice(0, 160);
}

function sanitizeClientErrorReport(
  report: z.infer<typeof clientErrorReportSchema>,
): z.infer<typeof clientErrorReportSchema> {
  return {
    ...report,
    message: sanitizeLogText(report.message),
    name: report.name ? sanitizeLogText(report.name) : undefined,
    stack: report.stack ? sanitizeLogText(report.stack) : undefined,
    componentStack: report.componentStack ? sanitizeLogText(report.componentStack) : undefined,
    path: report.path ? sanitizeLogText(report.path) : undefined,
    userAgent: report.userAgent ? sanitizeLogText(report.userAgent) : undefined,
  };
}

function buildClientErrorMessage(
  reportId: string,
  report: z.infer<typeof clientErrorReportSchema>,
): string {
  const lines = [
    `Report ID: ${reportId}`,
    `Timestamp: ${report.timestamp || new Date().toISOString()}`,
    `Path: ${report.path || 'Unknown'}`,
    `User agent: ${report.userAgent || 'Unknown'}`,
    `Error name: ${report.name || 'Error'}`,
    '',
    'Message:',
    report.message,
  ];

  if (report.stack) {
    lines.push('', 'Stack:', report.stack);
  }

  if (report.componentStack) {
    lines.push('', 'React component stack:', report.componentStack);
  }

  return lines.join('\n');
}

function configuredSupportValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function getSupportContactInfo() {
  const phone = configuredSupportValue('SUPPORT_PHONE');

  return {
    email: configuredSupportValue('SUPPORT_EMAIL') || DEFAULT_SUPPORT_EMAIL,
    phone,
    phoneLabel: configuredSupportValue('SUPPORT_PHONE_LABEL') || phone,
    emergencyPhone: configuredSupportValue('SUPPORT_EMERGENCY_PHONE'),
    address: configuredSupportValue('SUPPORT_ADDRESS'),
    hours: configuredSupportValue('SUPPORT_HOURS') || 'Mon-Fri, 8am-6pm AEST',
    responseTime: {
      critical: configuredSupportValue('SUPPORT_RESPONSE_CRITICAL') || 'Within 2 hours',
      standard: configuredSupportValue('SUPPORT_RESPONSE_STANDARD') || 'Within 24 hours',
      general: configuredSupportValue('SUPPORT_RESPONSE_GENERAL') || 'Within 48 hours',
    },
  };
}

// POST /api/support/request - Submit a support request
supportRouter.post(
  '/request',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = supportRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      throw AppError.badRequest(getValidationMessage(parsed.error), {
        issues: parsed.error.issues,
      });
    }

    const supportRequest = parsed.data;
    const ticketId = generateSupportTicketId();
    const emailResult = await sendSupportRequestEmail({
      ticketId,
      ...supportRequest,
    });

    if (!emailResult.success) {
      throw new AppError(502, 'Support request could not be delivered', 'EXTERNAL_SERVICE_ERROR');
    }

    return res.status(200).json({
      success: true,
      message: 'Support request submitted successfully',
      ticketId,
      category: supportRequest.category,
    });
  }),
);

// POST /api/support/client-error - Accept fatal frontend error reports
supportRouter.post(
  '/client-error',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = clientErrorReportSchema.safeParse(req.body);

    if (!parsed.success) {
      throw AppError.badRequest(getClientErrorValidationMessage(parsed.error), {
        issues: parsed.error.issues,
      });
    }

    const report = sanitizeClientErrorReport(parsed.data);
    const reportId = generateSupportTicketId('SP-ERR');

    logError('[Client Error Report] Captured frontend error', {
      reportId,
      name: report.name,
      message: report.message,
      path: report.path,
      timestamp: report.timestamp,
    });

    const emailResult = await sendSupportRequestEmail({
      ticketId: reportId,
      category: 'bug',
      subject: buildClientErrorSubject(report),
      message: buildClientErrorMessage(reportId, report),
    });

    if (!emailResult.success) {
      logError('[Client Error Report] Failed to deliver support email', {
        reportId,
        error: emailResult.error,
        provider: emailResult.provider,
      });
    }

    return res.status(202).json({
      success: true,
      reportId,
    });
  }),
);

// GET /api/support/contact - Get support contact information
supportRouter.get('/contact', (_req: Request, res: Response) => {
  res.json(getSupportContactInfo());
});

export default supportRouter;

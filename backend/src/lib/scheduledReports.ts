import { prisma } from './prisma.js';
import { sendScheduledReportEmail } from './email.js';
import { logError, logInfo } from './serverLogger.js';
import { normalizeSubscriptionTier } from './tierLimits.js';
import {
  calculateNextScheduledReportRunAt,
  isScheduledReportFrequency,
  parsePositiveInteger,
  parseRecipients,
  validateScheduledReportRecipients,
  type ScheduledReportForDelivery,
  type ScheduledReportFrequency,
} from './scheduledReports/core.js';
import { createTextPdf } from './scheduledReports/pdf.js';
import { buildScheduledReportDocument } from './scheduledReports/reportDocument.js';

export {
  calculateNextScheduledReportRunAt,
  MAX_SCHEDULED_REPORT_RECIPIENTS,
  MAX_SCHEDULED_REPORT_RECIPIENTS_INPUT_LENGTH,
  MAX_SCHEDULED_REPORTS_PER_PROJECT,
  SCHEDULED_REPORT_FREQUENCIES,
  SCHEDULED_REPORT_TYPES,
} from './scheduledReports/core.js';
export type { ScheduledReportFrequency, ScheduledReportType } from './scheduledReports/core.js';

const DEFAULT_PROCESS_LIMIT = 50;
const DEFAULT_LOCK_MS = 15 * 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 15 * 60 * 1000;
const DEFAULT_WORKER_INTERVAL_MS = 60 * 1000;
const SCHEDULED_REPORT_DELIVERY_TIERS = ['professional', 'enterprise', 'unlimited'] as const;
const SCHEDULED_REPORT_DELIVERY_TIER_SET = new Set<string>(SCHEDULED_REPORT_DELIVERY_TIERS);
const MAX_SCHEDULED_REPORT_DELIVERY_FAILURES = 3;
const MAX_FAILURE_REASON_LENGTH = 500;
const SUBCONTRACTOR_REPORT_ROLES = new Set(['subcontractor', 'subcontractor_admin']);
const COMPANY_REPORT_ADMIN_ROLES = new Set(['owner', 'admin']);

type ScheduledReportDocument = Awaited<ReturnType<typeof buildScheduledReportDocument>>;

type ScheduledReportRecipientPreferences = {
  enabled: boolean;
  scheduledReports: boolean;
  scheduledReportsTiming: string;
  dailyDigest: boolean;
};

type KnownScheduledReportRecipientUser = {
  id: string;
  email: string;
  companyId: string | null;
  roleInCompany: string | null;
  notificationEmailPreference: ScheduledReportRecipientPreferences | null;
  projectUsers: Array<{ role: string; status: string }>;
};

type ResolvedScheduledReportRecipient =
  | { kind: 'immediate'; recipient: string }
  | { kind: 'digest'; userId: string }
  | { kind: 'suppressed'; recipient: string };

type ResolvedScheduledReportRecipients = {
  immediateRecipients: string[];
  digestRecipientUserIds: string[];
  suppressedRecipients: string[];
};

export type ScheduledReportDeliveryStatus = 'sent' | 'failed' | 'disabled' | 'skipped';

export type ScheduledReportDeliveryResult = {
  scheduleId: string;
  projectId: string;
  reportType: string;
  recipients: number;
  status: ScheduledReportDeliveryStatus;
  nextRunAt?: string;
  failureCount?: number;
  error?: string;
};

export type ProcessDueScheduledReportsResult = {
  processed: number;
  sent: number;
  failed: number;
  disabled: number;
  skipped: number;
  results: ScheduledReportDeliveryResult[];
};

export type ProcessDueScheduledReportsOptions = {
  now?: Date;
  limit?: number;
  lockMs?: number;
  retryDelayMs?: number;
  scheduleIds?: string[];
};

async function claimScheduledReport(
  scheduleId: string,
  now: Date,
  lockMs: number,
): Promise<boolean> {
  const lockUntil = new Date(now.getTime() + lockMs);
  const claim = await prisma.scheduledReport.updateMany({
    where: {
      id: scheduleId,
      isActive: true,
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
      project: {
        status: 'active',
      },
    },
    data: {
      nextRunAt: lockUntil,
    },
  });

  return claim.count === 1;
}

function canDeliverScheduledReportForTier(tier: string | null | undefined): boolean {
  return SCHEDULED_REPORT_DELIVERY_TIER_SET.has(normalizeSubscriptionTier(tier));
}

function truncateFailureReason(reason: string): string {
  return reason.length <= MAX_FAILURE_REASON_LENGTH
    ? reason
    : `${reason.slice(0, MAX_FAILURE_REASON_LENGTH - 3)}...`;
}

function assertScheduledReportFrequency(
  frequency: string,
): asserts frequency is ScheduledReportFrequency {
  if (!isScheduledReportFrequency(frequency)) {
    throw new Error(`Unsupported scheduled report frequency: ${frequency}`);
  }
}

function isDigestTiming(value: string | null | undefined): boolean {
  return value === 'digest';
}

function canKnownUserReceiveProjectReport(
  user: KnownScheduledReportRecipientUser,
  projectCompanyId: string | null | undefined,
): boolean {
  if (SUBCONTRACTOR_REPORT_ROLES.has(user.roleInCompany || '')) {
    return false;
  }

  if (
    projectCompanyId &&
    user.companyId === projectCompanyId &&
    COMPANY_REPORT_ADMIN_ROLES.has(user.roleInCompany || '')
  ) {
    return true;
  }

  return user.projectUsers.some(
    (projectUser) =>
      projectUser.status === 'active' && !SUBCONTRACTOR_REPORT_ROLES.has(projectUser.role),
  );
}

function canReceiveScheduledReportEmail(
  preferences: ScheduledReportRecipientPreferences | null,
): boolean {
  return (preferences?.enabled ?? true) && (preferences?.scheduledReports ?? true);
}

function shouldQueueScheduledReportDigest(
  preferences: ScheduledReportRecipientPreferences | null,
): boolean {
  return isDigestTiming(preferences?.scheduledReportsTiming) && (preferences?.dailyDigest ?? false);
}

function classifyKnownScheduledReportRecipient(
  user: KnownScheduledReportRecipientUser,
  requestedRecipient: string,
  projectCompanyId: string | null | undefined,
): ResolvedScheduledReportRecipient {
  if (!canKnownUserReceiveProjectReport(user, projectCompanyId)) {
    return { kind: 'suppressed', recipient: requestedRecipient };
  }

  if (!canReceiveScheduledReportEmail(user.notificationEmailPreference)) {
    return { kind: 'suppressed', recipient: requestedRecipient };
  }

  if (shouldQueueScheduledReportDigest(user.notificationEmailPreference)) {
    return { kind: 'digest', userId: user.id };
  }

  return { kind: 'immediate', recipient: user.email.toLowerCase() };
}

function appendResolvedScheduledReportRecipient(
  resolvedRecipients: ResolvedScheduledReportRecipients,
  resolvedRecipient: ResolvedScheduledReportRecipient,
): void {
  switch (resolvedRecipient.kind) {
    case 'immediate':
      resolvedRecipients.immediateRecipients.push(resolvedRecipient.recipient);
      return;
    case 'digest':
      resolvedRecipients.digestRecipientUserIds.push(resolvedRecipient.userId);
      return;
    case 'suppressed':
      resolvedRecipients.suppressedRecipients.push(resolvedRecipient.recipient);
      return;
  }
}

async function resolveScheduledReportRecipients(
  schedule: ScheduledReportForDelivery,
  recipients: string[],
): Promise<ResolvedScheduledReportRecipients> {
  if (recipients.length === 0) {
    return { immediateRecipients: [], digestRecipientUserIds: [], suppressedRecipients: [] };
  }

  const knownUsers: KnownScheduledReportRecipientUser[] = await prisma.user.findMany({
    where: { email: { in: recipients } },
    select: {
      id: true,
      email: true,
      companyId: true,
      roleInCompany: true,
      notificationEmailPreference: {
        select: {
          enabled: true,
          scheduledReports: true,
          scheduledReportsTiming: true,
          dailyDigest: true,
        },
      },
      projectUsers: {
        where: { projectId: schedule.projectId },
        select: { role: true, status: true },
      },
    },
  });

  const knownUserByEmail = new Map(knownUsers.map((user) => [user.email.toLowerCase(), user]));
  const resolvedRecipients: ResolvedScheduledReportRecipients = {
    immediateRecipients: [],
    digestRecipientUserIds: [],
    suppressedRecipients: [],
  };

  for (const recipient of recipients) {
    const user = knownUserByEmail.get(recipient.toLowerCase());
    if (!user) {
      appendResolvedScheduledReportRecipient(resolvedRecipients, {
        kind: 'immediate',
        recipient,
      });
      continue;
    }

    appendResolvedScheduledReportRecipient(
      resolvedRecipients,
      classifyKnownScheduledReportRecipient(user, recipient, schedule.project.companyId),
    );
  }

  return resolvedRecipients;
}

async function queueScheduledReportDigestItems(
  schedule: ScheduledReportForDelivery,
  document: ScheduledReportDocument,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) {
    return;
  }

  await prisma.notificationDigestItem.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: 'scheduledReports',
      title: `Scheduled report ready: ${document.reportName}`,
      message: `Your scheduled ${document.reportTypeLabel} for ${schedule.project.name} is ready.`,
      projectName: schedule.project.name,
      linkUrl: document.viewReportUrl,
    })),
  });
}

async function recordScheduledReportFailure(
  schedule: ScheduledReportForDelivery,
  errorMessage: string,
  scheduleId: string,
  now: Date,
  retryDelayMs: number,
): Promise<{ status: 'failed' | 'disabled'; failureCount: number; nextRunAt: Date | null }> {
  const failureCount = Math.max(0, schedule.failureCount ?? 0) + 1;
  const shouldDisable = failureCount >= MAX_SCHEDULED_REPORT_DELIVERY_FAILURES;
  const retryAt = new Date(now.getTime() + retryDelayMs);

  await prisma.scheduledReport.update({
    where: { id: scheduleId },
    data: {
      failureCount,
      lastFailureAt: now,
      lastFailureReason: truncateFailureReason(errorMessage),
      isActive: shouldDisable ? false : undefined,
      nextRunAt: shouldDisable ? null : retryAt,
    },
  });

  return {
    status: shouldDisable ? 'disabled' : 'failed',
    failureCount,
    nextRunAt: shouldDisable ? null : retryAt,
  };
}

async function markScheduledReportSkipped(
  schedule: ScheduledReportForDelivery,
  nextRunAt: Date,
  recipients: number,
  error: string,
): Promise<ScheduledReportDeliveryResult> {
  await prisma.scheduledReport.update({
    where: { id: schedule.id },
    data: {
      failureCount: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      nextRunAt,
    },
  });

  return {
    scheduleId: schedule.id,
    projectId: schedule.projectId,
    reportType: schedule.reportType,
    recipients,
    status: 'skipped',
    nextRunAt: nextRunAt.toISOString(),
    error,
  };
}

async function sendImmediateScheduledReportEmail(
  schedule: ScheduledReportForDelivery,
  document: ScheduledReportDocument,
  now: Date,
  pdfBuffer: Buffer,
  recipients: string[],
): Promise<void> {
  if (recipients.length === 0) {
    return;
  }

  const emailResult = await sendScheduledReportEmail({
    to: recipients,
    projectName: schedule.project.name,
    reportType: document.reportTypeLabel,
    reportName: document.reportName,
    generatedAt: now.toISOString(),
    pdfBuffer,
    viewReportUrl: document.viewReportUrl,
  });

  if (!emailResult.success) {
    throw new Error(emailResult.error || 'Scheduled report email failed');
  }
}

async function markScheduledReportSent(
  schedule: ScheduledReportForDelivery,
  now: Date,
  nextRunAt: Date,
  deliveredRecipients: number,
): Promise<ScheduledReportDeliveryResult> {
  await prisma.scheduledReport.update({
    where: { id: schedule.id },
    data: {
      failureCount: 0,
      lastFailureAt: null,
      lastFailureReason: null,
      lastSentAt: now,
      nextRunAt,
    },
  });

  return {
    scheduleId: schedule.id,
    projectId: schedule.projectId,
    reportType: schedule.reportType,
    recipients: deliveredRecipients,
    status: 'sent',
    nextRunAt: nextRunAt.toISOString(),
  };
}

async function buildPreDeliverySkipResult(
  schedule: ScheduledReportForDelivery,
  now: Date,
  lockMs: number,
  recipientCount: number,
): Promise<ScheduledReportDeliveryResult | null> {
  if (!canDeliverScheduledReportForTier(schedule.project.company?.subscriptionTier)) {
    return {
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      reportType: schedule.reportType,
      recipients: recipientCount,
      status: 'skipped',
      error: 'Scheduled reports require a Professional or Enterprise subscription',
    };
  }

  const claimed = await claimScheduledReport(schedule.id, now, lockMs);
  if (!claimed) {
    return {
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      reportType: schedule.reportType,
      recipients: recipientCount,
      status: 'skipped',
      error: 'Schedule was already claimed or is no longer due',
    };
  }

  return null;
}

async function deliverClaimedScheduledReport(
  schedule: ScheduledReportForDelivery,
  now: Date,
  recipients: string[],
): Promise<ScheduledReportDeliveryResult> {
  assertScheduledReportFrequency(schedule.frequency);
  validateScheduledReportRecipients(recipients);

  const document = await buildScheduledReportDocument(schedule, now);
  const pdfBuffer = createTextPdf(document.lines);
  const nextRunAt = calculateNextScheduledReportRunAt(
    schedule.frequency,
    schedule.dayOfWeek,
    schedule.dayOfMonth,
    schedule.timeOfDay,
    now,
  );
  const { immediateRecipients, digestRecipientUserIds, suppressedRecipients } =
    await resolveScheduledReportRecipients(schedule, recipients);

  if (immediateRecipients.length === 0 && digestRecipientUserIds.length === 0) {
    return markScheduledReportSkipped(
      schedule,
      nextRunAt,
      recipients.length,
      suppressedRecipients.length > 0
        ? 'No eligible scheduled report recipients'
        : 'Scheduled report has no recipients',
    );
  }

  await sendImmediateScheduledReportEmail(schedule, document, now, pdfBuffer, immediateRecipients);
  await queueScheduledReportDigestItems(schedule, document, digestRecipientUserIds);

  return markScheduledReportSent(
    schedule,
    now,
    nextRunAt,
    immediateRecipients.length + digestRecipientUserIds.length,
  );
}

async function processScheduledReport(
  schedule: ScheduledReportForDelivery,
  now: Date,
  options: Required<Pick<ProcessDueScheduledReportsOptions, 'lockMs' | 'retryDelayMs'>>,
): Promise<ScheduledReportDeliveryResult> {
  const recipients = parseRecipients(schedule.recipients);
  const preDeliverySkip = await buildPreDeliverySkipResult(
    schedule,
    now,
    options.lockMs,
    recipients.length,
  );
  if (preDeliverySkip) {
    return preDeliverySkip;
  }

  try {
    return await deliverClaimedScheduledReport(schedule, now, recipients);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown scheduled report error';
    const failure = await recordScheduledReportFailure(
      schedule,
      errorMessage,
      schedule.id,
      now,
      options.retryDelayMs,
    );

    return {
      scheduleId: schedule.id,
      projectId: schedule.projectId,
      reportType: schedule.reportType,
      recipients: recipients.length,
      status: failure.status,
      failureCount: failure.failureCount,
      nextRunAt: failure.nextRunAt?.toISOString(),
      error: errorMessage,
    };
  }
}

export async function processDueScheduledReports(
  options: ProcessDueScheduledReportsOptions = {},
): Promise<ProcessDueScheduledReportsResult> {
  if (options.scheduleIds && options.scheduleIds.length === 0) {
    return { processed: 0, sent: 0, failed: 0, disabled: 0, skipped: 0, results: [] };
  }

  const now = options.now ?? new Date();
  const limit = parsePositiveInteger(options.limit, DEFAULT_PROCESS_LIMIT);
  const lockMs = parsePositiveInteger(options.lockMs, DEFAULT_LOCK_MS);
  const retryDelayMs = parsePositiveInteger(options.retryDelayMs, DEFAULT_RETRY_DELAY_MS);
  const schedules = await prisma.scheduledReport.findMany({
    where: {
      isActive: true,
      ...(options.scheduleIds ? { id: { in: options.scheduleIds } } : {}),
      OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
      project: {
        status: 'active',
      },
    },
    include: {
      project: {
        select: { name: true, companyId: true, company: { select: { subscriptionTier: true } } },
      },
    },
    orderBy: [{ nextRunAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });

  const results: ScheduledReportDeliveryResult[] = [];
  for (const schedule of schedules) {
    results.push(await processScheduledReport(schedule, now, { lockMs, retryDelayMs }));
  }

  const sent = results.filter((result) => result.status === 'sent').length;
  const disabled = results.filter((result) => result.status === 'disabled').length;
  const failed = results.filter((result) => result.status === 'failed').length + disabled;
  const skipped = results.filter((result) => result.status === 'skipped').length;

  return {
    processed: results.length,
    sent,
    failed,
    disabled,
    skipped,
    results,
  };
}

function getScheduledReportWorkerEnabled(): boolean {
  const configured = process.env.SCHEDULED_REPORT_WORKER_ENABLED?.trim().toLowerCase();
  if (configured === 'false' || configured === '0' || configured === 'no') {
    return false;
  }
  if (configured === 'true' || configured === '1' || configured === 'yes') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}

function getScheduledReportWorkerIntervalMs(): number {
  return parsePositiveInteger(
    process.env.SCHEDULED_REPORT_WORKER_INTERVAL_MS,
    DEFAULT_WORKER_INTERVAL_MS,
  );
}

export function startScheduledReportWorker(): { stop: () => void } | null {
  if (!getScheduledReportWorkerEnabled()) {
    return null;
  }

  const intervalMs = getScheduledReportWorkerIntervalMs();
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      const result = await processDueScheduledReports();
      if (result.processed > 0) {
        logInfo('[Scheduled Reports] Processed due schedules', {
          processed: result.processed,
          sent: result.sent,
          failed: result.failed,
          disabled: result.disabled,
          skipped: result.skipped,
        });
      }
      for (const failedResult of result.results.filter(
        (item) => item.status === 'failed' || item.status === 'disabled',
      )) {
        logError('[Scheduled Reports] Delivery failed', failedResult);
      }
    } catch (error) {
      logError('[Scheduled Reports] Worker run failed', error);
    } finally {
      isRunning = false;
    }
  };

  const initialTimer = setTimeout(
    () => {
      void run();
    },
    Math.min(5000, intervalMs),
  );
  const intervalTimer = setInterval(() => {
    void run();
  }, intervalMs);

  logInfo('[Scheduled Reports] Worker started', { intervalMs });

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      logInfo('[Scheduled Reports] Worker stopped');
    },
  };
}
